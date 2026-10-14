// The Advent module silently needs five features of the HOST site's build. This test checks each one is there, with a message that names
// the step of modules/advent/INTEGRATION.md to follow when it is not. It is a copy-and-run test: a second church copies it into its own
// test-unit/ (modules/advent/host-kit/) and it checks that church's scripts. Features 1 to 3 and the wiring are checked by reading the host's
// build scripts as text, so they are a safety net for a missing feature, not a proof that it works (the host's own build and tests prove
// that). Feature 4 is checked on the BUILT calendar page, so any implementation of content-hashed addresses passes.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const build = read('scripts/build.mjs');
const searchIndex = read('scripts/build-search-index.mjs');
const pages = read('src/pages.config.mjs');

describe('host features the Advent module needs (modules/advent/INTEGRATION.md, "Features the host must have")', () => {
  test('1. page.headHtml: the build writes a page entry\'s headHtml into the page head', () => {
    assert.match(build, /page\.headHtml/, 'scripts/build.mjs does not use page.headHtml: add it to the page head (INTEGRATION.md, feature 1)');
  });

  test('2. page.unlisted: the sitemap and search predicate keeps an unlisted page out (and rejects a non-boolean)', () => {
    assert.match(searchIndex, /page\.unlisted/, 'scripts/build-search-index.mjs does not honour page.unlisted (INTEGRATION.md, feature 2)');
    assert.match(searchIndex, /isIndexable/);
    assert.match(build, /isSearchablePage\(page\)/, 'the sitemap must be filtered by the predicate that honours unlisted');
  });

  test('3. data-search-skip: the search indexer leaves out elements marked data-search-skip', () => {
    assert.match(searchIndex, /data-search-skip/, 'scripts/build-search-index.mjs does not drop [data-search-skip] elements (INTEGRATION.md, feature 3)');
  });

  test('4. content-hashed addresses: the built calendar page gives every same-origin stylesheet and script a ?v=<hash>, and the Advent files are written before the page loop', () => {
    assert.ok(build.indexOf('buildAdvent(') > -1 && build.indexOf('buildAdvent(') < build.indexOf('for (const page of PAGES)'),
      'buildAdvent(...) must run BEFORE the page loop so the hashes are taken from this build\'s files (INTEGRATION.md, feature 4)');
    let page;
    try {
      page = read('public/advent.html');
    } catch {
      assert.fail('public/advent.html is not built yet: finish steps 6 to 8 and run npm run build (INTEGRATION.md, feature 4)');
    }
    const tags = (page.match(/<(?:link|script)\b[^>]*>/g) ?? []).filter((tag) => /\b(?:href|src)="\/(?!\/)/.test(tag));
    assert.ok(tags.length >= 3, 'expected the calendar page to load its stylesheets and scripts');
    for (const tag of tags) {
      assert.match(tag, /\b(?:href|src)="\/[^"?#]+\?v=[0-9A-Za-z]{6,}"/, `${tag} has no ?v=<hash>: add content-hashed addresses (INTEGRATION.md, feature 4; host-kit/version-asset-urls.mjs)`);
    }
  });

  test('5. token order: {{ADVENT}} and {{ADVENT_TEASER}} expand before ensureSectionIds (so their headings get ids and are indexed)', () => {
    const outer = build.indexOf('ensureSectionIds(');
    for (const token of ['renderAdventToken(', 'renderAdventTeaserToken(']) {
      const at = build.indexOf(token, outer);
      assert.ok(outer > -1 && at > outer, `${token} must be nested INSIDE the ensureSectionIds(...) call in the page loop (INTEGRATION.md, feature 5)`);
    }
  });

  test('the page list holds the calendar entry (exported as adventPage) and the build passes the real list of OTHER pages', () => {
    assert.match(pages, /export const adventPage\s*=\s*adventPageEntry\(/, 'src/pages.config.mjs must export adventPage = adventPageEntry(theme) and put it in PAGES (INTEGRATION.md, step 6)');
    // The other pages are found by leaving out the calendar's OWN entry (by identity). Comparing slugs would remove a clashing page first, and the
    // clash would pass silently (the calendar page would replace the other page).
    assert.match(build, /pageNames:[^\n]*!==\s*adventPage/, 'pageNames must leave out the calendar entry by identity: PAGES.filter((page) => page !== adventPage) (INTEGRATION.md, step 8)');
    assert.doesNotMatch(build, /slug\s*!==\s*\w*[tT]heme\.slug/, 'do not build pageNames by comparing slugs: a clashing page would be removed before the check (INTEGRATION.md, step 8)');
  });
});
