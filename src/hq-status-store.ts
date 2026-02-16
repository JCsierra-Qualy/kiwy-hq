import fs from 'node:fs/promises';
import path from 'node:path';

export type MacroProjectKey = 'qualiver' | 'echo' | 'kuenti' | 'personal';

export type HqStatusData = {
  qualiver: string;
  echo: string;
  kuenti: string;
  personal: string;
  updatedAt: string;
  fieldUpdatedAt?: Partial<Record<MacroProjectKey, string>>;
};

const EMPTY_SENTENCE = 'No status yet.';

export function getHqStatusFilePath() {
  return process.env.KIWY_HQ_STATUS_PATH || path.join(process.cwd(), 'data', 'hq-status.json');
}

function sanitizeSentence(input: unknown): string {
  if (typeof input !== 'string') return EMPTY_SENTENCE;
  const s = input.trim().replace(/\s+/g, ' ');
  if (!s) return EMPTY_SENTENCE;
  return s.slice(0, 220);
}

export async function readHqStatus(filePath = getHqStatusFilePath()): Promise<HqStatusData> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    return {
      qualiver: sanitizeSentence(parsed.qualiver),
      echo: sanitizeSentence(parsed.echo),
      kuenti: sanitizeSentence(parsed.kuenti),
      personal: sanitizeSentence(parsed.personal),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
      fieldUpdatedAt:
        parsed.fieldUpdatedAt && typeof parsed.fieldUpdatedAt === 'object'
          ? (parsed.fieldUpdatedAt as Partial<Record<MacroProjectKey, string>>)
          : {},
    };
  } catch (err: unknown) {
    const code = typeof err === 'object' && err && 'code' in err ? (err as any).code : undefined;
    if (code !== 'ENOENT') throw err;

    return {
      qualiver: EMPTY_SENTENCE,
      echo: EMPTY_SENTENCE,
      kuenti: EMPTY_SENTENCE,
      personal: EMPTY_SENTENCE,
      updatedAt: new Date(0).toISOString(),
      fieldUpdatedAt: {},
    };
  }
}

export async function writeHqStatus(
  update: Partial<Record<MacroProjectKey, string>>,
  filePath = getHqStatusFilePath(),
): Promise<HqStatusData> {
  const existing = await readHqStatus(filePath);
  const now = new Date().toISOString();

  const next: HqStatusData = {
    ...existing,
    updatedAt: now,
    fieldUpdatedAt: { ...(existing.fieldUpdatedAt || {}) },
  };

  (['qualiver', 'echo', 'kuenti', 'personal'] as const).forEach((k) => {
    if (!(k in update)) return;
    next[k] = sanitizeSentence(update[k]);
    next.fieldUpdatedAt![k] = now;
  });

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(next, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  await fs.rename(tmpPath, filePath);

  try {
    await fs.chmod(filePath, 0o600);
  } catch {
    // ignore on unsupported fs
  }

  return next;
}
