import fs from 'node:fs/promises';
import path from 'node:path';

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

export function getSecretsFilePath() {
  return process.env.KIWY_HQ_SECRETS_PATH || path.join(process.cwd(), 'data', 'secrets.json');
}

function isStringRecord(v: unknown): v is Record<string, string> {
  if (!v || typeof v !== 'object') return false;
  for (const val of Object.values(v as Record<string, unknown>)) {
    if (typeof val !== 'string') return false;
  }
  return true;
}

export async function readSecrets(filePath = getSecretsFilePath()): Promise<StoredSecrets | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;

    const obj = parsed as Record<string, unknown>;
    const stored: StoredSecrets = {
      updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date(0).toISOString(),
    };

    if (typeof obj.appsheetKey === 'string') stored.appsheetKey = obj.appsheetKey;
    if (typeof obj.appsheetCrmKey === 'string') stored.appsheetCrmKey = obj.appsheetCrmKey;
    if (typeof obj.appsheetOpsKey === 'string') stored.appsheetOpsKey = obj.appsheetOpsKey;
    if (typeof obj.appsheetAppId === 'string') stored.appsheetAppId = obj.appsheetAppId;
    if (typeof obj.appsheetRegion === 'string') stored.appsheetRegion = obj.appsheetRegion;

    if (typeof obj.n8nKey === 'string') stored.n8nKey = obj.n8nKey;

    if (typeof obj.githubPat === 'string') stored.githubPat = obj.githubPat;

    if (isStringRecord(obj.fieldUpdatedAt)) {
      stored.fieldUpdatedAt = obj.fieldUpdatedAt as any;
    }

    return stored;
  } catch (err: unknown) {
    const code = typeof err === 'object' && err && 'code' in err ? (err as any).code : undefined;
    if (code === 'ENOENT') return null;
    throw err;
  }
}

type SecretsUpdate = Partial<Record<SecretsField, string | null>>;

export async function writeSecrets(update: SecretsUpdate, filePath = getSecretsFilePath()) {
  const existing = (await readSecrets(filePath)) || { updatedAt: new Date(0).toISOString() };
  const now = new Date().toISOString();

  const next: StoredSecrets = {
    updatedAt: now,
    fieldUpdatedAt: { ...(existing.fieldUpdatedAt || {}) },

    // AppSheet
    appsheetKey: existing.appsheetKey,
    appsheetCrmKey: existing.appsheetCrmKey,
    appsheetOpsKey: existing.appsheetOpsKey,
    appsheetAppId: existing.appsheetAppId,
    appsheetRegion: existing.appsheetRegion,

    // n8n
    n8nKey: existing.n8nKey,

    // GitHub
    githubPat: existing.githubPat,
  };

  const apply = (field: SecretsField) => {
    if (!(field in update)) return;
    const val = update[field];

    if (typeof val === 'string') {
      // Set/update
      (next as any)[field] = val;
      next.fieldUpdatedAt![field] = now;
      return;
    }

    // Explicit clear
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

  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(next, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  });
  await fs.rename(tmpPath, filePath);

  try {
    await fs.chmod(filePath, 0o600);
  } catch {
    // ignore (best-effort)
  }

  return next;
}

export function maskSecret(value: string | undefined) {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  // Always first4...last4 (best-effort for short strings)
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}
