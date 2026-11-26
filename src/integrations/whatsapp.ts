import { desc, eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { getDb } from '@/db';
import { agentTasks, approvalQueue, customDemos, leads, orders, products, shiftRuns, systemSettings } from '@/db/schema';
import { approveAllPendingItems, decideApprovalItem } from '@/orchestrator/approvals';

export interface WhatsAppBridgeState {
  status: 'disconnected' | 'qr_ready' | 'connecting' | 'connected' | 'cloud_api_ready';
  qrDataUrl: string | null;
  connectedPhone: string | null;
  lastMessageAt: string | null;
  lastError: string | null;
  recentLogs: Array<{ direction: 'in' | 'out'; text: string; at: string }>;
}

declare global {
  // eslint-disable-next-line no-var
  var __vmsWhatsAppState: WhatsAppBridgeState | undefined;
  // eslint-disable-next-line no-var
  var __vmsWhatsAppSock: { sendMessage?: (jid: string, content: { text: string }) => Promise<unknown>; logout?: () => Promise<void> } | undefined;
}

function getBridgeState(): WhatsAppBridgeState {
  if (!global.__vmsWhatsAppState) {
    const hasCloudApi = Boolean(process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
    global.__vmsWhatsAppState = {
      status: hasCloudApi ? 'cloud_api_ready' : 'disconnected',
      qrDataUrl: null,
      connectedPhone: null,
      lastMessageAt: null,
      lastError: null,
      recentLogs: [],
    };
  }
  return global.__vmsWhatsAppState;
}

function pushWhatsAppLog(direction: 'in' | 'out', text: string): void {
  const st = getBridgeState();
  const at = new Date().toISOString();
  st.lastMessageAt = at;
  st.recentLogs = [{ direction, text, at }, ...st.recentLogs.slice(0, 19)];
}

export function getWhatsAppStatus(): WhatsAppBridgeState {
  return { ...getBridgeState() };
}

export async function startWhatsAppQrPairing(): Promise<WhatsAppBridgeState> {
  const st = getBridgeState();
  if (st.status === 'connected' || st.status === 'qr_ready') {
    return getWhatsAppStatus();
  }

  st.status = 'connecting';
  st.lastError = null;

  try {
    const authDir = path.resolve(process.cwd(), 'data', 'whatsapp-auth');
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const baileys = await import('@whiskeysockets/baileys');
    const pino = (await import('pino')).default;
    const { state, saveCreds } = await baileys.useMultiFileAuthState(authDir);

    const sock = baileys.makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }) as never,
      browser: ['VMS CEO Kokpiti', 'Chrome', '1.0.0'],
    });

    global.__vmsWhatsAppSock = sock as unknown as typeof global.__vmsWhatsAppSock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      if (update.qr) {
        st.qrDataUrl = await QRCode.toDataURL(update.qr, { margin: 2, width: 280 });
        st.status = 'qr_ready';
      }
      if (update.connection === 'open') {
        st.status = 'connected';
        st.qrDataUrl = null;
        st.connectedPhone = sock.user?.id?.split(':')[0] || 'Bağlı Cihaz';
      }
      if (update.connection === 'close') {
        const errMsg = update.lastDisconnect?.error?.message || '';
        if (st.status !== 'qr_ready') {
          st.status = 'disconnected';
          st.lastError = errMsg || null;
        }
      }
    });

    sock.ev.on('messages.upsert', async (event) => {
      if (event.type !== 'notify' || !event.messages) return;
      for (const msg of event.messages) {
        if (msg.key?.fromMe) continue;
        const senderJid = msg.key?.remoteJid || '';
        const text =
          msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        if (!text.trim()) continue;

        const db = getDb();
        const ceoPhoneRow = db
          .select()
          .from(systemSettings)
          .where(eq(systemSettings.key, 'ceo_whatsapp_phone'))
          .get();
        const ceoDigits = (ceoPhoneRow?.value || '').replace(/[^\d]/g, '');

        // Only process commands from configured CEO phone (or self-chat if none constrained yet)
        if (ceoDigits && !senderJid.includes(ceoDigits)) {
          continue;
        }

        const reply = await processCeoWhatsAppCommand(text, 'whatsapp');
        if (sock.sendMessage && senderJid) {
          await sock.sendMessage(senderJid, { text: reply });
          pushWhatsAppLog('out', reply);
        }
      }
    });

    // Wait briefly up to 2.5s so the initial QR code can populate if immediately emitted
    await new Promise((r) => setTimeout(r, 1800));
  } catch (err) {
    st.status = 'disconnected';
    st.lastError = err instanceof Error ? err.message : 'WhatsApp QR başlatılamadı';
  }

  return getWhatsAppStatus();
}

