import { test, expect } from './support/fixtures';
import { ALL_PAGES, HELP_PAGES } from './support/pages';

// Regression guard: each page's file should show its own title and heading,
// not another page's — this bit us once on a different site's build script.
for (const page of ALL_PAGES) {
  test(`${page.path} shows its own title and heading`, async ({ page: browserPage }) => {
    await browserPage.goto(page.path);

    await expect(browserPage).toHaveTitle(new RegExp(page.titleContains));
    await expect(browserPage.locator('h1')).toHaveText(page.heading);
  });
}

test('every page links to a unique canonical URL matching its own filename', async ({ page }) => {
  for (const sitePage of ALL_PAGES) {
    await page.goto(sitePage.path);
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute(
      'href',
      `https://www.kingtonparishes.org.uk${sitePage.path}`,
    );
  }
});

// Live since 6 September 2026 — every real page should be indexable now.
// Only the internal build changelog, the hidden help guide, and 404 (never
// genuine search-result destinations) still carry the noindex signal; this
// test used to assert the opposite, back when the whole site was a
// noindexed proof-of-concept.
const NOINDEX_PATHS = new Set(['/updates.html', ...HELP_PAGES.map((p) => p.path)]);

test('only the internal changelog, help guide and 404 carry a noindex tag', async ({ page }) => {
  for (const sitePage of ALL_PAGES) {
    await page.goto(sitePage.path);
    const robotsMeta = page.locator('meta[name="robots"]');
    if (NOINDEX_PATHS.has(sitePage.path)) {
      await expect(robotsMeta).toHaveAttribute('content', 'noindex, nofollow');
    } else {
      await expect(robotsMeta).toHaveCount(0);
    }
  }

  await page.goto('/404.html');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
});
