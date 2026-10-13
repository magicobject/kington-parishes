// Unit tests for modules/advent/date.mjs: London calendar days, season states
// and door states. Pure functions, no browser.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { londonDateParts, seasonState, doorState, isDayUnlocked, daysUntilStart } from '../modules/advent/date.mjs';

const CFG = {
  start: { month: 12, day: 1 },
  end: { month: 12, day: 25 },
  archiveUntil: { month: 1, day: 6 },
};

// Winter London time equals UTC, so these ISO strings read as London clock times.
const london = (iso) => londonDateParts(new Date(iso));
const stateAt = (iso) => seasonState(london(iso), CFG);

describe('londonDateParts', () => {
  test('returns numbers for year, month, day, hour, minute and second', () => {
    assert.deepEqual(london('2026-12-07T09:08:07Z'), { year: 2026, month: 12, day: 7, hour: 9, minute: 8, second: 7 });
  });

  test('accepts milliseconds as well as a Date', () => {
    assert.deepEqual(londonDateParts(Date.UTC(2026, 11, 7, 12)), london('2026-12-07T12:00:00Z'));
  });

  test('midnight is hour 0, not 24', () => {
    assert.equal(london('2026-12-01T00:00:00Z').hour, 0);
  });

  test('uses the real zone rules: London is one hour ahead of UTC in summer', () => {
    const lateEvening = london('2026-07-01T23:30:00Z');
    assert.deepEqual([lateEvening.month, lateEvening.day, lateEvening.hour], [7, 2, 0]);
    // The same clock time in winter stays on the same day: not a fixed offset.
    const winter = london('2026-12-01T23:30:00Z');
    assert.deepEqual([winter.month, winter.day, winter.hour], [12, 1, 23]);
  });

  test('the clocks going back in October: both sides of the change give London dates', () => {
    assert.equal(london('2026-10-24T23:30:00Z').day, 25); // still BST, 00:30 on the 25th
    // 01:30 happens twice on 25 Oct: once in BST (00:30Z) and once in GMT (01:30Z).
    assert.equal(london('2026-10-25T00:30:00Z').hour, 1);
    assert.equal(london('2026-10-25T01:30:00Z').hour, 1);
  });

  test('a different time zone gives a different local day for the same instant', () => {
    const instant = new Date('2026-11-30T12:00:00Z');
    assert.equal(londonDateParts(instant, 'Europe/London').day, 30);
    const auckland = londonDateParts(instant, 'Pacific/Auckland'); // NZDT, 13 hours ahead
    assert.deepEqual([auckland.month, auckland.day, auckland.hour], [12, 1, 1]);
  });

  test('handles a leap day', () => {
    assert.deepEqual(
      [london('2028-02-29T12:00:00Z').month, london('2028-02-29T12:00:00Z').day],
      [2, 29],
    );
    assert.equal(london('2028-03-01T00:00:00Z').day, 1);
    assert.equal(london('2027-03-01T00:00:00Z').month, 3);
  });

  test('fails closed (null) for an invalid date, a non-date, or an unknown zone', () => {
    assert.equal(londonDateParts(new Date('nonsense')), null);
    assert.equal(londonDateParts(Number.NaN), null);
    assert.equal(londonDateParts(undefined), null);
    assert.equal(londonDateParts(new Date('2026-12-01T00:00:00Z'), 'Not/AZone'), null);
  });
});

