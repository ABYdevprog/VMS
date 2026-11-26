import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { systemSettings } from '@/db/schema';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { settings: Record<string, string> };
    if (!body.settings || typeof body.settings !== 'object') {
      return NextResponse.json({ ok: false, error: 'Geçersiz ayar verisi' }, { status: 400 });
    }

    const db = getDb();
    const now = new Date().toISOString();

    for (const [key, val] of Object.entries(body.settings)) {
      if (key === 'gemini_api_key' && val.startsWith('••••')) {
        continue;
      }
      const existing = db.select().from(systemSettings).where(eq(systemSettings.key, key)).get();
      if (existing) {
        db.update(systemSettings).set({ value: String(val), updatedAt: now }).where(eq(systemSettings.key, key)).run();
      } else {
        db.insert(systemSettings).values({ key, value: String(val), updatedAt: now }).run();
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Ayarlar kaydedilemedi' },
      { status: 500 }
    );
  }
}
