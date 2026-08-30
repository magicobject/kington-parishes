import { test, expect } from '@playwright/test';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function currentMonthLabel(): string {
  const now = new Date();
  return `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
}

test('calendar defaults to the current month', async ({ page }) => {
  await page.goto('/calendar.html');
  await expect(page.locator('#cal-month-label')).toHaveText(currentMonthLabel());
});

test('Next/Prev move a month at a time, Today returns to the current month', async ({ page }) => {
  await page.goto('/calendar.html');
  const label = page.locator('#cal-month-label');
  const start = await label.textContent();

  await page.locator('#cal-next').click();
  await expect(label).not.toHaveText(start!);

  await page.locator('#cal-prev').click();
  await expect(label).toHaveText(start!);

  await page.locator('#cal-next').click();
  await page.locator('#cal-next').click();
  await page.locator('#cal-today').click();
  await expect(label).toHaveText(currentMonthLabel());
});

test('selecting a day shows its events in the agenda panel', async ({ page }) => {
  await page.goto('/calendar.html');
  // Jump to August 2026, which has a known seeded event on the 9th.
  const label = page.locator('#cal-month-label');
  while ((await label.textContent()) !== 'August 2026') {
    const text = await label.textContent();
    if (text && new Date(`1 ${text}`) < new Date('1 August 2026')) {
      await page.locator('#cal-next').click();
    } else {
      await page.locator('#cal-prev').click();
    }
  }
  await page.locator('.cal-day[data-date="2026-08-09"]').click();
  await expect(page.locator('#cal-agenda')).toContainText('Choral Evensong');
  await expect(page.locator('#cal-agenda')).toContainText('4pm');
});

test('the calendar never causes the page to scroll horizontally, on mobile or desktop', async ({ page }) => {
  await page.goto('/calendar.html');
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true);

  await page.setViewportSize({ width: 360, height: 800 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true);
});
