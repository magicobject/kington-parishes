// Unit tests for modules/advent/logic.mjs and day.mjs: the pure pieces the browser script is built from
// (settings, addresses, share links, labels, day-file checking). No browser needed.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_DAY_BYTES, FRIENDLY_ERROR, dayFileUrl, artUrl, shareUrl, parseDayHash, readConfig, dateLabel, shortDateLabel,
  doorName, doorSub, doorNumberText, readDayFile, statusText, neighbours, calendarUrl, bonusConfig,
} from '../modules/advent/logic.mjs';
import { validateDayPayload, BONUS_DAY as DAY_BONUS_DAY, DAY_COUNT } from '../modules/advent/day.mjs';
import { BONUS_DAY as DATE_BONUS_DAY } from '../modules/advent/date.mjs';
import { content } from '../modules/advent/content.mjs';
import { BONUS_FIXTURE } from './support/bonus-fixture.mjs';

const DATA = {
  startMonth: '12', startDay: '1', endMonth: '12', endDay: '25', archiveMonth: '1', archiveDay: '6',
  timeZone: 'Europe/London', slug: 'advent', preview: 'true', enabled: 'true', dayCount: '25', monthName: 'December',
  opensText: 'The Advent calendar opens on 1 December.', siteName: 'Test Parish', scene: '/advent/scene.svg',
};
const BONUS_DATA = { ...DATA, bonusMonth: '1', bonusDay: '6', bonusLabel: 'Epiphany' };
const asFile = (n) => {
  const source = content.days.find((d) => d.day === n);
  const { art, ...file } = source;
  return file;
};

describe('the two copies of the bonus door number agree', () => {
  test('date.mjs and day.mjs both say 26, and the regular count is 25', () => {
    assert.equal(DATE_BONUS_DAY, 26);
    assert.equal(DAY_BONUS_DAY, 26);
    assert.equal(DAY_COUNT, 25);
  });
});

describe('dayFileUrl and artUrl: addresses built only from validated values', () => {
  test('a whole number 1 to 26 gives /advent/day-NN.json with two digits', () => {
    assert.equal(dayFileUrl(1), '/advent/day-01.json');
    assert.equal(dayFileUrl(12), '/advent/day-12.json');
    assert.equal(dayFileUrl(26), '/advent/day-26.json');
  });

  test('anything else throws, so a hostile value can never reach a request address', () => {
    for (const bad of [0, 27, -1, 1.5, NaN, Infinity, '7', '07', '../x', null, undefined, {}, [], true, '1e1', 7n]) {
      assert.throws(() => dayFileUrl(bad), RangeError, String(bad));
    }
  });

  test('artUrl only accepts a plain svg file name', () => {
    assert.equal(artUrl('day-05.svg'), '/advent/art/day-05.svg');
    for (const bad of ['../day-05.svg', 'a/b.svg', 'day-05.svg?x', 'DAY-05.svg', 'day-05.png', '', null, 5, 'http://x/y.svg']) {
      assert.throws(() => artUrl(bad), Error, String(bad));
    }
  });
});

describe('shareUrl and calendarUrl: never carry the preview date', () => {
  test('is origin + path + #day-N', () => {
    assert.equal(shareUrl('https://example.org', '/advent', 7), 'https://example.org/advent#day-7');
    assert.equal(shareUrl('https://example.org', '/advent.html', 26), 'https://example.org/advent.html#day-26');
    assert.equal(shareUrl('http://localhost:4173', '/advent.html', 1), 'http://localhost:4173/advent.html#day-1');
  });

  test('a path that somehow carries a query or hash is cut off at it', () => {
    assert.equal(shareUrl('https://example.org', '/advent?advent-preview=2026-12-07', 7), 'https://example.org/advent#day-7');
    assert.equal(shareUrl('https://example.org', '/advent#day-3', 7), 'https://example.org/advent#day-7');
    assert.ok(!shareUrl('https://example.org', '/advent?advent-preview=2026-12-07', 7).includes('preview'));
  });

  test('refuses an origin that is not http(s), a path that is not a path, and a bad day', () => {
    assert.throws(() => shareUrl('javascript:alert(1)', '/advent', 7));
    assert.throws(() => shareUrl('https://example.org', 'advent', 7));
    assert.throws(() => shareUrl('https://example.org', '//evil.example/x', 7));
    assert.throws(() => shareUrl('https://example.org', '/advent', 27), RangeError);
    assert.throws(() => shareUrl('https://example.org/x', '/advent', 7));
  });

  test('calendarUrl is origin + path with no query and no hash (the Exit preview link)', () => {
    assert.equal(calendarUrl('https://example.org', '/advent'), 'https://example.org/advent');
    assert.equal(calendarUrl('https://example.org', '/advent?advent-preview=2026-12-07#day-3'), 'https://example.org/advent');
  });
});

