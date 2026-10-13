// LAUNCH REHEARSAL (npm run advent:rehearse). Copies the working tree to a temporary folder, performs the mechanical launch
// steps there exactly as docs/advent/launch-checklist.md lists them (flip the three flags, delete the three guard tests),
// builds, and runs the unit suite. Prints PASS or FAIL. It never writes to the real repository: every change is made in the
// copy, the copy has no links into the real tree (only the few small packages the build needs are copied from node_modules),
// and the temporary folder is removed at the end.
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GUARD_FILES, GUARD_TEST, LAUNCH_FLAGS } from './advent-launch-steps.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_TOP = new Set(['node_modules', '.git', 'test-results', 'playwright-report', '.claude', '.wrangler']);
// The packages the build and the unit tests need (node-html-parser and what it depends on). The test runners and
// browsers are not needed for the unit suite and are large.
const PACKAGES = ['node-html-parser', 'boolbase', 'css-select', 'css-what', 'dom-serializer', 'domelementtype', 'domhandler', 'domutils', 'entities', 'nth-check'];

function flipFlags(themePath) {
  let text = readFileSync(themePath, 'utf8');
  for (const flag of LAUNCH_FLAGS) {
    const pattern = new RegExp(`^([ ]*${flag}:[ ]*)false(,)`, 'm');
    if (!pattern.test(text)) throw new Error(`rehearsal: could not find "${flag}: false," in the copy of theme.mjs`);
    text = text.replace(pattern, '$1true$2');
  }
  writeFileSync(themePath, text);
}

function removeGuardTest(path, name) {
  const text = readFileSync(path, 'utf8');
  const at = text.indexOf(`test('${name}'`);
  if (at < 0) throw new Error(`rehearsal: the guard test "${name}" is not in ${path}`);
  const commentStart = text.lastIndexOf('\n\n', at);
  writeFileSync(path, `${text.slice(0, commentStart >= 0 ? commentStart : at).trimEnd()}\n`);
}

function run(copy, args, label) {
  console.log(`\n--- ${label}: node ${args.join(' ')}`);
  const result = spawnSync(process.execPath, args, { cwd: copy, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return result;
}

const temp = mkdtempSync(join(tmpdir(), 'advent-rehearsal-'));
if (resolve(temp).startsWith(ROOT + sep)) throw new Error('rehearsal: the temporary folder must be outside the repository');
let ok = false;
try {
  const copy = join(temp, 'repo');
  cpSync(ROOT, copy, { recursive: true, filter: (source) => { const rel = source.slice(ROOT.length + 1).split(sep); return !(rel.length === 1 && SKIP_TOP.has(rel[0])) && !(rel.join('/') === 'docs/advent/art-drafts'); } });
  for (const name of PACKAGES) {
    const from = join(ROOT, 'node_modules', name);
    if (existsSync(from)) cpSync(from, join(copy, 'node_modules', name), { recursive: true });
  }
  console.log(`rehearsing the launch in a copy: ${copy}`);

  flipFlags(join(copy, 'modules', 'advent', 'theme.mjs'));
  console.log(`flipped ${LAUNCH_FLAGS.join(', ')} to true`);
  for (const file of GUARD_FILES) { rmSync(join(copy, file), { force: false }); console.log(`deleted ${file}`); }
  // This test describes the repo BEFORE launch (the guards exist), so it has no meaning in the launched copy.
  rmSync(join(copy, 'test-unit/advent-launch-rehearsal.test.mjs'), { force: false });
  removeGuardTest(join(copy, GUARD_TEST.file), GUARD_TEST.name);
  console.log(`removed the guard test "${GUARD_TEST.name}" from ${GUARD_TEST.file}`);

  const build = run(copy, ['scripts/build.mjs'], 'build');
  if (build.status !== 0) { console.log(build.stdout.split('\n').slice(-5).join('\n')); console.log(build.stderr); throw new Error('the build FAILED with the flags flipped'); }
  console.log('build ok');

  const tests = readdirSync(join(copy, 'test-unit')).length; // (a sanity check that the unit tests were copied)
  const unit = run(copy, ['--test', 'test-unit/**/*.test.mjs'], `unit suite (${tests} entries in test-unit)`);
  const summary = unit.stdout.split('\n').filter((line) => /^\u2139 (tests|suites|pass|fail|cancelled|skipped)/.test(line) || /^# (tests|pass|fail|cancelled|skipped)/.test(line));
  const failures = unit.stdout.split('\n').filter((line) => /^\s*\u2716 /.test(line)).slice(0, 40);
  console.log(summary.join('\n'));
  if (failures.length > 0) console.log(`failing:\n${failures.join('\n')}`);
  const failed = Number((summary.find((l) => /fail /.test(l)) ?? '').replace(/\D/g, ''));
  const cancelled = Number((summary.find((l) => /cancelled/.test(l)) ?? '').replace(/\D/g, ''));
  ok = unit.status === 0 && failed === 0 && cancelled === 0;
} finally {
  rmSync(temp, { recursive: true, force: true });
  console.log(`\nremoved the temporary copy (${existsSync(temp) ? 'FAILED to remove' : 'gone'})`);
}
console.log(ok ? '\nREHEARSAL PASS: with the three flags true and the three guards removed, the build and every unit test pass.' : '\nREHEARSAL FAIL: see above.');
process.exit(ok ? 0 : 1);
