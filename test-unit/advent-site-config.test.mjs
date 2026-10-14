// The adoption contract's first line of defence: the site-owned files live in src/advent/, the module ships NEUTRAL templates in
// modules/advent/examples/, and the build refuses to run on a missing or still-placeholder file.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sameData, placeholderProblems } from '../modules/advent/site-config.mjs';
import { loadAdventConfig } from '../scripts/advent-config.mjs';
import { validateContent, validateTheme } from '../modules/advent/schema.mjs';
import { buildAdvent, adventPageEntry } from '../modules/advent/build.mjs';
import { theme as exampleTheme } from '../modules/advent/examples/theme.mjs';
import { content as exampleContent } from '../modules/advent/examples/content.mjs';
import { theme as siteTheme } from '../src/advent/theme.mjs';
import { content as siteContent } from '../src/advent/content.mjs';
import { adventConfig } from '../src/pages.config.mjs';

const dirs = [];
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const tempRoot = (files) => {
  const root = mkdtempSync(join(tmpdir(), 'advent-site-config-'));
  dirs.push(root);
  mkdirSync(join(root, 'src', 'advent'), { recursive: true });
  for (const [name, from] of Object.entries(files)) cpSync(from, join(root, 'src', 'advent', name));
  return root;
};
const example = (name) => new URL(`../modules/advent/examples/${name}.mjs`, import.meta.url);
const site = (name) => new URL(`../src/advent/${name}.mjs`, import.meta.url);

describe('the neutral examples (the template a second church copies)', () => {
  test('they are valid, and they build', () => {
    const publicDir = mkdtempSync(join(tmpdir(), 'advent-example-'));
    dirs.push(publicDir);
    validateTheme(exampleTheme);
    validateContent(exampleContent);
    assert.equal(exampleContent.days.length, 25);
    const built = buildAdvent({ theme: exampleTheme, content: exampleContent, publicDir, siteUrl: 'https://example.org', pageNames: ['index'] });
    assert.equal(built.files.filter((f) => /^advent\/day-\d+\.json$/.test(f)).length, 25);
    assert.equal(adventPageEntry(exampleTheme).slug, 'advent');
  });

  test('every launch switch is off, and they say they are a template, not content to publish', () => {
    for (const flag of ['goLive', 'publicListing', 'artRequired']) assert.equal(exampleTheme[flag], false, flag);
    assert.match(readFileSync(example('theme'), 'utf8'), /TEMPLATE, NOT CONTENT TO PUBLISH/);
    assert.match(readFileSync(example('content'), 'utf8'), /TEMPLATE, NOT CONTENT TO PUBLISH/);
  });

  test('they carry no real story text or credit: every day is a placeholder', () => {
    for (const day of exampleContent.days) {
      assert.match(day.title, /^Day \d+: Title here$/);
      assert.equal(day.credit, 'Your illustrator');
    }
    assert.equal(exampleTheme.siteName, 'Example Parish');
  });

  test("they differ from this site's own files (so the placeholder guard can tell them apart)", () => {
    assert.ok(!sameData(siteTheme, exampleTheme));
    assert.ok(!sameData(siteContent, exampleContent));
  });
});

describe('loadAdventConfig (the placeholder guard)', () => {
  test('loads a site whose files are its own', async () => {
    const loaded = await loadAdventConfig(tempRoot({ 'theme.mjs': site('theme'), 'content.mjs': site('content') }));
    assert.equal(loaded.theme.siteName, siteTheme.siteName);
    assert.equal(loaded.content.days.length, 25);
  });

  test('the host loads exactly the files in src/advent/', () => {
    assert.ok(sameData(adventConfig.theme, siteTheme));
    assert.ok(sameData(adventConfig.content, siteContent));
  });

  test('a missing theme or content file stops the build and says what to copy', async () => {
    await assert.rejects(loadAdventConfig(tempRoot({ 'content.mjs': site('content') })), /src\/advent\/theme\.mjs is missing.*modules\/advent\/examples\/theme\.mjs.*INTEGRATION\.md/);
    await assert.rejects(loadAdventConfig(tempRoot({ 'theme.mjs': site('theme') })), /src\/advent\/content\.mjs is missing.*modules\/advent\/examples\/content\.mjs/);
  });

  test('a file that still equals the example is refused, theme and content alike', async () => {
    await assert.rejects(loadAdventConfig(tempRoot({ 'theme.mjs': example('theme'), 'content.mjs': site('content') })), /theme\.mjs is still the placeholder/);
    await assert.rejects(loadAdventConfig(tempRoot({ 'theme.mjs': site('theme'), 'content.mjs': example('content') })), /content\.mjs is still the placeholder/);
  });

  test('changing one word of the example is enough to pass the guard', async () => {
    const root = tempRoot({ 'content.mjs': site('content') });
    writeFileSync(join(root, 'src', 'advent', 'theme.mjs'), readFileSync(example('theme'), 'utf8').replace("'Example Parish'", "'Another Parish'"));
    assert.equal((await loadAdventConfig(root)).theme.siteName, 'Another Parish');
  });
});

