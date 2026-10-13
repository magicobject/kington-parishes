// The launch rehearsal script (scripts/advent-rehearse.mjs) and docs/advent/launch-checklist.md must describe the SAME
// mechanical steps: the three flags and the three guard tests. This test fails if either side changes alone.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { GUARD_FILES, GUARD_TEST, LAUNCH_FLAGS } from '../scripts/advent-launch-steps.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const checklist = read('docs/advent/launch-checklist.md');

describe('launch checklist and rehearsal script agree', () => {
  test('the checklist names each of the three flags and each guard test, exactly as the script uses them', () => {
    for (const flag of LAUNCH_FLAGS) assert.ok(checklist.includes(`\`${flag}`), `checklist does not mention ${flag}`);
    for (const file of GUARD_FILES) assert.ok(checklist.includes(`\`${file}\``), `checklist does not mention ${file}`);
    assert.ok(checklist.includes(GUARD_TEST.file), 'checklist does not mention the sitemap guard file');
    assert.ok(checklist.includes(GUARD_TEST.name), 'checklist does not name the sitemap guard test');
  });

  test('the checklist tells the person to run npm run advent:rehearse, and the script is wired in package.json', () => {
    assert.ok(checklist.includes('npm run advent:rehearse'));
    assert.match(read('package.json'), /"advent:rehearse": "node scripts\/advent-rehearse\.mjs"/);
  });

  test('the guard files exist today (so deleting them is a real step), and the sitemap guard test is the LAST test in its file', () => {
    for (const file of GUARD_FILES) assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), file);
    const sitemap = read(GUARD_TEST.file);
    const at = sitemap.indexOf(`test('${GUARD_TEST.name}'`);
    assert.ok(at > 0);
    assert.ok(!/\ntest(?:\.describe)?\(/.test(sitemap.slice(at + 10)), 'another test follows the guard test: the rehearsal removes everything from it to the end of the file');
  });

  test('the script touches only its temporary copy: every removal is inside the copy or is the temporary folder itself', () => {
    const script = read('scripts/advent-rehearse.mjs');
    for (const call of script.match(/rmSync\([^;]*\);/g) ?? []) assert.ok(/join\(copy|temp,/.test(call), call);
    assert.ok(script.includes("startsWith(ROOT + sep)"), 'it refuses a temporary folder inside the repository');
    assert.ok(!/symlinkSync|junction/i.test(script), 'no links into the real tree');
  });
});
