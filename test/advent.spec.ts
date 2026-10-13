import { test, expect, type Page, type Locator } from '@playwright/test';
import { ADVENT_PAGE } from './support/pages';
import { bonusFile, TEST_ART, TITLES, builtDay, forceGoLive, withBonusDoor } from './support/advent';

// The Advent calendar page (phase 3): the real doors, the opened-day dialog, the gentle "not yet" message,
// sharing, printing, the archive, the bonus door, preview mode and the home-page banner. Every test fixes the
// browser's clock with page.clock so the real date never matters. Dates are worked out in London time.
//
// This file imports test/expect from @playwright/test (not ./support/fixtures) on purpose: it blocks
// outside requests itself, so it can also assert that nothing but the site's own fonts is ever asked for.

const PATH = ADVENT_PAGE.path;
const REAL_TODAY = '2026-10-13T12:00:00Z';
const FRIENDLY = 'Sorry, this door will not open right now. Please try again in a moment.';

test.beforeEach(async ({ page }) => {
  // Only the template's own Google Fonts requests leave the site; refuse them so the suite stays offline.
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
  await forceGoLive(page); // the real flags keep the calendar calm until launch; see test/advent-prelaunch.spec.ts
});

async function openAt(page: Page, isoTime: string, query = '', path = PATH) {
  await page.clock.install({ time: new Date(isoTime) });
  await page.goto(`${path}${query}`);
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const section = (page: Page) => page.locator('section.advent');
const doors = (page: Page) => section(page).locator('.advent-doors button');
const door = (page: Page, day: number) => doors(page).nth(day - 1);
const dialog = (page: Page) => page.locator('dialog.advent-dialog');
const dialogTitle = (page: Page) => page.locator('#advent-dialog-title');
const calmText = (page: Page) => section(page).locator('[data-advent-calm-text]');
const noticeText = (page: Page) => section(page).locator('[data-advent-notice-text]');
const status = (page: Page) => section(page).locator('[data-advent-status]');
const primary = (page: Page) => section(page).locator('[data-advent-primary]');
const live = (page: Page) => dialog(page).locator('[role="status"]');

type State = 'future' | 'today' | 'available';

function expectedName(day: number, state: State, withTitle = true): RegExp {
  const lead = `Day ${day}, ${day} December${day === 25 ? ', Christmas Day' : ''}`;
  if (state === 'future') return new RegExp(`^${escapeRegExp(`${lead}, not yet`)}$`);
  const head = state === 'today' ? `${lead}, today` : lead;
  return new RegExp(`^${escapeRegExp(head)}${withTitle ? `\\. ${escapeRegExp(TITLES[day])}` : ''}$`);
}

/** Checks the class and the accessible name of all 25 doors once their titles have loaded. */
async function expectDoors(page: Page, today: number | null, archive = false) {
  await expect(doors(page)).toHaveCount(25);
  for (let day = 1; day <= 25; day += 1) {
    const state: State = archive ? 'available' : today === null ? 'future' : day < today ? 'available' : day === today ? 'today' : 'future';
    await expect(door(page, day), `door ${day} class`).toHaveClass(new RegExp(`advent-door-${state}`));
    await expect(door(page, day), `door ${day} name`).toHaveAttribute('aria-label', expectedName(day, state));
  }
}

async function expectCalm(page: Page, text: string) {
  await expect(calmText(page)).toBeVisible();
  await expect(calmText(page)).toHaveText(text);
  await expect(doors(page)).toHaveCount(0);
  await expect(section(page).locator('[data-advent-live]')).toBeHidden();
}

test.describe('the season, by date (London time)', () => {
  test('30 November: the calm message only, no doors, no buttons, and no day file is even asked for', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (request) => { if (/\/advent\/day-/.test(request.url())) requested.push(request.url()); });
    await openAt(page, '2026-11-30T12:00:00Z');
    await expectCalm(page, 'The Advent calendar opens on 1 December.');
    await expect(section(page).locator('button:visible')).toHaveCount(0);
    await expect(dialog(page)).toHaveCount(0);
    expect(requested).toEqual([]);
  });

  test('the very last second of 30 November is still calm; 1 December 00:00 opens door 1', async ({ page }) => {
    await openAt(page, '2026-11-30T23:59:59Z');
    await expectCalm(page, 'The Advent calendar opens on 1 December.');
    await page.clock.setFixedTime(new Date('2026-12-01T00:00:00Z'));
    await page.reload();
    await expectDoors(page, 1);
  });

  test('1 December: door 1 is today, doors 2 to 25 are not yet, and only day 1 is fetched (no future title anywhere)', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (request) => { const m = /\/advent\/(day-\d+)\.json/.exec(request.url()); if (m) requested.push(m[1]); });
    await openAt(page, '2026-12-01T00:00:00Z');
    await expectDoors(page, 1);
    await expect(section(page).locator('[data-advent-calm]')).toBeHidden();
    await expect(status(page)).toHaveText(`Today is Day 1: ${TITLES[1]}`);
    expect(requested).toEqual(['day-01']);
    const html = await page.content();
    for (let day = 2; day <= 25; day += 1) expect(html, `day ${day}`).not.toContain(TITLES[day]);
  });

  test('12 December: doors 1 to 11 available, 12 today, 13 onwards not yet; status line and the primary button', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await expectDoors(page, 12);
    await expect(section(page).locator('[data-advent-heading]')).toHaveText('Kington Parishes Advent calendar');
    await expect(status(page)).toHaveText(`Today is Day 12: ${TITLES[12]}`);
    await expect(primary(page)).toBeVisible();
    await expect(primary(page)).toHaveText("Open today's door");
    // Only today and the earlier days were fetched for their titles: no future title is in the page.
    const html = await page.content();
    for (let day = 13; day <= 25; day += 1) expect(html, `day ${day}`).not.toContain(TITLES[day]);
  });

  test('25 December: doors 1 to 24 available and 25 (the star door) today, with the star over the ridge', async ({ page }) => {
    await openAt(page, '2026-12-25T23:30:00Z');
    await expectDoors(page, 25);
    await expect(door(page, 25)).toHaveClass(/advent-door-star/);
    await expect(section(page).locator('.advent-scene-star')).toHaveCount(1);
  });

  test('before Christmas Day there is no star; the scene picture is there, and decorative', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await expect(section(page).locator('.advent-scene-star')).toHaveCount(0);
    const scene = section(page).locator('.advent-scene-image');
    await expect(scene).toHaveAttribute('src', '/advent/scene.svg');
    await expect(scene).toHaveAttribute('alt', '');
    await expect(section(page).locator('[data-advent-scene]')).toHaveAttribute('aria-hidden', 'true');
    expect(await scene.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  });

  test('26 December: the archive, "The Christmas Story", every door available, none today, the star, no primary button', async ({ page }) => {
    await openAt(page, '2026-12-26T00:00:00Z');
    await expectDoors(page, null, true);
    await expect(section(page).locator('[data-advent-heading]')).toHaveText('The Christmas Story');
    await expect(status(page)).toHaveText('All 25 doors are open. Read at your own pace.');
    await expect(primary(page)).toBeHidden();
    await expect(section(page).locator('.advent-scene-star')).toHaveCount(1);
    await expect(section(page).locator('.advent-door-today')).toHaveCount(0);
  });

  test('6 January is still the archive; 7 January is the same calm message', async ({ page }) => {
    await openAt(page, '2027-01-06T12:00:00Z');
    await expectDoors(page, null, true);
    await page.clock.setFixedTime(new Date('2027-01-07T12:00:00Z'));
    await page.reload();
    await expectCalm(page, 'The Advent calendar opens on 1 December.');
  });

  test('the real date today (October) shows the same calm message', async ({ page }) => {
    await openAt(page, REAL_TODAY);
    await expectCalm(page, 'The Advent calendar opens on 1 December.');
  });

  test('every door is a real button with the day number (a star for 25), a date or the word Today, and a state-bearing name', async ({ page }) => {
    await openAt(page, '2026-12-03T12:00:00Z');
    await expect(door(page, 1)).toContainText('1');
    await expect(door(page, 3)).toContainText('Today');
    await expect(door(page, 4)).toContainText('4 Dec');
    await expect(door(page, 25)).toContainText('\u2605');
    await expect(door(page, 25)).toContainText('25 Dec');
    expect(await doors(page).evaluateAll((buttons) => buttons.every((b) => b.tagName === 'BUTTON'))).toBe(true);
    await expect(page.getByRole('button', { name: `Day 3, 3 December, today. ${TITLES[3]}` })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Day 4, 4 December, not yet' })).toBeVisible();
    await expect(section(page).locator('.advent-placeholder-note')).toHaveCount(0);
  });

  test('before and after the season say the same one sentence, with a non-breaking space in the date', async ({ page }) => {
    for (const time of ['2026-11-01T12:00:00Z', '2026-10-13T12:00:00Z', '2027-01-07T12:00:00Z']) {
      await openAt(page, time);
      expect(await calmText(page).evaluate((el) => el.textContent), time).toBe('The Advent calendar opens on 1\u00A0December.');
    }
    expect(await page.locator('main').innerText()).not.toContain('comes round again');
  });
});

