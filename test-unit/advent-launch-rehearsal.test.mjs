// The launch rehearsal script (scripts/advent-rehearse.mjs) and docs/advent/launch-checklist.md must describe the SAME
// mechanical steps: the three flags and the three guard tests. This test fails if either side changes alone.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { GUARD_FILES, GUARD_TEST, LAUNCH_FLAGS } from '../scripts/advent-launch-steps.mjs';
import { theme } from '../modules/advent/theme.mjs';

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

  // These describe the repository BEFORE launch (the guards exist). In the launched state (the flags flipped and the guards deleted
  // exactly as the checklist says) they have nothing to check, so they skip: following the checklist literally leaves this suite
  // green WITHOUT deleting this test file.
  const beforeLaunch = { skip: theme.goLive ? 'launched: the guards are deleted, as the checklist says' : false };
  test('the guard files exist today (so deleting them is a real step), and the sitemap guard test is the LAST test in its file', beforeLaunch, () => {
    for (const file of GUARD_FILES) assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), file);
    const sitemap = read(GUARD_TEST.file);
    const at = sitemap.indexOf(`test('${GUARD_TEST.name}'`);
    assert.ok(at > 0);
    assert.ok(!/\ntest(?:\.describe)?\(/.test(sitemap.slice(at + 10)), 'another test follows the guard test: the rehearsal removes everything from it to the end of the file');
  });

  test('the scripts touch only their temporary copy: every removal is inside the copy or is the temporary folder itself, and refuses anything else', () => {
    const steps = read('scripts/advent-launch-steps.mjs');
    const calls = steps.match(/rmSync\([^;]*\);/g) ?? [];
    assert.equal(calls.length, 2, 'two removals only: a guard file in the copy, and the temporary folder');
    for (const call of calls) assert.ok(/join\(copy, file\)|folder,/.test(call), call);
    assert.ok(steps.includes('startsWith(ROOT + sep)'), 'it refuses a temporary folder inside the repository');
    assert.ok(steps.includes('refusing to remove'), 'it refuses to remove any folder it did not make');
    for (const name of ['advent-launch-steps.mjs', 'advent-rehearse.mjs', 'advent-launched-copy.mjs']) assert.ok(!/symlinkSync|junction/i.test(read(`scripts/${name}`)), `${name}: no links into the real tree`);
    assert.ok(!/rmSync/.test(read('scripts/advent-rehearse.mjs')), 'the rehearsal script itself removes nothing directly');
  });

  test('the code deletes ONLY the files in the shared list, each named in the checklist (no file path of its own that it removes)', () => {
    const steps = read('scripts/advent-launch-steps.mjs');
    assert.deepEqual(steps.match(/rmSync\(join\(copy, [^)]*\)/g), ['rmSync(join(copy, file)'], 'one deletion, of the shared list');
    assert.match(steps, /for \(const file of GUARD_FILES\)/);
    for (const file of GUARD_FILES) assert.ok(checklist.includes(`\`${file}\``), file);
    assert.equal(GUARD_FILES.length, 2);
  });

  test('the checklist step that deletes the guards names every file the rehearsal deletes, and says nothing else needs deleting', () => {
    const step = checklist.slice(checklist.indexOf('Delete the three pre-launch guards'), checklist.indexOf('Apply the after-launch wording'));
    for (const file of GUARD_FILES) assert.ok(step.includes(file), file);
    assert.ok(step.includes(GUARD_TEST.name));
    assert.match(step, /No other (?:file|test)/);
  });
});
