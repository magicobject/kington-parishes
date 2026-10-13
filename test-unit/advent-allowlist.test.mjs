// Allow-list tests for modules/advent/schema.mjs: content text may only use letters,
// accents, ASCII digits, a plain space and a short list of punctuation. Anything else
// (look-alike blanks, odd spaces, confusable colons and slashes, spaced-out addresses,
// ampersands, spreadsheet formulas) must be rejected, with the old deny rules kept too.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateContent, validateTheme } from '../modules/advent/schema.mjs';
import { content } from '../modules/advent/content.mjs';
import { theme } from '../modules/advent/theme.mjs';

const cp = (...points) => String.fromCodePoint(...points);
const withPrayer = (value) => {
  const copy = structuredClone(content);
  copy.days[0].prayer = value;
  return copy;
};
const withTheme = (mutate) => {
  const copy = structuredClone(theme);
  mutate(copy);
  return copy;
};

const REJECTED = {
  // Blank-looking letters and marks
  'Hangul filler U+3164': 'a' + cp(0x3164) + 'b',
  'Hangul choseong filler U+115F': 'a' + cp(0x115F) + 'b',
  'Hangul jungseong filler U+1160': 'a' + cp(0x1160) + 'b',
  'halfwidth Hangul filler U+FFA0': 'a' + cp(0xFFA0) + 'b',
  'Braille blank U+2800': 'a' + cp(0x2800) + 'b',
  'combining grapheme joiner U+034F': 'a' + cp(0x034F) + 'b',
  'Mongolian vowel separator U+180E': 'a' + cp(0x180E) + 'b',
  'Mongolian free variation selector U+180B': 'a' + cp(0x180B) + 'b',
  'Khmer inherent vowel U+17B4': 'a' + cp(0x17B4) + 'b',
  'variation selector U+FE0E': 'a' + cp(0xFE0E) + 'b',
  'Hangul fillers alone': cp(0x3164, 0x3164),
  'Braille blank alone': cp(0x2800),
  // Spaces other than U+0020
  'no-break space U+00A0': 'a' + cp(0xA0) + 'b',
  'thin space U+2009': 'a' + cp(0x2009) + 'b',
  'hair space U+200A': 'a' + cp(0x200A) + 'b',
  'ideographic space U+3000': 'a' + cp(0x3000) + 'b',
  'Ogham space U+1680': 'a' + cp(0x1680) + 'b',
  'narrow no-break space U+202F': 'a' + cp(0x202F) + 'b',
  'medium mathematical space U+205F': 'a' + cp(0x205F) + 'b',
  'only a no-break space': cp(0xA0),
  'a newline': 'a\nb',
  'a tab': 'a\tb',
  // Addresses in disguise
  'spaced-out https': 'h t t p s : / / e x',
  'spaced-out domain': 'e x a m p l e . c o m',
  'space before .com': 'example .com',
  'dot then space-less tld': 'visit example.org now',
  'unlisted tld .xyz': 'visit example.xyz now',
  'unlisted tld .de': 'visit example.de now',
  'bit.ly with a path': 'bit.ly/abc',
  'bare bit.ly': 'bit.ly',
  'bare IPv4 address': '192.168.0.1',
  'host and port': 'localhost:8080',
  'ideographic full stop': 'example' + cp(0x3002) + 'com',
  'full-width full stop': 'example' + cp(0xFF0E) + 'com',
  'space before colon: tel': 'tel :123',
  'space before colon: data': 'data :text',
  'space before colon: javascript': 'javascript :x',
  'sms scheme': 'sms:12345',
  'Armenian colon U+0589': 'tel' + cp(0x0589) + '123',
  'ratio sign U+2236': 'tel' + cp(0x2236) + '123',
  'modifier colon U+A789': 'tel' + cp(0xA789) + '123',
  'small colon U+FE55': 'tel' + cp(0xFE55) + '123',
  'division slash U+2215 pair': 'x' + cp(0x2215, 0x2215) + 'evil',
  'fraction slash U+2044 pair': 'x' + cp(0x2044, 0x2044) + 'evil',
  'full-width solidus U+FF0F pair': 'x' + cp(0xFF0F, 0xFF0F) + 'evil',
  'a single slash': '/evil',
  'full-width reverse solidus': 'x' + cp(0xFF3C) + 'evil',
  'a hash sign': '#hash',
  'a percent escape in full-width': cp(0xFF05) + '3c',
  'math bold h in https': cp(0x1D421) + 'ttps://x',
  'circled h in https': cp(0x24D7) + 'ttps://x',
  'combining accent inside https': 'h' + cp(0x0301) + 'ttps://x',
  'full-width javascript': cp(0xFF4A) + 'avascript:alert(1)',
  // Entities: any ampersand at all
  'entity without semicolon': '&lt script &gt',
  'numeric entity without semicolon': '&#60',
  'bare &amp': '&amp',
  'hex entity': '&#x3c',
  'upper-case entity': '&LT',
  'a lone ampersand': 'Tom & Jerry',
  // Angle brackets and at signs in their look-alike forms
  'small less-than U+FE64 and greater-than U+FE65': cp(0xFE64) + 'script' + cp(0xFE65),
  'single angle quotes': cp(0x2039) + 'x' + cp(0x203A),
  'small at sign U+FE6B': 'a' + cp(0xFE6B) + 'b',
  'full-width braces': cp(0xFF5B, 0xFF5B) + 'x' + cp(0xFF5D, 0xFF5D),
  'small braces': cp(0xFE5B, 0xFE5B) + 'x',
  // Spreadsheet formulas
  'leading equals': '=HYPERLINK("x")',
  'leading plus': '+cmd',
  'leading at sign': '@SUM(1)',
  'leading hyphen': '-cmd',
  'leading space then equals': ' =1+1',
  // Symbols and emoji
  'emoji family with joiners': cp(0x1F468, 0x200D, 0x1F469),
  'keycap sequence': '1' + cp(0xFE0F, 0x20E3),
  'a lone left-to-right mark': cp(0x200E),
  'curly braces': 'a {b} c',
  'square brackets': 'a [b] c',
  'asterisk': 'a *b*',
  'underscore': 'a_b',
  'backtick': 'a `b`',
  'dollar and caret': 'a $ b ^ c',
  'tilde': 'a ~ b',
  'pipe': 'a | b',
  'ASCII digits only: Arabic-Indic digit': 'a ' + cp(0x0663) + ' b',
};

