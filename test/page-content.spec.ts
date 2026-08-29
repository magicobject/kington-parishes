import { test, expect } from '@playwright/test';
import { ALL_PAGES } from './support/pages';

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
      `https://kington-parishes.magicobject.workers.dev${sitePage.path}`,
    );
  }
});

// This whole site is a proof-of-concept build, not the parishes' real
// production website, and must never get indexed or confused with it —
// every page (not just 404) needs the noindex signal.
test('every page is noindex — this is a proof-of-concept build, not the real site', async ({ page }) => {
  for (const sitePage of [...ALL_PAGES.map((p) => p.path), '/404.html']) {
    await page.goto(sitePage);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  }
});
