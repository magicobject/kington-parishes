// scripts/ci-drift-check.mjs: CI's check that the committed public/ equals a fresh build, apart from the calendar's
// Event structured data (which depends on the date the build ran on). Date-independent by design.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { driftProblems, sameApartFromEvents, withoutEvents } from '../scripts/ci-drift-check.mjs';

const event = (name) => ({ '@context': 'https://schema.org', '@type': 'Event', name, startDate: '2026-10-16T10:00:00' });
const ld = (value) => `<script type="application/ld+json">${JSON.stringify(value)}</script>\n`;
const page = (body, ...blocks) => `<head>${blocks.join('')}</head><body>${body}</body>\n`;
const WITH = page('list', '\n', ld([event('One'), event('Two')]));
const WITHOUT = page('list', '\n');

describe('sameApartFromEvents', () => {
  test('identical pages pass', () => assert.ok(sameApartFromEvents(WITH, WITH)));
  test('a different list of events passes, including none at all', () => {
    assert.ok(sameApartFromEvents(WITH, WITHOUT));
    assert.ok(sameApartFromEvents(WITH, page('list', '\n', ld([event('Three')]))));
  });
  test('a difference outside the event block fails', () => {
    assert.ok(!sameApartFromEvents(WITH, WITH.replace('list', 'a different list')));
    assert.ok(!sameApartFromEvents(WITH, WITH.replace('<head>', '<head><title>new</title>')));
  });
  test('other structured data is compared, only Events are ignored', () => {
    const org = { '@context': 'https://schema.org', '@type': 'Organization', name: 'A' };
    const a = page('x', ld([org, event('One')]));
    assert.ok(sameApartFromEvents(a, page('x', ld([org]))));
    assert.ok(!sameApartFromEvents(a, page('x', ld([{ ...org, name: 'B' }, event('One')]))));
  });
  test('a block that cannot be read is compared as it is', () => {
    const broken = '<script type="application/ld+json">{not json</script>\n';
    assert.ok(!sameApartFromEvents(page('x', broken), page('x', broken.replace('not', 'other'))));
    assert.ok(sameApartFromEvents(page('x', broken), page('x', broken)));
  });
  test('withoutEvents removes a block that held only events', () => assert.equal(withoutEvents(WITH), WITHOUT));
});

describe('driftProblems', () => {
  test('nothing changed: no problems', () => assert.deepEqual(driftProblems([''], WITH, WITH), []));
  test('only the calendar page changed, only in its events: no problems', () => assert.deepEqual(driftProblems([' M public/calendar.html'], WITH, WITHOUT), []));
  test('the calendar page changed elsewhere: a problem', () => assert.equal(driftProblems([' M public/calendar.html'], WITH, WITH.replace('list', 'x')).length, 1));
  test('any other file changed or new: a problem, even beside an allowed calendar change', () => {
    const problems = driftProblems([' M public/calendar.html', ' M public/index.html', '?? public/new.html'], WITH, WITHOUT);
    assert.equal(problems.length, 2);
    assert.match(problems.join('\n'), /public\/index\.html/);
    assert.match(problems.join('\n'), /public\/new\.html/);
  });
  test('a calendar page that was never committed is a problem', () => assert.equal(driftProblems(['?? public/calendar.html'], undefined, WITH).length, 1));
});

describe('the command, in a throwaway repository', () => {
  const run = (calendarAfterBuild, extra = () => {}) => {
    const dir = mkdtempSync(join(tmpdir(), 'drift-'));
    try {
      const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
      git('init', '-q');
      git('config', 'user.email', 'a@b.invalid');
      git('config', 'user.name', 'A');
      mkdirSync(join(dir, 'public'));
      mkdirSync(join(dir, 'scripts'));
      cpSync(join(import.meta.dirname, '..', 'scripts', 'ci-drift-check.mjs'), join(dir, 'scripts', 'ci-drift-check.mjs'));
      writeFileSync(join(dir, 'public', 'calendar.html'), WITH);
      writeFileSync(join(dir, 'public', 'index.html'), 'home');
      git('add', '-A');
      git('commit', '-q', '-m', 'built');
      writeFileSync(join(dir, 'public', 'calendar.html'), calendarAfterBuild); // "a fresh build"
      extra(dir);
      return spawnSync(process.execPath, ['scripts/ci-drift-check.mjs'], { cwd: dir, encoding: 'utf8' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  test('identical build: passes', () => assert.equal(run(WITH).status, 0));
  test('only the events differ: passes', () => assert.equal(run(WITHOUT).status, 0));
  test('the calendar differs elsewhere: fails and names it', () => {
    const result = run(WITH.replace('list', 'changed'));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /public\/calendar\.html/);
  });
  test('another file differs: fails and names it', () => {
    const result = run(WITH, (dir) => writeFileSync(join(dir, 'public', 'index.html'), 'home, edited'));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /public\/index\.html/);
  });
  test('a new generated file: fails', () => assert.equal(run(WITH, (dir) => writeFileSync(join(dir, 'public', 'extra.html'), 'x')).status, 1));
});
