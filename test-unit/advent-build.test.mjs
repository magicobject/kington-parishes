// Unit tests for modules/advent/build.mjs (phase 2): validation, generated files,
// the SVG lint, art checks, the {{ADVENT}} token and the page entry.
// Everything builds into a temporary folder; nothing here touches public/.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildAdvent, renderAdventToken, lintSvg, artFilePath, validateDayFile, adventPageEntry, rewriteImports,
} from '../modules/advent/build.mjs';
import { validateTheme } from '../modules/advent/schema.mjs';
import { theme as realTheme } from '../src/advent/theme.mjs';
// These tests build into empty temporary folders, so they use the real theme without its own scene file
// (the scene is tested in advent-ui-build.test.mjs).
import { pinFlags } from './support/fixture-flags.mjs';
const theme = { ...pinFlags(realTheme), scene: null };
import { content as realContent } from '../src/advent/content.mjs';
// The 25 days only: these tests build with and without a bonus day on purpose (the real bonus is tested in advent-built).
const content = { days: realContent.days };
import { isIndexable, isSearchablePage } from '../scripts/build-search-index.mjs';
import { cases as REVIEW_SAMPLES } from './support/hostile-svgs.mjs';

const GOOD_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs><path fill="url(#g)" d="M0 0L10 10"/><use href="#g"/></svg>';
const dayName = (n) => `day-${String(n).padStart(2, '0')}.svg`;
const withTheme = (mutate) => { const copy = structuredClone(theme); mutate(copy); return copy; };
const withContent = (mutate) => { const copy = structuredClone(content); mutate(copy); return copy; };

const dirs = [];
function tempPublic() {
  const dir = mkdtempSync(join(tmpdir(), 'advent-build-'));
  dirs.push(dir);
  return dir;
}
const run = (options = {}) => {
  const publicDir = options.publicDir ?? tempPublic();
  const result = buildAdvent({
    theme, content, publicDir, siteUrl: 'https://example.test', pageNames: ['index', 'contact'], ...options,
  });
  return { publicDir, result };
};
function writeAllArt(publicDir, svg = GOOD_SVG) {
  mkdirSync(join(publicDir, 'advent', 'art'), { recursive: true });
  for (let n = 1; n <= 25; n += 1) writeFileSync(join(publicDir, 'advent', 'art', dayName(n)), svg);
}
after(() => { for (const dir of dirs) rmSync(dir, { recursive: true, force: true }); });

describe('buildAdvent: validation', () => {
  test('refuses an invalid theme or invalid content', () => {
    assert.throws(() => run({ theme: withTheme((t) => { t.siteName = 'Bad <name>'; }) }), /siteName/);
    assert.throws(() => run({ theme: withTheme((t) => { delete t.artRequired; }) }), /artRequired/);
    assert.throws(() => run({ content: withContent((c) => { c.days.pop(); }) }), /exactly 25/);
    assert.throws(() => run({ content: withContent((c) => { c.days[3].title = 'See {{ADVENT}}'; }) }), /braces/);
  });

  test('refuses a calendar page name that another page already uses', () => {
    assert.throws(() => run({ pageNames: ['index', theme.slug] }), /slug/);
  });

  test('refuses a siteUrl that is not https', () => {
    assert.throws(() => run({ siteUrl: 'http://example.test' }), /siteUrl/);
  });

  test("uses the validators' returned copies, not the objects it was given", () => {
    const mine = structuredClone(content);
    const { result } = run({ content: mine });
    assert.notEqual(result.content, mine);
    assert.deepEqual(result.content, mine);
    mine.days[0].title = 'Changed afterwards';
    assert.notEqual(result.content.days[0].title, 'Changed afterwards');
    assert.notEqual(result.theme, theme);
  });

  test('writes nothing when validation fails', () => {
    const publicDir = tempPublic();
    assert.throws(() => run({ publicDir, content: withContent((c) => { c.days.pop(); }) }));
    assert.deepEqual(readdirSync(publicDir), []);
  });
});

