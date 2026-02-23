import fs from 'node:fs/promises';
import path from 'node:path';
import { readSecrets } from './secrets-store';

export type CredentialItem = {
  key: string;
  label: string;
  value: string;
  source: 'legacy-secrets' | 'env' | 'manual';
  updatedAt: string;
};

type CredentialDb = {
  updatedAt: string;
  items: CredentialItem[];
};

export function getCredentialsFilePath() {
  return process.env.KIWY_HQ_CREDENTIALS_PATH || path.join(process.cwd(), 'data', 'credentials.json');
}

export async function readCredentials(filePath = getCredentialsFilePath()): Promise<CredentialDb> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as CredentialDb;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) {
      return { updatedAt: new Date(0).toISOString(), items: [] };
    }
    return parsed;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return { updatedAt: new Date(0).toISOString(), items: [] };
    throw err;
  }
}

async function writeDb(db: CredentialDb, filePath = getCredentialsFilePath()) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  await fs.rename(tmp, filePath);
  try { await fs.chmod(filePath, 0o600); } catch {}
}

export async function upsertCredential(input: Omit<CredentialItem, 'updatedAt'>, filePath = getCredentialsFilePath()) {
  const db = await readCredentials(filePath);
  const now = new Date().toISOString();
  const idx = db.items.findIndex((x) => x.key === input.key);
  const nextItem: CredentialItem = { ...input, updatedAt: now };
  if (idx >= 0) db.items[idx] = nextItem;
  else db.items.push(nextItem);
  db.updatedAt = now;
  await writeDb(db, filePath);
  return db;
}

export async function clearCredential(key: string, filePath = getCredentialsFilePath()) {
  const db = await readCredentials(filePath);
  db.items = db.items.filter((x) => x.key !== key);
  db.updatedAt = new Date().toISOString();
  await writeDb(db, filePath);
  return db;
}

const ENV_CANDIDATES = [
  'MATON_API_KEY',
  'OPENAI_API_KEY',
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'N8N_API_KEY',
  'GOOGLE_API_KEY',
  'ANTHROPIC_API_KEY',
];

export async function importKnownCredentials(filePath = getCredentialsFilePath()) {
  const legacy = await readSecrets();

  const discovered: Array<Omit<CredentialItem, 'updatedAt'>> = [];

  const push = (key: string, label: string, value: string | undefined, source: CredentialItem['source']) => {
    if (!value || !value.trim()) return;
    discovered.push({ key, label, value: value.trim(), source });
  };

  push('appsheet.app_id', 'AppSheet App ID', legacy?.appsheetAppId, 'legacy-secrets');
  push('appsheet.crm_key', 'AppSheet CRM Key', legacy?.appsheetCrmKey, 'legacy-secrets');
  push('appsheet.ops_key', 'AppSheet Ops Key', legacy?.appsheetOpsKey, 'legacy-secrets');
  push('appsheet.legacy_key', 'AppSheet Legacy Key', legacy?.appsheetKey, 'legacy-secrets');
  push('appsheet.region', 'AppSheet Region', legacy?.appsheetRegion, 'legacy-secrets');
  push('n8n.api_key', 'n8n API Key', legacy?.n8nKey, 'legacy-secrets');
  push('github.pat', 'GitHub PAT', legacy?.githubPat, 'legacy-secrets');

  for (const envName of ENV_CANDIDATES) {
    push(`env.${envName.toLowerCase()}`, envName, process.env[envName], 'env');
  }

  let db = await readCredentials(filePath);
  for (const item of discovered) {
    db = await upsertCredential(item, filePath);
  }
  return db;
}

export function maskValue(v: string) {
  const t = (v || '').trim();
  if (!t) return '';
  if (t.length <= 8) return '••••••••';
  return `${t.slice(0, 4)}...${t.slice(-4)}`;
}
