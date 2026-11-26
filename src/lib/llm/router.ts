import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { agents, agentTasks, systemSettings } from '@/db/schema';

export type GeminiModelId =
  | 'gemini-4-carbon'
  | 'gemini-4-neon'
  | 'gemini-4-hydrogen'
  | 'gemini-3.8-flash'
  | 'gemini-3.5-flash-lite';

export type ThinkingLevel = 'low' | 'medium' | 'high' | 'xhigh';

export interface LlmRequest {
  agentId: string;
  systemPrompt: string;
  userPrompt: string;
  preferredModel?: GeminiModelId;
  thinkingLevel?: ThinkingLevel;
  fallbackGenerator: () => string;
}

export interface LlmResponse {
  text: string;
  executionMode: 'antigravity_native' | 'gemini_api';
  modelUsed: string;
  tokensUsed: number;
  costUsd: number;
  fallbackReason?: string;
}

const MODEL_PRICING_PER_1M: Record<string, { inUsd: number; outUsd: number }> = {
  'gemini-4-carbon': { inUsd: 2.0, outUsd: 10.0 },
  'gemini-4-neon': { inUsd: 3.0, outUsd: 15.0 },
  'gemini-4-hydrogen': { inUsd: 1.5, outUsd: 7.5 },
  'gemini-3.8-flash': { inUsd: 0.75, outUsd: 3.75 },
  'gemini-3.5-flash-lite': { inUsd: 0.3, outUsd: 2.5 },
};

export function getIstanbulDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getTodayAgentSpendUsd(agentId?: string): number {
  const db = getDb();
  const todayPrefix = getIstanbulDateString();
  if (agentId) {
    const row = db
      .select({ total: sql<number>`COALESCE(SUM(${agentTasks.costUsd}), 0)` })
      .from(agentTasks)
      .where(sql`${agentTasks.agentId} = ${agentId} AND substr(${agentTasks.createdAt}, 1, 10) = ${todayPrefix}`)
      .get();
    return Number(row?.total ?? 0);
  }
  const row = db
    .select({ total: sql<number>`COALESCE(SUM(${agentTasks.costUsd}), 0)` })
    .from(agentTasks)
    .where(sql`substr(${agentTasks.createdAt}, 1, 10) = ${todayPrefix}`)
    .get();
  return Number(row?.total ?? 0);
}

export function resolveConfiguredGeminiKey(): string {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 10) {
    return process.env.GEMINI_API_KEY.trim();
  }
  const db = getDb();
  const row = db.select().from(systemSettings).where(eq(systemSettings.key, 'gemini_api_key')).get();
  return row?.value?.trim() || '';
}

async function callGeminiEndpoint(
  apiKey: string,
  model: GeminiModelId,
  systemPrompt: string,
  userPrompt: string,
  thinkingLevel: ThinkingLevel
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body: Record<string, unknown> = {
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      thinkingConfig: {
        thinkingLevel: model === 'gemini-4-carbon' && thinkingLevel === 'xhigh' ? 'high' : thinkingLevel,
      },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    const error = new Error(`Gemini API HTTP ${res.status}: ${errBody.slice(0, 240)}`) as Error & {
      status?: number;
    };
    error.status = res.status;
    throw error;
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  };

  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || '')
      .join('\n')
      .trim() || '';

  if (!text) {
    throw new Error('Gemini API boş yanıt döndürdü.');
  }

  const inputTokens = data.usageMetadata?.promptTokenCount ?? 400;
  const outputTokens =
    (data.usageMetadata?.candidatesTokenCount ?? 300) + (data.usageMetadata?.thoughtsTokenCount ?? 0);

  return { text, inputTokens, outputTokens };
}

export async function runAgentIntelligence(req: LlmRequest): Promise<LlmResponse> {
  const db = getDb();
  const agentRow = db.select().from(agents).where(eq(agents.id, req.agentId)).get();
  const modelToTry = (req.preferredModel || agentRow?.modelId || 'gemini-4-hydrogen') as GeminiModelId;
  const thinkingLevel = (req.thinkingLevel || agentRow?.thinkingLevel || 'high') as ThinkingLevel;

  const totalCapRow = db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'daily_total_budget_usd'))
    .get();
  const dailyTotalCap = Number(totalCapRow?.value || '3.0');
  const agentDailyCap = agentRow?.dailyBudgetUsd ?? 1.5;

  const currentTotalSpend = getTodayAgentSpendUsd();
  const currentAgentSpend = getTodayAgentSpendUsd(req.agentId);

  const apiKey = resolveConfiguredGeminiKey();

  // Default Mode: Antigravity-Native Zero-API-Key Execution
  if (!apiKey) {
    return {
      text: req.fallbackGenerator(),
      executionMode: 'antigravity_native',
      modelUsed: `antigravity-native (${modelToTry})`,
      tokensUsed: 0,
      costUsd: 0,
    };
  }

  // Quota & Budget Circuit Breaker
  if (currentTotalSpend >= dailyTotalCap || currentAgentSpend >= agentDailyCap) {
    return {
      text: req.fallbackGenerator(),
      executionMode: 'antigravity_native',
      modelUsed: `budget-shield-fallback (${modelToTry})`,
      tokensUsed: 0,
      costUsd: 0,
      fallbackReason: `Günlük bütçe kalkanı devrede (Toplam: $${currentTotalSpend.toFixed(2)} / Limit: $${dailyTotalCap.toFixed(2)})`,
    };
  }

  try {
    const res = await callGeminiEndpoint(apiKey, modelToTry, req.systemPrompt, req.userPrompt, thinkingLevel);
    const rate = MODEL_PRICING_PER_1M[modelToTry] || MODEL_PRICING_PER_1M['gemini-4-hydrogen'];
    const costUsd = (res.inputTokens * rate.inUsd + res.outputTokens * rate.outUsd) / 1_000_000;

    return {
      text: res.text,
      executionMode: 'gemini_api',
      modelUsed: modelToTry,
      tokensUsed: res.inputTokens + res.outputTokens,
      costUsd,
    };
  } catch (err) {
    const status = (err as { status?: number })?.status;
    // Free-Tier graceful downgrade: Carbon/Neon -> Hydrogen (xhigh)
    if (
      (modelToTry === 'gemini-4-carbon' || modelToTry === 'gemini-4-neon') &&
      (status === 400 || status === 403 || status === 429)
    ) {
      try {
        const fallbackModel: GeminiModelId = 'gemini-4-hydrogen';
        const res = await callGeminiEndpoint(apiKey, fallbackModel, req.systemPrompt, req.userPrompt, 'xhigh');
        return {
          text: res.text,
          executionMode: 'gemini_api',
          modelUsed: `${fallbackModel} (free-tier-auto)`,
          tokensUsed: res.inputTokens + res.outputTokens,
          costUsd: 0,
          fallbackReason: `${modelToTry} kredili katman gerektirdiği için ücretsiz gemini-4-hydrogen (xhigh) modeline geçildi.`,
        };
      } catch {
        // Fall through to native deterministic engine
      }
    }

    return {
      text: req.fallbackGenerator(),
      executionMode: 'antigravity_native',
      modelUsed: `antigravity-native-fallback (${modelToTry})`,
      tokensUsed: 0,
      costUsd: 0,
      fallbackReason: err instanceof Error ? err.message : 'Bilinmeyen bağlantı hatası',
    };
  }
}
