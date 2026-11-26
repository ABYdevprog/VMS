import { desc } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/db';
import {
  agentPlaybooks,
  agents,
  agentTasks,
  approvalQueue,
  autonomyPolicies,
  contentPosts,
  customDemos,
  kaizenLogs,
  leads,
  orders,
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

export function exportPublicPages(): void {
  ensureSeeded();
  const db = getDb();

  const agentsAll = db.select().from(agents).all();
  const playbooksAll = db.select().from(agentPlaybooks).orderBy(desc(agentPlaybooks.version)).all();
  const shiftsAll = db.select().from(shiftRuns).orderBy(desc(shiftRuns.id)).limit(20).all();
  const tasksAll = db.select().from(agentTasks).orderBy(desc(agentTasks.id)).limit(30).all();
  const policiesAll = db.select().from(autonomyPolicies).all();
  const approvalsAll = db.select().from(approvalQueue).orderBy(desc(approvalQueue.id)).limit(30).all();
  const outreachAll = db.select().from(outreachMessages).all();
  const leadsAll = db.select().from(leads).orderBy(desc(leads.id)).all();
  const demosAll = db.select().from(customDemos).orderBy(desc(customDemos.id)).all();
  const productsAll = db.select().from(products).all();
  const ordersAll = db.select().from(orders).orderBy(desc(orders.id)).all();
  const kaizenAll = db.select().from(kaizenLogs).orderBy(desc(kaizenLogs.id)).limit(12).all();
  const postsAll = db.select().from(contentPosts).orderBy(desc(contentPosts.id)).all();

  // Save clean secret-free snapshot so GitHub Actions cron builds cumulatively every day
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
  const primaryDemoSlug = demosAll[0]?.slug || 'ozel-dentmoda-kadikoy';

  // 1. Export Storefront Landing Page (index.html)
  const storefrontHtml = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>KOBİ Asistan Pro | VMS Otonom Yazılım & AI Stüdyosu</title>
  <link rel="stylesheet" href="${BASE_PATH}/styles.css" />
</head>
<body>
  <header class="site-header">
    <div class="shell-container site-header-inner">
      <a href="${BASE_PATH}/" class="brand-mark">
        <span class="brand-emblem">V</span>
        <span>VMS • KOBİ Asistan Pro</span>
      </a>
      <nav class="nav-links">
        <a href="#canli-demolar" class="nav-link">Sektörel Canlı Demolar (${demosAll.length})</a>
        <a href="#fiyatlandirma" class="nav-link">Fiyatlandırma</a>
        <a href="#rehberler" class="nav-link">KOBİ Rehberleri (${postsAll.length})</a>
        <a href="${BASE_PATH}/cockpit/" class="btn btn-primary btn-sm">CEO Kontrol Kokpiti →</a>
      </nav>
    </div>
  </header>

  <main>
    <section class="hero-section">
      <div class="shell-container hero-grid">
        <div>
          <span class="eyebrow-label">Türkiye KOBİ & Hizmet İşletmeleri İçin Otonom Çözüm</span>
          <h1 class="hero-title">Mesai Dışı Gelen WhatsApp Mesajlarını Saniyeler İçinde Randevuya Dönüştürün</h1>
          <p class="hero-lead">Diş klinikleri, güzellik merkezleri, emlak ofisleri ve restoranlar için işletmenizin kendi hizmet listesiyle konuşan 7/24 Türkçe yapay zeka karşılama ve randevu sistemi.</p>
          <div class="hero-actions">
            <a href="${BASE_PATH}/demo/${primaryDemoSlug}/" class="btn btn-primary">Canlı WhatsApp Demosunu Test Et →</a>
            <a href="${BASE_PATH}/cockpit/" class="btn btn-secondary">CEO Yönetim Kokpitini Aç</a>
          </div>
        </div>
        <div class="surface-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <span class="tag tag-emerald">Neler Kazandırır?</span>
            <span class="mono" style="font-size:0.78rem;color:var(--ink-muted);">10 Dk Kurulum</span>
          </div>
          <h2 style="font-size:1.22rem;margin-bottom:14px;">${escapeHtml(flagship?.name || 'KOBİ Asistan Pro')} Temel Yetenekleri</h2>
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${features.map((f) => `<div style="font-size:0.92rem;">✓ ${escapeHtml(f)}</div>`).join('')}
          </div>
        </div>
      </div>
    </section>

    <section class="section-block" id="canli-demolar">
      <div class="shell-container">
        <h2 class="section-heading">Sektörünüze Özel Hazırlanmış Canlı Önizlemeler (${demosAll.length} İşletme)</h2>
        <p class="section-sub">7 uzman ajanımızın Türkiye’deki işletmeler için otomatik ürettiği canlı demoları açıp müşteri gibi mesaj yazarak test edebilirsiniz.</p>
        <div class="grid-3">
          ${demosAll
            .map((d) => {
              const sec = SECTOR_TEMPLATES[d.sector as keyof typeof SECTOR_TEMPLATES] || SECTOR_TEMPLATES.dental;
              return `<div class="surface-card" style="display:flex;flex-direction:column;justify-content:space-between;gap:16px;">
                <div>
                  <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:10px;">
                    <span class="tag tag-emerald">${escapeHtml(sec.label)}</span>
                    <span style="font-size:0.78rem;color:var(--ink-muted);">${escapeHtml(d.city)}</span>
                  </div>
                  <h3 style="font-size:1.1rem;margin-bottom:8px;">${escapeHtml(d.headline)}</h3>
                  <p style="font-size:0.88rem;color:var(--ink-secondary);">${escapeHtml(d.subheadline)}</p>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid var(--line-subtle);">
                  <span class="tabular" style="font-size:0.78rem;color:var(--ink-muted);">${d.viewsCount} açılış • ${d.chatsCount} sohbet</span>
                  <a href="${BASE_PATH}/demo/${d.slug}/" class="btn btn-secondary btn-sm">Demoyu Aç →</a>
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
        <p class="section-sub">Döviz kuru sürprizi yok. PayTR, İyzico veya Shopier güvencesiyle 14 gün ücretsiz deneyin.</p>
        <div class="grid-3">
          <div class="surface-card">
            <h3>Başlangıç</h3>
            <div class="tabular" style="font-size:2rem;font-weight:800;margin:10px 0;">${(flagship?.starterPriceTry ?? 1490).toLocaleString('tr-TR')} ₺ <span style="font-size:0.88rem;font-weight:500;color:var(--ink-muted);">/ ay</span></div>
            <p style="font-size:0.9rem;color:var(--ink-secondary);margin-bottom:16px;">Tek şube işletmeler için 7/24 WhatsApp karşılama ve aylık 300 otomatik randevu.</p>
            <a href="${BASE_PATH}/demo/${primaryDemoSlug}/#paketler" class="btn btn-secondary" style="width:100%;">Ücretsiz Denemeyi Başlat</a>
          </div>
          <div class="surface-card" style="border-color:var(--accent-primary);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><h3>Profesyonel</h3><span class="tag tag-emerald">Önerilen</span></div>
            <div class="tabular" style="font-size:2rem;font-weight:800;margin:10px 0;">${(flagship?.proPriceTry ?? 2990).toLocaleString('tr-TR')} ₺ <span style="font-size:0.88rem;font-weight:500;color:var(--ink-muted);">/ ay</span></div>
            <p style="font-size:0.9rem;color:var(--ink-secondary);margin-bottom:16px;">Sınırsız WhatsApp + Instagram DM, randevu hatırlatma ve Google yorum büyütme paketi.</p>
            <a href="${BASE_PATH}/demo/${primaryDemoSlug}/#paketler" class="btn btn-primary" style="width:100%;">14 Gün Ücretsiz Başla</a>
          </div>
          <div class="surface-card">
            <h3>Kurumsal Özel Kurulum</h3>
            <div class="tabular" style="font-size:2rem;font-weight:800;margin:10px 0;">${(flagship?.enterpriseSetupTry ?? 14900).toLocaleString('tr-TR')} ₺ <span style="font-size:0.88rem;font-weight:500;color:var(--ink-muted);">kurulum</span></div>
            <p style="font-size:0.9rem;color:var(--ink-secondary);margin-bottom:16px;">Çok şubeli poliklinikler ve kurumsal ofisler için özel CRM/ERP entegrasyonu.</p>
            <a href="${BASE_PATH}/demo/${primaryDemoSlug}/#paketler" class="btn btn-secondary" style="width:100%;">Kurumsal Teklif İste</a>
          </div>
        </div>
      </div>
    </section>

    <section class="section-block" id="rehberler" style="border-bottom:none;">
      <div class="shell-container">
        <h2 class="section-heading">Otonom KOBİ Dijital Dönüşüm Rehberleri</h2>
        <p class="section-sub">Yankı (Büyüme Ajanı) tarafından her gün üretilen sektörel uygulama rehberleri.</p>
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
</body>
</html>`;
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), storefrontHtml, 'utf-8');

  // 2. Export Individual Personalized Live Demo Pages (/demo/<slug>/index.html)
  for (const demo of demosAll) {
    const demoDir = path.join(OUT_DIR, 'demo', demo.slug);
    fs.mkdirSync(demoDir, { recursive: true });
    const services = JSON.parse(demo.servicesJson || '[]') as Array<{ name: string; duration: string; priceRange: string }>;
    const faqs = JSON.parse(demo.faqJson || '[]') as Array<{ q: string; a: string }>;
    const lead = leadsAll.find((l) => l.id === demo.leadId);
    const bizName = lead?.businessName || demo.headline.split('—')[0].trim();

    const demoHtml = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(demo.headline)}</title>
  <link rel="stylesheet" href="${BASE_PATH}/styles.css" />
</head>
<body>
  <header class="site-header">
    <div class="shell-container site-header-inner">
      <a href="${BASE_PATH}/" class="brand-mark"><span class="brand-emblem">K</span><span>KOBİ Asistan Pro</span></a>
      <nav class="nav-links">
        <a href="#paketler" class="nav-link">Paketler & Fiyatlar</a>
        <a href="${BASE_PATH}/" class="btn btn-secondary btn-sm">Tüm Demolar</a>
      </nav>
    </div>
  </header>

  <main>
    <section class="hero-section" style="padding-top:34px;padding-bottom:34px;">
      <div class="shell-container">
        <span class="eyebrow-label" style="color:${escapeHtml(demo.accentColor)};">${escapeHtml(demo.city)} • İşletmenize Özel Canlı Simülasyon</span>
        <h1 class="hero-title" style="font-size:clamp(1.65rem,3vw,2.4rem);margin-bottom:12px;">${escapeHtml(demo.headline)}</h1>
        <p class="hero-lead" style="margin-bottom:0;">${escapeHtml(demo.subheadline)} Aşağıdaki WhatsApp penceresine <strong>kendi müşterinizmiş gibi</strong> yazarak asistanın yanıt hızını ve sağdaki tabloya otomatik randevu düşürmesini canlı test edin.</p>
      </div>
    </section>

    <section class="section-block">
      <div class="shell-container">
        <div class="grid-2" style="align-items:start;">
          <div class="wa-frame">
            <div class="wa-top" style="background:${escapeHtml(demo.accentColor)};">
              <div>
                <div style="font-weight:700;font-size:0.95rem;">${escapeHtml(demo.assistantName)}</div>
                <div style="font-size:0.77rem;opacity:0.9;">Çevrimiçi • Ortalama yanıt süresi: 3 saniye</div>
              </div>
            </div>
            <div class="wa-messages" id="waMessages">
              <div class="wa-bubble wa-bubble-bot">${escapeHtml(demo.welcomeMessage)}</div>
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
                    <tr><td style="font-weight:600;">Ayşe Yılmaz</td><td>${escapeHtml(services[0]?.name || 'Ön Görüşme')}</td><td>Bugün 16:30</td><td><span class="tag tag-neutral">Teyitli</span></td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="surface-card">
              <h3 style="font-size:1rem;margin-bottom:10px;">${escapeHtml(bizName)} Tanımlı Hizmet Bilgileri</h3>
              <div style="display:flex;flex-direction:column;gap:8px;">
                ${services
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
        <h2 class="section-heading">14 Gün Ücretsiz Deneme ile Bugün Aktif Edin</h2>
        <p class="section-sub">Kurulum ücreti olmadan kendi WhatsApp hattınıza 10 dakikada bağlayın.</p>
        <div class="grid-3">
          <div class="surface-card">
            <h3>Başlangıç Paketi</h3>
            <div class="tabular" style="font-size:1.85rem;font-weight:800;margin:10px 0;">1.490 ₺ <span style="font-size:0.88rem;font-weight:500;color:var(--ink-muted);">/ ay</span></div>
            <p style="font-size:0.88rem;color:var(--ink-secondary);margin-bottom:16px;">7/24 WhatsApp karşılama ve aylık 300 otomatik randevu.</p>
            <button class="btn btn-secondary" style="width:100%;" onclick="activatePlan('Başlangıç (1.490 ₺/ay)')">14 Gün Ücretsiz Başlat</button>
          </div>
          <div class="surface-card" style="border-color:var(--accent-primary);">
            <span class="tag tag-emerald" style="margin-bottom:8px;">En Çok Tercih Edilen</span>
            <h3>Profesyonel Paket</h3>
            <div class="tabular" style="font-size:1.85rem;font-weight:800;margin:10px 0;">2.990 ₺ <span style="font-size:0.88rem;font-weight:500;color:var(--ink-muted);">/ ay</span></div>
            <p style="font-size:0.88rem;color:var(--ink-secondary);margin-bottom:16px;">Sınırsız WhatsApp + Instagram DM, randevu hatırlatma ve yorum otomasyonu.</p>
            <button class="btn btn-primary" style="width:100%;" onclick="activatePlan('Profesyonel (2.990 ₺/ay)')">Profesyonel Paketi Dene</button>
          </div>
          <div class="surface-card">
            <h3>Kurumsal Özel Kurulum</h3>
            <div class="tabular" style="font-size:1.85rem;font-weight:800;margin:10px 0;">14.900 ₺ <span style="font-size:0.88rem;font-weight:500;color:var(--ink-muted);">tek seferlik</span></div>
            <p style="font-size:0.88rem;color:var(--ink-secondary);margin-bottom:16px;">Çok şubeli işletmeler için özel yazılım/CRM entegrasyonu.</p>
            <button class="btn btn-secondary" style="width:100%;" onclick="activatePlan('Kurumsal Özel Kurulum (14.900 ₺)')">Kurumsal Teklif İste</button>
          </div>
        </div>
        <div id="planToast" class="surface-card" style="display:none;margin-top:20px;background:var(--accent-soft);"></div>
      </div>
    </section>
  </main>

  <script>
    const SERVICES = ${JSON.stringify(services)};
    const FAQS = ${JSON.stringify(faqs)};
    const BIZ = ${JSON.stringify(bizName)};

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
      el.innerHTML = '<strong>✓ ' + BIZ + ' — ' + planName + ' seçildi!</strong><p style="margin-top:6px;font-size:0.9rem;">14 gün ücretsiz deneme aktivasyon talebiniz hazırlandı.</p>';
      el.scrollIntoView({ behavior: 'smooth' });
    }
  </script>
</body>
</html>`;
    fs.writeFileSync(path.join(demoDir, 'index.html'), demoHtml, 'utf-8');
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
      <a href="${BASE_PATH}/" class="brand-mark"><span class="brand-emblem">V</span><span>KOBİ Asistan Pro Rehber</span></a>
      <a href="${BASE_PATH}/demo/${primaryDemoSlug}/" class="btn btn-primary btn-sm">Canlı Demoyu Dene</a>
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

  // 4. Export Full CEO Control Cockpit (/cockpit/index.html)
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
  <title>CEO Kontrol Kokpiti | VMS Otonom Yazılım Ajansı</title>
  <link rel="stylesheet" href="${BASE_PATH}/styles.css" />
</head>
<body>
  <header class="site-header">
    <div class="shell-container site-header-inner">
      <div class="brand-mark">
        <span class="brand-emblem">V</span>
        <div>
          <div>VMS CEO Kontrol Kokpiti</div>
          <div style="font-size:0.74rem;font-weight:500;color:var(--ink-muted);">GitHub Actions 7/24 Otomasyon + Antigravity Geliştirme Merkezi</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <a href="https://github.com/ABYdevprog/VMS/actions" target="_blank" class="btn btn-secondary btn-sm">GitHub Vardiya Robotu ↗</a>
        <a href="${BASE_PATH}/" class="btn btn-primary btn-sm">KOBİ Vitrini →</a>
      </div>
    </div>
  </header>

  <main class="shell-container" style="padding-top:26px;padding-bottom:64px;">
    <h1 style="font-size:clamp(1.45rem,2.4vw,1.9rem);margin-bottom:18px;">Otonom Yazılım Ajansı Canlı Yönetim Paneli</h1>

    <div class="kpi-strip" style="margin-bottom:24px;">
      <div class="kpi-box">
        <div class="kpi-label">KOBİ Havuzu & Canlı Demolar</div>
        <div class="kpi-value">${leadsAll.length} / ${demosAll.length}</div>
        <div class="kpi-meta">Her işletmeye özel URL aktif</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Demo Etkileşimi</div>
        <div class="kpi-value">${totalDemoViews} açılış • ${totalDemoChats} sohbet</div>
        <div class="kpi-meta">Kaizen telemetri takibinde</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">CEO Onay Kuyruğu</div>
        <div class="kpi-value">${pendingCount} Bekliyor</div>
        <div class="kpi-meta">WhatsApp tek tık gönderime hazır</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Tamamlanan Vardiyalar</div>
        <div class="kpi-value">${shiftsAll.length} Vardiya</div>
        <div class="kpi-meta">09:00 • 12:30 • 16:00 • 22:00 Otomatik</div>
      </div>
    </div>

    <div class="tab-bar">
      <button class="tab-btn tab-btn-active" id="tbtn-approvals" onclick="showTab('approvals')">Onay Kuyruğu (${approvalsAll.length})</button>
      <button class="tab-btn" id="tbtn-agents" onclick="showTab('agents')">7 Uzman Ajan & Kaizen</button>
      <button class="tab-btn" id="tbtn-crm" onclick="showTab('crm')">KOBİ CRM & Canlı Demolar (${demosAll.length})</button>
      <button class="tab-btn" id="tbtn-shifts" onclick="showTab('shifts')">Vardiya & Görev Kayıtları</button>
    </div>

    <!-- Approvals -->
    <div id="tab-approvals" class="surface-card" style="display:flex;flex-direction:column;gap:12px;">
      <h2 style="font-size:1.15rem;">Satış Ajanının (Avcı) Hazırladığı Canlı Demo Paketleri</h2>
      ${approvalsAll
        .map((item) => {
          const payload = JSON.parse(item.payloadJson || '{}') as { outreachId?: number; leadId?: number; demoSlug?: string };
          const outreach = outreachAll.find((m) => m.id === payload.outreachId);
          const lead = leadsAll.find((l) => l.id === payload.leadId);
          const publicDemoUrl = `https://abydevprog.github.io${BASE_PATH}/demo/${payload.demoSlug || ''}/`;
          const msgBody = (outreach?.body || '').replace(/https?:\/\/[^\s]+/g, publicDemoUrl);
          const waUrl = lead ? buildWaMeUrl(lead.phone, msgBody) : '#';
          return `<div class="subtle-panel">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
              <strong>${escapeHtml(item.code)} • ${escapeHtml(item.title)}</strong>
              <span class="tag ${item.status === 'PENDING' ? 'tag-amber' : 'tag-emerald'}">${escapeHtml(item.status)}</span>
            </div>
            <p style="font-size:0.83rem;color:var(--ink-secondary);margin-bottom:8px;">${escapeHtml(item.summary)}</p>
            <div style="background:var(--bg-surface);border:1px solid var(--line-subtle);border-radius:8px;padding:10px 12px;font-size:0.86rem;margin-bottom:10px;">${escapeHtml(msgBody)}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              ${payload.demoSlug ? `<a href="${BASE_PATH}/demo/${payload.demoSlug}/" class="btn btn-secondary btn-sm">Canlı Demoyu İncele →</a>` : ''}
              <a href="${waUrl}" target="_blank" class="btn btn-primary btn-sm">WhatsApp İle Müşteriye Gönder (wa.me) ↗</a>
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

    <!-- CRM -->
    <div id="tab-crm" class="surface-card" style="display:none;">
      <h2 style="font-size:1.15rem;margin-bottom:12px;">KOBİ Adayları & Kişiselleştirilmiş Canlı Demolar</h2>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>İşletme</th><th>Bölge / Sektör</th><th>Puan</th><th>Aşama</th><th>Canlı Demo Linki</th></tr></thead>
          <tbody>
            ${leadsAll
              .map(
                (l) => `<tr>
                  <td style="font-weight:600;">${escapeHtml(l.businessName)}</td>
                  <td>${escapeHtml(l.city)}/${escapeHtml(l.district)} • <span class="mono">${escapeHtml(l.sector)}</span></td>
                  <td class="tabular"><strong>${l.leadScore}</strong>/100</td>
                  <td><span class="tag tag-neutral">${escapeHtml(l.stage)}</span></td>
                  <td><a href="${BASE_PATH}/demo/${l.slug}/" class="btn btn-secondary btn-sm">Demoyu Aç →</a></td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
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
      ['approvals', 'agents', 'crm', 'shifts'].forEach((t) => {
        const el = document.getElementById('tab-' + t);
        if (el) el.style.display = t === name ? (t === 'crm' ? 'block' : 'flex') : 'none';
        const b = document.getElementById('tbtn-' + t);
        if (b) b.className = 'tab-btn' + (t === name ? ' tab-btn-active' : '');
      });
    }
  </script>
</body>
</html>`;
  fs.writeFileSync(path.join(cockpitDir, 'index.html'), cockpitHtml, 'utf-8');
  console.log(`✅ GitHub Pages statik paketi oluşturuldu: ${demosAll.length} canlı demo, ${postsAll.length} rehber ve CEO Kokpiti hazır.`);
}

if (require.main === module) {
  const mode = process.argv[2];
  if (mode === '--import-then-export') {
    importStateIfDbFresh();
  }
  exportPublicPages();
}
