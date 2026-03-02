import { kvRead, kvWrite } from './kv';

export type SecretsField =
  | 'appsheetKey'
  | 'appsheetCrmKey'
  | 'appsheetOpsKey'
  | 'appsheetAppId'
  | 'appsheetRegion'
  | 'n8nKey'
  | 'githubPat';

export type StoredSecrets = {
  // AppSheet
  appsheetKey?: string; // legacy (single key)
  appsheetCrmKey?: string;
  appsheetOpsKey?: string;
  appsheetAppId?: string;
  appsheetRegion?: string; // e.g. www.appsheet.com | eu.appsheet.com | asia-southeast.appsheet.com

  // n8n
  n8nKey?: string;

  // GitHub
  githubPat?: string;

  /** When anything in this file last changed (writeSecrets call). */
  updatedAt: string;

  /** Per-field last-updated (set/clear). Never contains raw secret values. */
  fieldUpdatedAt?: Partial<Record<SecretsField, string>>;
};

const KEY = 'kiwy:secrets';

function isStringRecord(v: unknown): v is Record<string, string> {
  if (!v || typeof v !== 'object') return false;
  for (const val of Object.values(v as Record<string, unknown>)) {
    if (typeof val !== 'string') return false;
  }
  return true;
}

export async function readSecrets(): Promise<StoredSecrets | null> {
  const raw = await kvRead<Record<string, unknown>>(KEY);
  if (!raw || typeof raw !== 'object') return null;

  const stored: StoredSecrets = {
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString(),
  };

  if (typeof raw.appsheetKey === 'string') stored.appsheetKey = raw.appsheetKey;
  if (typeof raw.appsheetCrmKey === 'string') stored.appsheetCrmKey = raw.appsheetCrmKey;
  if (typeof raw.appsheetOpsKey === 'string') stored.appsheetOpsKey = raw.appsheetOpsKey;
  if (typeof raw.appsheetAppId === 'string') stored.appsheetAppId = raw.appsheetAppId;
  if (typeof raw.appsheetRegion === 'string') stored.appsheetRegion = raw.appsheetRegion;
  if (typeof raw.n8nKey === 'string') stored.n8nKey = raw.n8nKey;
  if (typeof raw.githubPat === 'string') stored.githubPat = raw.githubPat;

  if (isStringRecord(raw.fieldUpdatedAt)) {
    stored.fieldUpdatedAt = raw.fieldUpdatedAt as any;
  }

  return stored;
}

type SecretsUpdate = Partial<Record<SecretsField, string | null>>;

export async function writeSecrets(update: SecretsUpdate): Promise<StoredSecrets> {
  const existing = (await readSecrets()) || { updatedAt: new Date(0).toISOString() };
  const now = new Date().toISOString();

  const next: StoredSecrets = {
    updatedAt: now,
    fieldUpdatedAt: { ...(existing.fieldUpdatedAt || {}) },
    appsheetKey: existing.appsheetKey,
    appsheetCrmKey: existing.appsheetCrmKey,
    appsheetOpsKey: existing.appsheetOpsKey,
    appsheetAppId: existing.appsheetAppId,
    appsheetRegion: existing.appsheetRegion,
    n8nKey: existing.n8nKey,
    githubPat: existing.githubPat,
  };

  const apply = (field: SecretsField) => {
    if (!(field in update)) return;
    const val = update[field];
    if (typeof val === 'string') {
      (next as any)[field] = val;
      next.fieldUpdatedAt![field] = now;
      return;
    }
    if (val === null) {
      delete (next as any)[field];
      next.fieldUpdatedAt![field] = now;
    }
  };

  apply('appsheetKey');
  apply('appsheetCrmKey');
  apply('appsheetOpsKey');
  apply('appsheetAppId');
  apply('appsheetRegion');
  apply('n8nKey');
  apply('githubPat');

  await kvWrite(KEY, next);
  return next;
}

export function maskSecret(value: string | undefined) {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}
