import { test, expect } from '@playwright/test';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function currentMonthLabel(): string {
  const now = new Date();
  return `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
}

async function gotoMonth(page: import('@playwright/test').Page, target: string) {
  const label = page.locator('#cal-month-label');
  while ((await label.textContent()) !== target) {
    const text = await label.textContent();
    if (text && new Date(`1 ${text}`) < new Date(`1 ${target}`)) {
      await page.locator('#cal-next').click();
    } else {
      await page.locator('#cal-prev').click();
    }
  }
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
  // August 2026 has a known seeded event on the 9th.
  await gotoMonth(page, 'August 2026');
  await page.locator('.cal-day[data-date="2026-08-09"]').click();
  await expect(page.locator('#cal-agenda')).toContainText('Choral Evensong');
  await expect(page.locator('#cal-agenda')).toContainText('4pm');
});

test('a day with two events shows both, in time order', async ({ page }) => {
  await page.goto('/calendar.html');
  // 19 July 2026 is seeded with two real events: Picnic Praise (11am) then
  // Pilgrimage and tea (2pm).
  await gotoMonth(page, 'July 2026');
  const cell = page.locator('.cal-day[data-date="2026-07-19"]');
  await expect(cell.locator('.cal-chip')).toHaveCount(2);
  await expect(cell).toContainText('Picnic Praise');
  await expect(cell).toContainText('Pilgrimage and tea');

  await cell.click();
  const agendaItems = page.locator('#cal-agenda .cal-agenda-list li');
  await expect(agendaItems).toHaveCount(2);
  await expect(agendaItems.nth(0)).toContainText('Picnic Praise'); // 11am, sorts first
  await expect(agendaItems.nth(1)).toContainText('Pilgrimage and tea'); // 2pm, sorts second
});

test('a day with more than two events shows a "+N more" chip, but the full list in the agenda', async ({ page }) => {
  // Serve a stand-in for calendar-events.js with a third event added to 19
  // July, so the grid cell has to fall back to the "+1 more" overflow chip.
  await page.route('**/js/calendar-events.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.CALENDAR_EVENTS = [
        { date: '2026-07-19', time: '11:00', title: 'Picnic Praise', location: "St Mary's, Kington" },
        { date: '2026-07-19', time: '14:00', title: 'Pilgrimage and tea', location: "St Peter's, Titley" },
        { date: '2026-07-19', time: '17:00', title: 'Evening BBQ', location: 'Kington' },
      ];`,
    }),
  );
  await page.goto('/calendar.html');
  await gotoMonth(page, 'July 2026');

  const cell = page.locator('.cal-day[data-date="2026-07-19"]');
  await expect(cell.locator('.cal-chip:not(.cal-chip--more)')).toHaveCount(2); // 2 real chips...
  await expect(cell.locator('.cal-chip--more')).toHaveText('+1 more'); // ...plus the overflow chip

  await cell.click();
  // ...but the agenda panel still shows all three, uncapped.
  await expect(page.locator('#cal-agenda .cal-agenda-list li')).toHaveCount(3);
  await expect(page.locator('#cal-agenda')).toContainText('Evening BBQ');
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
