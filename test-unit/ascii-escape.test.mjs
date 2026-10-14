// scripts/ascii-escape.mjs and the guard that keeps the Advent files plain ASCII (the file-writing tool turns \uXXXX escapes into
// literal characters, so source written through it can silently gain non-ASCII bytes; this is the fix-up and the check).
// The non-ASCII characters in THIS file are written as escapes too, so the file itself is ASCII.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeSource } from '../scripts/ascii-escape.mjs';

const E = '\u00e9'; // e acute
const EM = '\u2014'; // em dash
const SMILE = '\u{1F600}';
const ROOT = fileURLToPath(new URL('..', import.meta.url));

describe('escapeSource', () => {
  test('ASCII input comes back byte for byte', () => {
    const source = "const a = 'x';\r\nconst r = /ab+c/g; // note\n/* block */ `t${1}`;\n";
    assert.equal(escapeSource(source), source);
  });

  test('non-ASCII in single, double and template strings becomes a \\u escape', () => {
    assert.equal(escapeSource(`const a = 'caf${E}', b = "a${EM}b", c = \`x${E}\${1}y\`;`), "const a = 'caf\\u00e9', b = \"a\\u2014b\", c = `x\\u00e9${1}y`;");
  });

  test('a character outside the basic plane becomes two escapes (a surrogate pair)', () => {
    assert.equal(escapeSource(`const a = '${SMILE}';`), "const a = '\\ud83d\\ude00';");
  });

  test('regular expressions and comments are escaped too', () => {
    assert.equal(escapeSource(`const r = /[${E}]+/u; // caf${E}\n/* ${EM} */`), 'const r = /[\\u00e9]+/u; // caf\\u00e9\n/* \\u2014 */');
  });

  test('a backslash before a non-ASCII character is dropped, so the meaning does not change', () => {
    const out = escapeSource(`const a = '\\${E}';`);
    assert.equal(out, "const a = '\\u00e9';");
    assert.equal(eval(`${out}; a`), E); // eslint-disable-line no-eval
  });

  test('the result evaluates to the same string', () => {
    const source = `const a = 'a${E}${EM}${SMILE}z';`;
    assert.equal(eval(`${escapeSource(source)}; a`), `a${E}${EM}${SMILE}z`); // eslint-disable-line no-eval
  });

  test('a template literal with a backslash, a nested template and an escaped backtick is handled', () => {
    const source = ['const t = `a\\`', '${`in', E, '`}', '\\n', E, '`;'].join('');
    assert.equal(eval(`${escapeSource(source)}; t`), eval(`${source}; t`));
    assert.ok(![...escapeSource(source)].some((character) => character.charCodeAt(0) > 127));
  });

  test('a slash that is division is not mistaken for a regular expression start', () => {
    assert.equal(escapeSource(`const q = (a / 2) / 3; const s = '${E}';`), "const q = (a / 2) / 3; const s = '\\u00e9';");
  });

  test('non-ASCII outside a string, regular expression or comment is refused, naming the line', () => {
    assert.throws(() => escapeSource(`const a = 1;\nconst caf${E} = 2;`), /line 2/);
  });

  test('running it twice changes nothing more', () => {
    const once = escapeSource(`const a = '${E}';`);
    assert.equal(escapeSource(once), once);
  });
});

describe('the command line', () => {
  test('rewrites the named file in place, and refuses (changing nothing) a file with non-ASCII in code', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ascii-escape-'));
    try {
      const good = join(dir, 'good.mjs');
      const bad = join(dir, 'bad.mjs');
      writeFileSync(good, `export const a = '${E}';\n`);
      writeFileSync(bad, `const caf${E} = 1;\n`);
      const script = join(ROOT, 'scripts', 'ascii-escape.mjs');
      execFileSync(process.execPath, [script, good]);
      assert.equal(readFileSync(good, 'utf8'), "export const a = '\\u00e9';\n");
      assert.throws(() => execFileSync(process.execPath, [script, bad], { stdio: 'pipe' }));
      assert.equal(readFileSync(bad, 'utf8'), `const caf${E} = 1;\n`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// The guard. Every file of the Advent module and of its scripts and tests is plain ASCII.
function walk(dir, found = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, found);
    else found.push(path);
  }
  return found;
}

describe('the Advent files are plain ASCII', () => {
  const advent = (dir) => readdirSync(join(ROOT, dir)).filter((name) => /^advent-.*\.mjs$/.test(name)).map((name) => join(ROOT, dir, name));
  const adventTests = readdirSync(join(ROOT, 'test')).filter((name) => /^advent.*\.spec\.ts$/.test(name)).map((name) => join(ROOT, 'test', name));
  const files = [...walk(join(ROOT, 'modules', 'advent')), ...advent('scripts'), ...advent('test-unit'), ...adventTests, join(ROOT, 'test', 'support', 'advent.ts')];

  test('there are files to check', () => assert.ok(files.length > 30));

  test('none contains a non-ASCII byte', () => {
    const offenders = files.filter((file) => readFileSync(file).some((byte) => byte > 127)).map((file) => relative(ROOT, file));
    assert.deepEqual(offenders, [], `non-ASCII bytes in: ${offenders.join(', ')}. Run: node scripts/ascii-escape.mjs <file> for each (it rewrites them as \\uXXXX escapes; it refuses a file with non-ASCII outside a string, regular expression or comment, which you fix by hand)`);
  });
});
