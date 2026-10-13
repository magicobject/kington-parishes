// Boundary tests for modules/advent/: the folder must be self-contained and generic,
// and must never use unsafe DOM APIs or browser storage (spec: security review S1, S7, S12).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = fileURLToPath(new URL('../modules/advent/', import.meta.url));
const SITE_OWNED = ['theme.mjs', 'content.mjs'];

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

const files = listFiles(MODULE_DIR).map((full) => ({
  full,
  name: relative(MODULE_DIR, full).split(sep).join('/'),
  text: readFileSync(full, 'utf8'),
}));
const genericFiles = files.filter((file) => !SITE_OWNED.includes(file.name));
const codeFiles = files.filter((file) => /\.(mjs|js|cjs)$/.test(file.name));

// Patterns are assembled from pieces so this test file never matches itself
// (and it lives outside modules/advent/ anyway, which is all that gets scanned).
const FORBIDDEN_APIS = [
  ['inner', 'HTML'],
  ['outer', 'HTML'],
  ['insertAdjacent', 'HTML'],
  ['document', '.write'],
  ['ev', 'al('],
  ['new Func', 'tion'],
  ['local', 'Storage'],
  ['session', 'Storage'],
  ['indexed', 'DB'],
  ['document', '.cookie'],
].map((pieces) => pieces.join(''));

describe('modules/advent folder', () => {
  test('the folder has the expected generic and site-owned files', () => {
    const names = files.map((file) => file.name);
    for (const expected of ['date.mjs', 'preview.mjs', 'schema.mjs', 'theme.mjs', 'content.mjs', 'README.md']) {
      assert.ok(names.includes(expected), `${expected} should exist`);
    }
  });

  test('generic files never mention the site by name', () => {
    const forbidden = [['king', 'ton'].join(''), ['king', 'tonparishes'].join('')];
    for (const file of genericFiles) {
      const lower = file.text.toLowerCase();
      for (const word of forbidden) assert.ok(!lower.includes(word), `${file.name} mentions "${word}"`);
    }
  });

  test('no file imports from outside the folder (only ./ paths, no .. and no packages)', () => {
    const specifier = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(['"])([^'"]+)\1/g;
    let found = 0;
    for (const file of codeFiles) {
      for (const match of file.text.matchAll(specifier)) {
        found += 1;
        const path = match[2];
        assert.ok(path.startsWith('./'), `${file.name} imports "${path}"`);
        assert.ok(!path.includes('..'), `${file.name} imports "${path}"`);
      }
    }
    assert.ok(found > 0, 'expected at least one relative import to be checked');
  });

  test('no runtime dependency: no node: or package imports in the module', () => {
    for (const file of codeFiles) {
      assert.ok(!/from\s*['"](?!\.\/)/.test(file.text), `${file.name} imports a non-relative path`);
    }
  });

  for (const api of FORBIDDEN_APIS) {
    test(`no source file uses ${api}`, () => {
      for (const file of codeFiles) {
        assert.ok(!file.text.includes(api), `${file.name} contains ${api}`);
      }
    });
  }

  test('the scan sees the code it is meant to scan', () => {
    assert.ok(codeFiles.length >= 5);
    assert.ok(codeFiles.every((file) => file.text.length > 0));
  });
});
