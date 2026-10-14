import { test, expect, type Page } from '@playwright/test';
import { ADVENT_PAGE } from './support/pages';
import { forceGoLive, withBonusDoor } from './support/advent';

// Third round of review fixes: focus after a held midnight refresh, an even door grid at every width, and the
// star door at large text sizes. Same set-up as advent-fixes.spec.ts.
const PATH = ADVENT_PAGE.path;

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
const activeLabel = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');

test.describe('focus after a refresh that waited for the dialog to close', () => {
  for (const [name, start, expected] of [['12 to 13 December', '2026-12-12T23:59:30Z', 'Day 5,'], ['25 to 26 December', '2026-12-25T23:59:30Z', 'Day 5,']] as const) {
    test(`${name}: Escape leaves focus on the rebuilt door, not on the page body`, async ({ page }) => {
      await openAt(page, start);
      await expect(door(page, 12)).toHaveAttribute('aria-label', /\. /);
      await door(page, 5).click();
      await expect(dialog(page)).toBeVisible();
      await page.clock.runFor(32_000);
      await page.keyboard.press('Escape');
      await expect(dialog(page)).toBeHidden();
      await expect.poll(() => activeLabel(page)).toMatch(new RegExp(`^${expected}`));
      expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
    });
  }

  test('6 to 7 January: the doors are gone, so focus lands on the calm sentence (never on the body)', async ({ page }) => {
    await openAt(page, '2027-01-06T23:59:30Z');
    await expect(doors(page)).toHaveCount(25);
    await expect(door(page, 5)).toHaveAttribute('aria-label', /\. /);
    await door(page, 5).click();
    await page.clock.runFor(32_000);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-advent-calm-text]')).toBeVisible();
    await expect(page.locator('[data-advent-calm-text]')).toBeFocused();
  });
});

test.describe('the door grid has no hole', () => {
  const widths = [320, 360, 375, 390, 430, 560, 600, 768, 900, 1100, 1280];
  for (const bonus of [false, true]) {
    for (const width of widths) {
      test(`${bonus ? 'with' : 'without'} the bonus door at ${width}px: every row of numbered doors has the same count, then the star door alone`, async ({ page }) => {
        if (bonus) await withBonusDoor(page);
        await page.setViewportSize({ width, height: 900 });
        await openAt(page, bonus ? '2027-01-05T12:00:00Z' : '2026-12-12T12:00:00Z');
        await expect(doors(page)).toHaveCount(bonus ? 26 : 25);
        const boxes = await page.evaluate(() => [...document.querySelectorAll('.advent-doors button')].map((b) => { const r = b.getBoundingClientRect(); return { y: Math.round(r.y), w: r.width, h: r.height }; }));
        const rows = new Map<number, number>();
        for (const box of boxes.slice(0, 24)) rows.set(box.y, (rows.get(box.y) ?? 0) + 1);
        const counts = [...rows.values()];
        expect(new Set(counts).size, `row counts ${counts.join(',')}`).toBe(1);
        expect(24 % counts[0]).toBe(0);
        expect(counts[0]).toBeGreaterThanOrEqual(3);
        expect(counts[0]).toBeLessThanOrEqual(6);
        for (const box of boxes.slice(0, 24)) {
          expect(box.w).toBeGreaterThanOrEqual(width >= 560 ? 72 : 60);
          expect(box.h).toBeGreaterThanOrEqual(width >= 560 ? 72 : 60);
        }
        expect(boxes[24].y).toBeGreaterThan(Math.max(...boxes.slice(0, 24).map((b) => b.y)));
        if (bonus) expect(boxes[25].y).toBeGreaterThan(boxes[24].y);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      });
    }
  }
});

