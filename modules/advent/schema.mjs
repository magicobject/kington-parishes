// Validators for the two things a site owns: its content (the 25 days) and its theme.
// Pure functions. Anything wrong throws an Error naming the field (and day) at fault,
// never quoting a long raw value. Unknown keys are errors, so a typo cannot slip by.
// Each validator checks a private COPY of what it is given and returns that copy, so
// the caller cannot change the data after it has been checked.
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
//     translation which Bible translation is quoted (or that it is retold), up to 200, REQUIRED
//     hidden      OPTIONAL "look for this" detail, up to 300
//   }
//
// TEXT RULES (every content string, and the theme names): not empty, within its cap, and
// containing none of: angle brackets, "@", control characters, invisible or direction
// characters (zero-width, joiners, variation selectors, bidi marks and overrides, line and
// paragraph separators, byte order mark, soft hyphen, tag characters), lone surrogates,
// "{{" or "}}". Content text (not the theme names) also may not look like a web address:
// checked on a compatibility-normalised (NFKC) copy, so full-width and look-alike letters
// do not slip past. Rejected: a scheme glued to what follows ("data:x", "mailto:a",
// "ftp://x"; but "Note: this" is fine because a space follows the colon), "//", "www.",
// word.word/ paths, common domain endings (com org net uk co io info app dev), HTML
// entities, backslashes and %XX escapes.
//
// THEME shape (all keys required):
//   siteName, translationName   text, up to 80
//   timeZone                    a name from Intl.supportedValuesOf('timeZone')
//   season                      { start: {month, day}, end: {month, day}, archiveUntil: {month, day} | null }
//   reservedSlugs               the site's own page names (a list of slugs, up to 200); the slug may not be one
//   slug                        page name without slashes, like "advent" or "christmas-calendar";
//                               lower case words joined by single hyphens, up to 32, not a reserved name
//   previewEnabled, adventEnabled, publicListing   true or false
//   colours                     name -> "#rrggbb" (every colour the stylesheet needs, see COLOUR_NAMES)

export const DAY_COUNT = 25;
export const COLOUR_NAMES = [
  'night', 'sky2', 'ridge', 'cream', 'accent', 'accentInk', 'door',
  'doorEdge', 'paper', 'text', 'textSoft', 'link', 'focus',
];

// Names a calendar page must never take, on any site: files and routes that always exist.
// Each site also lists its own page names in the theme's reservedSlugs; a test checks that
// the two lists together cover every page in the site's page list.
export const RESERVED_SLUGS = Object.freeze([
  'api', 'js', 'css', 'img', 'assets', 'index', '404', 'sitemap', 'robots', 'search-index',
  'updates', 'cdn-cgi', 'functions', 'help', '_headers', '_redirects',
]);

const DAY_KEYS_REQUIRED = ['day', 'title', 'ref', 'paragraphs', 'wonder', 'activity', 'prayer', 'art', 'alt', 'credit', 'translation'];
const DAY_KEYS_OPTIONAL = ['hidden'];
const THEME_KEYS = ['siteName', 'timeZone', 'season', 'slug', 'previewEnabled', 'adventEnabled', 'publicListing', 'translationName', 'colours', 'reservedSlugs'];
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Angle brackets, "@", control, format (invisible, joiners, bidi, soft hyphen, BOM),
// line and paragraph separators, tag characters, annotation marks, and lone surrogates.
// Also the blank-looking letters and marks: combining grapheme joiner, Hangul fillers,
// Khmer inherent vowels, Mongolian selectors, Braille blank.
const BAD_CHARACTER = /[<>@\p{Cc}\p{Cf}\p{Zl}\p{Zp}\u{E0000}-\u{E007F}\uFFF9-\uFFFB\uFE00-\uFE0F\u{E0100}-\u{E01EF}\u034F\u115F\u1160\u3164\uFFA0\u17B4\u17B5\u180B-\u180F\u2800]|\p{Cs}/u;
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\u{E0000}-\u{E007F}\uFFF9-\uFFFB\uFE00-\uFE0F\u{E0100}-\u{E01EF}\u034F\u115F\u1160\u3164\uFFA0\u17B4\u17B5\u180B-\u180F\u2800]|\p{Cs}/gu;

