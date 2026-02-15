#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repo = process.argv[2] || 'JCsierra-Qualy/kiwy-hq';
const head = process.argv[3] || 'kiwy/hq-glass-neon';
const base = process.argv[4] || 'main';

const secretsPath = process.env.KIWY_HQ_SECRETS_PATH || path.join(process.cwd(), 'data', 'secrets.json');

let secrets;
try {
  secrets = JSON.parse(await fs.readFile(secretsPath, 'utf8'));
} catch (e) {
  console.error(`Could not read secrets file at ${secretsPath}. Save GitHub PAT in HQ /secrets first.`);
  process.exit(2);
}

const token = typeof secrets.githubPat === 'string' ? secrets.githubPat.trim() : '';
if (!token) {
  console.error('Missing githubPat in secrets. Add it in HQ → Secrets.');
  process.exit(2);
}

const env = {
  ...process.env,
  GH_TOKEN: token,
};

const title = 'Kiwy HQ: glass/neon UI + vault';
const body = 'MVP HQ + UI glass/neon. Includes token auth, protected routes, and vault/secrets stored locally (masked, chmod 600 best-effort). Tested: npm run build, npm test.';

const args = [
  'pr',
  'create',
  '--repo',
  repo,
  '--head',
  head,
  '--base',
  base,
  '--title',
  title,
  '--body',
  body,
];

const out = spawnSync('gh', args, { env, stdio: 'inherit' });
process.exit(out.status ?? 1);