test.describe('large text', () => {
  for (const width of [320, 375, 768]) {
    test(`at ${width}px with text enlarged to 200% nothing overflows a door, the star door included`, async ({ page }) => {
      await withBonusDoor(page);
      await page.setViewportSize({ width, height: 900 });
      await openAt(page, '2027-01-05T12:00:00Z');
      await expect(doors(page)).toHaveCount(26);
      await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
      const overflows = await page.evaluate(() => [...document.querySelectorAll('.advent-doors button')].map((b, i) => ({ i: i + 1, over: b.scrollWidth - b.clientWidth, overY: b.scrollHeight - b.clientHeight })).filter((d) => d.over > 0 || d.overY > 0));
      expect(overflows).toEqual([]);
      // The calendar itself does not overflow (the rest of the site at 200% text is not this test's business).
      expect(await page.evaluate(() => { const el = document.querySelector('section.advent')!; return el.scrollWidth - el.clientWidth; })).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('the real bonus door (Epiphany, "Gifts for a King")', () => {
  test('before 6 January it is a not-yet door on its own full-width row; on 6 January it is today and opens the real text', async ({ page }) => {
    await withBonusDoor(page);
    await openAt(page, '2027-01-05T12:00:00Z');
    await expect(doors(page)).toHaveCount(26);
    await expect(door(page, 26)).toHaveClass(/advent-door-future/);
    await expect(door(page, 26)).toHaveAttribute('aria-label', 'Epiphany door, 6 January, not yet');
    const style = await door(page, 26).evaluate((el) => { const s = getComputedStyle(el); return { borderStyle: s.borderTopStyle, width: el.getBoundingClientRect().width, list: el.closest('ul')!.getBoundingClientRect().width }; });
    expect(style.borderStyle).toBe('dashed');
    expect(style.width).toBeGreaterThanOrEqual(style.list - 2);

    await page.clock.setFixedTime(new Date('2027-01-06T10:00:00Z'));
    await page.reload();
    await expect(door(page, 26)).toHaveClass(/advent-door-today/);
    await expect(door(page, 26)).toContainText('Today');
    await door(page, 26).click();
    const real = (await import('./support/advent')).bonusFile();
    await expect(page.locator('#advent-dialog-title')).toHaveText('Gifts for a King');
    await expect(dialog(page).locator('.advent-reference')).toHaveText('Matthew 2:1-12');
    await expect(dialog(page).locator('.advent-translation')).toHaveText('Retold in our own words, with short quotations from the World English Bible.');
    await expect(dialog(page).locator('.advent-story p')).toHaveCount(5);
    await expect(dialog(page).locator('.advent-story p')).toHaveText(real.paragraphs);
    await expect(dialog(page).locator('.advent-story')).toContainText('wise people');
    await expect(dialog(page).locator('.advent-prayer p')).toHaveText(real.prayer);
    await expect(dialog(page).locator('.advent-art-image')).toHaveAttribute('src', '/advent/art/day-26.svg');
    await expect(dialog(page).locator('.advent-art-image')).toHaveAttribute('alt', real.alt);
    await expect(dialog(page).locator('summary')).toHaveText(['Think about it']);
    expect(await dialog(page).innerText()).not.toMatch(/three (wise|travellers|kings)/i);
  });

  test('by default (no bonus markup) there are only the 25 numbered doors, as before', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await expect(doors(page)).toHaveCount(25);
  });
});

test.describe('the pictures in the day panel', () => {
  for (const width of [320, 375, 1100]) {
    test(`at ${width}px the picture is 16:9, shows the day's alt text, and loading it moves nothing`, async ({ page }) => {
      await page.route('**/advent/art/day-04.svg', async (route) => { await new Promise((r) => setTimeout(r, 600)); await route.continue(); });
      await page.setViewportSize({ width, height: 900 });
      await openAt(page, '2026-12-12T12:00:00Z');
      await expect(door(page, 4)).toHaveAttribute('aria-label', /\. /);
      await door(page, 4).click();
      const title = page.locator('#advent-dialog-title');
      await expect(title).toBeVisible();
      const image = dialog(page).locator('.advent-art-image');
      await dialog(page).locator('.advent-panel').evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished))); // the door-swing distorts boxes while it plays
      const before = (await title.boundingBox())!.y;
      const box = (await image.boundingBox())!;
      expect(Math.abs(box.width / box.height - 16 / 9)).toBeLessThan(0.02); // the box has its shape before the picture arrives
      await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), { timeout: 5000 }).toBe(true);
      expect((await title.boundingBox())!.y).toBe(before);
      const day = (await import('./support/advent')).builtDay(4);
      await expect(image).toHaveAttribute('alt', day.alt);
      await expect(dialog(page).locator('summary')).toHaveCount(1);
      expect(await dialog(page).evaluate((d) => d.scrollWidth - d.clientWidth)).toBeLessThanOrEqual(0);
    });
  }

  test('print is text only: the picture and its credit are hidden', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await door(page, 4).click();
    await expect(dialog(page).locator('.advent-art-image')).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(dialog(page).locator('.advent-art')).toBeHidden();
    await expect(dialog(page).locator('.advent-story')).toBeVisible();
  });
});

