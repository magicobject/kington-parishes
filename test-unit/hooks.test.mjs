// The git hooks (.githooks/*, scripts/pre-commit.mjs, scripts/post-commit.mjs), tested in THROWAWAY repositories
// created under the operating system's temp folder: the real repository is only read (the hook files are copied from
// it). Each throwaway repo gets the real hook files plus a tiny stand-in for scripts/build.mjs that turns
// src/pages/*.html into public/*.html, so no real build is needed. See docs/hooks.md.
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { formatBuildNumber, nextBuildNumber } from '../scripts/hook-lib.mjs';

const REAL = join(import.meta.dirname, '..');
const STUB_BUILD = `
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
if (process.env.STUB_BUILD_FAILS) { console.error('stub build failed'); process.exit(1); }
mkdirSync('public', { recursive: true });
for (const name of readdirSync('src/pages')) writeFileSync('public/' + name, 'built from ' + readFileSync('src/pages/' + name, 'utf8'));
writeFileSync('public/sitemap.xml', 'sitemap of ' + readdirSync('src/pages').join(','));
`;

const entry = (build) => `<li>
          <div class="changelog-meta"><span class="changelog-build">${build}</span><span class="changelog-author">Test Person</span><span class="changelog-date">1 January 2000</span></div>
          <p>Something changed.</p>
        </li>`;
const updatesPage = (...builds) => `<ul class="changelog">\n${builds.map(entry).join('\n')}\n</ul>\n`;

