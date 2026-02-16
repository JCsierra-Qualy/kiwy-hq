import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server';
import http, { type IncomingMessage } from 'node:http';

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

function expectShell(html: string) {
  assert.match(html, /data-kiwy-shell="v2"/);
  assert.match(html, /<h1>\s*Kiwy HQ\s*<\/h1>/);
  assert.match(html, /<nav[^>]*aria-label="Primary"/);
  assert.match(html, /<a[^>]*href="\/"[^>]*>Dashboard<\/a>/);
  assert.match(html, /<a[^>]*href="\/status"[^>]*>Project status<\/a>/);
  assert.match(html, /<a[^>]*href="\/secrets"[^>]*>Secrets<\/a>/);
}

test('Authenticated pages share the Kiwy shell layout and navigation', async () => {
  const app = createApp();
  const server = app.listen(0);
  const addr = server.address();
  assert.equal(typeof addr, 'object');
  const port = (addr as any).port as number;

  const dashboardRes = await request(port, {
    method: 'GET',
    path: '/',
    headers: { cookie: 'kiwy_hq_auth=1' },
  });

  const secretsRes = await request(port, {
    method: 'GET',
    path: '/secrets',
    headers: { cookie: 'kiwy_hq_auth=1' },
  });

  server.close();

  assert.equal(dashboardRes.statusCode, 200);
  assert.equal(secretsRes.statusCode, 200);

  expectShell(dashboardRes.body);
  expectShell(secretsRes.body);
});

test('Secrets page does not render sensitive values', async () => {
  const prev = process.env.KIWY_HQ_TOKEN;
  process.env.KIWY_HQ_TOKEN = 'super-secret-token';

  const app = createApp();
  const server = app.listen(0);
  const addr = server.address();
  assert.equal(typeof addr, 'object');
  const port = (addr as any).port as number;

  const res = await request(port, {
    method: 'GET',
    path: '/secrets',
    headers: { cookie: 'kiwy_hq_auth=1' },
  });

  server.close();
  process.env.KIWY_HQ_TOKEN = prev;

  assert.equal(res.statusCode, 200);
  assert.doesNotMatch(res.body, /super-secret-token/);
  assert.doesNotMatch(res.body, /kiwy_hq_auth=1/);
});
