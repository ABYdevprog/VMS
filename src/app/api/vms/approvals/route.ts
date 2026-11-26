import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { autonomyPolicies } from '@/db/schema';
import { approveAllPendingItems, decideApprovalItem } from '@/orchestrator/approvals';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action: 'APPROVE' | 'REJECT' | 'APPROVE_ALL' | 'TOGGLE_POLICY';
      code?: string;
      gateKey?: string;
      mode?: 'REQUIRE_APPROVAL' | 'FULL_AUTO';
    };

    if (body.action === 'APPROVE_ALL') {
      const res = await approveAllPendingItems('ceo_cockpit');
      return NextResponse.json({ ok: true, ...res });
    }

    if (body.action === 'APPROVE' || body.action === 'REJECT') {
      if (!body.code) {
        return NextResponse.json({ ok: false, error: 'Onay kodu eksik' }, { status: 400 });
      }
      const res = await decideApprovalItem(
        body.code,
        body.action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        'ceo_cockpit'
      );
      return NextResponse.json({ ok: true, ...res });
    }

    if (body.action === 'TOGGLE_POLICY' && body.gateKey && body.mode) {
      const db = getDb();
      db.update(autonomyPolicies)
        .set({ mode: body.mode, updatedAt: new Date().toISOString() })
        .where(eq(autonomyPolicies.gateKey, body.gateKey))
        .run();
      return NextResponse.json({ ok: true, gateKey: body.gateKey, mode: body.mode });
    }

    return NextResponse.json({ ok: false, error: 'Bilinmeyen onay işlemi' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'İşlem başarısız' },
      { status: 500 }
    );
  }
}
