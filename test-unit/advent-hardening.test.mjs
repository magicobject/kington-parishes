// Hardening tests for modules/advent/schema.mjs, added after independent review:
// Unicode-aware text rules, URL detection, slugs, caps, copies and friendly errors.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateContent, validateTheme, artPathIsSafe, RESERVED_SLUGS } from '../modules/advent/schema.mjs';
import { content } from '../modules/advent/content.mjs';
import { theme } from '../modules/advent/theme.mjs';
import { PAGES } from '../src/pages.config.mjs';

const clone = (value) => structuredClone(value);
const withDay1 = (field, value) => {
  const copy = clone(content);
  copy.days[0][field] = value;
  return copy;
};
const withTheme = (mutate) => {
  const copy = clone(theme);
  mutate(copy);
  return copy;
};

describe('text rule: invisible, direction and control characters (one case each)', () => {
  const cases = {
    'C1 control U+0080': '\u0080',
    'NEL U+0085': '\u0085',
    'C1 control U+009F': '\u009F',
    'LRM U+200E': '\u200E',
    'RLM U+200F': '\u200F',
    'ALM U+061C': '\u061C',
    'zero width space U+200B': '\u200B',
    'zero width joiner U+200D': '\u200D',
    'word joiner U+2060': '\u2060',
    'line separator U+2028': '\u2028',
    'paragraph separator U+2029': '\u2029',
    'byte order mark U+FEFF': '\uFEFF',
    'soft hyphen U+00AD': '\u00AD',
    'variation selector U+FE0F': '\uFE0F',
    'tag character U+E0041': '\u{E0041}',
    'interlinear annotation U+FFF9': '\uFFF9',
    'lone high surrogate U+D800': '\uD800',
    'lone low surrogate U+DC00': '\uDC00',
  };
  for (const [name, character] of Object.entries(cases)) {
    test(`rejects ${name}`, () => {
      assert.throws(() => validateContent(withDay1('prayer', `a${character}b`)), /day 1: "prayer"/);
    });
  }

  test('rejects them in the title and in the theme names too', () => {
    assert.throws(() => validateContent(withDay1('title', 'a\u200Eb')), /"title"/);
    assert.throws(() => validateTheme(withTheme((t) => { t.siteName = 'a\u200Bb'; })), /"siteName"/);
    assert.throws(() => validateTheme(withTheme((t) => { t.translationName = 'a\u202Eb'; })), /"translationName"/);
    assert.throws(() => validateTheme(withTheme((t) => { t.siteName = 'a@b'; })), /"siteName"/);
  });

  test('a text made only of invisible characters counts as empty', () => {
    assert.throws(() => validateContent(withDay1('alt', '\u200B')), /"alt"/);
  });

  test('ordinary accented and curly-quote text is fine', () => {
    validateContent(withDay1('prayer', 'St Thomas \u00E0 Becket, \u201Cquoted\u201D and it\u2019s fine. Caf\u00E9.'));
  });
});

describe('text rule: web addresses and markup in disguise (one case each)', () => {
  const cases = {
    'template braces open only': 'open {{ only',
    'template braces close only': 'only }} close',
    'ftp scheme': 'ftp://x.y',
    'file scheme': 'file:///etc/passwd',
    'mailto scheme': 'mailto:a',
    'tel scheme': 'tel:123',
    'vbscript scheme': 'vbscript:x',
    'data scheme': 'data:text/html,hi',
    'javascript scheme': 'javascript:alert(1)',
    'scheme hidden by a zero-width space': 'java\u200Bscript:alert(1)',
    'www host': 'www.evil.example',
    'host with a path': 'evil.example/path',
    'domain with .com': 'visit evil.com now',
    'domain with .uk': 'see church.org.uk today',
    'full-width h in https': '\uFF48ttps://evil.example',
    'space before the slashes': 'https ://x',
    'full-width colon': 'https\uFF1A//x',
    'entity-encoded colon': 'javascript&colon;alert(1)',
    'backslash': 'x\\evil',
    'named entity': '&lt;',
    'numeric entity': '&#60;',
    'percent escape': 'a%3Cb',
    'full-width less-than': '\uFF1C',
    'full-width greater-than': '\uFF1E',
    'full-width at sign': 'a\uFF20b',
    'protocol-relative address': '//evil.example',
  };
  for (const [name, value] of Object.entries(cases)) {
    test(`rejects ${name}`, () => {
      assert.throws(() => validateContent(withDay1('wonder', value)), /day 1: "wonder"/);
    });
  }

  test('a word then a colon then a space is ordinary prose and passes; no space after the colon does not', () => {
    validateContent(withDay1('wonder', 'Note: this is fine, and so is metadata: x. Luke 2:6-7 too.'));
    assert.throws(() => validateContent(withDay1('wonder', 'metadata:x')), /"wonder"/);
  });

  test('everyday punctuation and times pass', () => {
    validateContent(withDay1('wonder', 'I wonder if half of us can sing at 10:30? Yes (maybe) - "quoted"!'));
  });
});

