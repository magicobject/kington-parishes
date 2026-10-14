// Shared by the specs that treat the Advent calendar page specially.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { ADVENT_PAGE } from './pages';

// The theme and the content are the site's own ES modules; Node loads them straight into these CommonJS specs (no regular
// expression over their source), so the specs follow the real flags and the real number of days.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { theme } = require('../../src/advent/theme.mjs') as { theme: { publicListing: boolean; goLive: boolean; artRequired: boolean; bonus?: { label: string } | null } };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { content } = require('../../src/advent/content.mjs') as { content: { days: { day: number }[]; bonus?: { day: number } } };

/** How many numbered doors the content has (25 for Kington). */
export const DAY_COUNT: number = content.days.length;

export function adventPubliclyListed(): boolean {
  return theme.publicListing === true;
}

/** Paths that should carry noindex and be missing from the sitemap, besides the help guide and changelog. */
export function adventHiddenPaths(): string[] {
  return adventPubliclyListed() ? [] : [ADVENT_PAGE.path];
}

export interface DayFile {
  day: number;
  title: string;
  ref: string;
  paragraphs: string[];
  wonder: string;
  prayer: string;
  alt: string;
  translation: string;
  credit: string;
  art?: string;
}

/** The built day file for day n (what the browser fetches). The bonus day (DAY_COUNT + 1) exists only when the content has one. */
export function builtDay(n: number): DayFile {
  const name = `day-${String(n).padStart(2, '0')}.json`;
  return JSON.parse(readFileSync(join(__dirname, '..', '..', 'public', 'advent', name), 'utf8'));
}

export const TITLES: Record<number, string> = Object.fromEntries(Array.from({ length: DAY_COUNT }, (_, i) => [i + 1, builtDay(i + 1).title]));

/** True when the real content has a bonus day (a site without one simply has no bonus door). */
export const HAS_BONUS: boolean = Boolean(content.bonus);

/** The real bonus day (6 January, "Gifts for a King"), as the build publishes it. Lazy: importing this file never fails when there is none. */
export function bonusFile(): DayFile {
  if (!content.bonus) throw new Error('this site has no bonus day');
  return builtDay(content.bonus.day);
}

const LIVE_PAGE = /^https?:\/\/localhost:\d+\/(?:advent\.html|index\.html)?(?:\?.*)?$/;
const GO_LIVE_OFF = 'data-go-live="false"';

const BONUS_ATTRIBUTES = / data-bonus-(?:month|day|label)="[^"]*"/g;

/**
 * The real flags keep the calendar hidden from the real date until launch (theme.goLive false). The browser tests
 * exercise the calendar by date, so this route turns goLive ON in the served page. It also takes the bonus door OUT
 * of the markup, so most tests keep seeing the 25 numbered doors; withBonusDoor puts the real bonus door back. Only
 * the pre-launch guard (test/advent-prelaunch.spec.ts) runs without it.
 */
export async function forceGoLive(page: Page): Promise<void> {
  await page.route(LIVE_PAGE, async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).split(GO_LIVE_OFF).join('data-go-live="true"').replace(BONUS_ATTRIBUTES, '');
    await route.fulfill({ response, body });
  });
}

/**
 * Shows the REAL bonus door (Epiphany, 6 January, with its real text from content.mjs): goLive on, and the bonus
 * settings left in the markup. Registered after forceGoLive, so it wins.
 */
export async function withBonusDoor(page: Page): Promise<void> {
  await page.route(LIVE_PAGE, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).split(GO_LIVE_OFF).join('data-go-live="true"') });
  });
}

/** A tiny, valid picture for tests that need a day to have art (the real build has none yet). */
export const TEST_ART = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225"><rect width="400" height="225" fill="#1b2a3a"/></svg>';
