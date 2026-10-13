import { test, expect } from './support/fixtures';
import type { Page } from '@playwright/test';
import { forceGoLive, withBonusDoor } from './support/advent';
import { AxeBuilder } from '@axe-core/playwright';
import { ALL_PAGES } from './support/pages';

const ALL_PATHS = [...ALL_PAGES.map((p) => p.path), '/404.html'];

function formatViolations(violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']): string {
  return violations
    .map((v) => {
      const nodes = v.nodes.map((n) => `    - ${n.target.join(' ')}\n      ${n.failureSummary?.replace(/\n/g, ' ')}`).join('\n');
      return `[${v.impact}] ${v.id}: ${v.description}\n${nodes}`;
    })
    .join('\n\n');
}

for (const path of ALL_PATHS) {
  test(`axe: ${path} has no accessibility violations`, async ({ page }) => {
    await page.goto(path);
    // Force-settle the reveal-on-scroll animation so this tests the real
    // final state, not a mid-transition frame — an element still fading in
    // from opacity:0 reads as low-contrast to axe, which isn't a real bug.
    // Adding the .in class alone isn't enough (it starts a fresh 0.6s
    // transition rather than jumping to the end state), so the transition
    // itself is killed too.
    await page.evaluate(() => {
      document.querySelectorAll('.reveal').forEach((el) => {
        el.classList.add('in');
        (el as HTMLElement).style.transition = 'none';
        (el as HTMLElement).style.opacity = '1';
        (el as HTMLElement).style.transform = 'none';
      });
    });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });
}

// CLAUDE.md's Accessibility rule ("no skipped levels — h1 → h2 → h3, not
// h1 → h3") isn't covered by the axe scan above: axe-core's heading-order
// check is tagged best-practice, not WCAG A/AA, so it's excluded from
// AxeBuilder's default analyze() ruleset. This checks it directly instead —
// a heading's level may never jump more than one deeper than the highest
// level seen so far on the page (dropping back down, e.g. h3 after h2, is
// always fine; skipping forward, e.g. h1 straight to h3, is not).
for (const path of ALL_PATHS) {
  test(`heading outline: ${path} has no skipped heading levels`, async ({ page }) => {
    await page.goto(path);
    const levels = await page.$$eval('h1, h2, h3, h4, h5, h6', (els) => els.map((el) => Number(el.tagName[1])));

    let maxSeen = 0;
    for (const level of levels) {
      expect(
        level,
        `heading order on ${path} was [${levels.join(', ')}] — level ${level} appears after only reaching h${maxSeen}`,
      ).toBeLessThanOrEqual(maxSeen + 1);
      maxSeen = Math.max(maxSeen, level);
    }
  });
}

