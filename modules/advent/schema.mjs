// Validators for the two things a site owns: its content (the 25 days, and an optional bonus day) and its theme.
// Pure functions. Anything wrong throws an Error naming the field (and day) at fault,
// never quoting a long raw value. Unknown keys are errors, so a typo cannot slip by.
// Each validator checks a private COPY of what it is given and returns that copy, so
// the caller cannot change the data after it has been checked.
//
// The rules for ONE day (and all the text rules) live in day.mjs, which has no imports so the browser can
// run the same checks on every day file it fetches. This file re-exports the parts other code uses.
//
// CONTENT shape: { days: [ day x 25 ], bonus?: day }, days numbered exactly 1 to 25, no gaps or repeats.
//   bonus is OPTIONAL: one more day, numbered exactly 26, checked by the same rules. It needs a bonus
//   entry in the theme; a theme with a bonus but content without one simply shows 25 doors.
//
// THEME shape (all keys required):
//   siteName, translationName   text, up to 80
//   timeZone                    a name from Intl.supportedValuesOf('timeZone')
//   season                      { start: {month, day}, end: {month, day}, archiveUntil: {month, day} | null }
//   reservedSlugs               the site's own page names (a list of slugs, up to 200); the slug may not be one
//   slug                        page name without slashes, like "advent" or "christmas-calendar";
//                               lower case words joined by single hyphens, up to 32, not a reserved name
//   previewEnabled, adventEnabled, publicListing, artRequired, goLive   true or false
//                               (artRequired: the build refuses to continue while any picture is missing;
//                               goLive: false = the real date always shows the calm message, only ?advent-preview
//                               shows the calendar; true = the real date drives the season. goLive true needs
//                               artRequired and publicListing true: the three launch flags flip together)
//   colours                     name -> "#rrggbb" (every colour the stylesheet needs, see COLOUR_NAMES)
// plus OPTIONAL keys:
//   bonus                       null, or { on: {month, day}, label } for the 26th door. "on" is the date it opens and
//                               must fall in the archive period (after season.end, up to season.archiveUntil), so the
//                               season needs an archiveUntil. label is the door's short name, up to 30 characters.
//   scene                       null, or the file name (like "scene.svg") of the site's own scene picture in
//                               public/advent/; without it the module's plain hills scene is used.

import {
  DAY_COUNT, BONUS_DAY, artPathIsSafe, checkKeys, checkText, fail, isPlainObject, validateDay,
} from './day.mjs';

export { DAY_COUNT, BONUS_DAY, artPathIsSafe, validateDay };
export const COLOUR_NAMES = [
  'night', 'sky2', 'ridge', 'cream', 'accent', 'accentInk', 'door',
  'doorLocked', 'doorEdge', 'paper', 'text', 'textSoft', 'link', 'focus',
];

// Names a calendar page must never take, on any site: files and routes that always exist.
// Each site also lists its own page names in the theme's reservedSlugs; a test checks that
// the two lists together cover every page in the site's page list.
export const RESERVED_SLUGS = Object.freeze([
  'api', 'js', 'css', 'img', 'assets', 'index', '404', 'sitemap', 'robots', 'search-index',
  'updates', 'cdn-cgi', 'functions', 'help', '_headers', '_redirects',
]);

const THEME_OPTIONAL_KEYS = ['bonus', 'scene'];
const THEME_KEYS = ['siteName', 'timeZone', 'season', 'slug', 'previewEnabled', 'adventEnabled', 'publicListing', 'artRequired', 'goLive', 'translationName', 'colours', 'reservedSlugs'];
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function copyOf(value, where) {
  try {
    return structuredClone(value);
  } catch {
    return fail(where, 'must be plain data (text, numbers, true/false, lists and objects)');
  }
}

/** Throws unless the content is exactly 25 well-formed days (and a well-formed bonus day, if any). Returns a checked copy. */
export function validateContent(content) {
  const copy = copyOf(content, 'content');
  if (!isPlainObject(copy)) fail('content', 'must be an object');
  checkKeys(copy, ['days'], ['bonus'], 'content');
  if (!Array.isArray(copy.days)) fail('content', '"days" must be a list');
  if (copy.days.length !== DAY_COUNT) fail('content', `"days" must list exactly ${DAY_COUNT} days`);

  const seen = new Set();
  for (let index = 0; index < DAY_COUNT; index += 1) {
    const entry = copy.days[index];
    validateDay(entry, index);
    if (seen.has(entry.day)) fail(`day ${entry.day}`, 'appears more than once');
    seen.add(entry.day);
  }
  if ('bonus' in copy) validateDay(copy.bonus, 'bonus', { min: BONUS_DAY, max: BONUS_DAY });
  return copy;
}

function validateMonthDay(value, where) {
  if (!isPlainObject(value)) fail(where, 'must be {month, day}');
  checkKeys(value, ['month', 'day'], [], where);
  if (!Number.isInteger(value.month) || value.month < 1 || value.month > 12) fail(where, '"month" must be a whole number from 1 to 12');
  if (!Number.isInteger(value.day) || value.day < 1 || value.day > DAYS_IN_MONTH[value.month - 1]) fail(where, '"day" is not a day of that month');
}

