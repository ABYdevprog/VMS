import { eq } from 'drizzle-orm';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getDb, resetDbConnectionForTests } from '@/db';
import { agents, approvalQueue, autonomyPolicies, contentPosts, customDemos, kaizenLogs, leads, orders } from '@/db/schema';
import { ensureSeeded } from '@/db/seed';
import { createCheckoutSession } from '@/integrations/payments';
import { processCeoWhatsAppCommand } from '@/integrations/whatsapp';
import { decideApprovalItem } from '@/orchestrator/approvals';
import { catchUpMissedShifts, runShift } from '@/orchestrator/scheduler';

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vms-test-'));

beforeEach(() => {
  const uniqueDb = path.join(testDir, `vms-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  process.env.VMS_DB_PATH = uniqueDb;
  delete process.env.GEMINI_API_KEY;
  resetDbConnectionForTests();
});

afterAll(() => {
  resetDbConnectionForTests();
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe('VMS Autonomous Software Agency & KOBİ Demo Factory', () => {
  it('seeds all 7 specialized agents with Gemini 4 configurations and flagship KOBİ SaaS product', () => {
    const res = ensureSeeded();
    expect(res.seededNow).toBe(true);

    const db = getDb();
    const allAgents = db.select().from(agents).all();
    expect(allAgents).toHaveLength(7);

    const coo = allAgents.find((a) => a.id === 'coo');
    const researcher = allAgents.find((a) => a.id === 'researcher');
    expect(coo?.modelId).toBe('gemini-4-carbon');
    expect(researcher?.modelId).toBe('gemini-4-hydrogen');

    const initialDemos = db.select().from(customDemos).all();
    expect(initialDemos.length).toBeGreaterThanOrEqual(3);
  });

  it('executes all 4 daily shifts (morning, midday, afternoon, night) in zero-API-key native mode and evolves Playbooks to v2', async () => {
    ensureSeeded();
    const db = getDb();

    const morningRes = await runShift('morning', 'antigravity', '2026-11-26');
    expect(morningRes.summary).toContain('Sabah Vardiyası');

    const middayRes = await runShift('midday', 'antigravity', '2026-11-26');
    expect(middayRes.summary).toContain('Öğle Vardiyası');

    const posts = db.select().from(contentPosts).all();
    expect(posts.length).toBeGreaterThanOrEqual(2);

    const afternoonRes = await runShift('afternoon', 'antigravity', '2026-11-26');
    expect(afternoonRes.summary).toContain('İkindi Vardiyası');

    const pendingApprovals = db
      .select()
      .from(approvalQueue)
      .where(eq(approvalQueue.status, 'PENDING'))
      .all();
    expect(pendingApprovals.length).toBe(2);

    const nightRes = await runShift('night', 'antigravity', '2026-11-26');
    expect(nightRes.summary).toContain('v2');

    const salesAgent = db.select().from(agents).where(eq(agents.id, 'sales')).get();
    expect(salesAgent?.playbookVersion).toBe(2);

    const kaizenEntries = db.select().from(kaizenLogs).all();
    expect(kaizenEntries).toHaveLength(1);
  });

  it('handles CEO WhatsApp natural-language directives, DURUM queries, and single-click approval execution', async () => {
    ensureSeeded();
    const db = getDb();

    const directiveReply = await processCeoWhatsAppCommand(
      'Yarın Ankara Çankaya emlak ofislerine odaklanın',
      'whatsapp'
    );
    expect(directiveReply).toContain('Atlas (COO)');

    await runShift('afternoon', 'whatsapp', '2026-11-26');

    const newestLead = db.select().from(leads).all().slice(-1)[0];
    expect(newestLead.city).toBe('Ankara');
    expect(newestLead.sector).toBe('realestate');

    const statusReply = await processCeoWhatsAppCommand('DURUM', 'whatsapp');
    expect(statusReply).toContain('VMS Otonom Ajans Anlık Raporu');

    const pendingItem = db.select().from(approvalQueue).where(eq(approvalQueue.status, 'PENDING')).get();
    expect(pendingItem).toBeDefined();

    const approveRes = await decideApprovalItem(pendingItem!.code, 'APPROVED', 'ceo_whatsapp');
    expect(approveRes.status).toBe('APPROVED');
    expect(approveRes.detail).toContain('wa.me');
  });

  it('auto-executes outbound invites when CEO switches guardrail policy to FULL_AUTO and tracks Turkish checkout MRR', async () => {
    ensureSeeded();
    const db = getDb();

    db.update(autonomyPolicies)
      .set({ mode: 'FULL_AUTO' })
      .where(eq(autonomyPolicies.gateKey, 'OUTBOUND_MESSAGE'))
      .run();

    await runShift('afternoon', 'cockpit', '2026-11-26');

    const autoItems = db
      .select()
      .from(approvalQueue)
      .where(eq(approvalQueue.status, 'AUTO_EXECUTED'))
      .all();
    expect(autoItems.length).toBe(2);

    const checkout = createCheckoutSession({
      demoSlug: 'ozel-dentmoda-kadikoy',
      businessName: 'Özel DentModa Kadıköy',
      contactPhone: '+905321112233',
      planTier: 'pro',
      paymentProvider: 'paytr',
    });

    expect(checkout.amountTry).toBe(2990);
    const savedOrders = db.select().from(orders).all();
    expect(savedOrders).toHaveLength(1);
  });

  it('runs catchUpMissedShifts idempotently without duplicating already completed shifts on the same date', async () => {
    ensureSeeded();
    // 17:15 UTC = 20:15 Europe/Istanbul -> morning (09:00), midday (12:30), afternoon (16:00) have passed, night (22:00) has not
    const simulatedDate = new Date('2026-11-26T17:15:00Z');

    const firstPass = await catchUpMissedShifts('catchup', simulatedDate);
    expect(firstPass.map((r) => r.shiftType)).toEqual(['morning', 'midday', 'afternoon']);

    const secondPass = await catchUpMissedShifts('catchup', simulatedDate);
    expect(secondPass).toHaveLength(0);
  });
});