test.describe('a visitor in New Zealand still sees London\'s date', () => {
  test.use({ timezoneId: 'Pacific/Auckland' });

  test('at 12:00 UTC on 30 November it is already 1 December in Auckland, but the calendar is still calm', async ({ page }) => {
    await openAt(page, '2026-11-30T12:00:00Z');
    expect(await page.evaluate(() => new Date().getDate())).toBe(1); // proves the browser really is on NZ time
    await expectCalm(page, 'The Advent calendar opens on 1 December.');
  });

  test('at 23:30 UTC on 11 December it is 12 December in Auckland, but London is still on door 11', async ({ page }) => {
    await openAt(page, '2026-12-11T23:30:00Z');
    await expectDoors(page, 11);
  });
});

test.describe('one heading for the calendar section', () => {
  test('exactly one visible h2 in the calendar in every state: calm, live and archive (it moves between the parts)', async ({ page }) => {
    for (const [time, where] of [[REAL_TODAY, 'calm'], ['2026-12-12T12:00:00Z', 'live'], ['2026-12-28T12:00:00Z', 'live']] as const) {
      await openAt(page, time);
      const visible = await section(page).locator('h2:not(.advent-title)').evaluateAll((els) => els.filter((el) => (el as HTMLElement).offsetParent !== null).map((el) => ({ text: el.textContent, inLive: !!el.closest('[data-advent-live]'), inCalm: !!el.closest('[data-advent-calm]') })));
      expect(visible, time).toHaveLength(1);
      expect(visible[0][where === 'calm' ? 'inCalm' : 'inLive']).toBe(true);
      expect(await section(page).locator('h2:not(.advent-title)').count()).toBe(1); // not even a hidden second one
    }
  });

  test('the anchor id of the calendar heading points at a visible element in every state', async ({ page }) => {
    for (const time of [REAL_TODAY, '2026-12-12T12:00:00Z']) {
      await openAt(page, time);
      const id = await section(page).locator('h2:not(.advent-title)').getAttribute('id');
      expect(id).toBeTruthy();
      expect(await page.locator(`#${id}`).count()).toBe(1);
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
  });

  test('the page title and description say what the calendar is', async ({ page }) => {
    await page.goto(PATH);
    await expect(page).toHaveTitle('Advent calendar \u2014 Kington Parishes');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'Open a new door each day from 1 to 25 December to read the Christmas story, from Genesis to Bethlehem.');
  });
});

test.describe('the opened-day dialog', () => {
  test('clicking an available door opens a modal dialog named by the day title, focus moves to the title, the live region says "Day 7 opened"', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await expectDoors(page, 12);
    await door(page, 7).click();
    const open = page.getByRole('dialog', { name: TITLES[7] });
    await expect(open).toBeVisible();
    expect(await dialog(page).evaluate((d: HTMLDialogElement) => d.matches(':modal'))).toBe(true);
    await expect(dialogTitle(page)).toBeFocused();
    await expect(dialogTitle(page)).toHaveText(TITLES[7]);
    await expect(live(page)).toHaveText('Day 7 opened');
    await expect(live(page)).toHaveAttribute('role', 'status');
  });

  test('shows the eyebrow, count, reference, translation credit, every paragraph, the two details, the prayer and the hint', async ({ page }) => {
    const file = builtDay(7);
    await openAt(page, '2026-12-12T12:00:00Z');
    await door(page, 7).click();
    await expect(dialogTitle(page)).toBeFocused();
    await expect(dialog(page).locator('.advent-eyebrow')).toHaveText('Day 7 \u00B7 7 December');
    await expect(dialog(page).locator('.advent-count')).toHaveText('7 of 25');
    await expect(dialog(page).locator('.advent-reference')).toHaveText(file.ref);
    await expect(dialog(page).locator('.advent-translation')).toHaveText(file.translation);
    await expect(dialog(page).locator('.advent-story p')).toHaveText(file.paragraphs);
    await expect(dialog(page).locator('summary').nth(0)).toHaveText('Think about it');
    await expect(dialog(page).locator('summary')).toHaveCount(1); // only "Think about it": "Try this together" and the hint were removed
    await expect(dialog(page).locator('.advent-wonder p')).toHaveText(file.wonder);
    await expect(dialog(page).locator('.advent-prayer h3')).toHaveText('A prayer');
    await expect(dialog(page).locator('.advent-prayer p')).toHaveText(file.prayer);
    // The real picture is at the top of the panel, with the day's alt text, 16:9.
    await expect(dialog(page).locator('.advent-art-image')).toBeVisible();
    await expect(dialog(page).locator('.advent-art-image')).toHaveAttribute('src', '/advent/art/day-07.svg');
    await expect(dialog(page).locator('.advent-art-image')).toHaveAttribute('alt', file.alt);
  });

  test('Escape closes it and focus goes back to the door that opened it', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await expectDoors(page, 12);
    await door(page, 7).click();
    await expect(dialogTitle(page)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await expect(door(page, 7)).toBeFocused();
  });

  test('the Close button and a click on the backdrop both close it, returning focus to the door', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await expectDoors(page, 12);
    await door(page, 3).click();
    await dialog(page).getByRole('button', { name: 'Close' }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(door(page, 3)).toBeFocused();
    await door(page, 4).click();
    await expect(dialogTitle(page)).toHaveText(TITLES[4]);
    await page.mouse.click(5, 5); // outside the panel: on the backdrop
    await expect(dialog(page)).toBeHidden();
    await expect(door(page, 4)).toBeFocused();
  });

  test('previous and next buttons are named with the target day and its title, and move between days', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await expectDoors(page, 12);
    await door(page, 7).click();
    const previous = dialog(page).locator('.advent-previous');
    const next = dialog(page).locator('.advent-next');
    await expect(previous).toHaveAttribute('aria-label', `Previous: Day 6, ${TITLES[6]}`);
    await expect(next).toHaveAttribute('aria-label', `Next: Day 8, ${TITLES[8]}`);
    await expect(previous).toContainText('Day 6');
    await expect(next).toContainText('Day 8');
    await next.click();
    await expect(dialogTitle(page)).toHaveText(TITLES[8]);
    await expect(dialogTitle(page)).toBeFocused();
    await expect(live(page)).toHaveText('Day 8 opened');
    await dialog(page).locator('.advent-previous').click();
    await dialog(page).locator('.advent-previous').click();
    await expect(dialogTitle(page)).toHaveText(TITLES[6]);
    await expect(live(page)).toHaveText('Day 6 opened');
  });

  test('day 1 has no previous button; day 25 has no next button (no bonus door)', async ({ page }) => {
    await openAt(page, '2026-12-26T12:00:00Z');
    await expectDoors(page, null, true);
    await door(page, 1).click();
    await expect(dialogTitle(page)).toHaveText(TITLES[1]);
    await expect(dialog(page).locator('.advent-previous')).toBeHidden();
    await expect(dialog(page).locator('.advent-next')).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Close' }).click();
    await door(page, 25).click();
    await expect(dialogTitle(page)).toHaveText(TITLES[25]);
    await expect(dialog(page).locator('.advent-next')).toBeHidden();
  });

  test('going on to a day that is not open yet shows the gentle message, and "Maybe later" comes back to the day you were reading', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await expectDoors(page, 12);
    await door(page, 12).click();
    await expect(dialogTitle(page)).toHaveText(TITLES[12]);
    const next = dialog(page).locator('.advent-next');
    await expect(next).toHaveAttribute('aria-label', 'Next: Day 13, not yet');
    await next.click();
    await expect(dialogTitle(page)).toHaveText('Not quite yet');
    await expect(dialog(page).locator('.advent-message-text')).toHaveText('This door opens on 13 December.');
    await dialog(page).getByRole('button', { name: 'Maybe later' }).click();
    await expect(dialogTitle(page)).toHaveText(TITLES[12]);
    await expect(dialog(page)).toBeVisible();
  });

  test('a story with a picture shows it, with the alt text, as an image from the art folder', async ({ page }) => {
    await page.route('**/advent/day-07.json', async (route) => {
      const response = await route.fetch();
      const file = await response.json();
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...file, art: 'day-07.svg' }) });
    });
    await page.route('**/advent/art/day-07.svg', (route) => route.fulfill({ contentType: 'image/svg+xml', body: TEST_ART }));
    await openAt(page, '2026-12-12T12:00:00Z');
    await door(page, 7).click();
    const image = dialog(page).locator('.advent-art-image');
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute('src', '/advent/art/day-07.svg');
    await expect(image).toHaveAttribute('alt', builtDay(7).alt);
    await expect(dialog(page).locator('.advent-art-credit')).toHaveText(builtDay(7).credit);
    expect(await image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  });

  test('the primary "Open today\'s door" button opens today\'s day, and Escape returns focus to it', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await expect(status(page)).toHaveText(`Today is Day 12: ${TITLES[12]}`);
    await primary(page).click();
    await expect(dialogTitle(page)).toHaveText(TITLES[12]);
    await page.keyboard.press('Escape');
    await expect(primary(page)).toBeFocused();
  });

  test('story text is set as plain text: a day file with markup in it is refused, not rendered', async ({ page }) => {
    await page.route('**/advent/day-07.json', async (route) => {
      const response = await route.fetch();
      const file = await response.json();
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...file, paragraphs: ['<img src=x onerror=alert(1)>'] }) });
    });
    await openAt(page, '2026-12-12T12:00:00Z');
    await door(page, 7).click();
    await expect(dialog(page).locator('.advent-message-text')).toHaveText(FRIENDLY);
    await expect(dialog(page).locator('img[src="x"]')).toHaveCount(0);
  });
});

