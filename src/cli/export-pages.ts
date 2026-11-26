import { desc } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/db';
import {
  agentPlaybooks,
  agents,
  agentTasks,
  approvalQueue,
  contentPosts,
  customDemos,
  kaizenLogs,
  leads,
  outreachMessages,
  products,
  shiftRuns,
} from '@/db/schema';
import { ensureSeeded, SECTOR_TEMPLATES } from '@/db/seed';
import { buildWaMeUrl } from '@/integrations/outreach';

const BASE_PATH = '/VMS';
const STATE_FILE = path.resolve(process.cwd(), 'data', 'agency-state.json');
const OUT_DIR = path.resolve(process.cwd(), 'public-pages');

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function importStateIfDbFresh(): void {
  const db = getDb();
  const existingShifts = db.select().from(shiftRuns).all();
  if (existingShifts.length > 0 || !fs.existsSync(STATE_FILE)) {
    ensureSeeded();
    return;
  }

  ensureSeeded();
  const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as {
    agents?: Array<typeof agents.$inferSelect>;
    playbooks?: Array<typeof agentPlaybooks.$inferSelect>;
    shifts?: Array<typeof shiftRuns.$inferSelect>;
    tasks?: Array<typeof agentTasks.$inferSelect>;
    leads?: Array<typeof leads.$inferSelect>;
    demos?: Array<typeof customDemos.$inferSelect>;
    outreach?: Array<typeof outreachMessages.$inferSelect>;
    approvals?: Array<typeof approvalQueue.$inferSelect>;
    posts?: Array<typeof contentPosts.$inferSelect>;
    kaizen?: Array<typeof kaizenLogs.$inferSelect>;
  };

  if (raw.shifts && raw.shifts.length > 0) {
    db.delete(agents).run();
    for (const r of raw.agents || []) db.insert(agents).values(r).run();
    db.delete(agentPlaybooks).run();
    for (const r of raw.playbooks || []) db.insert(agentPlaybooks).values(r).run();
    db.delete(shiftRuns).run();
    for (const r of raw.shifts || []) db.insert(shiftRuns).values(r).run();
    db.delete(agentTasks).run();
    for (const r of raw.tasks || []) db.insert(agentTasks).values(r).run();
    db.delete(leads).run();
    for (const r of raw.leads || []) db.insert(leads).values(r).run();
    db.delete(customDemos).run();
    for (const r of raw.demos || []) db.insert(customDemos).values(r).run();
    db.delete(outreachMessages).run();
    for (const r of raw.outreach || []) db.insert(outreachMessages).values(r).run();
    db.delete(approvalQueue).run();
    for (const r of raw.approvals || []) db.insert(approvalQueue).values(r).run();
    db.delete(contentPosts).run();
    for (const r of raw.posts || []) db.insert(contentPosts).values(r).run();
    db.delete(kaizenLogs).run();
    for (const r of raw.kaizen || []) db.insert(kaizenLogs).values(r).run();
  }
}

interface DemoRenderSpec {
  slug: string;
  businessName: string;
  headline: string;
  subheadline: string;
  city: string;
  accentColor: string;
  assistantName: string;
  welcomeMessage: string;
  services: Array<{ name: string; duration: string; priceRange: string }>;
  faqs: Array<{ q: string; a: string }>;
  isGenericShowcase: boolean;
}

