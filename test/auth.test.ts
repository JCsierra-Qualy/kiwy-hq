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

test('GET /login renders HTML form', async () => {
  const app = createApp();
  const server = app.listen(0);
  const addr = server.address();
  assert.equal(typeof addr, 'object');
  const port = (addr as any).port as number;

  const res = await request(port, { method: 'GET', path: '/login' });
  server.close();

  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'] || '', /text\/html/);
  assert.match(res.body, /<form[^>]*method="post"[^>]*action="\/login"/i);
  assert.match(res.body, /name="token"/i);
});

test('POST /login with correct token sets httpOnly cookie and redirects', async () => {
  const prev = process.env.KIWY_HQ_TOKEN;
  process.env.KIWY_HQ_TOKEN = 'shared-token';

  const app = createApp();
  const server = app.listen(0);
  const addr = server.address();
  assert.equal(typeof addr, 'object');
  const port = (addr as any).port as number;

  const res = await request(port, {
    method: 'POST',
    path: '/login',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'token=shared-token',
  });

  server.close();
  process.env.KIWY_HQ_TOKEN = prev;

  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.location, '/');

  const setCookie = res.headers['set-cookie'];
  assert.ok(setCookie, 'expected Set-Cookie header');
  const cookieStr = Array.isArray(setCookie) ? setCookie.join(';') : setCookie;
  assert.match(cookieStr, /kiwy_hq_auth=/);
  assert.match(cookieStr, /HttpOnly/i);
});

test('POST /login with wrong token returns 401 and does not set cookie', async () => {
  const prev = process.env.KIWY_HQ_TOKEN;
  process.env.KIWY_HQ_TOKEN = 'shared-token';

  const app = createApp();
  const server = app.listen(0);
  const addr = server.address();
  assert.equal(typeof addr, 'object');
  const port = (addr as any).port as number;

  const res = await request(port, {
    method: 'POST',
    path: '/login',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'token=wrong-token',
  });

  server.close();
  process.env.KIWY_HQ_TOKEN = prev;

  assert.equal(res.statusCode, 401);
  assert.equal(res.headers['set-cookie'], undefined);
});

test('POST /logout clears cookie', async () => {
  const app = createApp();
  const server = app.listen(0);
  const addr = server.address();
  assert.equal(typeof addr, 'object');
  const port = (addr as any).port as number;

  const res = await request(port, {
    method: 'POST',
    path: '/logout',
    headers: {
      cookie: 'kiwy_hq_auth=1',
    },
  });

  server.close();

  assert.equal(res.statusCode, 200);
  const setCookie = res.headers['set-cookie'];
  assert.ok(setCookie, 'expected Set-Cookie header');
  const cookieStr = Array.isArray(setCookie) ? setCookie.join(';') : setCookie;
  assert.match(cookieStr, /kiwy_hq_auth=/);
  assert.match(cookieStr, /Expires=/i);
});

test('GET / redirects to /login when unauthenticated', async () => {
  const app = createApp();
  const server = app.listen(0);
  const addr = server.address();
  assert.equal(typeof addr, 'object');
  const port = (addr as any).port as number;

  const res = await request(port, { method: 'GET', path: '/' });
  server.close();

  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.location, '/login');
});

test('GET / allows access when authenticated', async () => {
  const app = createApp();
  const server = app.listen(0);
  const addr = server.address();
  assert.equal(typeof addr, 'object');
  const port = (addr as any).port as number;

  const res = await request(port, {
    method: 'GET',
    path: '/',
    headers: {
      cookie: 'kiwy_hq_auth=1',
    },
  });

  server.close();

  assert.equal(res.statusCode, 200);
  assert.match(res.body, /Kiwy HQ/);
});

test('GET /secrets requires auth', async () => {
  const app = createApp();
  const server = app.listen(0);
  const addr = server.address();
  assert.equal(typeof addr, 'object');
  const port = (addr as any).port as number;

  const res = await request(port, { method: 'GET', path: '/secrets' });
  server.close();

  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.location, '/login');
});

test('GET /status requires auth', async () => {
  const app = createApp();
  const server = app.listen(0);
  const addr = server.address();
  assert.equal(typeof addr, 'object');
  const port = (addr as any).port as number;

  const res = await request(port, { method: 'GET', path: '/status' });
  server.close();

  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.location, '/login');
});