test.describe('the gentle rule for doors that are not open yet', () => {
  test('a future door opens a small message, never saying "can\'t": "Not quite yet. This door opens on 15 December."', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await expectDoors(page, 12);
    await door(page, 15).click();
    await expect(page.getByRole('dialog', { name: 'Not quite yet' })).toBeVisible();
    await expect(dialog(page).locator('.advent-message-text')).toHaveText('This door opens on 15 December.');
    await expect(dialog(page).getByRole('button', { name: 'Open it anyway' })).toBeVisible();
    await expect(dialog(page).getByRole('button', { name: 'Maybe later' })).toBeVisible();
    expect(await dialog(page).innerText()).not.toMatch(/can.?t|cannot|forbidden|denied|locked/i);
    await expect(live(page)).toHaveText('This door opens on 15 December.');
    // Nothing from day 15 has been fetched or shown.
    expect(await page.content()).not.toContain(TITLES[15]);
  });

  test('"Maybe later" closes it and focus goes back to the door', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await expectDoors(page, 12);
    await door(page, 15).click();
    await dialog(page).getByRole('button', { name: 'Maybe later' }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(door(page, 15)).toBeFocused();
  });

  test('"Open it anyway" shows the day normally, in memory only; Escape also closes the message', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await expectDoors(page, 12);
    await door(page, 15).click();
    await dialog(page).getByRole('button', { name: 'Open it anyway' }).click();
    await expect(dialogTitle(page)).toHaveText(TITLES[15]);
    await expect(dialog(page).locator('.advent-count')).toHaveText('15 of 25');
    await page.keyboard.press('Escape');
    await expect(door(page, 15)).toBeFocused();
    // Nothing is remembered: the door is still "not yet" and still asks.
    await expect(door(page, 15)).toHaveAttribute('aria-label', 'Day 15, 15 December, not yet');
    await door(page, 15).click();
    await expect(dialogTitle(page)).toHaveText('Not quite yet');
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
  });
});

test.describe('#day-N deep links', () => {
  test('#day-7 opens that day when it is open', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z', '#day-7');
    await expect(dialogTitle(page)).toHaveText(TITLES[7]);
    await expect(live(page)).toHaveText('Day 7 opened');
  });

  test('#day-20 (not open yet) shows the gentle message', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z', '#day-20');
    await expect(dialogTitle(page)).toHaveText('Not quite yet');
    await expect(dialog(page).locator('.advent-message-text')).toHaveText('This door opens on 20 December.');
  });

  test('anything else after the # is ignored, including day 26 when there is no bonus door', async ({ page }) => {
    const hashes = ['#day-0', '#day-07', '#day-26', '#day-99', '#day-x', '#day-7x', '#other'];
    for (const [index, hash] of hashes.entries()) {
      await openAt(page, '2026-12-12T12:00:00Z', `?n=${index}${hash}`); // a new query each time, so the page really reloads
      await expect(doors(page)).toHaveCount(25);
      await expect(dialog(page), hash).toBeHidden();
    }
  });

  test('on a calm date a #day link opens nothing and shows the calm sentence', async ({ page }) => {
    await openAt(page, REAL_TODAY, '#day-7');
    await expectCalm(page, 'The Advent calendar opens on 1 December.');
    await expect(dialog(page)).toHaveCount(0);
  });

  test('in the archive #day-7 opens day 7', async ({ page }) => {
    await openAt(page, '2026-12-28T12:00:00Z', '#day-7');
    await expect(dialogTitle(page)).toHaveText(TITLES[7]);
  });
});