describe('seasonState boundaries (London time)', () => {
  test('30 Nov 23:59:59 is before the season; 1 Dec 00:00:00 is live', () => {
    assert.equal(stateAt('2026-11-30T23:59:59Z'), 'before');
    assert.equal(stateAt('2026-12-01T00:00:00Z'), 'live');
  });

  test('25 Dec 23:59:59 is still live; 26 Dec 00:00:00 is the archive', () => {
    assert.equal(stateAt('2026-12-25T23:59:59Z'), 'live');
    assert.equal(stateAt('2026-12-26T00:00:00Z'), 'archive');
  });

  test('6 Jan is still the archive (of the previous December); 7 Jan is over', () => {
    assert.equal(stateAt('2027-01-01T00:00:00Z'), 'archive');
    assert.equal(stateAt('2027-01-06T23:59:59Z'), 'archive');
    assert.equal(stateAt('2027-01-07T00:00:00Z'), 'after');
  });

  test('from 7 Jan to 31 Oct it is after, then the last 30 days before the start are before', () => {
    assert.equal(stateAt('2027-03-15T12:00:00Z'), 'after');
    assert.equal(stateAt('2027-10-31T12:00:00Z'), 'after');
    assert.equal(stateAt('2027-11-01T00:00:00Z'), 'before');
    assert.equal(stateAt('2027-11-30T12:00:00Z'), 'before');
    assert.equal(stateAt('2027-12-01T12:00:00Z'), 'live');
  });

  test('works in the following year with no change', () => {
    assert.equal(stateAt('2027-12-12T12:00:00Z'), 'live');
    assert.equal(stateAt('2028-01-03T12:00:00Z'), 'archive');
  });

  test('uses the London day, not the visitor zone: 30 Nov evening UTC is still 30 Nov in London', () => {
    const instant = new Date('2026-11-30T23:30:00Z');
    assert.equal(seasonState(londonDateParts(instant, 'Europe/London'), CFG), 'before');
    // The same instant already reads 1 Dec in Auckland, proving the zone matters.
    assert.equal(seasonState(londonDateParts(instant, 'Pacific/Auckland'), CFG), 'live');
  });

  test('a null date fails closed to after', () => {
    assert.equal(seasonState(null, CFG), 'after');
  });

  test('with no archive, 26 Dec is simply over', () => {
    const noArchive = { ...CFG, archiveUntil: null };
    assert.equal(seasonState(london('2026-12-26T12:00:00Z'), noArchive), 'after');
    assert.equal(seasonState(london('2027-01-03T12:00:00Z'), noArchive), 'after');
  });

  test('an archive that stays within the year (not crossing New Year) also works', () => {
    const cfg = { start: { month: 3, day: 1 }, end: { month: 3, day: 10 }, archiveUntil: { month: 3, day: 20 } };
    assert.equal(seasonState({ year: 2027, month: 3, day: 11 }, cfg), 'archive');
    assert.equal(seasonState({ year: 2027, month: 3, day: 20 }, cfg), 'archive');
    assert.equal(seasonState({ year: 2027, month: 3, day: 21 }, cfg), 'after');
  });
});

describe('daysUntilStart', () => {
  test('counts whole days, across a leap day too', () => {
    assert.equal(daysUntilStart({ year: 2026, month: 11, day: 30 }, CFG), 1);
    assert.equal(daysUntilStart({ year: 2026, month: 12, day: 1 }, CFG), 0);
    assert.equal(daysUntilStart({ year: 2026, month: 12, day: 7 }, CFG), -6);
    const leapCfg = { ...CFG, start: { month: 3, day: 1 } };
    assert.equal(daysUntilStart({ year: 2028, month: 2, day: 28 }, leapCfg), 2);
    assert.equal(daysUntilStart({ year: 2027, month: 2, day: 28 }, leapCfg), 1);
  });
});

describe('doorState', () => {
  test('1 Dec: door 1 is today, every other door is future', () => {
    const parts = london('2026-12-01T12:00:00Z');
    assert.equal(doorState(1, parts, CFG), 'today');
    assert.equal(doorState(2, parts, CFG), 'future');
    assert.equal(doorState(25, parts, CFG), 'future');
  });

  test('12 Dec: doors 1-11 available, 12 today, 13-25 future', () => {
    const parts = london('2026-12-12T12:00:00Z');
    for (let day = 1; day <= 11; day += 1) assert.equal(doorState(day, parts, CFG), 'available', `door ${day}`);
    assert.equal(doorState(12, parts, CFG), 'today');
    for (let day = 13; day <= 25; day += 1) assert.equal(doorState(day, parts, CFG), 'future', `door ${day}`);
  });

  test('25 Dec: door 25 is today, doors 1-24 available', () => {
    const parts = london('2026-12-25T23:59:59Z');
    for (let day = 1; day <= 24; day += 1) assert.equal(doorState(day, parts, CFG), 'available');
    assert.equal(doorState(25, parts, CFG), 'today');
  });

  test('past doors are never "missed"', () => {
    const states = new Set();
    for (let d = 1; d <= 25; d += 1) states.add(doorState(d, london('2026-12-20T12:00:00Z'), CFG));
    assert.deepEqual([...states].sort(), ['available', 'future', 'today']);
  });

  test('archive: every door is available and none is today', () => {
    for (const iso of ['2026-12-26T00:00:00Z', '2027-01-06T12:00:00Z']) {
      for (let day = 1; day <= 25; day += 1) assert.equal(doorState(day, london(iso), CFG), 'available');
    }
  });

  test('outside the season every door is future', () => {
    for (const iso of ['2026-11-30T23:59:59Z', '2027-01-07T00:00:00Z', '2027-06-01T12:00:00Z']) {
      for (const day of [1, 12, 25]) assert.equal(doorState(day, london(iso), CFG), 'future');
    }
  });

  test('a null date fails closed: every door is future', () => {
    assert.equal(doorState(1, null, CFG), 'future');
  });

  test('a day that is not an integer from 1 to 25 throws', () => {
    const parts = london('2026-12-12T12:00:00Z');
    for (const bad of [0, 26, -1, 1.5, '3', null, undefined, Number.NaN]) {
      assert.throws(() => doorState(bad, parts, CFG), RangeError, `day ${String(bad)}`);
    }
  });
});