function renderIsolatedDemoHtml(spec: DemoRenderSpec): string {
  const initialLetter = spec.businessName.trim().charAt(0).toUpperCase() || 'K';
  const topRightAction = spec.isGenericShowcase
    ? `<a href="${BASE_PATH}/#fiyatlandirma" class="btn btn-secondary btn-sm">Ana Vitrine Dön</a>`
    : `<a href="#paketler" class="btn btn-primary btn-sm">14 Gün Ücretsiz Pilot Kurulum</a>`;

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${escapeHtml(spec.headline)}</title>
  <link rel="stylesheet" href="${BASE_PATH}/styles.css" />
</head>
<body>
  <header class="site-header">
    <div class="shell-container site-header-inner">
      <div class="brand-mark">
        <span class="brand-emblem" style="background:${escapeHtml(spec.accentColor)};">${escapeHtml(initialLetter)}</span>
        <div>
          <div>${escapeHtml(spec.businessName)}</div>
          <div style="font-size:0.73rem;font-weight:500;color:var(--ink-muted);">İşletmeye Özel Hazırlanan Canlı Sistem Simülasyonu</div>
        </div>
      </div>
      <nav class="nav-links">
        <a href="#canli-simulator" class="nav-link">Canlı Test Ekranı</a>
        <a href="#paketler" class="nav-link">Kurulum & Paketler</a>
        ${topRightAction}
      </nav>
    </div>
  </header>

  <main>
    <section class="hero-section" style="padding-top:34px;padding-bottom:34px;">
      <div class="shell-container">
        <span class="eyebrow-label" style="color:${escapeHtml(spec.accentColor)};">${escapeHtml(spec.city)} • Özel Canlı Önizleme</span>
        <h1 class="hero-title" style="font-size:clamp(1.65rem,3vw,2.35rem);margin-bottom:12px;">${escapeHtml(spec.headline)}</h1>
        <p class="hero-lead" style="margin-bottom:0;">${escapeHtml(spec.subheadline)} Aşağıdaki WhatsApp penceresine <strong>kendi müşterinizmiş gibi</strong> yazarak asistanın yanıt hızını ve sağdaki tabloya otomatik randevu düşürmesini canlı test edin.</p>
      </div>
    </section>

    <section class="section-block" id="canli-simulator">
      <div class="shell-container">
        <div class="grid-2" style="align-items:start;">
          <div class="wa-frame">
            <div class="wa-top" style="background:${escapeHtml(spec.accentColor)};">
              <div>
                <div style="font-weight:700;font-size:0.95rem;">${escapeHtml(spec.assistantName)}</div>
                <div style="font-size:0.77rem;opacity:0.9;">Çevrimiçi • Mesai dışı ve yoğun an yedek karşılama aktif</div>
              </div>
            </div>
            <div class="wa-messages" id="waMessages">
              <div class="wa-bubble wa-bubble-bot">${escapeHtml(spec.welcomeMessage)}</div>
            </div>
            <div class="wa-quick-prompts">
              <button type="button" class="wa-chip" onclick="askBot('Merhaba, güncel işlem ve hizmet fiyatlarınız nedir?')">💰 Fiyatları Sor</button>
              <button type="button" class="wa-chip" onclick="askBot('Yarın öğleden sonra randevu alabilir miyim?')">📅 Yarın İçin Randevu Al</button>
              <button type="button" class="wa-chip" onclick="askBot('Cumartesi açık mısınız, taksit var mı?')">🕒 Cumartesi & Taksit Sor</button>
            </div>
            <form class="wa-composer" onsubmit="event.preventDefault(); sendUserText();">
              <input id="chatInp" class="input-control" placeholder="Müşteriniz gibi bir soru veya randevu talebi yazın..." />
              <button type="submit" class="btn btn-primary">Gönder</button>
            </form>
          </div>

          <div style="display:flex;flex-direction:column;gap:18px;">
            <div class="surface-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div>
                  <h2 style="font-size:1.12rem;">Canlı Randevu & Müşteri Takip Ekranı</h2>
                  <p style="font-size:0.83rem;color:var(--ink-secondary);">Soldaki sohbette randevu istediğiniz an bu listeye otomatik düşer.</p>
                </div>
                <span class="tag tag-emerald">Canlı Senkronize</span>
              </div>
              <div class="data-table-wrap">
                <table class="data-table">
                  <thead><tr><th>Müşteri</th><th>Hizmet</th><th>Tarih / Saat</th><th>Durum</th></tr></thead>
                  <tbody id="apptBody">
                    <tr><td style="font-weight:600;">Ayşe Yılmaz</td><td>${escapeHtml(spec.services[0]?.name || 'Ön Görüşme')}</td><td>Bugün 16:30</td><td><span class="tag tag-neutral">Teyitli</span></td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="surface-card">
              <h3 style="font-size:1rem;margin-bottom:10px;">${escapeHtml(spec.businessName)} Tanımlı Hizmet Bilgileri</h3>
              <div style="display:flex;flex-direction:column;gap:8px;">
                ${spec.services
                  .map(
                    (s) => `<div class="subtle-panel" style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
                      <div><div style="font-weight:600;font-size:0.9rem;">${escapeHtml(s.name)}</div><div style="font-size:0.78rem;color:var(--ink-muted);">Süre: ${escapeHtml(s.duration)}</div></div>
                      <span class="tag tag-neutral tabular">${escapeHtml(s.priceRange)}</span>
                    </div>`
                  )
                  .join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section-block" id="paketler" style="border-bottom:none;">
      <div class="shell-container">
        <h2 class="section-heading">Kendi Hattınızda 14 Gün Ücretsiz Pilot Olarak Deneyin</h2>
        <p class="section-sub">Mevcut sekreterya düzeninizi bozmadan, sadece mesai dışı veya yoğun anlarda devreye girecek şekilde ekibimiz tarafından anahtar teslim kurulur.</p>
        <div class="grid-3">
          <div class="surface-card">
            <h3>Başlangıç Paketi</h3>
            <div class="tabular" style="font-size:1.85rem;font-weight:800;margin:10px 0;">1.490 ₺ <span style="font-size:0.88rem;font-weight:500;color:var(--ink-muted);">/ ay</span></div>
            <p style="font-size:0.88rem;color:var(--ink-secondary);margin-bottom:16px;">7/24 WhatsApp karşılama ve aylık 300 otomatik randevu.</p>
            <button class="btn btn-secondary" style="width:100%;" onclick="activatePlan('Başlangıç (1.490 ₺/ay)')">14 Gün Ücretsiz Pilot İste</button>
          </div>
          <div class="surface-card" style="border-color:var(--accent-primary);">
            <span class="tag tag-emerald" style="margin-bottom:8px;">En Çok Tercih Edilen</span>
            <h3>Profesyonel Paket</h3>
            <div class="tabular" style="font-size:1.85rem;font-weight:800;margin:10px 0;">2.990 ₺ <span style="font-size:0.88rem;font-weight:500;color:var(--ink-muted);">/ ay</span></div>
            <p style="font-size:0.88rem;color:var(--ink-secondary);margin-bottom:16px;">Sınırsız WhatsApp + Instagram DM, randevu hatırlatma ve Google yorum otomasyonu.</p>
            <button class="btn btn-primary" style="width:100%;" onclick="activatePlan('Profesyonel (2.990 ₺/ay)')">Profesyonel Pilot Başlat</button>
          </div>
          <div class="surface-card">
            <h3>Kurumsal Özel Kurulum</h3>
            <div class="tabular" style="font-size:1.85rem;font-weight:800;margin:10px 0;">14.900 ₺ <span style="font-size:0.88rem;font-weight:500;color:var(--ink-muted);">tek seferlik</span></div>
            <p style="font-size:0.88rem;color:var(--ink-secondary);margin-bottom:16px;">Çok şubeli işletmeler için özel yazılım/CRM entegrasyonu.</p>
            <button class="btn btn-secondary" style="width:100%;" onclick="activatePlan('Kurumsal Özel Kurulum (14.900 ₺)')">Kurumsal Görüşme İste</button>
          </div>
        </div>
        <div id="planToast" class="surface-card" style="display:none;margin-top:20px;background:var(--accent-soft);"></div>
      </div>
    </section>
  </main>

  <footer style="border-top:1px solid var(--line-subtle);padding:24px 0;color:var(--ink-muted);font-size:0.82rem;">
    <div class="shell-container" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;">
      <span>Bu önizleme ekranı ${escapeHtml(spec.businessName)} için özel olarak yapılandırılmıştır.</span>
      <span>KOBİ Asistan Pro • KVKK Uyumlu Altyapı</span>
    </div>
  </footer>

  <script>
    const SERVICES = ${JSON.stringify(spec.services)};
    const FAQS = ${JSON.stringify(spec.faqs)};
    const BIZ = ${JSON.stringify(spec.businessName)};

    function askBot(text) {
      const box = document.getElementById('waMessages');
      const uDiv = document.createElement('div');
      uDiv.className = 'wa-bubble wa-bubble-user';
      uDiv.textContent = text;
      box.appendChild(uDiv);

      const lower = text.toLocaleLowerCase('tr-TR');
      let reply = '';
      if (lower.includes('randevu') || lower.includes('yarın') || lower.includes('saat') || lower.includes('rezervasyon')) {
        const srv = SERVICES[0] ? SERVICES[0].name : 'Ön Görüşme';
        reply = 'Memnuniyetle! ✅ "' + srv + '" için Yarın 14:30 saatine ön randevunuzu oluşturdum ve sağdaki yönetim ekranına işledim. Randevudan 2 saat önce otomatik WhatsApp hatırlatmanız da gönderilecektir.';
        const tbody = document.getElementById('apptBody');
        const tr = document.createElement('tr');
        tr.innerHTML = '<td style="font-weight:600;">Canlı Demo Testi</td><td>' + srv + '</td><td>Yarın 14:30</td><td><span class="tag tag-emerald">Yeni Eklendi</span></td>';
        tbody.prepend(tr);
      } else if (lower.includes('fiyat') || lower.includes('ücret')) {
        reply = BIZ + ' güncel hizmet aralıklarımız:\\n' + SERVICES.map(s => '• ' + s.name + ': ' + s.priceRange).join('\\n');
      } else {
        reply = FAQS.map(f => '• ' + f.q + ' — ' + f.a).join('\\n') || (BIZ + ' dijital hattındasınız; randevu için uygun saatinizi yazabilirsiniz.');
      }

      const bDiv = document.createElement('div');
      bDiv.className = 'wa-bubble wa-bubble-bot';
      bDiv.textContent = reply;
      box.appendChild(bDiv);
      box.scrollTop = box.scrollHeight;
    }

    function sendUserText() {
      const inp = document.getElementById('chatInp');
      if (!inp.value.trim()) return;
      askBot(inp.value.trim());
      inp.value = '';
    }

    function activatePlan(planName) {
      const el = document.getElementById('planToast');
      el.style.display = 'block';
      el.innerHTML = '<strong>✓ ' + BIZ + ' — ' + planName + ' talebiniz hazır!</strong><p style="margin-top:6px;font-size:0.9rem;">Size ulaşan danışmanımıza WhatsApp üzerinden "14 günlük ücretsiz pilot kurulumu başlatalım" yazmanız yeterlidir; kurulumu ekibimiz aynı gün tamamlar.</p>';
      el.scrollIntoView({ behavior: 'smooth' });
    }
  </script>
</body>
</html>`;
}

export function exportPublicPages(): void {
  ensureSeeded();
  const db = getDb();

  const agentsAll = db.select().from(agents).all();
  const playbooksAll = db.select().from(agentPlaybooks).orderBy(desc(agentPlaybooks.version)).all();
  const shiftsAll = db.select().from(shiftRuns).orderBy(desc(shiftRuns.id)).limit(20).all();
  const tasksAll = db.select().from(agentTasks).orderBy(desc(agentTasks.id)).limit(30).all();
  const approvalsAll = db.select().from(approvalQueue).orderBy(desc(approvalQueue.id)).limit(30).all();
  const outreachAll = db.select().from(outreachMessages).all();
  const leadsAll = db.select().from(leads).orderBy(desc(leads.id)).all();
  const demosAll = db.select().from(customDemos).orderBy(desc(customDemos.id)).all();
  const productsAll = db.select().from(products).all();
  const kaizenAll = db.select().from(kaizenLogs).orderBy(desc(kaizenLogs.id)).limit(12).all();
  const postsAll = db.select().from(contentPosts).orderBy(desc(contentPosts.id)).all();

  const dataDir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        agents: agentsAll,
        playbooks: playbooksAll,
        shifts: shiftsAll,
        tasks: tasksAll,
        leads: leadsAll,
        demos: demosAll,
        outreach: outreachAll,
        approvals: approvalsAll,
        posts: postsAll,
        kaizen: kaizenAll,
      },
      null,
      2
    ),
    'utf-8'
  );

  if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, '.nojekyll'), '', 'utf-8');

  const baseCss = fs.readFileSync(path.resolve(process.cwd(), 'src/app/globals.css'), 'utf-8');
  fs.writeFileSync(path.join(OUT_DIR, 'styles.css'), baseCss, 'utf-8');

  const flagship = productsAll[0];
  const features: string[] = JSON.parse(flagship?.featuresJson || '[]');

  // Create 3 clean GENERIC showcase demos purely for public storefront visitors
  const genericShowcases: Array<{ slug: string; title: string; sector: keyof typeof SECTOR_TEMPLATES }> = [
    { slug: 'ornek-dis-klinigi', title: 'Örnek Ağız ve Diş Sağlığı Polikliniği', sector: 'dental' },
    { slug: 'ornek-guzellik-merkezi', title: 'Örnek Lazer & Medikal Estetik Merkezi', sector: 'beauty' },
    { slug: 'ornek-emlak-ofisi', title: 'Örnek Gayrimenkul & Portföy Ofisi', sector: 'realestate' },
  ];

  for (const gs of genericShowcases) {
    const tpl = SECTOR_TEMPLATES[gs.sector];
    const dir = path.join(OUT_DIR, 'demo', gs.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      renderIsolatedDemoHtml({
        slug: gs.slug,
        businessName: gs.title,
        headline: `${gs.title} — 7/24 Akıllı WhatsApp & Randevu Simülasyonu`,
        subheadline: `${tpl.label} işletmeleri için hazırlanan örnek karşılama ve randevu otomasyonu ekranı.`,
        city: 'Türkiye Geneli Sektör Örneği',
        accentColor: tpl.accentColor,
        assistantName: `Selin (${tpl.assistantRole})`,
        welcomeMessage: `Merhaba! 👋 ${gs.title} örnek test hattına hoş geldiniz. Hizmet fiyatlarımızı sorabilir veya "Yarın öğleden sonra randevu istiyorum" yazarak sistemi test edebilirsiniz.`,
        services: tpl.defaultServices,
        faqs: tpl.defaultFaqs,
        isGenericShowcase: true,
      }),
      'utf-8'
    );
  }

  // 1. Export CLEAN Public Storefront (ZERO Cockpit link, ZERO real prospect names!)
  const storefrontHtml = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>KOBİ Asistan Pro | 7/24 Akıllı WhatsApp & Randevu Otomasyonu</title>
  <link rel="stylesheet" href="${BASE_PATH}/styles.css" />
</head>
<body>
  <header class="site-header">
    <div class="shell-container site-header-inner">
      <a href="${BASE_PATH}/" class="brand-mark">
        <span class="brand-emblem">K</span>
        <span>KOBİ Asistan Pro</span>
      </a>
      <nav class="nav-links">
        <a href="#sektor-ornekleri" class="nav-link">Sektör Simülasyonları</a>
        <a href="#fiyatlandirma" class="nav-link">Paketler & Fiyatlar</a>
        <a href="#rehberler" class="nav-link">Uygulama Rehberleri</a>
        <a href="#fiyatlandirma" class="btn btn-primary btn-sm">14 Gün Ücretsiz Deneyin</a>
      </nav>
    </div>
  </header>

  <main>
    <section class="hero-section">
      <div class="shell-container hero-grid">
        <div>
          <span class="eyebrow-label">Klinik, Güzellik Merkezi, Emlak ve Hizmet İşletmeleri İçin</span>
          <h1 class="hero-title">Mesai Dışı Gelen WhatsApp ve Instagram Mesajlarını Saniyeler İçinde Randevuya Dönüştürün</h1>
          <p class="hero-lead">Mevcut sekreterinizin iş yükünü hafifleten, akşam ve hafta sonu kaçan müşteri sorularını işletmenizin kendi fiyat ve hizmet listesiyle 3 saniyede yanıtlayan 7/24 Türkçe yapay zeka asistanı.</p>
          <div class="hero-actions">
            <a href="${BASE_PATH}/demo/ornek-dis-klinigi/" class="btn btn-primary">Örnek Canlı Simülasyonu Deneyin →</a>
            <a href="#sektor-ornekleri" class="btn btn-secondary">Sektör Örneklerini İnceleyin</a>
          </div>
        </div>
        <div class="surface-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <span class="tag tag-emerald">Anahtar Teslim Kurulum</span>
            <span class="mono" style="font-size:0.78rem;color:var(--ink-muted);">14 Gün Ücretsiz Pilot</span>
          </div>
          <h2 style="font-size:1.22rem;margin-bottom:14px;">${escapeHtml(flagship?.name || 'KOBİ Asistan Pro')} Neler Sağlar?</h2>
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${features.map((f) => `<div style="font-size:0.92rem;">✓ ${escapeHtml(f)}</div>`).join('')}
          </div>
        </div>
      </div>
    </section>

    <section class="section-block" id="sektor-ornekleri">
      <div class="shell-container">
        <h2 class="section-heading">Sektörlere Göre Örnek Çalışma Simülasyonları</h2>
        <p class="section-sub">Sistemin farklı hizmet sektörlerinde müşteri sorularını nasıl karşıladığını ve takvime nasıl randevu işlediğini örnek ekranlarımızda test edebilirsiniz.</p>
        <div class="grid-3">
          ${genericShowcases
            .map((gs) => {
              const sec = SECTOR_TEMPLATES[gs.sector];
              return `<div class="surface-card" style="display:flex;flex-direction:column;justify-content:space-between;gap:16px;">
                <div>
                  <span class="tag tag-emerald" style="margin-bottom:10px;">${escapeHtml(sec.label)}</span>
                  <h3 style="font-size:1.1rem;margin-bottom:8px;">${escapeHtml(gs.title)}</h3>
                  <p style="font-size:0.88rem;color:var(--ink-secondary);">${escapeHtml(sec.painPoints[0])}.</p>
                </div>
                <div style="padding-top:12px;border-top:1px solid var(--line-subtle);">
                  <a href="${BASE_PATH}/demo/${gs.slug}/" class="btn btn-secondary btn-sm" style="width:100%;">Örnek Simülasyonu Aç →</a>
                </div>
              </div>`;
            })
            .join('')}
        </div>
      </div>
    </section>

    <section class="section-block" id="fiyatlandirma">
      <div class="shell-container">
        <h2 class="section-heading">Şeffaf TL Abonelik Paketleri</h2>
        <p class="section-sub">Kurulumu ekibimiz anahtar teslim yapar. 14 gün kendi hattınızda ücretsiz deneyip randevu artışını görün.</p>
        <div class="grid-3">
          <div class="surface-card">
            <h3>Başlangıç</h3>
            <div class="tabular" style="font-size:2rem;font-weight:800;margin:10px 0;">${(flagship?.starterPriceTry ?? 1490).toLocaleString('tr-TR')} ₺ <span style="font-size:0.88rem;font-weight:500;color:var(--ink-muted);">/ ay</span></div>
            <p style="font-size:0.9rem;color:var(--ink-secondary);margin-bottom:16px;">Tek şube işletmeler için 7/24 WhatsApp karşılama ve aylık 300 otomatik randevu.</p>
            <a href="${BASE_PATH}/demo/ornek-dis-klinigi/#paketler" class="btn btn-secondary" style="width:100%;">14 Gün Ücretsiz Pilot Başlat</a>
          </div>
          <div class="surface-card" style="border-color:var(--accent-primary);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><h3>Profesyonel</h3><span class="tag tag-emerald">Önerilen</span></div>
            <div class="tabular" style="font-size:2rem;font-weight:800;margin:10px 0;">${(flagship?.proPriceTry ?? 2990).toLocaleString('tr-TR')} ₺ <span style="font-size:0.88rem;font-weight:500;color:var(--ink-muted);">/ ay</span></div>
            <p style="font-size:0.9rem;color:var(--ink-secondary);margin-bottom:16px;">Sınırsız WhatsApp + Instagram DM, randevu hatırlatma ve Google yorum büyütme paketi.</p>
            <a href="${BASE_PATH}/demo/ornek-dis-klinigi/#paketler" class="btn btn-primary" style="width:100%;">14 Gün Ücretsiz Başla</a>
          </div>
          <div class="surface-card">
            <h3>Kurumsal Özel Kurulum</h3>
            <div class="tabular" style="font-size:2rem;font-weight:800;margin:10px 0;">${(flagship?.enterpriseSetupTry ?? 14900).toLocaleString('tr-TR')} ₺ <span style="font-size:0.88rem;font-weight:500;color:var(--ink-muted);">kurulum</span></div>
            <p style="font-size:0.9rem;color:var(--ink-secondary);margin-bottom:16px;">Çok şubeli poliklinikler ve kurumsal ofisler için özel CRM/ERP entegrasyonu.</p>
            <a href="${BASE_PATH}/demo/ornek-dis-klinigi/#paketler" class="btn btn-secondary" style="width:100%;">Kurumsal Teklif İste</a>
          </div>
        </div>
      </div>
    </section>

    <section class="section-block" id="rehberler" style="border-bottom:none;">
      <div class="shell-container">
        <h2 class="section-heading">KOBİ Dijital Dönüşüm & Otomasyon Rehberleri</h2>
        <p class="section-sub">Sektörel verilerle hazırlanan müşteri karşılama ve randevu yönetimi rehberleri.</p>
        <div class="grid-2">
          ${postsAll
            .map(
              (p) => `<a href="${BASE_PATH}/blog/${p.slug}/" class="surface-card" style="display:block;">
                <span class="tag tag-neutral" style="margin-bottom:10px;">${escapeHtml(p.targetKeyword)}</span>
                <h3 style="font-size:1.12rem;margin-bottom:8px;">${escapeHtml(p.title)}</h3>
                <p style="font-size:0.9rem;color:var(--ink-secondary);margin-bottom:12px;">${escapeHtml(p.excerpt)}</p>
                <span style="font-size:0.85rem;font-weight:600;color:var(--accent-primary);">Rehberi Oku →</span>
              </a>`
            )
            .join('')}
        </div>
      </div>
    </section>
  </main>

  <footer style="border-top:1px solid var(--line-subtle);padding:28px 0;color:var(--ink-muted);font-size:0.85rem;">
    <div class="shell-container" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <span>© 2026 KOBİ Asistan Pro — 7/24 Akıllı Müşteri Karşılama & Randevu Sistemleri</span>
      <span>KVKK Uyumlu Altyapı • Türkiye Yerel Destek</span>
    </div>
  </footer>
</body>
</html>`;
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), storefrontHtml, 'utf-8');

  // 2. Export STRICTLY ISOLATED Private Prospect Demo Pages (/demo/<slug>/index.html — NO "Tüm Demolar" link!)
  for (const demo of demosAll) {
    const demoDir = path.join(OUT_DIR, 'demo', demo.slug);
    fs.mkdirSync(demoDir, { recursive: true });
    const services = JSON.parse(demo.servicesJson || '[]') as Array<{ name: string; duration: string; priceRange: string }>;
    const faqs = JSON.parse(demo.faqJson || '[]') as Array<{ q: string; a: string }>;
    const lead = leadsAll.find((l) => l.id === demo.leadId);
    const bizName = lead?.businessName || demo.headline.split('—')[0].trim();

    fs.writeFileSync(
      path.join(demoDir, 'index.html'),
      renderIsolatedDemoHtml({
        slug: demo.slug,
        businessName: bizName,
        headline: demo.headline,
        subheadline: demo.subheadline,
        city: demo.city,
        accentColor: demo.accentColor,
        assistantName: demo.assistantName,
        welcomeMessage: demo.welcomeMessage,
        services,
        faqs,
        isGenericShowcase: false,
      }),
      'utf-8'
    );
  }

  // 3. Export Blog Pages (/blog/<slug>/index.html)
  for (const post of postsAll) {
    const blogDir = path.join(OUT_DIR, 'blog', post.slug);
    fs.mkdirSync(blogDir, { recursive: true });
    const blogHtml = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(post.title)}</title>
  <link rel="stylesheet" href="${BASE_PATH}/styles.css" />
