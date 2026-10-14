// The mechanical launch steps, as data AND as the code that performs them in a COPY of the repository. Used by
// scripts/advent-rehearse.mjs and scripts/advent-launched-copy.mjs (the browser test of the launched site), and cross-checked
// against docs/advent/launch-checklist.md by test-unit/advent-launch-rehearsal.test.mjs, so the scripts and the checklist cannot
// drift apart. Nothing here ever writes outside the temporary folder it makes: every change is made in the copy.
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyAfterLaunch } from './advent-after-launch-edits.mjs';

export const LAUNCH_FLAGS = ['goLive', 'publicListing', 'artRequired']; // flipped false -> true in modules/advent/theme.mjs
export const GUARD_FILES = ['test-unit/advent-prelaunch.test.mjs', 'test/advent-prelaunch.spec.ts']; // deleted outright
export const GUARD_TEST = { file: 'test/sitemap.spec.ts', name: 'PRE-LAUNCH: the sitemap and the search index do not mention the Advent calendar' }; // removed from the end of the file

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_TOP = new Set(['node_modules', '.git', 'test-results', 'playwright-report', '.claude', '.wrangler']);
// The packages the build and the unit tests need (node-html-parser and what it depends on). The test runners and
// browsers are not needed and are large.
const PACKAGES = ['node-html-parser', 'boolbase', 'css-select', 'css-what', 'dom-serializer', 'domelementtype', 'domhandler', 'domutils', 'entities', 'nth-check'];

export function flipFlags(themePath) {
  let text = readFileSync(themePath, 'utf8');
  for (const flag of LAUNCH_FLAGS) {
    const pattern = new RegExp(`^([ ]*${flag}:[ ]*)false(,)`, 'm');
    if (!pattern.test(text)) throw new Error(`rehearsal: could not find "${flag}: false," in the copy of theme.mjs`);
    text = text.replace(pattern, '$1true$2');
  }
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
 * deletions, and the after-launch wording. Returns { temp, copy, log }. The caller builds in the copy and must call removeTemp(temp).
 */
export function makeLaunchedCopy({ log = () => {} } = {}) {
  const temp = mkdtempSync(join(tmpdir(), 'advent-rehearsal-'));
  if (resolve(temp).startsWith(ROOT + sep)) throw new Error('rehearsal: the temporary folder must be outside the repository');
  const copy = join(temp, 'repo');
  cpSync(ROOT, copy, { recursive: true, filter: (source) => { const rel = source.slice(ROOT.length + 1).split(sep); return !(rel.length === 1 && SKIP_TOP.has(rel[0])) && !(rel.join('/') === 'docs/advent/art-drafts'); } });
  for (const name of PACKAGES) {
    const from = join(ROOT, 'node_modules', name);
    if (existsSync(from)) cpSync(from, join(copy, 'node_modules', name), { recursive: true });
  }
  log(`rehearsing the launch in a copy: ${copy}`);
  flipFlags(join(copy, 'modules', 'advent', 'theme.mjs'));
  log(`flipped ${LAUNCH_FLAGS.join(', ')} to true`);
  for (const file of GUARD_FILES) { rmSync(join(copy, file), { force: false }); log(`deleted ${file}`); }
  removeGuardTest(join(copy, GUARD_TEST.file), GUARD_TEST.name);
  log(`removed the guard test "${GUARD_TEST.name}" from ${GUARD_TEST.file}`);
  log(`applied the after-launch wording to ${applyAfterLaunch(copy).join(' and ')}`);
  return { temp, copy };
}

/** Removes a temporary folder made by makeLaunchedCopy (and refuses to remove anything else). */
export function removeTemp(temp) {
  const folder = resolve(temp);
  if (!folder.startsWith(resolve(tmpdir()) + sep) || !/advent-rehearsal-/.test(folder) || folder.startsWith(ROOT + sep)) throw new Error(`refusing to remove ${folder}`);
  rmSync(folder, { recursive: true, force: true });
}
