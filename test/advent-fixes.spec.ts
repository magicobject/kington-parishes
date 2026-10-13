import { test, expect, type Page } from '@playwright/test';
import { ADVENT_PAGE } from './support/pages';
import { TITLES, builtDay, forceGoLive, withBonusDoor } from './support/advent';

// Browser tests for the review fixes (13 Oct 2026): preview on the home page, fetch robustness, the home page
// layout, the backdrop click, the hint, the star door, midnight, scroll lock and a few "survivor" checks.
// Same set-up as advent.spec.ts: the clock is faked, outside requests refused, goLive forced on.

const PATH = ADVENT_PAGE.path;
const REAL_TODAY = '2026-10-13T12:00:00Z';

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
  await forceGoLive(page);
});

async function openAt(page: Page, isoTime: string, query = '', path = PATH) {
  await page.clock.install({ time: new Date(isoTime) });
  await page.goto(`${path}${query}`);
}

const doors = (page: Page) => page.locator('section.advent .advent-doors button');
const door = (page: Page, day: number) => doors(page).nth(day - 1);
const dialog = (page: Page) => page.locator('dialog.advent-dialog');
const dialogTitle = (page: Page) => page.locator('#advent-dialog-title');
const banner = (page: Page) => page.locator('.advent-teaser');

test.describe('previewing on the home page', () => {
  test('shows the same notice (a polite live region) with an Exit link to the home page with no parameter, and marks the page noindex', async ({ page }) => {
    await openAt(page, REAL_TODAY, '?advent-preview=2026-12-07', '/');
    const notice = banner(page).locator('[role="status"]');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("Preview mode: not today's date. Showing 7 December 2026.");
    const exit = notice.getByRole('link', { name: 'Exit preview' });
    const href = await exit.getAttribute('href');
    expect(href).toBe(new URL('/', page.url()).href);
    expect(href).not.toContain('?');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    await expect(banner(page).locator('.advent-teaser-line')).toHaveText(`Day 7 \u00B7 ${TITLES[7]}`);
    await exit.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(banner(page)).toBeHidden();
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });

  test('a preview outside the season still shows the notice (and no banner), and a bad preview value shows nothing', async ({ page }) => {
    await openAt(page, REAL_TODAY, '?advent-preview=2026-11-15', '/');
    await expect(banner(page).locator('[role="status"]')).toContainText('Showing 15 November 2026.');
    await expect(banner(page).locator('.advent-teaser-banner')).toHaveCount(0);
    await openAt(page, REAL_TODAY, '?advent-preview=2026-12-99', '/');
    await expect(banner(page)).toBeHidden();
    await expect(banner(page).locator('[role="status"]')).toHaveCount(0);
  });

  test('also on /index.html', async ({ page }) => {
    await openAt(page, REAL_TODAY, '?advent-preview=2026-12-07', '/index.html');
    await expect(banner(page).locator('[role="status"]')).toBeVisible();
  });

  test('without a preview there is no notice, and no noindex is added', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z', '', '/');
    await expect(banner(page)).toBeVisible();
    await expect(banner(page).locator('[role="status"]')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });
});

const FRIENDLY = 'Sorry, this door will not open right now. Please try again in a moment.';
const live = (page: Page) => dialog(page).locator('[role="status"]');

