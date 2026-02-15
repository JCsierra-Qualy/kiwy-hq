import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server';
import http, { type IncomingMessage } from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

function readBody(res: IncomingMessage) {
  return new Promise<string>((resolve) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', () => resolve(data));
  });
}

function request(
  port: number,
  opts: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: string;
  },
) {
  return new Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }>(
    (resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          method: opts.method,
          path: opts.path,
          headers: opts.headers,
        },
        async (res) => {
          const body = await readBody(res);
          resolve({ statusCode: res.statusCode || 0, headers: res.headers, body });
        },
      );
      req.on('error', reject);
      if (opts.body) req.write(opts.body);
      req.end();
    },
  );
}

test('POST /secrets writes data/secrets.json with chmod 600 and UI never shows raw secrets', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kiwy-hq-'));
  const secretsPath = path.join(tmpDir, 'secrets.json');

  const prevSecretsPath = process.env.KIWY_HQ_SECRETS_PATH;
  process.env.KIWY_HQ_SECRETS_PATH = secretsPath;

  const app = createApp();
  const server = app.listen(0);
  const addr = server.address();
  assert.equal(typeof addr, 'object');
  const port = (addr as any).port as number;

  const appsheetKey = 'appsheet-1234567890-SECRET';
  const n8nKey = 'n8n-abcdef1234567890-SECRET';

  const postRes = await request(port, {
    method: 'POST',
    path: '/secrets',
    headers: {
      cookie: 'kiwy_hq_auth=1',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: `appsheetKey=${encodeURIComponent(appsheetKey)}&n8nKey=${encodeURIComponent(n8nKey)}`,
  });

  assert.equal(postRes.statusCode, 302);
  assert.equal(postRes.headers.location, '/secrets?saved=1');

  const raw = await fs.readFile(secretsPath, 'utf8');
  assert.match(raw, /"appsheetKey"/);
  assert.match(raw, /"n8nKey"/);
  assert.match(raw, /"updatedAt"/);
  assert.match(raw, /"fieldUpdatedAt"/);
  assert.match(raw, /"appsheetKey"/);
  assert.match(raw, /"n8nKey"/);
  assert.match(raw, new RegExp(appsheetKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(raw, new RegExp(n8nKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  const stat = await fs.stat(secretsPath);
  // Linux best-effort: should be 600
  assert.equal(stat.mode & 0o777, 0o600);

  const getRes = await request(port, {
    method: 'GET',
    path: '/secrets',
    headers: { cookie: 'kiwy_hq_auth=1' },
  });

  server.close();
  process.env.KIWY_HQ_SECRETS_PATH = prevSecretsPath;

  assert.equal(getRes.statusCode, 200);

  // Full secrets must never be rendered in HTML.
  assert.doesNotMatch(getRes.body, new RegExp(appsheetKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(getRes.body, new RegExp(n8nKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  // UI shows set status but never the secret itself (masked or raw).
  assert.match(getRes.body, /Set/);
});
