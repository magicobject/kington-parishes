// PRE-LAUNCH GUARD. DELETE THIS FILE AT LAUNCH (docs/advent/launch-checklist.md, step "delete the two guards").
//
// While it exists, it hard-asserts that the Advent calendar is still hidden, so a stray flag flip or a
// mistaken edit cannot put an unfinished calendar in front of the public. It deliberately does NOT follow
// the flags: that is its whole job. Every other Advent test follows the flags and needs no edit at launch.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { theme } from '../src/advent/theme.mjs';

const publicFile = (path) => readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8');

describe('the Advent calendar is still hidden (delete this file at launch)', () => {
  test('theme.publicListing is false', () => {
    assert.equal(theme.publicListing, false, 'publicListing was switched on: follow docs/advent/launch-checklist.md');
  });

  test('theme.artRequired is false', () => {
    assert.equal(theme.artRequired, false, 'artRequired was switched on: follow docs/advent/launch-checklist.md');
  });

  test('sitemap.xml mentions no advent page', () => {
    assert.ok(!/advent/i.test(publicFile('sitemap.xml')));
  });

  test('search-index.json has no entry for the calendar or its help page, and says "advent" only in "Advent Sunday"', () => {
    const raw = publicFile('search-index.json');
    const entries = JSON.parse(raw);
    assert.ok(!entries.some((entry) => /^(?:help-)?advent\.html$/.test(entry.page)));
    assert.deepEqual(raw.replace(/Advent Sunday/g, '').match(/advent/gi) ?? [], []);
  });
});