test.describe('doors at large text sizes (root font size 100, 150, 200, 300 percent)', () => {
  for (const width of [320, 375, 768, 1100]) {
    for (const percent of [100, 150, 200, 300]) {
      test(`at ${width}px wide and ${percent}% text: no sideways scroll, no word broken across lines, the doors reflow into fewer columns`, async ({ page }) => {
        await withBonusDoor(page);
        await page.setViewportSize({ width, height: 900 });
        await openAt(page, '2027-01-06T12:00:00Z'); // 26 doors, the bonus door "today"
        await expect(doors(page)).toHaveCount(26);
        await page.evaluate((p) => { document.documentElement.style.fontSize = `${p}%`; }, percent);
        const result = await page.evaluate(() => {
          const live = document.querySelector('.advent-live')!;
          const list = document.querySelector('.advent-doors')!;
          const labelProblems: string[] = [];
          for (const el of document.querySelectorAll('.advent-doors li:not(.advent-door-wide) .advent-door-number, .advent-doors li:not(.advent-door-wide) .advent-door-sub')) {
            const style = getComputedStyle(el);
            const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.25;
            const lines = Math.round(el.getBoundingClientRect().height / lineHeight);
            const words = (el.textContent ?? '').trim().split(' ').length;
            if (lines > words) labelProblems.push(`${el.textContent} wraps to ${lines} lines`);
          }
          const columns = getComputedStyle(list).gridTemplateColumns.split(' ').length;
          const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
          const buttons = [...list.querySelectorAll('button')].map((b) => ({ over: b.scrollWidth - b.clientWidth, w: b.getBoundingClientRect().width / rem }));
          return {
            pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            liveOverflow: live.scrollWidth - live.clientWidth,
            columns, labelProblems, overflowingDoors: buttons.filter((b) => b.over > 0).length, narrowest: Math.min(...buttons.map((b) => b.w)),
          };
        });
        expect(result.liveOverflow).toBeLessThanOrEqual(0);
        expect(result.overflowingDoors).toBe(0);
        expect(result.labelProblems).toEqual([]);
        if (percent === 100) expect([3, 4, 6]).toContain(result.columns); // 24 numbered doors divide evenly
        else expect(24 % result.columns).toBe(0);
        expect(result.narrowest, 'every door is at least about 3.75rem wide at any text size').toBeGreaterThanOrEqual(result.columns === 1 ? 2.4 : 3.6); // (a single column on the narrowest phone at 300% can only be as wide as the screen allows)
        if (width <= 375 && percent >= 200) expect(result.columns).toBeLessThanOrEqual(2);
        expect(await page.evaluate(() => { const s = document.querySelector('section.advent')!; return s.scrollWidth - s.clientWidth; })).toBeLessThanOrEqual(0);
      });
    }
  }
});

test.describe('the Close button stays in reach (the header bar of the day sheet is sticky)', () => {
  for (const [width, height] of [[375, 812], [320, 200], [1100, 700]]) {
    test(`at ${width}x${height}: Close is inside the screen after opening, after scrolling to the bottom, and when the title has focus`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await openAt(page, '2026-12-28T12:00:00Z');
      await expect(door(page, 12)).toHaveAttribute('aria-label', /\. /);
      await door(page, 12).click();
      await expect(page.locator('#advent-dialog-title')).toBeFocused();
      const close = dialog(page).getByRole('button', { name: 'Close' });
      const inside = async (label: string) => {
        const box = (await close.boundingBox())!;
        expect(box.y, `${label}: top`).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height, `${label}: bottom`).toBeLessThanOrEqual(height);
        expect(box.x + box.width, `${label}: right`).toBeLessThanOrEqual(width);
      };
      await dialog(page).locator('.advent-panel').evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
      await inside('after opening');
      await dialog(page).evaluate((d) => d.scrollTo(0, d.scrollHeight));
      await inside('scrolled to the bottom');
      await dialog(page).evaluate((d) => d.scrollTo(0, d.scrollHeight / 2));
      await inside('scrolled to the middle');
      // The header bar stays put and has its own background and a hairline, so the text scrolls under it.
      const bar = await dialog(page).locator('.advent-panel-top').evaluate((el) => { const s = getComputedStyle(el); return { position: s.position, top: s.top, background: s.backgroundColor, border: s.borderBottomWidth }; });
      expect(bar.position).toBe('sticky');
      expect(bar.top).toBe('0px');
      expect(bar.background).not.toBe('rgba(0, 0, 0, 0)');
      expect(bar.border).toBe('1px');
      // Close is the first control in the page order of the sheet, and it can be used and focus returns.
      await close.click();
      await expect(dialog(page)).toBeHidden();
      await expect(door(page, 12)).toBeFocused();
    });
  }

  test('the focus ring on Close is not clipped by the header bar or the sheet edge', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openAt(page, '2026-12-28T12:00:00Z');
    await door(page, 12).click();
    await page.locator('#advent-dialog-title').focus();
    await page.keyboard.press('Shift+Tab');
    const close = dialog(page).getByRole('button', { name: 'Close' });
    await expect(close).toBeFocused();
    const room = await close.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const bar = el.closest('.advent-panel-top')!.getBoundingClientRect();
      const ring = parseFloat(getComputedStyle(el).outlineWidth) + parseFloat(getComputedStyle(el).outlineOffset);
      return { top: r.top - bar.top - ring, bottom: bar.bottom - r.bottom - ring, right: window.innerWidth - r.right - ring };
    });
    expect(room.top).toBeGreaterThanOrEqual(0);
    expect(room.bottom).toBeGreaterThanOrEqual(0);
    expect(room.right).toBeGreaterThanOrEqual(0);
  });
});

