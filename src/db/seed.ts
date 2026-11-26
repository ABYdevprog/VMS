import { eq } from 'drizzle-orm';
import { getDb } from './index';
import {
  agents,
  agentPlaybooks,
  autonomyPolicies,
  products,
  leads,
  customDemos,
  contentPosts,
  systemSettings,
} from './schema';

export interface SectorTemplate {
  sector: 'dental' | 'beauty' | 'realestate' | 'restaurant' | 'office';
  label: string;
  accentColor: string;
  assistantRole: string;
  defaultServices: Array<{ name: string; duration: string; priceRange: string }>;
  defaultFaqs: Array<{ q: string; a: string }>;
  painPoints: string[];
}

export const SECTOR_TEMPLATES: Record<SectorTemplate['sector'], SectorTemplate> = {
  dental: {
    sector: 'dental',
    label: 'Diş & Ağız Sağlığı Kliniği',
    accentColor: '#0f766e',
    assistantRole: 'Dijital Hasta Koordinatörü',
    defaultServices: [
      { name: 'İlk Muayene & Panoramik Röntgen', duration: '30 dk', priceRange: 'Ücretsiz Ön Değerlendirme' },
      { name: 'İmplant & Zirkonyum Planlama', duration: '45 dk', priceRange: 'Hekim Muayenesi Sonrası Netleşir' },
      { name: 'Diş Taşı Temizliği & Beyazlatma', duration: '40 dk', priceRange: '2.500 ₺ - 6.500 ₺' },
      { name: 'Kanal Tedavisi & Dolgu', duration: '45 dk', priceRange: '3.000 ₺ - 5.500 ₺' },
    ],
    defaultFaqs: [
      { q: 'Hafta sonu açık mısınız?', a: 'Cumartesi günleri 09:30 - 18:00 arası hasta kabulümüz vardır.' },
      { q: 'Kredi kartına taksit yapılıyor mu?', a: 'Tüm anlaşmalı kartlara tedavi planına göre taksit imkanı sunulmaktadır.' },
    ],
    painPoints: [
      'Mesai saatleri dışında WhatsApp ve Instagram üzerinden gelen implant/fiyat sorularına geç dönüş yapılması nedeniyle hasta kaybı',
      'Randevu hatırlatması manuel yapıldığı için %22 oranında gelmeyen hasta (no-show) kaybı',
    ],
  },
  beauty: {
    sector: 'beauty',
    label: 'Güzellik & Estetik Merkezi',
    accentColor: '#be185d',
    assistantRole: 'Güzellik & Randevu Danışmanı',
    defaultServices: [
      { name: 'Buz Lazer Epilasyon Seans Paketi', duration: '45 dk', priceRange: 'Kampanyalı 6 Seans Paket' },
      { name: 'Hydrafacial Medikal Cilt Bakımı', duration: '60 dk', priceRange: '1.800 ₺ - 2.900 ₺' },
      { name: 'Bölgesel İncelme & G5 Masajı', duration: '50 dk', priceRange: 'Ücretsiz Ön Analiz + Paket' },
      { name: 'Kalıcı Makyaj & İpek Kirpik', duration: '90 dk', priceRange: '1.500 ₺ - 3.800 ₺' },
    ],
    defaultFaqs: [
      { q: 'Ön cilt analizi ücretli mi?', a: 'Uzman estetisyenimizle yapılan ilk cilt ve kıl kökü analizi tamamen ücretsizdir.' },
      { q: 'Seans erteleme nasıl yapılır?', a: 'Randevunuzdan 24 saat öncesine kadar WhatsApp üzerinden tek mesajla tarih değiştirebilirsiniz.' },
    ],
    painPoints: [
      'Instagram reklamlarından gece gelen kampanya/fiyat mesajlarına sabah dönüldüğünde müşterinin başka merkeze gitmesi',
      'Paket seans takibi ve randevu teyitlerinin sekreterin vaktinin %60’ını alması',
    ],
  },
  realestate: {
    sector: 'realestate',
    label: 'Emlak & Gayrimenkul Ofisi',
    accentColor: '#1d4ed8',
    assistantRole: '7/24 Portföy & Yatırım Asistanı',
    defaultServices: [
      { name: 'Satılık Konut & Villa Gösterim Randevusu', duration: '45 dk', priceRange: 'Portföye Özel Sunum' },
      { name: 'Ücretsiz Ekspertiz & Değerleme Talebi', duration: '30 dk', priceRange: 'Ücretsiz Bölge Analizi' },
      { name: 'Ticari Gayrimenkul & Dükkan Kiralama', duration: '45 dk', priceRange: 'Kurumsal Portföy' },
      { name: 'Kredi & Tapu Süreç Danışmanlığı', duration: '30 dk', priceRange: 'Hizmete Dahil' },
    ],
    defaultFaqs: [
      { q: 'İlanlardaki daireleri hafta sonu görebilir miyiz?', a: 'Evet, danışmanlarımız Cumartesi ve Pazar günleri randevulu yer gösterimi yapmaktadır.' },
      { q: 'Mülkümü satmak istiyorum, değerleme yapıyor musunuz?', a: 'Bölge emsal verileriyle 24 saat içinde ücretsiz değerleme raporu hazırlıyoruz.' },
    ],
    painPoints: [
      'Sahada yer gösterimindeyken kaçan telefonların ve ilan sorularının sıcak alıcı kaybına yol açması',
      'Alıcı bütçe ve oda kriterlerinin ön elemeden geçmeden danışmanların vaktini tüketmesi',
    ],
  },
  restaurant: {
    sector: 'restaurant',
    label: 'Restoran & Özel Davet Mekanı',
    accentColor: '#b45309',
    assistantRole: 'Masa Rezervasyon & Grup Etkinlik Asistanı',
    defaultServices: [
      { name: 'Akşam Yemeği Masa Rezervasyonu', duration: '120 dk', priceRange: 'Alakart Menü' },
      { name: 'Doğum Günü & Kutlama Masası Organizasyonu', duration: '180 dk', priceRange: 'Kişi Başı Fix Menü Seçenekli' },
      { name: 'Kurumsal İş Yemeği & Grup Rezervasyonu', duration: '150 dk', priceRange: '10-60 Kişilik Özel Salon' },
      { name: 'Hafta Sonu Serpme Kahvaltı Rezervasyonu', duration: '120 dk', priceRange: 'Kişi Başı 650 ₺' },
    ],
    defaultFaqs: [
      { q: 'Otopark ve vale hizmetiniz var mı?', a: 'Mekanımızın girişinde vale ve misafir otopark alanımız mevcuttur.' },
      { q: 'Grup yemekleri için özel menü hazırlanıyor mu?', a: '8 kişi ve üzeri gruplar için özel fix menü alternatiflerimiz bulunmaktadır.' },
    ],
    painPoints: [
      'Cuma-Cumartesi yoğun servis saatlerinde telefonların meşgul çalması sebebiyle grup rezervasyonlarının kaçması',
      'Teyit edilmeyen rezervasyonlar yüzünden en yoğun akşamda masaların boş kalması',
    ],
  },
  office: {
    sector: 'office',
    label: 'Hukuk & Mali Müşavirlik Ofisi',
    accentColor: '#334155',
    assistantRole: 'Kurumsal Ön Görüşme & Müvekkil Asistanı',
    defaultServices: [
      { name: 'Şirket Kuruluşu & Vergi Danışmanlığı Ön Görüşme', duration: '30 dk', priceRange: 'Online / Yüz Yüze Randevu' },
      { name: 'İş & Ticaret Hukuku Dosya Ön Değerlendirme', duration: '45 dk', priceRange: 'Danışmanlık Tarifesi' },
      { name: 'E-Fatura & Aylık Mali Müşavirlik Paketi', duration: '30 dk', priceRange: 'İşletme Ölçeğine Göre Teklif' },
      { name: 'KVKK & Sözleşme İnceleme Randevusu', duration: '45 dk', priceRange: 'Kurumsal Paket' },
    ],
    defaultFaqs: [
      { q: 'Online (Zoom/Meet) görüşme yapabiliyor muyuz?', a: 'Evet, şehir içi ve şehir dışı tüm danışanlarımızla online görüntülü toplantı planlayabiliyoruz.' },
      { q: 'Görüşme öncesi belge gönderebilir miyim?', a: 'Randevunuz onaylandığında güvenli belge paylaşım bağlantısı tarafınıza iletilmektedir.' },
    ],
    painPoints: [
      'Duruşma veya beyanname dönemlerinde yeni potansiyel müvekkil/mükellef aramalarına geç dönüş yapılması',
      'Tekrarlayan evrak ve randevu sorularının uzman ekibin odak süresini bölmesi',
    ],
  },
};

