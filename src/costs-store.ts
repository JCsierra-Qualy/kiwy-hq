import fs from 'node:fs/promises';
import path from 'node:path';

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
  model: 'claude-sonnet-4-6',
  inputPricePerMTok: 3.0,
  outputPricePerMTok: 15.0,
  monthlyBudgetUsd: 50,
  dailyTokenWarning: 80000,
};

function dataDir() {
  return process.env.VERCEL === '1' ? '/tmp/kiwy-data' : path.join(process.cwd(), 'data');
}

export function getCostsFilePath(): string {
  return process.env.KIWY_HQ_COSTS_PATH || path.join(dataDir(), 'costs.json');
}

export async function readCosts(filePath = getCostsFilePath()): Promise<CostsData> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const p = JSON.parse(raw) as CostsData;
    return {
      daily: Array.isArray(p.daily) ? p.daily : [],
      config: { ...DEFAULT_CONFIG, ...(p.config ?? {}) },
      updatedAt: p.updatedAt ?? new Date().toISOString(),
    };
  } catch (err: unknown) {
    const code = typeof err === 'object' && err && 'code' in err ? (err as any).code : undefined;
    if (code !== 'ENOENT') throw err;
    return { daily: [], config: { ...DEFAULT_CONFIG }, updatedAt: new Date(0).toISOString() };
  }
}

async function persist(data: CostsData, filePath: string): Promise<void> {
  data.updatedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  await fs.rename(tmp, filePath);
}

export function calcCost(inputTokens: number, outputTokens: number, config: CostsConfig): number {
  return (inputTokens / 1_000_000) * config.inputPricePerMTok
       + (outputTokens / 1_000_000) * config.outputPricePerMTok;
}

export async function upsertDailyCost(
  entry: Omit<DailyCost, 'costUsd'> & { costUsd?: number },
  filePath = getCostsFilePath(),
): Promise<CostsData> {
  const data = await readCosts(filePath);
  const cost = entry.costUsd ?? calcCost(entry.inputTokens, entry.outputTokens, data.config);
  const idx = data.daily.findIndex((d) => d.date === entry.date);
  const record: DailyCost = { ...entry, costUsd: cost };
  if (idx !== -1) data.daily[idx] = record;
  else data.daily.push(record);
  data.daily.sort((a, b) => b.date.localeCompare(a.date));
  await persist(data, filePath);
  return data;
}

export async function updateCostsConfig(
  update: Partial<CostsConfig>,
  filePath = getCostsFilePath(),
): Promise<CostsData> {
  const data = await readCosts(filePath);
  data.config = { ...data.config, ...update };
  await persist(data, filePath);
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
