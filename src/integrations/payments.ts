import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { customDemos, leads, orders, products, systemSettings } from '@/db/schema';

export interface CreateOrderInput {
  demoSlug?: string;
  businessName: string;
  contactPhone: string;
  productSlug?: string;
  planTier: 'starter' | 'pro' | 'enterprise_b2b';
  paymentProvider?: 'paytr' | 'iyzico' | 'shopier' | 'b2b_invoice';
}

export interface CheckoutSessionResult {
  orderNumber: string;
  amountTry: number;
  provider: string;
  status: string;
  paymentInstructions: string;
  checkoutUrl: string;
}

export function createCheckoutSession(input: CreateOrderInput): CheckoutSessionResult {
  const db = getDb();
  const productSlug = input.productSlug || 'kobi-asistan-pro';
  const product = db.select().from(products).where(eq(products.slug, productSlug)).get();
  if (!product) {
    throw new Error(`Ürün bulunamadı: ${productSlug}`);
  }

  const providerRow = db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'payment_provider'))
    .get();
  const provider = input.paymentProvider || (providerRow?.value as CreateOrderInput['paymentProvider']) || 'paytr';

  const amountTry =
    input.planTier === 'starter'
      ? product.starterPriceTry
      : input.planTier === 'pro'
        ? product.proPriceTry
        : product.enterpriseSetupTry;

  let leadId: number | null = null;
  if (input.demoSlug) {
    const demo = db.select().from(customDemos).where(eq(customDemos.slug, input.demoSlug)).get();
    if (demo) {
      leadId = demo.leadId;
      db.update(customDemos)
        .set({
          checkoutClicksCount: demo.checkoutClicksCount + 1,
          lastInteractedAt: new Date().toISOString(),
        })
        .where(eq(customDemos.id, demo.id))
        .run();

      db.update(leads)
        .set({ stage: 'HOT_ENGAGED' })
        .where(eq(leads.id, demo.leadId))
        .run();
    }
  }

  const orderNumber = `VMS-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 89)}`;
  const now = new Date().toISOString();

  db.insert(orders)
    .values({
      orderNumber,
      leadId,
      businessName: input.businessName.trim(),
      contactPhone: input.contactPhone.trim(),
      productSlug,
      planTier: input.planTier,
      amountTry,
      paymentProvider: provider,
      status: input.planTier === 'enterprise_b2b' ? 'PENDING_PAYMENT' : 'TRIAL_ACTIVE',
      createdAt: now,
    })
    .run();

  // Update active trial/customer metrics on product if subscription started
  if (input.planTier !== 'enterprise_b2b') {
    db.update(products)
      .set({
        activeCustomers: product.activeCustomers + 1,
        mrrTry: product.mrrTry + amountTry,
      })
      .where(eq(products.id, product.id))
      .run();

    if (leadId) {
      db.update(leads).set({ stage: 'WON' }).where(eq(leads.id, leadId)).run();
    }
  }

  const shopierCustom = db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'shopier_base_url'))
    .get()?.value;

  const checkoutUrl = shopierCustom
    ? `${shopierCustom}?order=${encodeURIComponent(orderNumber)}`
    : `/demo/${input.demoSlug || 'onay'}?siparis=${encodeURIComponent(orderNumber)}`;

  const paymentInstructions =
    input.planTier === 'enterprise_b2b'
      ? `Kurumsal Özel Kurulum talebiniz (${amountTry.toLocaleString('tr-TR')} ₺ + E-Fatura) oluşturuldu. Ekibimiz WhatsApp hattınızdan sözleşme ve kurulum takvimini iletecektir.`
      : `14 Gün Ücretsiz Deneme ve ${provider.toUpperCase()} (${amountTry.toLocaleString('tr-TR')} ₺/ay) abonelik kaydınız #${orderNumber} numarasıyla aktif edildi.`;

  return {
    orderNumber,
    amountTry,
    provider,
    status: input.planTier === 'enterprise_b2b' ? 'PENDING_PAYMENT' : 'TRIAL_ACTIVE',
    paymentInstructions,
    checkoutUrl,
  };
}
