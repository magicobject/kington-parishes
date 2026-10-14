// BUILD-LEVEL check that the calendar's page address cannot take another page's name. The unit test in advent-hardening.test.mjs
// calls buildAdvent directly; this one runs the real scripts/build.mjs in a temporary copy of the repository with the theme's slug
// set to the name of every other page in src/pages.config.mjs, and demands that the build stops. (An earlier version of the build
// removed the clashing page from the list by slug before the check ran, so the clash passed silently and the calendar page replaced
// the other page.)
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PAGES, adventPage } from '../src/pages.config.mjs';

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const SKIP_TOP = new Set(['node_modules', '.git', 'test-results', 'playwright-report', '.claude', '.wrangler']);
// What the build needs from node_modules (node-html-parser and its dependencies), copied, never linked.
const PACKAGES = ['node-html-parser', 'boolbase', 'css-select', 'css-what', 'dom-serializer', 'domelementtype', 'domhandler', 'domutils', 'entities', 'nth-check'];

const temp = mkdtempSync(join(tmpdir(), 'advent-slug-build-'));
const copy = join(temp, 'repo');
after(() => rmSync(temp, { recursive: true, force: true }));

cpSync(ROOT, copy, {
  recursive: true,
  filter: (source) => {
    const rel = source.slice(ROOT.length + 1).split(sep);
    return !(rel.length === 1 && SKIP_TOP.has(rel[0])) && rel.join('/') !== 'docs/advent/art-drafts';
  },
});
for (const name of PACKAGES) {
  if (existsSync(join(ROOT, 'node_modules', name))) cpSync(join(ROOT, 'node_modules', name), join(copy, 'node_modules', name), { recursive: true });
}
const themePath = join(copy, 'src', 'advent', 'theme.mjs');
const original = readFileSync(themePath, 'utf8');
const build = (slug) => {
  writeFileSync(themePath, original.replace("slug: 'advent',", `slug: '${slug}',`));
  return spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: copy, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
};

describe('the calendar page name against every other page (real build, temporary copy)', () => {
  test('the pages config exposes the calendar entry, and it is in the page list exactly once', () => {
    assert.equal(PAGES.filter((page) => page === adventPage).length, 1);
  });

  test('the unchanged theme builds (control)', () => {
    const result = build('advent');
    assert.equal(result.status, 0, result.stderr.slice(-600));
  });

  const others = PAGES.filter((page) => page !== adventPage).map((page) => page.slug);
  test('there is a real list of other pages to try', () => {
    assert.ok(others.length > 20, `only ${others.length} other pages`);
  });

  for (const name of others) {
    test(`slug "${name}" stops the build`, () => {
      const result = build(name);
      assert.notEqual(result.status, 0, `the build SUCCEEDED with the calendar slug set to "${name}", so one page replaced the other`);
      assert.match(`${result.stdout}${result.stderr}`, /already used by another page|clashes with a reserved page name/);
    });
  }
});
