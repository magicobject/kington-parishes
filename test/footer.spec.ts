import { test, expect } from './support/fixtures';
import { ALL_PAGES } from './support/pages';

const ALL_PATHS = [...ALL_PAGES.map((p) => p.path), '/404.html'];

// The build number lives only on /updates.html, not in every page's footer:
// stamping it sitewide meant every commit rewrote every page in public/.
test('/updates.html shows the current build number', async ({ page }) => {
  await page.goto('/updates.html');

  const buildNumber = page.locator('.page-header .build-number');
  await expect(buildNumber).toBeVisible();
  await expect(buildNumber).toHaveText(/^Current build: \d{4}\.\d{2}\.\d{2}\.\d{3}$/);
});

for (const path of ALL_PATHS) {
  test(`${path} has no build number in the footer`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('footer .build-number')).toHaveCount(0);
  });

  test(`${path} credits mediawright.uk in the footer`, async ({ page }) => {
    await page.goto(path);

    const credit = page.locator('.fine a[href="https://mediawright.uk"]');
    await expect(credit).toBeVisible();
    await expect(credit).toHaveText('mediawright.uk');
  });
}