test.describe('fetching a day: timeout, retry and announcements', () => {
  test('a request that never answers is given up after about 10 seconds with the friendly message, and a retry works', async ({ page }) => {
    test.setTimeout(45_000);
    let hang = true;
    await page.route('**/advent/day-07.json', (route) => { if (!hang) return route.continue(); return undefined; }); // never answers while hang is true
    await openAt(page, '2026-12-12T12:00:00Z');
    await door(page, 7).click();
    await expect(dialog(page).locator('.advent-message-text')).toHaveText('Opening the door...');
    await expect(live(page)).toHaveText('Opening the door');
    await expect(dialog(page).locator('.advent-message-text')).toHaveText(FRIENDLY, { timeout: 20_000 });
    await expect(live(page)).toHaveText(FRIENDLY);
    hang = false;
    await dialog(page).getByRole('button', { name: 'Try again' }).click();
    await expect(dialogTitle(page)).toHaveText(TITLES[7]);
    await expect(live(page)).toHaveText('Day 7 opened');
  });

  test('a failed request is evicted from the cache: Try again asks the server again and then shows the day', async ({ page }) => {
    let calls = 0;
    await page.route('**/advent/day-07.json', (route) => { calls += 1; return calls <= 2 ? route.fulfill({ status: 500, body: '' }) : route.continue(); });
    await openAt(page, '2026-12-12T12:00:00Z');
    await expect(doors(page)).toHaveCount(25);
    await door(page, 7).click(); // call 2 (the title fetch was call 1)
    await expect(dialog(page).locator('.advent-message-text')).toHaveText(FRIENDLY);
    await expect(dialogTitle(page)).toBeFocused();
    const before = calls;
    await dialog(page).getByRole('button', { name: 'Try again' }).click();
    await expect(dialogTitle(page)).toHaveText(TITLES[7]);
    expect(calls).toBe(before + 1);
    // And now it is cached: closing and reopening does not ask again.
    await dialog(page).getByRole('button', { name: 'Close' }).click();
    await door(page, 7).click();
    await expect(dialogTitle(page)).toHaveText(TITLES[7]);
    expect(calls).toBe(before + 1);
  });

  test('responses that arrive out of order never show the wrong day', async ({ page }) => {
    const release: Record<string, () => void> = {};
    for (const n of ['07', '08', '09']) {
      await page.route(`**/advent/day-${n}.json`, async (route) => {
        await new Promise<void>((resolve) => { release[n] = resolve; });
        await route.continue();
      });
    }
    await openAt(page, '2026-12-12T12:00:00Z');
    await expect.poll(() => Object.keys(release).length).toBe(3); // the three title fetches are waiting
    await door(page, 7).click(); // waits on day 7
    await page.keyboard.press('Escape');
    await door(page, 9).click();
    release['09']();
    await expect(dialogTitle(page)).toHaveText(TITLES[9]);
    release['07'](); // the older request answers last
    release['08']();
    await page.waitForTimeout(500);
    await expect(dialogTitle(page)).toHaveText(TITLES[9]);
    await expect(dialog(page).locator('.advent-count')).toHaveText('9 of 25');
    await expect(live(page)).toHaveText('Day 9 opened');
  });
});

test.describe('the home page is laid out exactly as before outside the season', () => {
  for (const width of [375, 1280]) {
    test(`at ${width}px: the first section after the hero keeps its 1px top border, and the page is as tall as without the banner placeholder`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openAt(page, REAL_TODAY, '', '/');
      await expect(page.locator('.hero')).toBeVisible();
      const border = await page.locator('.hero + section').evaluate((el) => getComputedStyle(el).borderTopWidth);
      expect(border).toBe('1px');
      const withPlaceholder = await page.evaluate(() => document.documentElement.scrollHeight);
      // The same page with the placeholder container and its script tag removed (what the page was before the banner).
      await page.route(/localhost:\d+\/$/, async (route) => {
        const response = await route.fetch();
        const body = (await response.text()).replace(/<div class="advent-teaser"[^>]*><\/div>/, '').replace(/<script type="module" src="\/js\/advent-teaser\.js[^>]*><\/script>/, '');
        await route.fulfill({ response, body });
      });
      await page.goto('/');
      await expect(page.locator('.advent-teaser')).toHaveCount(0);
      expect(await page.locator('.hero + section').evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('1px');
      expect(withPlaceholder).toBe(await page.evaluate(() => document.documentElement.scrollHeight));
    });
  }

  test('in the season the banner moves to just after the hero and brings its own border', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z', '', '/');
    await expect(banner(page)).toBeVisible();
    expect(await page.evaluate(() => document.querySelector('.hero')!.nextElementSibling === document.querySelector('.advent-teaser'))).toBe(true);
    expect(await banner(page).evaluate((el) => getComputedStyle(el).borderBottomWidth)).toBe('1px');
  });
});

