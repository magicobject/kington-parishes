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