describe('parseDayHash', () => {
  test('reads #day-N for the regular doors', () => {
    assert.equal(parseDayHash('#day-7', false), 7);
    assert.equal(parseDayHash('#day-25', false), 25);
    assert.equal(parseDayHash('#day-1', false), 1);
  });

  test('26 only counts when there is a bonus door', () => {
    assert.equal(parseDayHash('#day-26', false), null);
    assert.equal(parseDayHash('#day-26', true), 26);
    assert.equal(parseDayHash('#day-27', true), null);
  });

  test('anything not exactly #day-N is ignored', () => {
    for (const bad of ['', '#', '#day-0', '#day-07', '#day-', '#day-7x', '#day--1', '#DAY-7', '#day-7 ', '#day-1.5', '#day-%37', '#x', null, undefined, 7]) {
      assert.equal(parseDayHash(bad, true), null, String(bad));
    }
  });
});

describe('readConfig: the page settings, from data attributes', () => {
  test('reads a complete set', () => {
    const config = readConfig(DATA);
    assert.deepEqual(config.season, { start: { month: 12, day: 1 }, end: { month: 12, day: 25 }, archiveUntil: { month: 1, day: 6 } });
    assert.equal(config.timeZone, 'Europe/London');
    assert.equal(config.previewEnabled, true);
    assert.equal(config.enabled, true);
    assert.equal(config.dayCount, 25);
    assert.equal(config.bonus, null);
    assert.equal(config.scene, '/advent/scene.svg');
    assert.equal(config.siteName, 'Test Parish');
  });

  test('reads the bonus door only when all three bonus settings are there and sensible', () => {
    assert.deepEqual(readConfig(BONUS_DATA).bonus, { on: { month: 1, day: 6 }, label: 'Epiphany' });
    for (const missing of ['bonusMonth', 'bonusDay', 'bonusLabel']) {
      const partial = { ...BONUS_DATA };
      delete partial[missing];
      assert.equal(readConfig(partial).bonus, null, missing);
    }
    assert.equal(readConfig({ ...BONUS_DATA, bonusMonth: 'x' }).bonus, null);
    assert.equal(readConfig({ ...BONUS_DATA, bonusLabel: '' }).bonus, null);
    assert.equal(bonusConfig(BONUS_DATA).on.day, 6);
  });

  test('no archive period is allowed; a missing required setting gives null', () => {
    const { archiveMonth, archiveDay, ...noArchive } = DATA;
    assert.equal(readConfig(noArchive).season.archiveUntil, null);
    for (const key of ['startMonth', 'endDay', 'dayCount', 'timeZone', 'slug']) {
      const broken = { ...DATA };
      delete broken[key];
      assert.equal(readConfig(broken), null, key);
    }
    assert.equal(readConfig({ ...DATA, startMonth: '1x' }), null);
    assert.equal(readConfig(null), null);
  });

  test('the scene setting must be a plain /advent/<name>.svg path, or it is dropped', () => {
    for (const bad of ['http://evil/x.svg', '//evil/x.svg', '/advent/../x.svg', '/img/x.svg', 'scene.svg', '/advent/a b.svg', 'javascript:1', '/advent/x.svg?y', '']) {
      assert.equal(readConfig({ ...DATA, scene: bad }).scene, null, bad);
    }
    assert.equal(readConfig({ ...DATA, scene: '/advent/scene-default.svg' }).scene, '/advent/scene-default.svg');
  });
});

