import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { customDemos, leads } from '@/db/schema';
import { ensureSeeded } from '@/db/seed';
import { createCheckoutSession } from '@/integrations/payments';
import { sendCeoWhatsAppNotification } from '@/integrations/whatsapp';
import { runAgentIntelligence } from '@/lib/llm/router';

interface DemoServiceItem {
  name: string;
  duration: string;
  priceRange: string;
}

interface DemoFaqItem {
  q: string;
  a: string;
}

function buildSmartTurkishSimulatorReply(
  userMessage: string,
  businessName: string,
  services: DemoServiceItem[],
  faqs: DemoFaqItem[]
): { reply: string; bookedAppointment: { customerName: string; service: string; slot: string } | null } {
  const lower = userMessage.toLocaleLowerCase('tr-TR');

  const wantsAppointment =
    lower.includes('randevu') ||
    lower.includes('yarın') ||
    lower.includes('yarin') ||
    lower.includes('bugün') ||
    lower.includes('bugun') ||
    lower.includes('saat') ||
    lower.includes('yer var mı') ||
    lower.includes('rezervasyon') ||
    lower.includes('müsait');

  const matchedService =
    services.find((s) =>
      s.name
        .toLocaleLowerCase('tr-TR')
        .split(/\s+/)
        .some((word) => word.length > 3 && lower.includes(word))
    ) || services[0];

  if (wantsAppointment) {
    const slot = lower.includes('sabah') ? 'Yarın 10:30' : lower.includes('akşam') ? 'Yarın 18:00' : 'Yarın 14:30';
    return {
      reply: `Memnuniyetle! ✅ **${matchedService.name}** (${matchedService.duration} — ${matchedService.priceRange}) için **${slot}** saatine ön randevunuzu oluşturdum ve yan taraftaki yönetim ekranına anında işledim. Randevudan 2 saat önce otomatik WhatsApp hatırlatma mesajınız da iletilecektir. Başka bir sorunuz var mı?`,
      bookedAppointment: {
        customerName: 'Demo Ziyaretçisi (Canlı Test)',
        service: matchedService.name,
        slot,
      },
    };
  }

  if (lower.includes('fiyat') || lower.includes('ücret') || lower.includes('ne kadar') || lower.includes('kaç tl')) {
    const listText = services.map((s) => `• ${s.name}: ${s.priceRange}`).join('\n');
    return {
      reply: `${businessName} güncel işlem ve hizmet aralıklarımız şöyledir:\n${listText}\n\nUygun bir gün için hemen ön randevu oluşturmamı ister misiniz? (Örn: "Yarın öğleden sonra randevu alabilir miyim?" yazabilirsiniz)`,
      bookedAppointment: null,
    };
  }

  if (lower.includes('cumartesi') || lower.includes('hafta sonu') || lower.includes('taksit') || lower.includes('otopark')) {
    const faqText = faqs.map((f) => `• ${f.q} — ${f.a}`).join('\n');
    return {
      reply: `Tabii, hemen bilgi vereyim:\n${faqText}\n\nDilerseniz size uygun saati yazın, 10 saniyede randevunuzu kaydedeyim.`,
      bookedAppointment: null,
    };
  }

  return {
    reply: `Merhaba! ${businessName} 7/24 yapay zeka asistanıyım. **${matchedService.name}** başta olmak üzere tüm hizmetlerimiz hakkında fiyat bilgisi verebilir veya "Yarın öğleden sonra randevu istiyorum" yazdığınızda takvime otomatik kayıt açabilirim. Nasıl yardımcı olayım?`,
    bookedAppointment: null,
  };
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = (await req.json()) as {
      action: 'VIEW' | 'CHAT' | 'CHECKOUT';
      slug: string;
      message?: string;
      businessName?: string;
      contactPhone?: string;
      planTier?: 'starter' | 'pro' | 'enterprise_b2b';
      paymentProvider?: 'paytr' | 'iyzico' | 'shopier' | 'b2b_invoice';
    };

    const db = getDb();
    const demo = db.select().from(customDemos).where(eq(customDemos.slug, body.slug)).get();
    if (!demo && body.action !== 'CHECKOUT') {
      return NextResponse.json({ ok: false, error: 'Canlı demo bulunamadı' }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (body.action === 'VIEW' && demo) {
      db.update(customDemos)
        .set({ viewsCount: demo.viewsCount + 1, lastInteractedAt: now })
        .where(eq(customDemos.id, demo.id))
        .run();
      return NextResponse.json({ ok: true, viewsCount: demo.viewsCount + 1 });
    }

    if (body.action === 'CHAT' && demo) {
      const services = JSON.parse(demo.servicesJson || '[]') as DemoServiceItem[];
      const faqs = JSON.parse(demo.faqJson || '[]') as DemoFaqItem[];
      const userMsg = (body.message || '').trim();
      const lead = db.select().from(leads).where(eq(leads.id, demo.leadId)).get();
      const bizTitle = lead?.businessName || demo.headline.split('—')[0].trim();

      const sim = buildSmartTurkishSimulatorReply(userMsg, bizTitle, services, faqs);

      const aiRes = await runAgentIntelligence({
        agentId: 'sales',
        preferredModel: 'gemini-4-hydrogen',
        thinkingLevel: 'low',
        systemPrompt: `Sen ${bizTitle} işletmesinin kibar, hızlı Türkçe WhatsApp asistanısın. Hizmetler: ${JSON.stringify(services)}. SSS: ${JSON.stringify(faqs)}. Maksimum 3 cümleyle yanıt ver ve randevuya yönlendir.`,
        userPrompt: userMsg,
        fallbackGenerator: () => sim.reply,
      });

      const nextChats = demo.chatsCount + 1;
      const nextAppts = sim.bookedAppointment ? demo.appointmentsBookedCount + 1 : demo.appointmentsBookedCount;

      db.update(customDemos)
        .set({
          chatsCount: nextChats,
          appointmentsBookedCount: nextAppts,
          lastInteractedAt: now,
        })
        .where(eq(customDemos.id, demo.id))
        .run();

      if (lead && lead.stage !== 'WON') {
        db.update(leads).set({ stage: 'HOT_ENGAGED' }).where(eq(leads.id, lead.id)).run();
      }

      if (nextChats === 1) {
        await sendCeoWhatsAppNotification(
          `🔥 *Sıcak KOBİ Etkileşimi!* ${bizTitle} kendi canlı demosunu (/demo/${demo.slug}) açtı ve WhatsApp AI asistanını test ediyor!`
        );
      }

      return NextResponse.json({
        ok: true,
        reply: sim.bookedAppointment ? sim.reply : aiRes.text,
        bookedAppointment: sim.bookedAppointment,
        telemetry: {
          viewsCount: demo.viewsCount,
          chatsCount: nextChats,
          appointmentsBookedCount: nextAppts,
        },
      });
    }

    if (body.action === 'CHECKOUT') {
      const checkout = createCheckoutSession({
        demoSlug: body.slug,
        businessName: body.businessName || 'KOBİ Müşterisi',
        contactPhone: body.contactPhone || '+905000000000',
        planTier: body.planTier || 'pro',
        paymentProvider: body.paymentProvider || 'paytr',
      });

      await sendCeoWhatsAppNotification(
        `🎉 *Yeni Paket Başvurusu / Sipariş!* ${body.businessName} — Paket: ${body.planTier?.toUpperCase()} (${checkout.amountTry.toLocaleString('tr-TR')} ₺) — Kod: #${checkout.orderNumber}`
      );

      return NextResponse.json({ ok: true, checkout });
    }

    return NextResponse.json({ ok: false, error: 'Geçersiz istek' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Demo etkileşim hatası' },
      { status: 500 }
    );
  }
}