const monthDay = (value) => value.month * 100 + value.day;

// The month and day are in the archive period when they come after the season's end and on or before archiveUntil
// (which may run over New Year into January).
function inArchive(date, season) {
  if (!season.archiveUntil) return false;
  const today = monthDay(date);
  const [start, end, until] = [monthDay(season.start), monthDay(season.end), monthDay(season.archiveUntil)];
  return until < start ? today > end || today <= until : today > end && today <= until;
}

function validateBonus(bonus, season) {
  if (!isPlainObject(bonus)) fail('theme.bonus', 'must be null or {on: {month, day}, label}');
  checkKeys(bonus, ['on', 'label'], [], 'theme.bonus');
  validateMonthDay(bonus.on, 'theme.bonus.on');
  checkText(bonus.label, 'label', 'theme.bonus', 30, { content: false });
  if (!inArchive(bonus.on, season)) {
    fail('theme.bonus', 'the bonus date must fall in the archive period (after season.end, up to season.archiveUntil), so the season needs an archiveUntil');
  }
}

/**
 * True only for a plain file name "scene.svg" or "scene-<words>.svg". The prefix matters: the host's headers give
 * every /advent/scene*.svg the same locked-down Content-Security-Policy as the day pictures.
 */
export function sceneNameIsSafe(name) {
  return artPathIsSafe(name) && /^scene(?:-[a-z0-9-]*[a-z0-9])?\.svg$/.test(name);
}

/** Throws unless the theme is complete and safe. Returns a checked copy. */
export function validateTheme(theme) {
  const copy = copyOf(theme, 'theme');
  if (!isPlainObject(copy)) fail('theme', 'must be an object');
  checkKeys(copy, THEME_KEYS, THEME_OPTIONAL_KEYS, 'theme');

  checkText(copy.siteName, 'siteName', 'theme', 80, { content: false });
  checkText(copy.translationName, 'translationName', 'theme', 80, { content: false });

  if (typeof copy.timeZone !== 'string' || !(copy.timeZone === 'UTC' || Intl.supportedValuesOf('timeZone').includes(copy.timeZone))) {
    fail('theme', '"timeZone" is not a known time zone name');
  }

  const season = copy.season;
  if (!isPlainObject(season)) fail('theme.season', 'must be an object');
  checkKeys(season, ['start', 'end', 'archiveUntil'], [], 'theme.season');
  validateMonthDay(season.start, 'theme.season.start');
  validateMonthDay(season.end, 'theme.season.end');
  if (monthDay(season.end) < monthDay(season.start)) fail('theme.season', 'the end must not be before the start');
  if (season.archiveUntil !== null) {
    validateMonthDay(season.archiveUntil, 'theme.season.archiveUntil');
    if (monthDay(season.archiveUntil) >= monthDay(season.start) && monthDay(season.archiveUntil) <= monthDay(season.end)) {
      fail('theme.season', '"archiveUntil" must be after the end');
    }
  }

  if (copy.bonus !== undefined && copy.bonus !== null) validateBonus(copy.bonus, season);
  if (copy.scene !== undefined && copy.scene !== null && !sceneNameIsSafe(copy.scene)) {
    fail('theme', '"scene" must be null or a plain file name like "scene.svg" or "scene-night.svg" (lower case, no folders)');
  }

  if (typeof copy.slug !== 'string' || copy.slug.length > 32 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(copy.slug)) {
    fail('theme', '"slug" must be lower-case words and numbers joined by single hyphens, up to 32 characters');
  }
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(copy.slug)) fail('theme', '"slug" is a device name that Windows will not allow as a file name');
  if (!Array.isArray(copy.reservedSlugs) || copy.reservedSlugs.length > 200 ||
      !copy.reservedSlugs.every((name) => typeof name === 'string' && /^[a-z0-9_-]{1,64}$/.test(name))) {
    fail('theme', '"reservedSlugs" must be a list of up to 200 page names');
  }
  if (RESERVED_SLUGS.includes(copy.slug) || copy.reservedSlugs.includes(copy.slug)) fail('theme', '"slug" clashes with a reserved page name');
  for (const flag of ['previewEnabled', 'adventEnabled', 'publicListing', 'artRequired', 'goLive']) {
    if (typeof copy[flag] !== 'boolean') fail('theme', `"${flag}" must be true or false`);
  }
  // The three launch flags flip together: the real date may only drive the calendar once every picture is required and the page is listed.
  if (copy.goLive && !(copy.artRequired && copy.publicListing)) fail('theme', '"goLive" needs "artRequired" and "publicListing" to be true as well (the launch flags flip together)');

  if (!isPlainObject(copy.colours)) fail('theme.colours', 'must be an object');
  checkKeys(copy.colours, COLOUR_NAMES, [], 'theme.colours');
  for (const name of COLOUR_NAMES) {
    if (typeof copy.colours[name] !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(copy.colours[name])) {
      fail('theme.colours', `"${name}" must be a colour like #1a2b3c`);
    }
  }
  return copy;
}
