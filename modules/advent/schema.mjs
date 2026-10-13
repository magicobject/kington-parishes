// Validators for the two things a site owns: its content (the 25 days) and its theme.
// Pure functions. Anything wrong throws an Error naming the field (and day) at fault,
// never quoting a long raw value. Unknown keys are errors, so a typo cannot slip by.
//
// CONTENT shape: { days: [ day x 25 ] }, days numbered exactly 1 to 25, no gaps or repeats.
//   day = {
//     day         integer 1-25
//     title       text, up to 120 characters
//     ref         scripture reference, text, up to 120
//     paragraphs  1 to 12 paragraphs of text, each up to 1200
//     wonder      one open question, up to 300
//     activity    something to do, up to 400
//     prayer      a short prayer, up to 500
//     art         file name inside the art folder, like "day-05.svg" (see artPathIsSafe)
//     alt         description of the picture, 1 to 300, never the same as the title
//     credit      who made the picture, up to 200, never empty
//     hidden      OPTIONAL "look for this" detail, up to 300
//     translation OPTIONAL note on which Bible translation is quoted, up to 200
//   }
// Text may not contain: angle brackets, "{{" or "}}", control characters, bidi override
// characters, web addresses, or "@" (so no email addresses).
//
// THEME shape (all keys required):
//   siteName, translationName   text, up to 80
//   timeZone                    a name from Intl.supportedValuesOf('timeZone')
//   season                      { start: {month, day}, end: {month, day}, archiveUntil: {month, day} | null }
//   slug                        page path without folders, like "advent", 1-32 of a-z 0-9 and "-"
//   previewEnabled, adventEnabled, publicListing   true or false
//   colours                     name -> "#rrggbb" (every colour the stylesheet needs, see COLOUR_NAMES)

export const DAY_COUNT = 25;
export const COLOUR_NAMES = [
  'night', 'sky2', 'ridge', 'cream', 'accent', 'accentInk', 'door',
  'doorEdge', 'paper', 'text', 'textSoft', 'link', 'focus',
];

