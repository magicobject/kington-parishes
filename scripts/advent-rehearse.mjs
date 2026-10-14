// LAUNCH REHEARSAL (npm run advent:rehearse). Copies the working tree to a temporary folder, performs the mechanical launch
// steps there exactly as docs/advent/launch-checklist.md lists them (flip the three flags, delete the guard tests, apply the
// after-launch wording), builds, and runs the tests there. Prints PASS or FAIL. It never writes to the real repository: every
// change is made in the copy (see scripts/advent-launch-steps.mjs), the copy has no links into the real tree (node_modules is
// COPIED, never linked), and the temporary folder is removed at the end.
//
// Two stages run in the launched copy and BOTH must pass: the unit suite, and then the whole browser suite (`npm test`,
// Playwright, about 90 seconds, on its own port so it can never reuse a server from the real repository). The browser specs that
// depend on the launched state (search, advent, advent-fixes, advent-fixes2, accessibility, sitemap, page-content and the
// rest) are all in it. Pass `--unit-only` for the quick unit stage alone (the checklist's step 5 says to run the full rehearsal).
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeLaunchedCopy, removeTemp } from './advent-launch-steps.mjs';

const unitOnly = process.argv.includes('--unit-only');
const INFO = String.fromCharCode(0x2139); // the "i" the Node test runner puts before its summary lines
const CROSS = String.fromCharCode(0x2716); // and the cross before a failing test

function run(copy, args, label, env = process.env) {
  console.log(`\n--- ${label}: node ${args.join(' ')}`);
  return spawnSync(process.execPath, args, { cwd: copy, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env });
}

let temp = null;
let ok = false;
try {
  const made = makeLaunchedCopy({ log: console.log, fullNodeModules: !unitOnly });
  temp = made.temp;
  const { copy } = made;

  const build = run(copy, ['scripts/build.mjs'], 'build');
  if (build.status !== 0) { console.log(build.stdout.split('\n').slice(-5).join('\n')); console.log(build.stderr); throw new Error('the build FAILED with the flags flipped'); }
  console.log('build ok');

  const tests = readdirSync(join(copy, 'test-unit')).length; // (a sanity check that the unit tests were copied)
  const unit = run(copy, ['--test', 'test-unit/**/*.test.mjs'], `unit suite (${tests} entries in test-unit)`);
  const summary = unit.stdout.split('\n').filter((line) => line.startsWith(`${INFO} `) && /(tests|suites|pass|fail|cancelled|skipped) \d+/.test(line));
  const failures = unit.stdout.split('\n').filter((line) => line.trimStart().startsWith(`${CROSS} `)).slice(0, 40);
  console.log(summary.join('\n'));
  if (failures.length > 0) console.log(`failing:\n${failures.join('\n')}`);
  const failed = Number((summary.find((line) => /fail \d+/.test(line)) ?? '').replace(/\D/g, ''));
  const cancelled = Number((summary.find((line) => /cancelled \d+/.test(line)) ?? '').replace(/\D/g, ''));
  ok = unit.status === 0 && failed === 0 && cancelled === 0;

  if (ok && !unitOnly) {
    const started = Date.now();
    const port = String(4400 + (process.pid % 400));
    const env = { ...process.env, PW_PORT: port };
    delete env.CI;
    const browser = run(copy, [join('node_modules', '@playwright', 'test', 'cli.js'), 'test', '--reporter=line'], `browser suite (port ${port})`, env);
    const seconds = Math.round((Date.now() - started) / 1000);
    const text = `${browser.stdout}\n${browser.stderr}`;
    console.log(text.split('\n').filter((line) => /^\s*\d+ (passed|failed|skipped|flaky|did not run)/.test(line) || /^\s+\d+\) /.test(line)).slice(-40).join('\n'));
    const passed = Number((/(\d+) passed/.exec(text) ?? [])[1] ?? 0);
    console.log(`kington-parishes (launched copy): ${passed} passed in ${seconds}s`);
    ok = browser.status === 0 && passed > 0;
  }
} finally {
  if (temp) {
    removeTemp(temp);
    console.log(`\nremoved the temporary copy (${existsSync(temp) ? 'FAILED to remove' : 'gone'})`);
  }
}
console.log(ok ? '\nREHEARSAL PASS: with the three flags true, the three guards removed and the after-launch wording applied, the build, every unit test and the whole browser suite pass.' : '\nREHEARSAL FAIL: see above.');
process.exit(ok ? 0 : 1);
