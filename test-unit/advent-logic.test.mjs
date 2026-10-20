// Unit tests for modules/advent/logic.mjs and day.mjs: the pure pieces the browser script is built from
// (settings, addresses, share links, labels, day-file checking). No browser needed.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_DAY_BYTES, FRIENDLY_ERROR, dayFileUrl, artUrl, shareUrl, parseDayHash, readConfig, dateLabel, shortDateLabel,
  doorName, doorSub, doorNumberText, readDayFile, statusText, neighbours, calendarUrl, bonusConfig, stylesheetUrl, todayDoor, teaserText, fetchDayFile, visibleSeason, DAY_FETCH_TIMEOUT_MS,
} from '../modules/advent/logic.mjs';
import { validateDayPayload, BONUS_DAY as DAY_BONUS_DAY, DAY_COUNT } from '../modules/advent/day.mjs';
import { BONUS_DAY as DATE_BONUS_DAY } from '../modules/advent/date.mjs';
import { londonDateParts } from '../modules/advent/date.mjs';
import { content } from '../src/advent/content.mjs';
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
    assert.equal(doorName({ day: 12, state: 'future' }, config), '12 12 Dec. Day 12, 12 December, not yet');
    assert.equal(doorName({ day: 12, state: 'future', title: 'SECRET TITLE' }, config), '12 12 Dec. Day 12, 12 December, not yet');
    assert.equal(doorName({ day: 12, state: 'today', title: 'A Title' }, config), '12 Today. Day 12, 12 December, today. A Title');
    assert.equal(doorName({ day: 12, state: 'today' }, config), '12 Today. Day 12, 12 December, today');
    assert.equal(doorName({ day: 7, state: 'available', title: 'A Title' }, config), '7 7 Dec. Day 7, 7 December. A Title');
    assert.equal(doorName({ day: 7, state: 'available' }, config), '7 7 Dec. Day 7, 7 December');
  });

  test('the star door (25) also says Christmas Day', () => {
    assert.equal(doorName({ day: 25, state: 'future' }, config), '\u2605 25 Dec Christmas Day. Day 25, 25 December, Christmas Day, not yet');
    assert.equal(doorName({ day: 25, state: 'today', title: 'T' }, config), '\u2605 Today Christmas Day. Day 25, 25 December, Christmas Day, today. T');
    assert.equal(doorName({ day: 25, state: 'available', title: 'T' }, config), '\u2605 25 Dec Christmas Day. Day 25, 25 December, Christmas Day. T');
  });

  test('the bonus door is named by its label', () => {
    assert.equal(doorName({ day: 26, state: 'future' }, config), 'Epiphany 6 Jan. Epiphany door, 6 January, not yet');
    assert.equal(doorName({ day: 26, state: 'today', title: 'Gifts' }, config), 'Epiphany Today. Epiphany door, 6 January, today. Gifts');
    assert.equal(doorName({ day: 26, state: 'available', title: 'Gifts' }, config), 'Epiphany 6 Jan. Epiphany door, 6 January. Gifts');
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

describe('stylesheetUrl: the only stylesheet addresses the banner script will load', () => {
  test('accepts the two hashed module stylesheets, nothing else', () => {
    assert.equal(stylesheetUrl('/css/advent-theme.css?v=0123456789'), '/css/advent-theme.css?v=0123456789');
    assert.equal(stylesheetUrl('/css/advent-teaser.css?v=abcdef0123'), '/css/advent-teaser.css?v=abcdef0123');
    for (const bad of ['https://evil.example/x.css', '//evil.example/x.css', '/css/style.css?v=0123456789', '/css/advent-theme.css', '/css/advent-theme.css?v=XYZ',
      '/css/advent-theme.css?v=0123456789&x=1', '/css/../x.css?v=0123456789', 'javascript:1', '', null, undefined, 5]) {
      assert.equal(stylesheetUrl(bad), null, String(bad));
    }
  });
});

describe('todayDoor and teaserText', () => {
  const config = readConfig(BONUS_DATA);
  const at = (iso) => londonDateParts(new Date(iso));

  test('the live door is the day of December; archive and calm states have none', () => {
    assert.equal(todayDoor(at('2026-12-01T12:00:00Z'), config.season), 1);
    assert.equal(todayDoor(at('2026-12-12T12:00:00Z'), config.season), 12);
    assert.equal(todayDoor(at('2026-12-25T23:59:00Z'), config.season), 25);
  });

  test('live banner: heading, "Day N" plus title once known, and a button for today\'s door', () => {
    assert.deepEqual(teaserText({ season: 'live', today: 12, title: 'The Title' }, config), {
      heading: 'Advent at Test Parish', line: 'Day 12 \u00B7 The Title', button: "Open today's door",
    });
    assert.equal(teaserText({ season: 'live', today: 12 }, config).line, 'Day 12');
  });

  test('archive banner: the Christmas story in 25 short pieces', () => {
    assert.deepEqual(teaserText({ season: 'archive' }, config), {
      heading: 'Advent at Test Parish', line: 'The Christmas story, in 25 short pieces', button: 'Open the calendar',
    });
  });
});

describe('fetchDayFile: one place that fetches, checks and caps a day file', () => {
  const goodText = JSON.stringify(asFile(7));
  const reply = (body, { ok = true, type = 'application/json', length } = {}) => ({
    ok,
    headers: { get: (name) => ({ 'content-type': type, 'content-length': length }[name.toLowerCase()] ?? null) },
    text: async () => body,
  });
  const fetchWith = (response) => {
    const calls = [];
    const fn = async (url, init) => { calls.push({ url, init }); if (response instanceof Error) throw response; return response; };
    fn.calls = calls;
    return fn;
  };

  test('asks for exactly the day file, with no cookies, and returns the checked file', async () => {
    const fn = fetchWith(reply(goodText));
    const file = await fetchDayFile(7, fn);
    assert.equal(file.day, 7);
    assert.equal(fn.calls.length, 1);
    assert.equal(fn.calls[0].url, '/advent/day-07.json');
    assert.equal(fn.calls[0].init.credentials, 'omit');
  });

  test('accepts a content type with a charset', async () => {
    assert.equal((await fetchDayFile(7, fetchWith(reply(goodText, { type: 'application/json; charset=utf-8' })))).day, 7);
  });

  test('never makes a request for a day that is not a whole number 1 to 26', async () => {
    const fn = fetchWith(reply(goodText));
    for (const bad of [0, 27, '7', 1.5, null, '../x']) await assert.rejects(() => fetchDayFile(bad, fn), RangeError, String(bad));
    assert.equal(fn.calls.length, 0);
  });

  test('rejects on every kind of failure: bad status, wrong type, too big, malformed, wrong day, network error', async () => {
    const cases = {
      'not ok': reply(goodText, { ok: false }),
      'html': reply(goodText, { type: 'text/html' }),
      'no content type': reply(goodText, { type: '' }),
      'plain text': reply(goodText, { type: 'text/plain' }),
      'big header': reply(goodText, { length: String(MAX_DAY_BYTES + 1) }),
      'big body': reply(`${goodText}${' '.repeat(MAX_DAY_BYTES)}`),
      'malformed': reply('{"day":7,'),
      'wrong day': reply(JSON.stringify(asFile(8))),
      'bad field': reply(JSON.stringify({ ...asFile(7), title: '<b>x</b>' })),
      'network': new TypeError('Failed to fetch'),
      'nothing': null,
    };
    for (const [name, response] of Object.entries(cases)) {
      await assert.rejects(() => fetchDayFile(7, fetchWith(response)), Error, name);
    }
  });
});

describe('goLive: the real date only drives the calendar once the site has gone live', () => {
  test('readConfig reads data-go-live: only exactly "true" counts (fail closed)', () => {
    assert.equal(readConfig({ ...DATA, goLive: 'true' }).goLive, true);
    for (const bad of ['false', 'TRUE', 'True', '1', 'yes', ' true', 'true ', '', undefined, null]) {
      assert.equal(readConfig({ ...DATA, goLive: bad }).goLive, false, String(bad));
    }
    assert.equal(readConfig(DATA).goLive, false);
  });

  test('visibleSeason: not live and not previewing is always calm ("after"), whatever the date says', () => {
    const off = readConfig(DATA);
    const on = readConfig({ ...DATA, goLive: 'true' });
    for (const season of ['before', 'live', 'archive', 'after']) {
      assert.equal(visibleSeason(season, false, off), 'after', season);
      assert.equal(visibleSeason(season, false, on), season, season);
      assert.equal(visibleSeason(season, true, off), season, season);
      assert.equal(visibleSeason(season, true, on), season, season);
    }
  });
});

describe('fetchDayFile: a request that never answers is cut off', () => {
  const goodText = JSON.stringify(asFile(7));
  const ok = { ok: true, headers: { get: (n) => (n.toLowerCase() === 'content-type' ? 'application/json' : null) }, text: async () => goodText };

  test('passes an abort signal, and a fetch that never answers rejects after the timeout', async () => {
    let signal = null;
    const never = (url, init) => new Promise((resolve, reject) => {
      signal = init.signal;
      init.signal.addEventListener('abort', () => reject(init.signal.reason ?? new Error('aborted')));
    });
    const started = Date.now();
    await assert.rejects(() => fetchDayFile(7, never, { timeoutMs: 30 }));
    assert.ok(signal instanceof AbortSignal);
    assert.ok(Date.now() - started < 2000);
  });

  test('the default timeout is 10 seconds', async () => {
    assert.equal(DAY_FETCH_TIMEOUT_MS, 10000);
    // Exercised with a short override, not the real 10s default: AbortSignal.timeout() has no
    // cancel, so letting it run for the full default here would leave a real 10-second timer
    // dangling past the end of this test - which, under the load of the CI job that runs this
    // suite back-to-back with other work, was enough to get this whole suite torn down mid-run
    // ("cancelledByParent") rather than completing cleanly.
    let signal = null;
    await fetchDayFile(7, async (url, init) => { signal = init.signal; return ok; }, { timeoutMs: 50 });
    assert.equal(signal.aborted, false);
  });

  test('works without AbortSignal.timeout (older browsers): a manual timer aborts the request', async () => {
    const original = AbortSignal.timeout;
    AbortSignal.timeout = undefined;
    try {
      const never = (url, init) => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
      await assert.rejects(() => fetchDayFile(7, never, { timeoutMs: 30 }), /aborted/);
      assert.equal((await fetchDayFile(7, async () => ok, { timeoutMs: 30 })).day, 7);
    } finally {
      AbortSignal.timeout = original;
    }
  });
});
