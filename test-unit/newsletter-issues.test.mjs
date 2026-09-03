// Unit tests for scripts/newsletter-issues.mjs — pure functions, no build,
// no browser. `today` is always passed explicitly so these never depend on
// the real current date.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatIssueMonth, splitNewsletterIssues } from '../scripts/newsletter-issues.mjs';

describe('formatIssueMonth', () => {
  test('formats a YYYY-MM-DD date as "Month YYYY"', () => {
    assert.equal(formatIssueMonth('2026-10-01'), 'October 2026');
  });

  test('handles single-digit months correctly', () => {
    assert.equal(formatIssueMonth('2026-01-15'), 'January 2026');
  });
});

describe('splitNewsletterIssues', () => {
  const today = new Date('2026-09-03T00:00:00');

  test('an issue from this month is recent', () => {
    const { recent, archive } = splitNewsletterIssues([{ slug: 'a', date: '2026-09-01' }], today);
    assert.equal(recent.length, 1);
    assert.equal(archive.length, 0);
  });

  test('an issue from eight months ago is archived', () => {
    const { recent, archive } = splitNewsletterIssues([{ slug: 'a', date: '2026-01-01' }], today);
    assert.equal(recent.length, 0);
    assert.equal(archive.length, 1);
  });

  test('an issue exactly six months old today still counts as recent (inclusive boundary)', () => {
    const { recent, archive } = splitNewsletterIssues([{ slug: 'a', date: '2026-03-03' }], today);
    assert.equal(recent.length, 1);
    assert.equal(archive.length, 0);
  });

  test('an issue one day older than the six-month boundary is archived', () => {
    const { recent, archive } = splitNewsletterIssues([{ slug: 'a', date: '2026-03-02' }], today);
    assert.equal(recent.length, 0);
    assert.equal(archive.length, 1);
  });

  test('both lists are sorted newest first', () => {
    const issues = [
      { slug: 'jan', date: '2026-01-01' },
      { slug: 'aug', date: '2026-08-01' },
      { slug: 'jun', date: '2026-06-01' },
    ];
    const { recent, archive } = splitNewsletterIssues(issues, today);
    assert.deepEqual(recent.map((i) => i.slug), ['aug', 'jun']);
    assert.deepEqual(archive.map((i) => i.slug), ['jan']);
  });

  test('an empty issue list produces two empty lists', () => {
    const { recent, archive } = splitNewsletterIssues([], today);
    assert.deepEqual(recent, []);
    assert.deepEqual(archive, []);
  });
});
