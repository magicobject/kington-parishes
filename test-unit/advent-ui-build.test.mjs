// Build-side pieces of the real calendar (phase 3): the extra client files, the scene picture, the markup the
// {{ADVENT}} token writes for the live calendar, and the {{ADVENT_TEASER}} token for the home-page banner.
// Everything builds into a temporary folder; nothing here touches public/.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildAdvent, renderAdventToken, renderAdventTeaserToken, lintSvg, svgDrawWeight } from '../modules/advent/build.mjs';
import { validateTheme, sceneNameIsSafe } from '../modules/advent/schema.mjs';
import { theme as realTheme } from '../modules/advent/theme.mjs';
import { pinFlags } from './support/fixture-flags.mjs';
const theme = pinFlags(realTheme);
import { content } from '../modules/advent/content.mjs';

const dirs = [];
after(() => { for (const dir of dirs) rmSync(dir, { recursive: true, force: true }); });
const tempPublic = () => { const dir = mkdtempSync(join(tmpdir(), 'advent-ui-')); dirs.push(dir); return dir; };
// The real theme names its own scene file, so a default run needs that file in the folder it builds into.
const run = (options = {}) => {
  const publicDir = options.publicDir ?? tempPublic();
  if (!options.publicDir && !options.theme) {
    mkdirSync(join(publicDir, 'advent'), { recursive: true });
    writeFileSync(join(publicDir, 'advent', 'scene.svg'), GOOD_SCENE);
  }
  const result = buildAdvent({ theme, content, publicDir, siteUrl: 'https://example.test', pageNames: ['index'], ...options });
  return { publicDir, result };
};
const GOOD_SCENE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 130" aria-hidden="true" focusable="false"><path d="M0 95C60 70 110 60 170 78S270 100 330 66 440 40 500 70 570 80 600 62V130H0z" fill="#0d161e"/></svg>';
const withTheme = (mutate) => { const copy = structuredClone(theme); mutate(copy); return copy; };

describe('the extra client files are copied with banners and hashed imports', () => {
  const { publicDir } = run();
  const read = (path) => readFileSync(join(publicDir, path), 'utf8');

  test('day.js, logic.js, advent-teaser.js and advent-teaser.css exist with the AUTO-GENERATED banner', () => {
    for (const path of ['js/advent/day.js', 'js/advent/logic.js', 'js/advent-teaser.js', 'css/advent-teaser.css']) {
      assert.match(read(path).slice(0, 40), /AUTO-GENERATED/, path);
    }
  });

  test('day.js is the very same code as day.mjs (one source of truth for the day rules)', () => {
    const body = (text) => text.split('\n').slice(3).join('\n');
    assert.equal(body(read('js/advent/day.js')), readFileSync(new URL('../modules/advent/day.mjs', import.meta.url), 'utf8'));
  });

  test('logic.js imports hashed copies of date.js and day.js; the page script and the banner script import the three they need', () => {
    const imports = (path) => [...read(path).matchAll(/^import\s*\{[^}]*\}\s*from\s*'([^']+)';$/gm)].map((m) => m[1].replace(/[0-9a-f]{10}$/, 'HASH'));
    assert.deepEqual(imports('js/advent/logic.js'), ['./date.js?v=HASH', './day.js?v=HASH']);
    assert.deepEqual(imports('js/advent.js'), ['./advent/date.js?v=HASH', './advent/preview.js?v=HASH', './advent/logic.js?v=HASH']);
    assert.deepEqual(imports('js/advent-teaser.js'), ['./advent/date.js?v=HASH', './advent/preview.js?v=HASH', './advent/logic.js?v=HASH']);
    for (const path of ['js/advent/logic.js', 'js/advent.js', 'js/advent-teaser.js']) assert.ok(!read(path).includes('../'), path);
  });

  test('a changed day.mjs changes the hash in logic.js, and so the hash of the scripts that import logic.js', () => {
    const importHash = (text, name) => new RegExp(`${name}\\.js\\?v=([0-9a-f]{10})`).exec(text)[1];
    const before = { logic: importHash(read('js/advent.js'), 'logic'), day: importHash(read('js/advent/logic.js'), 'day') };
    assert.match(before.logic, /^[0-9a-f]{10}$/);
    assert.match(before.day, /^[0-9a-f]{10}$/);
  });
});