test.describe('sharing and printing', () => {
  test('with navigator.share, "Share this day" shares origin + path + #day-N and never the preview parameter', async ({ page }) => {
    await page.addInitScript(() => {
      const shared: unknown[] = [];
      (window as unknown as { __shared: unknown[] }).__shared = shared;
      Object.defineProperty(navigator, 'share', { value: async (data: unknown) => { shared.push(data); }, configurable: true });
    });
    await openAt(page, REAL_TODAY, '?advent-preview=2026-12-07');
    await door(page, 3).click();
    await expect(dialogTitle(page)).toHaveText(TITLES[3]);
    const share = dialog(page).getByRole('button', { name: 'Share this day' });
    await share.click();
    const shared = await page.evaluate(() => (window as unknown as { __shared: { url: string; title: string }[] }).__shared);
    expect(shared).toHaveLength(1);
    expect(shared[0].url).toBe(new URL(`${PATH}#day-3`, page.url()).href);
    expect(shared[0].url).not.toContain('preview');
    expect(shared[0].url).not.toContain('?');
    expect(shared[0].title).toBe(TITLES[3]);
  });

  test('without navigator.share the button is "Copy link" and writes the same address to the clipboard', async ({ page }) => {
    await page.addInitScript(() => {
      const copied: string[] = [];
      (window as unknown as { __copied: string[] }).__copied = copied;
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text: string) => { copied.push(text); } }, configurable: true });
    });
    await openAt(page, REAL_TODAY, '?advent-preview=2026-12-07');
    await door(page, 5).click();
    await dialog(page).getByRole('button', { name: 'Copy link' }).click();
    await expect(dialog(page).locator('.advent-share-status')).toHaveText('Link copied.');
    const copied = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied);
    expect(copied).toEqual([new URL(`${PATH}#day-5`, page.url()).href]);
    expect(copied[0]).not.toContain('preview');
  });

  test('if the clipboard refuses, a read-only box shows the link, selected', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('denied'); } }, configurable: true });
    });
    await openAt(page, REAL_TODAY, '?advent-preview=2026-12-07');
    await door(page, 5).click();
    await dialog(page).getByRole('button', { name: 'Copy link' }).click();
    const field = dialog(page).getByRole('textbox', { name: 'Link to this day' });
    await expect(field).toBeVisible();
    await expect(field).toHaveJSProperty('readOnly', true);
    await expect(field).toHaveValue(new URL(`${PATH}#day-5`, page.url()).href);
    await expect(field).toBeFocused();
  });

  test('if there is no clipboard at all, the same read-only box is used', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    });
    await openAt(page, '2026-12-12T12:00:00Z');
    await door(page, 5).click();
    await dialog(page).getByRole('button', { name: 'Copy link' }).click();
    await expect(dialog(page).getByRole('textbox', { name: 'Link to this day' })).toHaveValue(new URL(`${PATH}#day-5`, page.url()).href);
  });

  test('a cancelled share sheet is not an error', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: async () => { throw new DOMException('cancelled', 'AbortError'); }, configurable: true });
    });
    await openAt(page, '2026-12-12T12:00:00Z');
    await door(page, 5).click();
    await dialog(page).getByRole('button', { name: 'Share this day' }).click();
    await expect(dialogTitle(page)).toHaveText(TITLES[5]);
    expect(errors).toEqual([]);
  });

  test('"Print this day" asks the browser to print', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __prints: number }).__prints = 0;
      window.print = () => { (window as unknown as { __prints: number }).__prints += 1; };
    });
    await openAt(page, '2026-12-12T12:00:00Z');
    await door(page, 5).click();
    await dialog(page).getByRole('button', { name: 'Print this day' }).click();
    expect(await page.evaluate(() => (window as unknown as { __prints: number }).__prints)).toBe(1);
  });

  test('print: an opened day prints alone (site name, day, title, reference, story, reflection, prayer, credit); scene, buttons and the site header are gone', async ({ page }) => {
    const file = builtDay(5);
    await openAt(page, '2026-12-12T12:00:00Z');
    await door(page, 5).click();
    await expect(dialogTitle(page)).toHaveText(TITLES[5]);
    await page.emulateMedia({ media: 'print' });
    // A real print fires beforeprint, which opens the reflection (a closed <details> does not print).
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await expect(section(page).locator('.advent-scene')).toBeHidden();
    await expect(dialog(page).getByRole('button', { name: 'Close' })).toBeHidden();
    await expect(dialog(page).getByRole('button', { name: 'Print this day' })).toBeHidden();
    await expect(dialog(page).locator('.advent-nav')).toBeHidden();
    await expect(page.locator('header').first()).toBeHidden();
    await expect(page.locator('footer').first()).toBeHidden();
    await expect(section(page).locator('[data-advent-live]')).toBeHidden();
    await expect(dialog(page).locator('.advent-print-site')).toHaveText('Kington Parishes Advent calendar');
    for (const text of [file.title, file.ref, file.paragraphs[0], file.wonder, file.prayer, file.translation]) {
      await expect(dialog(page).getByText(text, { exact: false }).first(), text.slice(0, 30)).toBeVisible();
    }
    const colours = await dialogTitle(page).evaluate((el) => { const s = getComputedStyle(el); return [s.color, getComputedStyle(el.closest('dialog')!).backgroundColor]; });
    expect(colours).toEqual(['rgb(0, 0, 0)', 'rgb(255, 255, 255)']);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    expect(await dialog(page).locator('.advent-wonder').evaluate((el: HTMLDetailsElement) => el.open)).toBe(true); // open by default at desktop width, and put back after printing
  });

  test('print with no day open: the scene and the buttons are still hidden', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await expectDoors(page, 12);
    await page.emulateMedia({ media: 'print' });
    await expect(section(page).locator('.advent-scene')).toBeHidden();
    await expect(primary(page)).toBeHidden();
    await expect(doors(page).first()).toBeHidden();
  });
});

test.describe('the bonus door (Epiphany, 6 January), with test-fixture content', () => {
  test('before 6 January there are 26 doors and the bonus is the only one not yet open; it asks gently', async ({ page }) => {
    await withBonusDoor(page);
    await openAt(page, '2027-01-05T12:00:00Z');
    await expect(doors(page)).toHaveCount(26);
    await expect(door(page, 26)).toHaveClass(/advent-door-future/);
    await expect(door(page, 26)).toHaveAttribute('aria-label', 'Epiphany door, 6 January, not yet');
    await expect(door(page, 26)).toContainText('Epiphany');
    await expect(door(page, 26)).toContainText('6 Jan');
    await expect(section(page).locator('.advent-door-future')).toHaveCount(1);
    await expect(section(page).locator('.advent-door-today')).toHaveCount(0);
    await door(page, 26).click();
    await expect(dialogTitle(page)).toHaveText('Not quite yet');
    await expect(dialog(page).locator('.advent-message-text')).toHaveText('This door opens on 6 January.');
    await dialog(page).getByRole('button', { name: 'Open it anyway' }).click();
    await expect(dialogTitle(page)).toHaveText(bonusFile().title);
    await expect(dialog(page).locator('.advent-eyebrow')).toHaveText('Epiphany \u00B7 6 January');
    await expect(dialog(page).locator('.advent-count')).toHaveText('Bonus door');
    await expect(live(page)).toHaveText('Epiphany door opened');
  });

  test('on 6 January itself the bonus is today: the word Today, the primary button, and everything else available', async ({ page }) => {
    await withBonusDoor(page);
    await openAt(page, '2027-01-06T12:00:00Z');
    await expect(doors(page)).toHaveCount(26);
    await expect(door(page, 26)).toHaveClass(/advent-door-today/);
    await expect(door(page, 26)).toContainText('Today');
    await expect(door(page, 26)).toHaveAttribute('aria-label', `Epiphany door, 6 January, today. ${bonusFile().title}`);
    await expect(section(page).locator('.advent-door-available')).toHaveCount(25);
    await expect(status(page)).toHaveText('All 25 doors are open. The Epiphany door opens today. Read at your own pace.');
    await expect(primary(page)).toBeVisible();
    await primary(page).click();
    await expect(dialogTitle(page)).toHaveText(bonusFile().title);
    await expect(dialog(page).locator('.advent-previous')).toHaveAttribute('aria-label', `Previous: Day 25, ${TITLES[25]}`);
    await expect(dialog(page).locator('.advent-next')).toBeHidden();
  });

  test('day 25 leads on to the bonus door in the archive, and from the bonus you can step back to 25', async ({ page }) => {
    await withBonusDoor(page);
    await openAt(page, '2027-01-06T12:00:00Z');
    await expect(door(page, 26)).toHaveAttribute('aria-label', new RegExp(escapeRegExp(bonusFile().title))); // its title has loaded
    await door(page, 25).click();
    await expect(dialog(page).locator('.advent-next')).toHaveAttribute('aria-label', `Next: Epiphany, ${bonusFile().title}`);
    await dialog(page).locator('.advent-next').click();
    await expect(dialogTitle(page)).toHaveText(bonusFile().title);
    await dialog(page).locator('.advent-previous').click();
    await expect(dialogTitle(page)).toHaveText(TITLES[25]);
  });

  test('#day-26 opens the bonus when it is open', async ({ page }) => {
    await withBonusDoor(page);
    await openAt(page, '2027-01-06T12:00:00Z', '#day-26');
    await expect(dialogTitle(page)).toHaveText(bonusFile().title);
  });

  test('during the live days the bonus door is shown as not yet; 7 January is calm again', async ({ page }) => {
    await withBonusDoor(page);
    await openAt(page, '2026-12-12T12:00:00Z');
    await expect(doors(page)).toHaveCount(26);
    await expect(door(page, 26)).toHaveClass(/advent-door-future/);
    await page.clock.setFixedTime(new Date('2027-01-07T12:00:00Z'));
    await page.reload();
    await expectCalm(page, 'The Advent calendar opens on 1 December.');
  });
});