let dir;
let expected; // the build number the next hooked commit will get

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: dir, encoding: 'utf8', env: { ...process.env, ...options.env }, input: options.input });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}
const git = (...args) => run('git', args);
const write = (path, text) => { mkdirSync(join(dir, path, '..'), { recursive: true }); writeFileSync(join(dir, path), text); };
const read = (path) => readFileSync(join(dir, path), 'utf8');
const commit = (message, env, paths = []) => run('git', ['commit', '-m', message, ...paths], { env });
const committedFiles = (rev = 'HEAD') => git('show', '--name-only', '--format=', rev).out.split('\n').filter(Boolean).sort();
const tags = () => git('tag', '--list').out.split('\n').filter(Boolean);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hooks-test-'));
  git('init', '-q');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'Test Person');
  git('config', 'core.hooksPath', '.githooks');
  git('config', 'core.autocrlf', 'false');
  cpSync(join(REAL, '.githooks'), join(dir, '.githooks'), { recursive: true });
  mkdirSync(join(dir, 'scripts'));
  for (const name of ['hook-lib.mjs', 'build-date.mjs', 'pre-commit.mjs', 'post-commit.mjs', 'bump-build-number.mjs']) cpSync(join(REAL, 'scripts', name), join(dir, 'scripts', name));
  write('scripts/build.mjs', STUB_BUILD);
  for (const name of ['a', 'b', 'c', 'd', 'e']) write(`node_modules/${name}/package.json`, '{}');
  write('.gitignore', 'node_modules/\n');
  write('package.json', '{}');
  write('build-number.json', JSON.stringify({ date: '2000.01.01', build: 7 }, null, 2) + '\n');
  expected = formatBuildNumber(nextBuildNumber({ date: '2000.01.01', build: 7 }));
  write('src/pages/index.html', 'home v1');
  write('src/pages/other.html', 'other v1');
  write('src/pages/updates.html', updatesPage('2000.01.01.007'));
  write('public/css/style.css', 'body{}');
  // The first commit goes in with the hook switched off; the stand-in build gives the generated pages.
  run('node', ['scripts/build.mjs']);
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', 'start');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('pre-commit', () => {
  test('a clean commit passes and holds exactly the staged files plus the regenerated ones', () => {
    write('src/pages/index.html', 'home v2');
    write('src/pages/updates.html', updatesPage(expected, '2000.01.01.007'));
    git('add', 'src/pages/index.html', 'src/pages/updates.html');
    const result = commit('change home');
    assert.equal(result.status, 0, result.out);
    assert.deepEqual(committedFiles(), ['build-number.json', 'public/index.html', 'public/updates.html', 'src/pages/index.html', 'src/pages/updates.html']);
    assert.match(read('public/index.html'), /home v2/);
    assert.deepEqual(JSON.parse(read('build-number.json')), nextBuildNumber({ date: '2000.01.01', build: 7 }));
    assert.equal(git('status', '--porcelain').out, '');
  });

  test('refuses to build while a source file has unstaged changes, and says which', () => {
    write('src/pages/index.html', 'home v2');
    write('src/pages/updates.html', updatesPage(expected, '2000.01.01.007'));
    git('add', 'src/pages/index.html', 'src/pages/updates.html');
    write('src/pages/other.html', 'other, half finished');
    const result = commit('change home');
    assert.notEqual(result.status, 0);
    assert.match(result.out, /COMMIT REFUSED/);
    assert.match(result.out, /unstaged change: src\/pages\/other\.html/);
    assert.match(result.out, /separate git worktree/);
    assert.equal(read('src/pages/other.html'), 'other, half finished');
    assert.equal(JSON.parse(read('build-number.json')).build, 7, 'the build number was not bumped');
  });

  test('refuses an unstaged change to a hand-maintained file under public/', () => {
    write('src/pages/updates.html', updatesPage(expected, '2000.01.01.007'));
    git('add', 'src/pages/updates.html');
    write('public/css/style.css', 'body{color:red}');
    const result = commit('x');
    assert.notEqual(result.status, 0);
    assert.match(result.out, /unstaged change: public\/css\/style\.css/);
  });

  test('refuses an untracked file in a folder the build reads', () => {
    write('src/pages/updates.html', updatesPage(expected, '2000.01.01.007'));
    git('add', 'src/pages/updates.html');
    write('src/pages/new-page.html', 'not added yet');
    const result = commit('x');
    assert.notEqual(result.status, 0);
    assert.match(result.out, /untracked file: src\/pages\/new-page\.html/);
  });

  test('another session\'s modified generated page is not swept into the commit: the commit is refused and the file is left alone', () => {
    write('src/pages/updates.html', updatesPage(expected, '2000.01.01.007'));
    git('add', 'src/pages/updates.html');
    write('public/other.html', 'half-finished page from another session');
    const result = commit('x');
    assert.notEqual(result.status, 0);
    assert.match(result.out, /do not|does not reproduce|not reproduce/);
    assert.match(result.out, /public\/other\.html/);
    assert.equal(read('public/other.html'), 'half-finished page from another session');
    assert.equal(JSON.parse(read('build-number.json')).build, 7);
    assert.equal(git('log', '--oneline').out.split('\n').filter(Boolean).length, 1, 'no commit was made');
  });

  test('a modified generated file that the build does not rewrite is not staged either: the commit is refused', () => {
    write('public/js/calendar-events.js', 'v1');
    git('add', 'public/js/calendar-events.js');
    git('commit', '-q', '--no-verify', '-m', 'track it');
    write('public/js/calendar-events.js', 'v2, somebody else is editing');
    write('src/pages/updates.html', updatesPage(expected, '2000.01.01.007'));
    git('add', 'src/pages/updates.html');
    const result = commit('x');
    assert.notEqual(result.status, 0);
    assert.match(result.out, /public\/js\/calendar-events\.js/);
    assert.equal(read('public/js/calendar-events.js'), 'v2, somebody else is editing');
  });

  test('an untracked generated file that the build does not create is not staged either', () => {
    write('public/js/calendar-events.js', 'brand new, from somewhere else');
    write('src/pages/updates.html', updatesPage(expected, '2000.01.01.007'));
    git('add', 'src/pages/updates.html');
    const result = commit('x');
    assert.notEqual(result.status, 0);
    assert.equal(read('public/js/calendar-events.js'), 'brand new, from somewhere else');
  });

  test('generated pages you already rebuilt by hand do not block the commit', () => {
    write('src/pages/index.html', 'home v2');
    write('src/pages/updates.html', updatesPage(expected, '2000.01.01.007'));
    git('add', 'src/pages/index.html', 'src/pages/updates.html');
    write('public/index.html', 'built from home v2'); // what the build will produce
    const result = commit('change home');
    assert.equal(result.status, 0, result.out);
    assert.match(git('show', 'HEAD:public/index.html').out, /home v2/);
  });

  test('a failing build puts the build number back and makes no commit', () => {
    write('src/pages/updates.html', updatesPage(expected, '2000.01.01.007'));
    git('add', 'src/pages/updates.html');
    const result = commit('x', { STUB_BUILD_FAILS: '1' });
    assert.notEqual(result.status, 0);
    assert.equal(JSON.parse(read('build-number.json')).build, 7);
    assert.equal(git('status', '--porcelain').out.trim(), 'M  src/pages/updates.html');
  });

  test('aborts when the top changelog entry is missing (the staged page is unchanged)', () => {
    write('src/pages/index.html', 'home v2');
    git('add', 'src/pages/index.html');
    const result = commit('no entry');
    assert.notEqual(result.status, 0);
    assert.match(result.out, new RegExp(`top changelog entry is 2000\\.01\\.01\\.007 but this commit will be build ${expected.replace(/\./g, '\\.')}`));
    assert.equal(JSON.parse(read('build-number.json')).build, 7);
  });

  test('aborts when the entry has the wrong build number', () => {
    write('src/pages/updates.html', updatesPage('2000.01.01.099', '2000.01.01.007'));
    git('add', 'src/pages/updates.html');
    const result = commit('wrong');
    assert.notEqual(result.status, 0);
    assert.match(result.out, /2000\.01\.01\.099/);
    assert.match(result.out, new RegExp(`build ${expected.replace(/\./g, '\\.')}`));
  });

  test('aborts when the changelog is malformed (two build numbers in one entry)', () => {
    const doubled = entry(expected).replace('</div>', '<span class="changelog-build">2000.01.01.007</span></div>');
    write('src/pages/updates.html', `<ul class="changelog">\n${doubled}\n${entry('2000.01.01.007')}\n</ul>\n`);
    git('add', 'src/pages/updates.html');
    const result = commit('malformed');
    assert.notEqual(result.status, 0);
    assert.match(result.out, /exactly 1/);
  });

  test('uses the STAGED changelog: an entry that is only in the working copy does not count', () => {
    write('src/pages/updates.html', updatesPage(expected, '2000.01.01.007'));
    const result = commit('forgot to stage it', {});
    assert.notEqual(result.status, 0);
  });

  test('aborts when node_modules is empty', () => {
    rmSync(join(dir, 'node_modules'), { recursive: true });
    mkdirSync(join(dir, 'node_modules'));
    write('src/pages/updates.html', updatesPage(expected, '2000.01.01.007'));
    git('add', 'src/pages/updates.html');
    const result = commit('x');
    assert.notEqual(result.status, 0);
    assert.match(result.out, /node_modules has only 0 entries/);
    assert.match(result.out, /npm ci/);
  });

  test('aborts when node_modules is missing', () => {
    rmSync(join(dir, 'node_modules'), { recursive: true });
    write('src/pages/updates.html', updatesPage(expected, '2000.01.01.007'));
    git('add', 'src/pages/updates.html');
    const result = commit('x');
    assert.notEqual(result.status, 0);
    assert.match(result.out, /node_modules is missing/);
  });

  test('HOOK_ALLOW_UNSTAGED=1 warns loudly, lets the commit through, and still never stages the unstaged source', () => {
    write('src/pages/updates.html', updatesPage(expected, '2000.01.01.007'));
    git('add', 'src/pages/updates.html');
    write('src/pages/other.html', 'other, half finished');
    const result = commit('with hatch', { HOOK_ALLOW_UNSTAGED: '1' });
    assert.equal(result.status, 0, result.out);
    assert.match(result.out, /WARNING: HOOK_ALLOW_UNSTAGED=1/);
    assert.ok(!committedFiles().includes('src/pages/other.html'));
    assert.equal(git('show', 'HEAD:src/pages/other.html').out, 'other v1');
  });
});