describe('the scene picture', () => {
  test('with no scene in the theme, the module writes its plain hills scene, linted, with a banner', () => {
    const { publicDir, result } = run({ theme: withTheme((t) => { t.scene = null; }) });
    const text = readFileSync(join(publicDir, 'advent', 'scene-default.svg'), 'utf8');
    assert.match(text, /AUTO-GENERATED/);
    assert.deepEqual(lintSvg(text), []);
    assert.ok(result.files.includes('advent/scene-default.svg'));
    assert.equal(result.tokenContext.sceneUrl, '/advent/scene-default.svg');
    assert.ok(!/<text|<script|href=|\sstyle=/i.test(text));
  });

  test('with a scene named in the theme, that file in public/advent/ is used, linted, and the default is not written', () => {
    const publicDir = tempPublic();
    mkdirSync(join(publicDir, 'advent'), { recursive: true });
    writeFileSync(join(publicDir, 'advent', 'scene.svg'), GOOD_SCENE);
    const { result } = run({ publicDir, theme: withTheme((t) => { t.scene = 'scene.svg'; }) });
    assert.equal(result.tokenContext.sceneUrl, '/advent/scene.svg');
    assert.equal(existsSync(join(publicDir, 'advent', 'scene-default.svg')), false);
  });

  test('refuses a named scene that is missing, hostile, a link or too big', () => {
    const named = withTheme((t) => { t.scene = 'scene.svg'; });
    assert.throws(() => run({ theme: named }), /scene/);
    const publicDir = tempPublic();
    mkdirSync(join(publicDir, 'advent'), { recursive: true });
    writeFileSync(join(publicDir, 'advent', 'scene.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    assert.throws(() => run({ publicDir, theme: named }), /scene/);
    writeFileSync(join(publicDir, 'advent', 'scene.svg'), `${GOOD_SCENE.slice(0, -6)}<desc>${'a'.repeat(101 * 1024)}</desc></svg>`);
    assert.throws(() => run({ publicDir, theme: named }), /scene/);
  });

  test('the theme rule: null or a plain scene*.svg name that cannot be mistaken for a day picture', () => {
    for (const good of ['scene.svg', 'scene-night.svg', 'scene-2.svg']) assert.ok(sceneNameIsSafe(good), good);
    for (const bad of ['day-01.svg', 'day-26.svg', '../scene.svg', 'a/scene.svg', 'Scene.svg', 'scene.png', 'sceneX.svg', 'hills.svg', 'scene.svg.svg', '', null, 5, 'scene.svg ']) {
      assert.equal(sceneNameIsSafe(bad), false, String(bad));
    }
    assert.doesNotThrow(() => validateTheme(withTheme((t) => { t.scene = null; })));
    assert.doesNotThrow(() => validateTheme(withTheme((t) => { t.scene = 'scene.svg'; })));
    assert.throws(() => validateTheme(withTheme((t) => { t.scene = '../x.svg'; })), /scene/);
    assert.throws(() => validateTheme(withTheme((t) => { t.scene = 5; })), /scene/);
  });

  test('the module ships a default scene file that passes the picture check', () => {
    const text = readFileSync(new URL('../modules/advent/client/scene.svg', import.meta.url), 'utf8');
    assert.deepEqual(lintSvg(text), []);
  });

  test('the real site names its own scene, and that file passes the picture check', () => {
    assert.equal(theme.scene, 'scene.svg');
    const text = readFileSync(new URL('../public/advent/scene.svg', import.meta.url), 'utf8');
    assert.deepEqual(lintSvg(text), []);
    assert.ok(Buffer.byteLength(text) < 20 * 1024, 'the scene is small');
  });
});

describe('the calendar markup written by {{ADVENT}}', () => {
  const ctx = run().result.tokenContext;
  const out = renderAdventToken('{{ADVENT}}', ctx);

  test('has the live parts the script fills in: heading, status, primary button, doors, scene, notice', () => {
    for (const part of ['data-advent-heading', 'data-advent-status', 'data-advent-primary', 'data-advent-doors', 'data-advent-scene', 'data-advent-notice']) {
      assert.ok(out.includes(part), part);
    }
  });

  test('the preview notice is a polite live region', () => {
    assert.match(out, /<div class="advent-notice" data-advent-notice role="status" hidden>/);
  });

  test('the primary button is a real button and starts hidden', () => {
    assert.match(out, /<button type="button" class="advent-pill" data-advent-primary hidden>Open today&#39;s door<\/button>/);
  });

  test('there is no placeholder note any more', () => {
    assert.ok(!/placeholder/i.test(out));
    assert.ok(!out.includes('aria-describedby'));
  });

  test('carries the site name, the scene address and the settings as data attributes', () => {
    assert.ok(out.includes('data-site-name="Kington Parishes"'));
    assert.ok(out.includes(`data-scene="${ctx.sceneUrl}"`));
  });

  test('has no day content, no script, no style, no link, no event handler, and only h2 headings', () => {
    for (const day of content.days) assert.ok(!out.includes(day.title), day.title);
    assert.ok(!/<script|\sstyle\s*=|\son[a-z]+\s*=|<a\s|href\s*=|<img|<dialog/i.test(out));
    assert.ok([...out.matchAll(/<h([1-6])/g)].every((m) => m[1] === '2'));
  });

  test('a scene address that is not a plain /advent/*.svg path is never written', () => {
    const hostile = renderAdventToken('{{ADVENT}}', { ...ctx, sceneUrl: 'javascript:alert(1)' });
    assert.ok(!hostile.includes('javascript'));
    assert.ok(!hostile.includes('data-scene'));
  });
});

describe('the home-page banner token {{ADVENT_TEASER}}', () => {
  const ctx = run().result.tokenContext;
  const out = renderAdventTeaserToken('<p>before</p>\n{{ADVENT_TEASER}}\n<p>after</p>', ctx);

  test('leaves a page without the token alone', () => {
    assert.equal(renderAdventTeaserToken('<p>hello</p>', ctx), '<p>hello</p>');
  });

  test('writes one empty, hidden container, the early classic script and the banner module script; nothing else', () => {
    const middle = out.replace('<p>before</p>\n', '').replace('\n<p>after</p>', '');
    assert.match(middle, /^<div class="advent-teaser" data-advent-teaser [^>]*hidden><\/div>\n<script src="\/js\/advent-early\.js"><\/script>\n<script type="module" src="\/js\/advent-teaser\.js"><\/script>$/);
  });

  test('has no text, no heading, no link, no image, no button, no inline script or style, no event handler', () => {
    assert.ok(!/<h[1-6]|<a\s|<img|<button|<p\b[^>]*>[^<]|<style|\sstyle\s*=|\son[a-z]+\s*=/i.test(out.replace('<p>before</p>', '').replace('<p>after</p>', '')));
    const container = /<div class="advent-teaser"[^>]*><\/div>/.exec(out)[0];
    assert.ok(container.endsWith('hidden></div>'));
    assert.ok(!/>[^<]+</.test(container));
  });

  test('carries the settings, the site name, the scene and the two stylesheet addresses (with hashes) as data attributes', () => {
    assert.ok(out.includes('data-slug="advent"'));
    assert.ok(out.includes('data-site-name="Kington Parishes"'));
    assert.ok(out.includes(`data-scene="${ctx.sceneUrl}"`));
    assert.match(out, /data-theme-css="\/css\/advent-theme\.css\?v=[0-9a-f]{10}"/);
    assert.match(out, /data-teaser-css="\/css\/advent-teaser\.css\?v=[0-9a-f]{10}"/);
  });

  test('never contains day content or a link to the calendar', () => {
    for (const day of content.days) assert.ok(!out.includes(day.title), day.title);
    assert.ok(!/href=/i.test(out));
    assert.ok(!out.includes('advent-preview'));
    assert.ok(!out.includes('.html'));
  });

  test('escapes the site name and lets no braces or $ through', () => {
    const hostile = renderAdventTeaserToken('{{ADVENT_TEASER}}', { ...ctx, theme: { ...ctx.theme, siteName: 'A "B" <i>{{X}}</i> $&' } });
    assert.ok(!hostile.includes('<i>'));
    assert.ok(!hostile.includes('{{'));
    assert.ok(hostile.includes('&quot;B&quot; &lt;i&gt;&#123;&#123;X&#125;&#125;&lt;/i&gt; &#36;&amp;'));
  });

  test('the token is not confused with {{ADVENT}} (a page with only the teaser token is untouched by renderAdventToken)', () => {
    assert.equal(renderAdventToken('{{ADVENT_TEASER}}', ctx), '{{ADVENT_TEASER}}');
  });
});

describe('the calendar in the site search (as it will be once publicListing is true)', () => {
  test('the calendar section yields exactly ONE search entry with a unique id, and no entry sits in a hidden block', async () => {
    const { ensureSectionIds, extractSearchEntries } = await import('../scripts/build-search-index.mjs');
    const ctx = run().result.tokenContext;
    const page = `<main><div class="page-header"><h1>Advent</h1></div><section>${renderAdventToken('{{ADVENT}}', ctx)}</section></main>`;
    const entries = extractSearchEntries(ensureSectionIds(page), { slug: 'advent', title: 'Advent', description: 'x' });
    // Searching "advent" must give ONE result for the page (the tester's finding S3 was two: the h1 and this section's h2). The
    // section's h2 carries data-search-skip, so only the page's own h1 entry remains.
    const calendar = entries.filter((entry) => /advent/i.test(entry.heading ?? entry.title ?? ''));
    assert.equal(calendar.length, 1, JSON.stringify(entries.map((e) => e.heading ?? e.title)));
    assert.equal(calendar[0].heading ?? calendar[0].title, 'Advent');
    assert.equal(new Set(entries.map((entry) => entry.href ?? entry.id ?? entry.anchor)).size, entries.length, 'every entry has its own address');
  });
});

describe('the scene picture has a sprinkling of tiny stars', () => {
  const text = readFileSync(new URL('../public/advent/scene.svg', import.meta.url), 'utf8');
  const dots = [...text.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)" fill="#F2E6C4" fill-opacity="([\d.]+)"\/>/g)].map((m) => m.slice(1).map(Number));

  test('14 to 18 cream dots, radius 0.6 to 1.6, fill-opacity 0.35 to 0.9, never an opacity attribute (static, aria-hidden as before)', () => {
    assert.ok(dots.length >= 14 && dots.length <= 18, `${dots.length} dots`);
    for (const [, , r, opacity] of dots) {
      assert.ok(r >= 0.6 && r <= 1.6, `radius ${r}`);
      assert.ok(opacity >= 0.35 && opacity <= 0.9, `fill-opacity ${opacity}`);
    }
    assert.ok(new Set(dots.map((d) => d[2])).size >= 4, 'varied radii');
    assert.ok(new Set(dots.map((d) => d[3])).size >= 4, 'varied opacities');
    assert.ok(!/<circle[^>]* opacity=/.test(text), 'the dots use fill-opacity, never an opacity attribute');
    assert.match(text, /aria-hidden="true"/);
  });

  test('the stars are in the upper sky (y 3 to 38 of 130) and clear of the star the page puts over the ridge (top right corner)', () => {
    for (const [x, y] of dots) {
      assert.ok(y >= 3 && y <= 38, `y ${y}`);
      assert.ok(!(x > 530 && y < 32), `a dot at ${x},${y} sits where the page star goes`);
      assert.ok(x >= 2 && x <= 598);
    }
  });

  test('the scene stays small and passes the picture check and a low draw weight', () => {
    assert.deepEqual(lintSvg(text), []);
    assert.ok(Buffer.byteLength(text) < 4096);
    assert.ok(svgDrawWeight(text) < 80, `weight ${svgDrawWeight(text)}`);
  });
});

describe('the print stylesheet starts a printed day at the top of the page', () => {
  const css = readFileSync(new URL('../modules/advent/client/advent.css', import.meta.url), 'utf8');
  const printBlock = css.slice(css.indexOf('@media print'));

  test('the open dialog is un-centred in print: no margin, no inset, auto height, so there is no blank gap above the day (tester N4)', () => {
    const rule = /\.advent \.advent-dialog\[open\] \{([^}]*)\}/.exec(printBlock)[1];
    for (const declaration of ['position: static', 'margin: 0', 'inset: auto', 'height: auto']) assert.ok(rule.includes(declaration), declaration);
  });
});
