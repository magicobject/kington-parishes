import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from './support/fixtures';
import { ALL_PAGES } from './support/pages';

// scripts/build.mjs's versionAssetUrls appends ?v=<hash of the file's own
// content> to every same-origin stylesheet, script and icon a page loads —
// so browsers pick up a changed file straight away, keep their cached copy
// of an unchanged one, and a page's HTML only changes when something it
// loads actually has.

const publicDir = join(__dirname, '..', 'public');
const expectedHash = (path: string) =>
  createHash('sha256').update(readFileSync(join(publicDir, path))).digest('hex').slice(0, 10);

for (const { path } of ALL_PAGES) {
  test(`${path} versions every local stylesheet, script and icon by its content hash`, async ({ page }) => {
    await page.goto(path);

    const urls = await page.$$eval('link[href^="/"], script[src^="/"]', (els) =>
      els.map((el) => el.getAttribute('href') ?? el.getAttribute('src') ?? ''));
    expect(urls.length).toBeGreaterThan(0);

    for (const url of urls) {
      const [file, query] = url.split('?');
      expect(query, `${url} should carry a ?v= hash`).toBe(`v=${expectedHash(file)}`);
    }
  });
}

test('sitemap.xml carries no <lastmod> (it was always just the build date, not a real per-page date)', async ({ request }) => {
  const body = await (await request.get('/sitemap.xml')).text();
  expect(body).not.toContain('<lastmod>');
});
