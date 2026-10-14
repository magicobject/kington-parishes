// The early banner script (modules/advent/client/advent-early.js) reserves the home-page banner's room before the page is
// painted. It repeats, in a few lines, the question the real code answers ("is the banner going to show?"), so this test runs
// the real script in a sandbox and compares it with the real date rules for every day of two years and for edge instants.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { londonDateParts, seasonState } from '../modules/advent/date.mjs';
import { visibleSeason } from '../modules/advent/logic.mjs';

const source = readFileSync(new URL('../modules/advent/client/advent-early.js', import.meta.url), 'utf8');

const SEASON = { start: { month: 12, day: 1 }, end: { month: 12, day: 25 }, archiveUntil: { month: 1, day: 6 } };
const dataFor = (season, extra = {}) => ({
  enabled: 'true', preview: 'true', goLive: 'true', timeZone: 'Europe/London', slug: 'advent',
  startMonth: String(season.start.month), startDay: String(season.start.day), endMonth: String(season.end.month), endDay: String(season.end.day),
  ...(season.archiveUntil ? { archiveMonth: String(season.archiveUntil.month), archiveDay: String(season.archiveUntil.day) } : {}),
  ...extra,
});

/** Runs the early script on a fake page; returns what it did to the container. */
function run({ data, search = '', now, wide = false, withHost = true }) {
  const FixedDate = class extends Date { constructor(...args) { if (args.length === 0) super(now); else super(...args); } };
  const moved = [];
  const style = {};
  const attributes = new Set(['data-advent-teaser']);
  const timers = [];
  const host = { parentNode: {}, after: (node) => moved.push(node) };
  const root = {
    dataset: data, hidden: true, style,
    hasAttribute: (name) => attributes.has(name), setAttribute: (name) => attributes.add(name), removeAttribute: (name) => attributes.delete(name),
    closest: () => (withHost ? host : null), querySelector: () => null,
  };
  const context = {
    document: { currentScript: { previousElementSibling: root } },
    location: { search },
    window: { matchMedia: () => ({ matches: wide }), setTimeout: (fn, ms) => timers.push({ fn, ms }) },
    Intl, Date: FixedDate, Number, RegExp,
  };
  vm.runInNewContext(source, context);
  return { reserved: attributes.has('data-advent-reserved'), hidden: root.hidden, minHeight: style.minHeight, moved: moved.length, timers };
}

/** What the real code decides: the banner shows when the setting is on and the date is live or in the archive (or previewing). */
function realShows(data, now, season) {
  const config = { goLive: data.goLive === 'true' };
  const state = visibleSeason(seasonState(londonDateParts(now, data.timeZone), season), false, config);
  return state === 'live' || state === 'archive';
}

describe('the early banner script agrees with the real date rules', () => {
  test('for every day of 2026 and 2027 (a year that ends in the season and one that starts in the archive), noon and just after midnight', () => {
    for (let ms = Date.UTC(2026, 0, 1, 12); ms < Date.UTC(2028, 0, 1); ms += 86400000) {
      for (const at of [ms, ms - 11.5 * 3600000 + 60000]) {
        const expected = realShows(dataFor(SEASON), at, SEASON);
        const result = run({ data: dataFor(SEASON), now: at });
        assert.equal(result.reserved, expected, new Date(at).toISOString());
      }
    }
  });

  test('a season with no archive, and one that runs over a month boundary, agree too (summer time zone included)', () => {
    const seasons = [
      { start: { month: 6, day: 1 }, end: { month: 6, day: 25 } },
      { start: { month: 11, day: 20 }, end: { month: 12, day: 14 }, archiveUntil: { month: 1, day: 6 } },
      { start: { month: 12, day: 28 }, end: { month: 1, day: 21 }, archiveUntil: { month: 2, day: 2 } },
    ];
    for (const season of seasons) {
      const data = dataFor(season);
      for (let ms = Date.UTC(2026, 0, 1, 12); ms < Date.UTC(2027, 0, 1); ms += 86400000) {
        for (const at of [ms, ms - 12.5 * 3600000]) {
          if (season.end.month < season.start.month) continue; // (a wrapping live period is not a valid season for the real code)
          assert.equal(run({ data, now: at }).reserved, realShows(data, at, season), `${JSON.stringify(season)} ${new Date(at).toISOString()}`);
        }
      }
    }
  });

  test('the calendar\'s time zone decides the day, not the visitor\'s: 23:30 UTC on 31 May is already 1 June in London in summer', () => {
    const june = { start: { month: 6, day: 1 }, end: { month: 6, day: 25 } };
    assert.equal(run({ data: dataFor(june), now: Date.UTC(2026, 4, 31, 23, 30) }).reserved, true);
    assert.equal(run({ data: dataFor(june), now: Date.UTC(2026, 4, 31, 22, 30) }).reserved, false);
  });
});

describe('what the early script does and does not do', () => {
  const inSeason = Date.UTC(2026, 11, 12, 12);
  const outOfSeason = Date.UTC(2026, 5, 12, 12);

  test('out of season, before launch (the real-date setting is off) and with the calendar switched off, it does nothing at all', () => {
    for (const result of [
      run({ data: dataFor(SEASON), now: outOfSeason }),
      run({ data: dataFor(SEASON, { goLive: 'false' }), now: inSeason }),
      run({ data: dataFor(SEASON, { enabled: 'false' }), now: inSeason, search: '?advent-preview=2026-12-12' }),
    ]) {
      assert.deepEqual({ ...result, timers: result.timers.length }, { reserved: false, hidden: true, minHeight: undefined, moved: 0, timers: 0 });
    }
  });

  test('in season it moves the container after its hero, reserves room (in rem) and un-hides it, and sets a safety timer', () => {
    const phone = run({ data: dataFor(SEASON), now: inSeason });
    assert.deepEqual({ ...phone, timers: phone.timers.length }, { reserved: true, hidden: false, minHeight: '17.5rem', moved: 1, timers: 1 });
    assert.equal(run({ data: dataFor(SEASON), now: inSeason, wide: true }).minHeight, '12rem');
  });

  test('a preview address reserves room even out of season, and more of it (the "Preview mode" notice), but only when preview is allowed', () => {
    const preview = run({ data: dataFor(SEASON), now: outOfSeason, search: '?advent-preview=2026-12-12' });
    assert.equal(preview.reserved, true);
    assert.equal(preview.minHeight, '25rem');
    assert.equal(run({ data: dataFor(SEASON), now: outOfSeason, search: '?x=1&advent-preview=2026-12-12', wide: true }).minHeight, '15.5rem');
    assert.equal(run({ data: dataFor(SEASON, { preview: 'false' }), now: outOfSeason, search: '?advent-preview=2026-12-12' }).reserved, false);
    assert.equal(run({ data: dataFor(SEASON), now: outOfSeason, search: '?notadvent-preview=2026-12-12' }).reserved, false);
  });

  test('the safety timer gives the room back if the banner script never ran', () => {
    // (The sandbox container has no banner content, so the timer hides it again.)
    const sandbox = run({ data: dataFor(SEASON), now: inSeason });
    assert.equal(sandbox.timers[0].ms, 5000);
  });

  test('anything unexpected (no container, a broken time zone) leaves the page alone and throws nothing', () => {
    assert.doesNotThrow(() => vm.runInNewContext(source, { document: { currentScript: null } }));
    assert.equal(run({ data: dataFor(SEASON, { timeZone: 'Not/AZone' }), now: inSeason }).reserved, false);
  });
});