const ACCEPTED = {
  'plain sentence': 'Thank you for the world you made. Amen.',
  'scripture reference with colons': 'Genesis 1:1-5; John 3:16',
  'time of day': 'We meet at 10:30',
  'a colon at the end': 'note:',
  'quotes, apostrophes and brackets': 'It\'s "fine" (really), isn\'t it? Yes!',
  'typographic quotes and apostrophe': cp(0x201C) + 'Hello,' + cp(0x201D) + ' she said; it' + cp(0x2019) + 's ' + cp(0x2018) + 'fine' + cp(0x2019),
  'en dash and em dash': 'Genesis 1' + cp(0x2013) + '3 ' + cp(0x2014) + ' the beginning',
  'accented letters': 'St Thomas ' + cp(0xE0) + ' Becket, Caf' + cp(0xE9),
  'a letter with a combining accent': 'Cafe' + cp(0x0301),
  'Hebrew letters': cp(0x05D0, 0x05D1),
  'Arabic letters': cp(0x0627, 0x0628),
  'word, colon, space, word': 'Note: this is fine, and so is metadata: x.',
};

describe('content text allow-list', () => {
  for (const [name, value] of Object.entries(REJECTED)) {
    test(`rejects ${name}`, () => {
      assert.throws(() => validateContent(withPrayer(value)), /day 1: "prayer"/);
    });
  }

  for (const [name, value] of Object.entries(ACCEPTED)) {
    test(`accepts ${name}`, () => {
      validateContent(withPrayer(value));
    });
  }

  test('the same allow-list applies to titles and every paragraph, not just the prayer', () => {
    const odd = 'a' + cp(0x3164) + 'b';
    const copy = structuredClone(content);
    copy.days[2].title = odd;
    assert.throws(() => validateContent(copy), /day 3: "title"/);
    const other = structuredClone(content);
    other.days[2].paragraphs.push(odd);
    assert.throws(() => validateContent(other), /day 3: "paragraphs\[1\]"/);
    for (const field of ['ref', 'wonder', 'activity', 'alt', 'credit', 'hidden', 'translation']) {
      const c = structuredClone(content);
      c.days[2][field] = odd;
      assert.throws(() => validateContent(c), new RegExp(`day 3: "${field}"`), field);
    }
  });

  test('a scripture reference with no space gets a helpful message', () => {
    assert.throws(() => validateContent(withPrayer('John3:16')), /space/);
    assert.throws(() => validateContent(withPrayer('Genesis1:1')), /space/);
  });

  test('a real web address still gets the web address message', () => {
    assert.throws(() => validateContent(withPrayer('https://example.org')), /web address/);
  });

  test('every real day still passes', () => {
    validateContent(content);
  });
});

describe('theme names are restricted separately from content', () => {
  const accepted = ['Kington Parishes', "St Mary's, Kington", 'World English Bible', 'Caf' + cp(0xE9) + ' Church', 'Example.com'];
  const rejected = {
    'a double quote': 'A "quoted" name',
    'an ampersand': 'Tom & Jerry',
    'an escaped ampersand': 'A &amp; B',
    'angle brackets': '<b>Church</b>',
    'a colon and slashes': 'https://x.y',
    'a Hangul filler': 'a' + cp(0x3164) + 'b',
    'a no-break space': 'a' + cp(0xA0) + 'b',
    'a full-width less-than': 'a' + cp(0xFF1C) + 'b',
    'a leading equals': '=1+1',
    'a leading hyphen': '-1',
    'a semicolon': 'A; B',
    'a question mark': 'Church?',
  };

  for (const field of ['siteName', 'translationName']) {
    for (const value of accepted) {
      test(`${field} accepts ${JSON.stringify(value)}`, () => {
        validateTheme(withTheme((t) => { t[field] = value; }));
      });
    }
    for (const [name, value] of Object.entries(rejected)) {
      test(`${field} rejects ${name}`, () => {
        assert.throws(() => validateTheme(withTheme((t) => { t[field] = value; })), new RegExp(`"${field}"`));
      });
    }
  }

  test('pinned: the web address check is for content text; names rely on the character rules', () => {
    assert.throws(() => validateContent(withPrayer('see example.com')), /prayer/);
    validateTheme(withTheme((t) => { t.siteName = 'Example.com'; })); // letters and a dot: allowed in a name
    // The build must HTML-escape names wherever it uses them; see docs/advent/build-plan.md.
  });
});
