import { kvRead, kvWrite } from './kv';
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

const KEY = 'kiwy:credentials';

export async function readCredentials(): Promise<CredentialDb> {
  const data = await kvRead<CredentialDb>(KEY);
  if (!data || !Array.isArray(data.items)) {
    return { updatedAt: new Date(0).toISOString(), items: [] };
  }
  return data;
}

async function writeDb(db: CredentialDb): Promise<void> {
  await kvWrite(KEY, db);
}

export async function upsertCredential(input: Omit<CredentialItem, 'updatedAt'>): Promise<CredentialDb> {
  const db = await readCredentials();
  const now = new Date().toISOString();
  const idx = db.items.findIndex((x) => x.key === input.key);
  const nextItem: CredentialItem = { ...input, updatedAt: now };
  if (idx >= 0) db.items[idx] = nextItem;
  else db.items.push(nextItem);
  db.updatedAt = now;
  await writeDb(db);
  return db;
}

export async function clearCredential(key: string): Promise<CredentialDb> {
  const db = await readCredentials();
  db.items = db.items.filter((x) => x.key !== key);
  db.updatedAt = new Date().toISOString();
  await writeDb(db);
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

export async function importKnownCredentials(): Promise<CredentialDb> {
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

  let db = await readCredentials();
  for (const item of discovered) {
    db = await upsertCredential(item);
  }
  return db;
}

export function maskValue(v: string) {
  const t = (v || '').trim();
  if (!t) return '';
  if (t.length <= 8) return '••••••••';
  return `${t.slice(0, 4)}...${t.slice(-4)}`;
}
