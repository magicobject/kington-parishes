// Unit tests for modules/advent/preview.mjs: the strict, bounded demo date switch.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parsePreviewDate, effectiveDate, formatPreviewNotice } from '../modules/advent/preview.mjs';
import { londonDateParts } from '../modules/advent/date.mjs';

// "Now" is 13 Oct 2026, the season year is 2026: allowed 1 Nov 2026 to 31 Jan 2027.
const REAL_NOW = new Date('2026-10-13T12:00:00Z');
const REAL = londonDateParts(REAL_NOW);
const parse = (value) => parsePreviewDate(`?advent-preview=${value}`, REAL);

describe('parsePreviewDate: valid', () => {
  test('a good date gives numbers', () => {
    assert.deepEqual(parse('2026-12-07'), { year: 2026, month: 12, day: 7 });
  });

  test('the first and last allowed days are accepted', () => {
    assert.deepEqual(parse('2026-11-01'), { year: 2026, month: 11, day: 1 });
    assert.deepEqual(parse('2027-01-31'), { year: 2027, month: 1, day: 31 });
  });

  test('works with other parameters around it and without a leading question mark', () => {
    assert.deepEqual(parsePreviewDate('?a=1&advent-preview=2026-12-25&b=2', REAL), { year: 2026, month: 12, day: 25 });
    assert.deepEqual(parsePreviewDate('advent-preview=2026-12-25', REAL), { year: 2026, month: 12, day: 25 });
  });

  test('in January the season year is the previous year', () => {
    const january = londonDateParts(new Date('2027-01-10T12:00:00Z'));
    assert.deepEqual(parsePreviewDate('?advent-preview=2026-12-24', january), { year: 2026, month: 12, day: 24 });
    assert.equal(parsePreviewDate('?advent-preview=2027-02-01', january), null);
  });
});

describe('parsePreviewDate: ignored', () => {
  test('absent', () => {
    assert.equal(parsePreviewDate('', REAL), null);
    assert.equal(parsePreviewDate('?other=1', REAL), null);
  });

  test('malformed values', () => {
    for (const bad of ['2026-2-3', '2026-02-31', '2026-13-01', '2026-12-00', 'abc', '', '2026-12-07x', '20261207', ' 2026-12-07', '2026-12-07 ']) {
      assert.equal(parse(encodeURIComponent(bad)), null, `value "${bad}"`);
    }
  });

  test('a script tag and a very long string are ignored without error', () => {
    assert.equal(parse(encodeURIComponent('<script>alert(1)</script>')), null);
    assert.equal(parse('9'.repeat(100000)), null);
    assert.equal(parse('2026-12-07' + 'x'.repeat(100000)), null);
  });

  test('array-style and repeated parameters', () => {
    assert.equal(parsePreviewDate('?advent-preview[]=2026-12-07', REAL), null);
    assert.equal(parsePreviewDate('?advent-preview[0]=2026-12-07', REAL), null);
    assert.equal(parsePreviewDate('?advent-preview=2026-12-07&advent-preview=2026-12-08', REAL), null);
    assert.equal(parsePreviewDate('?advent-preview=2026-12-07&advent-preview=junk', REAL), null);
  });

  test('a look-alike key is not read', () => {
    assert.equal(parsePreviewDate('?Advent-Preview=2026-12-07', REAL), null);
    assert.equal(parsePreviewDate('?advent_preview=2026-12-07', REAL), null);
  });

  test('out of range', () => {
    assert.equal(parse('2026-10-31'), null);
    assert.equal(parse('2027-02-01'), null);
    assert.equal(parse('2025-12-07'), null);
    assert.equal(parse('2028-12-07'), null);
  });

  test('never before 2026, even if the real date were earlier', () => {
    const early = londonDateParts(new Date('2025-10-13T12:00:00Z'));
    assert.equal(parsePreviewDate('?advent-preview=2025-12-07', early), null);
  });

  test('bad inputs never throw', () => {
    assert.equal(parsePreviewDate(undefined, REAL), null);
    assert.equal(parsePreviewDate(null, REAL), null);
    assert.equal(parsePreviewDate(['?advent-preview=2026-12-07'], REAL), null);
    assert.equal(parsePreviewDate('?advent-preview=2026-12-07', null), null);
  });
});

describe('effectiveDate', () => {
  const base = { realNow: REAL_NOW, search: '?advent-preview=2026-12-07', pathname: '/advent', previewEnabled: true };

  test('preview applies on the allowed pages when enabled', () => {
    for (const pathname of ['/advent', '/advent.html', '/']) {
      const result = effectiveDate({ ...base, pathname });
      assert.equal(result.preview, true, pathname);
      assert.deepEqual(result.parts, { year: 2026, month: 12, day: 7 });
    }
  });

  test('other paths use the real date', () => {
    for (const pathname of ['/api/subscribe', '/advent/day-05.json', '/about', '/advent/', '/advent.html/x', '', undefined]) {
      const result = effectiveDate({ ...base, pathname });
      assert.equal(result.preview, false, String(pathname));
      assert.deepEqual(result.parts, REAL);
    }
  });

  test('preview switched off means the real date, whatever the URL says', () => {
    for (const previewEnabled of [false, undefined, 'true', 1]) {
      const result = effectiveDate({ ...base, previewEnabled });
      assert.equal(result.preview, false);
      assert.deepEqual(result.parts, REAL);
    }
  });

  test('an invalid value falls back to the real date', () => {
    const result = effectiveDate({ ...base, search: '?advent-preview=2026-02-31' });
    assert.deepEqual(result, { parts: REAL, preview: false });
  });

  test('no preview parameter gives exactly the real date', () => {
    assert.deepEqual(effectiveDate({ ...base, search: '' }), { parts: REAL, preview: false });
  });

  test('uses the given time zone for the real date', () => {
    const result = effectiveDate({ ...base, search: '', realNow: new Date('2026-11-30T12:00:00Z'), timeZone: 'Pacific/Auckland' });
    assert.equal(result.parts.day, 1);
    assert.equal(result.parts.month, 12);
  });

  test('if the real date cannot be worked out, parts is null and preview is off', () => {
    const result = effectiveDate({ ...base, realNow: Number.NaN });
    assert.deepEqual(result, { parts: null, preview: false });
  });
});

describe('formatPreviewNotice', () => {
  test('is built from the numbers with a month name', () => {
    assert.equal(formatPreviewNotice({ year: 2026, month: 12, day: 7 }), 'Preview mode: pretending it is 7 December 2026');
    assert.equal(formatPreviewNotice({ year: 2027, month: 1, day: 31 }), 'Preview mode: pretending it is 31 January 2027');
  });

  test('never echoes anything that is not a number', () => {
    const hostile = { year: '<script>', month: 12, day: 7 };
    assert.equal(formatPreviewNotice(hostile), 'Preview mode');
    assert.equal(formatPreviewNotice({ year: 2026, month: '12', day: 7 }), 'Preview mode');
    assert.equal(formatPreviewNotice({ year: 2026, month: 13, day: 7 }), 'Preview mode');
    assert.equal(formatPreviewNotice(null), 'Preview mode');
  });

  test('the notice for a parsed hostile query contains nothing from the query', () => {
    const parsed = parsePreviewDate('?advent-preview=<script>', REAL);
    assert.equal(formatPreviewNotice(parsed), 'Preview mode');
  });
});
