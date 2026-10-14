// The generic versionAssetUrls snippet (modules/advent/host-kit/version-asset-urls.mjs): same behaviour as this site's own build.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAssetVersioner } from '../scripts/version-asset-urls.mjs';

const dir = mkdtempSync(join(tmpdir(), 'advent-versioner-'));
after(() => rmSync(dir, { recursive: true, force: true }));
mkdirSync(join(dir, 'css'));
mkdirSync(join(dir, 'js'));
writeFileSync(join(dir, 'css', 'a.css'), 'a { color: red }');
writeFileSync(join(dir, 'js', 'b.js'), 'export const b = 1;');
const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 10);
const version = createAssetVersioner(dir);

describe('createAssetVersioner', () => {
  test('adds ?v=<content hash> to same-origin stylesheets and scripts, in any attribute order', () => {
    const out = version('<link rel="stylesheet" href="/css/a.css"><script type="module" src="/js/b.js"></script><script src="/js/b.js"></script>');
    assert.ok(out.includes(`href="/css/a.css?v=${hash('a { color: red }')}"`));
    assert.equal(out.split(`src="/js/b.js?v=${hash('export const b = 1;')}"`).length - 1, 2);
  });

  test('leaves other addresses alone: external, protocol-relative, already versioned, links, images', () => {
    const html = '<script src="https://example.org/x.js"></script><link href="//cdn.example/x.css"><link href="/css/a.css?v=abc"><a href="/css/a.css">x</a><img src="/js/b.js">';
    assert.equal(version(html), html);
  });

  test('running it twice changes nothing more', () => {
    const once = version('<link rel="stylesheet" href="/css/a.css">');
    assert.equal(version(once), once);
  });

  test('a file that does not exist fails the build, naming it', () => {
    assert.throws(() => version('<link rel="stylesheet" href="/css/missing.css">'), /\/css\/missing\.css/);
  });

  test('the hash follows the file: change the file, the address changes', () => {
    const before = version('<script src="/js/b.js"></script>');
    writeFileSync(join(dir, 'js', 'c.js'), 'one');
    const first = createAssetVersioner(dir)('<script src="/js/c.js"></script>');
    writeFileSync(join(dir, 'js', 'c.js'), 'two');
    const second = createAssetVersioner(dir)('<script src="/js/c.js"></script>');
    assert.notEqual(first, second);
    assert.ok(before.includes('?v='));
  });

  test('on this site\'s built calendar page every same-origin stylesheet and script tag has the address the snippet would give', () => {
    const root = new URL('../public/', import.meta.url);
    const page = readFileSync(new URL('advent.html', root), 'utf8');
    const publicDir = fileURLToPath(new URL('../public', import.meta.url));
    const tags = page.match(/<(?:link|script)\b[^>]*>/g).filter((tag) => /(?:href|src)="\/(?!\/)/.test(tag));
    assert.ok(tags.length >= 3);
    for (const tag of tags) assert.ok(/\?v=[0-9a-f]{10}"/.test(tag), tag);
    // Idempotent on the real built page: the snippet recognises the site's addresses as already versioned.
    assert.equal(createAssetVersioner(publicDir)(page), page);
  });
});