</head>
<body>
  <header class="site-header">
    <div class="shell-container site-header-inner">
      <a href="${BASE_PATH}/" class="brand-mark"><span class="brand-emblem">K</span><span>KOBİ Asistan Pro Rehber</span></a>
      <a href="${BASE_PATH}/demo/ornek-dis-klinigi/" class="btn btn-primary btn-sm">Örnek Simülasyonu Dene</a>
    </div>
  </header>
  <main class="section-block">
    <article class="shell-container" style="max-width:780px;">
      <span class="eyebrow-label">Hedef Anahtar Kelime: ${escapeHtml(post.targetKeyword)}</span>
      <h1 class="hero-title" style="font-size:clamp(1.7rem,3vw,2.35rem);">${escapeHtml(post.title)}</h1>
      <p class="hero-lead">${escapeHtml(post.excerpt)}</p>
      <div class="surface-card" style="white-space:pre-line;line-height:1.75;">${escapeHtml(post.bodyMarkdown)}</div>
    </article>
  </main>
</body>
</html>`;
    fs.writeFileSync(path.join(blogDir, 'index.html'), blogHtml, 'utf-8');
  }

  // 4. Export Unlisted Internal CEO Cockpit (/cockpit/index.html — noindex + 2-Step Permission Outreach Playbook!)
  const cockpitDir = path.join(OUT_DIR, 'cockpit');
  fs.mkdirSync(cockpitDir, { recursive: true });

  const totalDemoViews = demosAll.reduce((a, d) => a + d.viewsCount, 0);
  const totalDemoChats = demosAll.reduce((a, d) => a + d.chatsCount, 0);
  const pendingCount = approvalsAll.filter((a) => a.status === 'PENDING').length;

  const cockpitHtml = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Gizli CEO Kokpiti | VMS Otonom Yazılım Ajansı</title>
  <link rel="stylesheet" href="${BASE_PATH}/styles.css" />
</head>
<body>
  <header class="site-header">
    <div class="shell-container site-header-inner">
      <div class="brand-mark">
        <span class="brand-emblem">V</span>
        <div>
          <div>VMS İç Yönetim Kokpiti (Gizli URL)</div>
          <div style="font-size:0.74rem;font-weight:500;color:var(--ink-muted);">Müşteri vitrininden tamamen izoledir • 2 Adımlı İzinli Satış Akışı Aktif</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <a href="https://github.com/ABYdevprog/VMS/actions" target="_blank" class="btn btn-secondary btn-sm">Yeni Vardiya Tetikle (GitHub) ↗</a>
        <a href="${BASE_PATH}/" target="_blank" class="btn btn-secondary btn-sm">Müşteri Vitrinini Gör ↗</a>
      </div>
    </div>
  </header>

  <main class="shell-container" style="padding-top:26px;padding-bottom:64px;">
    <h1 style="font-size:clamp(1.45rem,2.4vw,1.9rem);margin-bottom:18px;">Otonom Yazılım Ajansı & 2 Adımlı SatışHunisi</h1>

    <div class="kpi-strip" style="margin-bottom:24px;">
      <div class="kpi-box">
        <div class="kpi-label">KOBİ Havuzu & Özel VIP Demolar</div>
        <div class="kpi-value">${leadsAll.length} / ${demosAll.length}</div>
        <div class="kpi-meta">Her demo %100 izole (diğerlerini görmez)</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Demo Etkileşimi</div>
        <div class="kpi-value">${totalDemoViews} açılış • ${totalDemoChats} sohbet</div>
        <div class="kpi-meta">Kaizen telemetri takibinde</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Satışa Hazır Aday</div>
        <div class="kpi-value">${pendingCount} Aday</div>
        <div class="kpi-meta">Adım 1 (İzin) + Adım 2 (Özel Link)</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Tamamlanan Vardiyalar</div>
        <div class="kpi-value">${shiftsAll.length} Vardiya</div>
        <div class="kpi-meta">09:00 • 12:30 • 16:00 • 22:00 Otomatik</div>
      </div>
    </div>

    <div class="tab-bar">
      <button class="tab-btn tab-btn-active" id="tbtn-approvals" onclick="showTab('approvals')">2 Adımlı Satış Kuyruğu (${leadsAll.length})</button>
      <button class="tab-btn" id="tbtn-agents" onclick="showTab('agents')">7 Uzman Ajan & Kaizen</button>
      <button class="tab-btn" id="tbtn-shifts" onclick="showTab('shifts')">Vardiya Kayıtları</button>
    </div>

    <!-- 2-Step Permission Sales Queue -->
    <div id="tab-approvals" class="surface-card" style="display:flex;flex-direction:column;gap:14px;">
      <div>
        <h2 style="font-size:1.15rem;">Gerçek Saha Satış Hunisi (2 Adımlı İzinli Demo Sunumu)</h2>
        <p style="font-size:0.85rem;color:var(--ink-secondary);margin-top:4px;">
          <strong>Altın Kural:</strong> İlk mesajda (Instagram DM / WhatsApp / E-posta) <strong>asla link atılmaz</strong>; önce merak uyandırıp izin istenir (Adım 1). İşletme <em>"Olur gönderin"</em> dediğinde sadece o işletmeye özel izole VIP demo linki iletilir (Adım 2).
        </p>
      </div>
      ${leadsAll
        .map((lead) => {
          const privateDemoUrl = `https://abydevprog.github.io${BASE_PATH}/demo/${lead.slug}/`;
          const step1Text = `Merhaba ${lead.businessName} ekibi, akşam 19:00 sonrası ve yoğun saatlerde Instagram/WhatsApp'tan gelen fiyat ve randevu sorularını ekibinize destek olarak 3 saniyede yanıtlayan, sadece sizin hizmet listenize özel bir test simülasyonu hazırladım. Göz atmanız için size özel test bağlantısını buradan paylaşmamı ister misiniz?`;
          const step2Text = `Teşekkürler! Sadece ${lead.businessName} için hazırladığımız özel canlı test ekranı burada, kendi müşteriniz gibi yazıp deneyebilirsiniz (beğenirseniz 14 gün ücretsiz pilot olarak kuruyoruz): ${privateDemoUrl}`;
          const waStep1 = buildWaMeUrl(lead.phone, step1Text);
          const waStep2 = buildWaMeUrl(lead.phone, step2Text);

          return `<div class="subtle-panel" style="display:flex;flex-direction:column;gap:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
              <div>
                <strong>${escapeHtml(lead.businessName)}</strong>
                <span style="font-size:0.8rem;color:var(--ink-muted);margin-left:8px;">${escapeHtml(lead.city)}/${escapeHtml(lead.district)} • Instagram: ${escapeHtml(lead.instagramHandle)}</span>
              </div>
              <span class="tag tag-emerald">Puan: ${lead.leadScore}/100</span>
            </div>

            <div style="background:var(--bg-surface);border:1px solid var(--line-subtle);border-radius:8px;padding:10px 12px;font-size:0.84rem;">
              <div style="font-weight:700;color:var(--accent-primary);margin-bottom:4px;">1. ADIM — İlk Temas (Linksiz / Spam Korumalı — Instagram DM, E-Posta veya WhatsApp):</div>
              <div>${escapeHtml(step1Text)}</div>
            </div>

            <div style="background:var(--bg-surface);border:1px solid var(--line-subtle);border-radius:8px;padding:10px 12px;font-size:0.84rem;">
              <div style="font-weight:700;color:var(--amber-ink);margin-bottom:4px;">2. ADIM — "Olur Gönderin" Yanıtı Geldiğinde Atılacak İzole VIP Demo Mesajı:</div>
              <div>${escapeHtml(step2Text)}</div>
            </div>

            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <a href="${waStep1}" target="_blank" class="btn btn-primary btn-sm">1. Adım: Linksiz İzin Mesajı Gönder ↗</a>
              <a href="${waStep2}" target="_blank" class="btn btn-secondary btn-sm">2. Adım: VIP Özel Demo Linkini Gönder ↗</a>
              <a href="${BASE_PATH}/demo/${lead.slug}/" target="_blank" class="btn btn-secondary btn-sm">İzole Demoyu Kontrol Et ↗</a>
            </div>
          </div>`;
        })
        .join('')}
    </div>

    <!-- 7 Agents & Kaizen -->
    <div id="tab-agents" style="display:none;flex-direction:column;gap:18px;">
      <div class="grid-2">
        ${agentsAll
          .map((ag) => {
            const pb = playbooksAll.find((p) => p.agentId === ag.id);
            const rules: string[] = JSON.parse(pb?.winningPatternsJson || '[]');
            return `<div class="surface-card">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">
                <div>
                  <span class="tag tag-neutral" style="margin-bottom:6px;">${escapeHtml(ag.department)}</span>
                  <h3 style="font-size:1.1rem;">${escapeHtml(ag.codename)} — ${escapeHtml(ag.title)}</h3>
                </div>
                <span class="tag tag-emerald mono">Playbook v${ag.playbookVersion}</span>
              </div>
              <div class="mono" style="font-size:0.78rem;color:var(--ink-muted);margin-bottom:10px;">Model: ${escapeHtml(ag.modelId)} (${escapeHtml(ag.thinkingLevel)}) • Görev: ${ag.tasksCompleted}</div>
              <div class="subtle-panel" style="font-size:0.83rem;">
                ${rules.map((r) => `<div style="margin-bottom:4px;">• ${escapeHtml(r)}</div>`).join('')}
              </div>
            </div>`;
          })
          .join('')}
      </div>

      <div class="surface-card">
        <h3 style="font-size:1.1rem;margin-bottom:10px;">Gece Kaizen Öz-Gelişim Kayıtları</h3>
        ${kaizenAll
          .map(
            (k) => `<div class="subtle-panel" style="margin-bottom:8px;">
              <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px;">
                <strong>${escapeHtml(k.evaluatedDate)}</strong>
                <span class="tag tag-emerald">Kazanan Varyant: ${escapeHtml(k.winningVariant)} • Dönüşüm: %${k.conversionRatePct}</span>
              </div>
              <p style="font-size:0.86rem;color:var(--ink-secondary);">${escapeHtml(k.insightsSummary)}</p>
            </div>`
          )
          .join('')}
      </div>
    </div>

    <!-- Shifts -->
    <div id="tab-shifts" class="surface-card" style="display:none;flex-direction:column;gap:10px;">
      <h2 style="font-size:1.15rem;">Çalıştırılan Vardiyalar</h2>
      ${shiftsAll
        .map(
          (s) => `<div class="subtle-panel">
            <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:4px;">
              <span class="tag tag-emerald">${escapeHtml(s.shiftType.toUpperCase())}</span>
              <span style="color:var(--ink-muted);">${escapeHtml(s.shiftDate)} • Kaynak: ${escapeHtml(s.triggerSource)}</span>
            </div>
            <div style="font-size:0.86rem;">${escapeHtml(s.summary)}</div>
          </div>`
        )
        .join('')}
    </div>
  </main>

  <script>
    function showTab(name) {
      ['approvals', 'agents', 'shifts'].forEach((t) => {
        const el = document.getElementById('tab-' + t);
        if (el) el.style.display = t === name ? 'flex' : 'none';
        const b = document.getElementById('tbtn-' + t);
        if (b) b.className = 'tab-btn' + (t === name ? ' tab-btn-active' : '');
      });
    }
  </script>
</body>
</html>`;
  fs.writeFileSync(path.join(cockpitDir, 'index.html'), cockpitHtml, 'utf-8');
  console.log(`✅ İzole müşteri demoları (${demosAll.length} VIP + 3 sektör örneği), temiz vitrin ve gizli CEO Kokpiti üretildi.`);
}

if (require.main === module) {
  const mode = process.argv[2];
  if (mode === '--import-then-export') {
    importStateIfDbFresh();
  }
  exportPublicPages();
}
