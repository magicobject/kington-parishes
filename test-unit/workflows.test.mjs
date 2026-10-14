// Guards on the GitHub Actions workflows themselves: a workflow is code with
// write access to the repo, so it gets the same scrutiny as any other code.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', '.github', 'workflows');
// Workflows held to the pinning/permissions guards below. The others are
// deliberately NOT listed yet because they don't comply: claude.yml and
// claude-code-review.yml use tag-pinned actions (@v4, @v1), and
// volunteer-edit.yml (a synced copy of SiteAdmin's) does too. Add each one
// here once it's pinned to commit SHAs.
const GUARDED = ['ci.yml', 'vuln-watch.yml'];
const workflows = readdirSync(dir).filter((f) => GUARDED.includes(f)).map((f) => ({ file: f, text: readFileSync(join(dir, f), 'utf8') }));

describe('guarded workflows', () => {
  test('every guarded workflow exists', () => {
    assert.deepEqual(workflows.map((w) => w.file).sort(), [...GUARDED].sort());
  });

  for (const { file, text } of workflows) {
    test(`${file}: every action is pinned to a full commit SHA, not a movable tag`, () => {
      const uses = [...text.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)].map((m) => m[1]);
      assert.ok(uses.length > 0);
      for (const ref of uses) assert.match(ref, /@[0-9a-f]{40}$/, `${file}: ${ref} is not pinned to a commit`);
    });

    test(`${file}: declares its permissions explicitly, and never grants write-all`, () => {
      assert.match(text, /^permissions:/m);
      assert.doesNotMatch(text, /write-all/);
    });
  }
});

describe('ci.yml', () => {
  const text = readFileSync(join(dir, 'ci.yml'), 'utf8');
  // every line of every run step, including the lines of a multi-line "run: |" block
  const runLines = text.split('\n').filter((line) => /^\s*(- )?run:/.test(line) || /^\s{10,}\S/.test(line));

  test('runs on pull requests and on pushes to main', () => {
    assert.match(text, /^on:\n\s+pull_request:/m);
    assert.match(text, /push:\n\s+branches: \[main\]/);
  });

  test('is read-only, has no secrets, and has a timeout and a concurrency group', () => {
    assert.match(text, /^permissions:\n\s+contents: read\n/m);
    assert.doesNotMatch(text, /: write/);
    assert.doesNotMatch(text, /secrets\./);
    assert.doesNotMatch(text, /GH_TOKEN|github\.token/);
    assert.match(text, /^concurrency:\n\s+group: /m);
    assert.match(text, /timeout-minutes: 20\b/);
  });

  test('puts no event text or any other expression inside a run step', () => {
    assert.ok(runLines.length > 5);
    for (const line of runLines) assert.doesNotMatch(line, /\$\{\{/, line);
    assert.doesNotMatch(text, /github\.event|head_ref|pull_request\.title/);
  });

  test('checks out without keeping credentials, and installs without package install scripts', () => {
    assert.match(text, /persist-credentials: false/);
    assert.match(text, /npm ci --ignore-scripts/);
    assert.match(text, /node-version: 24/);
  });

  test('runs the build, the drift check, the unit tests, the type check, the browser suite and the audit, in that order', () => {
    const steps = ['npm run build', 'node scripts/ci-drift-check.mjs', 'npm run test:unit', 'npm run typecheck', 'npm test', 'npm run audit'];
    const at = steps.map((step) => text.indexOf(step));
    assert.ok(at.every((i) => i >= 0), `missing: ${steps.filter((_, i) => at[i] < 0)}`);
    assert.deepEqual([...at].sort((a, b) => a - b), at);
  });

  test('uses only the two actions vuln-watch.yml already uses, at the very same pinned commits', () => {
    const vuln = readFileSync(join(dir, 'vuln-watch.yml'), 'utf8');
    for (const action of ['actions/checkout', 'actions/setup-node']) {
      const pin = (t) => new RegExp(`${action}@[0-9a-f]{40}`).exec(t)?.[0];
      assert.ok(pin(text));
      assert.equal(pin(text), pin(vuln));
    }
    assert.deepEqual([...text.matchAll(/uses:\s*([^@\s]+)/g)].map((m) => m[1]).sort(), ['actions/checkout', 'actions/setup-node']);
  });
});

describe('vuln-watch.yml', () => {
  const text = readFileSync(join(dir, 'vuln-watch.yml'), 'utf8');

  test('runs daily and can be run on demand', () => {
    assert.match(text, /schedule:\s*\n\s*- cron: '\d+ \d+ \* \* \*'/);
    assert.match(text, /workflow_dispatch:/);
  });

  test('can only read code and write issues', () => {
    assert.match(text, /contents: read/);
    assert.match(text, /issues: write/);
    assert.doesNotMatch(text, /contents: write|pull-requests: write/);
  });

  test('installs without running package install scripts', () => {
    assert.match(text, /npm ci --ignore-scripts/);
  });
});

test('Dependabot watches both npm packages and the pinned actions', () => {
  const path = join(import.meta.dirname, '..', '.github', 'dependabot.yml');
  assert.ok(existsSync(path));
  const text = readFileSync(path, 'utf8');
  assert.match(text, /package-ecosystem: "?npm"?/);
  assert.match(text, /package-ecosystem: "?github-actions"?/);
});
