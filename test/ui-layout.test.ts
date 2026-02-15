import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, pageLayout } from '../src/ui';

test('escapeHtml escapes HTML-sensitive characters', () => {
  const input = `&<>"'`;
  assert.equal(escapeHtml(input), '&amp;&lt;&gt;&quot;&#39;');
});

test('pageLayout renders the shared Kiwy shell with primary navigation', () => {
  const html = pageLayout({
    title: 'Dashboard',
    active: 'dashboard',
    contentHtml: '<p>ok</p>',
  });

  assert.match(html, /data-kiwy-shell="v1"/);
  assert.match(html, /<nav[^>]*aria-label="Primary"/);
  assert.match(html, /<a class="navlink" href="\/" aria-current="page">Dashboard<\/a>/);
  assert.match(html, /<a class="navlink" href="\/secrets" >Secrets<\/a>/);
});
