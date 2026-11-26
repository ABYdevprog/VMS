import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { agents } from '@/db/schema';
import { processCeoWhatsAppCommand } from '@/integrations/whatsapp';

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      agentId: string;
      modelId?: string;
      thinkingLevel?: string;
      dailyBudgetUsd?: number;
    };

    if (!body.agentId) {
      return NextResponse.json({ ok: false, error: 'Ajan ID gerekli' }, { status: 400 });
    }

    const db = getDb();
    const updates: Record<string, unknown> = {};
    if (body.modelId) updates.modelId = body.modelId;
    if (body.thinkingLevel) updates.thinkingLevel = body.thinkingLevel;
    if (typeof body.dailyBudgetUsd === 'number') updates.dailyBudgetUsd = body.dailyBudgetUsd;

    db.update(agents).set(updates).where(eq(agents.id, body.agentId)).run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Ajan güncellenemedi' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { command: string };
    if (!body.command?.trim()) {
      return NextResponse.json({ ok: false, error: 'Komut boş olamaz' }, { status: 400 });
    }
    const reply = await processCeoWhatsAppCommand(body.command, 'cockpit');
    return NextResponse.json({ ok: true, reply });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'COO komutu işlenemedi' },
      { status: 500 }
    );
  }
}
