import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

test('the one inline script in templates/page.html is the one script hash in the site CSP', () => {
  const inline = [...read('templates/page.html').matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(inline.length, 1, 'exactly one inline script');
  const hash = `'sha256-${createHash('sha256').update(inline[0][1]).digest('base64')}'`;
  const csp = read('public/_headers').match(/^ {2}Content-Security-Policy: (default-src 'self'; script-src [^;]*);/m);
  assert.ok(csp, 'site-wide CSP rule exists');
  const scriptSrc = csp[1].match(/script-src ([^;]*)/)[1];
  assert.equal(scriptSrc, `'self' ${hash}`);
});

test('every built page that carries an inline script carries the exact script the CSP hashes', () => {
  const expected = [...read('templates/page.html').matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
  const pages = readdirSync(new URL('public/', root)).filter((f) => f.endsWith('.html'));
  for (const f of pages) {
    const inline = [...read(`public/${f}`).matchAll(/<script>([\s\S]*?)<\/script>/g)];
    assert.ok(inline.every((m) => m[1] === expected), `${f}: inline script differs from the template`);
  }
});
