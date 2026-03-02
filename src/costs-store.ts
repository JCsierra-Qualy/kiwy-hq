import { kvRead, kvWrite } from './kv';

export type DailyCost = {
  date: string; // YYYY-MM-DD
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  model?: string;
};

export type CostsConfig = {
  model: string;
  inputPricePerMTok: number;   // $ por millón de tokens de entrada
  outputPricePerMTok: number;  // $ por millón de tokens de salida
  monthlyBudgetUsd: number;
  dailyTokenWarning: number;   // threshold para advertencia
};

export type CostsData = {
  daily: DailyCost[];
  config: CostsConfig;
  updatedAt: string;
};

const DEFAULT_CONFIG: CostsConfig = {
  model: 'openai-codex/gpt-5.3-codex',
  inputPricePerMTok: 3.0,
  outputPricePerMTok: 15.0,
  monthlyBudgetUsd: 50,
  dailyTokenWarning: 80000,
};

const KEY = 'kiwy:costs';

export async function readCosts(): Promise<CostsData> {
  const data = await kvRead<CostsData>(KEY);
  if (!data) return { daily: [], config: { ...DEFAULT_CONFIG }, updatedAt: new Date(0).toISOString() };
  return {
    daily: Array.isArray(data.daily) ? data.daily : [],
    config: { ...DEFAULT_CONFIG, ...(data.config ?? {}) },
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  };
}

async function persist(data: CostsData): Promise<void> {
  data.updatedAt = new Date().toISOString();
  await kvWrite(KEY, data);
}

export function calcCost(inputTokens: number, outputTokens: number, config: CostsConfig): number {
  return (inputTokens / 1_000_000) * config.inputPricePerMTok
       + (outputTokens / 1_000_000) * config.outputPricePerMTok;
}

export async function upsertDailyCost(
  entry: Omit<DailyCost, 'costUsd'> & { costUsd?: number },
): Promise<CostsData> {
  const data = await readCosts();
  const cost = entry.costUsd ?? calcCost(entry.inputTokens, entry.outputTokens, data.config);
  const idx = data.daily.findIndex((d) => d.date === entry.date);
  const record: DailyCost = { ...entry, costUsd: cost };
  if (idx !== -1) {
    const prev = data.daily[idx];
    data.daily[idx] = {
      date: entry.date,
      inputTokens: (prev.inputTokens || 0) + (entry.inputTokens || 0),
      outputTokens: (prev.outputTokens || 0) + (entry.outputTokens || 0),
      totalTokens: (prev.totalTokens || 0) + (entry.totalTokens || 0),
      costUsd: (prev.costUsd || 0) + cost,
      model: entry.model || prev.model,
    };
  } else {
    data.daily.push(record);
  }
  data.daily.sort((a, b) => b.date.localeCompare(a.date));
  await persist(data);
  return data;
}

export async function updateCostsConfig(update: Partial<CostsConfig>): Promise<CostsData> {
  const data = await readCosts();
  data.config = { ...data.config, ...update };
  await persist(data);
  return data;
}

/** Suma de costos para el mes actual (YYYY-MM) */
export function monthlyTotals(daily: DailyCost[], yearMonth: string) {
  const rows = daily.filter((d) => d.date.startsWith(yearMonth));
  return {
    inputTokens: rows.reduce((s, r) => s + r.inputTokens, 0),
    outputTokens: rows.reduce((s, r) => s + r.outputTokens, 0),
    totalTokens: rows.reduce((s, r) => s + r.totalTokens, 0),
    costUsd: rows.reduce((s, r) => s + r.costUsd, 0),
    days: rows.length,
  };
}
