import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppStatus, processCeoWhatsAppCommand, startWhatsAppQrPairing } from '@/integrations/whatsapp';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getWhatsAppStatus());
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { action: 'START_QR' | 'SIMULATE_CEO_MSG'; text?: string };
    if (body.action === 'START_QR') {
      const st = await startWhatsAppQrPairing();
      return NextResponse.json({ ok: true, whatsapp: st });
    }
    if (body.action === 'SIMULATE_CEO_MSG' && body.text) {
      const reply = await processCeoWhatsAppCommand(body.text, 'whatsapp');
      return NextResponse.json({ ok: true, reply, whatsapp: getWhatsAppStatus() });
    }
    return NextResponse.json({ ok: false, error: 'Bilinmeyen WhatsApp işlemi' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'WhatsApp işlemi başarısız' },
      { status: 500 }
    );
  }
}
