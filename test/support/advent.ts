// Shared by the specs that treat the Advent calendar page specially.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { ADVENT_PAGE } from './pages';

// Reads the theme's publicListing switch from its source (theme.mjs is an ES module and the
// specs are CommonJS), so the specs follow the switch instead of hard-coding today's value.
export function adventPubliclyListed(): boolean {
  const source = readFileSync(join(__dirname, '..', '..', 'modules', 'advent', 'theme.mjs'), 'utf8');
  const match = /^\s*publicListing:\s*(true|false)\s*,/m.exec(source);
  if (!match) throw new Error('could not read publicListing from modules/advent/theme.mjs');
  return match[1] === 'true';
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
  activity: string;
  prayer: string;
  alt: string;
  hidden?: string;
  translation: string;
  credit: string;
  art?: string;
}

/** The built day file for day n (what the browser fetches). Day 26 does not exist in the real build. */
export function builtDay(n: number): DayFile {
  const name = `day-${String(n).padStart(2, '0')}.json`;
  return JSON.parse(readFileSync(join(__dirname, '..', '..', 'public', 'advent', name), 'utf8'));
}

export const TITLES: Record<number, string> = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [i + 1, builtDay(i + 1).title]));

/** A TEST FIXTURE for the bonus (26th) door, the same text as test-unit/support/bonus-fixture.mjs. Not real content. */
export const BONUS_FILE: DayFile = {
  day: 26,
  title: 'Gifts for a King',
  ref: 'Matthew 2:1-12',
  paragraphs: [
    'Wise visitors followed a star a very long way to find a child. They brought gifts to honour him. This is the fixture text for a bonus door.',
    'A second paragraph, so the tests can see that more than one paragraph is shown.',
  ],
  wonder: 'I wonder which gift you would bring?',
  activity: 'Wrap a small gift for someone, with a star on the label.',
  prayer: 'God of every journey, thank you for the star that leads us home. Amen.',
  alt: 'Three travellers with gifts follow a bright star over a quiet hill.',
  credit: 'Test fixture illustration',
  translation: 'Retold in our own words, as a test fixture.',
  hidden: 'A tiny camel at the edge of the hill.',
};

const LIVE_PAGE = /^https?:\/\/localhost:\d+\/(?:advent\.html|index\.html)?(?:\?.*)?$/;
const GO_LIVE_OFF = 'data-go-live="false"';

/**
 * The real flags keep the calendar hidden from the real date until launch (theme.goLive false). The browser tests
 * exercise the calendar by date, so this route turns goLive ON in the served page. Only the pre-launch guard
 * (test/advent-prelaunch.spec.ts) runs without it.
 */
export async function forceGoLive(page: Page): Promise<void> {
  await page.route(LIVE_PAGE, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).split(GO_LIVE_OFF).join('data-go-live="true"') });
  });
}

/**
 * Makes the page behave as if the site had bonus-door content: adds the bonus settings to the calendar markup and
 * answers the day-26 request with the fixture. (The real build has no bonus text yet, so this is route interception.)
 */
export async function withBonusDoor(page: Page): Promise<void> {
  await page.route(/\/advent\.html(\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).split(GO_LIVE_OFF).join('data-go-live="true"').replace('<section class="advent" ', '<section class="advent" data-bonus-month="1" data-bonus-day="6" data-bonus-label="Epiphany" ');
    await route.fulfill({ response, body });
  });
  await page.route('**/advent/day-26.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(BONUS_FILE) }));
}

/** A tiny, valid picture for tests that need a day to have art (the real build has none yet). */
export const TEST_ART = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225"><rect width="400" height="225" fill="#1b2a3a"/></svg>';
