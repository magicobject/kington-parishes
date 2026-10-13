// Checks on what the build actually wrote into public/ (run `npm run build` first; the pre-commit hook does).
// The calendar must be invisible to the public while theme.publicListing is false.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { theme } from '../modules/advent/theme.mjs';
import { content } from '../modules/advent/content.mjs';

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
    assert.ok(!/<button|<li/.test(calendar));
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
    assert.ok(!/cache-control/i.test(headers));
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