export async function sendCeoWhatsAppNotification(message: string): Promise<{ delivered: boolean; mode: string }> {
  pushWhatsAppLog('out', message);

  const db = getDb();
  const ceoPhoneRow = db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'ceo_whatsapp_phone'))
    .get();
  const ceoDigits = (ceoPhoneRow?.value || '').replace(/[^\d]/g, '');
  const normalizedDigits = ceoDigits.startsWith('0') ? `90${ceoDigits.slice(1)}` : ceoDigits;

  // 1. Try connected QR Baileys socket
  const st = getBridgeState();
  if (st.status === 'connected' && global.__vmsWhatsAppSock?.sendMessage && normalizedDigits) {
    try {
      await global.__vmsWhatsAppSock.sendMessage(`${normalizedDigits}@s.whatsapp.net`, { text: message });
      return { delivered: true, mode: 'qr_bridge' };
    } catch {
      // fall through
    }
  }

  // 2. Try Official Meta WhatsApp Cloud API
  const cloudToken = process.env.WHATSAPP_CLOUD_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (cloudToken && phoneNumberId && normalizedDigits) {
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cloudToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: normalizedDigits,
          type: 'text',
          text: { body: message },
        }),
      });
      if (res.ok) {
        return { delivered: true, mode: 'cloud_api' };
      }
    } catch {
      // fall through
    }
  }

  return { delivered: false, mode: 'cockpit_inbox_logged' };
}

