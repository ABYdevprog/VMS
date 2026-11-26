import { desc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { approvalQueue, autonomyPolicies } from '@/db/schema';
import { dispatchApprovedOutreach } from '@/integrations/outreach';
import { getIstanbulDateString } from '@/lib/llm/router';

export interface GateSubmissionInput {
  gateKey: 'OUTBOUND_MESSAGE' | 'PRODUCTION_RELEASE' | 'PRICING_UPDATE' | 'BUDGET_SPEND';
  agentId: string;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
}

export interface GateSubmissionResult {
  code: string;
  status: 'PENDING' | 'AUTO_EXECUTED';
  executedDetail?: string;
}

export async function submitThroughGovernanceGate(input: GateSubmissionInput): Promise<GateSubmissionResult> {
  const db = getDb();
  const policy = db.select().from(autonomyPolicies).where(eq(autonomyPolicies.gateKey, input.gateKey)).get();

  const latestRow = db.select().from(approvalQueue).orderBy(desc(approvalQueue.id)).limit(1).get();
  const nextSeq = 100 + (latestRow?.id ?? 0) + 1;
  const code = `ONAY-${nextSeq}`;
  const now = new Date().toISOString();

  const todayPrefix = getIstanbulDateString();
  const todayAutoCountRow = db
    .select({ cnt: sql<number>`COUNT(*)` })
    .from(approvalQueue)
    .where(
      sql`${approvalQueue.gateKey} = ${input.gateKey} AND ${approvalQueue.status} IN ('APPROVED', 'AUTO_EXECUTED') AND substr(${approvalQueue.createdAt}, 1, 10) = ${todayPrefix}`
    )
    .get();
  const todayCount = Number(todayAutoCountRow?.cnt ?? 0);
  const dailyCap = policy?.dailyCap ?? 25;

  const canAutoExecute = policy?.mode === 'FULL_AUTO' && todayCount < dailyCap;

  if (canAutoExecute) {
    let executedDetail = 'Otomatik politika kapsamında yürütüldü.';
    if (input.gateKey === 'OUTBOUND_MESSAGE' && typeof input.payload.outreachId === 'number') {
      const dispatchRes = await dispatchApprovedOutreach(input.payload.outreachId);
      executedDetail = `${dispatchRes.leadBusinessName} için satış daveti hazırlandı (${dispatchRes.deliveredVia}).`;
    }

    db.insert(approvalQueue)
      .values({
        code,
        gateKey: input.gateKey,
        agentId: input.agentId,
        title: input.title,
        summary: input.summary,
        payloadJson: JSON.stringify(input.payload),
        status: 'AUTO_EXECUTED',
        decidedBy: 'auto_policy',
        createdAt: now,
        decidedAt: now,
      })
      .run();

    return { code, status: 'AUTO_EXECUTED', executedDetail };
  }

  db.insert(approvalQueue)
    .values({
      code,
      gateKey: input.gateKey,
      agentId: input.agentId,
      title: input.title,
      summary: input.summary,
      payloadJson: JSON.stringify(input.payload),
      status: 'PENDING',
      createdAt: now,
    })
    .run();

  return { code, status: 'PENDING' };
}

export async function decideApprovalItem(
  codeOrId: string,
  decision: 'APPROVED' | 'REJECTED',
  decidedBy: 'ceo_cockpit' | 'ceo_whatsapp'
): Promise<{ code: string; status: string; detail: string }> {
  const db = getDb();
  const normalized = codeOrId.trim().toUpperCase().replace(/^#/, '');
  const codeCandidate = normalized.startsWith('ONAY-') ? normalized : `ONAY-${normalized}`;

  let item = db.select().from(approvalQueue).where(eq(approvalQueue.code, codeCandidate)).get();
  if (!item && /^\d+$/.test(normalized)) {
    item = db.select().from(approvalQueue).where(eq(approvalQueue.id, Number(normalized))).get();
  }

  if (!item) {
    throw new Error(`Onay kaydı bulunamadı: ${codeOrId}`);
  }

  if (item.status !== 'PENDING') {
    return {
      code: item.code,
      status: item.status,
      detail: `${item.code} zaten daha önce sonuçlandırılmış (${item.status}).`,
    };
  }

  const now = new Date().toISOString();
  let detail = decision === 'APPROVED' ? `${item.code} onaylandı.` : `${item.code} reddedildi.`;

  if (decision === 'APPROVED') {
    const payload = JSON.parse(item.payloadJson || '{}') as { outreachId?: number };
    if (item.gateKey === 'OUTBOUND_MESSAGE' && typeof payload.outreachId === 'number') {
      const dispatchRes = await dispatchApprovedOutreach(payload.outreachId);
      detail = `${item.code} onaylandı -> ${dispatchRes.leadBusinessName} mesajı gönderim kuyruğuna alındı (${dispatchRes.waMeLink}).`;
    }
  }

  db.update(approvalQueue)
    .set({
      status: decision,
      decidedBy,
      decidedAt: now,
    })
    .where(eq(approvalQueue.id, item.id))
    .run();

  return { code: item.code, status: decision, detail };
}

export async function approveAllPendingItems(
  decidedBy: 'ceo_cockpit' | 'ceo_whatsapp'
): Promise<{ approvedCount: number; codes: string[] }> {
  const db = getDb();
  const pending = db.select().from(approvalQueue).where(eq(approvalQueue.status, 'PENDING')).all();
  const codes: string[] = [];

  for (const item of pending) {
    const res = await decideApprovalItem(item.code, 'APPROVED', decidedBy);
    codes.push(res.code);
  }

  return { approvedCount: codes.length, codes };
}