const status = (page: Page) => page.locator('section.advent [data-advent-status]');

test.describe('midnight: the page refreshes itself when the date changes', () => {
  test('30 November to 1 December: the calm sentence becomes the calendar, with door 1 today', async ({ page }) => {
    await openAt(page, '2026-11-30T23:59:30Z');
    await expect(page.locator('[data-advent-calm-text]')).toBeVisible();
    await page.clock.runFor(32_000); // just past midnight (30s + 1s); not so far that the fake clock times out the title fetches
    await expect(doors(page)).toHaveCount(25);
    await expect(door(page, 1)).toHaveClass(/advent-door-today/);
    await expect(status(page)).toHaveText(`Today is Day 1: ${TITLES[1]}`);
  });

  test('12 to 13 December: door 13 becomes today, door 12 available, and the status line moves on', async ({ page }) => {
    await openAt(page, '2026-12-12T23:59:30Z');
    await expect(door(page, 12)).toHaveClass(/advent-door-today/);
    await expect(status(page)).toHaveText(`Today is Day 12: ${TITLES[12]}`);
    await page.clock.runFor(32_000); // just past midnight (30s + 1s); not so far that the fake clock times out the title fetches
    await expect(door(page, 13)).toHaveClass(/advent-door-today/);
    await expect(door(page, 12)).toHaveClass(/advent-door-available/);
    await expect(door(page, 13)).toHaveAttribute('aria-label', `Day 13, 13 December, today. ${TITLES[13]}`);
    await expect(status(page)).toHaveText(`Today is Day 13: ${TITLES[13]}`);
    await expect(door(page, 14)).toHaveClass(/advent-door-future/);
  });

  test('25 to 26 December: it becomes "The Christmas Story" with every door open', async ({ page }) => {
    await openAt(page, '2026-12-25T23:59:30Z');
    await expect(door(page, 25)).toHaveClass(/advent-door-today/);
    await page.clock.runFor(32_000); // just past midnight (30s + 1s); not so far that the fake clock times out the title fetches
    await expect(page.locator('[data-advent-heading]')).toHaveText('The Christmas Story');
    await expect(page.locator('section.advent .advent-door-available')).toHaveCount(25);
    await expect(page.locator('section.advent .advent-door-today')).toHaveCount(0);
    await expect(page.locator('[data-advent-primary]')).toBeHidden();
  });

  test('6 to 7 January: the calendar goes calm again', async ({ page }) => {
    await openAt(page, '2027-01-06T23:59:30Z');
    await expect(doors(page)).toHaveCount(25);
    await page.clock.runFor(32_000); // just past midnight (30s + 1s); not so far that the fake clock times out the title fetches
    await expect(page.locator('[data-advent-calm-text]')).toBeVisible();
    await expect(page.locator('[data-advent-live]')).toBeHidden();
  });

  test('an open day is not disturbed: the page catches up when the dialog closes', async ({ page }) => {
    await openAt(page, '2026-12-12T23:59:30Z');
    await expect(door(page, 12)).toHaveAttribute('aria-label', /\. /);
    await door(page, 5).click();
    await expect(dialogTitle(page)).toHaveText(TITLES[5]);
    await page.clock.runFor(32_000); // just past midnight (30s + 1s); not so far that the fake clock times out the title fetches
    await expect(dialog(page)).toBeVisible();
    await expect(dialogTitle(page)).toHaveText(TITLES[5]);
    await expect(door(page, 12)).toHaveClass(/advent-door-today/); // not yet refreshed behind the dialog
    await page.keyboard.press('Escape');
    await expect(door(page, 13)).toHaveClass(/advent-door-today/);
    await expect(door(page, 12)).toHaveClass(/advent-door-available/);
  });

  test('coming back to the tab (visibilitychange) also refreshes a stale page', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await expect(door(page, 12)).toHaveClass(/advent-door-today/);
    await page.clock.setFixedTime(new Date('2026-12-14T09:00:00Z'));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(door(page, 14)).toHaveClass(/advent-door-today/);
    await expect(status(page)).toHaveText(`Today is Day 14: ${TITLES[14]}`);
  });

  test('exactly one long timer is scheduled (no polling): from 12:00 to midnight plus a second', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-12-12T12:00:00Z') });
    await page.addInitScript(() => { // registered after the clock's own script, so it wraps the clock's setTimeout
      const original = window.setTimeout;
      (window as unknown as { __timeouts: number[] }).__timeouts = [];
      window.setTimeout = ((handler: TimerHandler, delay?: number, ...rest: unknown[]) => {
        (window as unknown as { __timeouts: number[] }).__timeouts.push(delay ?? 0);
        return (original as (...a: unknown[]) => number)(handler, delay, ...rest);
      }) as typeof window.setTimeout;
    });
    await page.goto(PATH);
    await expect(door(page, 12)).toHaveClass(/advent-door-today/);
    const delays = await page.evaluate(() => (window as unknown as { __timeouts: number[] }).__timeouts);
    const long = delays.filter((d) => d > 1000);
    expect(long).toHaveLength(1);
    expect(long[0]).toBeGreaterThan(12 * 3600 * 1000 - 20000); // 12 hours to midnight plus a second, less a moment of real time
    expect(long[0]).toBeLessThanOrEqual(12 * 3600 * 1000 + 1000);
    expect(long[0]).toBeLessThanOrEqual(26 * 3600 * 1000);
  });

  test('a preview date never refreshes by itself', async ({ page }) => {
    await openAt(page, REAL_TODAY, '?advent-preview=2026-12-07');
    await expect(door(page, 7)).toHaveClass(/advent-door-today/);
    await page.clock.runFor(48 * 3600 * 1000);
    await expect(door(page, 7)).toHaveClass(/advent-door-today/);
  });
});