describe('buildAdvent: generated day files', () => {
  let publicDir;
  let first;
  before(() => {
    ({ publicDir } = run());
    first = Object.fromEntries(readdirSync(join(publicDir, 'advent')).filter((n) => n.endsWith('.json')).map((n) => [n, readFileSync(join(publicDir, 'advent', n), 'utf8')]));
  });

  test('25 files named day-01.json to day-25.json', () => {
    assert.deepEqual(Object.keys(first), Array.from({ length: 25 }, (_, i) => dayName(i + 1).replace('.svg', '.json')));
  });

  test('exact keys in a stable order, no art key while the picture is missing', () => {
    const day1 = JSON.parse(first['day-01.json']);
    assert.deepEqual(Object.keys(day1), ['day', 'title', 'ref', 'paragraphs', 'wonder', 'prayer', 'alt', 'translation', 'credit']);
    for (const text of Object.values(first)) {
      const parsed = JSON.parse(text);
      assert.doesNotThrow(() => validateDayFile(parsed, parsed.day));
      assert.ok(!('art' in parsed));
    }
  });

  test('plain, LF-only, ends with one newline, and matches the validated content', () => {
    for (const [name, text] of Object.entries(first)) {
      assert.ok(text.endsWith('}\n'), name);
      assert.ok(!text.includes('\r'), name);
      const parsed = JSON.parse(text);
      const source = content.days.find((d) => d.day === parsed.day);
      const { art, ...rest } = source;
      assert.deepEqual(parsed, rest);
    }
  });

  test('building again gives byte-identical files', () => {
    run({ publicDir });
    for (const [name, text] of Object.entries(first)) {
      assert.equal(readFileSync(join(publicDir, 'advent', name), 'utf8'), text, name);
    }
  });

  test('the art key appears only for a picture that exists', () => {
    const dir = tempPublic();
    mkdirSync(join(dir, 'advent', 'art'), { recursive: true });
    writeFileSync(join(dir, 'advent', 'art', 'day-02.svg'), GOOD_SVG);
    run({ publicDir: dir });
    assert.equal(JSON.parse(readFileSync(join(dir, 'advent', 'day-02.json'), 'utf8')).art, 'day-02.svg');
    assert.ok(!('art' in JSON.parse(readFileSync(join(dir, 'advent', 'day-03.json'), 'utf8'))));
  });

  test('validateDayFile rejects unknown keys, wrong order and wrong day', () => {
    const good = JSON.parse(first['day-07.json']);
    assert.throws(() => validateDayFile({ ...good, extra: 'x' }, 7), /unknown key/);
    const { title, ...rest } = good;
    assert.throws(() => validateDayFile({ title, ...rest }, 7), /order/);
    assert.throws(() => validateDayFile(good, 8), /day/);
    assert.throws(() => validateDayFile({ ...good, title: 'x <b>' }, 7), /title/);
  });
});

describe('buildAdvent: generated and copied site files', () => {
  let publicDir;
  before(() => { ({ publicDir } = run()); });
  const read = (path) => readFileSync(join(publicDir, path), 'utf8');

  test('advent-theme.css carries the banner and one variable per theme colour', () => {
    const css = read('css/advent-theme.css');
    assert.match(css, /^\/\* AUTO-GENERATED/);
    assert.ok(css.includes('--advent-night: #14202b;'));
    assert.ok(css.includes('--advent-accent-ink: #1f1a0b;'));
    assert.ok(css.includes('--advent-door-edge: #a8813c;'));
    assert.ok(css.endsWith('}\n'));
    assert.ok(!css.includes('\r'));
  });

  test('advent.css and advent.js are copied with banners', () => {
    assert.match(read('css/advent.css'), /^\/\* AUTO-GENERATED/);
    assert.match(read('js/advent.js'), /^\/\/ AUTO-GENERATED/);
    assert.ok(read('css/advent.css').includes(readFileSync(new URL('../modules/advent/client/advent.css', import.meta.url), 'utf8')));
  });

  test("the client's imports are rewritten to hashed copies of the date modules (one source of truth)", () => {
    const client = read('js/advent.js');
    assert.match(client, /from '\.\/advent\/date\.js\?v=[0-9a-f]{10}'/);
    assert.match(client, /from '\.\/advent\/preview\.js\?v=[0-9a-f]{10}'/);
    assert.ok(!client.includes('../'));
    assert.match(read('js/advent/preview.js'), /from '\.\/date\.js\?v=[0-9a-f]{10}'/);
    const body = (text) => text.split('\n').slice(3).join('\n');
    assert.equal(body(read('js/advent/date.js')), readFileSync(new URL('../modules/advent/date.mjs', import.meta.url), 'utf8'));
  });
});

