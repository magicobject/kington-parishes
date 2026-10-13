// The optional bonus door (a 26th door, opening on a date inside the archive period): its date logic,
// its theme and content rules, and the day file the build writes for it. The bonus here is a test fixture;
// the real text is written separately and a site with no bonus text simply shows 25 doors.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { londonDateParts, seasonState, doorState, isDayUnlocked, BONUS_DAY } from '../modules/advent/date.mjs';
import { validateContent, validateTheme, validateDay, DAY_COUNT } from '../modules/advent/schema.mjs';
import { buildAdvent, renderAdventToken, validateDayFile } from '../modules/advent/build.mjs';
import { theme } from '../modules/advent/theme.mjs';
import { content } from '../modules/advent/content.mjs';
import { BONUS_FIXTURE } from './support/bonus-fixture.mjs';

const SEASON = { start: { month: 12, day: 1 }, end: { month: 12, day: 25 }, archiveUntil: { month: 1, day: 6 } };
const BONUS = { on: { month: 1, day: 6 }, label: 'Epiphany' };
const at = (iso) => londonDateParts(new Date(iso));
const stateOn = (iso, day = BONUS_DAY, season = SEASON) => doorState(day, at(iso), season, BONUS);

describe('the bonus door: date logic', () => {
  test('the bonus is door 26', () => assert.equal(BONUS_DAY, 26));

  test('without a bonus configured, door 26 is still an error (25 doors only)', () => {
    assert.throws(() => doorState(26, at('2026-12-12T12:00:00Z'), SEASON), RangeError);
    assert.throws(() => doorState(26, at('2026-12-12T12:00:00Z'), SEASON, null), RangeError);
    assert.throws(() => isDayUnlocked(26, at('2027-01-06T12:00:00Z'), SEASON), RangeError);
  });

  test('door 27 and non-integers are always errors, bonus or not', () => {
    for (const bad of [0, 27, 1.5, '26', NaN, null]) assert.throws(() => doorState(bad, at('2027-01-06T12:00:00Z'), SEASON, BONUS), RangeError, String(bad));
  });

  test('future before the season, through the live days, and through the archive until its date', () => {
    for (const iso of ['2026-10-13T12:00:00Z', '2026-11-30T12:00:00Z', '2026-12-01T12:00:00Z', '2026-12-25T12:00:00Z', '2026-12-26T00:00:00Z', '2027-01-05T23:59:59Z']) {
      assert.equal(stateOn(iso), 'future', iso);
      assert.equal(isDayUnlocked(26, at(iso), SEASON, BONUS), false, iso);
    }
  });

  test('today on 6 January itself (the last archive day), and unlocked', () => {
    assert.equal(stateOn('2027-01-06T00:00:00Z'), 'today');
    assert.equal(stateOn('2027-01-06T23:59:59Z'), 'today');
    assert.equal(isDayUnlocked(26, at('2027-01-06T12:00:00Z'), SEASON, BONUS), true);
  });

  test('after the season ends the calendar is calm again, so the bonus door is not offered (future)', () => {
    assert.equal(stateOn('2027-01-07T00:00:00Z'), 'future');
    assert.equal(seasonState(at('2027-01-07T00:00:00Z'), SEASON), 'after');
  });

  test('during the archive the bonus is the ONLY door that is still future before its date', () => {
    for (const iso of ['2026-12-26T12:00:00Z', '2026-12-31T12:00:00Z', '2027-01-01T12:00:00Z', '2027-01-05T12:00:00Z']) {
      const states = Array.from({ length: 26 }, (_, i) => doorState(i + 1, at(iso), SEASON, BONUS));
      assert.deepEqual(states.slice(0, 25), Array(25).fill('available'), iso);
      assert.equal(states[25], 'future', iso);
    }
  });

  test('on 6 January there is no other "today" door: the bonus is the only one', () => {
    const states = Array.from({ length: 26 }, (_, i) => doorState(i + 1, at('2027-01-06T12:00:00Z'), SEASON, BONUS));
    assert.deepEqual(states.filter((s) => s === 'today').length, 1);
    assert.equal(states[25], 'today');
  });

  test('the live days still behave as before when a bonus is configured', () => {
    assert.equal(doorState(12, at('2026-12-12T12:00:00Z'), SEASON, BONUS), 'today');
    assert.equal(doorState(11, at('2026-12-12T12:00:00Z'), SEASON, BONUS), 'available');
    assert.equal(doorState(13, at('2026-12-12T12:00:00Z'), SEASON, BONUS), 'future');
  });

  test('generic: a bonus date later in a longer archive becomes available after its day', () => {
    const season = { ...SEASON, archiveUntil: { month: 1, day: 31 } };
    assert.equal(stateOn('2027-01-05T12:00:00Z', BONUS_DAY, season), 'future');
    assert.equal(stateOn('2027-01-06T12:00:00Z', BONUS_DAY, season), 'today');
    assert.equal(stateOn('2027-01-07T12:00:00Z', BONUS_DAY, season), 'available');
    assert.equal(stateOn('2027-01-31T12:00:00Z', BONUS_DAY, season), 'available');
  });

  test('generic: a bonus inside a same-year archive (no New Year wrap)', () => {
    const season = { start: { month: 3, day: 1 }, end: { month: 3, day: 25 }, archiveUntil: { month: 4, day: 10 } };
    const bonus = { on: { month: 4, day: 2 }, label: 'Extra' };
    const state = (iso) => doorState(26, at(iso), season, bonus);
    assert.equal(state('2026-03-30T12:00:00Z'), 'future');
    assert.equal(state('2026-04-02T12:00:00Z'), 'today');
    assert.equal(state('2026-04-03T12:00:00Z'), 'available');
  });

  test('a null date fails closed', () => {
    assert.equal(doorState(26, null, SEASON, BONUS), 'future');
  });
});

