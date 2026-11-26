import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import {
  agentPlaybooks,
  agents,
  agentTasks,
  approvalQueue,
  autonomyPolicies,
  contentPosts,
  customDemos,
  kaizenLogs,
  leads,
  orders,
  outreachMessages,
  products,
  shiftRuns,
  systemSettings,
} from '@/db/schema';
import { ensureSeeded } from '@/db/seed';
import { buildWaMeUrl } from '@/integrations/outreach';
import { getWhatsAppStatus } from '@/integrations/whatsapp';
import { getTodayAgentSpendUsd } from '@/lib/llm/router';

export const dynamic = 'force-dynamic';

export async function GET() {
  ensureSeeded();
  const db = getDb();

  const agentRows = db.select().from(agents).all();
  const playbooksAll = db.select().from(agentPlaybooks).orderBy(desc(agentPlaybooks.version)).all();

  const enrichedAgents = agentRows.map((ag) => {
    const history = playbooksAll.filter((p) => p.agentId === ag.id);
    return {
      ...ag,
      todaySpendUsd: getTodayAgentSpendUsd(ag.id),
      latestPlaybook: history[0] || null,
      previousPlaybook: history[1] || null,
    };
  });

  const shifts = db.select().from(shiftRuns).orderBy(desc(shiftRuns.id)).limit(12).all();
  const tasks = db.select().from(agentTasks).orderBy(desc(agentTasks.id)).limit(25).all();
  const policies = db.select().from(autonomyPolicies).all();
  const approvalsRaw = db.select().from(approvalQueue).orderBy(desc(approvalQueue.id)).limit(30).all();
  const outreachAll = db.select().from(outreachMessages).all();
  const leadsAll = db.select().from(leads).orderBy(desc(leads.id)).all();
  const demosAll = db.select().from(customDemos).orderBy(desc(customDemos.id)).all();
  const productsAll = db.select().from(products).all();
  const ordersAll = db.select().from(orders).orderBy(desc(orders.id)).all();
  const kaizenAll = db.select().from(kaizenLogs).orderBy(desc(kaizenLogs.id)).limit(10).all();
  const postsAll = db.select().from(contentPosts).orderBy(desc(contentPosts.id)).limit(10).all();
  const settingsRows = db.select().from(systemSettings).all();

  const settingsMap: Record<string, string> = {};
  for (const s of settingsRows) {
    settingsMap[s.key] = s.key === 'gemini_api_key' && s.value ? '••••••••' + s.value.slice(-4) : s.value;
  }
  settingsMap.has_gemini_key =
    Boolean(process.env.GEMINI_API_KEY) ||
    Boolean(settingsRows.find((r) => r.key === 'gemini_api_key')?.value)
      ? 'true'
      : 'false';

  const approvals = approvalsRaw.map((item) => {
    const payload = JSON.parse(item.payloadJson || '{}') as {
      outreachId?: number;
      leadId?: number;
      demoSlug?: string;
    };
    const outreach = payload.outreachId ? outreachAll.find((m) => m.id === payload.outreachId) : undefined;
    const lead = payload.leadId ? leadsAll.find((l) => l.id === payload.leadId) : undefined;
    const waMeUrl = lead && outreach ? buildWaMeUrl(lead.phone, outreach.body) : null;
    return {
      ...item,
      messageBody: outreach?.body || null,
      variant: outreach?.variant || null,
      demoSlug: payload.demoSlug || outreach?.demoSlug || null,
      leadName: lead?.businessName || null,
      leadPhone: lead?.phone || null,
      waMeUrl,
    };
  });

  const totalMrrTry = productsAll.reduce((acc, p) => acc + p.mrrTry, 0);
  const totalDemoViews = demosAll.reduce((acc, d) => acc + d.viewsCount, 0);
  const totalDemoChats = demosAll.reduce((acc, d) => acc + d.chatsCount, 0);
  const totalAppointmentsSim = demosAll.reduce((acc, d) => acc + d.appointmentsBookedCount, 0);
  const pendingApprovalsCount = approvals.filter((a) => a.status === 'PENDING').length;

  return NextResponse.json({
    kpis: {
      totalMrrTry,
      activeOrdersCount: ordersAll.length,
      leadsCount: leadsAll.length,
      demosCount: demosAll.length,
      totalDemoViews,
      totalDemoChats,
      totalAppointmentsSim,
      pendingApprovalsCount,
      todayTotalSpendUsd: getTodayAgentSpendUsd(),
    },
    agents: enrichedAgents,
    shifts,
    tasks,
    policies,
    approvals,
    leads: leadsAll,
    demos: demosAll,
    products: productsAll,
    orders: ordersAll,
    kaizenLogs: kaizenAll,
    posts: postsAll,
    settings: settingsMap,
    whatsapp: getWhatsAppStatus(),
  });
}
