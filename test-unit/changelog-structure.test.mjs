// The changelog (src/pages/updates.html) is checked by the pre-commit hook; these tests check the checker
// (scripts/hook-lib.mjs) and that the real changelog is well formed at all times.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { changelogProblems, formatBuildNumber, isDerived, nextBuildNumber, parseChangelog, tagFor } from '../scripts/hook-lib.mjs';

const root = join(import.meta.dirname, '..');
const li = (build, extra = '') => `<li><div class="changelog-meta"><span class="changelog-build">${build}</span></div><p>text${extra}</p></li>`;
const page = (...items) => `<ul class="changelog">${items.join('\n')}</ul>`;

describe('the real src/pages/updates.html', () => {
  const html = readFileSync(join(root, 'src', 'pages', 'updates.html'), 'utf8');
  const { entries, problems } = parseChangelog(html);

  test('is well formed: one build number per entry, no empty or nested entries, strictly newest first', () => {
    assert.deepEqual(problems, []);
    assert.ok(entries.length > 100);
  });

  test('its top entry is the current build number, or the one the next commit will get', () => {
    const saved = JSON.parse(readFileSync(join(root, 'build-number.json'), 'utf8'));
    const current = formatBuildNumber(saved);
    // While a commit is being prepared the entry for the NEXT build is already at the top (the hook insists on it).
    const next = formatBuildNumber(nextBuildNumber(saved));
    assert.ok([current, next].includes(entries[0]), `top entry ${entries[0]} is neither ${current} nor ${next}`);
  });
});

describe('parseChangelog', () => {
  test('accepts a well-formed list', () => {
    assert.deepEqual(parseChangelog(page(li('2026.10.14.002'), li('2026.10.14.001'), li('2026.10.13.030'))), { entries: ['2026.10.14.002', '2026.10.14.001', '2026.10.13.030'], problems: [] });
  });
  test('rejects an empty entry', () => {
    assert.match(parseChangelog(page(li('2026.10.14.002'), '<li>\n</li>')).problems.join(), /empty/);
  });
  test('rejects a nested entry', () => {
    assert.match(parseChangelog(page(li('2026.10.14.002', `<ul>${li('2026.10.14.001')}</ul>`))).problems.join(), /nested/);
  });
  test('rejects an entry with no build number or two of them', () => {
    assert.match(parseChangelog(page('<li><p>no number</p></li>')).problems.join(), /0 changelog-build/);
    assert.match(parseChangelog(page(li('2026.10.14.002').replace('</div>', '<span class="changelog-build">2026.10.14.001</span></div>'))).problems.join(), /2 changelog-build/);
  });
  test('rejects an unclosed entry', () => {
    assert.match(parseChangelog(page('<li><span class="changelog-build">2026.10.14.002</span>')).problems.join(), /never closed/);
  });
  test('rejects a malformed number, a repeat, and the wrong order', () => {
    assert.match(parseChangelog(page(li('2026.10.14.2'))).problems.join(), /malformed/);
    assert.match(parseChangelog(page(li('2026.10.14.002'), li('2026.10.14.002'))).problems.join(), /not older/);
    assert.match(parseChangelog(page(li('2026.10.14.001'), li('2026.10.14.002'))).problems.join(), /not older/);
  });
  test('reports a page with no changelog list', () => {
    assert.match(parseChangelog('<p>nothing</p>').problems.join(), /no <ul/);
  });
});

describe('changelogProblems', () => {
  test('passes when the top entry is the expected build', () => {
    assert.deepEqual(changelogProblems(page(li('2026.10.14.005'), li('2026.10.14.004')), '2026.10.14.005'), []);
  });
  test('says which number was expected and which was found', () => {
    assert.match(changelogProblems(page(li('2026.10.14.004')), '2026.10.14.005').join(), /top changelog entry is 2026\.10\.14\.004 but this commit will be build 2026\.10\.14\.005/);
  });
});

describe('build numbers', () => {
  const at = (y, m, d) => new Date(y, m - 1, d, 12);
  test('same day adds one, a new day starts at 001, and nothing is written', () => {
    const saved = { date: '2026.10.14', build: 4 };
    assert.equal(formatBuildNumber(nextBuildNumber(saved, at(2026, 10, 14))), '2026.10.14.005');
    assert.equal(formatBuildNumber(nextBuildNumber(saved, at(2026, 10, 15))), '2026.10.15.001');
    assert.equal(formatBuildNumber(nextBuildNumber(null, at(2026, 1, 2))), '2026.01.02.001');
    assert.deepEqual(saved, { date: '2026.10.14', build: 4 });
  });
  test('the tag is build- plus the number', () => {
    assert.equal(tagFor({ date: '2026.10.14', build: 4 }), 'build-2026.10.14.004');
  });
});

describe('isDerived', () => {
  test('lists what the build writes and nothing hand-maintained', () => {
    for (const file of ['public/index.html', 'public/sitemap.xml', 'public/search-index.json', 'public/js/calendar-events.js']) assert.ok(isDerived(file), file);
    for (const file of ['public/css/style.css', 'public/img/x.png', 'src/pages/index.html', 'public/_headers', 'public/js/search-ui.js']) assert.ok(!isDerived(file), file);
  });
});
