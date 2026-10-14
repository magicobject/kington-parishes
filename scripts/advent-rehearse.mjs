// LAUNCH REHEARSAL (npm run advent:rehearse). Copies the working tree to a temporary folder, performs the mechanical launch
// steps there exactly as docs/advent/launch-checklist.md lists them (flip the three flags, delete the guard tests, apply the
// after-launch wording), builds, and runs the unit suite. Prints PASS or FAIL. It never writes to the real repository: every
// change is made in the copy (see scripts/advent-launch-steps.mjs), the copy has no links into the real tree (only the few
// small packages the build needs are copied from node_modules), and the temporary folder is removed at the end.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeLaunchedCopy, removeTemp } from './advent-launch-steps.mjs';

function run(copy, args, label) {
  console.log(`\n--- ${label}: node ${args.join(' ')}`);
  return spawnSync(process.execPath, args, { cwd: copy, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

let temp = null;
let ok = false;
try {
  const made = makeLaunchedCopy({ log: console.log });
  temp = made.temp;
  const { copy } = made;

  const build = run(copy, ['scripts/build.mjs'], 'build');
  if (build.status !== 0) { console.log(build.stdout.split('\n').slice(-5).join('\n')); console.log(build.stderr); throw new Error('the build FAILED with the flags flipped'); }
  console.log('build ok');

  const tests = readdirSync(join(copy, 'test-unit')).length; // (a sanity check that the unit tests were copied)
  const unit = run(copy, ['--test', 'test-unit/**/*.test.mjs'], `unit suite (${tests} entries in test-unit)`);
  const summary = unit.stdout.split('\n').filter((line) => /^ℹ (tests|suites|pass|fail|cancelled|skipped)/.test(line) || /^# (tests|pass|fail|cancelled|skipped)/.test(line));
  const failures = unit.stdout.split('\n').filter((line) => /^\s*✖ /.test(line)).slice(0, 40);
  console.log(summary.join('\n'));
  if (failures.length > 0) console.log(`failing:\n${failures.join('\n')}`);
  const failed = Number((summary.find((l) => /fail /.test(l)) ?? '').replace(/\D/g, ''));
  const cancelled = Number((summary.find((l) => /cancelled/.test(l)) ?? '').replace(/\D/g, ''));
  ok = unit.status === 0 && failed === 0 && cancelled === 0;
} finally {
  if (temp) {
    removeTemp(temp);
    console.log(`\nremoved the temporary copy (${existsSync(temp) ? 'FAILED to remove' : 'gone'})`);
  }
}
console.log(ok ? '\nREHEARSAL PASS: with the three flags true, the three guards removed and the after-launch wording applied, the build and every unit test pass.' : '\nREHEARSAL FAIL: see above.');
process.exit(ok ? 0 : 1);
