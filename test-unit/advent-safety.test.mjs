// Safety scans for the Advent calendar: the module's source AND everything the build publishes from it.
// No unsafe DOM APIs, no browser storage, no dynamic code, no network tricks, no inline script or style.
// (Patterns are written as regular expressions so this file, which is not scanned, can name them freely.)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : [full];
});
const rel = (full) => relative(ROOT, full).split(sep).join('/');
const load = (full) => ({ name: rel(full), text: readFileSync(full, 'utf8') });

const sourceCode = walk(join(ROOT, 'modules', 'advent')).filter((f) => /\.(mjs|js)$/.test(f)).map(load);
const builtJs = ['public/js/advent.js', ...readdirSync(join(ROOT, 'public/js/advent')).map((n) => `public/js/advent/${n}`)]
  .map((path) => load(join(ROOT, path)));
const builtCss = ['public/css/advent.css', 'public/css/advent-theme.css'].map((path) => load(join(ROOT, path)));
const page = load(join(ROOT, 'public/advent.html'));

const FORBIDDEN_CODE = {
  innerHTML: /innerHTML/,
  outerHTML: /outerHTML/,
  insertAdjacentHTML: /insertAdjacentHTML/,
  'document.write': /document\s*\.\s*write/,
  'eval(': /(?<![\w$.])eval\s*\(/,
  '(0, eval)': /\(\s*0\s*,\s*eval\s*\)/,
  'new Function': /new\s+Function\b/,
  'Function(': /(?<![\w$.])Function\s*\(/,
  'setTimeout with a string': /\bsetTimeout\s*\(\s*['"`]/,
  'setInterval with a string': /\bsetInterval\s*\(\s*['"`]/,
  localStorage: /localStorage/,
  sessionStorage: /sessionStorage/,
  indexedDB: /indexedDB/,
  'document.cookie': /document\s*\.\s*cookie/,
  XMLHttpRequest: /XMLHttpRequest/,
  sendBeacon: /sendBeacon/,
  WebSocket: /WebSocket/,
  importScripts: /importScripts/,
  'dynamic import(': /(?<![\w$.])import\s*\(/,
  'import.meta in the browser files': /import\s*\.\s*meta/,
};

describe('source files in modules/advent', () => {
  test('there are files to scan', () => assert.ok(sourceCode.length >= 8));
  for (const [name, pattern] of Object.entries(FORBIDDEN_CODE)) {
    test(`none uses ${name}`, () => {
      for (const file of sourceCode) {
        // build.mjs and make-manifest.mjs run in Node at build time, so import.meta there is fine.
        if (name.startsWith('import.meta') && /^modules\/advent\/(build|make-manifest|date|preview)\.mjs$/.test(file.name)) continue;
        if (name.startsWith('import.meta') && !file.name.includes('client/')) continue;
        assert.ok(!pattern.test(file.text), `${file.name} uses ${name}`);
      }
    });
  }
});

describe('the built browser scripts', () => {
  test('there are three of them', () => assert.equal(builtJs.length, 3));
  for (const [name, pattern] of Object.entries(FORBIDDEN_CODE)) {
    test(`none uses ${name}`, () => {
      for (const file of builtJs) assert.ok(!pattern.test(file.text), `${file.name} uses ${name}`);
    });
  }

  test('they import only the known copies of the date modules, by relative path with a content hash', () => {
    const imports = (file) => [...file.text.matchAll(/^import\s*\{[^}]*\}\s*from\s*'([^']+)';$/gm)].map((m) => m[1]);
    const byName = Object.fromEntries(builtJs.map((file) => [file.name, file]));
    const every = (file) => (file.text.match(/\bimport\b/g) ?? []).length;
    assert.equal(every(byName['public/js/advent.js']), 2);
    assert.equal(every(byName['public/js/advent/preview.js']), 1);
    assert.equal(every(byName['public/js/advent/date.js']), 0);
    assert.ok(imports(byName['public/js/advent.js']).every((p) => /^\.\/advent\/(?:date|preview)\.js\?v=[0-9a-f]{10}$/.test(p)));
    assert.deepEqual(imports(byName['public/js/advent/preview.js']).map((p) => p.replace(/[0-9a-f]{10}$/, 'HASH')), ['./date.js?v=HASH']);
  });

  test('they contain no web address', () => {
    for (const file of builtJs) assert.ok(!/https?:\/\//i.test(file.text), file.name);
  });
});

describe('the built stylesheets', () => {
  for (const file of builtCss) {
    test(`${file.name} fetches nothing`, () => {
      assert.ok(!/@import/i.test(file.text));
      assert.ok(!/url\s*\(/i.test(file.text));
      assert.ok(!/expression\s*\(/i.test(file.text));
      assert.ok(!/javascript\s*:/i.test(file.text));
    });
  }
});

describe('the built calendar page', () => {
  const main = page.text.slice(page.text.indexOf('<main'), page.text.indexOf('</main>'));
  const inlineScripts = (html) => [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

  test('has no inline style or event handler attributes and no <style> or <script> in its own content', () => {
    assert.ok(main.length > 200);
    assert.ok(!/\sstyle\s*=/i.test(main));
    assert.ok(!/\son[a-z]+\s*=/i.test(main));
    assert.ok(!/<style/i.test(main));
    assert.ok(!/<script/i.test(main));
  });

  test('has no inline script except the one every page already carries (hash-pinned in the CSP), and no <style> anywhere', () => {
    const template = inlineScripts(readFileSync(join(ROOT, 'public/contact.html'), 'utf8')).filter((s) => s.trim() !== '' && !/^\s*\{/.test(s));
    const here = inlineScripts(page.text).filter((s) => !/^\s*\{/.test(s));
    assert.deepEqual(here, template);
    assert.ok(!/<style/i.test(page.text));
  });

  test('loads only same-origin scripts', () => {
    for (const match of page.text.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) assert.ok(match[1].startsWith('/'), match[1]);
  });
});
