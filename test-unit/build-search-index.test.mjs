// Unit tests for scripts/build-search-index.mjs — pure functions, no
// browser, no build step. Run with `npm run test:unit` (node --test).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  slugify,
  ensureSectionIds,
  extractSearchEntries,
  isSearchablePage,
} from '../scripts/build-search-index.mjs';

describe('slugify', () => {
  test('lowercases and hyphenates', () => {
    assert.equal(slugify('Hire the Parish Hall'), 'hire-the-parish-hall');
  });

  test('turns "&amp;" into "and" rather than dropping it', () => {
    assert.equal(slugify('Baptisms &amp; Weddings'), 'baptisms-and-weddings');
  });

  test('strips punctuation and collapses repeats into one hyphen', () => {
    assert.equal(slugify("St Mary's, Kington!!"), 'st-mary-s-kington');
  });

  test('trims leading/trailing hyphens', () => {
    assert.equal(slugify('  Give  '), 'give');
  });

  test('falls back to "section" for text with nothing sluggable', () => {
    assert.equal(slugify('...'), 'section');
  });
});

describe('ensureSectionIds', () => {
  test('injects an id on a heading with no id and no id\'d ancestor', () => {
    const html = '<div class="card"><h2>Fundraising</h2><p>Give.</p></div>';
    const out = ensureSectionIds(html);
    assert.match(out, /<h2 id="fundraising">Fundraising<\/h2>/);
  });

  test('leaves a heading alone if it already has its own id', () => {
    const html = '<h2 id="custom">Fundraising</h2>';
    assert.equal(ensureSectionIds(html), html);
  });

  test('leaves a heading alone if an ancestor already has an id', () => {
    const html = '<article id="kington"><div class="wrap"><h2>Kington</h2></div></article>';
    assert.equal(ensureSectionIds(html), html);
  });

  test('does not treat the page-wide <main id="main"> landmark as a usable ancestor id', () => {
    // Regression: every src/pages/*.html file is wrapped in <main id="main">
    // (the header's skip-link target) — if that counted as "the nearest
    // ancestor id", every heading on every page would collapse onto #main.
    const html = '<main id="main"><div class="card"><h2>Give</h2></div></main>';
    const out = ensureSectionIds(html);
    assert.match(out, /<h2 id="give">Give<\/h2>/);
  });

  test('dedupes two headings with identical text on the same page', () => {
    const html = '<div><h2>Give</h2></div><div><h2>Give</h2></div>';
    const out = ensureSectionIds(html);
    assert.match(out, /<h2 id="give">Give<\/h2>/);
    assert.match(out, /<h2 id="give-2">Give<\/h2>/);
  });

  test('never touches self-closing tags elsewhere in the document', () => {
    // The exact regression this function exists to avoid: a naive
    // parse-then-reserialize turns <path d="..."/> into <path d="...">
    // </path>. Confirm the self-closing SVG path survives untouched.
    const html = '<svg><path d="M0 0L1 1"/></svg><h2>Fundraising</h2>';
    const out = ensureSectionIds(html);
    assert.match(out, /<path d="M0 0L1 1"\/>/);
  });

  test('injects distinct ids for multiple unrelated headings', () => {
    const html = '<h2>Hire the Parish Hall</h2><h2>The Church Fete</h2>';
    const out = ensureSectionIds(html);
    assert.match(out, /<h2 id="hire-the-parish-hall">Hire the Parish Hall<\/h2>/);
    assert.match(out, /<h2 id="the-church-fete">The Church Fete<\/h2>/);
  });
});