test.describe('the gentle "not yet" message is a small card, and the archive offers a place to start', () => {
  test('on a phone the message is a small centred card (not a full-screen sheet) with the backdrop visible, then "Open it anyway" turns it into the full-screen day', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openAt(page, '2026-12-12T12:00:00Z');
    await expect(door(page, 12)).toHaveAttribute('aria-label', /\. /);
    await door(page, 20).click();
    await expect(dialog(page).locator('#advent-dialog-title')).toHaveText('Not quite yet');
    await dialog(page).locator('.advent-panel').evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const card = (await dialog(page).boundingBox())!;
    expect(card.width).toBeLessThanOrEqual(22 * 16 + 1);
    expect(card.width).toBeGreaterThanOrEqual(250);
    expect(card.height).toBeLessThan(400);
    expect(card.x).toBeGreaterThan(8); // the backdrop shows on both sides
    expect(card.y).toBeGreaterThan(100); // centred, not stuck to the top
    await expect(dialog(page).locator('.advent-message-text')).toHaveText('This door opens on 20 December.');
    await expect(dialog(page).getByRole('button', { name: 'Open it anyway' })).toBeVisible();
    await expect(dialog(page).getByRole('button', { name: 'Maybe later' })).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Open it anyway' }).click();
    await expect(page.locator('#advent-dialog-title')).toHaveText(/\S/);
    await expect.poll(async () => (await dialog(page).boundingBox())!.width).toBeGreaterThanOrEqual(375);
  });

  test('screen readers hear it once: the heading says "Not quite yet", the live region only the date sentence, and no "Not yet" is repeated inside the card', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await door(page, 20).click();
    await expect(dialog(page).locator('[role="status"]')).toHaveText('This door opens on 20 December.');
    const text = await dialog(page).innerText();
    expect(text.match(/not (?:quite )?yet/gi)).toHaveLength(1); // only the heading
    await expect(page.getByRole('dialog', { name: 'Not quite yet' })).toBeVisible();
  });

  test('which button is visually primary is one swap of two custom properties (Maybe later is the filled gold button today)', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await door(page, 20).click();
    const anyway = dialog(page).getByRole('button', { name: 'Open it anyway' });
    const later = dialog(page).getByRole('button', { name: 'Maybe later' });
    const background = (button: typeof anyway) => button.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await background(later)).not.toBe('rgba(0, 0, 0, 0)');
    expect(await background(anyway)).toBe('rgba(0, 0, 0, 0)');
    // The swap: exchange the two background properties and the filled one moves to "Open it anyway".
    await page.evaluate(() => {
      const root = document.querySelector('.advent') as HTMLElement;
      const filled = getComputedStyle(root).getPropertyValue('--advent-gentle-later-bg');
      root.style.setProperty('--advent-gentle-later-bg', 'transparent');
      root.style.setProperty('--advent-gentle-anyway-bg', filled);
    });
    expect(await background(later)).toBe('rgba(0, 0, 0, 0)');
    expect(await background(anyway)).not.toBe('rgba(0, 0, 0, 0)');
    // Whatever looks primary, the keyboard order and the accessible names do not change: "Open it anyway" first, then "Maybe later".
    const names = await dialog(page).getByRole('button').allInnerTexts();
    expect(names.indexOf('Open it anyway')).toBeLessThan(names.indexOf('Maybe later'));
  });

  test('in the archive there is a quiet "Start with Day 1" pill under the status line, and it opens Day 1', async ({ page }) => {
    await openAt(page, '2026-12-28T12:00:00Z');
    await expect(page.locator('[data-advent-status]')).toHaveText('All 25 doors are open. Read at your own pace.');
    const start = page.locator('[data-advent-start] button');
    await expect(start).toBeVisible();
    await expect(start).toHaveText('Start with Day 1');
    expect(await start.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)'); // quiet, not filled
    await start.click();
    await expect(page.locator('#advent-dialog-title')).toHaveText(/./);
    await expect(dialog(page).locator('.advent-count')).toHaveText('1 of 25');
    await page.keyboard.press('Escape');
    await expect(start).toBeFocused();
  });

  test('during the live days (and on calm dates) there is no "Start with Day 1" pill', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await expect(page.locator('[data-advent-start]')).toBeHidden();
    await openAt(page, REAL_TODAY_FIX);
    await expect(page.locator('[data-advent-start]')).toBeHidden();
  });
});
const REAL_TODAY_FIX = '2026-10-13T12:00:00Z';

