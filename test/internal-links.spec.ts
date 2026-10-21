import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from './support/fixtures';

// Cloudflare answers /x.html with a 307 to /x, so an internal link written
// as "x.html" costs every visitor an extra round trip (and the browser's
// address bar changes under them). Every internal <a href>, the home page's
// map pins and every search result must therefore use the clean address.
// Read from the generated public/ files rather than a browser: this is about
// what the build wrote, and it checks all of them, including the help guide.

const PUBLIC = join(__dirname, '..', 'public');
const pages = readdirSync(PUBLIC).filter((f) => f.endsWith('.html'));

function internalHrefs(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*?\bhref="([^"]*)"/g)]
    .map((m) => m[1])
    // Skip links with a scheme, in-page anchors, and the obfuscated mailto: links
    // (their whole value is HTML-entity encoded, so they start with "&#").
    .filter((href) => href && !/^([a-z][a-z0-9+.-]*:|\/\/|#|&#)/i.test(href));
}

for (const file of pages) {
  test(`${file}: no internal link uses the .html form`, () => {
    const bad = internalHrefs(readFileSync(join(PUBLIC, file), 'utf8')).filter((href) => /\.html([#?]|$)/.test(href));
    expect(bad, `${file} links to ${bad.join(', ')}`).toEqual([]);
  });
}

test('every internal link on every page resolves with a 200 as a clean URL', async ({ request }) => {
  const targets = new Set<string>();
  // updates.html is the build log: its old entries deliberately keep their
  // links to pages that were later removed (the Advent pages), so it is held
  // to the clean-URL rule above but not to "every target exists".
  for (const file of pages.filter((f) => f !== 'updates.html')) {
    for (const href of internalHrefs(readFileSync(join(PUBLIC, file), 'utf8'))) {
      const path = '/' + href.split('#')[0].split('?')[0].replace(/^\//, '');
      targets.add(path);
    }
  }
  expect(targets.size).toBeGreaterThan(10);
  for (const path of targets) {
    const response = await request.get(path);
    expect(response.status(), `GET ${path}`).toBe(200);
  }
});

test('the home page map pins and the journey line link to clean URLs', () => {
  const home = readFileSync(join(PUBLIC, 'index.html'), 'utf8');
  const pins = home.match(/data-churches="([^"]*)"/);
  expect(pins, 'home page has a data-churches attribute').not.toBeNull();
  expect(pins![1]).not.toContain('.html');
  expect(pins![1]).toContain('/church-kington');
});

test('search results link to clean URLs, with the home page as /', () => {
  const index = JSON.parse(readFileSync(join(PUBLIC, 'search-index.json'), 'utf8')) as { page: string }[];
  expect(index.length).toBeGreaterThan(50);
  for (const entry of index) {
    expect(entry.page, `search entry page ${entry.page}`).toMatch(/^\/[a-z0-9-]*$/);
  }
  expect(index.some((entry) => entry.page === '/')).toBe(true);
});
