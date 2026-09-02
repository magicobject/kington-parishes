import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';

// The noticeboard/archive expiry mechanism (public/js/main.js): a
// noticeboard-card carrying data-expires="YYYY-MM-DD" hides itself once
// that date has passed, and its twin card in services.html#archive
// (kept in the markup with style="display:none") is revealed instead.
// Custom, date-driven logic with no CMS behind it — worth pinning down
// with a mocked clock rather than trusting it by inspection.
//
// Both dated notices currently on the homepage are used as fixtures:
//   - the Organ Recital card, data-expires="2026-09-13"
//   - the St Stephen's heritage-fund card, data-expires="2027-03-31"
// If either of those notices is edited or removed, update the dates below
// to match.
const ORGAN_RECITAL_EXPIRES = '2026-09-13';
const HERITAGE_FUND_EXPIRES = '2027-03-31';

async function gotoAt(page: Page, path: string, isoDate: string) {
  await page.clock.setFixedTime(new Date(`${isoDate}T12:00:00`));
  await page.goto(path);
}

test('before either notice expires, both stay on the noticeboard and the archive shows its empty state', async ({ page }) => {
  await gotoAt(page, '/index.html', '2026-09-10');
  await expect(page.locator(`#noticeboard [data-expires="${ORGAN_RECITAL_EXPIRES}"]`)).toBeVisible();

  await gotoAt(page, '/services.html', '2026-09-10');
  await expect(page.locator(`#archive [data-expires="${ORGAN_RECITAL_EXPIRES}"]`)).toBeHidden();
  await expect(page.locator(`#archive [data-expires="${HERITAGE_FUND_EXPIRES}"]`)).toBeHidden();
  await expect(page.locator('.archive-empty')).toBeVisible();
});

test('once a notice\'s date passes, it disappears from the noticeboard and its twin appears in the archive', async ({ page }) => {
  // One day after the Organ Recital's expiry, but well before the
  // heritage-fund card's — only the recital should have moved.
  await gotoAt(page, '/index.html', '2026-09-14');
  await expect(page.locator(`#noticeboard [data-expires="${ORGAN_RECITAL_EXPIRES}"]`)).toBeHidden();

  await gotoAt(page, '/services.html', '2026-09-14');
  await expect(page.locator(`#archive [data-expires="${ORGAN_RECITAL_EXPIRES}"]`)).toBeVisible();
  await expect(page.locator(`#archive [data-expires="${HERITAGE_FUND_EXPIRES}"]`)).toBeHidden();
  // Something has expired into the archive now, so the empty-state message
  // should have made way for it.
  await expect(page.locator('.archive-empty')).toBeHidden();
});

test('a second notice expiring later moves independently, once its own date passes', async ({ page }) => {
  await gotoAt(page, '/services.html', '2027-04-01');
  await expect(page.locator(`#archive [data-expires="${ORGAN_RECITAL_EXPIRES}"]`)).toBeVisible();
  await expect(page.locator(`#archive [data-expires="${HERITAGE_FUND_EXPIRES}"]`)).toBeVisible();
  await expect(page.locator('.archive-empty')).toBeHidden();
});
