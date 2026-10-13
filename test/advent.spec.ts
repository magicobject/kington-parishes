import { test, expect, type Page } from '@playwright/test';
import { ADVENT_PAGE } from './support/pages';

// The Advent calendar page (phase 2): date logic and placeholder doors only. Every test fixes the
// browser's clock with page.clock so the real date never matters. Dates are worked out in London time.
//
// This file imports test/expect from @playwright/test (not ./support/fixtures) on purpose: it blocks
// outside requests itself, so it can also assert that nothing but the site's own fonts is ever asked for.

const PATH = ADVENT_PAGE.path;
const REAL_TODAY = '2026-10-13T12:00:00Z';

test.beforeEach(async ({ page }) => {
  // Only the template's own Google Fonts requests leave the site; refuse them so the suite stays offline.
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
});

async function openAt(page: Page, isoTime: string, query = '', path = PATH) {
  await page.clock.install({ time: new Date(isoTime) });
  await page.goto(`${path}${query}`);
}

const section = (page: Page) => page.locator('section.advent');
const doors = (page: Page) => section(page).locator('.advent-doors button');
const calmText = (page: Page) => section(page).locator('[data-advent-calm-text]');
const noticeText = (page: Page) => section(page).locator('[data-advent-notice-text]');

async function doorLabels(page: Page): Promise<string[]> {
  return doors(page).evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label') ?? ''));
}

const label = (day: number, state: 'today' | 'not yet' | 'available') => `Day ${day}, ${day} December, ${state}`;

function expectedLabels(today: number | null, allAvailable = false): string[] {
  return Array.from({ length: 25 }, (_, i) => {
    const day = i + 1;
    if (allAvailable) return label(day, 'available');
    if (today === null) return label(day, 'not yet');
    return label(day, day < today ? 'available' : day === today ? 'today' : 'not yet');
  });
}

async function expectCalm(page: Page, text: string) {
  await expect(calmText(page)).toBeVisible();
  await expect(calmText(page)).toHaveText(text);
  await expect(doors(page)).toHaveCount(0);
  await expect(section(page).locator('[data-advent-live]')).toBeHidden();
}

test.describe('the season, by date (London time)', () => {
  test('30 November: the calm message only, no doors', async ({ page }) => {
    await openAt(page, '2026-11-30T12:00:00Z');
    await expectCalm(page, 'The Advent calendar opens on 1 December.');
    await expect(section(page).locator('button')).toHaveCount(0);
  });

  test('the very last second of 30 November is still calm; 1 December 00:00 opens door 1', async ({ page }) => {
    await openAt(page, '2026-11-30T23:59:59Z');
    await expectCalm(page, 'The Advent calendar opens on 1 December.');
    await page.clock.setFixedTime(new Date('2026-12-01T00:00:00Z'));
    await page.reload();
    expect(await doorLabels(page)).toEqual(expectedLabels(1));
  });

  test('1 December: door 1 is today and doors 2 to 25 are not yet', async ({ page }) => {
    await openAt(page, '2026-12-01T00:00:00Z');
    expect(await doorLabels(page)).toEqual(expectedLabels(1));
    await expect(section(page).locator('[data-advent-calm]')).toBeHidden();
  });

  test('12 December: doors 1 to 11 available, 12 today, 13 onwards not yet', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    expect(await doorLabels(page)).toEqual(expectedLabels(12));
  });

  test('25 December: doors 1 to 24 available and 25 today', async ({ page }) => {
    await openAt(page, '2026-12-25T23:30:00Z');
    expect(await doorLabels(page)).toEqual(expectedLabels(25));
  });

  test('26 December: the archive, every door available and none is today', async ({ page }) => {
    await openAt(page, '2026-12-26T00:00:00Z');
    expect(await doorLabels(page)).toEqual(expectedLabels(null, true));
  });

  test('6 January is still the archive; 7 January is the same calm message', async ({ page }) => {
    await openAt(page, '2027-01-06T12:00:00Z');
    expect(await doorLabels(page)).toEqual(expectedLabels(null, true));
    await page.clock.setFixedTime(new Date('2027-01-07T12:00:00Z'));
    await page.reload();
    await expectCalm(page, 'The Advent calendar opens on 1 December.');
  });

  test('the real date today (October) shows the same calm message', async ({ page }) => {
    await openAt(page, REAL_TODAY);
    await expectCalm(page, 'The Advent calendar opens on 1 December.');
  });

  test('every door is a real button with a visible number and the right accessible name', async ({ page }) => {
    await openAt(page, '2026-12-03T12:00:00Z');
    await expect(doors(page).first()).toHaveText('1');
    await expect(page.getByRole('button', { name: 'Day 3, 3 December, today' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Day 2, 2 December, available' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Day 4, 4 December, not yet' })).toBeVisible();
    await expect(section(page).locator('.advent-placeholder-note')).toContainText('Placeholder');
    // The note is tied to the list, so a screen reader hears that these doors are placeholders.
    const describedBy = await section(page).locator('.advent-doors').getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`#${describedBy}`)).toHaveClass(/advent-placeholder-note/);
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
    expect(await doorLabels(page)).toEqual(expectedLabels(11));
  });
});