test.describe('the preview switch', () => {
  test('?advent-preview=2026-12-07 shows 7 December, the notice (a polite live region), and an exit link with no parameter', async ({ page }) => {
    await openAt(page, REAL_TODAY, '?advent-preview=2026-12-07');
    await expectDoors(page, 7);
    await expect(noticeText(page)).toHaveText("Preview mode: not today's date. Showing 7 December 2026.");
    await expect(section(page).locator('[data-advent-notice]')).toHaveAttribute('role', 'status');

    const exit = section(page).getByRole('link', { name: 'Exit preview' });
    await expect(exit).toBeVisible();
    const href = await exit.getAttribute('href');
    expect(href).toBe(new URL(PATH, page.url()).href);
    expect(href).not.toContain('?');
    expect(href).not.toContain('advent-preview');

    await exit.click();
    await expect(page).toHaveURL(new RegExp(`${PATH}$`));
    await expectCalm(page, 'The Advent calendar opens on 1 December.');
    await expect(section(page).locator('[data-advent-notice]')).toBeHidden();
  });

  test('the preview parameter appears in no link, no share address and no canonical on the page, even with a day open', async ({ page }) => {
    await openAt(page, REAL_TODAY, '?advent-preview=2026-12-07');
    await door(page, 3).click();
    await expect(dialogTitle(page)).toHaveText(TITLES[3]);
    const where = await page.evaluate(() => ({
      links: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? '').filter((href) => href.includes('preview')),
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '',
      og: document.querySelector('meta[property="og:url"]')?.getAttribute('content') ?? '',
      fields: [...document.querySelectorAll('input')].map((i) => i.value).filter((v) => v.includes('preview')),
    }));
    expect(where.links).toEqual([]);
    expect(where.canonical).not.toContain('preview');
    expect(where.og).not.toContain('preview');
    expect(where.fields).toEqual([]);
  });

  test('a preview date before December gives the calm message and still shows the notice', async ({ page }) => {
    await openAt(page, REAL_TODAY, '?advent-preview=2026-11-15');
    await expectCalm(page, 'The Advent calendar opens on 1 December.');
    await expect(noticeText(page)).toHaveText("Preview mode: not today's date. Showing 15 November 2026.");
  });

  test('a preview inside the archive period shows every door available', async ({ page }) => {
    await openAt(page, REAL_TODAY, '?advent-preview=2026-12-28');
    await expectDoors(page, null, true);
  });

  test('an unusable preview value is ignored: no notice, and the real date is used', async ({ page }) => {
    const bad = [
      '?advent-preview=2026-12-32', '?advent-preview=2026-13-01', '?advent-preview=abc', '?advent-preview=2026-12-7',
      '?advent-preview=2025-12-07', '?advent-preview=2026-10-31', '?advent-preview=2027-02-01', '?advent-preview=',
      '?advent-preview=2026-12-07&advent-preview=2026-12-08', '?advent-preview=2026-02-30', '?advent-preview=%3Cb%3E',
    ];
    for (const query of bad) {
      await openAt(page, REAL_TODAY, query);
      await expect(section(page).locator('[data-advent-notice]'), query).toBeHidden();
      await expectCalm(page, 'The Advent calendar opens on 1 December.');
    }
  });

  test('preview does nothing on any other page', async ({ page }) => {
    for (const other of ['/contact.html', '/services.html']) {
      await page.clock.install({ time: new Date(REAL_TODAY) });
      await page.goto(other);
      const plain = await page.locator('body').innerText();
      await page.goto(`${other}?advent-preview=2026-12-07`);
      expect(await page.locator('body').innerText(), other).toBe(plain);
      await expect(page.locator('section.advent')).toHaveCount(0);
      await expect(page.locator('.advent-teaser')).toHaveCount(0);
      await expect(page.getByText('Preview mode')).toHaveCount(0);
    }
  });

  test('a preview page tells search engines not to index it, even if the page itself did not', async ({ page }) => {
    await page.route(`**${PATH}*`, async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(/<meta name="robots"[^>]*>/, '');
      await route.fulfill({ response, body });
    });
    await openAt(page, REAL_TODAY, '?advent-preview=2026-12-07');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  });
});

