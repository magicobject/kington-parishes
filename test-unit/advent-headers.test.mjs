// `npm run advent:headers` prints the _headers rules the calendar needs, worked out from the files the build really writes.
// public/_headers must contain every one of them, so a drift (a new built file without its cache rule, a loosened picture
// policy) fails here, and a second church can copy the printed text with confidence.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { adventHeaderRules, adventHeadersText } from '../modules/advent/build.mjs';
import { headersForSite } from '../scripts/advent-headers.mjs';

const ROOT = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');

/** _headers as a Map: path -> list of header lines (a rule is a non-indented path line followed by indented header lines). */
function parseHeaders(text) {
  const rules = new Map();
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '' || line.startsWith('#')) continue;
    if (/^\S/.test(line)) {
      current = line.trim();
      rules.set(current, rules.get(current) ?? []);
    } else if (current) {
      rules.get(current).push(line.trim());
    }
  }
  return rules;
}

const SAMPLE = ['advent/day-01.json', 'css/advent.css', 'css/advent-theme.css', 'js/advent.js', 'js/advent/date.js', 'advent/scene-default.svg'];

describe('adventHeaderRules', () => {
  test('tightening rules for pictures and scene, noindex for day files, an exact immutable rule per script and stylesheet', () => {
    const byPath = new Map(adventHeaderRules(SAMPLE).map((rule) => [rule.path, rule.headers]));
    assert.deepEqual(byPath.get('/advent/art/*'), ["Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox"]);
    assert.deepEqual(byPath.get('/advent/scene*.svg'), byPath.get('/advent/art/*'));
    assert.deepEqual(byPath.get('/advent/day-*.json'), ['X-Robots-Tag: noindex']);
    for (const path of ['/css/advent.css', '/css/advent-theme.css', '/js/advent.js', '/js/advent/date.js']) {
      assert.deepEqual(byPath.get(path), ['Cache-Control: public, max-age=31536000, immutable'], path);
    }
    assert.ok(![...byPath.keys()].some((path) => path.includes('*') && /^\/(?:js|css)\//.test(path)), 'no wildcard cache rule');
    assert.ok(!byPath.has('/advent/day-01.json') && !byPath.has('/advent/scene-default.svg'), 'day files and pictures keep revalidating');
  });

  test('the text form parses back to the same rules', () => {
    const parsed = parseHeaders(adventHeadersText(SAMPLE));
    for (const { path, headers } of adventHeaderRules(SAMPLE)) assert.deepEqual(parsed.get(path), headers, path);
  });
});

describe('the repo public/_headers against what npm run advent:headers prints', () => {
  test('every printed rule is in public/_headers, exactly', async () => {
    const wanted = parseHeaders(await headersForSite());
    const actual = parseHeaders(read('public/_headers'));
    assert.ok(wanted.size >= 12, `expected the pictures, scene, day files and about 9 cache rules, got ${wanted.size}`);
    for (const [path, headers] of wanted) assert.deepEqual(actual.get(path), headers, `public/_headers lacks (or differs on) the rule for ${path}`);
  });

  test('every built script and stylesheet has its rule (the printed list covers the real public/ folder)', async () => {
    const wanted = parseHeaders(await headersForSite());
    const built = [
      ...readdirSync(new URL('public/js/advent/', ROOT)).map((n) => `/js/advent/${n}`),
      ...readdirSync(new URL('public/js/', ROOT)).filter((n) => /^advent[^/]*\.js$/.test(n)).map((n) => `/js/${n}`),
      ...readdirSync(new URL('public/css/', ROOT)).filter((n) => /^advent[^/]*\.css$/.test(n)).map((n) => `/css/${n}`),
    ];
    assert.ok(built.length >= 9);
    for (const path of built) assert.ok(wanted.has(path), `${path} is built but advent:headers does not print a rule for it`);
  });
});
