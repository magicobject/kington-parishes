// The date basis shared by the build and the commit hook (scripts/build-date.mjs).
// The build drops calendar events that have already happened, so its output depends on the date. See docs/hooks.md.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { londonDate, resolveBuildDate } from '../scripts/build-date.mjs';
import { formatBuildNumber, nextBuildNumber } from '../scripts/hook-lib.mjs';
import { sameApartFromEvents } from '../scripts/ci-drift-check.mjs';

const ROOT = join(import.meta.dirname, '..');

describe('londonDate', () => {
  test('is the Europe/London calendar date, in winter and in summer', () => {
    assert.equal(londonDate(new Date('2026-01-15T23:30:00Z')), '2026-01-15');
    assert.equal(londonDate(new Date('2026-07-15T23:30:00Z')), '2026-07-16'); // 00:30 BST the next day
    assert.equal(londonDate(new Date('2026-07-15T22:59:00Z')), '2026-07-15');
  });
  test('the commit hook numbers builds by the same date', () => {
    assert.equal(formatBuildNumber(nextBuildNumber(null, new Date('2026-07-15T23:30:00Z'))), '2026.07.16.001');
    assert.equal(formatBuildNumber(nextBuildNumber({ date: '2026.07.16', build: 3 }, new Date('2026-07-15T23:30:00Z'))), '2026.07.16.004');
  });
});

describe('resolveBuildDate', () => {
  const now = new Date('2026-10-14T12:00:00Z');
  test('defaults to today in London', () => {
    assert.equal(resolveBuildDate({}, now), '2026-10-14');
    assert.equal(resolveBuildDate({ BUILD_DATE: '' }, now), '2026-10-14');
  });
  test('BUILD_DATE overrides it', () => {
    assert.equal(resolveBuildDate({ BUILD_DATE: '2027-03-01' }, now), '2027-03-01');
  });
  test('BUILD_DATE must be a real YYYY-MM-DD date', () => {
    for (const bad of ['tomorrow', '2026-13-01', '2026-02-30', '26-10-14', '2026-10-14T00:00', '2026/10/14']) assert.throws(() => resolveBuildDate({ BUILD_DATE: bad }, now), /BUILD_DATE/, bad);
  });
});

describe('a real build on two different dates', () => {
  test('only the calendar page changes: the date-dependent part is the Event list in public/calendar.html', () => {
    // A copy of the repository without the big PDFs and walking guides (the build only reads them to hash CSS and scripts).
    const copy = mkdtempSync(join(tmpdir(), 'build-date-'));
    try {
      const SKIP_TOP = new Set(['node_modules', '.git', 'test-results', 'playwright-report', '.claude', '.wrangler', 'test', 'docs']);
      const BIG = ['public/parish-news', 'public/pilgrim-paths'];
      cpSync(ROOT, copy, { recursive: true, filter: (source) => { const rel = source.slice(ROOT.length + 1).split(sep); return !(rel.length === 1 && SKIP_TOP.has(rel[0])) && !BIG.includes(rel.join('/')); } });
      cpSync(join(ROOT, 'node_modules'), join(copy, 'node_modules'), { recursive: true, filter: (source) => { const rel = source.slice(join(ROOT, 'node_modules').length + 1).split(sep)[0]; return ['', 'node-html-parser', 'boolbase', 'css-select', 'css-what', 'dom-serializer', 'domelementtype', 'domhandler', 'domutils', 'entities', 'nth-check', 'he'].includes(rel); } });
      const build = (date) => {
        const result = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: copy, encoding: 'utf8', env: { ...process.env, BUILD_DATE: date } });
        assert.equal(result.status, 0, result.stdout + result.stderr);
        const files = new Map();
        for (const name of readdirSync(join(copy, 'public')).filter((n) => /\.(html|xml|json)$/.test(n))) files.set(name, readFileSync(join(copy, 'public', name), 'utf8'));
        files.set('js/calendar-events.js', readFileSync(join(copy, 'public', 'js', 'calendar-events.js'), 'utf8'));
        return files;
      };
      const early = build('2020-01-01');
      const late = build('2099-01-01');
      const changed = [...early.keys()].filter((name) => early.get(name) !== late.get(name));
      assert.deepEqual(changed, ['calendar.html']);
      assert.ok((early.get('calendar.html').match(/"@type":\s*"Event"/g) ?? []).length > (late.get('calendar.html').match(/"@type":\s*"Event"/g) ?? []).length, 'later date lists fewer events');
      assert.ok(sameApartFromEvents(early.get('calendar.html'), late.get('calendar.html')), 'the CI drift check accepts the difference');
      // and the same date twice is byte-identical
      const again = build('2099-01-01');
      for (const [name, text] of late) assert.equal(again.get(name), text, name);
    } finally {
      rmSync(copy, { recursive: true, force: true });
    }
  });
});
