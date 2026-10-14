// flipFlags (scripts/advent-launch-steps.mjs) must be safe to run on any copy: an unlaunched theme is flipped, an already launched
// one is left exactly as it is (so the browser tests that build a launched copy also work in a repository that has launched), and
// anything in between is refused with a plain message.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { flipFlags, LAUNCH_FLAGS } from '../scripts/advent-launch-steps.mjs';

const themeWith = (values) => `export const theme = {\n${LAUNCH_FLAGS.map((flag, i) => `  ${flag}: ${values[i]},`).join('\n')}\n  other: false,\n};\n`;

function withTheme(text, run) {
  const folder = mkdtempSync(join(tmpdir(), 'advent-flip-test-'));
  const path = join(folder, 'theme.mjs');
  writeFileSync(path, text);
  try { return run(path); } finally { rmSync(path); rmSync(folder, { recursive: true }); }
}

describe('flipFlags', () => {
  test('flips all three flags from false to true and touches nothing else', () => {
    withTheme(themeWith(['false', 'false', 'false']), (path) => {
      flipFlags(path);
      assert.equal(readFileSync(path, 'utf8'), themeWith(['true', 'true', 'true']));
    });
  });

  test('an already launched theme is a no-op (the file is byte-identical) and does not throw', () => {
    const launched = themeWith(['true', 'true', 'true']);
    withTheme(launched, (path) => {
      assert.doesNotThrow(() => flipFlags(path));
      assert.equal(readFileSync(path, 'utf8'), launched);
    });
  });

  test('a partly flipped theme is refused, and the message names the flags that are on and off', () => {
    withTheme(themeWith(['true', 'false', 'true']), (path) => {
      assert.throws(() => flipFlags(path), (error) => /partly launched/.test(error.message) && error.message.includes('goLive') && error.message.includes('publicListing'));
      assert.equal(readFileSync(path, 'utf8'), themeWith(['true', 'false', 'true']), 'nothing was written');
    });
  });

  test('a theme with a flag missing, or not written as a plain true or false, is refused', () => {
    withTheme('export const theme = { goLive: false, publicListing: false };\n', (path) => assert.throws(() => flipFlags(path), /could not find/));
    withTheme(themeWith(['false', 'false', 'someFunction()']), (path) => assert.throws(() => flipFlags(path), /could not find/));
  });
});
