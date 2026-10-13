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

async function openAt(page: Page, isoTime: string, query = '') {
  await page.clock.install({ time: new Date(isoTime) });
  await page.goto(`${PATH}${query}`);
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
    const real = (await import('./support/advent')).BONUS_FILE;
    await expect(page.locator('#advent-dialog-title')).toHaveText('Gifts for a King');
    await expect(dialog(page).locator('.advent-reference')).toHaveText('Matthew 2:1-12');
    await expect(dialog(page).locator('.advent-translation')).toHaveText('Retold in our own words, with short quotations from the World English Bible.');
    await expect(dialog(page).locator('.advent-story p')).toHaveCount(5);
    await expect(dialog(page).locator('.advent-story p')).toHaveText(real.paragraphs);
    await expect(dialog(page).locator('.advent-story')).toContainText('wise people');
    await expect(dialog(page).locator('.advent-prayer p')).toHaveText(real.prayer);
    await expect(dialog(page).locator('.advent-hint')).toBeHidden(); // no picture file yet
    expect(await dialog(page).innerText()).not.toMatch(/three (wise|travellers|kings)/i);
  });

  test('by default (no bonus markup) there are only the 25 numbered doors, as before', async ({ page }) => {
    await openAt(page, '2026-12-12T12:00:00Z');
    await expect(doors(page)).toHaveCount(25);
  });
});
