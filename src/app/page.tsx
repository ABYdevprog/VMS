import { desc } from 'drizzle-orm';
import Link from 'next/link';
import { ArrowRight, Check, MessageCircle, Sparkles } from 'lucide-react';
import { getDb } from '@/db';
import { contentPosts, customDemos, products } from '@/db/schema';
import { ensureSeeded, SECTOR_TEMPLATES } from '@/db/seed';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  ensureSeeded();
  const db = getDb();

  const flagship = db.select().from(products).get();
  const demos = db.select().from(customDemos).orderBy(desc(customDemos.id)).limit(6).all();
  const posts = db.select().from(contentPosts).orderBy(desc(contentPosts.id)).limit(4).all();
  const features: string[] = JSON.parse(flagship?.featuresJson || '[]');

  const primaryDemoSlug = demos[0]?.slug || 'ozel-dentmoda-kadikoy';

  return (
    <div>
      <header className="site-header">
        <div className="shell-container site-header-inner">
          <Link href="/" className="brand-mark">
            <span className="brand-emblem">V</span>
            <span>VMS • KOBİ Asistan Pro</span>
          </Link>

          <nav className="nav-links">
            <a href="#canli-demolar" className="nav-link">
              Sektörel Canlı Demolar
            </a>
            <a href="#fiyatlandirma" className="nav-link">
              Fiyatlandırma
            </a>
            <a href="#rehberler" className="nav-link">
              KOBİ Rehberleri
            </a>
            <Link href="/cockpit" id="open-ceo-cockpit-link" className="btn btn-secondary btn-sm">
              CEO Kokpiti
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="hero-section">
          <div className="shell-container hero-grid">
            <div>
              <span className="eyebrow-label">Türkiye KOBİ & Hizmet İşletmeleri İçin Otonom Çözüm</span>
              <h1 className="hero-title">
                Mesai Dışı Gelen WhatsApp Mesajlarını Saniyeler İçinde Randevuya Dönüştürün
              </h1>
              <p className="hero-lead">
                Diş klinikleri, güzellik merkezleri, emlak ofisleri ve restoranlar için işletmenizin kendi hizmet
                listesiyle konuşan 7/24 Türkçe yapay zeka karşılama ve randevu sistemi.
              </p>
              <div className="hero-actions">
                <Link href={`/demo/${primaryDemoSlug}`} id="hero-try-live-demo-btn" className="btn btn-primary">
                  Canlı WhatsApp Demosunu Test Et <ArrowRight size={16} />
                </Link>
                <a href="#canli-demolar" className="btn btn-secondary">
                  Sektörünüze Özel Önizlemeler
                </a>
              </div>
            </div>

            <div className="surface-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span className="tag tag-emerald">
                  <MessageCircle size={13} /> Neler Kazandırır?
                </span>
                <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                  10 Dk Kurulum
                </span>
              </div>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '14px' }}>
                {flagship?.name || 'KOBİ Asistan Pro'} Temel Yetenekleri
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {features.map((feat, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '0.92rem' }}>
                    <Check size={17} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '3px' }} />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Sector Live Demos */}
        <section className="section-block" id="canli-demolar">
          <div className="shell-container">
            <h2 className="section-heading">Sektörünüze Özel Hazırlanmış Canlı Önizlemeler</h2>
            <p className="section-sub">
              Satış ekibimizin Türkiye’deki gerçek işletme senaryolarına göre yapılandırdığı canlı demoları açıp müşteri
              gibi mesaj yazarak deneyebilirsiniz.
            </p>

            <div className="grid-3">
              {demos.map((d) => {
                const sectorInfo =
                  SECTOR_TEMPLATES[d.sector as keyof typeof SECTOR_TEMPLATES] || SECTOR_TEMPLATES.dental;
                return (
                  <div key={d.id} className="surface-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                        <span className="tag tag-emerald">{sectorInfo.label}</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>{d.city}</span>
                      </div>
                      <h3 style={{ fontSize: '1.12rem', marginBottom: '8px' }}>{d.headline}</h3>
                      <p style={{ fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>{d.subheadline}</p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--line-subtle)' }}>
                      <span className="tabular" style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                        {d.viewsCount} görüntülenme • {d.chatsCount} test sohbeti
                      </span>
                      <Link href={`/demo/${d.slug}`} className="btn btn-secondary btn-sm">
                        Demoyu Aç →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="section-block" id="fiyatlandirma">
          <div className="shell-container">
            <h2 className="section-heading">Şeffaf TL Abonelik Paketleri</h2>
            <p className="section-sub">
              Döviz kuru sürprizi yok. PayTR, İyzico veya Shopier güvencesiyle 14 gün ücretsiz deneyin.
            </p>

            <div className="grid-3">
              <div className="surface-card">
                <h3 style={{ fontSize: '1.2rem' }}>Başlangıç</h3>
                <div className="tabular" style={{ fontSize: '2rem', fontWeight: 800, margin: '10px 0' }}>
                  {(flagship?.starterPriceTry ?? 1490).toLocaleString('tr-TR')} ₺{' '}
                  <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--ink-muted)' }}>/ ay</span>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--ink-secondary)', marginBottom: '16px' }}>
                  Butik klinikler, kuaför/güzellik stüdyoları ve bireysel danışmanlar için 7/24 WhatsApp karşılama.
                </p>
                <Link href={`/demo/${primaryDemoSlug}#paketler`} className="btn btn-secondary" style={{ width: '100%' }}>
                  Ücretsiz Denemeyi Başlat
                </Link>
              </div>

              <div className="surface-card" style={{ borderColor: 'var(--accent-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <h3 style={{ fontSize: '1.2rem' }}>Profesyonel</h3>
                  <span className="tag tag-emerald">Önerilen</span>
                </div>
                <div className="tabular" style={{ fontSize: '2rem', fontWeight: 800, margin: '10px 0' }}>
                  {(flagship?.proPriceTry ?? 2990).toLocaleString('tr-TR')} ₺{' '}
                  <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--ink-muted)' }}>/ ay</span>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--ink-secondary)', marginBottom: '16px' }}>
                  Sınırsız WhatsApp + Instagram DM, otomatik randevu hatırlatma ve Google yorum büyütme paketi.
                </p>
                <Link href={`/demo/${primaryDemoSlug}#paketler`} className="btn btn-primary" style={{ width: '100%' }}>
                  14 Gün Ücretsiz Başla
                </Link>
              </div>

              <div className="surface-card">
                <h3 style={{ fontSize: '1.2rem' }}>Kurumsal Özel Kurulum</h3>
                <div className="tabular" style={{ fontSize: '2rem', fontWeight: 800, margin: '10px 0' }}>
                  {(flagship?.enterpriseSetupTry ?? 14900).toLocaleString('tr-TR')} ₺{' '}
                  <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--ink-muted)' }}>kurulum</span>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--ink-secondary)', marginBottom: '16px' }}>
                  Çok şubeli poliklinikler, zincir işletmeler ve gayrimenkul ofisleri için özel CRM/ERP entegrasyonu.
                </p>
                <Link href={`/demo/${primaryDemoSlug}#paketler`} className="btn btn-secondary" style={{ width: '100%' }}>
                  Kurumsal Görüşme Planla
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Autonomous SEO Content Hub */}
        <section className="section-block" id="rehberler" style={{ borderBottom: 'none' }}>
          <div className="shell-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 className="section-heading" style={{ marginBottom: '6px' }}>
                  KOBİ Dijital Dönüşüm & Otomasyon Rehberleri
                </h2>
                <p style={{ color: 'var(--ink-secondary)' }}>
                  Büyüme ekibimizin sektörel verilerle düzenli yayınladığı uygulama rehberleri.
                </p>
              </div>
              <span className="tag tag-neutral">
                <Sparkles size={13} /> Günlük Güncellenir
              </span>
            </div>

            <div className="grid-2">
              {posts.map((post) => (
                <Link key={post.id} href={`/blog/${post.slug}`} className="surface-card" style={{ display: 'block' }}>
                  <span className="tag tag-neutral" style={{ marginBottom: '10px' }}>
                    {post.targetKeyword}
                  </span>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>{post.title}</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--ink-secondary)', marginBottom: '12px' }}>
                    {post.excerpt}
                  </p>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                    Rehberi Oku →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer style={{ borderTop: '1px solid var(--line-subtle)', padding: '28px 0', color: 'var(--ink-muted)', fontSize: '0.85rem' }}>
        <div className="shell-container" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <span>© 2026 VMS Yazılım & AI Stüdyosu — Türkiye KOBİ Otonom Ürün Fabrikası</span>
          <Link href="/cockpit" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
            Kurucu / CEO Yönetim Kokpiti →
          </Link>
        </div>
      </footer>
    </div>
  );
}