test.describe('the dialog: backdrop click, scroll lock, hint, wrapping', () => {
  test('dragging a text selection from the panel onto the backdrop does not close it; a plain click on the backdrop does', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await door(page, 7).click();
    await expect(dialogTitle(page)).toHaveText(TITLES[7]);
    const story = (await dialog(page).locator('.advent-story p').first().boundingBox())!;
    await page.mouse.move(story.x + 20, story.y + 10);
    await page.mouse.down();
    await page.mouse.move(5, 5, { steps: 8 });
    await page.mouse.up();
    await expect(dialog(page)).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(dialog(page)).toBeHidden();
  });

  test('the page behind does not scroll while a day is open', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    const overflow = () => page.evaluate(() => getComputedStyle(document.documentElement).overflowY);
    expect(await overflow()).not.toBe('hidden');
    await door(page, 7).click();
    await expect(dialogTitle(page)).toBeFocused();
    expect(await overflow()).toBe('hidden');
    await page.keyboard.press('Escape');
    expect(await overflow()).not.toBe('hidden');
  });

  test('long words in the title and the status line wrap instead of overflowing', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await expect(door(page, 7)).toHaveAttribute('aria-label', /\. /);
    await door(page, 7).click();
    expect(await dialogTitle(page).evaluate((el) => getComputedStyle(el).overflowWrap)).toBe('anywhere');
    expect(await status(page).evaluate((el) => getComputedStyle(el).overflowWrap)).toBe('anywhere');
  });

  test('the day panel has no "Try this together" and no hidden-detail hint, with or without a picture', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await door(page, 1).click();
    await expect(dialogTitle(page)).toHaveText(TITLES[1]);
    await expect(dialog(page).locator('summary')).toHaveText(['Think about it']);
    await expect(dialog(page).getByText('Try this together')).toHaveCount(0);
    await expect(dialog(page).getByText(/find something hidden/i)).toHaveCount(0);
    // Even a (stale or hostile) day file that carries the old keys is refused, not shown.
    await page.route('**/advent/day-02.json', async (route) => {
      const file = await (await route.fetch()).json();
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...file, activity: 'Do a thing.', hidden: 'A tiny star.' }) });
    });
    await openAt(page, '2026-12-12T12:00:00Z', '?again=1');
    await door(page, 2).click();
    await expect(dialog(page).locator('.advent-message-text')).toContainText('Sorry');
  });
});