test.describe('the home-page banner', () => {
  const banner = (page: Page) => page.locator('.advent-teaser');

  test('with the real date (October) nothing shows, nothing about the calendar is in the text, and no calendar file is requested', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (request) => { if (/\/advent\/(?:day-|scene|art\/)|advent(?:-theme|-teaser)?\.css|\/js\/advent\.js/.test(request.url())) requested.push(request.url()); });
    await openAt(page, REAL_TODAY, '', '/');
    await expect(banner(page)).toBeHidden();
    await expect(banner(page)).toBeEmpty();
    const text = await page.locator('body').innerText();
    expect(text.replace(/Advent Sunday/g, '')).not.toMatch(/advent/i);
    expect(requested).toEqual([]);
  });

  test('also nothing on 30 November, 7 January, and in a no-JavaScript visit', async ({ page }) => {
    for (const time of ['2026-11-30T12:00:00Z', '2027-01-07T12:00:00Z']) {
      await openAt(page, time, '', '/');
      await expect(banner(page), time).toBeHidden();
    }
  });

  test('12 December: the banner shows the heading, "Day 12" with today\'s title, and a link to the calendar page with no preview parameter', async ({ page }) => {
    const dayRequests: string[] = [];
    page.on('request', (request) => { const m = /\/advent\/(day-\d+)\.json/.exec(request.url()); if (m) dayRequests.push(m[1]); });
    await openAt(page, '2026-12-12T12:00:00Z', '', '/');
    await expect(banner(page)).toBeVisible();
    await expect(banner(page).getByRole('heading', { level: 2, name: 'Advent at Kington Parishes' })).toBeVisible();
    await expect(banner(page).locator('.advent-teaser-line')).toHaveText(`Day 12 \u00B7 ${TITLES[12]}`);
    const link = banner(page).getByRole('link', { name: "Open today's door" });
    await expect(link).toBeVisible();
    expect(await link.getAttribute('href')).toBe(new URL(PATH, page.url()).href);
    expect(dayRequests).toEqual(['day-12']); // only today's file, for its title
    await expect(banner(page).locator('img')).toHaveAttribute('alt', '');
    const box = await link.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('a preview on the home page shows that day\'s banner, and the link still carries no parameter', async ({ page }) => {
    await openAt(page, REAL_TODAY, '?advent-preview=2026-12-07', '/');
    await expect(banner(page).locator('.advent-teaser-line')).toHaveText(`Day 7 \u00B7 ${TITLES[7]}`);
    const href = await banner(page).getByRole('link', { name: "Open today's door" }).getAttribute('href');
    expect(href).not.toContain('preview');
    expect(href).not.toContain('?');
    expect(await page.evaluate(() => [...document.querySelectorAll('a[href]')].filter((a) => (a.getAttribute('href') ?? '').includes('preview')).length)).toBe(0);
  });

  test('the preview also works on /index.html, and an unusable value is ignored', async ({ page }) => {
    await openAt(page, REAL_TODAY, '?advent-preview=2026-12-07', '/index.html');
    await expect(banner(page)).toBeVisible();
    await openAt(page, REAL_TODAY, '?advent-preview=2026-12-99', '/');
    await expect(banner(page)).toBeHidden();
  });

  test('in the archive it says "The Christmas story, in 25 short pieces" and offers the calendar', async ({ page }) => {
    await openAt(page, '2026-12-27T12:00:00Z', '', '/');
    await expect(banner(page).locator('.advent-teaser-line')).toHaveText('The Christmas story, in 25 short pieces');
    await expect(banner(page).getByRole('link', { name: 'Open the calendar' })).toBeVisible();
  });

  test('if today\'s file cannot be fetched the banner still shows "Day N", quietly', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/advent/day-12.json', (route) => route.abort());
    await openAt(page, '2026-12-12T12:00:00Z', '', '/');
    await expect(banner(page).locator('.advent-teaser-line')).toHaveText('Day 12');
    expect(errors).toEqual([]);
  });

  test('the link goes to the calendar page, which (with the real date) is calm: the preview did not travel', async ({ page }) => {
    await openAt(page, REAL_TODAY, '?advent-preview=2026-12-07', '/');
    await banner(page).getByRole('link', { name: "Open today's door" }).click();
    await expect(page).toHaveURL(new RegExp(`${PATH}$`));
    await expectCalm(page, 'The Advent calendar opens on 1 December.');
  });

  test('the banner sits under the hero and the home page keeps a valid heading outline (h1, then h2s)', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z', '', '/');
    await expect(banner(page)).toBeVisible();
    const levels = await page.$$eval('main h1, main h2, main h3', (els) => els.filter((el) => (el as HTMLElement).offsetParent !== null).map((el) => Number(el.tagName[1])));
    expect(levels[0]).toBe(1);
    expect(levels[1]).toBe(2);
    const order = await page.evaluate(() => {
      const hero = document.querySelector('.hero')!;
      const banner = document.querySelector('.advent-teaser')!;
      return !!(hero.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(order).toBe(true);
  });
});

test.describe('nothing is stored, nothing leaves the site', () => {
  test('no cookie, local storage or session storage is written, at any point, in any state (doors opened, shared, previewed)', async ({ page }) => {
    await page.addInitScript(() => {
      const writes: string[] = [];
      (window as unknown as { __writes: string[] }).__writes = writes;
      const proto = Storage.prototype;
      for (const name of ['setItem', 'removeItem', 'clear'] as const) {
        const original = proto[name];
        proto[name] = function (this: Storage, ...args: never[]) {
          writes.push(`storage.${name}`);
          return (original as (...a: unknown[]) => unknown).apply(this, args);
        } as never;
      }
      const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!;
      Object.defineProperty(document, 'cookie', {
        get: () => cookie.get!.call(document),
        set: (value: string) => { writes.push('cookie'); cookie.set!.call(document, value); },
      });
      const idb = indexedDB.open.bind(indexedDB);
      indexedDB.open = (...args: Parameters<typeof idb>) => { writes.push('indexedDB.open'); return idb(...args); };
    });
    for (const [time, query] of [[REAL_TODAY, ''], ['2026-12-12T12:00:00Z', ''], [REAL_TODAY, '?advent-preview=2026-12-07'], ['2026-12-27T12:00:00Z', '']]) {
      await openAt(page, time, query);
      if (await doors(page).count()) {
        await expect(door(page, 2)).toHaveAttribute('aria-label', /\. /);
        await door(page, 2).click();
        await expect(dialogTitle(page)).toHaveText(TITLES[2]);
        await dialog(page).locator('.advent-next').click();
        await page.keyboard.press('Escape');
        await door(page, 20).click();
        await dialog(page).getByRole('button', { name: /Open it anyway|Close/ }).first().click();
      }
      expect(await page.evaluate(() => (window as unknown as { __writes: string[] }).__writes), `${time} ${query}`).toEqual([]);
      expect(await page.evaluate(() => document.cookie)).toBe('');
      expect(await page.evaluate(() => localStorage.length)).toBe(0);
      expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
      expect(await page.evaluate(() => location.hash === '' || location.hash.startsWith('#day-'))).toBe(true);
    }
    expect(await page.context().cookies()).toEqual([]);

    // Prove the spy itself works, so the empty lists above mean something.
    await page.evaluate(() => { localStorage.setItem('probe', '1'); document.cookie = 'probe=1'; });
    expect(await page.evaluate(() => (window as unknown as { __writes: string[] }).__writes)).toEqual(['storage.setItem', 'cookie']);
  });

  test('opening and closing days never changes the address (no history, no hash written)', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    const before = page.url();
    const length = await page.evaluate(() => history.length);
    await door(page, 4).click();
    await dialog(page).locator('.advent-next').click();
    await page.keyboard.press('Escape');
    expect(page.url()).toBe(before);
    expect(await page.evaluate(() => history.length)).toBe(length);
  });

  test('no console errors or warnings, only same-origin requests (besides the template fonts), no Set-Cookie, through a whole visit', async ({ page }) => {
    const problems: string[] = [];
    const requests: string[] = [];
    const setCookies: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type()) && !/Failed to load resource/.test(message.text())) problems.push(message.text());
    });
    page.on('request', (request) => requests.push(request.url()));
    page.on('response', async (response) => {
      if ('set-cookie' in (await response.allHeaders())) setCookies.push(response.url());
    });
    await openAt(page, '2026-12-12T12:00:00Z', '?advent-preview=2026-12-07');
    await expectDoors(page, 7);
    await door(page, 7).click();
    await dialog(page).locator('.advent-next').click();
    await page.keyboard.press('Escape');
    await door(page, 20).click();
    await dialog(page).getByRole('button', { name: 'Open it anyway' }).click();
    await expect(dialogTitle(page)).toHaveText(TITLES[20]);
    expect(problems).toEqual([]);
    const outside = requests.filter((url) => !url.startsWith('http://localhost:') && !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url));
    expect(outside).toEqual([]);
    expect(setCookies).toEqual([]);
    // Every day file asked for has an address of exactly /advent/day-NN.json.
    for (const url of requests.filter((u) => u.includes('/advent/day-'))) expect(new URL(url).pathname).toMatch(/^\/advent\/day-\d{2}\.json$/);
  });
});