// Three small, legitimate pictures in the style of the approved mock-up (docs/advent/mockups/advent-mockup.html):
// shapes, a gradient, and figures defined once as a symbol and drawn with <use>.
const LEGIT = {
  'sky, thread and star': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225" role="img" aria-label="A golden thread across a night sky."><defs><linearGradient id="g4" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1530"/><stop offset=".7" stop-color="#1b2a55"/></linearGradient><radialGradient id="s1"><stop offset="0" stop-color="#fffbe8"/><stop offset="1" stop-color="#fffbe8" stop-opacity="0"/></radialGradient><symbol id="star4" viewBox="-10 -10 20 20"><path d="M0-10C1.2-3 3-1.2 10 0 3 1.2 1.2 3 0 10-1.2 3-3 1.2-10 0-3-1.2-1.2-3 0-10z" fill="#fff3c8"/></symbol></defs><rect width="400" height="225" fill="url(#g4)"/><path d="M0 190C80 160 150 175 220 190S340 178 400 184V225H0z" fill="#10182f"/><path d="M125 142C160 108 205 138 226 96" fill="none" stroke="#E8C27A" stroke-width="3" stroke-linecap="round"/><circle cx="200" cy="118" r="22" fill="url(#s1)"/><use href="#star4" x="288" y="38" width="38" height="38"/></svg>',
  'shepherd and sheep': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225"><title>A shepherd with a sheep</title><desc>Two simple figures on a hill.</desc><defs><symbol id="sheep" viewBox="0 0 60 40"><g fill="#2b303b"><rect x="19" y="28" width="3.2" height="10" rx="1.4"/></g><g fill="#F2E6C4"><circle cx="16" cy="19" r="9"/></g><g fill="#2b303b"><ellipse cx="53" cy="20" rx="6" ry="5.2" transform="rotate(14 53 20)"/></g></symbol><symbol id="shepherd" viewBox="0 0 40 90"><path d="M33 89V12c0-7-7-9-10-4" fill="none" stroke="#8a6a3c" stroke-width="2.6" stroke-linecap="round"/><path d="M12 52q8 5 16 0" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="2"/><ellipse cx="20" cy="13" rx="5" ry="6" fill="#d8b48d"/></symbol></defs><!-- a hill --><path d="M0 195C70 160 130 170 200 190V225H0z" fill="#0b141c"/><use href="#shepherd" x="102" y="140" width="28" height="63" style="color:#6a4a3a"/><use href="#sheep" x="200" y="170" width="40" height="27"/></svg>',
  'a crowd of shepherds, sheep and kneelers (three symbols, ten uses)': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225" aria-hidden="true" focusable="false"><defs><symbol id="sheep" viewBox="0 0 60 40"><g fill="#F2E6C4"><circle cx="16" cy="19" r="9"/><circle cx="26" cy="13" r="10.5"/></g></symbol><symbol id="shepherd" viewBox="0 0 40 90"><g><path d="M33 89V12c0-7-7-9-10-4" fill="none" stroke="#8a6a3c" stroke-width="2.6"/><ellipse cx="20" cy="13" rx="5" ry="6" fill="#d8b48d"/></g></symbol><symbol id="kneeler" viewBox="0 0 60 60"><path d="M4 58C4 38 14 26 29 26c9 0 15 5 17 14l6 18z" fill="currentColor"/></symbol></defs><rect width="400" height="225" fill="#0b141c"/><use href="#shepherd" x="98" y="122" width="37" height="83" style="color:#6b4f3a"/><use href="#shepherd" x="142" y="134" width="33" height="74" style="color:#3f5a6e"/><use href="#kneeler" x="42" y="150" width="56" height="56" style="color:#7a5a3a"/><use href="#kneeler" x="104" y="146" width="58" height="58" style="color:#2a4a85"/><use href="#sheep" x="226" y="172" width="42" height="28"/><use href="#sheep" x="274" y="182" width="36" height="24"/><use href="#sheep" x="316" y="170" width="42" height="28"/><use href="#sheep" x="352" y="186" width="34" height="23"/><use href="#sheep" x="176" y="190" width="24" height="16"/><use href="#kneeler" x="0" y="0" width="58" height="58" transform="translate(292 146) scale(-1 1) translate(-58 0)" style="color:#6b4f2f"/></svg>',
  'kneeler and clipped light': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225" aria-hidden="true" focusable="false"><defs><clipPath id="c"><rect width="400" height="225"/></clipPath><symbol id="kneeler" viewBox="0 0 60 60"><path d="M4 58C4 38 14 26 29 26c9 0 15 5 17 14l6 18z" fill="currentColor"/><circle cx="56" cy="37" r="3" fill="#d8b48d"/></symbol></defs><g clip-path="url(#c)" opacity=".9"><polygon points="0,0 400,0 200,120" fill="#E8C27A" fill-opacity=".3"/><line x1="0" y1="200" x2="400" y2="200" stroke="#fff" stroke-width="1"/><polyline points="10,10 20,30 30,10" fill="none" stroke="#fff"/></g><use href="#kneeler" x="150" y="120" width="60" height="60" style="color:#6a4a3a;opacity:.8"/></svg>',
};