test.describe('the home banner thumbnail shows today\'s picture', () => {
  const banner = (page: Page) => page.locator('.advent-teaser');
  for (const [width, expectedWidth] of [[375, 120], [1100, 192]] as const) {
    test(`at ${width}px: a ${expectedWidth}px wide 16:9 thumbnail of today's day picture (alt empty), reserved space so nothing jumps, and a layout shift under the "good" limit`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(() => {
        (window as unknown as { __cls: number }).__cls = 0;
        new PerformanceObserver((list) => { for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
      });
      await openAt(page, '2026-12-12T12:00:00Z', '', '/');
      await expect(banner(page)).toBeVisible();
      const thumb = banner(page).locator('img.advent-teaser-thumb');
      await expect(thumb).toHaveAttribute('alt', '');
      await expect(thumb).toHaveAttribute('src', '/advent/art/day-12.svg');
      await expect.poll(() => thumb.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      const box = (await thumb.boundingBox())!;
      expect(Math.round(box.width)).toBe(expectedWidth);
      expect(Math.abs(box.width / box.height - 16 / 9)).toBeLessThan(0.03);
      const height = (await banner(page).boundingBox())!.height;
      await page.waitForTimeout(300);
      expect((await banner(page).boundingBox())!.height).toBe(height);
      const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
      console.log(`home banner layout shift at ${width}px: ${cls.toFixed(4)}`);
      // The banner itself appearing (in season only) pushes the page down once: that is the whole shift. Google's 'good' limit is 0.1.
      expect(cls, `layout shift ${cls}`).toBeLessThan(0.1);
    });
  }

  test('the box exists before the picture is known (the title fetch is slow), so the footer does not jump when the picture arrives', async ({ page }) => {
    await page.route('**/advent/day-12.json', async (route) => { await new Promise((r) => setTimeout(r, 700)); await route.continue(); });
    await page.setViewportSize({ width: 375, height: 900 });
    await openAt(page, '2026-12-12T12:00:00Z', '', '/');
    await expect(banner(page)).toBeVisible();
    const before = (await page.locator('.hero + .advent-teaser + section, .advent-teaser + section').first().boundingBox())!.y;
    await expect(banner(page).locator('img.advent-teaser-thumb')).toHaveAttribute('src', '/advent/art/day-12.svg');
    expect((await page.locator('.advent-teaser + section').first().boundingBox())!.y).toBe(before);
  });

  test('without a picture (a day file with no art, or the archive) the thumbnail falls back to the scene, still 16:9', async ({ page }) => {
    await page.route('**/advent/day-12.json', async (route) => {
      const { art, ...rest } = await (await route.fetch()).json();
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(rest) });
    });
    await openAt(page, '2026-12-12T12:00:00Z', '', '/');
    const thumb = banner(page).locator('img.advent-teaser-thumb');
    await expect(thumb).toHaveAttribute('src', '/advent/scene.svg');
    await openAt(page, '2026-12-28T12:00:00Z', '', '/');
    await expect(banner(page).locator('img.advent-teaser-thumb')).toHaveAttribute('src', '/advent/scene.svg');
  });

  test('on the real date nothing changes: hidden, empty, no calendar request', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (r) => { if (/\/advent\/(?:day-|scene|art\/)/.test(r.url())) requested.push(r.url()); });
    await openAt(page, '2026-10-13T12:00:00Z', '', '/');
    await expect(banner(page)).toBeHidden();
    await expect(banner(page)).toBeEmpty();
    expect(requested).toEqual([]);
  });
});
