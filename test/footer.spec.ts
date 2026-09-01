import { test, expect } from './support/fixtures';
import { ALL_PAGES } from './support/pages';

const ALL_PATHS = [...ALL_PAGES.map((p) => p.path), '/404.html'];

for (const path of ALL_PATHS) {
  test(`${path} shows a build number in the footer`, async ({ page }) => {
    await page.goto(path);

    const buildNumber = page.locator('.fine .build-number');
    await expect(buildNumber).toBeVisible();
    await expect(buildNumber).toHaveText(/^Build \d{4}\.\d{2}\.\d{2}\.\d{3}$/);
  });

  test(`${path} credits mediawright.uk in the footer`, async ({ page }) => {
    await page.goto(path);

    const credit = page.locator('.fine a[href="https://mediawright.uk"]');
    await expect(credit).toBeVisible();
    await expect(credit).toHaveText('mediawright.uk');
  });
}