describe('labels: dates, door names, door text', () => {
  const config = readConfig(BONUS_DATA);

  test('a door date is the start date plus the day number', () => {
    assert.equal(dateLabel(1, config), '1 December');
    assert.equal(dateLabel(12, config), '12 December');
    assert.equal(dateLabel(25, config), '25 December');
    assert.equal(shortDateLabel(12, config), '12 Dec');
    assert.equal(dateLabel(26, config), '6 January');
    assert.equal(shortDateLabel(26, config), '6 Jan');
  });

  test('accessible names follow the design table; only an unlocked door ever carries its title', () => {
    assert.equal(doorName({ day: 12, state: 'future' }, config), 'Day 12, 12 December, not yet');
    assert.equal(doorName({ day: 12, state: 'future', title: 'SECRET TITLE' }, config), 'Day 12, 12 December, not yet');
    assert.equal(doorName({ day: 12, state: 'today', title: 'A Title' }, config), 'Day 12, 12 December, today. A Title');
    assert.equal(doorName({ day: 12, state: 'today' }, config), 'Day 12, 12 December, today');
    assert.equal(doorName({ day: 7, state: 'available', title: 'A Title' }, config), 'Day 7, 7 December. A Title');
    assert.equal(doorName({ day: 7, state: 'available' }, config), 'Day 7, 7 December');
  });

  test('the star door (25) also says Christmas Day', () => {
    assert.equal(doorName({ day: 25, state: 'future' }, config), 'Day 25, 25 December, Christmas Day, not yet');
    assert.equal(doorName({ day: 25, state: 'today', title: 'T' }, config), 'Day 25, 25 December, Christmas Day, today. T');
    assert.equal(doorName({ day: 25, state: 'available', title: 'T' }, config), 'Day 25, 25 December, Christmas Day. T');
  });

  test('the bonus door is named by its label', () => {
    assert.equal(doorName({ day: 26, state: 'future' }, config), 'Epiphany door, 6 January, not yet');
    assert.equal(doorName({ day: 26, state: 'today', title: 'Gifts' }, config), 'Epiphany door, 6 January, today. Gifts');
    assert.equal(doorName({ day: 26, state: 'available', title: 'Gifts' }, config), 'Epiphany door, 6 January. Gifts');
  });

  test('visible door text: the number (a star for 25, the label for the bonus) and the word Today or the date', () => {
    assert.equal(doorNumberText(7, config), '7');
    assert.equal(doorNumberText(25, config), '\u2605');
    assert.equal(doorNumberText(26, config), 'Epiphany');
    assert.equal(doorSub({ day: 12, state: 'today' }, config), 'Today');
    assert.equal(doorSub({ day: 12, state: 'future' }, config), '12 Dec');
    assert.equal(doorSub({ day: 7, state: 'available' }, config), '7 Dec');
    assert.equal(doorSub({ day: 26, state: 'today' }, config), 'Today');
    assert.equal(doorSub({ day: 26, state: 'future' }, config), '6 Jan');
  });

  test('"today" is always spelled out in the visible text, so it never rests on colour or border width alone', () => {
    assert.match(doorSub({ day: 3, state: 'today' }, config), /today/i);
    assert.ok(!/today/i.test(doorSub({ day: 3, state: 'available' }, config)));
  });
});

describe('statusText', () => {
  const config = readConfig(BONUS_DATA);
  test('live: Today is Day N, with the title once known', () => {
    assert.equal(statusText({ season: 'live', today: 12, title: 'The Title' }, config), 'Today is Day 12: The Title');
    assert.equal(statusText({ season: 'live', today: 12 }, config), 'Today is Day 12.');
  });
  test('archive: all doors are open, no counters', () => {
    assert.equal(statusText({ season: 'archive' }, config), 'All 25 doors are open. Read at your own pace.');
  });
  test('archive on the bonus date mentions the bonus door', () => {
    assert.match(statusText({ season: 'archive', bonusToday: true }, config), /^All 25 doors are open\. .*Epiphany/);
  });
  test('never mentions counts of opened doors or anything missed', () => {
    for (const text of [statusText({ season: 'live', today: 3, title: 'T' }, config), statusText({ season: 'archive' }, config)]) {
      assert.ok(!/missed|streak|\bof\b \d|opened \d/i.test(text), text);
    }
  });
});

describe('neighbours: previous and next day', () => {
  test('1 has no previous, 25 has no next without a bonus, 25 leads to the bonus with one', () => {
    assert.deepEqual(neighbours(1, false), { prev: null, next: 2 });
    assert.deepEqual(neighbours(12, false), { prev: 11, next: 13 });
    assert.deepEqual(neighbours(25, false), { prev: 24, next: null });
    assert.deepEqual(neighbours(25, true), { prev: 24, next: 26 });
    assert.deepEqual(neighbours(26, true), { prev: 25, next: null });
  });
});