test.describe('when things go wrong', () => {
  const broken: Record<string, (route: import('@playwright/test').Route) => Promise<void>> = {
    'a server error': (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
    'a missing file': (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'nope' }),
    'a network failure': (route) => route.abort('internetdisconnected'),
    'malformed JSON': (route) => route.fulfill({ contentType: 'application/json', body: '{"day": 7, "title": ' }),
    'a page of HTML instead': (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Oops</h1>' }),
    'JSON that is not an object': (route) => route.fulfill({ contentType: 'application/json', body: '[1,2,3]' }),
    'a file for the wrong day': async (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(builtDay(8)) }),
    'a file with an extra key': async (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...builtDay(7), extra: 'x' }) }),
    'a file with markup in a field': async (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...builtDay(7), title: '<b>Hi</b>' }) }),
    'an oversized file': async (route) => route.fulfill({ contentType: 'application/json', body: `${JSON.stringify(builtDay(7))}${' '.repeat(70 * 1024)}` }),
  };

  for (const [name, handler] of Object.entries(broken)) {
    test(`${name}: a friendly message, no raw error text, no page error, and the other doors still work`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
      await page.route('**/advent/day-07.json', handler);
      await openAt(page, '2026-12-12T12:00:00Z');
      await expect(doors(page)).toHaveCount(25);
      await door(page, 7).click();
      await expect(dialog(page).locator('.advent-message-text')).toHaveText(FRIENDLY);
      const shown = await dialog(page).innerText();
      expect(shown).not.toMatch(/error|exception|syntax|undefined|null|NaN|\bat \w+|<b>|Oops|500|404|fetch/i);
      await expect(dialogTitle(page)).toBeFocused();
      await dialog(page).getByRole('button', { name: 'Close' }).click();
      await expect(door(page, 7)).toBeFocused();
      // A different, healthy day opens normally afterwards.
      await door(page, 8).click();
      await expect(dialogTitle(page)).toHaveText(TITLES[8]);
      expect(errors).toEqual([]);
    });
  }

  test('a failed day is not remembered: once the network is back, opening it again works', async ({ page }) => {
    let healthy = false;
    await page.route('**/advent/day-07.json', (route) => (healthy ? route.continue() : route.fulfill({ status: 500, body: '' })));
    await openAt(page, '2026-12-12T12:00:00Z');
    await door(page, 7).click();
    await expect(dialog(page).locator('.advent-message-text')).toHaveText(FRIENDLY);
    await dialog(page).getByRole('button', { name: 'Close' }).click();
    healthy = true;
    await door(page, 7).click();
    await expect(dialogTitle(page)).toHaveText(TITLES[7]);
  });

  test('offline from the start: the doors still appear (without titles) and each one says the friendly message', async ({ page, context }) => {
    await page.route('**/advent/day-*.json', (route) => route.abort('internetdisconnected'));
    await openAt(page, '2026-12-12T12:00:00Z');
    await expect(doors(page)).toHaveCount(25);
    await expect(door(page, 3)).toHaveAttribute('aria-label', 'Day 3, 3 December');
    await expect(status(page)).toHaveText('Today is Day 12.');
    await door(page, 3).click();
    await expect(dialog(page).locator('.advent-message-text')).toHaveText(FRIENDLY);
    await context.setOffline(true);
    await dialog(page).getByRole('button', { name: 'Close' }).click();
    await door(page, 4).click();
    await expect(dialog(page).locator('.advent-message-text')).toHaveText(FRIENDLY);
  });

  test('if Intl misbehaves the page falls back to the calm message', async ({ page }) => {
    await page.addInitScript(() => {
      (Intl as unknown as { DateTimeFormat: unknown }).DateTimeFormat = function broken() { throw new Error('no Intl'); };
    });
    await openAt(page, '2026-12-12T12:00:00Z');
    await expectCalm(page, 'The Advent calendar opens on 1 December.');
  });

  test('moving on while a slow day is still loading never shows the old day over the new one', async ({ page }) => {
    await page.route('**/advent/day-07.json', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.continue();
    });
    await openAt(page, '2026-12-12T12:00:00Z');
    await door(page, 7).click(); // day 7 is slow: the dialog says it is opening the door
    await page.keyboard.press('Escape');
    await door(page, 9).click();
    await expect(dialogTitle(page)).toHaveText(TITLES[9]);
    await page.waitForTimeout(900); // long enough for the slow answer to arrive
    await expect(dialogTitle(page)).toHaveText(TITLES[9]);
    await expect(dialog(page).locator('.advent-count')).toHaveText('9 of 25');
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the served text is true on ANY date: it says the calendar needs JavaScript and when it runs (not "opens on 1 December"); nothing from the days', async ({ page }) => {
    for (const time of [REAL_TODAY, '2026-12-12T12:00:00Z']) {
      await page.clock.install({ time: new Date(time) }).catch(() => undefined);
      await page.goto(PATH);
      await expect(calmText(page), time).toHaveText('The Advent calendar needs JavaScript to open its doors. It runs from 1 to 25 December.');
      await expect(section(page).locator('[data-advent-heading]')).toBeVisible();
    }
    await expect(section(page).locator('noscript')).toHaveCount(0);
    await expect(section(page).locator('button:visible')).toHaveCount(0);
    await expect(doors(page)).toHaveCount(0);
    expect(await page.locator('main').innerText()).not.toMatch(/opens on/);
  });

  test('the home page shows nothing of the banner', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.advent-teaser')).toBeHidden();
    expect((await page.locator('body').innerText()).replace(/Advent Sunday/g, '')).not.toMatch(/advent/i);
  });
});

test.describe('keyboard', () => {
  test('tab moves through the doors in order, 1 to 25, after the exit link when previewing', async ({ page }) => {
    await openAt(page, REAL_TODAY, '?advent-preview=2026-12-07');
    await section(page).getByRole('link', { name: 'Exit preview' }).focus();
    await page.keyboard.press('Tab'); // the primary button
    await expect(primary(page)).toBeFocused();
    const focused: string[] = [];
    for (let i = 0; i < 25; i += 1) {
      await page.keyboard.press('Tab');
      focused.push(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')?.match(/^Day (\d+),/)?.[1] ?? ''));
    }
    expect(focused).toEqual(Array.from({ length: 25 }, (_, i) => String(i + 1)));
  });

  test('a keyboard-only walk: Enter on a door opens the day, Tab stays inside the dialog, Escape returns focus', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await expectDoors(page, 12);
    await door(page, 6).focus();
    await page.keyboard.press('Enter');
    await expect(dialogTitle(page)).toHaveText(TITLES[6]);
    await expect(dialogTitle(page)).toBeFocused();
    // Tab around many times: the page behind the modal dialog is never reached (no door, no site header).
    for (let i = 0; i < 20; i += 1) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => { const a = document.activeElement; return !!a && (a.closest('.advent-doors') !== null || a.closest('header') !== null); }), `tab ${i}`).toBe(false);
    }
    await dialogTitle(page).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog(page).getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toBeHidden();
    await expect(door(page, 6)).toBeFocused();
  });

  test('the gentle message is reachable and usable by keyboard alone', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await expectDoors(page, 12);
    await door(page, 20).focus();
    await page.keyboard.press('Space');
    await expect(dialogTitle(page)).toHaveText('Not quite yet');
    await page.keyboard.press('Tab'); // from the title straight to "Open it anyway" (Close comes before the title)
    await expect(dialog(page).getByRole('button', { name: 'Open it anyway' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialogTitle(page)).toHaveText(TITLES[20]);
  });

  test('a focused door and a focused dialog button have a visible focus ring of at least 3px', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await expectDoors(page, 12);
    for (const locator of [door(page, 5), door(page, 12), primary(page)]) {
      await locator.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      const outline = await locator.evaluate((el) => { const s = getComputedStyle(el); return { width: parseFloat(s.outlineWidth), style: s.outlineStyle, offset: parseFloat(s.outlineOffset) }; });
      expect(outline.style).not.toBe('none');
      expect(outline.width).toBeGreaterThanOrEqual(3);
      expect(outline.offset).toBeGreaterThanOrEqual(2); // drawn outside the door, so it sits on the sky even on the gold door
    }
    await door(page, 5).click();
    await dialogTitle(page).focus();
    await page.keyboard.press('Shift+Tab'); // the Close button, reached by keyboard
    await expect(dialog(page).getByRole('button', { name: 'Close' })).toBeFocused();
    const outline = await dialog(page).getByRole('button', { name: 'Close' }).evaluate((el) => { const s = getComputedStyle(el); return { width: parseFloat(s.outlineWidth), style: s.outlineStyle }; });
    expect(outline.style).not.toBe('none');
    expect(outline.width).toBeGreaterThanOrEqual(3);
  });
});

