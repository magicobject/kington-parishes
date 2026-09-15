import { test, expect } from './support/fixtures';
import { ALL_PAGES, HELP_PAGES } from './support/pages';

// scripts/build.mjs generates public/sitemap.xml from the same
// isSearchablePage predicate used to gate the public search index (see
// CLAUDE.md's "Site search" section: "isSearchablePage ... still gates the
// sitemap, unchanged") — nothing previously checked that the sitemap
// actually reflects that, or stays in sync with what test/page-content.spec.ts
// asserts about noindex/robots meta tags.

const NOINDEX_PATHS = new Set(['/updates.html', ...HELP_PAGES.map((p) => p.path)]);

test('sitemap.xml is well-formed and lists https URLs under the real domain', async ({ request }) => {
  const response = await request.get('/sitemap.xml');
  expect(response.status()).toBe(200);
  const body = await response.text();

  expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  expect(body).toMatch(/<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);

  const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(locs.length).toBeGreaterThan(0);
  for (const loc of locs) {
    expect(loc).toMatch(/^https:\/\/www\.kingtonparishes\.org\.uk\//);
  }
});

test('every real, indexable page is listed in the sitemap exactly once', async ({ request }) => {
  const response = await request.get('/sitemap.xml');
  const body = await response.text();
  const locs = new Set([...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));

  for (const sitePage of ALL_PAGES) {
    if (NOINDEX_PATHS.has(sitePage.path)) continue;
    const expected = `https://www.kingtonparishes.org.uk${sitePage.path}`;
    expect(locs.has(expected), `expected ${expected} in sitemap.xml`).toBe(true);
  }
});

test('the internal changelog, 404 and hidden help guide are never listed in the sitemap', async ({ request }) => {
  const response = await request.get('/sitemap.xml');
  const body = await response.text();

  expect(body).not.toContain('/updates.html');
  expect(body).not.toContain('/404.html');
  for (const helpPage of HELP_PAGES) {
    expect(body).not.toContain(helpPage.path);
  }
});