describe('lintSvg: a parse-based allow-list', () => {
  test('accepts a clean picture, including internal #links and url(#fragment)', () => {
    assert.deepEqual(lintSvg(GOOD_SVG), []);
  });

  for (const [name, sample] of Object.entries(LEGIT)) {
    test(`accepts a legitimate picture: ${name}`, () => {
      assert.deepEqual(lintSvg(sample), []);
    });
  }

  const HOSTILE = {
    'script element': '<svg><script>alert(1)</script></svg>',
    'upper case script': '<svg><SCRIPT>alert(1)</SCRIPT></svg>',
    'split script': '<svg><scr<script>ipt>x</scr</script>ipt></svg>',
    foreignObject: '<svg><foreignObject><div>hi</div></foreignObject></svg>',
    'onload handler': '<svg onload="x()"></svg>',
    'spaced onclick': '<svg><rect onclick = "x()"/></svg>',
    'single-quoted handler': "<svg><rect onmouseover='x()'/></svg>",
    'external href': '<svg><a href="https://evil.example"><rect/></a></svg>',
    'javascript xlink:href': '<svg><a xlink:href="javascript:alert(1)"><rect/></a></svg>',
    'data href': '<svg><use href="data:image/svg+xml;base64,AAAA"/></svg>',
    'href with leading space': '<svg><use href=" #a"/></svg>',
    'encoded javascript href': '<svg><a href="&#106;avascript:x()"><rect/></a></svg>',
    'unquoted href': '<svg><a href=//evil.example><rect/></a></svg>',
    'image element': '<svg><image href="#a"/></svg>',
    'import in style': '<svg><style>@import url(#x);</style></svg>',
    'remote url in style': '<svg><style>a{background:url(http://evil.example/x.png)}</style></svg>',
    'protocol-relative url': '<svg><style>a{fill:url(//evil.example/x)}</style></svg>',
    'url in attribute': '<svg><rect style="fill:url(https://evil.example/x)"/></svg>',
    'entity declaration': '<!DOCTYPE svg [<!ENTITY x "boom">]><svg>&x;</svg>',
    'bare entity': '<svg><!ENTITY x "y"></svg>',
    iframe: '<svg><iframe src="x"></iframe></svg>',
    'animate href': '<svg><a><set attributeName="href" to="javascript:alert(1)"/></a></svg>',
    'processing instruction stylesheet': '<?xml-stylesheet href="x.css"?><svg></svg>',
    'xml declaration': '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>',
    'not an svg': 'hello',
    empty: '',
    'too big': `<svg>${'<rect/>'.repeat(20000)}</svg>`,
    'text element': '<svg><text x="1" y="2">hi</text></svg>',
    'text outside title': '<svg>hello</svg>',
    'a element with a hash link': '<svg><a href="#x"><rect/></a></svg>',
    'style element': '<svg><style>rect{fill:red}</style></svg>',
    'namespace prefix on an element': '<svg><svg:rect/></svg>',
    'namespace prefix on an attribute': '<svg><rect xlink:title="x"/></svg>',
    'xml:base': '<svg><g xml:base="http://e/"/></svg>',
    'xmlns off the root': '<svg><g xmlns="http://www.w3.org/2000/svg"/></svg>',
    'wrong xmlns on the root': '<svg xmlns="http://evil.example/ns"></svg>',
    cdata: '<svg><![CDATA[x]]></svg>',
    'comment with markup': '<svg><!-- <script>x</script> --></svg>',
    'comment with double hyphen trick': '<svg><!-- a --!> <rect/> --></svg>',
    'unclosed comment': '<svg><!-- x</svg>',
    'entity in a value': '<svg><rect fill="&#35;fff"/></svg>',
    'entity in a comment': '<svg><!-- &amp; --></svg>',
    'nul character': '<svg><rect/>\u0000</svg>',
    'byte order mark': '\uFEFF<svg></svg>',
    'unquoted attribute': '<svg><rect width=5/></svg>',
    'two roots': '<svg></svg><svg></svg>',
    'unclosed element': '<svg><g></svg>',
    'mismatched close': '<svg><g></svg></g>',
    'duplicate attribute': '<svg><rect x="1" x="2"/></svg>',
    'class attribute': '<svg><rect class="a"/></svg>',
    'style with url': '<svg><rect style="fill:url(#g)"/></svg>',
    'style with a backslash': '<svg><rect style="fill:\\75rl(x)"/></svg>',
    'style with expression': '<svg><rect style="width:expression(1)"/></svg>',
    'style with a comment': '<svg><rect style="fill:red/**/"/></svg>',
    'style with image-set': '<svg><rect style="fill:image-set(x)"/></svg>',
    'style with a property that is not on the list': '<svg><rect style="cursor:pointer"/></svg>',
    'use without a hash': '<svg><use href="x.svg#a"/></svg>',
    'href on a non-use element': '<svg><rect href="#a"/></svg>',
    'deeper than 20 levels': `<svg>${'<g>'.repeat(21)}${'</g>'.repeat(21)}</svg>`,
  };
  for (const [name, sample] of Object.entries(HOSTILE)) {
    test(`rejects: ${name}`, () => {
      assert.ok(lintSvg(sample).length > 0, name);
    });
  }

  test('rejects every sample from the independent review (all but the two legitimate ones)', () => {
    const legitimate = new Set(['clean', 'useHash']);
    let rejected = 0;
    for (const [name, sample] of Object.entries(REVIEW_SAMPLES)) {
      // These two are fine pictures wrapped in a header that declares the old xlink prefix, which we refuse: without it they pass.
      const problems = lintSvg(sample);
      if (legitimate.has(name)) {
        assert.ok(problems.length > 0, name);
        assert.deepEqual(lintSvg(sample.replace(/ xmlns:xlink="[^"]*"/, '')), [], name);
      }
      else {
        assert.ok(problems.length > 0, `${name} should be refused`);
        rejected += 1;
      }
    }
    assert.ok(rejected >= 75, `only ${rejected} samples were checked`);
  });

  // The "use" amplification attacks (security review, 13 Oct 2026). The review samples carry the old xlink header, which
  // is refused for its own reason, so these tests strip it and prove the refusal comes from the <use> rules.
  const withoutXlink = (sample) => sample.replace(/ xmlns:xlink="[^"]*"/, '');
  for (const name of ['billionLaughs', 'nestedUseUnderCap', 'selfReference', 'referenceCycle', 'useOfAUse', 'useInsideItsOwnTarget']) {
    test(`refuses the use-amplification sample ${name}, for a reason about use`, () => {
      const problems = lintSvg(withoutXlink(REVIEW_SAMPLES[name]));
      assert.ok(problems.length > 0, name);
      assert.match(problems[0], /use/i, problems[0]);
    });
  }

  test('the billion-laughs sample is the small one from the review (about 1.8 KB, 10 levels of 10 uses)', () => {
    const size = Buffer.byteLength(REVIEW_SAMPLES.billionLaughs);
    assert.ok(size > 1500 && size < 2300, `size ${size}`);
    assert.equal((REVIEW_SAMPLES.billionLaughs.match(/<use /g) ?? []).length, 91);
  });

  test('caps the number of use elements at 50: 50 is fine, 51 is refused', () => {
    const uses = (n) => `<svg><defs><rect id="r" width="1" height="1"/></defs>${'<use href="#r"/>'.repeat(n)}</svg>`;
    assert.deepEqual(lintSvg(uses(50)), []);
    assert.match(lintSvg(uses(51))[0], /more than 50/);
  });

  test('refuses a use that points at a group containing a use, wherever in the file the group is', () => {
    const later = '<svg><use href="#g"/><g id="g"><rect id="r" width="1" height="1"/><g><use href="#r"/></g></g></svg>';
    assert.match(lintSvg(later)[0], /use/i);
  });

  test('still accepts a use of something that does not exist, and uses of shapes, gradients and symbols without uses inside', () => {
    assert.deepEqual(lintSvg('<svg><use href="#missing"/></svg>'), []);
    assert.deepEqual(lintSvg('<svg><defs><symbol id="a"><rect width="1" height="1"/></symbol><g id="b"><circle r="1"/></g></defs><use href="#a"/><use href="#b"/><use href="#a"/></svg>'), []);
  });

  test('refuses more than 2000 elements and accepts 20 levels of nesting', () => {
    assert.ok(lintSvg(`<svg>${'<rect/>'.repeat(2001)}</svg>`).length > 0);
    assert.deepEqual(lintSvg(`<svg>${'<g>'.repeat(19)}${'</g>'.repeat(19)}</svg>`), []);
  });

  test('rejects a non-string', () => {
    assert.ok(lintSvg(null).length > 0);
    assert.ok(lintSvg(42).length > 0);
  });

  test('allows a picture just under the size cap', () => {
    const body = 'a'.repeat(40 * 1024 - 40);
    assert.deepEqual(lintSvg(`<svg><desc>${body}</desc></svg>`), []);
    assert.ok(lintSvg(`<svg><desc>${body}${'a'.repeat(100)}</desc></svg>`).length > 0);
  });
});

describe('art checks', () => {
  test('artFilePath stays inside the art folder', () => {
    const dir = tempPublic();
    assert.ok(artFilePath(dir, 'day-01.svg').startsWith(dir));
    for (const bad of ['../day-01.svg', '..\\day-01.svg', '/etc/passwd', 'a/b.svg', 'day-01.svg/..', 'DAY-01.svg', '', 'day-01.svg::$DATA', 'day-01.svg ', 'day-01.svg.', 'nul.svg', 'com1.svg']) {
      assert.throws(() => artFilePath(dir, bad), /art/, bad);
    }
  });

  test('artRequired false: missing pictures are allowed, and so is a missing art folder', () => {
    assert.doesNotThrow(() => run({ theme: withTheme((t) => { t.artRequired = false; }) }));
  });

  test('artRequired true: names the missing pictures and refuses', () => {
    const dir = tempPublic();
    writeAllArt(dir);
    rmSync(join(dir, 'advent', 'art', 'day-13.svg'));
    assert.throws(() => run({ publicDir: dir, theme: withTheme((t) => { t.artRequired = true; }) }), /day-13\.svg/);
    assert.throws(() => run({ theme: withTheme((t) => { t.artRequired = true; }) }), /missing/);
  });

  test('artRequired true: all 25 clean pictures pass and appear in the day files', () => {
    const dir = tempPublic();
    writeAllArt(dir);
    const { result } = run({ publicDir: dir, theme: withTheme((t) => { t.artRequired = true; }) });
    assert.equal(result.artPresent.length, 25);
    assert.equal(JSON.parse(readFileSync(join(dir, 'advent', 'day-25.json'), 'utf8')).art, 'day-25.svg');
  });

  test('the legitimate sample pictures pass as real art files', () => {
    const dir = tempPublic();
    mkdirSync(join(dir, 'advent', 'art'), { recursive: true });
    Object.values(LEGIT).forEach((svg, i) => writeFileSync(join(dir, 'advent', 'art', dayName(i + 1)), svg));
    assert.equal(run({ publicDir: dir }).result.artPresent.length, Object.keys(LEGIT).length);
  });

  test('a hostile picture is refused whether art is required or not', () => {
    for (const required of [true, false]) {
      const dir = tempPublic();
      writeAllArt(dir);
      writeFileSync(join(dir, 'advent', 'art', 'day-04.svg'), '<svg><script>x</script></svg>');
      assert.throws(() => run({ publicDir: dir, theme: withTheme((t) => { t.artRequired = required; }) }), /day-04\.svg/);
    }
  });

  test('ANY file in the art folder other than day-01.svg to day-25.svg is refused', () => {
    for (const name of ['stray.svg', 'day-26.svg', 'day-00.svg', 'day-1.svg', 'DAY-01.svg', 'day-01.svg.bak', 'notes.txt', 'Thumbs.db', 'day-01.png', '.hidden']) {
      const dir = tempPublic();
      mkdirSync(join(dir, 'advent', 'art'), { recursive: true });
      writeFileSync(join(dir, 'advent', 'art', name), name.endsWith('.svg') ? GOOD_SVG : 'x');
      assert.throws(() => run({ publicDir: dir }), new RegExp(name.replace(/\./g, '\\.')), name);
    }
  });

  test('a sub-folder inside the art folder is refused', () => {
    const dir = tempPublic();
    mkdirSync(join(dir, 'advent', 'art', 'more'), { recursive: true });
    assert.throws(() => run({ publicDir: dir }), /more/);
  });

  test('a picture that is a link is refused (skipped where the machine cannot make file links)', (t) => {
    const outside = tempPublic();
    writeFileSync(join(outside, 'x.svg'), GOOD_SVG);
    const dir = tempPublic();
    mkdirSync(join(dir, 'advent', 'art'), { recursive: true });
    try {
      symlinkSync(join(outside, 'x.svg'), join(dir, 'advent', 'art', 'day-02.svg'), 'file');
    } catch {
      t.skip('this machine cannot create file links');
      return;
    }
    assert.throws(() => run({ publicDir: dir }), /link/);
  });

  test('the art folder itself being a link (or junction) is refused', () => {
    const outside = tempPublic();
    const dir = tempPublic();
    mkdirSync(join(dir, 'advent'), { recursive: true });
    symlinkSync(outside, join(dir, 'advent', 'art'), 'junction');
    assert.throws(() => run({ publicDir: dir }), /link/);
  });
});

describe('renderAdventToken', () => {
  const ctx = { theme: validateTheme(theme) };
  const page = '<main>\n<h1>Advent</h1>\n{{ADVENT}}\n</main>';
  const out = renderAdventToken(page, ctx);

  test('replaces the token and leaves the rest of the page alone', () => {
    assert.ok(!out.includes('{{ADVENT}}'));
    assert.ok(out.startsWith('<main>\n<h1>Advent</h1>\n<section'));
    assert.equal(renderAdventToken('<p>nothing</p>', ctx), '<p>nothing</p>');
  });

  test('replaces every occurrence', () => {
    assert.equal(renderAdventToken('{{ADVENT}}{{ADVENT}}', ctx).match(/<section/g).length, 2);
  });

  test('carries its config in data-* attributes', () => {
    for (const attribute of [
      'data-advent="true"', 'data-slug="advent"', 'data-time-zone="Europe/London"', 'data-start-month="12"', 'data-start-day="1"',
      'data-end-month="12"', 'data-end-day="25"', 'data-archive-month="1"', 'data-archive-day="6"', 'data-preview="true"',
      'data-enabled="true"', 'data-day-count="25"', 'data-month-name="December"',
      'data-opens-text="The Advent calendar opens on 1&nbsp;December."',
    ]) assert.ok(out.includes(attribute), attribute);
  });

  test('the page as served (no JavaScript) is DATE-NEUTRAL: it says the calendar needs JavaScript and when it runs, never "opens on 1 December"', () => {
    assert.ok(out.includes('<p data-advent-calm-text>The Advent calendar needs JavaScript to open its doors. It runs from 1 to 25 December.</p>'));
    assert.ok(!/<p data-advent-calm-text>[^<]*opens on/.test(out));
    assert.ok(!out.includes('<noscript'), 'the served text already says it, so no separate noscript note');
    assert.ok(out.includes('data-opens-text="The Advent calendar opens on 1&nbsp;December."'), 'the script sets the date-specific sentence from this');
    assert.ok(!out.includes('comes round again'));
    assert.match(out, /<div class="advent-live" data-advent-live hidden>/);
  });

  test('ONE h2 for the whole calendar section (it moves between the calm and live parts), and the search skips it (data-search-skip), so the search finds one result', () => {
    assert.equal((out.match(/<h2/g) ?? []).length, 1);
    assert.match(out, /<div class="advent-calm" data-advent-calm>\s*<h2 data-advent-heading data-search-skip>Kington Parishes Advent calendar<\/h2>/);
    const live = out.slice(out.indexOf('data-advent-live'));
    assert.ok(!live.includes('<h2'));
  });

  test('an outline that cannot skip levels: h2 only, never an h1 or h3', () => {
    const levels = [...renderAdventToken('{{ADVENT}}', ctx).matchAll(/<h([1-6])/g)].map((m) => Number(m[1]));
    assert.ok(levels.length >= 1);
    assert.ok(levels.every((level) => level === 2), levels.join());
  });

  test('no inline script, no inline style attributes, no event handlers, no links', () => {
    assert.ok(!/<script/i.test(out));
    assert.ok(!/\sstyle\s*=/i.test(out));
    assert.ok(!/\son[a-z]+\s*=/i.test(out));
    assert.ok(!/<a\s/i.test(out));
    assert.ok(!/href\s*=/i.test(out));
  });

  test('carries nothing from the day content (no titles, no text)', () => {
    for (const day of content.days) {
      assert.ok(!out.includes(day.title), day.title);
      assert.ok(!out.includes(day.paragraphs[0].slice(0, 30)), day.title);
      assert.ok(!out.includes(day.ref));
    }
  });

  test('escapes dynamic strings and does not let braces or $ patterns through', () => {
    const hostile = { theme: { ...theme, siteName: 'Tom & "Jerry" <b>{{SITE_NAME}} $& $1 {{ADVENT}}', slug: 'x"y' } };
    const html = renderAdventToken(page, hostile);
    assert.ok(!html.includes('<b>'));
    assert.ok(!html.includes('{{'));
    assert.ok(!html.includes('}}'));
    assert.ok(!html.includes('x"y'));
    assert.ok(html.includes('Tom &amp; &quot;Jerry&quot; &lt;b&gt;&#123;&#123;SITE_NAME&#125;&#125; &#36;&amp; &#36;1 &#123;&#123;ADVENT&#125;&#125;'));
    assert.equal(html.match(/<section/g).length, 1);
  });

  test('later token passes cannot expand anything out of the output', () => {
    const hostile = { theme: { ...theme, siteName: 'Hall {{PHONE_DISPLAY}}' } };
    const html = renderAdventToken('{{ADVENT}}', hostile);
    assert.ok(!/\{\{[A-Z_:]+\}\}/.test(html));
  });

  test('refuses numbers that are not whole numbers', () => {
    assert.throws(() => renderAdventToken('{{ADVENT}}', { theme: { ...theme, season: { ...theme.season, start: { month: '12"', day: 1 } } } }), /season/);
  });

  test('adventEnabled false and previewEnabled false are carried as data', () => {
    const html = renderAdventToken('{{ADVENT}}', { theme: { ...theme, adventEnabled: false, previewEnabled: false } });
    assert.ok(html.includes('data-enabled="false"'));
    assert.ok(html.includes('data-preview="false"'));
  });

  test('a season with no archive period leaves the archive attributes out', () => {
    const html = renderAdventToken('{{ADVENT}}', { theme: { ...theme, season: { ...theme.season, archiveUntil: null } } });
    assert.ok(!html.includes('data-archive'));
  });
});

describe('adventPageEntry: listing follows theme.publicListing', () => {
  test('hidden while publicListing is false: noindex, not indexable, not searchable', () => {
    const entry = adventPageEntry(withTheme((t) => { t.publicListing = false; }));
    assert.equal(entry.slug, 'advent');
    assert.equal(entry.robots, 'noindex, nofollow');
    assert.equal(isIndexable(entry), false);
    assert.equal(isSearchablePage(entry), false);
  });

  test('listed automatically, with the noindex removed, when publicListing is true', () => {
    const entry = adventPageEntry(withTheme((t) => { t.publicListing = true; }));
    assert.ok(!('robots' in entry));
    assert.equal(isIndexable(entry), true);
    assert.equal(isSearchablePage(entry), true);
  });

  test('uses the site name, escaped, and loads the three assets through plain paths (the build adds ?v=)', () => {
    const entry = adventPageEntry(withTheme((t) => { t.siteName = "St Mary's Hall"; }));
    assert.equal(entry.title, "Advent calendar \u2014 St Mary&#39;s Hall");
    assert.equal(entry.description, 'Open a new door each day from 1 to 25 December to read the Christmas story, from Genesis to Bethlehem.');
    assert.ok(entry.headHtml.includes('href="/css/advent-theme.css"'));
    assert.ok(entry.headHtml.includes('href="/css/advent.css"'));
    assert.ok(entry.headHtml.includes('<script type="module" src="/js/advent.js"></script>'));
    assert.ok(!entry.headHtml.includes('?v='));
  });

  test('refuses an invalid theme', () => {
    assert.throws(() => adventPageEntry(withTheme((t) => { t.siteName = '<x>'; })), /siteName/);
  });

  test('the real page declared in pages.config.mjs follows the real theme', async () => {
    const { PAGES } = await import('../src/pages.config.mjs');
    const declared = PAGES.find((p) => p.slug === theme.slug);
    assert.ok(declared, 'the advent page should be declared');
    assert.deepEqual(declared, adventPageEntry(realTheme)); // the real flags, whatever they are
    assert.ok(existsSync(new URL(`../src/pages/${theme.slug}.html`, import.meta.url)));
  });
});

describe('rewriteImports fails closed', () => {
  const known = { '../date.mjs': './advent/date.js?v=abc' };
  const okLine = "import { a } from '../date.mjs';\n";
  test('rewrites a plain static import of a known file', () => {
    assert.equal(rewriteImports(`${okLine}x();`, known, 'f'), "import { a } from './advent/date.js?v=abc';\nx();");
  });
  const BAD = {
    'an unknown file': "import { a } from '../other.mjs';\n",
    'a bare import': `${okLine}import './x.js';\n`,
    'a dynamic import': `${okLine}const m = import('./x.js');\n`,
    'a dynamic import with a space': `${okLine}const m = import ('./x.js');\n`,
    'import.meta': `${okLine}const u = import.meta.url;\n`,
    'the word in a comment': `${okLine}// we import { b } from '../date.mjs' here\n`,
    'the word in a block comment': `${okLine}/* import('x') */\n`,
    'a re-export': `${okLine}export { a } from '../date.mjs';\n`,
    'a star re-export': `${okLine}export * from '../date.mjs';\n`,
    'an import hidden after code on one line': `${okLine}x(); import { b } from '../date.mjs';\n`,
    'a default import': "import a from '../date.mjs';\n",
    'a missing expected import': 'x();\n',
  };
  for (const [name, text] of Object.entries(BAD)) {
    test(`refuses ${name}`, () => assert.throws(() => rewriteImports(text, known, 'f')));
  }
  test('the real client files only ever pass', () => {
    assert.doesNotThrow(() => run());
  });
});

describe('slugs that Windows treats as devices', () => {
  for (const name of ['con', 'prn', 'aux', 'nul', 'com1', 'com9', 'lpt1', 'lpt9']) {
    test(`refuses "${name}" as the calendar page name`, () => {
      assert.throws(() => validateTheme(withTheme((t) => { t.slug = name; })), /"slug"/);
    });
  }
  test('does not refuse look-alikes', () => {
    for (const name of ['console', 'com10', 'lpt0', 'com', 'auxiliary']) {
      assert.doesNotThrow(() => validateTheme(withTheme((t) => { t.slug = name; })), name);
    }
  });
});