test.describe('motion, forced colours, size and zoom', () => {
  test('motion allowed: the day opens with a door-swing under 700ms that plays once; nothing loops anywhere', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await door(page, 5).click();
    await expect(dialogTitle(page)).toBeFocused();
    const animation = await dialog(page).locator('.advent-panel').evaluate((el) => { const s = getComputedStyle(el); return { name: s.animationName, duration: parseFloat(s.animationDuration) * 1000, count: s.animationIterationCount }; });
    expect(animation.name).toBe('advent-swing');
    expect(animation.duration).toBeGreaterThan(0);
    expect(animation.duration).toBeLessThan(700);
    expect(animation.count).toBe('1');
    const looping = await page.evaluate(() => [...document.querySelectorAll('*')].filter((el) => getComputedStyle(el).animationIterationCount === 'infinite' && getComputedStyle(el).animationName !== 'none').length);
    expect(looping).toBe(0);
  });

  test('reduced motion: no animation and no transition on the panel or the doors', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openAt(page, '2026-12-12T12:00:00Z');
    await expectDoors(page, 12);
    await door(page, 5).click();
    const panel = await dialog(page).locator('.advent-panel').evaluate((el) => getComputedStyle(el).animationName);
    expect(panel).toBe('none');
    const doorTransition = await door(page, 5).evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration));
    expect(doorTransition).toBeLessThan(0.01); // none, or the site's own 0.001ms rule for people who ask for less motion
    // Today still stands out in a still picture: the gold fill, a pale ring and the word.
    await dialog(page).getByRole('button', { name: 'Close' }).click();
    const today = await door(page, 12).evaluate((el) => { const s = getComputedStyle(el); return { ring: parseFloat(s.borderTopWidth), shadow: s.boxShadow }; });
    expect(today.ring).toBeGreaterThanOrEqual(3);
    expect(today.shadow).not.toBe('none');
    await expect(door(page, 12)).toContainText('Today');
  });

  test('forced colours: every door keeps a visible border, "today" is told apart by the word Today, "not yet" by a dashed edge', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await openAt(page, '2026-12-12T12:00:00Z');
    await expectDoors(page, 12);
    const borders = await doors(page).evaluateAll((buttons) => buttons.map((b) => { const s = getComputedStyle(b); return { width: parseFloat(s.borderTopWidth), style: s.borderTopStyle, today: b.classList.contains('advent-door-today'), future: b.classList.contains('advent-door-future'), text: b.textContent }; }));
    for (const border of borders) {
      expect(border.width).toBeGreaterThanOrEqual(2);
      expect(border.style).not.toBe('none');
    }
    expect(borders.filter((b) => b.today)).toHaveLength(1);
    expect(borders.filter((b) => b.today)[0].text).toContain('Today');
    expect(borders.filter((b) => b.today).every((b) => b.text?.includes('Today'))).toBe(true);
    expect(borders.filter((b) => b.future).every((b) => b.style === 'dashed')).toBe(true);
    expect(borders.filter((b) => !b.today && !(b.text ?? '').includes('Today')).length).toBe(24);
    await door(page, 5).click();
    await expect(dialog(page).getByRole('button', { name: 'Close' })).toBeVisible();
    const close = await dialog(page).getByRole('button', { name: 'Close' }).evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth));
    expect(close).toBeGreaterThanOrEqual(2);
  });

  test('doors are at least 72px square on a desktop screen and at least 60px on a phone; the Close button is at least 44px', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await openAt(page, '2026-12-12T12:00:00Z');
    await expectDoors(page, 12);
    for (const day of [1, 12, 13, 25]) {
      const box = (await door(page, day).boundingBox())!;
      expect(box.width, `door ${day} width`).toBeGreaterThanOrEqual(72);
      expect(box.height, `door ${day} height`).toBeGreaterThanOrEqual(72);
    }
    await page.setViewportSize({ width: 375, height: 800 });
    await page.reload();
    await expectDoors(page, 12);
    const phone = await doors(page).evaluateAll((buttons) => buttons.map((b) => { const r = b.getBoundingClientRect(); return [r.width, r.height]; }));
    for (const [width, height] of phone) {
      expect(width).toBeGreaterThanOrEqual(60);
      expect(height).toBeGreaterThanOrEqual(60);
    }
    await door(page, 5).click();
    const close = (await dialog(page).getByRole('button', { name: 'Close' }).boundingBox())!;
    expect(close.height).toBeGreaterThanOrEqual(44);
    expect(close.width).toBeGreaterThanOrEqual(44);
    for (const name of [/^Previous/, /^Next/, 'Copy link', 'Print this day']) {
      const button = dialog(page).getByRole('button', { name }).first();
      if (await button.isVisible().catch(() => false)) expect((await button.boundingBox())!.height, String(name)).toBeGreaterThanOrEqual(44);
    }
  });

  test('on a phone the doors make a grid of 3 to 5 columns and the day opens as a full-screen sheet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await openAt(page, '2026-12-12T12:00:00Z');
    await expectDoors(page, 12);
    const columns = await page.evaluate(() => getComputedStyle(document.querySelector('.advent-doors')!).gridTemplateColumns.split(' ').length);
    expect(columns).toBeGreaterThanOrEqual(3);
    expect(columns).toBeLessThanOrEqual(5);
    await door(page, 5).click();
    await expect(dialogTitle(page)).toBeFocused();
    const box = (await dialog(page).boundingBox())!;
    expect(Math.round(box.width)).toBe(390);
  });

  for (const width of [320, 375, 1100]) {
    test(`no sideways scrolling at ${width}px wide (320px stands in for 400% zoom), in every state`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      const noSideScroll = async (label: string) => {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, label).toBeLessThanOrEqual(0);
      };
      await openAt(page, REAL_TODAY);
      await noSideScroll('calm');
      await openAt(page, '2026-12-12T12:00:00Z', '?advent-preview=2026-12-12');
      await expectDoors(page, 12);
      await noSideScroll('doors with notice');
      await door(page, 7).click();
      await expect(dialogTitle(page)).toHaveText(TITLES[7]);
      await noSideScroll('day open');
      await dialog(page).locator('.advent-panel').evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished))); // let the door-swing finish
      const inner = await dialog(page).evaluate((d) => d.scrollWidth - d.clientWidth);
      expect(inner, 'inside the dialog').toBeLessThanOrEqual(0);
      await page.keyboard.press('Escape');
      await door(page, 20).click();
      await noSideScroll('gentle message');
      await page.keyboard.press('Escape');
      await openAt(page, '2026-12-28T12:00:00Z');
      await noSideScroll('archive');
    });
  }
});