describe('readDayFile: the browser checks every file it fetches', () => {
  const text = (n, change = (x) => x) => JSON.stringify(change(asFile(n)));

  test('accepts a real day file and returns the parsed, checked object', () => {
    const file = readDayFile(text(7), 7);
    assert.equal(file.day, 7);
    assert.equal(file.title, content.days[6].title);
  });

  test('accepts the bonus fixture as day 26', () => {
    const { art, ...file } = BONUS_FIXTURE;
    assert.equal(readDayFile(JSON.stringify(file), 26).title, 'Gifts for a King');
  });

  test('accepts a file with a picture name and refuses one with an unsafe picture name', () => {
    assert.equal(readDayFile(text(7, (f) => ({ ...f, art: 'day-07.svg' })), 7).art, 'day-07.svg');
    for (const art of ['../x.svg', 'http://evil/x.svg', 'a/b.svg', 'day-07.png']) {
      assert.throws(() => readDayFile(text(7, (f) => ({ ...f, art })), 7), Error, art);
    }
  });

  test('refuses the wrong day, whatever the file says', () => {
    assert.throws(() => readDayFile(text(8), 7), /day/);
    assert.throws(() => readDayFile(text(7), 8), /day/);
  });

  test('refuses text that is not JSON, JSON that is not an object, and an empty body', () => {
    for (const bad of ['', 'not json', '[]', 'null', '42', '"x"', '{', '{"day":7}']) assert.throws(() => readDayFile(bad, 7), Error, bad);
    assert.throws(() => readDayFile(undefined, 7), Error);
    assert.throws(() => readDayFile(null, 7), Error);
    assert.throws(() => readDayFile({ day: 7 }, 7), Error);
  });

  test('refuses unknown keys, markup, addresses and braces in any field', () => {
    assert.throws(() => readDayFile(text(7, (f) => ({ ...f, extra: 'x' })), 7), /unknown key/);
    assert.throws(() => readDayFile(text(7, (f) => ({ ...f, title: 'Hi <b>there</b>' })), 7), /title/);
    assert.throws(() => readDayFile(text(7, (f) => ({ ...f, prayer: 'See example.org' })), 7), /prayer/);
    assert.throws(() => readDayFile(text(7, (f) => ({ ...f, paragraphs: ['ok', 'x {{ADVENT}}'] })), 7), /paragraphs/);
    assert.throws(() => readDayFile(text(7, (f) => ({ ...f, paragraphs: 'a string' })), 7), /paragraphs/);
    assert.throws(() => readDayFile(text(7, (f) => ({ ...f, alt: 'javascript:alert(1)' })), 7), /alt/);
  });

  test('refuses a file over 64 KB even if it would otherwise be valid', () => {
    assert.equal(MAX_DAY_BYTES, 65536);
    const big = text(7, (f) => ({ ...f, paragraphs: Array(12).fill('a'.repeat(1200)) }));
    assert.ok(big.length < MAX_DAY_BYTES);
    assert.doesNotThrow(() => readDayFile(big, 7));
    const huge = ` ${' '.repeat(MAX_DAY_BYTES)}${text(7)}`;
    assert.throws(() => readDayFile(huge, 7), /large/);
    // bytes, not characters: a multi-byte character counts for its bytes
    const base = JSON.stringify({ ...asFile(7), paragraphs: ['\u00E9'.repeat(1200)] });
    const wide = base + ' '.repeat(65000 - base.length);
    assert.ok(wide.length < MAX_DAY_BYTES && Buffer.byteLength(wide) > MAX_DAY_BYTES);
    assert.throws(() => readDayFile(wide, 7), /large/);
  });

  test('prototype pollution tricks in the JSON do nothing and are refused', () => {
    const polluted = text(7).replace('{', '{"__proto__":{"polluted":true},');
    assert.throws(() => readDayFile(polluted, 7), Error);
    assert.equal({}.polluted, undefined);
  });

  test('the friendly error never carries raw error text', () => {
    assert.equal(FRIENDLY_ERROR, 'Sorry, this door will not open right now. Please try again in a moment.');
  });
});

describe('validateDayPayload is the same rule the build uses', () => {
  test('every real day passes as a file with or without a picture', () => {
    for (const day of content.days) {
      const { art, ...file } = day;
      assert.doesNotThrow(() => validateDayPayload(file, day.day), `day ${day.day}`);
      assert.doesNotThrow(() => validateDayPayload({ ...file, art }, day.day), `day ${day.day} with art`);
    }
  });
});