export function ensureSeeded(): { seededNow: boolean } {
  const db = getDb();
  const existingAgents = db.select().from(agents).all();
  if (existingAgents.length > 0) {
    return { seededNow: false };
  }

  const now = new Date().toISOString();

  const initialAgents = [
    {
      id: 'coo',
      codename: 'Atlas',
      title: 'Genel Müdür & Vardiya Orkestratörü (COO)',
      department: 'Yönetim & Koordinasyon',
      modelId: 'gemini-4-carbon',
      thinkingLevel: 'high',
      dailyBudgetUsd: 1.0,
      prompt:
        'Sen VMS Otonom Yazılım Ajansının COO’su Atlas’sın. Günlük 4 vardiyayı koordine eder, Türkiye KOBİ pazarında en hızlı gelire dönüşecek görevleri önceliklendirir ve CEO’ya net, rakam odaklı özetler sunarsın.',
      winning: ['Yüksek lead puanlı (80+) KOBİ’lere öncelik ver', 'Her ikindi vardiyasında canlı demo linkiyle somut onay paketi çıkar'],
    },
    {
      id: 'researcher',
      codename: 'Pusula',
      title: 'Türkiye KOBİ Pazar & Fırsat Araştırmacısı',
      department: 'Strateji & Araştırma',
      modelId: 'gemini-4-hydrogen',
      thinkingLevel: 'high',
      dailyBudgetUsd: 0.5,
      prompt:
        'Sen Pusula’sın. Türkiye’deki diş klinikleri, güzellik merkezleri, emlak ofisleri, restoranlar ve danışmanlık ofislerinin müşteri kaçırdığı dijital darboğazları tespit eder, somut rakamlarla fırsat raporu üretirsin.',
      winning: ['Mesai dışı WhatsApp yanıt gecikmesi olan sektörlere odaklan', 'Randevu iptali (no-show) maliyeti yüksek hizmetleri puanla'],
    },
    {
      id: 'pm',
      codename: 'Mimar',
      title: 'Ürün & Fiyatlandırma Mimarı (PM)',
      department: 'Ürün Yönetimi',
      modelId: 'gemini-4-neon',
      thinkingLevel: 'high',
      dailyBudgetUsd: 0.6,
      prompt:
        'Sen Mimar’sın. Pusula’nın bulduğu KOBİ acı noktalarını net TL abonelik paketlerine, ikna edici Türkçe değer önerilerine ve kolay kurulumlu SaaS özelliklerine dönüştürürsün.',
      winning: ['14 gün ücretsiz deneme + kredi kartsız canlı demo kancası kullan', 'Kurumsal çok şubeli işletmeler için B2B özel kurulum upsell paketi sun'],
    },
    {
      id: 'builder',
      codename: 'Demir',
      title: 'Baş Yazılımcı & QA Uzmanı',
      department: 'Mühendislik & Kalite',
      modelId: 'gemini-4-carbon',
      thinkingLevel: 'high',
      dailyBudgetUsd: 1.0,
      prompt:
        'Sen Demir’sin. SaaS ürün şablonlarını ve KOBİ canlı demo modüllerini hatasız yapılandırır, kalite kontrollerini yürütür ve ağır özellik taleplerini Antigravity için yapılandırılmış teknik iş emirlerine (BuildSpec) dönüştürürsün.',
      winning: ['Her sektörel demoda gerçekçi hizmet/fiyat ve anında çalışan randevu tablosu bulundur', 'Sıfır kırık bağlantı ve hızlı açılış garantisi sağla'],
    },
    {
      id: 'growth',
      codename: 'Yankı',
      title: 'Büyüme, SEO & İçerik Uzmanı',
      department: 'Pazarlama & Inbound',
      modelId: 'gemini-4-hydrogen',
      thinkingLevel: 'medium',
      dailyBudgetUsd: 0.5,
      prompt:
        'Sen Yankı’sın. Türkiye’deki işletme sahiplerinin Google’da aradığı somut sorunlara yönelik yüksek dönüşümlü Türkçe SEO rehberleri ve Instagram/LinkedIn vaka içerikleri üretirsin.',
      winning: ['Başlıklarda somut yüzde ve sektörel kazanç belirt', 'Her yazının sonuna canlı demo deneme çağrısı ekle'],
    },
    {
      id: 'sales',
      codename: 'Avcı',
      title: 'Satış, Lead Avcısı & Canlı Demo Uzmanı',
      department: 'Satış & Outbound',
      modelId: 'gemini-4-hydrogen',
      thinkingLevel: 'high',
      dailyBudgetUsd: 0.7,
      prompt:
        'Sen Avcı’sın. Hedef KOBİ’leri puanlar, her işletmenin kendi adıyla çalışan özel /demo/[slug] sayfasını hazırlar ve spam kokmayan, doğrudan işletmeye özel hazırlanan demoyu gösteren A/B varyantlı Türkçe WhatsApp ve e-posta mesajları yazarsın.',
      winning: ['Mesajın ilk cümlesinde işletmenin kendi adını ve hazır canlı demo linkini geçir', 'Kısa, saygılı ve 30 saniyede test edilebilir davet dili kullan'],
    },
    {
      id: 'kaizen',
      codename: 'Bilge',
      title: 'Öz-Gelişim & Performans Koçu (Kaizen)',
      department: 'Kaizen & Stratejik Evrim',
      modelId: 'gemini-4-carbon',
      thinkingLevel: 'high',
      dailyBudgetUsd: 0.7,
      prompt:
        'Sen Bilge’sin. Her gece demo açılma, AI sohbet deneme, ödeme tıklama ve A/B mesaj dönüşümlerini analiz eder; başarısız kalıpları eleyip kazanan stratejileri ajanların yeni Playbook sürümüne (v+1) işlersin.',
      winning: ['Veriye dayanmayan varsayımları ele, en çok demo sohbeti başlatan kancayı standartlaştır', 'Müşteri taleplerinden haftalık Antigravity ürün geliştirme iş emri çıkar'],
    },
  ];

  for (const ag of initialAgents) {
    db.insert(agents)
      .values({
        id: ag.id,
        codename: ag.codename,
        title: ag.title,
        department: ag.department,
        modelId: ag.modelId,
        thinkingLevel: ag.thinkingLevel,
        dailyBudgetUsd: ag.dailyBudgetUsd,
        playbookVersion: 1,
        status: 'idle',
        tasksCompleted: 0,
        lastActiveAt: now,
      })
      .run();

    db.insert(agentPlaybooks)
      .values({
        agentId: ag.id,
        version: 1,
        systemPrompt: ag.prompt,
        winningPatternsJson: JSON.stringify(ag.winning),
        avoidPatternsJson: JSON.stringify(['Genel geçer kurumsal klişe ifadeler', 'Canlı demo linki içermeyen soğuk mesajlar']),
        kaizenReason: 'Kuruluş v1 temel uzmanlık kılavuzu',
        createdAt: now,
      })
      .run();
  }

  const policies = [
    {
      gateKey: 'OUTBOUND_MESSAGE',
      label: 'Müşteriye Dış Mesaj Gönderimi (WhatsApp / E-Posta)',
      description: 'Satış ajanının hazırladığı canlı demo davetlerinin gerçek işletmelere iletilmesi.',
      mode: 'REQUIRE_APPROVAL',
      dailyCap: 30,
    },
    {
      gateKey: 'PRODUCTION_RELEASE',
      label: 'Yeni Ürün & Özellik Canlı Yayını',
      description: 'Yeni geliştirilen SaaS şablonlarının ve vitrin güncellemelerinin dış dünyaya açılması.',
      mode: 'REQUIRE_APPROVAL',
      dailyCap: 5,
    },
    {
      gateKey: 'PRICING_UPDATE',
      label: 'Paket Fiyatlandırma & Kampanya Değişikliği',
      description: 'Ürünlerin TL abonelik ücretlerinde veya indirim oranlarında A/B değişikliği yapılması.',
      mode: 'REQUIRE_APPROVAL',
      dailyCap: 2,
    },
    {
      gateKey: 'BUDGET_SPEND',
      label: 'Ücretli Reklam / Harici Bütçe Kullanımı',
      description: 'Herhangi bir finansal harcama veya ücretli servis tetiklemesi.',
      mode: 'REQUIRE_APPROVAL',
      dailyCap: 1,
    },
  ];

  for (const pol of policies) {
    db.insert(autonomyPolicies)
      .values({
        ...pol,
        updatedAt: now,
      })
      .run();
  }

  db.insert(products)
    .values({
      slug: 'kobi-asistan-pro',
      name: 'KOBİ Asistan Pro',
      tagline: 'Klinik, Emlak, Güzellik ve Hizmet İşletmeleri İçin 7/24 WhatsApp AI Karşılama & Akıllı Randevu Sistemi',
      targetSectorsJson: JSON.stringify(['dental', 'beauty', 'realestate', 'restaurant', 'office']),
      starterPriceTry: 1490,
      proPriceTry: 2990,
      enterpriseSetupTry: 14900,
      featuresJson: JSON.stringify([
        '7/24 Doğal Türkçe WhatsApp & Instagram Karşılama Asistanı',
        'Sektöre Özel Hizmet/Fiyat Bilgilendirme ve Ön Eleme',
        'Otomatik Randevu Oluşturma ve SMS/WhatsApp Hatırlatma (No-Show Önleyici)',
        'Tek Ekranda Müşteri & Randevu Takip Paneli (Mini-CRM)',
        'Google Haritalar Yorum İsteği Otomasyonu',
      ]),
      status: 'live',
      mrrTry: 0,
      activeCustomers: 0,
      createdAt: now,
    })
    .run();

  const sampleLeads = [
    {
      businessName: 'Özel DentModa Ağız ve Diş Sağlığı Polikliniği',
      slug: 'ozel-dentmoda-kadikoy',
      sector: 'dental' as const,
      city: 'İstanbul',
      district: 'Kadıköy',
      phone: '+905320001001',
      email: 'iletisim@dentmoda-ornek.com',
      instagramHandle: '@dentmodakadikoy',
      painPoint: SECTOR_TEMPLATES.dental.painPoints[0],
      leadScore: 92,
      stage: 'DEMO_READY',
    },
    {
      businessName: ' AuraPlus Lazer & Medikal Estetik Merkezi',
      slug: 'auraplus-estetik-nilufer',
      sector: 'beauty' as const,
      city: 'Bursa',
      district: 'Nilüfer',
      phone: '+905320001002',
      email: 'info@auraplus-ornek.com',
      instagramHandle: '@auraplusnilufer',
      painPoint: SECTOR_TEMPLATES.beauty.painPoints[0],
      leadScore: 88,
      stage: 'DEMO_READY',
    },
    {
      businessName: 'Başkent Prestij Gayrimenkul & Yatırım',
      slug: 'baskent-prestij-cankaya',
      sector: 'realestate' as const,
      city: 'Ankara',
      district: 'Çankaya',
      phone: '+905320001003',
      email: 'portfoy@baskentprestij-ornek.com',
      instagramHandle: '@baskentprestijemlak',
      painPoint: SECTOR_TEMPLATES.realestate.painPoints[0],
      leadScore: 85,
      stage: 'DEMO_READY',
    },
  ];

  for (const item of sampleLeads) {
    const cleanName = item.businessName.trim();
    const res = db
      .insert(leads)
      .values({
        ...item,
        businessName: cleanName,
        createdAt: now,
      })
      .run();
    const leadId = Number(res.lastInsertRowid);
    const tpl = SECTOR_TEMPLATES[item.sector];

    db.insert(customDemos)
      .values({
        leadId,
        productSlug: 'kobi-asistan-pro',
        slug: item.slug,
        headline: `${cleanName} — 7/24 Akıllı WhatsApp & Randevu Asistanı`,
        subheadline: `${item.city} / ${item.district} şubeniz için mesai saatleri dışında bile müşteri sorularını yanıtlayan ve otomatik randevu alan canlı önizleme.`,
        sector: item.sector,
        city: `${item.city} / ${item.district}`,
        accentColor: tpl.accentColor,
        assistantName: `Selin (${cleanName} ${tpl.assistantRole})`,
        welcomeMessage: `Merhaba! 👋 ${cleanName} dijital hattına hoş geldiniz. Size hizmetlerimiz, güncel fiyat aralıklarımız veya uygun randevu saatlerimiz hakkında hemen yardımcı olabilirim. Hangi işlem için bilgi almak istersiniz?`,
        servicesJson: JSON.stringify(tpl.defaultServices),
        faqJson: JSON.stringify(tpl.defaultFaqs),
        viewsCount: item.sector === 'dental' ? 4 : 2,
        chatsCount: item.sector === 'dental' ? 2 : 1,
        appointmentsBookedCount: item.sector === 'dental' ? 1 : 0,
        checkoutClicksCount: 0,
        lastInteractedAt: now,
        createdAt: now,
      })
      .run();
  }

  db.insert(contentPosts)
    .values({
      slug: 'dis-kliniklerinde-whatsapp-randevu-otomasyonu-rehberi',
      title: 'Diş Kliniklerinde Mesai Dışı Hasta Kaybını %42 Azaltan WhatsApp Otomasyonu Rehberi',
      excerpt:
        'Akşam 19:00 ile sabah 09:00 arasında gelen implant ve muayene sorularına ilk 30 saniyede yanıt vererek randevuya dönüştürmenin pratik yolu.',
      sector: 'dental',
      targetKeyword: 'diş kliniği whatsapp randevu programı',
      bodyMarkdown: `## Mesai Dışı Gelen Hasta Mesajları Neden Kaçıyor?\n\nTürkiye'deki ağız ve diş sağlığı polikliniklerine gelen WhatsApp ve Instagram mesajlarının **%54'ü akşam 18:30'dan sonra** iletilmektedir. Ertesi sabah dönüş yapıldığında hastaların önemli bir kısmı çoktan başka bir klinikten randevu almış olur.\n\n### 3 Adımda Akıllı Karşılama Sistemi\n\n1. **Anında Doğal Türkçe Yanıt:** Hasta fiyat veya işlem sorduğunda 5 saniye içinde kliniğin kendi kurumsal diliyle bilgilendirme yapılır.\n2. **Hekim Takvimine Uygun Ön Randevu:** Uygun gün ve saat dilimi seçilerek hasta adı ve telefonu otomatik kaydedilir.\n3. **Otomatik Randevu Hatırlatma:** Randevudan 24 saat ve 2 saat önce giden teyit mesajıyla gelmeyen hasta (no-show) oranı minimuma iner.\n\nKliniğinizin kendi adıyla çalışan canlı önizlemeyi hemen inceleyerek 14 gün ücretsiz deneyebilirsiniz.`,
      socialHook:
        'Kliniğiniz kapandıktan sonra gelen WhatsApp mesajlarının yarısı sabaha kadar rakibe gidiyor olabilir. 30 saniyede kendi kliniğinizde test edin 👇',
      viewsCount: 18,
      status: 'PUBLISHED',
      createdAt: now,
    })
    .run();

  const defaultSettings: Array<[string, string]> = [
    ['agency_brand_name', 'VMS Yazılım & AI Stüdyosu'],
    ['ceo_whatsapp_phone', ''],
    ['whatsapp_mode', 'qr_bridge'],
    ['payment_provider', 'paytr'],
    ['public_base_url', 'https://abydevprog.github.io/VMS'],
    ['daily_total_budget_usd', '3.00'],
  ];

  for (const [key, value] of defaultSettings) {
    const exists = db.select().from(systemSettings).where(eq(systemSettings.key, key)).get();
    if (!exists) {
      db.insert(systemSettings).values({ key, value, updatedAt: now }).run();
    }
  }

  return { seededNow: true };
}

if (require.main === module) {
  const result = ensureSeeded();
  console.log(result.seededNow ? '✅ VMS başlangıç veritabanı tohumlandı.' : 'ℹ️ VMS veritabanı zaten hazır.');
}
