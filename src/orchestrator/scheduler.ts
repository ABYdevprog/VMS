import { and, eq } from 'drizzle-orm';
import cron, { ScheduledTask } from 'node-cron';
import {
  runBuilderWorker,
  runCooPlanning,
  runGrowthWorker,
  runKaizenWorker,
  runPmWorker,
  runResearcherWorker,
  runSalesWorker,
} from '@/agents/workers';
import { getDb } from '@/db';
import { shiftRuns } from '@/db/schema';
import { ensureSeeded } from '@/db/seed';
import { sendCeoWhatsAppNotification } from '@/integrations/whatsapp';
import { getIstanbulDateString } from '@/lib/llm/router';

export type ShiftType = 'morning' | 'midday' | 'afternoon' | 'night';
export type TriggerSource = 'cron' | 'catchup' | 'cockpit' | 'whatsapp' | 'antigravity';

export interface ShiftExecutionResult {
  shiftRunId: number;
  shiftType: ShiftType;
  shiftDate: string;
  summary: string;
  metrics: Record<string, unknown>;
}

const SHIFT_SCHEDULE_MINUTES_ISTANBUL: Array<{ type: ShiftType; hour: number; minute: number; label: string }> = [
  { type: 'morning', hour: 9, minute: 0, label: 'Sabah Strateji & Pazar Keşfi' },
  { type: 'midday', hour: 12, minute: 30, label: 'Öğle Yazılım QA & SEO İçerik' },
  { type: 'afternoon', hour: 16, minute: 0, label: 'İkindi Lead Avı & Canlı Demo Satış' },
  { type: 'night', hour: 22, minute: 0, label: 'Gece Kaizen Öz-Evrim & Playbook v+1' },
];

export function getIstanbulHourAndMinute(date: Date = new Date()): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || '0');
  return { hour, minute };
}

export async function runShift(
  shiftType: ShiftType,
  triggerSource: TriggerSource = 'cockpit',
  overrideDate?: string
): Promise<ShiftExecutionResult> {
  ensureSeeded();
  const db = getDb();
  const shiftDate = overrideDate || getIstanbulDateString();
  const startedAt = new Date().toISOString();

  const insertRun = db
    .insert(shiftRuns)
    .values({
      shiftType,
      shiftDate,
      triggerSource,
      status: 'running',
      summary: `${shiftType} vardiyası çalışıyor...`,
      metricsJson: '{}',
      startedAt,
    })
    .run();

  const shiftRunId = Number(insertRun.lastInsertRowid);

  try {
    let summary = '';
    let metrics: Record<string, unknown> = {};

    if (shiftType === 'morning') {
      const brief = await runResearcherWorker(shiftRunId);
      const pmRes = await runPmWorker(brief, shiftRunId);
      const cooRes = await runCooPlanning(brief, pmRes.sprintFocus, shiftRunId);
      summary = `🌅 Sabah Vardiyası: ${brief.city}/${brief.district} ${brief.sectorLabel} fırsatı seçildi. ${cooRes.dailyPlanSummary}`;
      metrics = { sector: brief.sector, city: brief.city, district: brief.district };
    } else if (shiftType === 'midday') {
      const buildRes = await runBuilderWorker(shiftRunId);
      const growthRes = await runGrowthWorker(shiftRunId);
      summary = `☀️ Öğle Vardiyası: ${buildRes.verifiedDemos} canlı demo doğrulandı, yeni BuildSpec (${buildRes.buildSpecPath}) ve SEO rehberi (/blog/${growthRes.postSlug}) yayınlandı.`;
      metrics = buildRes;
    } else if (shiftType === 'afternoon') {
      const salesRes = await runSalesWorker(shiftRunId);
      summary = `🌇 İkindi Vardiyası: ${salesRes.createdLeads} yeni KOBİ adayı puanlandı, özel canlı demolar (${salesRes.createdDemos.join(', ')}) üretildi ve onay kuyruğuna eklendi (${salesRes.queuedCodes.join(', ')}).`;
      metrics = salesRes;
    } else if (shiftType === 'night') {
      const kaizenRes = await runKaizenWorker(shiftRunId);
      summary = `🌙 Gece Kaizen Vardiyası: Varyant ${kaizenRes.winningVariant} öne çıktı; Satış & Büyüme Playbook sürümü v${kaizenRes.newPlaybookVersion} seviyesine yükseltildi.`;
      metrics = kaizenRes;
    }

    const completedAt = new Date().toISOString();
    db.update(shiftRuns)
      .set({
        status: 'completed',
        summary,
        metricsJson: JSON.stringify(metrics),
        completedAt,
      })
      .where(eq(shiftRuns.id, shiftRunId))
      .run();

    await sendCeoWhatsAppNotification(
      `${summary}\n\nDetaylar için CEO Kokpitini açabilir veya \`DURUM\` / \`TUMUNU ONAYLA\` yazabilirsiniz.`
    );

    return {
      shiftRunId,
      shiftType,
      shiftDate,
      summary,
      metrics,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Vardiya hatası';
    db.update(shiftRuns)
      .set({
        status: 'failed',
        summary: errMsg,
        completedAt: new Date().toISOString(),
      })
      .where(eq(shiftRuns.id, shiftRunId))
      .run();
    throw err;
  }
}

export async function catchUpMissedShifts(
  triggerSource: TriggerSource = 'catchup',
  nowDate: Date = new Date()
): Promise<ShiftExecutionResult[]> {
  ensureSeeded();
  const db = getDb();
  const todayStr = getIstanbulDateString(nowDate);
  const { hour, minute } = getIstanbulHourAndMinute(nowDate);
  const currentTotalMinutes = hour * 60 + minute;

  const executed: ShiftExecutionResult[] = [];

  for (const sched of SHIFT_SCHEDULE_MINUTES_ISTANBUL) {
    const schedMinutes = sched.hour * 60 + sched.minute;
    if (currentTotalMinutes < schedMinutes) {
      continue;
    }

    const alreadyRan = db
      .select()
      .from(shiftRuns)
      .where(
        and(
          eq(shiftRuns.shiftDate, todayStr),
          eq(shiftRuns.shiftType, sched.type),
          eq(shiftRuns.status, 'completed')
        )
      )
      .get();

    if (!alreadyRan) {
      const res = await runShift(sched.type, triggerSource, todayStr);
      executed.push(res);
    }
  }

  return executed;
}

declare global {
  // eslint-disable-next-line no-var
  var __vmsCronStarted: boolean | undefined;
  // eslint-disable-next-line no-var
  var __vmsCronTasks: ScheduledTask[] | undefined;
}

export function startShiftSchedulerDaemon(): { started: boolean } {
  if (global.__vmsCronStarted) {
    return { started: false };
  }
  global.__vmsCronStarted = true;

  const opts = { timezone: 'Europe/Istanbul' };
  const tasks: ScheduledTask[] = [
    cron.schedule('0 9 * * *', () => void runShift('morning', 'cron'), opts),
    cron.schedule('30 12 * * *', () => void runShift('midday', 'cron'), opts),
    cron.schedule('0 16 * * *', () => void runShift('afternoon', 'cron'), opts),
    cron.schedule('0 22 * * *', () => void runShift('night', 'cron'), opts),
    // Every 30 minutes while VM is awake, verify no shift was missed after a VM pause/resume!
    cron.schedule('*/30 * * * *', () => void catchUpMissedShifts('catchup'), opts),
  ];

  global.__vmsCronTasks = tasks;
  return { started: true };
}
