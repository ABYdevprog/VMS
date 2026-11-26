import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { leads, outreachMessages } from '@/db/schema';

export interface OutreachDispatchResult {
  outreachId: number;
  leadBusinessName: string;
  channel: string;
  waMeLink: string;
  deliveredVia: 'whatsapp_link_ready' | 'cloud_api_sent' | 'email_queued';
}

export function buildWaMeUrl(phone: string, message: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  const normalized = digits.startsWith('0') ? `90${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export async function dispatchApprovedOutreach(outreachId: number): Promise<OutreachDispatchResult> {
  const db = getDb();
  const msg = db.select().from(outreachMessages).where(eq(outreachMessages.id, outreachId)).get();
  if (!msg) {
    throw new Error(`Satış mesajı bulunamadı: #${outreachId}`);
  }

  const lead = db.select().from(leads).where(eq(leads.id, msg.leadId)).get();
  if (!lead) {
    throw new Error(`İşletme kaydı bulunamadı: #${msg.leadId}`);
  }

  const waMeLink = buildWaMeUrl(lead.phone, msg.body);
  let deliveredVia: OutreachDispatchResult['deliveredVia'] = 'whatsapp_link_ready';

  // If official Meta WhatsApp Cloud API credentials are set, send directly via Cloud API
  const cloudToken = process.env.WHATSAPP_CLOUD_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (msg.channel === 'whatsapp' && cloudToken && phoneNumberId) {
    const cleanPhone = lead.phone.replace(/[^\d]/g, '');
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cloudToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'text',
        text: { preview_url: true, body: msg.body },
      }),
    });
    if (res.ok) {
      deliveredVia = 'cloud_api_sent';
    }
  } else if (msg.channel === 'email') {
    deliveredVia = 'email_queued';
  }

  const now = new Date().toISOString();
  db.update(outreachMessages)
    .set({
      status: 'SENT',
      sentAt: now,
    })
    .where(eq(outreachMessages.id, msg.id))
    .run();

  if (lead.stage === 'DISCOVERED' || lead.stage === 'DEMO_READY' || lead.stage === 'AWAITING_APPROVAL') {
    db.update(leads)
      .set({ stage: 'CONTACTED' })
      .where(eq(leads.id, lead.id))
      .run();
  }

  return {
    outreachId: msg.id,
    leadBusinessName: lead.businessName,
    channel: msg.channel,
    waMeLink,
    deliveredVia,
  };
}
