import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import InteractiveKobiDemo from '@/components/demo/InteractiveKobiDemo';
import { getDb } from '@/db';
import { customDemos, leads, products } from '@/db/schema';
import { ensureSeeded } from '@/db/seed';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CustomDemoPage({ params }: { params: Promise<{ slug: string }> }) {
  ensureSeeded();
  const { slug } = await params;
  const db = getDb();

  const demo = db.select().from(customDemos).where(eq(customDemos.slug, slug)).get();
  if (!demo) {
    notFound();
  }

  const lead = db.select().from(leads).where(eq(leads.id, demo.leadId)).get();
  const product = db.select().from(products).where(eq(products.slug, demo.productSlug)).get();
  const services = JSON.parse(demo.servicesJson || '[]');
  const businessName = lead?.businessName || demo.headline.split('—')[0].trim();

  return (
    <div>
      <header className="site-header">
        <div className="shell-container site-header-inner">
          <div className="brand-mark">
            <span className="brand-emblem" style={{ background: demo.accentColor }}>
              {businessName.charAt(0).toUpperCase()}
            </span>
            <div>
              <div>{businessName}</div>
              <div style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--ink-muted)' }}>
                İşletmeye Özel Hazırlanan Canlı Sistem Simülasyonu
              </div>
            </div>
          </div>
          <nav className="nav-links">
            <a href="#demo-whatsapp-simulator" className="nav-link">
              Canlı Test Ekranı
            </a>
            <a href="#paketler" className="btn btn-primary btn-sm">
              14 Gün Ücretsiz Pilot Kurulum
            </a>
          </nav>
        </div>
      </header>

      <main>
        <InteractiveKobiDemo
          slug={demo.slug}
          businessName={businessName}
          headline={demo.headline}
          subheadline={demo.subheadline}
          city={demo.city}
          accentColor={demo.accentColor}
          assistantName={demo.assistantName}
          welcomeMessage={demo.welcomeMessage}
          services={services}
          starterPriceTry={product?.starterPriceTry ?? 1490}
          proPriceTry={product?.proPriceTry ?? 2990}
          enterpriseSetupTry={product?.enterpriseSetupTry ?? 14900}
        />
      </main>
    </div>
  );
}
