import { NextRequest, NextResponse } from 'next/server';
import { catchUpMissedShifts, runShift, ShiftType } from '@/orchestrator/scheduler';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { shiftType?: string };
    const shiftType = (body.shiftType || 'morning').toLowerCase();

    if (shiftType === 'catchup') {
      const results = await catchUpMissedShifts('cockpit');
      return NextResponse.json({
        ok: true,
        ranCount: results.length,
        results,
      });
    }

    if (shiftType === 'full_day') {
      const results = [];
      for (const st of ['morning', 'midday', 'afternoon', 'night'] as ShiftType[]) {
        results.push(await runShift(st, 'cockpit'));
      }
      return NextResponse.json({
        ok: true,
        ranCount: results.length,
        results,
      });
    }

    if (!['morning', 'midday', 'afternoon', 'night'].includes(shiftType)) {
      return NextResponse.json({ ok: false, error: 'Geçersiz vardiya tipi' }, { status: 400 });
    }

    const result = await runShift(shiftType as ShiftType, 'cockpit');
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Vardiya çalıştırılamadı' },
      { status: 500 }
    );
  }
}
