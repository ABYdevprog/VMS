import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/db';
import { contentPosts, customDemos } from '@/db/schema';
import { ensureSeeded } from '@/db/seed';

export const dynamic = 'force-dynamic';

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  ensureSeeded();
  const { slug } = await params;
  const db = getDb();

  const post = db.select().from(contentPosts).where(eq(contentPosts.slug, slug)).get();
  if (!post) {
    notFound();
  }

  db.update(contentPosts)
    .set({ viewsCount: post.viewsCount + 1 })
    .where(eq(contentPosts.id, post.id))
    .run();

  const sampleDemo =
    db.select().from(customDemos).where(eq(customDemos.sector, post.sector)).get() ||
    db.select().from(customDemos).get();

  return (
    <div>
      <header className="site-header">
        <div className="shell-container site-header-inner">
          <Link href="/" className="brand-mark">
            <span className="brand-emblem">V</span>
            <span>KOBİ Asistan Pro Rehber</span>
          </Link>
          <nav className="nav-links">
            <Link href="/" className="nav-link">
              Ana Vitrin
            </Link>
            {sampleDemo && (
              <Link href={`/demo/${sampleDemo.slug}`} className="btn btn-primary btn-sm">
                Canlı Demoyu Dene
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="section-block">
        <article className="shell-container" style={{ maxWidth: '780px' }}>
          <span className="eyebrow-label">Hedef Anahtar Kelime: {post.targetKeyword}</span>
          <h1 className="hero-title" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.4rem)' }}>
            {post.title}
          </h1>
          <p className="hero-lead">{post.excerpt}</p>

          <div className="surface-card" style={{ whiteSpace: 'pre-line', lineHeight: '1.75', fontSize: '1rem' }}>
            {post.bodyMarkdown}
          </div>

          {sampleDemo && (
            <div className="surface-card" style={{ marginTop: '24px', background: 'var(--accent-soft)' }}>
              <h2 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>
                Kendi İşletmenizde Nasıl Çalışacağını 30 Saniyede Görün
              </h2>
              <p style={{ color: 'var(--ink-secondary)', marginBottom: '14px' }}>{post.socialHook}</p>
              <Link href={`/demo/${sampleDemo.slug}`} className="btn btn-primary">
                Canlı WhatsApp AI Demosunu Aç →
              </Link>
            </div>
          )}
        </article>
      </main>
    </div>
  );
}
