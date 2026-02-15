import fs from 'node:fs/promises';
import path from 'node:path';

export type StoredSecrets = {
  appsheetKey?: string;
  n8nKey?: string;
  updatedAt: string;
};

export function getSecretsFilePath() {
  return process.env.KIWY_HQ_SECRETS_PATH || path.join(process.cwd(), 'data', 'secrets.json');
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
    if (typeof obj.n8nKey === 'string') stored.n8nKey = obj.n8nKey;

    return stored;
  } catch (err: unknown) {
    const code = typeof err === 'object' && err && 'code' in err ? (err as any).code : undefined;
    if (code === 'ENOENT') return null;
    throw err;
  }
}

export async function writeSecrets(
  update: { appsheetKey?: string; n8nKey?: string },
  filePath = getSecretsFilePath(),
) {
  const existing = (await readSecrets(filePath)) || { updatedAt: new Date(0).toISOString() };

  const next: StoredSecrets = {
    updatedAt: new Date().toISOString(),
    appsheetKey: typeof update.appsheetKey === 'string' ? update.appsheetKey : existing.appsheetKey,
    n8nKey: typeof update.n8nKey === 'string' ? update.n8nKey : existing.n8nKey,
  };

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
