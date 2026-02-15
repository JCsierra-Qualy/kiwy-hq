import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server';
import http from 'node:http';

test('GET /health returns ok', async () => {
  const app = createApp();
  const server = app.listen(0);
  const addr = server.address();
  assert.equal(typeof addr, 'object');
  const port = (addr as any).port;

  const body = await new Promise<string>((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/health`, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });

  server.close();
  const parsed = JSON.parse(body);
  assert.deepEqual(parsed, { ok: true });
});
