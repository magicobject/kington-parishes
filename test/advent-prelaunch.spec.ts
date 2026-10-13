import { test, expect } from '@playwright/test';

// PRE-LAUNCH GUARD. DELETE THIS FILE AT LAUNCH (docs/advent/launch-checklist.md, with the two other guards).
//
// It uses the site exactly as built, with the real launch flags and NO test helpers, and fakes the clock to
// the middle of December. A real visitor must still see nothing: the calm sentence on /advent and no banner
// on the home page. Every other Advent browser test forces goLive on through a route; this one must not.
test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
});

test('PRE-LAUNCH: on 12 December the real date still shows only the calm sentence and no banner', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (request) => { if (/\/advent\/day-/.test(request.url())) requested.push(request.url()); });
  await page.clock.install({ time: new Date('2026-12-12T12:00:00Z') });
  await page.goto('/advent.html');
  await expect(page.locator('[data-advent-calm-text]')).toHaveText('The Advent calendar opens on 1 December.');
  await expect(page.locator('.advent-doors button')).toHaveCount(0);
  await expect(page.locator('dialog.advent-dialog')).toHaveCount(0);
  await page.goto('/');
  await expect(page.locator('.advent-teaser')).toBeHidden();
  await expect(page.locator('.advent-teaser')).toBeEmpty();
  expect((await page.locator('body').innerText()).replace(/Advent Sunday/g, '')).not.toMatch(/advent/i);
  expect(requested).toEqual([]);
});

test('PRE-LAUNCH: a preview is still the only way in (calendar page and home page)', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-12-12T12:00:00Z') });
  await page.goto('/advent.html?advent-preview=2026-12-07');
  await expect(page.locator('.advent-doors button')).toHaveCount(26);
  await page.goto('/?advent-preview=2026-12-07');
  await expect(page.locator('.advent-teaser')).toBeVisible();
});