test.describe('the preview switch', () => {
  test('?advent-preview=2026-12-07 shows 7 December, the notice, and an exit link with no parameter', async ({ page }) => {
    await openAt(page, REAL_TODAY, '?advent-preview=2026-12-07');
    expect(await doorLabels(page)).toEqual(expectedLabels(7));
    await expect(noticeText(page)).toHaveText("Preview mode: not today's date. Showing 7 December 2026.");

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

  test('a preview date before December gives the calm message and still shows the notice', async ({ page }) => {
    await openAt(page, REAL_TODAY, '?advent-preview=2026-11-15');
    await expectCalm(page, 'The Advent calendar opens on 1 December.');
    await expect(noticeText(page)).toHaveText("Preview mode: not today's date. Showing 15 November 2026.");
  });

  test('a preview inside the archive period shows every door available', async ({ page }) => {
    await openAt(page, REAL_TODAY, '?advent-preview=2026-12-28');
    expect(await doorLabels(page)).toEqual(expectedLabels(null, true));
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
    for (const other of ['/contact.html', '/index.html']) {
      await page.clock.install({ time: new Date(REAL_TODAY) });
      await page.goto(other);
      const plain = await page.locator('body').innerText();
      await page.goto(`${other}?advent-preview=2026-12-07`);
      expect(await page.locator('body').innerText(), other).toBe(plain);
      await expect(page.locator('section.advent')).toHaveCount(0);
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

test.describe('nothing is stored, nothing leaves the site', () => {
  test('no cookie, local storage or session storage is written, at any point, in any state', async ({ page }) => {
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
    });
    for (const [time, query] of [[REAL_TODAY, ''], ['2026-12-12T12:00:00Z', ''], [REAL_TODAY, '?advent-preview=2026-12-07'], ['2026-12-27T12:00:00Z', '']]) {
      await openAt(page, time, query);
      expect(await page.evaluate(() => (window as unknown as { __writes: string[] }).__writes), `${time} ${query}`).toEqual([]);
      expect(await page.evaluate(() => document.cookie)).toBe('');
      expect(await page.evaluate(() => localStorage.length)).toBe(0);
      expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
    }
    expect(await page.context().cookies()).toEqual([]);

    // Prove the spy itself works, so the empty lists above mean something.
    await page.evaluate(() => { localStorage.setItem('probe', '1'); document.cookie = 'probe=1'; });
    expect(await page.evaluate(() => (window as unknown as { __writes: string[] }).__writes)).toEqual(['storage.setItem', 'cookie']);
  });

  test('no console errors, only same-origin requests (besides the template fonts), and no Set-Cookie', async ({ page }) => {
    const errors: string[] = [];
    const requests: string[] = [];
    const setCookies: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text());
    });
    page.on('request', (request) => requests.push(request.url()));
    page.on('response', async (response) => {
      if ('set-cookie' in (await response.allHeaders())) setCookies.push(response.url());
    });
    await openAt(page, '2026-12-12T12:00:00Z', '?advent-preview=2026-12-07');
    await expect(doors(page)).toHaveCount(25);
    expect(errors).toEqual([]);
    const outside = requests.filter((url) => !url.startsWith('http://localhost:') && !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url));
    expect(outside).toEqual([]);
    expect(setCookies).toEqual([]);
  });
});

test.describe('when things go wrong', () => {
  test('if Intl misbehaves the page falls back to the calm message', async ({ page }) => {
    await page.addInitScript(() => {
      (Intl as unknown as { DateTimeFormat: unknown }).DateTimeFormat = function broken() { throw new Error('no Intl'); };
    });
    await openAt(page, '2026-12-12T12:00:00Z');
    await expectCalm(page, 'The Advent calendar opens on 1 December.');
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the calm message is there and a note explains the calendar needs JavaScript; nothing from the days', async ({ page }) => {
    await page.goto(PATH);
    await expect(calmText(page)).toHaveText('The Advent calendar opens on 1 December.');
    await expect(section(page).locator('noscript')).toHaveCount(1);
    expect(await section(page).locator('noscript').innerHTML()).toContain('needs JavaScript');
    await expect(section(page).locator('button')).toHaveCount(0);
  });
});

test.describe('keyboard', () => {
  test('tab moves through the doors in order, 1 to 25, after the exit link when previewing', async ({ page }) => {
    await openAt(page, REAL_TODAY, '?advent-preview=2026-12-07');
    await section(page).getByRole('link', { name: 'Exit preview' }).focus();
    const focused: string[] = [];
    for (let i = 0; i < 25; i += 1) {
      await page.keyboard.press('Tab');
      focused.push(await page.evaluate(() => document.activeElement?.textContent ?? ''));
    }
    expect(focused).toEqual(Array.from({ length: 25 }, (_, i) => String(i + 1)));
  });

  test('a focused door has a visible focus ring', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await page.keyboard.press('Tab'); // first tab stop is the skip link; keep going until a door has focus
    for (let i = 0; i < 40 && !(await page.evaluate(() => document.activeElement?.classList.contains('advent-door'))); i += 1) {
      await page.keyboard.press('Tab');
    }
    const outline = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element);
      return { width: style.outlineWidth, style: style.outlineStyle };
    });
    expect(outline.style).not.toBe('none');
    expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
  });
});
