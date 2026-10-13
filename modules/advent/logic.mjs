// The pure, browser-safe pieces the calendar script is built from: reading the page's settings, building
// addresses, labels and share links, and checking a fetched day file. No DOM, no storage, no network, so
// every rule here is covered by plain unit tests. The build copies this file to js/advent/logic.js and
// rewrites its two imports, exactly as it does for date.mjs and preview.mjs.
//
// Safety rules kept here (spec S1-S14):
//  - a request address is built ONLY from a validated whole number (dayFileUrl) or a plain file name (artUrl);
//  - share and "exit preview" addresses are origin + path (+ #day-N) and never carry the preview date;
//  - a fetched day file is size-capped, parsed in try/catch and checked with the same rules as the build.
import { MONTH_NAMES, BONUS_DAY as DATE_BONUS_DAY } from './date.mjs';
import { DAY_COUNT, BONUS_DAY, artPathIsSafe, validateDayPayload } from './day.mjs';

export const MAX_DAY_BYTES = 64 * 1024;
export const FRIENDLY_ERROR = 'Sorry, this door will not open right now. Please try again in a moment.';
export const NOT_YET_TITLE = 'Not yet';

// The module's two copies of "the bonus door is number 26" (date.mjs has no imports, so it keeps its own).
if (BONUS_DAY !== DATE_BONUS_DAY) throw new Error('the bonus door number differs between date.mjs and day.mjs');

function checkDayNumber(day) {
  if (!Number.isInteger(day) || day < 1 || day > BONUS_DAY) throw new RangeError('day must be a whole number from 1 to 26');
  return day;
}

const twoDigits = (day) => String(checkDayNumber(day)).padStart(2, '0');

/** The address of one day's file. Built only from a validated whole number. */
export function dayFileUrl(day) {
  return `/advent/day-${twoDigits(day)}.json`;
}

/** The address of one picture. Only a plain file name like "day-05.svg" is accepted. */
export function artUrl(name) {
  if (!artPathIsSafe(name)) throw new Error('not a plain picture file name');
  return `/advent/art/${name}`;
}

