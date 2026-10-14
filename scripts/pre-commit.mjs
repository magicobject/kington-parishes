#!/usr/bin/env node
// The pre-commit hook (run by .githooks/pre-commit). Plain-English version: docs/hooks.md.
//
// DESIGN. After this hook runs, the commit holds exactly
//     (what the committer staged)  +  (derived files rebuilt from those staged sources)  +  build-number.json
// and never anything else. To keep that true without ever building from, or committing, someone else's work:
//   0. A tag for the next build number must not already exist (another branch or worktree used it).
//   1. node_modules must be populated (it has been found empty twice, cause unknown).
//   2. The staged changelog must have a well-formed top entry for the build number this commit will get (computed
//      without writing it).
//   3. No file that feeds the build (see isBuildInput in scripts/hook-lib.mjs) may have unstaged changes, and no untracked file may sit in a folder the build reads. Such
//      work would be built into the pages but left out of the commit. The hook refuses and names the files.
//      ("Source" = anything that is not a derived file; derived files are listed in scripts/hook-lib.mjs.)
//   4. Derived files that already have unstaged changes are remembered and reset to their staged state before the
//      build. Afterwards each must hold exactly what the build produced (e.g. you ran `npm run build` by hand and the
//      pages are simply up to date); if not, the file was somebody's other work: everything is put back exactly as
//      it was and the commit is refused (nothing is swept up or lost).
//   5. Only then: bump build-number.json, run the build, and `git add` the derived files that changed plus
//      build-number.json (a derived file the build did not rewrite is never staged). Because step 3 guarantees the working tree sources equal the staged sources, the build
//      output is the build of the staged sources.
// If anything fails after the bump, the build number and every file the build touched are restored.
// Two kinds of commit are handled before any of that. A commit that changes nothing in the tree (a message-only amend)
// passes untouched. For commits that name files (git commit FILE, --only) git gives the hook a temporary index
// (.git/next-index-NNN.lock) holding HEAD plus those files, and keeps the real index in .git/index.lock to put in place
// afterwards; the hook stages its regenerated files into BOTH, so the real index is consistent after the commit (staging
// into the temporary one alone leaves the real index holding the old pages: a reversed "MM" state). For -a and -i git
// uses .git/index.lock itself, and for a plain commit .git/index: nothing special is needed. An amend that changes files cannot be told apart from a commit that forgot its
// changelog entry, so the refusal for a stale top entry also lists the amend recipe.
// Escape hatch: HOOK_ALLOW_UNSTAGED=1 git commit ... skips steps 3 and 4 (loud warning). It never stages a source file.
import { execFileSync, spawnSync } from 'node:child_process';
import { basename, dirname, join } from 'node:path';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { changelogProblems, formatBuildNumber, isBuildInput, isDerived, nextBuildNumber, nodeModulesProblem, tagFor } from './hook-lib.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const gitList = (...args) => git(...args, '-z').split('\0').filter(Boolean);
const changedVsIndex = () => gitList('diff', '--name-only');
const untracked = () => gitList('ls-files', '--others', '--exclude-standard');

const allowUnstaged = process.env.HOOK_ALLOW_UNSTAGED === '1';
const say = (text) => console.error(`pre-commit: ${text}`);

function refuse(headline, details = [], advice = '') {
  say(`COMMIT REFUSED: ${headline}`);
  for (const line of details) console.error(`    ${line}`);
  if (advice) console.error(`  ${advice}`);
  process.exit(1);
}

// A commit that names files: where the real index will be after the commit (see the header).
const hookIndex = process.env.GIT_INDEX_FILE ?? '';
let realIndex = null;
if (basename(hookIndex).startsWith('next-index')) {
  realIndex = join(dirname(hookIndex), 'index.lock');
  if (!existsSync(realIndex)) refuse('this kind of commit (naming files) is not supported by this version of git.', [], 'Stage the files with "git add FILE ...", then run "git commit" with no file names. Nothing was changed.');
}

// Nothing staged differs from the last commit: a message-only amend (or an empty commit). There is nothing to build, so
// the build number is left alone. (git gives hooks no reliable "this is an amend" signal, so this is judged by content.)
if (spawnSync('git', ['diff', '--cached', '--quiet', 'HEAD']).status === 0) {
  say('nothing staged differs from the last commit (a message-only amend?): no build needed.');
  process.exit(0);
}

// 1. node_modules
const modulesProblem = nodeModulesProblem('node_modules');
if (modulesProblem) refuse(`${modulesProblem}.`, [], 'Run  npm ci  in this folder. Every checkout and worktree needs its own node_modules; it must never be linked or shared.');

