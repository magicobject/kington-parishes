// The 26 real pictures (day-01.svg to day-26.svg, the 25 days and the bonus day) are in public/advent/art/ and are
// consistent with the content and with the build, including its strict mode (artRequired true, as at launch).
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAdvent, lintSvg } from '../modules/advent/build.mjs';
import { theme } from '../modules/advent/theme.mjs';
import { content } from '../modules/advent/content.mjs';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const ART = join(PUBLIC, 'advent', 'art');
const names = Array.from({ length: 26 }, (_, i) => `day-${String(i + 1).padStart(2, '0')}.svg`);
const allDays = [...content.days, content.bonus];
const dirs = [];
after(() => { for (const dir of dirs) rmSync(dir, { recursive: true, force: true }); });

describe('the real pictures', () => {
  test('public/advent/art holds exactly day-01.svg to day-26.svg, nothing else', () => {
    assert.deepEqual(readdirSync(ART).sort(), names);
  });

  test('every picture passes the lint, is plain LF text, and is a real svg', () => {
    for (const name of names) {
      const text = readFileSync(join(ART, name), 'utf8');
      assert.deepEqual(lintSvg(text), [], name);
      assert.ok(!text.includes('\r'), `${name} has a carriage return`);
      assert.match(text, /^<svg /);
    }
  });

  test('the strict build (artRequired true, as at launch) passes against the real art folder and finds all 26', () => {
    const publicDir = mkdtempSync(join(tmpdir(), 'advent-art-'));
    dirs.push(publicDir);
    mkdirSync(join(publicDir, 'advent'), { recursive: true });
    cpSync(ART, join(publicDir, 'advent', 'art'), { recursive: true });
    cpSync(join(PUBLIC, 'advent', 'scene.svg'), join(publicDir, 'advent', 'scene.svg'));
    const result = buildAdvent({ theme: { ...structuredClone(theme), artRequired: true, goLive: true, publicListing: true }, content, publicDir, siteUrl: 'https://example.test', pageNames: ['index'] });
    assert.deepEqual(result.artPresent.slice().sort(), names);
  });

  test('every built day file (25 days and the bonus) now carries its art key', () => {
    for (const day of allDays) {
      const file = JSON.parse(readFileSync(join(PUBLIC, 'advent', `day-${String(day.day).padStart(2, '0')}.json`), 'utf8'));
      assert.equal(file.art, `day-${String(day.day).padStart(2, '0')}.svg`, `day ${day.day}`);
    }
  });

  test('the alt text in the content equals the picture\'s own aria-label and title, for all 26', () => {
    for (const day of allDays) {
      const text = readFileSync(join(ART, `day-${String(day.day).padStart(2, '0')}.svg`), 'utf8');
      const label = /<svg [^>]*aria-label="([^"]*)"/.exec(text)?.[1];
      const title = /<title>([^<]*)<\/title>/.exec(text)?.[1];
      assert.equal(label, day.alt, `day ${day.day} aria-label`);
      assert.equal(title, day.alt, `day ${day.day} title`);
    }
  });

  test('the alt text is one sentence of a sensible length for every day', () => {
    for (const day of allDays) assert.ok(day.alt.length >= 40 && day.alt.length <= 200, `day ${day.day}: ${day.alt.length}`);
  });
});