function checkOrigin(origin) {
  if (typeof origin !== 'string' || !/^https?:\/\/[^\s/?#\\@]+$/.test(origin)) throw new Error('not an http(s) origin');
  return origin;
}

function cleanPath(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/') || pathname.startsWith('//') || pathname.includes('\\')) {
    throw new Error('not a plain path');
  }
  return pathname.split(/[?#]/)[0];
}

/** origin + path + "#day-N". Never the query, so the preview date can never travel in a shared link. */
export function shareUrl(origin, pathname, day) {
  checkDayNumber(day);
  return `${checkOrigin(origin)}${cleanPath(pathname)}#day-${day}`;
}

/** origin + path with no query and no hash (the "Exit preview" link and the home-page banner link). */
export function calendarUrl(origin, pathname) {
  return `${checkOrigin(origin)}${cleanPath(pathname)}`;
}

/** The door number named by a "#day-N" address fragment, or null. 26 only counts when there is a bonus door. */
export function parseDayHash(hash, hasBonus) {
  const match = typeof hash === 'string' ? /^#day-([1-9]\d?)$/.exec(hash) : null;
  if (!match) return null;
  const day = Number(match[1]);
  return day <= DAY_COUNT || (hasBonus && day === BONUS_DAY) ? day : null;
}

// ---------------------------------------------------------------------------
// Settings

const toInt = (text) => (typeof text === 'string' && /^\d+$/.test(text) ? Number(text) : null);

function monthDayOf(data, monthKey, dayKey) {
  const [month, day] = [toInt(data[monthKey]), toInt(data[dayKey])];
  return month === null || day === null ? null : { month, day };
}

/** The bonus door's settings ({on: {month, day}, label}) from the page's data, or null if there is none. */
export function bonusConfig(data) {
  const on = monthDayOf(data, 'bonusMonth', 'bonusDay');
  const label = data.bonusLabel;
  return on && typeof label === 'string' && label !== '' ? { on, label } : null;
}

/** Everything the page's data attributes say (a plain object of strings), or null if any of it is unusable. */
export function readConfig(data) {
  if (data === null || typeof data !== 'object') return null;
  const start = monthDayOf(data, 'startMonth', 'startDay');
  const end = monthDayOf(data, 'endMonth', 'endDay');
  const dayCount = toInt(data.dayCount);
  if (!start || !end || dayCount === null || !data.timeZone || !data.slug) return null;
  return {
    season: { start, end, archiveUntil: monthDayOf(data, 'archiveMonth', 'archiveDay') },
    timeZone: data.timeZone,
    slug: data.slug,
    previewEnabled: data.preview === 'true',
    enabled: data.enabled === 'true',
    dayCount,
    monthName: data.monthName || '',
    opensText: data.opensText || '',
    siteName: data.siteName || '',
    scene: typeof data.scene === 'string' && /^\/advent\/[a-z0-9-]+\.svg$/.test(data.scene) ? data.scene : null,
    bonus: bonusConfig(data),
  };
}

// ---------------------------------------------------------------------------
// Labels

// The month and day of door `day`: the start date plus the day number. Door 26 is the bonus date.
function doorDate(day, config) {
  if (day === BONUS_DAY) return config.bonus.on;
  const date = new Date(Date.UTC(2000, config.season.start.month - 1, config.season.start.day + day - 1));
  return { month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** "12 December" */
export function dateLabel(day, config) {
  const { month, day: dayOfMonth } = doorDate(checkDayNumber(day), config);
  return `${dayOfMonth} ${MONTH_NAMES[month - 1]}`;
}

/** "12 Dec" */
export function shortDateLabel(day, config) {
  const { month, day: dayOfMonth } = doorDate(checkDayNumber(day), config);
  return `${dayOfMonth} ${MONTH_NAMES[month - 1].slice(0, 3)}`;
}

/**
 * The accessible name of a door. The title is added only for a door that is open to read (today or available):
 * a future door never carries its title, in the page or in its name.
 */
export function doorName({ day, state, title }, config) {
  const date = dateLabel(day, config);
  const lead = day === BONUS_DAY ? `${config.bonus.label} door, ${date}` : day === config.dayCount ? `Day ${day}, ${date}, Christmas Day` : `Day ${day}, ${date}`;
  if (state === 'future') return `${lead}, not yet`;
  const withState = state === 'today' ? `${lead}, today` : lead;
  return title ? `${withState}. ${title}` : withState;
}

/** The big text on a door: its number, a star for the last door, the label for the bonus door. */
export function doorNumberText(day, config) {
  if (day === BONUS_DAY) return config.bonus.label;
  return day === config.dayCount ? '\u2605' : String(day);
}

/** The small text under the number: the word Today, or the date. */
export function doorSub({ day, state }, config) {
  return state === 'today' ? 'Today' : shortDateLabel(day, config);
}

/** The line under the heading. `title` is only known once today's day file has been fetched. */
export function statusText({ season, today, title, bonusToday }, config) {
  if (season === 'archive') {
    const bonus = bonusToday && config.bonus ? ` The ${config.bonus.label} door opens today.` : '';
    return `All ${config.dayCount} doors are open.${bonus} Read at your own pace.`;
  }
  return title ? `Today is Day ${today}: ${title}` : `Today is Day ${today}.`;
}

/** The days before and after a day (null at the ends). The bonus door follows the last regular door. */
export function neighbours(day, hasBonus) {
  const last = hasBonus ? BONUS_DAY : DAY_COUNT;
  return { prev: day > 1 ? day - 1 : null, next: day < last ? day + 1 : null };
}

// ---------------------------------------------------------------------------
// Fetched day files

/**
 * Parses and checks the text of a fetched day file for door `day`. Throws on anything wrong: too large,
 * not JSON, the wrong day, or any field the shared day rules refuse. Returns the checked object.
 */
export function readDayFile(text, day) {
  if (typeof text !== 'string') throw new Error('day file: not text');
  if (new TextEncoder().encode(text).length > MAX_DAY_BYTES) throw new Error('day file: too large');
  let file;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error('day file: not valid JSON');
  }
  validateDayPayload(file, checkDayNumber(day));
  return file;
}