describe('extractSearchEntries', () => {
  const page = { slug: 'get-involved', title: 'Get Involved — Kington Parishes' };

  test('captures heading text, the surrounding text, the page and the anchor', () => {
    const html = ensureSectionIds(
      '<div class="card"><h2>Fundraising</h2><p>Support the fete.</p></div>',
    );
    const [entry] = extractSearchEntries(html, page);
    assert.equal(entry.page, 'get-involved.html');
    assert.equal(entry.pageTitle, page.title);
    assert.equal(entry.anchor, 'fundraising');
    assert.equal(entry.heading, 'Fundraising');
    assert.match(entry.text, /Support the fete\./);
  });

  test('decodes HTML entities in the page title (titles are authored pre-escaped for template interpolation)', () => {
    const escapedPage = { slug: 'services', title: 'Services &amp; Events — Kington Parishes' };
    const html = ensureSectionIds('<h2>Choral Evensong</h2><p>Monthly.</p>');
    const [entry] = extractSearchEntries(html, escapedPage);
    assert.equal(entry.pageTitle, 'Services & Events — Kington Parishes');
  });

  test('uses the nearest id\'d ancestor as the anchor, not a generated one', () => {
    const html = '<article id="kington"><div class="wrap"><h2>Kington</h2><p>Sundays.</p></div></article>';
    const [entry] = extractSearchEntries(html, page);
    assert.equal(entry.anchor, 'kington');
  });

  test('every entry gets its own distinct anchor, never the page-wide #main', () => {
    const html = ensureSectionIds(
      '<main id="main">'
      + '<div class="card"><h2>Hire the Parish Hall</h2><p>Book it.</p></div>'
      + '<div class="card"><h2>The Church Fete</h2><p>July.</p></div>'
      + '</main>',
    );
    const entries = extractSearchEntries(html, page);
    const anchors = entries.map((e) => e.anchor);
    assert.equal(new Set(anchors).size, anchors.length, 'anchors should all be distinct');
    assert.ok(!anchors.includes('main'), 'no entry should resolve to #main');
  });

  test('several sub-headings sharing one id\'d ancestor collapse into a single entry', () => {
    // Regression: index.html's Pilgrim Paths section has one h3 per parish
    // (Kington, Titley, Old Radnor, Kinnerton, Huntington), none with their
    // own id — all four used to become four separate, near-duplicate
    // search results that all linked to the same #pilgrim-paths anchor.
    const html = '<section id="pilgrim-paths"><h2>Pilgrim Paths</h2>'
      + '<div class="card"><h3>Kington</h3><p>Leaflet A.</p></div>'
      + '<div class="card"><h3>Titley</h3><p>Leaflet B.</p></div>'
      + '</section>';
    const entries = extractSearchEntries(html, page);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].anchor, 'pilgrim-paths');
    assert.equal(entries[0].heading, 'Pilgrim Paths'); // the h2, not either h3
  });

  test('keeps each card\'s text separate — no bleed between sibling sections', () => {
    const html = ensureSectionIds(
      '<div class="card"><h2>Hire the Parish Hall</h2><p>Book the hall.</p></div>'
      + '<div class="card"><h2>The Church Fete</h2><p>Held in July.</p></div>',
    );
    const entries = extractSearchEntries(html, page);
    assert.equal(entries.length, 2);
    assert.match(entries[0].text, /Book the hall/);
    assert.doesNotMatch(entries[0].text, /Held in July/);
    assert.match(entries[1].text, /Held in July/);
    assert.doesNotMatch(entries[1].text, /Book the hall/);
  });

  test('produces one entry per heading on a multi-section page', () => {
    const html = ensureSectionIds(
      '<h1>Support, hire, and take part</h1>'
      + '<div class="card"><h2>Give</h2><p>Support us.</p></div>',
    );
    const entries = extractSearchEntries(html, page);
    assert.equal(entries.length, 2);
  });
});

describe('isSearchablePage', () => {
  test('excludes the internal changelog', () => {
    assert.equal(isSearchablePage({ slug: 'updates' }), false);
  });

  test('excludes the 404 page', () => {
    assert.equal(isSearchablePage({ slug: '404' }), false);
  });

  test('includes an ordinary content page', () => {
    assert.equal(isSearchablePage({ slug: 'our-churches' }), true);
  });
});