// 2. changelog
const savedState = existsSync('build-number.json') ? JSON.parse(readFileSync('build-number.json', 'utf8')) : null;
const expected = formatBuildNumber(nextBuildNumber(savedState));
const taken = spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/tags/build-${expected}^{commit}`], { encoding: 'utf8' });
if (taken.status === 0) {
  refuse(`build number ${expected} is already used by commit ${taken.stdout.trim().slice(0, 7)} (another branch or session?).`, [],
    'Get the latest work first (git pull, or git rebase origin/main), then change the top entry in src/pages/updates.html to the next number and git add it.');
}
let stagedChangelog;
try { stagedChangelog = git('show', ':src/pages/updates.html'); } catch { refuse('src/pages/updates.html is not in the index.'); }
const changelogIssues = changelogProblems(stagedChangelog, expected);
if (changelogIssues.length > 0) {
  const details = [...changelogIssues];
  let used = null;
  try { used = tagFor(JSON.parse(git('show', 'HEAD:build-number.json'))); } catch { /* first commit */ }
  if (used && stagedChangelog.includes(`>${used.slice('build-'.length)}<`) && changelogProblems(stagedChangelog, used.slice('build-'.length)).length === 0) {
    details.push(`If you are AMENDING the last commit (build ${used.slice('build-'.length)}), it keeps its number. Run these in order instead:`, '  npm run build', '  git add public', '  git commit --amend --no-verify', `  git tag -f ${used} HEAD`, '(check git status before git add public: it stages everything under public/, including any hand edit there. Do not amend a commit you have already pushed; make a new commit).');
  }
  try {
    if (changelogProblems(readFileSync('src/pages/updates.html', 'utf8'), expected).length === 0) details.push(`an entry for ${expected} is in your working copy but not staged: run  git add src/pages/updates.html`);
  } catch { /* no working copy to compare */ }
  refuse(`the changelog in src/pages/updates.html is not ready for build ${expected}.`, details,
    `Add an entry for ${expected} at the TOP of src/pages/updates.html, then run  git add src/pages/updates.html  (see "Build numbers" in CLAUDE.md).`);
}

// 3. unstaged work
if (allowUnstaged) {
  say('WARNING: HOOK_ALLOW_UNSTAGED=1, so unstaged changes are NOT checked. Pages will be built from your working files, which may include work that is not in this commit. Nothing unstaged is added to the commit, but the committed pages may not match the committed sources.');
} else {
  const dirtySources = changedVsIndex().filter(isBuildInput);
  const strays = untracked().filter(isBuildInput);
  if (dirtySources.length > 0 || strays.length > 0) {
    refuse('some files the build reads have changes that are not part of this commit.', [
      ...dirtySources.map((file) => `unstaged change: ${file}`),
      ...strays.map((file) => `untracked file: ${file}`),
    ], 'Either add them to this commit (git add FILE), or set them aside (git stash), or work in a separate git worktree (docs/hooks.md). Nothing was changed.');
  }
}

// 4. remember derived files that already differ from the index, then put them back to the staged state
const snapshot = new Map();
const untrackedBefore = new Set(untracked());
const changedBefore = new Set(changedVsIndex()); // what was already modified before the hook did anything
if (!allowUnstaged) {
  const modified = [...changedBefore].filter(isDerived);
  for (const file of [...modified, ...[...untrackedBefore].filter(isDerived)]) if (existsSync(file)) snapshot.set(file, readFileSync(file));
  if (modified.length > 0) git('checkout', '--', ...modified); // named files only; rollback() writes them back
  for (const file of untrackedBefore) if (snapshot.has(file)) rmSync(file);
}

// 5. bump, build, check, stage
function rollback() {
  if (savedState) writeFileSync('build-number.json', JSON.stringify(savedState, null, 2) + '\n');
  else rmSync('build-number.json', { force: true });
  const touched = changedVsIndex().filter((file) => file !== 'build-number.json' && !snapshot.has(file) && !changedBefore.has(file));
  if (touched.length > 0) git('checkout', '--', ...touched); // named files only
  for (const file of untracked()) if (!untrackedBefore.has(file)) rmSync(file, { force: true });
  for (const [file, content] of snapshot) writeFileSync(file, content);
}
function runStep(script) {
  const result = spawnSync(process.execPath, [script], { stdio: 'inherit' });
  if (result.status !== 0) { rollback(); refuse(`"node ${script}" failed.`, [], 'The build number and generated files have been put back as they were.'); }
}
runStep('scripts/bump-build-number.mjs');
runStep('scripts/build.mjs');

const overwritten = [...snapshot].filter(([file, content]) => !existsSync(file) || !readFileSync(file).equals(content)).map(([file]) => file);
if (overwritten.length > 0) {
  rollback();
  refuse('generated files have unstaged changes that the build does not reproduce (somebody else\'s work?).', overwritten,
    'Nothing was changed. If the changes are not wanted, discard them with  git checkout -- FILE  (or add them if they belong in this commit), or work in a separate git worktree.');
}
const unexpected = changedVsIndex().filter((file) => file !== 'build-number.json' && !isDerived(file) && !changedBefore.has(file));
const unexpectedNew = untracked().filter((file) => !untrackedBefore.has(file) && !isDerived(file));
if (unexpected.length > 0 || unexpectedNew.length > 0) {
  const list = [...unexpected, ...unexpectedNew];
  rollback();
  refuse('the build wrote files that are not on the list of generated files.', list, 'Add them to scripts/hook-lib.mjs (DERIVED) if they really are generated.');
}

const toStage = [...changedVsIndex(), ...untracked()].filter(isDerived);
const stage = ['add', '--', 'build-number.json', ...toStage];
git(...stage);
if (realIndex) execFileSync('git', stage, { env: { ...process.env, GIT_INDEX_FILE: realIndex } });
say(`build ${expected}: staged build-number.json and ${toStage.length} regenerated file(s).`);
