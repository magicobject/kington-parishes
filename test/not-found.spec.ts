import { test, expect } from '@playwright/test';

test('an unknown URL serves the branded 404 page with a 404 status', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist.html');

  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle(/Page not found/);
  await expect(page.locator('h1')).toHaveText(/moved on, or never stood here/i);

  // The 404 page intentionally has no main nav — it isn't a nav destination —
  // but it keeps the regular footer (build number, mediawright credit, contact details).
  await expect(page.locator('header.site')).toHaveCount(0);
  await expect(page.locator('footer.site')).toHaveCount(1);
});

test("the 404 page's recovery links lead back into the real site", async ({ page }) => {
  await page.goto('/this-page-does-not-exist.html');

  await page.getByRole('link', { name: 'Back to the home page' }).click();
  await expect(page).toHaveURL(/\/index\.html$/);
  await expect(page).toHaveTitle('Kington Parishes — Five churches on the Herefordshire/Powys border');
});

test('the 404 page is not indexed by search engines', async ({ page }) => {
  await page.goto('/this-page-does-not-exist.html');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
});
