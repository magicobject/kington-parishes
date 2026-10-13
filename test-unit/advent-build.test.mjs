// Unit tests for modules/advent/build.mjs (phase 2): validation, generated files,
// the SVG lint, art checks, the {{ADVENT}} token and the page entry.
// Everything builds into a temporary folder; nothing here touches public/.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildAdvent, renderAdventToken, lintSvg, artFilePath, validateDayFile, adventPageEntry,
} from '../modules/advent/build.mjs';
import { validateTheme } from '../modules/advent/schema.mjs';
import { theme } from '../modules/advent/theme.mjs';
import { content } from '../modules/advent/content.mjs';
import { isIndexable, isSearchablePage } from '../scripts/build-search-index.mjs';

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
    assert.deepEqual(Object.keys(day1), ['day', 'title', 'ref', 'paragraphs', 'wonder', 'activity', 'prayer', 'alt', 'hidden', 'translation', 'credit']);
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

  test('a day without a hidden detail has no hidden key', () => {
    const noHidden = withContent((c) => { delete c.days[4].hidden; });
    const { publicDir: dir } = run({ content: noHidden });
    assert.ok(!('hidden' in JSON.parse(readFileSync(join(dir, 'advent', 'day-05.json'), 'utf8'))));
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

describe('lintSvg', () => {
  test('accepts a clean picture, including internal #links and url(#fragment)', () => {
    assert.deepEqual(lintSvg(GOOD_SVG), []);
  });

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
    'not an svg': 'hello',
    empty: '',
    'too big': `<svg>${'a'.repeat(100 * 1024)}</svg>`,
  };
  for (const [name, sample] of Object.entries(HOSTILE)) {
    test(`rejects: ${name}`, () => {
      assert.ok(lintSvg(sample).length > 0, name);
    });
  }

  test('rejects a non-string', () => {
    assert.ok(lintSvg(null).length > 0);
    assert.ok(lintSvg(42).length > 0);
  });

  test('allows a picture just under the size cap', () => {
    const body = 'a'.repeat(100 * 1024 - 40);
    assert.deepEqual(lintSvg(`<svg><desc>${body}</desc></svg>`), []);
  });
});

describe('art checks', () => {
  test('artFilePath stays inside the art folder', () => {
    const dir = tempPublic();
    assert.ok(artFilePath(dir, 'day-01.svg').startsWith(dir));
    for (const bad of ['../day-01.svg', '..\\day-01.svg', '/etc/passwd', 'a/b.svg', 'day-01.svg/..', 'DAY-01.svg', '']) {
      assert.throws(() => artFilePath(dir, bad), /art/, bad);
    }
  });

  test('artRequired false: missing pictures are allowed', () => {
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

  test('a hostile picture is refused whether art is required or not', () => {
    for (const required of [true, false]) {
      const dir = tempPublic();
      writeAllArt(dir);
      writeFileSync(join(dir, 'advent', 'art', 'day-04.svg'), '<svg><script>x</script></svg>');
      assert.throws(() => run({ publicDir: dir, theme: withTheme((t) => { t.artRequired = required; }) }), /day-04\.svg/);
    }
  });

  test('a hostile svg that no day names is also refused', () => {
    const dir = tempPublic();
    mkdirSync(join(dir, 'advent', 'art'), { recursive: true });
    writeFileSync(join(dir, 'advent', 'art', 'stray.svg'), '<svg onload="x()"></svg>');
    assert.throws(() => run({ publicDir: dir }), /stray\.svg/);
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
      'data-opens-text="Advent opens on 1 December."', 'data-again-text="Advent comes round again on 1 December."',
    ]) assert.ok(out.includes(attribute), attribute);
  });

  test('shows the calm message by default, with a hidden region and a noscript note', () => {
    assert.match(out, /<div class="advent-calm" data-advent-calm>[\s\S]*Advent opens on 1 December\./);
    assert.match(out, /<div class="advent-live" data-advent-live hidden>/);
    assert.match(out, /<noscript><p>[^<]*JavaScript[^<]*<\/p><\/noscript>/);
    assert.ok(out.includes('Kington Parishes Advent calendar'));
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
    assert.equal(entry.title, "Advent — St Mary&#39;s Hall");
    assert.ok(entry.description.includes('St Mary&#39;s Hall'));
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
    assert.deepEqual(declared, adventPageEntry(theme));
    assert.ok(existsSync(new URL(`../src/pages/${theme.slug}.html`, import.meta.url)));
  });
});