describe('slugs', () => {
  const slugged = (slug) => withTheme((t) => { t.slug = slug; });

  test('accepts plain hyphenated slugs only', () => {
    for (const ok of ['advent', 'christmas-calendar', 'a1', 'advent-2026']) validateTheme(slugged(ok));
  });

  test('rejects leading slashes, folders, dots, capitals, doubled or edge hyphens, empties and long ones', () => {
    for (const bad of ['/advent', 'a/b', 'a.b', 'Advent', '-a', 'a-', 'a--b', '', 'x'.repeat(33), 5, null, undefined, '../x', 'a b']) {
      assert.throws(() => validateTheme(slugged(bad)), /"slug"/, String(bad));
    }
  });

  test('every page name in src/pages.config.mjs is reserved (generic list plus the theme list), and each is rejected', () => {
    // The calendar's own page is the one page that takes the slug, so it is not in the reserved list.
    for (const page of PAGES.filter((p) => p.slug !== theme.slug)) {
      assert.ok(RESERVED_SLUGS.includes(page.slug) || theme.reservedSlugs.includes(page.slug), `${page.slug} should be reserved`);
      assert.throws(() => validateTheme(slugged(page.slug)), /"slug"/, page.slug);
    }
    for (const reserved of RESERVED_SLUGS) {
      assert.throws(() => validateTheme(slugged(reserved)), /"slug"/, reserved);
    }
  });

  test('reservedSlugs must be a list of page names', () => {
    for (const bad of [undefined, 'contact', [5], ['A b'], new Array(201).fill('a')]) {
      assert.throws(() => validateTheme(withTheme((t) => { t.reservedSlugs = bad; })), /reservedSlugs|missing key/);
    }
  });

  test('the fixed reserved names are present', () => {
    for (const name of ['api', 'js', 'css', 'img', 'assets', 'index', '404', 'sitemap', 'robots', 'search-index', 'updates', 'cdn-cgi', 'functions', 'help']) {
      assert.ok(RESERVED_SLUGS.includes(name), name);
    }
  });

  test('the real slug is not reserved', () => {
    assert.ok(!RESERVED_SLUGS.includes(theme.slug));
  });
});

describe('caps, keys and shapes', () => {
  test('every text field accepts its cap and rejects one more, naming the field', () => {
    for (const [field, max] of [['title', 120], ['ref', 120], ['wonder', 300], ['prayer', 500], ['credit', 200], ['translation', 200], ['alt', 300]]) {
      validateContent(withDay1(field, 'a'.repeat(max)));
      assert.throws(() => validateContent(withDay1(field, 'a'.repeat(max + 1))), new RegExp(`"${field}"`), field);
    }
  });

  test('translation is required on every day', () => {
    const copy = clone(content);
    delete copy.days[6].translation;
    assert.throws(() => validateContent(copy), /day 7: missing key "translation"/);
  });

  test('theme: siteName cap, season month and day shapes, extra keys, colour prefix', () => {
    assert.throws(() => validateTheme(withTheme((t) => { t.siteName = 'a'.repeat(81); })), /"siteName"/);
    for (const month of [0, 1.5]) {
      assert.throws(() => validateTheme(withTheme((t) => { t.season.start.month = month; })), /"month"/);
    }
    assert.throws(() => validateTheme(withTheme((t) => { t.season.start.extra = 1; })), /unknown key "extra"/);
    assert.throws(() => validateTheme(withTheme((t) => { t.colours.night = 'x#123456'; })), /"night"/);
    assert.throws(() => validateTheme(withTheme((t) => { t.colours.night = '#123456\n'; })), /"night"/);
  });

  test('theme: archiveUntil equal to the start or the end is rejected; a season of exactly 25 days with no archive is fine', () => {
    assert.throws(() => validateTheme(withTheme((t) => { t.season.archiveUntil = { month: 12, day: 1 }; })), /archiveUntil/);
    assert.throws(() => validateTheme(withTheme((t) => { t.season.archiveUntil = { month: 12, day: 25 }; })), /archiveUntil/);
    validateTheme(withTheme((t) => { t.bonus = null; t.season = { start: { month: 12, day: 5 }, end: { month: 12, day: 29 }, archiveUntil: null }; })); // a 25-day season (start equal to end is no longer possible: the season must match the 25 doors)
  });
});

