// Boundary tests for modules/advent/: the folder must be self-contained and generic,
// and must never use unsafe DOM APIs or browser storage (spec: security review S1, S7, S12).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
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
// fetch is deliberately NOT forbidden: the client will fetch same-origin day files.
const piece = (...parts) => parts.join('');
const FORBIDDEN = [
  ['inner' + 'HTML', new RegExp(piece('inner', 'HTML'))],
  ['outer' + 'HTML', new RegExp(piece('outer', 'HTML'))],
  ['insertAdjacent' + 'HTML', new RegExp(piece('insertAdjacent', 'HTML'))],
  ['document.' + 'write', new RegExp(piece(String.raw`document\s*\.\s*wri`, 'te'))],
  ['ev' + 'al(', new RegExp(piece(String.raw`\bev`, String.raw`al\s*\(`))],
  ['(0,ev' + 'al)', new RegExp(piece(String.raw`\(\s*0\s*,\s*ev`, String.raw`al\s*\)`))],
  ['new Func' + 'tion', new RegExp(piece(String.raw`new\s+Func`, 'tion'))],
  ['Func' + 'tion(', new RegExp(piece(String.raw`(?<![\w$.])Func`, String.raw`tion\s*\(`))],
  ['local' + 'Storage', new RegExp(piece('local', 'Storage'))],
  ['session' + 'Storage', new RegExp(piece('session', 'Storage'))],
  ['indexed' + 'DB', new RegExp(piece('indexed', 'DB'))],
  ['document.' + 'cookie', new RegExp(piece(String.raw`document\s*\.\s*coo`, 'kie'))],
  ['globalThis' + '[', new RegExp(piece('global', String.raw`This\s*\[`))],
  ['XMLHttp' + 'Request', new RegExp(piece('XMLHttp', 'Request'))],
  ['send' + 'Beacon', new RegExp(piece('send', 'Beacon'))],
  ['Web' + 'Socket', new RegExp(piece('Web', 'Socket'))],
  ['import' + 'Scripts', new RegExp(piece('import', 'Scripts'))],
];

describe('modules/advent folder', () => {
  test('the folder has the expected generic and site-owned files', () => {
    const names = files.map((file) => file.name);
    for (const expected of ['date.mjs', 'preview.mjs', 'schema.mjs', 'theme.mjs', 'content.mjs', 'README.md', 'build.mjs', 'client/advent.js', 'client/advent.css']) {
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

  // Only build.mjs and make-manifest.mjs may use Node itself, and only these built-in modules. Nothing else may import a package.
  const NODE_ALLOWED = ['node:crypto', 'node:fs', 'node:path', 'node:url'];
  const specifier = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(['"])([^'"]+)\1/g;

  test('every import is a file inside this folder, or (build.mjs and make-manifest.mjs only) a Node built-in from the allowed few', () => {
    let relativeImports = 0;
    for (const file of codeFiles) {
      for (const match of file.text.matchAll(specifier)) {
        const path = match[2];
        if (path.startsWith('node:')) {
          assert.ok(['build.mjs', 'make-manifest.mjs'].includes(file.name), `${file.name} imports "${path}"`);
          assert.ok(NODE_ALLOWED.includes(path), `${file.name} imports "${path}"`);
          continue;
        }
        relativeImports += 1;
        assert.ok(path.startsWith('./') || path.startsWith('../'), `${file.name} imports "${path}"`);
        const target = resolve(dirname(file.full), path);
        assert.ok(files.some((other) => other.full === target), `${file.name} imports "${path}", which is not a file in this folder`);
      }
    }
    assert.ok(relativeImports > 0, 'expected at least one relative import to be checked');
  });

  test('the browser scripts (client/*.js) import no Node module and only the date, preview and logic modules', () => {
    const client = codeFiles.filter((file) => file.name.startsWith('client/'));
    assert.deepEqual(client.map((file) => file.name).sort(), ['client/advent-teaser.js', 'client/advent.js']);
    for (const file of client) {
      const imports = [...file.text.matchAll(specifier)].map((match) => match[2]);
      assert.deepEqual(imports.sort(), ['../date.mjs', '../logic.mjs', '../preview.mjs'], file.name);
    }
  });

  test('the pure modules the browser runs (date, preview, day, logic) import only each other', () => {
    const allowed = { 'date.mjs': [], 'day.mjs': [], 'preview.mjs': ['./date.mjs'], 'logic.mjs': ['./date.mjs', './day.mjs'] };
    for (const [name, expected] of Object.entries(allowed)) {
      const file = files.find((f) => f.name === name);
      const imports = [...file.text.matchAll(specifier)].map((match) => match[2]);
      assert.deepEqual(imports.sort(), expected, name);
    }
  });

  test('the browser scripts and stylesheets contain no web address and no use of the full page address', () => {
    for (const file of files.filter((f) => f.name.startsWith('client/') && /[.](?:js|css)$/.test(f.name))) {
      assert.ok(!/https?:\/\//i.test(file.text), `${file.name} contains a web address`);
      assert.ok(!/location\s*\.\s*href/.test(file.text), `${file.name} uses location.href`);
    }
  });

  for (const [name, pattern] of FORBIDDEN) {
    test(`no source file uses ${name}`, () => {
      for (const file of codeFiles) {
        assert.ok(!pattern.test(file.text), `${file.name} contains ${name}`);
      }
    });
  }

  test('the patterns catch what they should and leave ordinary words alone', () => {
    const hits = (name, text) => FORBIDDEN.find(([n]) => n === name)[1].test(text);
    assert.ok(hits('ev' + 'al(', 'x = ev' + 'al ("1")'));
    assert.ok(!hits('ev' + 'al(', 'retriev' + 'al(x)'));
    assert.ok(hits('Func' + 'tion(', 'Func' + 'tion("return 1")()'));
    assert.ok(!hits('Func' + 'tion(', 'myFunc' + 'tion(1)'));
    assert.ok(!hits('Func' + 'tion(', 'obj.Func' + 'tion(1)'));
    assert.ok(hits('(0,ev' + 'al)', '(0, ev' + 'al)("1")'));
    assert.ok(hits('globalThis' + '[', 'global' + 'This["ev" + "al"]'));
  });

  test('the scan sees the code it is meant to scan', () => {
    assert.ok(codeFiles.length >= 5);
    assert.ok(codeFiles.every((file) => file.text.length > 0));
  });
});
