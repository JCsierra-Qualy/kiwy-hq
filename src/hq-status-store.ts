import { kvRead, kvWrite } from './kv';

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
const KEY = 'kiwy:hq-status';

function sanitizeSentence(input: unknown): string {
  if (typeof input !== 'string') return EMPTY_SENTENCE;
  const s = input.trim().replace(/\s+/g, ' ');
  if (!s) return EMPTY_SENTENCE;
  return s.slice(0, 220);
}

export async function readHqStatus(): Promise<HqStatusData> {
  const data = await kvRead<Record<string, unknown>>(KEY);
  if (!data) {
    return {
      qualiver: EMPTY_SENTENCE,
      echo: EMPTY_SENTENCE,
      kuenti: EMPTY_SENTENCE,
      personal: EMPTY_SENTENCE,
      updatedAt: new Date(0).toISOString(),
      fieldUpdatedAt: {},
    };
  }
  return {
    qualiver: sanitizeSentence(data.qualiver),
    echo: sanitizeSentence(data.echo),
    kuenti: sanitizeSentence(data.kuenti),
    personal: sanitizeSentence(data.personal),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date(0).toISOString(),
    fieldUpdatedAt:
      data.fieldUpdatedAt && typeof data.fieldUpdatedAt === 'object'
        ? (data.fieldUpdatedAt as Partial<Record<MacroProjectKey, string>>)
        : {},
  };
}

export async function writeHqStatus(
  update: Partial<Record<MacroProjectKey, string>>,
): Promise<HqStatusData> {
  const existing = await readHqStatus();
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

  await kvWrite(KEY, next);
  return next;
}