test.describe('the star door takes a whole row of its own', () => {
  for (const width of [320, 360, 375, 390, 430, 768, 1100]) {
    test(`at ${width}px it spans the grid, is at least 72px tall, sits below door 24, and keeps its accessible name`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openAt(page, '2026-12-12T12:00:00Z');
      await expect(door(page, 12)).toHaveAttribute('aria-label', /\. /);
      const boxes = await page.evaluate(() => {
        const list = document.querySelector('.advent-doors')!.getBoundingClientRect();
        const rect = (el: Element) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
        const buttons = [...document.querySelectorAll('.advent-doors button')];
        return { list: { x: list.x, w: list.width }, star: rect(buttons[24]), previous: rect(buttons[23]) };
      });
      expect(boxes.star.w).toBeGreaterThanOrEqual(boxes.list.w - 2);
      expect(boxes.star.h).toBeGreaterThanOrEqual(72);
      expect(boxes.star.y).toBeGreaterThanOrEqual(boxes.previous.y + boxes.previous.h);
      await expect(door(page, 25)).toHaveAttribute('aria-label', 'Day 25, 25 December, Christmas Day, not yet');
      await expect(door(page, 25)).toContainText('Christmas Day');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    });
  }

  test('a bonus door gets its own full-width row after the star door', async ({ page }) => {
    await withBonusDoor(page);
    await page.setViewportSize({ width: 375, height: 900 });
    await openAt(page, '2027-01-05T12:00:00Z');
    await expect(doors(page)).toHaveCount(26);
    const boxes = await page.evaluate(() => {
      const list = document.querySelector('.advent-doors')!.getBoundingClientRect();
      const buttons = [...document.querySelectorAll('.advent-doors button')].map((b) => b.getBoundingClientRect());
      return { width: list.width, star: buttons[24], bonus: buttons[25] };
    });
    expect(boxes.bonus.width).toBeGreaterThanOrEqual(boxes.width - 2);
    expect(boxes.bonus.y).toBeGreaterThanOrEqual(boxes.star.y + boxes.star.height);
    expect(boxes.bonus.height).toBeGreaterThanOrEqual(72);
  });
});

test.describe('survivors: deep link focus, labels after "Open it anyway"', () => {
  test('/advent#day-7 then Escape returns focus to door 7', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z', '#day-7');
    await expect(dialogTitle(page)).toHaveText(TITLES[7]);
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await expect(door(page, 7)).toBeFocused();
  });

  test('after "Open it anyway" on day 13 the labels of not-yet neighbours still say "not yet" with no title', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await expect(door(page, 12)).toHaveAttribute('aria-label', /\. /);
    await door(page, 13).click();
    await dialog(page).getByRole('button', { name: 'Open it anyway' }).click();
    await expect(dialogTitle(page)).toHaveText(TITLES[13]);
    await expect(dialog(page).locator('.advent-next')).toHaveAttribute('aria-label', 'Next: Day 14, not yet');
    await dialog(page).locator('.advent-previous').click();
    await expect(dialogTitle(page)).toHaveText(TITLES[12]);
    await expect(dialog(page).locator('.advent-next')).toHaveAttribute('aria-label', 'Next: Day 13, not yet');
    expect(await dialog(page).locator('.advent-nav').innerText()).not.toContain(TITLES[13]);
    expect(await door(page, 13).getAttribute('aria-label')).toBe('Day 13, 13 December, not yet');
  });
});