describe('going live with example text left in (goLive true)', () => {
  const liveTheme = (overrides = {}) => ({ ...siteTheme, goLive: true, publicListing: true, artRequired: true, scene: null, ...overrides });
  const build = (theme, content) => {
    const publicDir = mkdtempSync(join(tmpdir(), 'advent-live-'));
    dirs.push(publicDir);
    return () => buildAdvent({ theme, content, publicDir, siteUrl: 'https://example.org', pageNames: ['index'] });
  };

  test('this site has no example text left (so the real launch is not blocked)', () => {
    assert.deepEqual(placeholderProblems({ theme: siteTheme, content: siteContent }), []);
  });

  test('the example itself reports problems for the name, the translation and every day', () => {
    const problems = placeholderProblems({ theme: exampleTheme, content: exampleContent });
    assert.ok(problems.some((p) => p.includes('siteName')) && problems.some((p) => p.includes('translationName')));
    assert.ok(problems.length > 25 * 8);
  });

  test('one edited day among 24 example days is still refused, naming what is left', () => {
    const content = structuredClone(exampleContent);
    content.days[0].title = 'Day 1: A real title';
    const problems = placeholderProblems({ theme: { ...siteTheme }, content });
    assert.ok(problems.some((p) => p.startsWith('day 2 ')));
    assert.ok(!problems.some((p) => p.startsWith('day 1 "title"')));
  });

  test('the build refuses to go live with example text, with a plain message', () => {
    const edited = structuredClone(exampleContent);
    edited.days[0].title = 'Day 1: A real title';
    assert.throws(build(liveTheme({ siteName: 'Another Parish', translationName: 'Our words' }), edited), /cannot go live \(goLive is true\) while example text is left: day 1 "ref"/);
    assert.throws(build(liveTheme({ siteName: 'Example Parish' }), siteContent), /theme "siteName" is still "Example Parish"/);
  });

  test('the same example text is allowed while the calendar is hidden (goLive false)', () => {
    const edited = structuredClone(exampleContent);
    edited.days[0].title = 'Day 1: A real title';
    const hidden = { ...exampleTheme, siteName: 'Another Parish' };
    build(hidden, edited)();
  });

  test('a fully written site goes through the same check (it then stops only for the missing pictures)', () => {
    assert.throws(build(liveTheme(), siteContent), /picture|art|missing/i);
  });
});

describe('a failed guard in a build prints a plain message and exits 1 (no stack trace)', () => {
  const run = (root) => spawnSync(process.execPath, ['--input-type=module', '-e', `import { loadAdventConfigOrExit } from ${JSON.stringify(new URL('../scripts/advent-config.mjs', import.meta.url).href)}; await loadAdventConfigOrExit(${JSON.stringify(root)}); console.log('LOADED');`], { encoding: 'utf8' });

  test('placeholder files', () => {
    const result = run(tempRoot({ 'theme.mjs': example('theme'), 'content.mjs': example('content') }));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /still the placeholder copied from modules\/advent\/examples/);
    assert.doesNotMatch(result.stderr, /\n\s+at /, 'no stack trace');
    assert.doesNotMatch(result.stdout, /LOADED/);
  });

  test('a missing file', () => {
    const result = run(tempRoot({}));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /src\/advent\/theme\.mjs is missing/);
    assert.doesNotMatch(result.stderr, /\n\s+at /);
  });

  test('good files load and the build goes on', () => {
    const result = run(tempRoot({ 'theme.mjs': site('theme'), 'content.mjs': site('content') }));
    assert.equal(result.status, 0);
    assert.match(result.stdout, /LOADED/);
  });
});
