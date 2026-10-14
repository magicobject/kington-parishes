// The mechanical launch steps, as data AND as the code that performs them in a COPY of the repository. Used by
// scripts/advent-rehearse.mjs and scripts/advent-launched-copy.mjs (the browser test of the launched site), and cross-checked
// against docs/advent/launch-checklist.md by test-unit/advent-launch-rehearsal.test.mjs, so the scripts and the checklist cannot
// drift apart. Nothing here ever writes outside the temporary folder it makes: every change is made in the copy.
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyAfterLaunch } from './advent-after-launch-edits.mjs';

export const LAUNCH_FLAGS = ['goLive', 'publicListing', 'artRequired']; // flipped false -> true in src/advent/theme.mjs
export const GUARD_FILES = ['test-unit/advent-prelaunch.test.mjs', 'test/advent-prelaunch.spec.ts']; // deleted outright
export const GUARD_TEST = { file: 'test/sitemap.spec.ts', name: 'PRE-LAUNCH: the sitemap and the search index do not mention the Advent calendar' }; // removed from the end of the file

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_TOP = new Set(['node_modules', '.git', 'test-results', 'playwright-report', '.claude', '.wrangler']);
// The packages the build and the unit tests need (node-html-parser and what it depends on). The test runners and
// browsers are not needed and are large.
const PACKAGES = ['node-html-parser', 'boolbase', 'css-select', 'css-what', 'dom-serializer', 'domelementtype', 'domhandler', 'domutils', 'entities', 'nth-check'];

/**
 * Flips the three launch flags from false to true in a copy of theme.mjs. Safe to run on anything: all three already true is a
 * no-op (the file is left untouched), and any other state (a flag missing, not a plain true or false, or only some flags on) is
 * refused with a plain message and nothing written.
 */
export function flipFlags(themePath) {
  let text = readFileSync(themePath, 'utf8');
  const state = {};
  for (const flag of LAUNCH_FLAGS) {
    const found = new RegExp(`^[ ]*${flag}:[ ]*(true|false),`, 'm').exec(text);
    if (!found) throw new Error(`rehearsal: could not find "${flag}: true," or "${flag}: false," in the copy of theme.mjs`);
    state[flag] = found[1] === 'true';
  }
  const on = LAUNCH_FLAGS.filter((flag) => state[flag]);
  if (on.length === LAUNCH_FLAGS.length) return; // already launched: nothing to flip
  if (on.length > 0) throw new Error(`rehearsal: theme.mjs is partly launched (on: ${on.join(', ')}; off: ${LAUNCH_FLAGS.filter((flag) => !state[flag]).join(', ')}): flip all three together or none`);
  for (const flag of LAUNCH_FLAGS) text = text.replace(new RegExp(`^([ ]*${flag}:[ ]*)false(,)`, 'm'), '$1true$2');
  writeFileSync(themePath, text);
}

export function removeGuardTest(path, name) {
  const text = readFileSync(path, 'utf8');
  const at = text.indexOf(`test('${name}'`);
  if (at < 0) throw new Error(`rehearsal: the guard test "${name}" is not in ${path}`);
  const commentStart = text.lastIndexOf('\n\n', at);
  writeFileSync(path, `${text.slice(0, commentStart >= 0 ? commentStart : at).trimEnd()}\n`);
}

/**
 * Makes a temporary copy of the repository (outside it) and does the mechanical launch steps in the copy: the three flags, the guard
 * deletions, and the after-launch wording. Returns { temp, copy }. The caller builds in the copy and must call removeTemp(temp).
 */
export function makeLaunchedCopy({ log = () => {}, fullNodeModules = false } = {}) {
  const temp = mkdtempSync(join(tmpdir(), 'advent-rehearsal-'));
  if (resolve(temp).startsWith(ROOT + sep)) throw new Error('rehearsal: the temporary folder must be outside the repository');
  const copy = join(temp, 'repo');
  cpSync(ROOT, copy, { recursive: true, filter: (source) => { const rel = source.slice(ROOT.length + 1).split(sep); return !(rel.length === 1 && SKIP_TOP.has(rel[0])) && !(rel.join('/') === 'docs/advent/art-drafts'); } });
  // The unit tests need only a few small packages. The browser stage needs the test runner, its helpers and the server (all of node_modules,
  // about 70 MB): either way they are COPIED, never linked, so the real node_modules is only ever read.
  const from = join(ROOT, 'node_modules');
  if (fullNodeModules) cpSync(from, join(copy, 'node_modules'), { recursive: true });
  else for (const name of PACKAGES) if (existsSync(join(from, name))) cpSync(join(from, name), join(copy, 'node_modules', name), { recursive: true });
  log(`rehearsing the launch in a copy: ${copy}`);
  const themePath = join(copy, 'src', 'advent', 'theme.mjs');
  // A repository that has ALREADY launched (flags true, guards deleted) is copied as it is: the steps below then change nothing, and a guard
  // that is missing is expected. In an unlaunched repository a missing guard is an error (the checklist and the script have drifted).
  const alreadyLaunched = LAUNCH_FLAGS.every((flag) => new RegExp(`^[ ]*${flag}:[ ]*true,`, 'm').test(readFileSync(themePath, 'utf8')));
  flipFlags(themePath);
  log(`flipped ${LAUNCH_FLAGS.join(', ')} to true`);
  for (const file of GUARD_FILES) { rmSync(join(copy, file), { force: alreadyLaunched }); log(`deleted ${file}`); }
  if (!alreadyLaunched || readFileSync(join(copy, GUARD_TEST.file), 'utf8').includes(GUARD_TEST.name)) {
    removeGuardTest(join(copy, GUARD_TEST.file), GUARD_TEST.name);
    log(`removed the guard test "${GUARD_TEST.name}" from ${GUARD_TEST.file}`);
  }
  const { changed } = applyAfterLaunch(copy);
  log(changed.length > 0 ? `applied the after-launch wording to ${changed.join(' and ')}` : 'the after-launch wording was already applied');
  // Step 9 of the checklist (a person writes the real launch date into CLAUDE.md): the copy gets today's date.
  const claudePath = join(copy, 'CLAUDE.md');
  const claude = readFileSync(claudePath, 'utf8');
  if (claude.includes('date of the launch commit: ____')) {
    writeFileSync(claudePath, claude.replace('date of the launch commit: ____', `date of the launch commit: ${new Date().toISOString().slice(0, 10)}`));
    log('filled in the launch date in CLAUDE.md');
  }
  return { temp, copy };
}

/** Removes a temporary folder made by makeLaunchedCopy (and refuses to remove anything else). */
export function removeTemp(temp) {
  const folder = resolve(temp);
  if (!folder.startsWith(resolve(tmpdir()) + sep) || !/advent-rehearsal-/.test(folder) || folder.startsWith(ROOT + sep)) throw new Error(`refusing to remove ${folder}`);
  rmSync(folder, { recursive: true, force: true });
}