describe('post-commit', () => {
  test('tags the commit with its build number once, and never moves the tag', () => {
    write('src/pages/updates.html', updatesPage(expected, '2000.01.01.007'));
    git('add', 'src/pages/updates.html');
    const first = commit('one');
    assert.equal(first.status, 0, first.out);
    assert.deepEqual(tags(), ['build-2000.01.01.007', `build-${expected}`]); // (the first is the 'start' commit's)
    assert.match(first.out, new RegExp(`git push origin build-${expected.replace(/\./g, '\\.')}`));
    const firstSha = git('rev-parse', `build-${expected}^{commit}`).out.trim();

    // a second commit that skips the pre-commit hook keeps the same build number: the tag must stay where it is
    write('src/pages/index.html', 'home v3');
    git('add', 'src/pages/index.html');
    const second = run('git', ['commit', '--no-verify', '-m', 'two']);
    assert.equal(second.status, 0, second.out);
    assert.match(second.out, /already exists on/);
    assert.equal(git('rev-parse', `build-${expected}^{commit}`).out.trim(), firstSha);
    assert.deepEqual(tags(), ['build-2000.01.01.007', `build-${expected}`]); // (the first is the 'start' commit's)
  });

  test('does not fail the commit when there is no build-number.json', () => {
    git('rm', '-q', 'build-number.json');
    const result = run('git', ['commit', '--no-verify', '-m', 'no number']);
    assert.equal(result.status, 0, result.out);
    assert.ok(!existsSync(join(dir, 'build-number.json')));
  });
});

