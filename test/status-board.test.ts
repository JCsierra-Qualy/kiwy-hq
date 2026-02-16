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

test('POST /status persists one-sentence statuses and dashboard renders them', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kiwy-hq-status-'));
  const statusPath = path.join(tmpDir, 'hq-status.json');

  const prevStatusPath = process.env.KIWY_HQ_STATUS_PATH;
  process.env.KIWY_HQ_STATUS_PATH = statusPath;

  const app = createApp();
  const server = app.listen(0);
  const addr = server.address();
  assert.equal(typeof addr, 'object');
  const port = (addr as any).port as number;

  const qualiver = 'Pilot validations closed; moving into rollout checklist.';
  const echo = 'Inbox triage is stable and alert routing will be tuned tomorrow.';

  const postRes = await request(port, {
    method: 'POST',
    path: '/status',
    headers: {
      cookie: 'kiwy_hq_auth=1',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: `qualiver=${encodeURIComponent(qualiver)}&echo=${encodeURIComponent(echo)}&kuenti=${encodeURIComponent('Docs cleanup complete this sprint.')}&personal=${encodeURIComponent('Personal ops are calm and under control.')}`,
  });

  assert.equal(postRes.statusCode, 302);
  assert.equal(postRes.headers.location, '/status?saved=1');

  const raw = await fs.readFile(statusPath, 'utf8');
  assert.match(raw, /"qualiver"/);
  assert.match(raw, /"echo"/);
  assert.match(raw, /"updatedAt"/);

  const stat = await fs.stat(statusPath);
  assert.equal(stat.mode & 0o777, 0o600);

  const dashboardRes = await request(port, {
    method: 'GET',
    path: '/',
    headers: { cookie: 'kiwy_hq_auth=1' },
  });

  server.close();
  process.env.KIWY_HQ_STATUS_PATH = prevStatusPath;

  assert.equal(dashboardRes.statusCode, 200);
  assert.match(dashboardRes.body, /Macro project status/);
  assert.match(dashboardRes.body, new RegExp(qualiver.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(dashboardRes.body, new RegExp(echo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