const DAY_KEYS_REQUIRED = ['day', 'title', 'ref', 'paragraphs', 'wonder', 'activity', 'prayer', 'art', 'alt', 'credit'];
const DAY_KEYS_OPTIONAL = ['hidden', 'translation'];
const THEME_KEYS = ['siteName', 'timeZone', 'season', 'slug', 'previewEnabled', 'adventEnabled', 'publicListing', 'translationName', 'colours'];
const RESERVED_SLUGS = ['api', 'js', 'css', 'img', 'assets'];
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const BAD_CHARACTER = /[<>\u0000-\u001F\u007F-\u009F‪-‮⁦-⁩]/;
const BAD_URL = /(?:https?:|data:|javascript:)|(?:^|[\s(])\/\/\S/i;

/** True only for a plain file name like "day-05.svg": no folders, no dots, no odd characters. */
export function artPathIsSafe(path) {
  return typeof path === 'string' && path.length <= 64 && /^[a-z0-9][a-z0-9-]*\.svg$/.test(path);
}

function fail(where, message) {
  throw new Error(`${where}: ${message}`);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function checkKeys(object, required, optional, where) {
  for (const key of Object.keys(object)) {
    if (!required.includes(key) && !optional.includes(key)) fail(where, `unknown key "${key.slice(0, 40)}"`);
  }
  for (const key of required) {
    if (!(key in object)) fail(where, `missing key "${key}"`);
  }
}

function checkText(value, field, where, maxLength, { content = true } = {}) {
  if (typeof value !== 'string') fail(where, `"${field}" must be text`);
  if (value.trim() === '') fail(where, `"${field}" must not be empty`);
  if (value.length > maxLength) fail(where, `"${field}" is longer than ${maxLength} characters`);
  if (BAD_CHARACTER.test(value)) fail(where, `"${field}" contains angle brackets, control or direction-override characters`);
  if (value.includes('{{') || value.includes('}}')) fail(where, `"${field}" contains template braces`);
  if (content) {
    if (BAD_URL.test(value)) fail(where, `"${field}" contains a web address`);
    if (value.includes('@')) fail(where, `"${field}" contains "@"`);
  }
}

function validateDay(entry, index) {
  const label = isPlainObject(entry) && Number.isInteger(entry.day) ? `day ${entry.day}` : `days[${index}]`;
  if (!isPlainObject(entry)) fail(label, 'must be an object');
  checkKeys(entry, DAY_KEYS_REQUIRED, DAY_KEYS_OPTIONAL, label);
  if (!Number.isInteger(entry.day) || entry.day < 1 || entry.day > DAY_COUNT) fail(label, '"day" must be a whole number from 1 to 25');

  checkText(entry.title, 'title', label, 120);
  checkText(entry.ref, 'ref', label, 120);
  if (!Array.isArray(entry.paragraphs) || entry.paragraphs.length < 1 || entry.paragraphs.length > 12) {
    fail(label, '"paragraphs" must be a list of 1 to 12 paragraphs');
  }
  entry.paragraphs.forEach((paragraph, i) => checkText(paragraph, `paragraphs[${i}]`, label, 1200));
  checkText(entry.wonder, 'wonder', label, 300);
  checkText(entry.activity, 'activity', label, 400);
  checkText(entry.prayer, 'prayer', label, 500);
  if (!artPathIsSafe(entry.art)) fail(label, '"art" must look like "day-05.svg" (lower case, no folders)');
  checkText(entry.alt, 'alt', label, 300);
  if (entry.alt.trim().toLowerCase() === entry.title.trim().toLowerCase()) fail(label, '"alt" must describe the picture, not repeat the title');
  checkText(entry.credit, 'credit', label, 200);
  if ('hidden' in entry) checkText(entry.hidden, 'hidden', label, 300);
  if ('translation' in entry) checkText(entry.translation, 'translation', label, 200);
}

/** Throws unless the content is exactly 25 well-formed days. Returns the content when valid. */
export function validateContent(content) {
  if (!isPlainObject(content)) fail('content', 'must be an object');
  checkKeys(content, ['days'], [], 'content');
  if (!Array.isArray(content.days)) fail('content', '"days" must be a list');

  content.days.forEach(validateDay);
  const seen = new Set();
  for (const entry of content.days) {
    if (seen.has(entry.day)) fail(`day ${entry.day}`, 'appears more than once');
    seen.add(entry.day);
  }
  for (let day = 1; day <= DAY_COUNT; day += 1) {
    if (!seen.has(day)) fail(`day ${day}`, 'is missing');
  }
  return content;
}

function validateMonthDay(value, where) {
  if (!isPlainObject(value)) fail(where, 'must be {month, day}');
  checkKeys(value, ['month', 'day'], [], where);
  if (!Number.isInteger(value.month) || value.month < 1 || value.month > 12) fail(where, '"month" must be a whole number from 1 to 12');
  if (!Number.isInteger(value.day) || value.day < 1 || value.day > DAYS_IN_MONTH[value.month - 1]) fail(where, '"day" is not a day of that month');
}

const monthDay = (value) => value.month * 100 + value.day;

/** Throws unless the theme is complete and safe. Returns the theme when valid. */
export function validateTheme(theme) {
  if (!isPlainObject(theme)) fail('theme', 'must be an object');
  checkKeys(theme, THEME_KEYS, [], 'theme');

  checkText(theme.siteName, 'siteName', 'theme', 80, { content: false });
  checkText(theme.translationName, 'translationName', 'theme', 80, { content: false });

  if (typeof theme.timeZone !== 'string' || !(theme.timeZone === 'UTC' || Intl.supportedValuesOf('timeZone').includes(theme.timeZone))) {
    fail('theme', '"timeZone" is not a known time zone name');
  }

  const season = theme.season;
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

  if (typeof theme.slug !== 'string' || !/^\/?[a-z0-9-]{1,32}$/.test(theme.slug)) fail('theme', '"slug" must be 1 to 32 of a-z, 0-9 and "-"');
  if (RESERVED_SLUGS.includes(theme.slug.replace(/^\//, ''))) fail('theme', '"slug" clashes with a reserved path');
  for (const flag of ['previewEnabled', 'adventEnabled', 'publicListing']) {
    if (typeof theme[flag] !== 'boolean') fail('theme', `"${flag}" must be true or false`);
  }

  if (!isPlainObject(theme.colours)) fail('theme.colours', 'must be an object');
  checkKeys(theme.colours, COLOUR_NAMES, [], 'theme.colours');
  for (const name of COLOUR_NAMES) {
    if (typeof theme.colours[name] !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(theme.colours[name])) {
      fail('theme.colours', `"${name}" must be a colour like #1a2b3c`);
    }
  }
  return theme;
}
