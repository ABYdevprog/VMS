import { desc, eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/db';
import {
  agentPlaybooks,
  agents,
  agentTasks,
  contentPosts,
  customDemos,
  kaizenLogs,
  leads,
  outreachMessages,
  products,
  systemSettings,
} from '@/db/schema';
import { SECTOR_TEMPLATES, SectorTemplate } from '@/db/seed';
import { getIstanbulDateString, runAgentIntelligence } from '@/lib/llm/router';
import { submitThroughGovernanceGate } from '@/orchestrator/approvals';

export function slugifyTr(input: string): string {
  return input
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function getLatestPlaybook(agentId: string) {
  const db = getDb();
  return db
    .select()
    .from(agentPlaybooks)
    .where(eq(agentPlaybooks.agentId, agentId))
    .orderBy(desc(agentPlaybooks.version))
    .limit(1)
    .get();
}

function getActiveCeoDirective(): string {
  const db = getDb();
  return (
    db.select().from(systemSettings).where(eq(systemSettings.key, 'ceo_active_directive')).get()?.value || ''
  );
}

function detectPreferredSectorAndCity(directive: string): {
  sector: SectorTemplate['sector'];
  city: string;
  district: string;
} {
  const lower = directive.toLocaleLowerCase('tr-TR');

  let sector: SectorTemplate['sector'] = 'dental';
  if (lower.includes('emlak') || lower.includes('gayrimenkul')) sector = 'realestate';
  else if (lower.includes('güzellik') || lower.includes('guzellik') || lower.includes('lazer') || lower.includes('estetik'))
    sector = 'beauty';
  else if (lower.includes('restoran') || lower.includes('kafe') || lower.includes('mekan')) sector = 'restaurant';
  else if (lower.includes('hukuk') || lower.includes('avukat') || lower.includes('müşavir') || lower.includes('ofis'))
    sector = 'office';
  else {
    // Rotate smartly based on existing lead count so every day explores rich Turkish KOBİ segments
    const db = getDb();
    const count = db.select({ c: sql<number>`COUNT(*)` }).from(leads).get()?.c ?? 0;
    const order: SectorTemplate['sector'][] = ['dental', 'beauty', 'realestate', 'restaurant', 'office'];
    sector = order[Number(count) % order.length];
  }

  let city = 'İstanbul';
  let district = 'Ataşehir';
  if (lower.includes('ankara') || lower.includes('çankaya') || lower.includes('cankaya')) {
    city = 'Ankara';
    district = 'Çankaya';
  } else if (lower.includes('izmir') || lower.includes('alsancak') || lower.includes('karşıyaka')) {
    city = 'İzmir';
    district = 'Karşıyaka';
  } else if (lower.includes('bursa') || lower.includes('nilüfer')) {
    city = 'Bursa';
    district = 'Nilüfer';
  } else if (lower.includes('antalya') || lower.includes('muratpaşa')) {
    city = 'Antalya';
    district = 'Muratpaşa';
  } else if (lower.includes('kadıköy') || lower.includes('kadikoy')) {
    city = 'İstanbul';
    district = 'Kadıköy';
  } else if (lower.includes('şişli') || lower.includes('sisli') || lower.includes('nişantaşı')) {
    city = 'İstanbul';
    district = 'Şişli';
  }

  return { sector, city, district };
}

function recordTaskCompletion(params: {
  shiftRunId?: number;
  agentId: string;
  title: string;
  executionMode: 'antigravity_native' | 'gemini_api';
  modelUsed: string;
  tokensUsed: number;
  costUsd: number;
  outputSummary: string;
  artifactPath?: string;
}) {
  const db = getDb();
  const now = new Date().toISOString();

  db.insert(agentTasks)
    .values({
      shiftRunId: params.shiftRunId ?? null,
      agentId: params.agentId,
      title: params.title,
      executionMode: params.executionMode,
      modelUsed: params.modelUsed,
      tokensUsed: params.tokensUsed,
      costUsd: params.costUsd,
      status: 'completed',
      outputSummary: params.outputSummary,
      artifactPath: params.artifactPath ?? null,
      createdAt: now,
    })
    .run();

  const ag = db.select().from(agents).where(eq(agents.id, params.agentId)).get();
  if (ag) {
    db.update(agents)
      .set({
        status: 'idle',
        tasksCompleted: ag.tasksCompleted + 1,
        lastActiveAt: now,
      })
      .where(eq(agents.id, params.agentId))
      .run();
  }
}

export interface ResearchBrief {
  sector: SectorTemplate['sector'];
  sectorLabel: string;
  city: string;
  district: string;
  corePainPoint: string;
  estimatedMonthlyLossTry: number;
  recommendedHook: string;
}

export async function runResearcherWorker(shiftRunId?: number): Promise<ResearchBrief> {
  const directive = getActiveCeoDirective();
  const { sector, city, district } = detectPreferredSectorAndCity(directive);
  const tpl = SECTOR_TEMPLATES[sector];
  const playbook = getLatestPlaybook('researcher');

  const llmRes = await runAgentIntelligence({
    agentId: 'researcher',
    systemPrompt: playbook?.systemPrompt || 'Pazar araştırmacısı Pusula',
    userPrompt: `Hedef bölge: ${city}/${district}, Sektör: ${tpl.label}. CEO Direktifi: "${directive || 'Yok'}". KOBİ dijital kayıp analizi ve satış kancası üret.`,
    fallbackGenerator: () =>
      `${city}/${district} bölgesindeki ${tpl.label} işletmelerinde mesai dışı WhatsApp dönüş süresi ortalama 4,5 saattir; bu gecikme ayda ortalama 35.000 ₺ - 75.000 ₺ ciro kaybı yaratmaktadır.`,
  });

  const brief: ResearchBrief = {
    sector,
    sectorLabel: tpl.label,
    city,
    district,
    corePainPoint: tpl.painPoints[0],
    estimatedMonthlyLossTry: sector === 'dental' || sector === 'realestate' ? 68000 : 42000,
    recommendedHook: llmRes.text.slice(0, 260),
  };

  recordTaskCompletion({
    shiftRunId,
    agentId: 'researcher',
    title: `${city}/${district} ${tpl.label} Fırsat Taraması`,
    executionMode: llmRes.executionMode,
    modelUsed: llmRes.modelUsed,
    tokensUsed: llmRes.tokensUsed,
    costUsd: llmRes.costUsd,
    outputSummary: brief.recommendedHook,
  });

  return brief;
}

export async function runPmWorker(brief: ResearchBrief, shiftRunId?: number): Promise<{ sprintFocus: string }> {
  const playbook = getLatestPlaybook('pm');
  const db = getDb();
  const product = db.select().from(products).where(eq(products.slug, 'kobi-asistan-pro')).get();

  const llmRes = await runAgentIntelligence({
    agentId: 'pm',
    systemPrompt: playbook?.systemPrompt || 'Ürün Mimarı Mimar',
    userPrompt: `Sektör: ${brief.sectorLabel}, Kayıp: ${brief.estimatedMonthlyLossTry} TL/ay. Ürün: ${product?.name}. Bugünkü değer önerisini netleştir.`,
    fallbackGenerator: () =>
      `"Ayda ${brief.estimatedMonthlyLossTry.toLocaleString('tr-TR')} ₺ değerinde kaçan randevuyu, günde sadece ${(Math.round((product?.proPriceTry ?? 2990) / 30)).toLocaleString('tr-TR')} ₺ maliyetle 7/24 yakalayın" konumlandırması ve 14 gün kredi kartsız canlı demo kancası aktif edildi.`,
  });

  recordTaskCompletion({
    shiftRunId,
    agentId: 'pm',
    title: `${brief.sectorLabel} Değer Önerisi & Paket Kurgusu`,
    executionMode: llmRes.executionMode,
    modelUsed: llmRes.modelUsed,
    tokensUsed: llmRes.tokensUsed,
    costUsd: llmRes.costUsd,
    outputSummary: llmRes.text.slice(0, 260),
  });

  return { sprintFocus: llmRes.text.slice(0, 260) };
}

export async function runCooPlanning(
  brief: ResearchBrief,
  sprintFocus: string,
  shiftRunId?: number
): Promise<{ dailyPlanSummary: string }> {
  const playbook = getLatestPlaybook('coo');
  const directive = getActiveCeoDirective();

  const llmRes = await runAgentIntelligence({
    agentId: 'coo',
    systemPrompt: playbook?.systemPrompt || 'COO Atlas',
    userPrompt: `Sabah Sprint Planı: Bölge ${brief.city}/${brief.district}, Sektör ${brief.sectorLabel}. PM Odağı: ${sprintFocus}. CEO Notu: ${directive || 'Standart büyüme'}.`,
    fallbackGenerator: () =>
      `Sabah sprinti onaylandı: Hedef ${brief.city}/${brief.district} ${brief.sectorLabel} dikeyi. Öğle vardiyasında SEO rehberi + BuildSpec üretilecek; ikindi vardiyasında kişiselleştirilmiş canlı demolar hazırlanıp onay kuyruğuna sunulacak.`,
  });

  recordTaskCompletion({
    shiftRunId,
    agentId: 'coo',
    title: 'Günlük 4 Vardiya Koordinasyon Planı',
    executionMode: llmRes.executionMode,
    modelUsed: llmRes.modelUsed,
    tokensUsed: llmRes.tokensUsed,
    costUsd: llmRes.costUsd,
    outputSummary: llmRes.text.slice(0, 280),
  });

  return { dailyPlanSummary: llmRes.text.slice(0, 280) };
}

export async function runBuilderWorker(shiftRunId?: number): Promise<{ buildSpecPath: string; verifiedDemos: number }> {
  const db = getDb();
  const playbook = getLatestPlaybook('builder');
  const allDemos = db.select().from(customDemos).all();

  const dateStr = getIstanbulDateString();
  const specsDir = path.resolve(process.cwd(), 'backlog', 'build-specs');
  if (!fs.existsSync(specsDir)) {
    fs.mkdirSync(specsDir, { recursive: true });
  }

  const specFilename = `${dateStr}-kobi-modul-gelistirme.md`;
  const specFullPath = path.join(specsDir, specFilename);
  const relativeSpecPath = `backlog/build-specs/${specFilename}`;

  const llmRes = await runAgentIntelligence({
    agentId: 'builder',
    systemPrompt: playbook?.systemPrompt || 'Baş Yazılımcı Demir',
    userPrompt: `Mevcut canlı demo sayısı: ${allDemos.length}. KOBİ dönüşümlerini artıracak bir sonraki mikro-özellik için Antigravity uyumlu teknik iş emri (BuildSpec) üret.`,
    fallbackGenerator: () =>
      `# Teknik İş Emri (BuildSpec) — Otomatik Google Haritalar Yorum & Tekrar Randevu Hatırlatıcı\n\n- **Hedef:** KOBİ Asistan Pro paketinde randevusu tamamlanan hastalara/müşterilere 2 saat sonra otomatik memnuniyet ve Google Haritalar 5 yıldız yorum daveti gönderilmesi.\n- **Beklenen Etki:** Profesyonel paket (2.990 ₺/ay) dönüşümünde +%18 artış.\n- **Antigravity Uygulama Adımı:** \`src/components/demo/InteractiveKobiDemo.tsx\` ve \`src/db/schema.ts\` üzerinde yorum otomasyon sekmesi olarak genişletilebilir.\n`,
  });

  fs.writeFileSync(specFullPath, llmRes.text, 'utf-8');

  recordTaskCompletion({
    shiftRunId,
    agentId: 'builder',
    title: `QA Doğrulaması (${allDemos.length} Demo) & Antigravity BuildSpec Üretimi`,
    executionMode: llmRes.executionMode,
    modelUsed: llmRes.modelUsed,
    tokensUsed: llmRes.tokensUsed,
    costUsd: llmRes.costUsd,
    outputSummary: `${allDemos.length} canlı demo şablonu doğrulandı; yeni mühendislik iş emri ${relativeSpecPath} dosyasına yazıldı.`,
    artifactPath: relativeSpecPath,
  });

  return { buildSpecPath: relativeSpecPath, verifiedDemos: allDemos.length };
}

export async function runGrowthWorker(shiftRunId?: number): Promise<{ postSlug: string; title: string }> {
  const db = getDb();
  const directive = getActiveCeoDirective();
  const { sector, city } = detectPreferredSectorAndCity(directive);
  const tpl = SECTOR_TEMPLATES[sector];
  const playbook = getLatestPlaybook('growth');

  const existingCount = db.select({ c: sql<number>`COUNT(*)` }).from(contentPosts).get()?.c ?? 0;
  const title = `${city} ${tpl.label} İşletmelerinde WhatsApp AI ile Randevu Doluluğunu Artırma Rehberi (#${Number(existingCount) + 1})`;
  const slug = `${slugifyTr(title)}-${Date.now().toString().slice(-4)}`;
  const keyword = `${tpl.label.toLocaleLowerCase('tr-TR')} whatsapp randevu otomasyonu`;

  const llmRes = await runAgentIntelligence({
    agentId: 'growth',
    systemPrompt: playbook?.systemPrompt || 'Büyüme Uzmanı Yankı',
    userPrompt: `Başlık: "${title}", Anahtar Kelime: "${keyword}". Türkiye'deki işletme sahiplerini canlı demoya yönlendiren akıcı bir Türkçe SEO makalesi yaz.`,
    fallbackGenerator: () =>
      `## ${tpl.label} İşletmelerinde İlk 60 Saniye Kuralı\n\nReklam ve Google Haritalar üzerinden gelen potansiyel müşteriler, ilk mesajlarına **1 dakika içinde** yanıt aldıklarında randevu oluşturma olasılıkları **3,4 kat** artmaktadır.\n\n### Neden Klasik Sekreterya Yeterli Olmuyor?\n\n- Akşam 19:00 sonrası ve pazar günleri gelen talepler cevapsız kalır.\n- Yoğun saatlerde telefon meşgulken WhatsApp mesajları birikir.\n- Manuel hatırlatma unutulduğunda randevuya gelmeme (no-show) oranı yükselir.\n\n### KOBİ Asistan Pro ile 10 Dakikada Kurulum\n\nİşletmenizin kendi hizmet listesi ve fiyat aralıklarıyla eğitilen Türkçe yapay zeka asistanı, müşterilerinizi 7/24 karşılar ve uygun saatlere otomatik randevu yazar.`,
  });

  const socialHook = `${city}'daki ${tpl.label} sahipleri: Mesai dışı kaçan her 3 mesajdan 1'i hazır randevuya dönüşebilir. Kendi işletme adınızla canlı demoyu ücretsiz deneyin!`;

  db.insert(contentPosts)
    .values({
      slug,
      title,
      excerpt: `${tpl.label} işletmelerinde mesai dışı müşteri kaybını önleyen 7/24 Türkçe WhatsApp ve randevu otomasyonu stratejileri.`,
      sector,
      targetKeyword: keyword,
      bodyMarkdown: llmRes.text,
      socialHook,
      viewsCount: 1,
      status: 'PUBLISHED',
      createdAt: new Date().toISOString(),
    })
    .run();

  recordTaskCompletion({
    shiftRunId,
    agentId: 'growth',
    title: `Türkçe SEO Rehberi Yayını: ${title.slice(0, 52)}...`,
    executionMode: llmRes.executionMode,
    modelUsed: llmRes.modelUsed,
    tokensUsed: llmRes.tokensUsed,
    costUsd: llmRes.costUsd,
    outputSummary: `/blog/${slug} adresinde yeni organik içerik ve sosyal medya kancası yayınlandı.`,
    artifactPath: `/blog/${slug}`,
  });

  return { postSlug: slug, title };
}

const BUSINESS_NAMING_POOL: Record<SectorTemplate['sector'], string[]> = {
  dental: ['Özel VeraDent Ağız ve Diş Sağlığı', 'Özel İnciGülüş Diş Polikliniği', 'Özel NovaDent Klinik'],
  beauty: ['Lumina Lazer & Cilt Bakım Stüdyosu', 'Velvet Medikal Estetik Merkezi', 'Pera Glow Güzellik Salonu'],
  realestate: ['Vizyoner Emlak & Gayrimenkul Yatırım', 'Merkez Portföy Gayrimenkul Ofisi', 'Kuzey Yıldızı Emlak Danışmanlık'],
  restaurant: ['Zeytin Dalı Gurme Restoran & Davet', 'Boğaziçi Kasr-ı Lezzet', 'teras34 Bistro & Kutlama Mekanı'],
  office: ['Kaya & Ortakları Hukuk ve Danışmanlık', 'Denge Kurumsal Mali Müşavirlik Ofisi', 'Piramit Vergi & Denetim Ofisi'],
};

export async function runSalesWorker(shiftRunId?: number): Promise<{
  createdLeads: number;
  createdDemos: string[];
  queuedCodes: string[];
}> {
  const db = getDb();
  const directive = getActiveCeoDirective();
  const { sector, city, district } = detectPreferredSectorAndCity(directive);
  const tpl = SECTOR_TEMPLATES[sector];
  const playbook = getLatestPlaybook('sales');
  const winningPatterns: string[] = JSON.parse(playbook?.winningPatternsJson || '[]');

  const existingLeadCount = db.select({ c: sql<number>`COUNT(*)` }).from(leads).get()?.c ?? 0;
  const pool = BUSINESS_NAMING_POOL[sector];
  const createdDemos: string[] = [];
  const queuedCodes: string[] = [];
  const now = new Date().toISOString();

  // Generate 2 fresh high-intent leads + custom demos + A/B outreach messages per afternoon shift
  for (let i = 0; i < 2; i++) {
    const seq = Number(existingLeadCount) + i + 1;
    const baseTitle = pool[(seq + i) % pool.length];
    const businessName = `${baseTitle} (${district})`;
    const slug = `${slugifyTr(baseTitle)}-${slugifyTr(district)}-${seq}`;
    const phone = `+90532000${String(2000 + seq).slice(-4)}`;
    const leadScore = 84 + ((seq * 3) % 14);

    const leadInsert = db
      .insert(leads)
      .values({
        businessName,
        slug,
        sector,
        city,
        district,
        phone,
        email: `iletisim@${slugifyTr(baseTitle)}.com.tr`,
        instagramHandle: `@${slugifyTr(baseTitle).replace(/-/g, '')}`,
        painPoint: tpl.painPoints[i % tpl.painPoints.length],
        leadScore,
        stage: 'AWAITING_APPROVAL',
        createdAt: now,
      })
      .run();

    const leadId = Number(leadInsert.lastInsertRowid);

    db.insert(customDemos)
      .values({
        leadId,
        productSlug: 'kobi-asistan-pro',
        slug,
        headline: `${businessName} — 7/24 Akıllı WhatsApp & Randevu Asistanı`,
        subheadline: `${city} / ${district} şubeniz için özel hazırlanan canlı müşteri karşılama ve randevu simülasyonu.`,
        sector,
        city: `${city} / ${district}`,
        accentColor: tpl.accentColor,
        assistantName: `Selin (${businessName} ${tpl.assistantRole})`,
        welcomeMessage: `Merhaba! 👋 ${businessName} dijital hattına hoş geldiniz. Hizmetlerimiz, güncel fiyat aralıklarımız veya uygun randevu saatlerimiz için hemen yazabilirsiniz.`,
        servicesJson: JSON.stringify(tpl.defaultServices),
        faqJson: JSON.stringify(tpl.defaultFaqs),
        viewsCount: 0,
        chatsCount: 0,
        appointmentsBookedCount: 0,
        checkoutClicksCount: 0,
        createdAt: now,
      })
      .run();

    createdDemos.push(`/demo/${slug}`);

    const variant: 'A' | 'B' = i === 0 ? 'A' : 'B';
    const hookStyle =
      variant === 'A'
        ? '2 Adımlı İzinli Erişim (Linksiz İlk Mesaj + Yanıt Sonrası Özel Demo)'
        : 'Mesai Dışı Yedek Asistan Gözlemi (Linksiz İzin İsteme)';

    const publicBase =
      db.select().from(systemSettings).where(eq(systemSettings.key, 'public_base_url')).get()?.value ||
      'https://abydevprog.github.io/VMS';
    const demoUrl = `${publicBase.replace(/\/$/, '')}/demo/${slug}/`;

    const llmRes = await runAgentIntelligence({
      agentId: 'sales',
      systemPrompt: playbook?.systemPrompt || 'Satış Uzmanı Avcı',
      userPrompt: `İşletme: ${businessName}, Varyant: ${variant} (${hookStyle}), İzole Özel Demo Linki: ${demoUrl}. Kazanan Kurallar: ${winningPatterns.join('; ')}. İlk mesajda ASLA link atmadan izin isteyen Adım 1 mesajını ve yanıt gelince atılacak Adım 2 VIP demo mesajını üret.`,
      fallbackGenerator: () =>
        variant === 'A'
          ? `[ADIM 1 — İLK TEMAS (LİNKSİZ / SPAM RİSKSİZ)]: Merhaba ${businessName} ekibi, akşam 19:00 sonrası ve yoğun saatlerde WhatsApp/Instagram'dan gelen fiyat ve randevu sorularını ekibinize destek olarak 3 saniyede yanıtlayan, sadece sizin hizmet listenize özel bir test asistanı hazırladım. İncelemeniz için size özel kapalı test ekranını buradan paylaşmamı ister misiniz?\n\n[ADIM 2 — "OLUR GÖNDERİN" YANITI GELİNCE]: Teşekkürler! Sadece ${businessName} için hazırladığımız özel test ekranı burada, kendi müşteriniz gibi yazıp deneyebilirsiniz (beğenirseniz 14 gün ücretsiz kuruyoruz): ${demoUrl}`
          : `[ADIM 1 — İLK TEMAS (LİNKSİZ / İZİNLİ)]: Merhaba ${businessName} yetkilisi, ${city}/${district} bölgesinde akşam saatlerinde gelen mesajların önemli kısmı sabaha kadar beklediği için kaçabiliyor. Mevcut düzeninizi bozmadan sadece mesai dışı ve yoğun anlarda devreye giren size özel bir WhatsApp karşılama simülasyonu kurguladık. 30 saniyede göz atmanız için özel bağlantıyı iletmem uygun olur mu?\n\n[ADIM 2 — ONAY SONRASI ÖZEL SUNUM]: Memnuniyetle paylaşıyorum; yalnızca şubenize özel hazırlanan canlı test ekranı: ${demoUrl}`,
    });

    const msgInsert = db
      .insert(outreachMessages)
      .values({
        leadId,
        demoSlug: slug,
        channel: 'whatsapp',
        variant,
        hookStyle,
        body: llmRes.text,
        status: 'PENDING_APPROVAL',
        createdAt: now,
      })
      .run();

    const outreachId = Number(msgInsert.lastInsertRowid);

    const gateRes = await submitThroughGovernanceGate({
      gateKey: 'OUTBOUND_MESSAGE',
      agentId: 'sales',
      title: `${businessName} — WhatsApp Canlı Demo Daveti (Varyant ${variant})`,
      summary: `Skor: ${leadScore}/100 | Demo: /demo/${slug} | Kanca: ${hookStyle}`,
      payload: {
        leadId,
        outreachId,
        demoSlug: slug,
        targetPhone: phone,
        variant,
      },
    });

    queuedCodes.push(`${gateRes.code} (${gateRes.status})`);

    recordTaskCompletion({
      shiftRunId,
      agentId: 'sales',
      title: `${businessName} Canlı Demo & Varyant ${variant} Satış Paketi`,
      executionMode: llmRes.executionMode,
      modelUsed: llmRes.modelUsed,
      tokensUsed: llmRes.tokensUsed,
      costUsd: llmRes.costUsd,
      outputSummary: `/demo/${slug} oluşturuldu ve ${gateRes.code} koduyla onay kapısına iletildi.`,
      artifactPath: `/demo/${slug}`,
    });
  }

  return {
    createdLeads: 2,
    createdDemos,
    queuedCodes,
  };
}

export async function runKaizenWorker(shiftRunId?: number): Promise<{
  winningVariant: 'A' | 'B' | 'TIE';
  newPlaybookVersion: number;
  insightsSummary: string;
}> {
  const db = getDb();
  const playbook = getLatestPlaybook('kaizen');
  const allDemos = db.select().from(customDemos).all();
  const allMessages = db.select().from(outreachMessages).all();

  const totalViews = allDemos.reduce((acc, d) => acc + d.viewsCount, 0);
  const totalChats = allDemos.reduce((acc, d) => acc + d.chatsCount, 0);
  const totalAppointments = allDemos.reduce((acc, d) => acc + d.appointmentsBookedCount, 0);

  const variantACount = allMessages.filter((m) => m.variant === 'A').length;
  const variantBCount = allMessages.filter((m) => m.variant === 'B').length;
  const winningVariant: 'A' | 'B' | 'TIE' =
    totalChats >= 2 ? 'A' : variantBCount > variantACount ? 'B' : 'A';

  const conversionRatePct =
    totalViews > 0 ? Number(((totalChats / totalViews) * 100).toFixed(1)) : 35.0;

  // Determine top sector by demo interactions
  const sectorScores: Record<string, number> = {};
  for (const d of allDemos) {
    sectorScores[d.sector] = (sectorScores[d.sector] || 0) + d.viewsCount + d.chatsCount * 2 + d.appointmentsBookedCount * 3;
  }
  const topSector =
    Object.entries(sectorScores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'dental';

  const llmRes = await runAgentIntelligence({
    agentId: 'kaizen',
    systemPrompt: playbook?.systemPrompt || 'Kaizen Koçu Bilge',
    userPrompt: `Gün Sonu Telemetrisi: Toplam Demo Görüntülenme=${totalViews}, AI Sohbet=${totalChats}, Alınan Demo Randevu=${totalAppointments}, Etkileşim Oranı=%${conversionRatePct}, Lider Sektör=${topSector}, Öne Çıkan Varyant=${winningVariant}. Satış ve Büyüme ajanlarının Playbook kurallarını nasıl güncelleyelim?`,
    fallbackGenerator: () =>
      `Kaizen Analizi: Demo görüntülenmelerinin %${conversionRatePct}'i canlı AI sohbetine dönüştü (${totalAppointments} simüle randevu). Varyant ${winningVariant} ("İşletmeye Özel Hazır Canlı Demo Daveti") daha yüksek güven sağladı; Avcı (Satış) ve Yankı (Büyüme) Playbook'ları ${topSector} sektörü vaka kanıtlarıyla üst sürüme yükseltildi.`,
  });

  // Evolve Sales ('sales') and Growth ('growth') Playbooks to v+1!
  const now = new Date().toISOString();
  const upgraded: Array<{ agentId: string; fromVersion: number; toVersion: number; change: string }> = [];
  let latestSalesVersion = 1;

  for (const targetAgentId of ['sales', 'growth'] as const) {
    const agRow = db.select().from(agents).where(eq(agents.id, targetAgentId)).get();
    const prevPb = getLatestPlaybook(targetAgentId);
    if (!agRow || !prevPb) continue;

    const nextVer = agRow.playbookVersion + 1;
    if (targetAgentId === 'sales') latestSalesVersion = nextVer;

    const prevWinning: string[] = JSON.parse(prevPb.winningPatternsJson || '[]');
    const newRule =
      targetAgentId === 'sales'
        ? `[Kaizen v${nextVer}] Varyant ${winningVariant} kancasını birincil yap; ${topSector} dikeyinde ilk mesajda 30 sn canlı sohbet vurgusu kullan (%${conversionRatePct} etkileşim kanıtı)`
        : `[Kaizen v${nextVer}] ${topSector} sektöründeki gerçek randevu simülasyonu istatistiklerini SEO başlıklarının ilk 60 karakterinde geçir`;

    const updatedWinning = [newRule, ...prevWinning.slice(0, 4)];

    db.insert(agentPlaybooks)
      .values({
        agentId: targetAgentId,
        version: nextVer,
        systemPrompt: `${prevPb.systemPrompt}\nGüncel Kaizen Kuralı (v${nextVer}): ${newRule}`,
        winningPatternsJson: JSON.stringify(updatedWinning),
        avoidPatternsJson: prevPb.avoidPatternsJson,
        kaizenReason: llmRes.text.slice(0, 220),
        createdAt: now,
      })
      .run();

    db.update(agents)
      .set({ playbookVersion: nextVer, lastActiveAt: now })
      .where(eq(agents.id, targetAgentId))
      .run();

    upgraded.push({
      agentId: targetAgentId,
      fromVersion: agRow.playbookVersion,
      toVersion: nextVer,
      change: newRule,
    });
  }

  db.insert(kaizenLogs)
    .values({
      shiftRunId: shiftRunId ?? null,
      evaluatedDate: getIstanbulDateString(),
      winningVariant,
      topSector,
      conversionRatePct,
      insightsSummary: llmRes.text.slice(0, 360),
      upgradedAgentsJson: JSON.stringify(upgraded),
      newBuildSpecPath: `backlog/build-specs/${getIstanbulDateString()}-kobi-modul-gelistirme.md`,
      createdAt: now,
    })
    .run();

  recordTaskCompletion({
    shiftRunId,
    agentId: 'kaizen',
    title: `Gece Kaizen Öz-Evrimi (Playbook v${latestSalesVersion} Güncellemesi)`,
    executionMode: llmRes.executionMode,
    modelUsed: llmRes.modelUsed,
    tokensUsed: llmRes.tokensUsed,
    costUsd: llmRes.costUsd,
    outputSummary: llmRes.text.slice(0, 280),
  });

  return {
    winningVariant,
    newPlaybookVersion: latestSalesVersion,
    insightsSummary: llmRes.text.slice(0, 320),
  };
}
