import { desc } from 'drizzle-orm';
import Link from 'next/link';
import { ArrowRight, Check, MessageCircle, Sparkles } from 'lucide-react';
import { getDb } from '@/db';
import { contentPosts, customDemos, products } from '@/db/schema';
import { ensureSeeded, SECTOR_TEMPLATES } from '@/db/seed';

export const dynamic = 'force-dynamic';

const SHOWCASE_SLUGS = [
  { slug: 'ozel-dentmoda-kadikoy', genericTitle: 'Örnek Diş Polikliniği Simülasyonu', sector: 'dental' as const },
  { slug: 'auraplus-estetik-nilufer', genericTitle: 'Örnek Güzellik & Lazer Merkezi Simülasyonu', sector: 'beauty' as const },
  { slug: 'baskent-prestij-cankaya', genericTitle: 'Örnek Gayrimenkul Ofisi Simülasyonu', sector: 'realestate' as const },
];

export default function HomePage() {
  ensureSeeded();
  const db = getDb();

  const flagship = db.select().from(products).get();
  const demos = db.select().from(customDemos).all();
  const posts = db.select().from(contentPosts).orderBy(desc(contentPosts.id)).limit(4).all();
  const features: string[] = JSON.parse(flagship?.featuresJson || '[]');

  const primaryDemoSlug = demos[0]?.slug || 'ozel-dentmoda-kadikoy';

  return (
    <div>
      <header className="site-header">
        <div className="shell-container site-header-inner">
          <Link href="/" className="brand-mark">
            <span className="brand-emblem">K</span>
            <span>KOBİ Asistan Pro</span>
          </Link>

          <nav className="nav-links">
            <a href="#sektor-ornekleri" className="nav-link">
              Sektör Simülasyonları
            </a>
            <a href="#fiyatlandirma" className="nav-link">
              Paketler & Fiyatlar
            </a>
            <a href="#rehberler" className="nav-link">
              Uygulama Rehberleri
            </a>
            <a href="#fiyatlandirma" className="btn btn-primary btn-sm">
              14 Gün Ücretsiz Deneyin
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="shell-container hero-grid">
            <div>
              <span className="eyebrow-label">Klinik, Güzellik Merkezi, Emlak ve Hizmet İşletmeleri İçin</span>
              <h1 className="hero-title">
                Mesai Dışı Gelen WhatsApp ve Instagram Mesajlarını Saniyeler İçinde Randevuya Dönüştürün
              </h1>
              <p className="hero-lead">
                Mevcut sekreterinizin iş yükünü hafifleten, akşam ve hafta sonu kaçan müşteri sorularını işletmenizin
                kendi fiyat ve hizmet listesiyle 3 saniyede yanıtlayan 7/24 Türkçe yapay zeka asistanı.
              </p>
              <div className="hero-actions">
                <Link href={`/demo/${primaryDemoSlug}`} id="hero-try-live-demo-btn" className="btn btn-primary">
                  Örnek Canlı Simülasyonu Deneyin <ArrowRight size={16} />
                </Link>
                <a href="#sektor-ornekleri" className="btn btn-secondary">
                  Sektör Örneklerini İnceleyin
                </a>
              </div>
            </div>

            <div className="surface-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span className="tag tag-emerald">
                  <MessageCircle size={13} /> Anahtar Teslim Kurulum
                </span>
                <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                  14 Gün Ücretsiz Pilot
                </span>
              </div>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '14px' }}>
                {flagship?.name || 'KOBİ Asistan Pro'} Neler Sağlar?
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

        {/* Generic Sector Showcases ONLY (Never expose real cold-outreach prospects!) */}
        <section className="section-block" id="sektor-ornekleri">
          <div className="shell-container">
            <h2 className="section-heading">Sektörlere Göre Örnek Çalışma Simülasyonları</h2>
            <p className="section-sub">
              Sistemin farklı hizmet sektörlerinde müşteri sorularını nasıl karşıladığını ve takvime nasıl randevu
              işlediğini örnek ekranlarımızda test edebilirsiniz.
            </p>

            <div className="grid-3">
              {SHOWCASE_SLUGS.map((item) => {
                const sectorInfo = SECTOR_TEMPLATES[item.sector];
                return (
                  <div
                    key={item.slug}
                    className="surface-card"
                    style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}
                  >
                    <div>
                      <span className="tag tag-emerald" style={{ marginBottom: '10px' }}>
                        {sectorInfo.label}
                      </span>
                      <h3 style={{ fontSize: '1.12rem', marginBottom: '8px' }}>{item.genericTitle}</h3>
                      <p style={{ fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
                        {sectorInfo.painPoints[0]}.
                      </p>
                    </div>

                    <div style={{ paddingTop: '12px', borderTop: '1px solid var(--line-subtle)' }}>
                      <Link href={`/demo/${item.slug}`} className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
                        Örnek Simülasyonu Test Et →
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
              Kurulumu ekibimiz anahtar teslim yapar. 14 gün kendi hattınızda ücretsiz deneyip randevu artışını görün.
            </p>

            <div className="grid-3">
              <div className="surface-card">
                <h3 style={{ fontSize: '1.2rem' }}>Başlangıç</h3>
                <div className="tabular" style={{ fontSize: '2rem', fontWeight: 800, margin: '10px 0' }}>
                  {(flagship?.starterPriceTry ?? 1490).toLocaleString('tr-TR')} ₺{' '}
                  <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--ink-muted)' }}>/ ay</span>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--ink-secondary)', marginBottom: '16px' }}>
                  Butik klinikler, güzellik stüdyoları ve bireysel danışmanlar için 7/24 WhatsApp karşılama.
                </p>
                <Link href={`/demo/${primaryDemoSlug}#paketler`} className="btn btn-secondary" style={{ width: '100%' }}>
                  14 Gün Ücretsiz Pilot Başlat
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

        <section className="section-block" id="rehberler" style={{ borderBottom: 'none' }}>
          <div className="shell-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 className="section-heading" style={{ marginBottom: '6px' }}>
                  KOBİ Dijital Dönüşüm & Otomasyon Rehberleri
                </h2>
                <p style={{ color: 'var(--ink-secondary)' }}>
                  Sektörel verilerle hazırlanan müşteri karşılama ve randevu yönetimi rehberleri.
                </p>
              </div>
              <span className="tag tag-neutral">
                <Sparkles size={13} /> Güncel Rehberler
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
          <span>© 2026 KOBİ Asistan Pro — 7/24 Akıllı Müşteri Karşılama & Randevu Sistemleri</span>
          <span>KVKK Uyumlu Altyapı • Türkiye Yerel Destek</span>
        </div>
      </footer>
    </div>
  );
}