describe('copies, wrong shapes and friendly errors', () => {
  test('validators return a copy, so later changes to the original cannot alter what was checked', () => {
    const original = clone(content);
    const checked = validateContent(original);
    assert.deepEqual(checked, original);
    assert.notEqual(checked, original);
    original.days[0].title = '<script>';
    assert.notEqual(checked.days[0].title, '<script>');

    const themeCopy = validateTheme(theme);
    assert.deepEqual(themeCopy, theme);
    assert.notEqual(themeCopy, theme);
  });

  test('a getter that changes its answer cannot slip past (the checked copy is what is returned)', () => {
    let calls = 0;
    const sneaky = clone(content);
    Object.defineProperty(sneaky.days[0], 'title', { enumerable: true, get() { calls += 1; return calls === 1 ? 'Fine title' : '<script>'; } });
    const checked = validateContent(sneaky);
    assert.equal(checked.days[0].title, 'Fine title');
  });

  test('the wrong number of days gets a friendly message before anything else', () => {
    const short = clone(content);
    short.days.length = 24;
    assert.throws(() => validateContent(short), /exactly 25 days/);
    const long = clone(content);
    long.days.push(clone(long.days[0]));
    assert.throws(() => validateContent(long), /exactly 25 days/);
  });

  test('a sparse days list of the right length is rejected without a TypeError', () => {
    const sparse = clone(content);
    delete sparse.days[3];
    assert.throws(() => validateContent(sparse), (error) => error.constructor === Error && /days\[3\]/.test(error.message));
    const holes = { days: new Array(25) };
    assert.throws(() => validateContent(holes), (error) => error.constructor === Error);
  });

  test('values that cannot be copied give a friendly error', () => {
    assert.throws(() => validateContent({ days: [() => 1] }), (error) => error.constructor === Error);
    const withFunction = clone(content);
    withFunction.days[0].title = () => 'x';
    assert.throws(() => validateContent(withFunction), (error) => error.constructor === Error);
  });

  test('error messages quote hostile keys safely, trimmed and escaped', () => {
    const copy = clone(content);
    copy.days[0]['evil\u202E\nkey' + 'x'.repeat(100)] = 1;
    assert.throws(() => validateContent(copy), (error) => {
      assert.ok(!error.message.includes('\u202E'));
      assert.ok(!error.message.includes('\n'));
      assert.ok(error.message.length < 200);
      return /unknown key "/.test(error.message);
    });
  });
});

describe('art names', () => {
  test('Windows device names and trailing hyphens are rejected', () => {
    for (const bad of ['con.svg', 'nul.svg', 'aux.svg', 'prn.svg', 'com1.svg', 'com9.svg', 'lpt1.svg', 'lpt9.svg', 'x-.svg', 'day-.svg']) {
      assert.equal(artPathIsSafe(bad), false, bad);
    }
    for (const ok of ['day-05.svg', 'console.svg', 'com10.svg', 'comet.svg', 'a.svg']) {
      assert.equal(artPathIsSafe(ok), true, ok);
    }
  });
});

describe('review gaps: schemes, domains, full-width forms and code-point ranges', () => {
  const rejectsInWonder = (value, label = value) => {
    assert.throws(() => validateContent(withDay1('wonder', value)), /day 1: "wonder"/, label);
  };

  test('schemes are matched whatever the case', () => {
    for (const value of ['JAVASCRIPT:alert(1)', 'MAILTO:a', 'DATA:text/html,x', 'JavaScript:x']) rejectsInWonder(value);
  });

  test('each listed domain ending is caught', () => {
    for (const tld of ['io', 'dev', 'co', 'info', 'app', 'uk', 'com', 'org', 'net']) rejectsInWonder(`see example.${tld}`);
  });

  test('full-width braces and a full-width dot domain are caught', () => {
    for (const value of ['\uFF5B\uFF5Bx', 'x\uFF5D\uFF5D', '\uFF57\uFF57\uFF57\uFF0Eexample\uFF0Ecom', 'example\uFF0E\uFF4F\uFF52\uFF47']) rejectsInWonder(value);
  });

  test('the variation selector supplement and the unassigned tag-block code points are caught', () => {
    for (const point of [0xE0100, 0xE01EF, 0xE0000, 0xE0002]) rejectsInWonder('a' + String.fromCodePoint(point) + 'b', point.toString(16));
  });
});
