// Checks on what the build actually wrote into public/ (run `npm run build` first; the pre-commit hook does).
// The calendar must be invisible to the public while theme.publicListing is false.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { theme } from '../modules/advent/theme.mjs';
import { content } from '../modules/advent/content.mjs';
const realBonus = content.bonus;

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const read = (path) => readFileSync(join(PUBLIC, path), 'utf8');
const htmlFiles = readdirSync(PUBLIC).filter((name) => name.endsWith('.html'));
const calendarFile = `${theme.slug}.html`;
const isHelp = (name) => name === 'help.html' || name.startsWith('help-');
// The calendar page itself, the hidden help guide and the unlinked changelog are the only places that may say anything.
const mayMention = (name) => name === calendarFile || isHelp(name) || name === 'updates.html';

describe('the built calendar page', () => {
  const page = read(calendarFile);

  test('is noindex while publicListing is false, and has no robots tag once it is true', () => {
    if (theme.publicListing) assert.ok(!/<meta name="robots"/.test(page));
    else assert.match(page, /<meta name="robots" content="noindex, nofollow">/);
  });

  test('is in the sitemap and the search index exactly when publicListing is true', () => {
    assert.equal(read('sitemap.xml').includes(theme.slug + '.html'), theme.publicListing);
    const entries = JSON.parse(read('search-index.json'));
    assert.ok(entries.length > 0);
    assert.equal(entries.some((entry) => entry.page === calendarFile), theme.publicListing);
  });

  test('says only the calm message: no door contents, no day titles, no day text', () => {
    assert.ok(page.includes('The Advent calendar opens on 1&nbsp;December.'));
    assert.ok(!page.includes('comes round again'));
    for (const day of content.days) {
      assert.ok(!page.includes(day.title), day.title);
      assert.ok(!page.includes(day.paragraphs[0].slice(0, 40)), day.title);
    }
    const calendar = page.slice(page.indexOf('<section class="advent"'), page.indexOf('</section>', page.indexOf('<section class="advent"')));
    assert.ok(calendar.length > 100);
    // The only button is the "Open today's door" one, and it starts hidden. The doors, dialog and every text come from the script.
    assert.equal((calendar.match(/<button/g) ?? []).length, 1);
    assert.match(calendar, /<button type="button" class="advent-pill" data-advent-primary hidden>/);
    assert.ok(!/<li|<dialog|<img/.test(calendar));
  });

  test('has no inline script or style attributes of its own, and loads its three files with content hashes', () => {
    const main = page.slice(page.indexOf('<main'), page.indexOf('</main>'));
    assert.ok(!/<script/.test(main));
    assert.ok(!/\sstyle=/.test(main));
    assert.match(page, /href="\/css\/advent-theme\.css\?v=[0-9a-f]{10}"/);
    assert.match(page, /href="\/css\/advent\.css\?v=[0-9a-f]{10}"/);
    assert.match(page, /<script type="module" src="\/js\/advent\.js\?v=[0-9a-f]{10}"><\/script>/);
  });

  test('its headings got anchor ids and the outline starts at h1 then only h2', () => {
    const headings = [...page.matchAll(/<h([1-6])([^>]*)>/g)].filter((m) => !/class="(?:site-search|footer)/.test(m[2]));
    assert.ok(headings.length >= 3);
    assert.ok(headings.every((m) => /\sid="[a-z0-9-]+"/.test(m[2])), 'every heading should have an id');
    const levels = headings.map((m) => Number(m[1]));
    assert.equal(levels[0], 1);
    assert.ok(levels.every((l) => l <= 2));
  });
});

describe('nothing else on the public site points at the calendar', () => {
  test('no built page other than the calendar, the help guide and the changelog mentions the preview switch or links to the calendar', () => {
    const link = new RegExp(`href="/?${theme.slug}(?:\.html)?(?:[?#"])`);
    for (const name of htmlFiles.filter((n) => !mayMention(n))) {
      const text = read(name);
      assert.ok(!text.includes('advent-preview'), `${name} mentions the preview switch`);
      assert.ok(!link.test(text), `${name} links to the calendar`);
    }
  });

  test('no page other than the calendar and the changelog contains a day title', () => {
    for (const name of htmlFiles.filter((n) => n !== calendarFile && n !== 'updates.html')) {
      const text = read(name);
      for (const day of content.days) assert.ok(!text.includes(day.title), `${name} contains "${day.title}"`);
    }
    // The calendar page itself is checked too, in its own describe above.
  });

  test('no shared script, stylesheet or data file mentions the calendar page (header, footer, search, nav)', () => {
    for (const path of ['js/main.js', 'js/search-ui.js', 'js/search-match.js', 'css/style.css', 'robots.txt']) {
      assert.ok(!/advent/i.test(read(path)), `${path} mentions advent`);
    }
  });

  test('robots.txt never mentions it, and the sitemap does not while the calendar is hidden', () => {
    assert.ok(!/advent/i.test(read('robots.txt')));
    if (!theme.publicListing) assert.ok(!/advent/i.test(read('sitemap.xml')));
  });
});

describe('generated files', () => {
  test('the bonus day file exists, carries the real bonus text, and has no art key until day-26.svg exists', () => {
    assert.ok(realBonus, 'content.mjs has a bonus day');
    const day = JSON.parse(read('advent/day-26.json'));
    assert.equal(day.day, 26);
    assert.equal(day.title, realBonus.title);
    assert.deepEqual(day.paragraphs, realBonus.paragraphs);
    assert.equal('art' in day, existsSync(join(PUBLIC, 'advent', 'art', 'day-26.svg')));
  });

  test('the calendar page markup carries the bonus door settings (6 January, Epiphany)', () => {
    const page = read(calendarFile);
    assert.match(page, /data-bonus-month="1" data-bonus-day="6" data-bonus-label="Epiphany"/);
  });

  test('25 day files exist and no picture folder entry is claimed that does not exist', () => {
    for (let n = 1; n <= 25; n += 1) {
      const name = `day-${String(n).padStart(2, '0')}`;
      const day = JSON.parse(read(`advent/${name}.json`));
      assert.equal(day.day, n);
      assert.equal('art' in day, existsSync(join(PUBLIC, 'advent', 'art', `${name}.svg`)));
    }
  });

  test('every generated file starts with the AUTO-GENERATED banner (JSON excepted)', () => {
    for (const path of ['css/advent-theme.css', 'css/advent.css', 'js/advent.js', 'js/advent/date.js', 'js/advent/preview.js']) {
      assert.match(read(path).slice(0, 40), /AUTO-GENERATED/, path);
    }
  });

  test('the /advent/art/* header rule only tightens: one added Content-Security-Policy, the site rule untouched', () => {
    const headers = read('_headers');
    const blocks = headers.split(/\n(?=\S)/).filter((b) => !b.startsWith('#') || b.includes('\n/'));
    assert.match(headers, /^\/advent\/art\/\*\n {2}Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox$/m);
    assert.match(headers, /^\/\*\n {2}Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-4RwqUYD4JP\/ewBt0bVqlJ2A4I4YwLluTC3ZXzQNSUbs='; /);
    assert.ok(blocks.length >= 2);
  });
});

describe('public/_headers for the Advent files', () => {
  const headers = read('_headers');
  const lines = headers.split('\n');

  test('/advent/day-*.json gets exactly one header, X-Robots-Tag: noindex (and no Cache-Control)', () => {
    const at = lines.indexOf('/advent/day-*.json');
    assert.ok(at > 0, 'the rule should exist');
    assert.equal(lines[at + 1], '  X-Robots-Tag: noindex');
    assert.ok(lines[at + 2] === undefined || lines[at + 2] === '', 'nothing else in the rule');
    assert.ok(lines[at - 1].startsWith('#'), 'a comment line comes first');
    // (The only Cache-Control rules are the immutable ones for hashed scripts and stylesheets, tested below.)
  });

  test('every rule in the file is well formed: a path at the left edge, then two-space-indented Name: value lines, no tabs', () => {
    assert.ok(!headers.includes('\t'));
    assert.ok(!headers.includes('\r'));
    let inRule = false;
    for (const line of lines) {
      if (line === '' || line.startsWith('#')) { inRule = false; continue; }
      if (!line.startsWith(' ')) { assert.match(line, /^\/\S*$/, line); inRule = true; continue; }
      assert.ok(inRule, `header line outside a rule: ${line}`);
      assert.match(line, /^ {2}[A-Za-z][A-Za-z-]*: \S.*$/, line);
    }
    assert.ok(headers.endsWith('\n'));
  });
});

describe('the scene picture and its header', () => {
  const headers = read('_headers');
  const lines = headers.split('\n');

  test('/advent/scene*.svg gets exactly the same locked-down Content-Security-Policy as the day pictures (tighten only)', () => {
    const at = lines.indexOf('/advent/scene*.svg');
    assert.ok(at > 0, 'the rule should exist');
    assert.equal(lines[at + 1], "  Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox");
    assert.ok(lines[at + 2] === undefined || lines[at + 2] === '', 'nothing else in the rule');
    assert.ok(lines[at - 1].startsWith('#'), 'a comment line comes first');
  });

  test('the site scene named by the theme exists in public/advent/, and the only svg files there are that scene (pictures live in art/)', () => {
    if (!theme.scene) return;
    const names = readdirSync(join(PUBLIC, 'advent')).filter((name) => name.endsWith('.svg'));
    assert.deepEqual(names, [theme.scene]);
  });
});

// Greg accepted a source-only mention of the calendar in the home page while the calendar is hidden (the banner
// has to exist in the page for the preview demo). This test documents EXACTLY what the home page may contain, so
// nothing else can creep in: one empty hidden container and one script tag, nothing visible, nothing searchable.
describe('the home page and the (hidden) Advent banner', () => {
  const home = read('index.html');
  const container = /<div class="advent-teaser" data-advent-teaser [^>]*hidden><\/div>/;
  const script = /<script type="module" src="\/js\/advent-teaser\.js\?v=[0-9a-f]{10}"><\/script>/;

  test('contains exactly one empty hidden container and exactly one banner script tag', () => {
    assert.equal(home.match(new RegExp(container.source, 'g')).length, 1);
    assert.equal(home.match(new RegExp(script.source, 'g')).length, 1);
  });

  test('the container has no text, no child element and no link; it carries only data attributes', () => {
    const tag = container.exec(home)[0];
    assert.ok(!/>[^<]/.test(tag.slice(0, -'</div>'.length).replace(/^<div[^>]*>/, '')), 'nothing between the tags');
    assert.ok(!/href=|src=|<a\s|<img/.test(tag));
    const names = [...tag.matchAll(/\s(data-[a-z-]+|class|hidden)(?==|\s|>)/g)].map((m) => m[1]);
    assert.ok(names.every((name) => name === 'class' || name === 'hidden' || name.startsWith('data-')), names.join());
  });

  test('apart from those two pieces the home page does not mention the calendar at all', () => {
    const rest = home.replace(container, '').replace(script, '');
    assert.ok(!/advent/i.test(rest.replace(/Advent Sunday/g, '')), 'the home page mentions the calendar somewhere else');
    assert.ok(!rest.includes('advent-preview'));
  });

  test('the banner container and script never appear as visible text, in the search index or in the sitemap', () => {
    const entries = JSON.parse(read('search-index.json'));
    for (const entry of entries.filter((e) => e.page === 'index.html')) {
      assert.ok(!/advent/i.test(JSON.stringify(entry).replace(/Advent Sunday/g, '')), JSON.stringify(entry).slice(0, 80));
    }
    if (!theme.publicListing) assert.ok(!/advent/i.test(read('sitemap.xml')));
    assert.ok(!/<noscript>[^<]*advent/i.test(home));
  });

  test('the container carries the two stylesheet addresses (hashed) but the page itself loads no calendar stylesheet', () => {
    assert.match(container.exec(home)[0], /data-theme-css="\/css\/advent-theme\.css\?v=[0-9a-f]{10}"/);
    assert.ok(!/<link[^>]*advent/i.test(home));
  });

  test('no other built page except the calendar, the help guide and the changelog carries the banner token output', () => {
    for (const name of htmlFiles.filter((n) => n !== 'index.html' && !mayMention(n))) {
      assert.ok(!read(name).includes('data-advent-teaser'), name);
    }
  });
});

// Long-lived caching (public/_headers) is only safe for files that are ALWAYS fetched under a content-hash address.
describe('the hashed Advent assets and their immutable cache rule', () => {
  const HASHED = /[?]v=[0-9a-f]{10}$/;
  const IMMUTABLE_PATHS = ['/js/advent*.js', '/css/advent*.css']; // the first also matches /js/advent/date.js and the other copies
  const adventAsset = /^\/(?:js\/advent|css\/advent)/;

  test('every reference to an Advent script or stylesheet, in every built page, carries ?v=<hash>', () => {
    let found = 0;
    for (const name of htmlFiles) {
      const html = read(name);
      for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
        if (!adventAsset.test(match[1].split('?')[0])) continue;
        found += 1;
        assert.match(match[1], HASHED, `${name}: ${match[1]}`);
      }
      for (const match of html.matchAll(/data-(?:theme|teaser)-css="([^"]+)"/g)) {
        found += 1;
        assert.match(match[1], HASHED, `${name}: ${match[1]}`);
      }
    }
    assert.ok(found >= 6, 'expected to check the calendar page and the home page references');
  });

  test('every import in the built Advent scripts carries ?v=<hash>', () => {
    const scripts = ['js/advent.js', 'js/advent-teaser.js', ...readdirSync(join(PUBLIC, 'js', 'advent')).map((n) => `js/advent/${n}`)];
    let imports = 0;
    for (const path of scripts) {
      for (const match of read(path).matchAll(/^import\s*\{[^}]*\}\s*from\s*'([^']+)';$/gm)) {
        imports += 1;
        assert.match(match[1], HASHED, `${path}: ${match[1]}`);
      }
    }
    assert.ok(imports >= 8);
  });

  // The built scripts and stylesheets the rules must cover: exactly these, each by its exact path.
  const builtAssets = () => [
    ...readdirSync(join(PUBLIC, 'js')).filter((n) => /^advent.*[.]js$/.test(n)).map((n) => `/js/${n}`),
    ...readdirSync(join(PUBLIC, 'js', 'advent')).map((n) => `/js/advent/${n}`),
    ...readdirSync(join(PUBLIC, 'css')).filter((n) => /^advent.*[.]css$/.test(n)).map((n) => `/css/${n}`),
  ].sort();

  test('every built Advent script and stylesheet has its own EXACT immutable rule: no wildcard, none for a file that does not exist, exactly one per file', () => {
    const lines = read('_headers').split('\n');
    const cacheLines = lines.map((line, index) => [line, index]).filter(([line]) => /^\s+cache-control:/i.test(line));
    const paths = [];
    for (const [line, index] of cacheLines) {
      assert.equal(line, '  Cache-Control: public, max-age=31536000, immutable');
      const path = lines[index - 1];
      assert.ok(!path.includes('*'), `a wildcard cache rule: ${path}`);
      assert.ok(existsSync(join(PUBLIC, path)), `${path} has a cache rule but the file does not exist`);
      assert.ok(lines[index + 1] === undefined || lines[index + 1] === '', 'nothing else in the rule');
      paths.push(path);
    }
    assert.equal(new Set(paths).size, paths.length, 'a path has two cache rules');
    assert.deepEqual(paths.slice().sort(), builtAssets());
    assert.ok(paths.length >= 9);
    for (const risky of ['/advent/day-*.json', '/advent/scene*.svg', '/advent/art/*', '/*']) {
      const at = lines.indexOf(risky);
      assert.ok(at >= 0);
      assert.ok(!/cache-control/i.test(lines[at + 1] ?? ''), `${risky} must keep revalidating`);
    }
  });

  test('every file those paths match is a generated, hashed one (nothing hand-made or unhashed can be cached for a year)', () => {
    const matched = ['js/advent.js', 'js/advent-teaser.js', ...readdirSync(join(PUBLIC, 'js', 'advent')).map((n) => `js/advent/${n}`), 'css/advent.css', 'css/advent-teaser.css', 'css/advent-theme.css'];
    for (const path of matched) assert.match(read(path).slice(0, 60), /AUTO-GENERATED/, path);
    assert.deepEqual(readdirSync(join(PUBLIC, 'css')).filter((n) => /^advent/.test(n)).sort(), ['advent-teaser.css', 'advent-theme.css', 'advent.css']);
    assert.deepEqual(readdirSync(join(PUBLIC, 'js')).filter((n) => /^advent/.test(n) && n.endsWith('.js')).sort(), ['advent-teaser.js', 'advent.js']);
  });
});
