// Unit tests for modules/advent/schema.mjs and the real content and theme files.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateContent, validateTheme, artPathIsSafe, DAY_COUNT } from '../modules/advent/schema.mjs';
import { content } from '../modules/advent/content.mjs';
import { theme } from '../modules/advent/theme.mjs';

const clone = (value) => structuredClone(value);
const rejects = (mutate, pattern, base = content, validate = validateContent) => {
  const copy = clone(base);
  mutate(copy);
  assert.throws(() => validate(copy), pattern);
};
const dayOf = (c, n) => c.days.find((d) => d.day === n);

describe('the real files', () => {
  test('content.mjs is valid and has 25 days', () => {
    assert.deepEqual(validateContent(content), content);
    assert.equal(content.days.length, DAY_COUNT);
  });

  test('theme.mjs is valid (the launch switches are checked by advent-prelaunch.test.mjs until launch)', () => {
    assert.deepEqual(validateTheme(theme), theme);
    assert.equal(typeof theme.publicListing, 'boolean');
    assert.equal(typeof theme.artRequired, 'boolean');
    assert.equal(theme.timeZone, 'Europe/London');
    assert.equal(theme.slug, 'advent');
  });

  test('every day has its own picture file named by its number', () => {
    for (const d of content.days) assert.equal(d.art, `day-${String(d.day).padStart(2, '0')}.svg`);
  });

  test('Day 25 is the Nativity and Day 1 is the first light', () => {
    assert.match(dayOf(content, 25).title, /Christmas Day/);
    assert.match(dayOf(content, 1).ref, /Genesis 1/);
  });
});

describe('validateContent: structure', () => {
  test('rejects a non-object, a missing days list and unknown top-level keys', () => {
    assert.throws(() => validateContent(null), /content: must be an object/);
    assert.throws(() => validateContent([]), /must be an object/);
    assert.throws(() => validateContent({}), /missing key "days"/);
    assert.throws(() => validateContent({ days: 'x' }), /"days" must be a list/);
    rejects((c) => { c.extra = 1; }, /unknown key "extra"/);
  });

  test('rejects a missing day, naming it', () => {
    rejects((c) => { c.days = c.days.filter((d) => d.day !== 13); }, /exactly 25 days/);
  });

  test('rejects a duplicate day', () => {
    rejects((c) => { dayOf(c, 14).day = 13; }, /day 13: appears more than once/);
  });

  test('rejects a 26th day and day numbers outside 1 to 25', () => {
    rejects((c) => { c.days.push({ ...clone(dayOf(c, 1)), day: 26 }); }, /exactly 25 days/);
    rejects((c) => { dayOf(c, 25).day = 26; }, /day 26: "day" must be a whole number from 1 to 25/);
    rejects((c) => { dayOf(c, 2).day = 0; }, /"day" must be a whole number/);
    rejects((c) => { dayOf(c, 2).day = 2.5; }, /"day" must be a whole number/);
    rejects((c) => { dayOf(c, 2).day = '2'; }, /"day" must be a whole number/);
  });

  test('rejects an unknown key inside a day, naming day and key', () => {
    rejects((c) => { dayOf(c, 7).html = 'x'; }, /day 7: unknown key "html"/);
  });

  test('rejects a missing required key', () => {
    rejects((c) => { delete dayOf(c, 9).prayer; }, /day 9: missing key "prayer"/);
  });

  test('the hidden detail is optional', () => {
    const copy = clone(content);
    delete dayOf(copy, 3).hidden;
    validateContent(copy);
  });

  test('a day that is not an object is rejected', () => {
    rejects((c) => { c.days[4] = 'nope'; }, /days\[4\]: must be an object/);
  });
});