export async function processCeoWhatsAppCommand(
  rawText: string,
  source: 'whatsapp' | 'cockpit' = 'whatsapp'
): Promise<string> {
  const clean = rawText.trim();
  pushWhatsAppLog('in', clean);

  const upper = clean
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C');

  const db = getDb();

  // 1. DURUM / OZET
  if (upper === 'DURUM' || upper === 'OZET' || upper === '/DURUM') {
    const totalLeads = db.select({ c: sql<number>`COUNT(*)` }).from(leads).get()?.c ?? 0;
    const totalDemos = db.select({ c: sql<number>`COUNT(*)` }).from(customDemos).get()?.c ?? 0;
    const pendingCount =
      db
        .select({ c: sql<number>`COUNT(*)` })
        .from(approvalQueue)
        .where(eq(approvalQueue.status, 'PENDING'))
        .get()?.c ?? 0;
    const activeOrders = db.select({ c: sql<number>`COUNT(*)` }).from(orders).get()?.c ?? 0;
    const mrr = db.select({ s: sql<number>`COALESCE(SUM(${products.mrrTry}), 0)` }).from(products).get()?.s ?? 0;
    const lastShift = db.select().from(shiftRuns).orderBy(desc(shiftRuns.id)).limit(1).get();

    return [
      '📊 *VMS Otonom Ajans Anlık Raporu*',
      `• Aktif MRR: ${Number(mrr).toLocaleString('tr-TR')} ₺/ay (${activeOrders} sipariş/deneme)`,
      `• Keşfedilen KOBİ: ${totalLeads} | Canlı Demo: ${totalDemos}`,
      `• Onay Bekleyen İşlem: ${pendingCount}`,
      `• Son Vardiya: ${lastShift ? `${lastShift.shiftType} (${lastShift.status})` : 'Henüz çalışmadı'}`,
      '',
      'Komutlar: `TUMUNU ONAYLA` | `ONAYLA #101` | `RED #101` | `VARDIYA IKINDI` veya doğrudan Türkçe talimat yazabilirsiniz.',
    ].join('\n');
  }

  // 2. TUMUNU ONAYLA
  if (upper === 'TUMUNU ONAYLA' || upper === 'HEPSINI ONAYLA') {
    const res = await approveAllPendingItems(source === 'whatsapp' ? 'ceo_whatsapp' : 'ceo_cockpit');
    if (res.approvedCount === 0) {
      return '✅ Şu an bekleyen onay kaydı bulunmuyor.';
    }
    return `✅ Toplam ${res.approvedCount} bekleyen işlem onaylandı ve yürütüldü: ${res.codes.join(', ')}`;
  }

  // 3. ONAYLA #ID
  const approveMatch = upper.match(/^ONAYLA\s+#?([A-Z0-9-]+)$/);
  if (approveMatch) {
    try {
      const res = await decideApprovalItem(
        approveMatch[1],
        'APPROVED',
        source === 'whatsapp' ? 'ceo_whatsapp' : 'ceo_cockpit'
      );
      return `✅ ${res.detail}`;
    } catch (err) {
      return `⚠️ ${err instanceof Error ? err.message : 'Onay hatası'}`;
    }
  }

  // 4. RED / REDDET #ID
  const rejectMatch = upper.match(/^(?:RED|REDDET)\s+#?([A-Z0-9-]+)$/);
  if (rejectMatch) {
    try {
      const res = await decideApprovalItem(
        rejectMatch[1],
        'REJECTED',
        source === 'whatsapp' ? 'ceo_whatsapp' : 'ceo_cockpit'
      );
      return `🛑 ${res.detail}`;
    } catch (err) {
      return `⚠️ ${err instanceof Error ? err.message : 'Reddetme hatası'}`;
    }
  }

  // 5. VARDIYA TETİKLEME
  if (upper.startsWith('VARDIYA ')) {
    const arg = upper.replace('VARDIYA ', '').trim();
    const { runShift, catchUpMissedShifts } = await import('@/orchestrator/scheduler');
    if (arg === 'TELAFI' || arg === 'TUMU') {
      const ran = await catchUpMissedShifts('whatsapp');
      return `🚀 Telafi zamanlayıcısı tamamlandı (${ran.length} vardiya çalıştırıldı).`;
    }
    const map: Record<string, 'morning' | 'midday' | 'afternoon' | 'night'> = {
      SABAH: 'morning',
      OGLE: 'midday',
      IKINDI: 'afternoon',
      GECE: 'night',
      KAIZEN: 'night',
    };
    const shiftType = map[arg];
    if (shiftType) {
      const result = await runShift(shiftType, 'whatsapp');
      return `🚀 *${shiftType.toUpperCase()}* vardiyası tamamlandı:\n${result.summary}`;
    }
  }

  // 6. Serbest Doğal Dil CEO Talimatı -> COO (Atlas) Aktif Direktif Hafızası
  const now = new Date().toISOString();
  const existing = db.select().from(systemSettings).where(eq(systemSettings.key, 'ceo_active_directive')).get();
  if (existing) {
    db.update(systemSettings)
      .set({ value: clean, updatedAt: now })
      .where(eq(systemSettings.key, 'ceo_active_directive'))
      .run();
  } else {
    db.insert(systemSettings)
      .values({ key: 'ceo_active_directive', value: clean, updatedAt: now })
      .run();
  }

  db.insert(agentTasks)
    .values({
      agentId: 'coo',
      title: 'CEO Doğrudan Stratejik Talimat Kaydı',
      executionMode: 'antigravity_native',
      modelUsed: 'coo-atlas-directive',
      tokensUsed: 0,
      costUsd: 0,
      status: 'completed',
      outputSummary: `CEO talimatı aktif vardiya önceliğine alındı: "${clean}"`,
      createdAt: now,
    })
    .run();

  return `🫡 *Atlas (COO):* Talimatınız kaydedildi ve sıradaki tüm vardiyaların birincil önceliğine alındı:\n"${clean}"\n\nHemen uygulamak isterseniz \`VARDIYA SABAH\` veya \`VARDIYA IKINDI\` yazabilirsiniz.`;
}