describe('the bonus door: theme rules', () => {
  const withBonus = (bonus) => ({ ...structuredClone(theme), bonus });

  test('the theme may omit the bonus or set it to null', () => {
    assert.doesNotThrow(() => validateTheme(structuredClone(theme)));
    assert.doesNotThrow(() => validateTheme(withBonus(null)));
  });

  test('a valid bonus passes and the checked copy keeps it', () => {
    const checked = validateTheme(withBonus(structuredClone(BONUS)));
    assert.deepEqual(checked.bonus, BONUS);
  });

  test('refuses unknown keys, a bad date, a bad label and a non-object', () => {
    assert.throws(() => validateTheme(withBonus({ ...BONUS, extra: 1 })), /bonus/);
    assert.throws(() => validateTheme(withBonus({ on: BONUS.on })), /label/);
    assert.throws(() => validateTheme(withBonus({ label: 'Epiphany' })), /"on"|on/);
    assert.throws(() => validateTheme(withBonus({ ...BONUS, on: { month: 2, day: 30 } })), /bonus/);
    assert.throws(() => validateTheme(withBonus({ ...BONUS, on: { month: 13, day: 1 } })), /bonus/);
    assert.throws(() => validateTheme(withBonus({ ...BONUS, label: 'Bad <b>' })), /label/);
    assert.throws(() => validateTheme(withBonus({ ...BONUS, label: '' })), /label/);
    assert.throws(() => validateTheme(withBonus({ ...BONUS, label: 'x'.repeat(31) })), /label/);
    assert.throws(() => validateTheme(withBonus('Epiphany')), /bonus/);
    assert.throws(() => validateTheme(withBonus([])), /bonus/);
  });

  test('the bonus date must fall inside the archive period (after the end, up to archiveUntil)', () => {
    assert.throws(() => validateTheme(withBonus({ ...BONUS, on: { month: 12, day: 20 } })), /archive/);
    assert.throws(() => validateTheme(withBonus({ ...BONUS, on: { month: 12, day: 25 } })), /archive/);
    assert.throws(() => validateTheme(withBonus({ ...BONUS, on: { month: 1, day: 7 } })), /archive/);
    assert.throws(() => validateTheme(withBonus({ ...BONUS, on: { month: 6, day: 1 } })), /archive/);
    assert.doesNotThrow(() => validateTheme(withBonus({ ...BONUS, on: { month: 12, day: 26 } })));
    assert.doesNotThrow(() => validateTheme(withBonus({ ...BONUS, on: { month: 1, day: 1 } })));
  });

  test('a bonus needs an archive period', () => {
    const noArchive = { ...structuredClone(theme), bonus: BONUS, season: { ...theme.season, archiveUntil: null } };
    assert.throws(() => validateTheme(noArchive), /archive/);
  });
});

