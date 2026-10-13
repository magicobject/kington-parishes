// The Advent help guide must not reveal the calendar in public files (search-index.json) before launch.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAGES, helpAdventPage } from '../src/pages.config.mjs';
import { theme } from '../modules/advent/theme.mjs';
import { isIndexable, isSearchablePage, isHelpPage } from '../scripts/build-search-index.mjs';

const withListing = (publicListing) => ({ ...structuredClone(theme), publicListing });

describe('help-advent follows theme.publicListing', () => {
  test('while the calendar is not public: unlisted, so out of the search index and the sitemap, and noindex', () => {
    const entry = helpAdventPage(withListing(false));
    assert.equal(entry.slug, 'help-advent');
    assert.equal(entry.unlisted, true);
    assert.equal(entry.robots, 'noindex, nofollow');
    assert.equal(isIndexable(entry), false);
    assert.equal(isSearchablePage(entry), false);
  });

  test('once the calendar is public: indexed again in the help scope only, still noindex, never in the sitemap', () => {
    const entry = helpAdventPage(withListing(true));
    assert.equal(entry.unlisted, false);
    assert.equal(entry.robots, 'noindex, nofollow');
    assert.equal(isHelpPage(entry), true);
    assert.equal(isIndexable(entry), true);
    assert.equal(isSearchablePage(entry), false);
  });

  test('the page declared in pages.config.mjs is the one built from the real theme', () => {
    assert.deepEqual(PAGES.find((page) => page.slug === 'help-advent'), helpAdventPage(theme));
  });
});

describe('the built search index', () => {
  const raw = readFileSync(new URL('../public/search-index.json', import.meta.url), 'utf8');
  const entries = JSON.parse(raw);

  // The only thing allowed to say "advent" is the calendar page's pre-existing, unrelated church-year
  // event "Advent Sunday" (a services entry), and only while the calendar is hidden.
  test('says "advent" nowhere except in the existing "Advent Sunday" event text', () => {
    const leftovers = raw.replace(/Advent Sunday/g, '').match(/advent/gi) ?? [];
    if (theme.publicListing) return;
    assert.deepEqual(leftovers, []);
  });

  test('has no entry for the calendar page or its help page while the calendar is hidden', () => {
    if (theme.publicListing) return;
    assert.ok(!entries.some((entry) => entry.page === `${theme.slug}.html` || entry.page === 'help-advent.html'));
  });
});
