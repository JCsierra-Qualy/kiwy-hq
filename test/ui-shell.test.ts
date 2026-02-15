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
      req.end();
    },
  );
}

test('authenticated users see consistent shell on / and /secrets', async () => {
  const app = createApp();
  const server = app.listen(0);
  const addr = server.address();
  assert.equal(typeof addr, 'object');
  const port = (addr as any).port as number;

  const cookie = { cookie: 'kiwy_hq_auth=1' };

  const dash = await request(port, { method: 'GET', path: '/', headers: cookie });
  const secrets = await request(port, { method: 'GET', path: '/secrets', headers: cookie });

  server.close();

  for (const res of [dash, secrets]) {
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'] || '', /text\/html/);

    // Shell pieces
    assert.match(res.body, /<h1>Kiwy HQ<\/h1>/);
    assert.match(res.body, /<nav[^>]*aria-label="Primary"/);

    // Nav links
    assert.match(res.body, /href="\/"[^>]*>Dashboard<\/a>/);
    assert.match(res.body, /href="\/secrets"[^>]*>Secrets<\/a>/);
    assert.match(res.body, /<form[^>]*method="post"[^>]*action="\/logout"/i);
  }

  // Active nav marker switches per page
  assert.match(dash.body, /href="\/"[^>]*aria-current="page"/);
  assert.doesNotMatch(dash.body, /href="\/secrets"[^>]*aria-current="page"/);

  assert.match(secrets.body, /href="\/secrets"[^>]*aria-current="page"/);
  assert.doesNotMatch(secrets.body, /href="\/"[^>]*aria-current="page"/);
});

test('secrets page does not render any secret values', async () => {
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

  assert.equal(res.statusCode, 200);

  // Ensure we never echo env var names or the login token.
  assert.doesNotMatch(res.body, /KIWY_HQ_TOKEN/);

  // Inputs should not include any prefilled values beyond empty.
  assert.doesNotMatch(res.body, /value="(?!")[^"]+"/);
});
