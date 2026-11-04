import { test, expect, devices } from '@playwright/test';

// Real WebKit with an iPhone profile: Safari-only behaviour has bitten us before
// (the long history article never revealed, the calendar agenda sat off screen).
const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
test.use({ ...iphone, browserName: 'webkit' });

test('a long article is revealed on a phone, not left at opacity 0', async ({ page }) => {
  await page.goto('/church-kington-history.html');
  await expect(page.locator('article.parish')).toHaveClass(/\bin\b/);
  await expect(page.locator('article.parish')).toHaveCSS('opacity', '1');
});

test('tapping a calendar day brings its agenda into view', async ({ page }) => {
  await page.goto('/calendar.html');
  await page.locator('.cal-day--has-events:not(.cal-day--outside)').last().tap();
  const agenda = page.locator('#cal-agenda');
  await expect.poll(async () => {
    const box = await agenda.boundingBox();
    return box !== null && box.y < page.viewportSize()!.height && box.y + box.height > 0;
  }).toBe(true);
});