// The primary nav collapses behind an ellipsis "Menu" toggle below 860px —
// scan both its closed and open states, since axe only sees what's actually
// in the accessibility tree at scan time.
test.describe('mobile nav toggle', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('axe: homepage, mobile nav closed', async ({ page }) => {
    await page.goto('/index.html');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  test('axe: homepage, mobile nav open', async ({ page }) => {
    await page.goto('/index.html');
    await page.getByRole('button', { name: 'Menu' }).click();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });
});

// The Advent calendar page changes completely with the date and with what has been opened, so scan it in EACH
// state, not just the default one the loop above sees: calm "before", doors with a preview notice, the archive,
// calm "after", and (new in phase 3) a day open in the dialog, the gentle "not yet" message, the friendly error,
// the archive with a day open, the bonus door, and the home page with the Advent banner showing. The site has no
// dark mode, so there is no dark scan to add. The clock is fixed so the result never depends on today's date.
interface AdventState {
  name: string;
  time: string;
  path?: string;
  query: string;
  /** What must be on screen before scanning. */
  ready: (page: Page) => Promise<void>;
  /** Interact first (open a day, ...). */
  act?: (page: Page) => Promise<void>;
  /** Set up the page (routes) before it loads. */
  setup?: (page: Page) => Promise<void>;
}

const advDoors = (page: Page) => page.locator('.advent .advent-doors button');
const advDialog = (page: Page) => page.locator('dialog.advent-dialog');
const readyDoors = (count: number) => async (page: Page) => { await expect(advDoors(page)).toHaveCount(count); };

const ADVENT_STATES: AdventState[] = [
  { name: 'before (30 November)', time: '2026-11-30T12:00:00Z', query: '', ready: readyDoors(0) },
  { name: 'live, with preview notice (7 December)', time: '2026-10-13T12:00:00Z', query: '?advent-preview=2026-12-07', ready: readyDoors(25) },
  { name: 'live, real date (12 December)', time: '2026-12-12T12:00:00Z', query: '', ready: readyDoors(25) },
  { name: 'archive (28 December)', time: '2026-12-28T12:00:00Z', query: '', ready: readyDoors(25) },
  { name: 'after (13 January)', time: '2027-01-13T12:00:00Z', query: '', ready: readyDoors(0) },
  {
    name: 'a day open in the dialog (12 December)', time: '2026-12-12T12:00:00Z', query: '', ready: readyDoors(25),
    act: async (page) => { await advDoors(page).nth(6).click(); await expect(page.locator('#advent-dialog-title')).toBeFocused(); await expect(advDialog(page).locator('.advent-story p').first()).toBeVisible(); },
  },
  {
    name: 'today\'s day open from the primary button (25 December, the star door)', time: '2026-12-25T12:00:00Z', query: '', ready: readyDoors(25),
    act: async (page) => { await page.locator('[data-advent-primary]').click(); await expect(page.locator('#advent-dialog-title')).toBeFocused(); },
  },
  {
    name: 'the gentle "not yet" message (12 December, door 20)', time: '2026-12-12T12:00:00Z', query: '', ready: readyDoors(25),
    act: async (page) => { await advDoors(page).nth(19).click(); await expect(page.locator('#advent-dialog-title')).toHaveText('Not quite yet'); },
  },
  {
    name: 'the friendly error (a day file that will not load)', time: '2026-12-12T12:00:00Z', query: '', ready: readyDoors(25),
    setup: async (page) => { await page.route('**/advent/day-07.json', (route) => route.fulfill({ status: 500, body: '' })); },
    act: async (page) => { await advDoors(page).nth(6).click(); await expect(advDialog(page).locator('.advent-message-text')).toContainText('Sorry'); },
  },
  {
    name: 'a day open in the archive (28 December)', time: '2026-12-28T12:00:00Z', query: '', ready: readyDoors(25),
    act: async (page) => { await advDoors(page).nth(24).click(); await expect(page.locator('#advent-dialog-title')).toBeFocused(); },
  },
  {
    name: 'a day open under a preview notice (7 December preview)', time: '2026-10-13T12:00:00Z', query: '?advent-preview=2026-12-07', ready: readyDoors(25),
    act: async (page) => { await advDoors(page).nth(2).click(); await expect(page.locator('#advent-dialog-title')).toBeFocused(); },
  },
  {
    name: 'the bonus door today (6 January, test-fixture content)', time: '2027-01-06T12:00:00Z', query: '', ready: readyDoors(26),
    setup: async (page) => { await withBonusDoor(page); },
  },
  {
    name: 'the bonus door open (6 January, test-fixture content)', time: '2027-01-06T12:00:00Z', query: '', ready: readyDoors(26),
    setup: async (page) => { await withBonusDoor(page); },
    act: async (page) => { await advDoors(page).nth(25).click(); await expect(page.locator('#advent-dialog-title')).toHaveText('Gifts for a King'); },
  },
  {
    name: 'the home page with the Advent banner showing (preview, 7 December)', time: '2026-10-13T12:00:00Z', path: '/', query: '?advent-preview=2026-12-07',
    ready: async (page) => { await expect(page.locator('.advent-teaser')).toBeVisible(); await expect(page.locator('.advent-teaser-line')).toContainText('Day 7'); },
  },
  {
    name: 'the home page with the Advent banner in the archive (27 December)', time: '2026-12-27T12:00:00Z', path: '/', query: '',
    ready: async (page) => { await expect(page.locator('.advent-teaser')).toBeVisible(); },
  },
];

for (const state of ADVENT_STATES) {
  async function load(page: Page) {
    await forceGoLive(page);
    await state.setup?.(page);
    await page.clock.install({ time: new Date(state.time) });
    await page.goto(`${state.path ?? '/advent.html'}${state.query}`);
    await state.ready(page);
    await state.act?.(page);
    // Let the door-swing finish, so a scan never sees a half-turned panel.
    await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
  }

  test(`axe: Advent calendar, ${state.name}`, async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
      document.querySelectorAll('.reveal').forEach((el) => {
        el.classList.add('in');
        (el as HTMLElement).style.transition = 'none';
        (el as HTMLElement).style.opacity = '1';
        (el as HTMLElement).style.transform = 'none';
      });
    });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  test(`heading outline: Advent calendar, ${state.name}, has no skipped levels`, async ({ page }) => {
    await load(page);
    // Only visible headings count: the calendar keeps its other state's heading hidden.
    const levels = await page.$$eval('h1, h2, h3, h4, h5, h6', (els) =>
      els.filter((el) => (el as HTMLElement).offsetParent !== null).map((el) => Number(el.tagName[1])));
    expect(levels[0]).toBe(1);
    let maxSeen = 0;
    for (const level of levels) {
      expect(level, `heading order was [${levels.join(', ')}]`).toBeLessThanOrEqual(maxSeen + 1);
      maxSeen = Math.max(maxSeen, level);
    }
  });
}