describe('isDayUnlocked', () => {
  test('true for today and earlier, false for later doors and outside the season', () => {
    const parts = london('2026-12-07T12:00:00Z');
    assert.equal(isDayUnlocked(6, parts, CFG), true);
    assert.equal(isDayUnlocked(7, parts, CFG), true);
    assert.equal(isDayUnlocked(8, parts, CFG), false);
    assert.equal(isDayUnlocked(1, london('2026-11-30T12:00:00Z'), CFG), false);
    assert.equal(isDayUnlocked(25, london('2027-01-02T12:00:00Z'), CFG), true);
  });
});

describe('review fixes: other start dates, odd inputs, fail closed', () => {
  test('door N is start + N - 1 days, not tied to 1 December', () => {
    const cfg = { start: { month: 11, day: 20 }, end: { month: 12, day: 14 }, archiveUntil: null };
    const parts = { year: 2026, month: 12, day: 3 };
    assert.equal(doorState(14, parts, cfg), 'today');
    assert.equal(doorState(13, parts, cfg), 'available');
    assert.equal(doorState(15, parts, cfg), 'future');
  });

  test('a season starting early in January is "before" in late December (the year rolls over)', () => {
    const cfg = { start: { month: 1, day: 5 }, end: { month: 1, day: 20 }, archiveUntil: null };
    assert.equal(seasonState({ year: 2026, month: 12, day: 20 }, cfg), 'before');
    assert.equal(seasonState({ year: 2026, month: 12, day: 6 }, cfg), 'before'); // 30 days to go
    assert.equal(seasonState({ year: 2026, month: 12, day: 5 }, cfg), 'after'); // 31 days to go
    assert.equal(seasonState({ year: 2027, month: 1, day: 5 }, cfg), 'live');
  });

  test('londonDateParts accepts only a finite number or a valid Date', () => {
    for (const bad of [null, true, false, undefined, Number.NaN, Infinity, '2026-12-01', '1700000000000', {}, [], new Date(Number.NaN)]) {
      assert.equal(londonDateParts(bad), null, String(bad));
    }
    assert.notEqual(londonDateParts(0), null);
    assert.notEqual(londonDateParts(new Date(0)), null);
  });

  test('a missing or broken date or config fails closed instead of throwing', () => {
    for (const badParts of [null, undefined, {}, { year: 2026 }, 'x']) {
      assert.equal(seasonState(badParts, CFG), 'after');
      assert.equal(doorState(5, badParts, CFG), 'future');
    }
    const parts = { year: 2026, month: 12, day: 7 };
    for (const badCfg of [undefined, null, {}, { start: null }, { start: { month: 12, day: 1 } }, 'x']) {
      assert.equal(seasonState(parts, badCfg), 'after');
      assert.equal(doorState(5, parts, badCfg), 'future');
      assert.equal(isDayUnlocked(5, parts, badCfg), false);
    }
  });

  test('a bad day number still throws even with no date', () => {
    assert.throws(() => doorState(0, null, CFG), RangeError);
  });
});
