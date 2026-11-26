import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import InteractiveKobiDemo from '@/components/demo/InteractiveKobiDemo';
import { getDb } from '@/db';
import { customDemos, leads, products } from '@/db/schema';
import { ensureSeeded } from '@/db/seed';

export const dynamic = 'force-dynamic';

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

  return (
    <div>
      <header className="site-header">
        <div className="shell-container site-header-inner">
          <Link href="/" className="brand-mark">
            <span className="brand-emblem">K</span>
            <span>KOBİ Asistan Pro</span>
          </Link>
          <nav className="nav-links">
            <a href="#demo-whatsapp-simulator" className="nav-link">
              Canlı Simülatör
            </a>
            <a href="#paketler" className="nav-link">
              Paketler & Fiyatlar
            </a>
            <Link href="/" className="btn btn-secondary btn-sm">
              Tüm Sektörler
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <InteractiveKobiDemo
          slug={demo.slug}
          businessName={lead?.businessName || demo.headline.split('—')[0].trim()}
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