describe('validateContent: length caps', () => {
  test('title up to 120', () => {
    rejects((c) => { dayOf(c, 1).title = 'a'.repeat(121); }, /day 1: "title" is longer than 120/);
    const ok = clone(content);
    dayOf(ok, 1).title = 'a'.repeat(120);
    validateContent(ok);
  });

  test('paragraph up to 1200 and at most 12 paragraphs, at least 1', () => {
    rejects((c) => { dayOf(c, 4).paragraphs = ['a'.repeat(1201)]; }, /paragraphs\[0\]" is longer than 1200/);
    rejects((c) => { dayOf(c, 4).paragraphs = Array(13).fill('Fine.'); }, /1 to 12 paragraphs/);
    rejects((c) => { dayOf(c, 4).paragraphs = []; }, /1 to 12 paragraphs/);
    rejects((c) => { dayOf(c, 4).paragraphs = 'one string'; }, /1 to 12 paragraphs/);
    const ok = clone(content);
    dayOf(ok, 4).paragraphs = Array(12).fill('a'.repeat(1200));
    validateContent(ok);
  });

  test('alt up to 300 and not empty', () => {
    rejects((c) => { dayOf(c, 5).alt = 'a'.repeat(301); }, /"alt" is longer than 300/);
    rejects((c) => { dayOf(c, 5).alt = ''; }, /"alt" must not be empty/);
    rejects((c) => { dayOf(c, 5).alt = '   '; }, /"alt" must not be empty/);
  });

  test('alt must not equal the title (ignoring case and spaces at the ends)', () => {
    rejects((c) => { dayOf(c, 5).alt = dayOf(c, 5).title; }, /day 5: "alt" must describe the picture/);
    rejects((c) => { dayOf(c, 5).alt = `  ${dayOf(c, 5).title.toUpperCase()} `; }, /must describe the picture/);
  });

  test('credit must not be empty', () => {
    rejects((c) => { dayOf(c, 6).credit = ''; }, /day 6: "credit" must not be empty/);
    rejects((c) => { delete dayOf(c, 6).credit; }, /missing key "credit"/);
  });

  test('errors never quote the long raw value', () => {
    const copy = clone(content);
    dayOf(copy, 8).title = 'SECRETLONGVALUE'.repeat(50);
    assert.throws(() => validateContent(copy), (error) => !error.message.includes('SECRETLONGVALUE') && error.message.length < 200);
  });

  test('non-text values are rejected', () => {
    rejects((c) => { dayOf(c, 2).wonder = 42; }, /"wonder" must be text/);
    rejects((c) => { dayOf(c, 2).paragraphs = [{}]; }, /must be text/);
  });
});

describe('validateContent: forbidden characters and patterns', () => {
  const badValues = {
    'a less-than sign': 'x < y',
    'a greater-than sign': 'x > y',
    'a script tag': '<script>alert(1)</script>',
    'opening template braces': 'Hello {{name}}',
    'closing template braces': 'oops }}',
    'an at sign': 'write to someone@example.org',
    'a bare at sign': 'at @home',
    'http address': 'see http://example.org',
    'https address': 'see HTTPS://example.org',
    'protocol-relative address': 'see //example.org/x',
    'data address': 'data:text/html,hi',
    'javascript address': 'javascript:alert(1)',
    'a control character': 'tab\there',
    'a newline': 'line\nbreak',
    'a NUL': 'nul\u0000here',
    'a delete character': 'del\u007Fhere',
    'a bidi override (U+202E)': 'abc\u202Edef',
    'a bidi embedding (U+202A)': 'abc\u202Adef',
    'a bidi isolate (U+2066)': 'abc\u2066def',
    'a bidi isolate end (U+2069)': 'abc\u2069def',
  };

  for (const [name, value] of Object.entries(badValues)) {
    test(`rejects ${name} in a title, a paragraph and a prayer`, () => {
      rejects((c) => { dayOf(c, 10).title = value; }, /day 10: "title"/);
      rejects((c) => { dayOf(c, 10).paragraphs = ['Fine.', value]; }, /day 10: "paragraphs\[1\]"/);
      rejects((c) => { dayOf(c, 10).prayer = value; }, /day 10: "prayer"/);
    });
  }

  test('also checks the optional fields', () => {
    rejects((c) => { dayOf(c, 10).hidden = '<b>'; }, /day 10: "hidden"/);
    rejects((c) => { dayOf(c, 10).translation = 'see http://x.org'; }, /day 10: "translation"/);
  });

  test('plain punctuation, quotes and apostrophes are fine', () => {
    const ok = clone(content);
    dayOf(ok, 10).paragraphs = ['"Don\'t be afraid," she said; it\'s half done: really (yes) - 1 Samuel 16:1-13!'];
    validateContent(ok);
  });
});

describe('art paths', () => {
  test('artPathIsSafe accepts simple lower-case svg file names', () => {
    for (const ok of ['day-05.svg', 'a.svg', '0.svg', 'christmas-star-2.svg']) assert.equal(artPathIsSafe(ok), true, ok);
  });

  test('artPathIsSafe rejects traversal, folders, other types and odd characters', () => {
    for (const bad of ['../x.svg', 'a/b.svg', '/x.svg', 'x.png', 'x.svg.png', 'x.SVG', 'X.svg', '-x.svg', '.svg', 'x..svg', 'x.svg ', 'x\\y.svg', 'a b.svg', '', 'x.svg\n', null, undefined, 5, ['x.svg']]) {
      assert.equal(artPathIsSafe(bad), false, String(bad));
    }
    assert.equal(artPathIsSafe('a'.repeat(70) + '.svg'), false);
  });

  test('validateContent rejects a bad art path', () => {
    for (const bad of ['../x.svg', 'a/b.svg', 'x.png']) {
      rejects((c) => { dayOf(c, 11).art = bad; }, /day 11: "art" must look like/);
    }
  });
});

describe('validateTheme', () => {
  const bad = (mutate, pattern) => rejects(mutate, pattern, theme, validateTheme);

  test('accepts another church setup with different dates, colours and a different zone', () => {
    const other = clone(theme);
    other.siteName = 'Another Church';
    other.timeZone = 'Pacific/Auckland';
    other.season = { start: { month: 12, day: 1 }, end: { month: 12, day: 25 }, archiveUntil: null };
    other.slug = 'advent-2';
    other.colours.night = '#000000';
    validateTheme(other);
  });

  test('rejects unknown and missing keys', () => {
    bad((t) => { t.previewKey = 'abc'; }, /unknown key "previewKey"/);
    bad((t) => { delete t.slug; }, /missing key "slug"/);
  });

  test('rejects bad colours', () => {
    for (const colour of ['red', '#fff', '#12345g', '#1234567', 'rgb(0,0,0)', '123456', '#12345', 5, null, 'url(x)']) {
      bad((t) => { t.colours.night = colour; }, /"night" must be a colour/);
    }
    bad((t) => { delete t.colours.link; }, /missing key "link"/);
    bad((t) => { t.colours.sparkle = '#ffffff'; }, /unknown key "sparkle"/);
  });

  test('rejects a bad time zone, accepts Europe/London', () => {
    for (const zone of ['Mars/Olympus', 'europe/london', '', 5, null, 'Europe/London; DROP']) {
      bad((t) => { t.timeZone = zone; }, /"timeZone"/);
    }
    validateTheme(theme);
  });

  test('rejects bad slugs', () => {
    for (const slug of ['', 'Advent', 'a/b', '../x', 'api', '/api', '/advent', 'a b', 'x'.repeat(33), '//advent', 'advent.html', 5]) {
      bad((t) => { t.slug = slug; }, /"slug"/);
    }
  });

  test('rejects flags that are not true or false', () => {
    for (const flag of ['previewEnabled', 'adventEnabled', 'publicListing']) {
      bad((t) => { t[flag] = 'yes'; }, new RegExp(`"${flag}" must be true or false`));
      bad((t) => { t[flag] = 1; }, new RegExp(`"${flag}"`));
    }
  });

  test('rejects bad season dates', () => {
    bad((t) => { t.season.start.month = 13; }, /theme.season.start: "month"/);
    bad((t) => { t.season.start.day = 0; }, /theme.season.start: "day"/);
    bad((t) => { t.season.end = { month: 2, day: 30 }; }, /theme.season.end: "day"/);
    bad((t) => { t.season.start.day = 1.5; }, /"day"/);
    bad((t) => { t.season.start.day = '1'; }, /"day"/);
    bad((t) => { t.season.end = { month: 11, day: 25 }; }, /end must not be before the start/);
    bad((t) => { t.season.archiveUntil = { month: 12, day: 10 }; }, /"archiveUntil" must be after the end/);
    bad((t) => { t.season.archiveUntil = undefined; }, /missing key|must be \{month, day\}|archiveUntil/);
    bad((t) => { t.season.extra = 1; }, /unknown key "extra"/);
  });

  test('allows leap day only as 29 Feb and null for no archive', () => {
    const ok = clone(theme);
    ok.season = { start: { month: 2, day: 28 }, end: { month: 2, day: 29 }, archiveUntil: null };
    validateTheme(ok);
  });

  test('rejects hostile text in names', () => {
    bad((t) => { t.siteName = '<b>Church</b>'; }, /"siteName"/);
    bad((t) => { t.siteName = ''; }, /"siteName"/);
    bad((t) => { t.translationName = 'x{{y}}'; }, /"translationName"/);
    bad((t) => { t.translationName = 'a'.repeat(81); }, /"translationName"/);
  });

  test('rejects a theme that is not an object', () => {
    assert.throws(() => validateTheme(null), /theme: must be an object/);
  });
});
