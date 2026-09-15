// Unit tests for src/events.config.mjs — pure functions, no build, no
// browser. Covers placeFor(), the address-mapping rule behind calendar.html's
// Event structured data (see CLAUDE.md's "Calendar & events" section), plus
// the recurring-series expansion and the 12h time/date formatters.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { placeFor, expandEvents, formatTime12h, formatEventDate } from '../src/events.config.mjs';

describe('placeFor', () => {
  test('a location matching a known church gets a full postal address', () => {
    assert.deepEqual(placeFor("St Mary's, Kington"), {
      '@type': 'Place',
      name: "St Mary's, Kington",
      address: { '@type': 'PostalAddress', addressLocality: 'Kington', addressCountry: 'GB' },
    });
  });

  test('matching is case-insensitive and by substring, not exact match', () => {
    assert.deepEqual(placeFor('KINGTON PARISH HALL'), {
      '@type': 'Place',
      name: 'KINGTON PARISH HALL',
      address: { '@type': 'PostalAddress', addressLocality: 'Kington', addressCountry: 'GB' },
    });
  });

  test('each of the five churches resolves to its own locality', () => {
    assert.equal(placeFor("St Peter's, Titley").address.addressLocality, 'Titley');
    assert.equal(placeFor("St Stephen's, Old Radnor").address.addressLocality, 'Old Radnor');
    assert.equal(placeFor("St Mary's, Kinnerton").address.addressLocality, 'Kinnerton');
    assert.equal(placeFor('St Thomas à Becket, Huntington').address.addressLocality, 'Huntington');
  });

  test('an unrecognised venue gets a bare-name Place, never a guessed address', () => {
    assert.deepEqual(placeFor('Hereford Cathedral'), {
      '@type': 'Place',
      name: 'Hereford Cathedral',
    });
  });

  test('no location given falls back to the generic org name, without attaching an address', () => {
    // Regression: the generic fallback name is "Kington Parishes", which
    // itself contains "kington" — must not accidentally match the Kington
    // locality and attach an address nobody actually gave.
    assert.deepEqual(placeFor(''), { '@type': 'Place', name: 'Kington Parishes' });
    assert.deepEqual(placeFor(undefined), { '@type': 'Place', name: 'Kington Parishes' });
  });
});

describe('expandEvents', () => {
  test('a recurring series expands to one occurrence per matching weekday between from and until, inclusive', () => {
    const events = expandEvents().filter((e) => e.title === 'Marches Voices Choir');
    // Tuesdays, 2026-09-01 to 2026-12-31, no exceptions.
    assert.ok(events.length > 0);
    for (const e of events) {
      assert.equal(new Date(`${e.date}T00:00:00`).getDay(), 2); // Tuesday
      assert.ok(e.date >= '2026-09-01' && e.date <= '2026-12-31');
    }
  });

  test('a date listed in a series\' except array is skipped', () => {
    // Stay and Play (Tuesdays) excludes 2026-10-27.
    const dates = expandEvents()
      .filter((e) => e.title === 'Stay and Play')
      .map((e) => e.date);
    assert.ok(!dates.includes('2026-10-27'));
  });

  test('one-off events and expanded recurring events are merged into a single chronologically sorted list', () => {
    const events = expandEvents();
    for (let i = 1; i < events.length; i++) {
      const prevKey = events[i - 1].date + events[i - 1].time;
      const key = events[i].date + events[i].time;
      assert.ok(prevKey <= key, `expected ${prevKey} <= ${key}`);
    }
  });
});

describe('formatTime12h', () => {
  test('formats morning and evening times with am/pm', () => {
    assert.equal(formatTime12h('09:15'), '9:15am');
    assert.equal(formatTime12h('18:00'), '6:00pm');
  });

  test('midnight and noon are 12, not 0', () => {
    assert.equal(formatTime12h('00:00'), '12:00am');
    assert.equal(formatTime12h('12:00'), '12:00pm');
  });
});

describe('formatEventDate', () => {
  test('formats as "Ddd D Month"', () => {
    assert.equal(formatEventDate('2026-06-07'), 'Sun 7 June');
  });
});