describe('pre-push', () => {
  test('is a plain shell script that runs the audit, the unit tests and the type check, and names the failing check', () => {
    const text = readFileSync(join(REAL, '.githooks', 'pre-push'), 'utf8');
    for (const command of ['npm run audit', 'npm run test:unit', 'npm run typecheck']) assert.ok(text.includes(command), command);
    assert.match(text, /npm test/); // the reminder about the browser suite
    assert.match(text, /failed, so the push is blocked/);
  });

  test('runs the unit tests for a branch push but not for a tags-only push', () => {
    // A stand-in `npm` on the PATH records what the hook asked for.
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'npm'), '#!/bin/sh\necho "npm $*" >> "$NPM_LOG"\nexit 0\n', { mode: 0o755 });
    const env = { PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`, NPM_LOG: join(dir, 'npm.log') };
    const hook = join(dir, '.githooks', 'pre-push');
    const sha = '1'.repeat(40);
    const zero = '0'.repeat(40);

    const branch = run('sh', [hook], { env, input: `refs/heads/main ${sha} refs/heads/main ${zero}\n` });
    assert.equal(branch.status, 0, branch.out);
    assert.match(readFileSync(join(dir, 'npm.log'), 'utf8'), /npm run audit\nnpm run test:unit\nnpm run typecheck\n/);

    rmSync(join(dir, 'npm.log'));
    const tag = run('sh', [hook], { env, input: `refs/tags/build-x ${sha} refs/tags/build-x ${zero}\n` });
    assert.equal(tag.status, 0, tag.out);
    assert.equal(readFileSync(join(dir, 'npm.log'), 'utf8'), 'npm run audit\n');
  });

  test('a failing check blocks the push and says which one', () => {
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'npm'), '#!/bin/sh\ncase "$*" in *typecheck*) exit 1;; esac\nexit 0\n', { mode: 0o755 });
    const env = { PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}` };
    const result = run('sh', [join(dir, '.githooks', 'pre-push')], { env, input: `refs/heads/main ${'1'.repeat(40)} refs/heads/main ${'0'.repeat(40)}\n` });
    assert.notEqual(result.status, 0);
    assert.match(result.out, /the type check \(npm run typecheck\) failed/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Second round (tester findings B1 B3 G1 G2 G3 G4 N1 N3): partial commits, amends, duplicate numbers, what counts as a
// build input, the sweep mutation, other git operations, worktrees.

const stageEntry = () => {
  write('src/pages/updates.html', updatesPage(expected, '2000.01.01.007'));
  git('add', 'src/pages/updates.html');
};

describe('pre-commit: every way of asking git to commit (R1)', () => {
  const EXPECTED_FILES = ['build-number.json', 'public/index.html', 'public/updates.html', 'src/pages/index.html', 'src/pages/updates.html'];
  const entriesBelow = (text = read('src/pages/updates.html')) => [...text.matchAll(/changelog-build">([^<]+)</g)].map((m) => m[1]);
  const nextEntry = () => formatBuildNumber(nextBuildNumber(JSON.parse(read('build-number.json'))));
  const tracked = (file, text) => { write(file, text); git('add', file); git('commit', '-q', '--no-verify', '-m', 'add ' + file); };
  // edits src/pages/index.html and writes the changelog entry, both UNSTAGED
  const edit = () => {
    const below = entriesBelow();
    write('src/pages/index.html', 'home v2');
    write('src/pages/updates.html', updatesPage(nextEntry(), ...below));
  };
  const finish = (result, label) => {
    assert.equal(result.status, 0, `${label}: ${result.out}`);
    assert.deepEqual(committedFiles(), EXPECTED_FILES, label);
    // the real index must match the commit (no reversed "MM" states) and nothing generated is left unstaged
    assert.equal(git('diff', '--cached', '--name-only').out.trim(), '', `${label}: index differs from HEAD`);
    assert.doesNotMatch(git('status', '--porcelain').out, /public\//, label);
    assert.match(git('show', 'HEAD:public/index.html').out, /home v2/);
    // and an ordinary commit afterwards works
    const below = entriesBelow();
    write('src/pages/index.html', 'home v3');
    write('src/pages/updates.html', updatesPage(nextEntry(), ...below));
    git('add', 'src/pages/index.html', 'src/pages/updates.html');
    const follow = commit('follow-up');
    assert.equal(follow.status, 0, `${label}: follow-up: ${follow.out}`);
    assert.deepEqual(committedFiles(), EXPECTED_FILES, `${label}: follow-up files`);
  };
  const cases = [
    ['git commit -a -m', [], ['commit', '-a', '-m', 'x'], true],
    ['git commit -am', [], ['commit', '-am', 'x'], true],
    ['git commit --all -m', [], ['commit', '--all', '-m', 'x'], true],
    ['git commit FILE FILE (a path commit)', [], ['commit', '-m', 'x', 'src/pages/updates.html', 'src/pages/index.html'], false],
    ['git commit --only FILE FILE', [], ['commit', '--only', '-m', 'x', 'src/pages/updates.html', 'src/pages/index.html'], false],
    ['git commit -i FILE (include)', ['src/pages/index.html'], ['commit', '-i', '-m', 'x', 'src/pages/updates.html'], false],
    ['plain git commit after git add', ['src/pages/index.html', 'src/pages/updates.html'], ['commit', '-m', 'x'], false],
  ];
  for (const [label, staged, args, isAll] of cases) {
    test(`${label}: commits exactly the right files and leaves a consistent index`, () => {
      tracked('README.md', 'readme');
      edit();
      if (staged.length) git('add', ...staged);
      if (!isAll) write('README.md', 'readme, an unstaged remainder'); // -a would commit it, so only the other cases have one
      finish(run('git', args), label);
      if (!isAll) {
        assert.equal(read('README.md'), 'readme, an unstaged remainder');
        assert.match(git('status', '--porcelain').out, / M README\.md/);
      }
    });
  }

  test('git commit -a still refuses an untracked file the build reads (git add it first)', () => {
    edit();
    write('src/pages/brand-new.html', 'not tracked');
    const result = run('git', ['commit', '-a', '-m', 'x']);
    assert.notEqual(result.status, 0);
    assert.match(result.out, /untracked file: src\/pages\/brand-new\.html/);
  });

  test('git commit -a also commits tracked README changes (that is what -a means)', () => {
    tracked('README.md', 'readme');
    edit();
    write('README.md', 'readme edited');
    const result = run('git', ['commit', '-a', '-m', 'x']);
    assert.equal(result.status, 0, result.out);
    assert.deepEqual(committedFiles(), [...EXPECTED_FILES, 'README.md'].sort());
    assert.equal(git('status', '--porcelain').out, '');
  });

  test('git commit --amend -a with nothing new passes as a message-only amend', () => {
    edit();
    assert.equal(run('git', ['commit', '-a', '-m', 'first']).status, 0);
    const result = run('git', ['commit', '--amend', '-a', '-m', 'reworded']);
    assert.equal(result.status, 0, result.out);
    assert.match(result.out, /nothing staged differs/);
    assert.equal(git('status', '--porcelain').out, '');
  });

  test('git commit --allow-empty passes without a build', () => {
    const before = read('build-number.json');
    const result = run('git', ['commit', '--allow-empty', '-m', 'empty']);
    assert.equal(result.status, 0, result.out);
    assert.equal(read('build-number.json'), before);
  });

  test('in a second worktree git commit -a and a path commit both work', () => {
    const second = `${dir}-wt2`;
    try {
      assert.equal(git('worktree', 'add', '-q', second, '-b', 'second').status, 0);
      cpSync(join(dir, 'node_modules'), join(second, 'node_modules'), { recursive: true });
      const inSecond = (...args) => spawnSync('git', args, { cwd: second, encoding: 'utf8' });
      const below = entriesBelow();
      writeFileSync(join(second, 'src/pages/index.html'), 'home v2');
      writeFileSync(join(second, 'src/pages/updates.html'), updatesPage(nextEntry(), ...below));
      const viaAll = inSecond('commit', '-a', '-m', 'all');
      assert.equal(viaAll.status, 0, `${viaAll.stdout}${viaAll.stderr}`);
      assert.equal(inSecond('status', '--porcelain').stdout, '');
      const secondNumber = formatBuildNumber(nextBuildNumber(JSON.parse(readFileSync(join(second, 'build-number.json'), 'utf8'))));
      writeFileSync(join(second, 'src/pages/index.html'), 'home v3');
      writeFileSync(join(second, 'src/pages/updates.html'), updatesPage(secondNumber, ...entriesBelow(readFileSync(join(second, 'src/pages/updates.html'), 'utf8'))));
      const viaPath = inSecond('commit', '-m', 'path', 'src/pages/index.html', 'src/pages/updates.html');
      assert.equal(viaPath.status, 0, `${viaPath.stdout}${viaPath.stderr}`);
      assert.equal(inSecond('status', '--porcelain').stdout, '');
    } finally {
      git('worktree', 'remove', '--force', second);
      rmSync(second, { recursive: true, force: true });
    }
  });

  test('a path commit that leaves another staged build input out is refused, and changes nothing', () => {
    edit();
    write('src/pages/other.html', 'other v2');
    git('add', 'src/pages/other.html');
    const result = run('git', ['commit', '-m', 'x', 'src/pages/updates.html', 'src/pages/index.html']);
    assert.notEqual(result.status, 0);
    assert.equal(JSON.parse(read('build-number.json')).build, 7);
    assert.match(git('status', '--porcelain').out, /^M {2}src\/pages\/other\.html/m);
  });
});

describe('pre-commit: amend (B3)', () => {
  const hooked = () => {
    write('src/pages/index.html', 'home v2');
    stageEntry();
    git('add', 'src/pages/index.html');
    const first = commit('first');
    assert.equal(first.status, 0, first.out);
  };

  test('a message-only amend passes and changes neither the build number nor the tag', () => {
    hooked();
    const tagSha = git('rev-parse', `build-${expected}^{commit}`).out.trim();
    const before = read('build-number.json');
    const result = run('git', ['commit', '--amend', '-m', 'better words']);
    assert.equal(result.status, 0, result.out);
    assert.match(result.out, /nothing staged differs from the last commit/);
    assert.equal(read('build-number.json'), before);
    assert.equal(git('log', '-1', '--format=%s').out.trim(), 'better words');
    // the old commit is gone, so post-commit says how to move the tag (it never moves it itself)
    assert.equal(git('rev-parse', `build-${expected}^{commit}`).out.trim(), tagSha);
    assert.match(result.out, new RegExp(`git tag -f build-${expected.replace(/\./g, '\\.')} HEAD`));
  });

  test('an amend that changes files is refused with the exact commands to run', () => {
    hooked();
    write('src/pages/index.html', 'home v3');
    git('add', 'src/pages/index.html');
    const result = run('git', ['commit', '--amend', '--no-edit']);
    assert.notEqual(result.status, 0);
    assert.match(result.out, /If you are AMENDING the last commit/);
    for (const line of ['npm run build', 'git add public', 'git commit --amend --no-verify', `git tag -f build-${expected} HEAD`]) assert.ok(result.out.includes(line), line);
  });

  test('after the recommended amend --no-verify, post-commit prints the git tag -f command and moves nothing', () => {
    hooked();
    write('src/pages/index.html', 'home v3');
    git('add', 'src/pages/index.html');
    const tagSha = git('rev-parse', `build-${expected}^{commit}`).out.trim();
    const result = run('git', ['commit', '--amend', '--no-verify', '--no-edit']);
    assert.equal(result.status, 0, result.out);
    assert.match(result.out, /no longer part of this branch/);
    assert.ok(result.out.includes(`git tag -f build-${expected} HEAD`));
    assert.equal(git('rev-parse', `build-${expected}^{commit}`).out.trim(), tagSha);
  });
});

describe('pre-commit: build numbers must be unique (G1)', () => {
  test('refuses when the tag for the next number already exists on another commit, and says what to do', () => {
    git('tag', `build-${expected}`, 'HEAD');
    write('src/pages/index.html', 'home v2');
    git('add', 'src/pages/index.html');
    stageEntry();
    const result = commit('collides');
    assert.notEqual(result.status, 0);
    assert.match(result.out, new RegExp(`build number ${expected.replace(/\./g, '\\.')} is already used by commit`));
    assert.match(result.out, /git pull/);
    assert.equal(JSON.parse(read('build-number.json')).build, 7);
  });
});

describe('pre-commit: only files that feed the build block a commit (G2)', () => {
  for (const [file, text] of [['README.md', 'edited'], ['CLAUDE.md', 'edited'], ['docs/hooks.md', 'edited'], ['test/a.spec.ts', 'edited'], ['test-unit/a.test.mjs', 'edited']]) {
    test(`an unstaged change to ${file} does not block, and stays unstaged afterwards`, () => {
      write(file, 'first');
      git('add', file);
      git('commit', '-q', '--no-verify', '-m', 'add');
      write(file, text);
      stageEntry();
      const result = commit('x');
      assert.equal(result.status, 0, result.out);
      assert.equal(read(file), text);
      assert.match(git('status', '--porcelain').out, new RegExp(` M ${file.replace(/[./]/g, '\\$&')}`));
      assert.ok(!committedFiles().includes(file));
    });
  }

  for (const file of ['package.json', 'templates/page.html', 'public/css/style.css', 'src/pages/other.html']) {
    test(`an unstaged change to ${file} does block, and the message says what blocks`, () => {
      write(file, 'changed again');
      stageEntry();
      const result = commit('x');
      assert.notEqual(result.status, 0);
      assert.match(result.out, /some files the build reads have changes that are not part of this commit/);
      assert.match(result.out, new RegExp(`unstaged change: ${file.replace(/[./]/g, '\\$&')}|untracked file: ${file.replace(/[./]/g, '\\$&')}`));
      assert.match(result.out, /git add FILE/);
    });
  }
});

describe('pre-commit: nothing unstaged is ever swept in (G3)', () => {
  test('with HOOK_ALLOW_UNSTAGED=1 an unstaged hand-maintained public file stays out of the commit and stays unstaged', () => {
    write('src/pages/index.html', 'home v2');
    git('add', 'src/pages/index.html');
    stageEntry();
    write('public/css/style.css', 'body{color:hotpink}');
    write('public/img/new.png', 'untracked image');
    const result = commit('hatch', { HOOK_ALLOW_UNSTAGED: '1' });
    assert.equal(result.status, 0, result.out);
    assert.ok(!committedFiles().includes('public/css/style.css'));
    assert.ok(!committedFiles().includes('public/img/new.png'));
    assert.equal(git('show', 'HEAD:public/css/style.css').out, 'body{}');
    const status = git('status', '--porcelain').out;
    assert.match(status, / M public\/css\/style\.css/);
    assert.match(status, /\?\? public\/img\//);
  });
});

describe('pre-commit: friendly messages (N1 N3)', () => {
  test('an entry that is in the working copy but not staged says: git add src/pages/updates.html', () => {
    write('src/pages/updates.html', updatesPage(expected, '2000.01.01.007'));
    write('src/pages/index.html', 'home v2');
    git('add', 'src/pages/index.html');
    const result = commit('x');
    assert.notEqual(result.status, 0);
    assert.match(result.out, /in your working copy but not staged: run {2}git add src\/pages\/updates\.html/);
  });

  test('with no node on the PATH the hook says so in plain words', () => {
    const empty = join(dir, 'empty-path').split(sep).join('/');
    mkdirSync(empty);
    const hook = (name) => join(dir, '.githooks', name).split(sep).join('/');
    // (sourced inside one shell with an emptied PATH, so only shell built-ins are available)
    const result = run('sh', ['-c', `PATH='${empty}'; . '${hook('pre-commit')}'`]);
    assert.notEqual(result.status, 0);
    assert.match(result.out, /Node\.js was not found/);
    const post = run('sh', ['-c', `PATH='${empty}'; . '${hook('post-commit')}'`]);
    assert.equal(post.status, 0);
    assert.match(post.out, /Node\.js was not found/);
  });
});

describe('pre-commit: other git operations', () => {
  test('CRLF line endings in the working tree (autocrlf on, LF in the repository) do not trip the hook', () => {
    git('config', 'core.autocrlf', 'true');
    write('.gitattributes', '* text=auto eol=lf\n');
    git('add', '.gitattributes');
    git('commit', '-q', '--no-verify', '-m', 'attrs');
    write('src/pages/updates.html', updatesPage(expected, '2000.01.01.007').replace(/\n/g, '\r\n'));
    write('src/pages/index.html', 'home v2\r\n');
    git('add', 'src/pages/updates.html', 'src/pages/index.html');
    write('src/pages/other.html', 'other v1'); // identical content, rewritten: not a change
    const result = commit('crlf');
    assert.equal(result.status, 0, result.out);
    assert.ok(!git('show', 'HEAD:src/pages/updates.html').out.includes('\r'));
  });

  test('resolving a merge conflict and committing runs the hook and wants a fresh entry', () => {
    const branch = git('branch', '--show-current').out.trim();
    git('checkout', '-q', '-b', 'side');
    write('src/pages/other.html', 'side version');
    git('add', 'src/pages/other.html');
    git('commit', '-q', '--no-verify', '-m', 'side');
    git('checkout', '-q', branch);
    write('src/pages/other.html', 'main version');
    git('add', 'src/pages/other.html');
    git('commit', '-q', '--no-verify', '-m', 'main');
    const merge = git('merge', 'side');
    assert.notEqual(merge.status, 0);
    write('src/pages/other.html', 'resolved');
    git('add', 'src/pages/other.html');
    const noEntry = commit('merge');
    assert.notEqual(noEntry.status, 0);
    assert.match(noEntry.out, /not ready for build/);
    const next = formatBuildNumber(nextBuildNumber({ date: '2000.01.01', build: 7 }));
    write('src/pages/updates.html', updatesPage(next, '2000.01.01.007'));
    git('add', 'src/pages/updates.html');
    const done = commit('merge');
    assert.equal(done.status, 0, done.out);
    assert.equal(git('rev-list', '--parents', '-n', '1', 'HEAD').out.trim().split(' ').length, 3, 'it is a merge commit');
  });

  test('git revert of a build commit goes through without a new tag or an error', () => {
    write('src/pages/index.html', 'home v2');
    git('add', 'src/pages/index.html');
    stageEntry();
    assert.equal(commit('change').status, 0);
    const before = tags();
    const result = run('git', ['revert', '--no-edit', 'HEAD']);
    assert.equal(result.status, 0, result.out);
    assert.deepEqual(tags(), before);
  });

  test('a commit made in a second worktree (with its own node_modules) works the same way', () => {
    const second = `${dir}-wt`;
    try {
      assert.equal(git('worktree', 'add', '-q', second, '-b', 'second').status, 0);
      cpSync(join(dir, 'node_modules'), join(second, 'node_modules'), { recursive: true });
      const inSecond = (...args) => spawnSync('git', args, { cwd: second, encoding: 'utf8' });
      writeFileSync(join(second, 'src/pages/index.html'), 'home in worktree');
      writeFileSync(join(second, 'src/pages/updates.html'), updatesPage(expected, '2000.01.01.007'));
      inSecond('add', 'src/pages');
      const result = inSecond('commit', '-m', 'worktree');
      assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
      assert.match(readFileSync(join(second, 'public/index.html'), 'utf8'), /home in worktree/);
      assert.ok(inSecond('tag', '--list').stdout.includes(`build-${expected}`));
      assert.equal(JSON.parse(read('build-number.json')).build, 7, 'the first folder was not touched');
    } finally {
      git('worktree', 'remove', '--force', second);
      rmSync(second, { recursive: true, force: true });
    }
  });
});

describe('pre-push: registry and deletes (G4)', () => {
  const withNpm = (script) => {
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'npm'), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
    return { PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`, NPM_LOG: join(dir, 'npm.log') };
  };
  const branchPush = `refs/heads/main ${'1'.repeat(40)} refs/heads/main ${'0'.repeat(40)}\n`;

  test('an unreachable registry is called a network problem, and the push is still blocked', () => {
    const env = withNpm('echo "npm error audit endpoint returned an error" >&2; exit 1');
    const result = run('sh', [join(dir, '.githooks', 'pre-push')], { env, input: branchPush });
    assert.notEqual(result.status, 0);
    assert.match(result.out, /could not reach the npm registry/);
    assert.match(result.out, /network problem, not a vulnerability/);
    assert.match(result.out, /git push --no-verify/);
  });

  test('a real vulnerability is still reported as one', () => {
    const env = withNpm('echo "1 high severity vulnerability"; exit 1');
    const result = run('sh', [join(dir, '.githooks', 'pre-push')], { env, input: branchPush });
    assert.notEqual(result.status, 0);
    assert.match(result.out, /npm audit \(high\/critical vulnerabilities\) failed/);
  });

  test('a push that only deletes remote branches runs no checks', () => {
    const env = withNpm('echo "npm $*" >> "$NPM_LOG"; exit 1');
    const result = run('sh', [join(dir, '.githooks', 'pre-push')], { env, input: `(delete) ${'0'.repeat(40)} refs/heads/old ${'1'.repeat(40)}\n` });
    assert.equal(result.status, 0, result.out);
    assert.ok(!existsSync(join(dir, 'npm.log')));
  });
});