// POSITIVE ALLOW-LISTS (checked on the text exactly as written, after the deny rules above).
// Content: letters, accent marks, ASCII digits, a plain space, and . , ; : ' " ( ) ? ! - plus
// the en dash, em dash and typographic quotes. No ampersand, slash, bracket, hash or symbol.
const CONTENT_ALLOWED = /^[\p{L}\p{M}0-9 .,;:'"()?!\-\u2013\u2014\u2018\u2019\u201C\u201D]*$/u;
// Names (siteName, translationName): letters, accent marks, digits, space, . , ' - and the
// typographic apostrophe. No ampersand or double quote: the build HTML-escapes names anyway.
const NAME_ALLOWED = /^[\p{L}\p{M}0-9 .,'\-\u2019]*$/u;
// A spreadsheet treats a cell starting with one of these as a formula.
const FORMULA_START = /^\s*[=+@-]/;
// A scripture reference needs a space: "John 3:16", not "John3:16".
const GLUED_REFERENCE = /[a-z]\d+:\d/i;
const SPACED_SCHEME = /\b(?:tel|sms|data|javascript|vbscript|mailto|file|ftp|https?|wss?|blob|about)\s*:/i;
const DOT_BETWEEN_WORDS = /[\p{L}\p{N}]\.[\p{L}\p{N}]/u; // bit.ly, 192.168.0.1, example.org
const DOMAIN_ENDING = /[a-z0-9-]+\.(?:com|org|net|uk|co|io|info|app|dev)\b/i;
const BAD_ADDRESS = [
  /[a-z][a-z0-9+.-]*:\S/i, // a scheme glued to what follows: data:x, mailto:a, ftp://x
  /\/\//, // protocol-relative or any double slash
  /www\./i,
  /[a-z0-9-]+\.[a-z]{2,}\//i, // evil.example/path
  /\b[a-z0-9-]+\.(?:com|org|net|uk|co|io|info|app|dev)\b/i,
  /&[a-z#][a-z0-9]*;/i, // HTML entities
  /\\/,
  /%[0-9a-f]{2}/i,
];

/** True only for a plain file name like "day-05.svg": no folders, no dots, no odd characters. */
export function artPathIsSafe(path) {
  return typeof path === 'string' && path.length <= 64 &&
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.svg$/.test(path) &&
    !/^(?:con|nul|aux|prn|com[1-9]|lpt[1-9])\.svg$/.test(path);
}

function fail(where, message) {
  throw new Error(`${where}: ${message}`);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function copyOf(value, where) {
  try {
    return structuredClone(value);
  } catch {
    return fail(where, 'must be plain data (text, numbers, true/false, lists and objects)');
  }
}

// A short, fully escaped copy of a hostile name, safe to put in a message.
function quoted(text) {
  return JSON.stringify(String(text).slice(0, 40)).replace(/[^\x20-\x7E]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

function checkKeys(object, required, optional, where) {
  for (const key of Object.keys(object)) {
    if (!required.includes(key) && !optional.includes(key)) fail(where, `unknown key ${quoted(key)}`);
  }
  for (const key of required) {
    if (!(key in object)) fail(where, `missing key "${key}"`);
  }
}

function checkText(value, field, where, maxLength, { content = true } = {}) {
  if (typeof value !== 'string') fail(where, `"${field}" must be text`);
  if (value.replace(INVISIBLE, '').trim() === '') fail(where, `"${field}" must not be empty`);
  if (value.length > maxLength) fail(where, `"${field}" is longer than ${maxLength} characters`);
  const normalised = value.normalize('NFKC');
  if (BAD_CHARACTER.test(value) || BAD_CHARACTER.test(normalised)) {
    fail(where, `"${field}" contains angle brackets, "@", or an invisible, control or direction character`);
  }
  if (normalised.includes('{{') || normalised.includes('}}')) fail(where, `"${field}" contains template braces`);
  if (content) {
    if (GLUED_REFERENCE.test(normalised)) {
      fail(where, `"${field}" needs a space between a book name and its chapter number, like "John 3:16"`);
    }
    const unspaced = normalised.replace(/ /g, '');
    if (BAD_ADDRESS.some((pattern) => pattern.test(normalised)) || SPACED_SCHEME.test(normalised) ||
        DOT_BETWEEN_WORDS.test(normalised) || DOMAIN_ENDING.test(unspaced)) {
      fail(where, `"${field}" contains something that looks like a web address or link`);
    }
  }
  if (FORMULA_START.test(value)) fail(where, `"${field}" must not start with = + @ or -`);
  if (!(content ? CONTENT_ALLOWED : NAME_ALLOWED).test(value)) {
    fail(where, `"${field}" contains a character that is not allowed (plain letters, digits, spaces and simple punctuation only)`);
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
  for (let i = 0; i < entry.paragraphs.length; i += 1) checkText(entry.paragraphs[i], `paragraphs[${i}]`, label, 1200);
  checkText(entry.wonder, 'wonder', label, 300);
  checkText(entry.activity, 'activity', label, 400);
  checkText(entry.prayer, 'prayer', label, 500);
  if (!artPathIsSafe(entry.art)) fail(label, '"art" must look like "day-05.svg" (lower case, no folders)');
  checkText(entry.alt, 'alt', label, 300);
  if (entry.alt.trim().toLowerCase() === entry.title.trim().toLowerCase()) fail(label, '"alt" must describe the picture, not repeat the title');
  checkText(entry.credit, 'credit', label, 200);
  checkText(entry.translation, 'translation', label, 200);
  if ('hidden' in entry) checkText(entry.hidden, 'hidden', label, 300);
}

/** Throws unless the content is exactly 25 well-formed days. Returns a checked copy. */
export function validateContent(content) {
  const copy = copyOf(content, 'content');
  if (!isPlainObject(copy)) fail('content', 'must be an object');
  checkKeys(copy, ['days'], [], 'content');
  if (!Array.isArray(copy.days)) fail('content', '"days" must be a list');
  if (copy.days.length !== DAY_COUNT) fail('content', `"days" must list exactly ${DAY_COUNT} days`);

  const seen = new Set();
  for (let index = 0; index < DAY_COUNT; index += 1) {
    const entry = copy.days[index];
    validateDay(entry, index);
    if (seen.has(entry.day)) fail(`day ${entry.day}`, 'appears more than once');
    seen.add(entry.day);
  }
  return copy;
}

function validateMonthDay(value, where) {
  if (!isPlainObject(value)) fail(where, 'must be {month, day}');
  checkKeys(value, ['month', 'day'], [], where);
  if (!Number.isInteger(value.month) || value.month < 1 || value.month > 12) fail(where, '"month" must be a whole number from 1 to 12');
  if (!Number.isInteger(value.day) || value.day < 1 || value.day > DAYS_IN_MONTH[value.month - 1]) fail(where, '"day" is not a day of that month');
}

const monthDay = (value) => value.month * 100 + value.day;

/** Throws unless the theme is complete and safe. Returns a checked copy. */
export function validateTheme(theme) {
  const copy = copyOf(theme, 'theme');
  if (!isPlainObject(copy)) fail('theme', 'must be an object');
  checkKeys(copy, THEME_KEYS, [], 'theme');

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

  if (typeof copy.slug !== 'string' || copy.slug.length > 32 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(copy.slug)) {
    fail('theme', '"slug" must be lower-case words and numbers joined by single hyphens, up to 32 characters');
  }
  if (!Array.isArray(copy.reservedSlugs) || copy.reservedSlugs.length > 200 ||
      !copy.reservedSlugs.every((name) => typeof name === 'string' && /^[a-z0-9_-]{1,64}$/.test(name))) {
    fail('theme', '"reservedSlugs" must be a list of up to 200 page names');
  }
  if (RESERVED_SLUGS.includes(copy.slug) || copy.reservedSlugs.includes(copy.slug)) fail('theme', '"slug" clashes with a reserved page name');
  for (const flag of ['previewEnabled', 'adventEnabled', 'publicListing']) {
    if (typeof copy[flag] !== 'boolean') fail('theme', `"${flag}" must be true or false`);
  }

  if (!isPlainObject(copy.colours)) fail('theme.colours', 'must be an object');
  checkKeys(copy.colours, COLOUR_NAMES, [], 'theme.colours');
  for (const name of COLOUR_NAMES) {
    if (typeof copy.colours[name] !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(copy.colours[name])) {
      fail('theme.colours', `"${name}" must be a colour like #1a2b3c`);
    }
  }
  return copy;
}