describe('the bonus door: content rules', () => {
  const withBonus = (bonus) => ({ days: structuredClone(content.days), bonus });

  test('content with no bonus is unchanged: exactly 25 days', () => {
    assert.equal(DAY_COUNT, 25);
    assert.doesNotThrow(() => validateContent(structuredClone(content)));
  });

  test('the fixture bonus passes the same rules as any day, and the checked copy keeps it', () => {
    const checked = validateContent(withBonus(structuredClone(BONUS_FIXTURE)));
    assert.equal(checked.days.length, 25);
    assert.equal(checked.bonus.day, 26);
  });

  test('the bonus is held to the same text rules as any day', () => {
    for (const [field, value] of [['title', 'Bad <b>'], ['ref', 'see example.org'], ['prayer', 'Amen {{X}}'], ['alt', BONUS_FIXTURE.title]]) {
      assert.throws(() => validateContent(withBonus({ ...BONUS_FIXTURE, [field]: value })), new RegExp(field), field);
    }
    assert.throws(() => validateContent(withBonus({ ...BONUS_FIXTURE, extra: 'x' })), /unknown key/);
    const { translation, ...without } = BONUS_FIXTURE;
    assert.throws(() => validateContent(withBonus(without)), /translation/);
  });

  test('the bonus day number must be exactly 26, and the 25 regular days must be 1 to 25', () => {
    for (const day of [25, 27, 0, 1]) assert.throws(() => validateContent(withBonus({ ...BONUS_FIXTURE, day })), /day/, String(day));
    const c = withBonus(BONUS_FIXTURE);
    c.days[24] = { ...c.days[24], day: 26 };
    assert.throws(() => validateContent(c), /day/);
  });

  test('refuses a bonus that is not an object, and unknown top-level keys', () => {
    assert.throws(() => validateContent(withBonus('x')), /bonus/);
    assert.throws(() => validateContent(withBonus([])), /bonus/);
    assert.throws(() => validateContent({ ...withBonus(BONUS_FIXTURE), extra: 1 }), /unknown key/);
  });

  test('validateDay by itself still refuses day 26 unless told the range', () => {
    assert.throws(() => validateDay(BONUS_FIXTURE, 0), /day/);
    assert.doesNotThrow(() => validateDay(BONUS_FIXTURE, 0, { min: 26, max: 26 }));
  });
});

describe('the bonus door: build', () => {
  const dirs = [];
  after(() => { for (const dir of dirs) rmSync(dir, { recursive: true, force: true }); });
  const build = (options = {}) => {
    const publicDir = mkdtempSync(join(tmpdir(), 'advent-bonus-'));
    dirs.push(publicDir);
    const result = buildAdvent({
      theme: { ...structuredClone(theme), bonus: BONUS }, content: { days: structuredClone(content.days), bonus: structuredClone(BONUS_FIXTURE) },
      publicDir, siteUrl: 'https://example.test', pageNames: ['index'], ...options,
    });
    return { publicDir, result };
  };

  test('writes day-26.json in the fixed key order when the bonus has content', () => {
    const { publicDir, result } = build();
    const text = readFileSync(join(publicDir, 'advent', 'day-26.json'), 'utf8');
    const parsed = JSON.parse(text);
    assert.equal(parsed.day, 26);
    assert.equal(parsed.title, BONUS_FIXTURE.title);
    assert.ok(text.endsWith('}\n'));
    assert.doesNotThrow(() => validateDayFile(parsed, 26));
    assert.ok(result.files.includes('advent/day-26.json'));
    assert.equal(result.tokenContext.hasBonus, true);
  });

  test('writes no day-26.json when the content has no bonus text, even if the theme names a bonus', () => {
    const { publicDir, result } = build({ content: structuredClone(content) });
    assert.equal(existsSync(join(publicDir, 'advent', 'day-26.json')), false);
    assert.equal(result.tokenContext.hasBonus, false);
  });

  test('refuses bonus content when the theme has no bonus configured', () => {
    assert.throws(() => build({ theme: { ...structuredClone(theme), bonus: null } }), /bonus/);
  });

  test('day-26.svg is allowed in the art folder only when the bonus has content', () => {
    const publicDir = mkdtempSync(join(tmpdir(), 'advent-bonus-'));
    dirs.push(publicDir);
    mkdirSync(join(publicDir, 'advent', 'art'), { recursive: true });
    writeFileSync(join(publicDir, 'advent', 'art', 'day-26.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="5" height="5"/></svg>');
    assert.throws(() => build({ publicDir, content: structuredClone(content) }), /day-26\.svg/);
    const { result } = build({ publicDir });
    assert.ok(result.artPresent.includes('day-26.svg'));
    assert.equal(JSON.parse(readFileSync(join(publicDir, 'advent', 'day-26.json'), 'utf8')).art, 'day-26.svg');
  });

  test('the page markup carries the bonus settings only when there is bonus content', () => {
    const withIt = renderAdventToken('{{ADVENT}}', build().result.tokenContext);
    assert.match(withIt, /data-bonus-month="1"/);
    assert.match(withIt, /data-bonus-day="6"/);
    assert.match(withIt, /data-bonus-label="Epiphany"/);
    const without = renderAdventToken('{{ADVENT}}', build({ content: structuredClone(content) }).result.tokenContext);
    assert.ok(!/data-bonus/.test(without));
  });
});
