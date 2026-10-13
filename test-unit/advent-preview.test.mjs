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
    assert.equal(formatPreviewNotice({ year: 2026, month: 12, day: 7 }), "Preview mode: not today's date. Showing 7 December 2026.");
    assert.equal(formatPreviewNotice({ year: 2027, month: 1, day: 31 }), "Preview mode: not today's date. Showing 31 January 2027.");
  });

  test('never echoes anything that is not a number', () => {
    const hostile = { year: '<script>', month: 12, day: 7 };
    assert.equal(formatPreviewNotice(hostile), "Preview mode: not today's date.");
    assert.equal(formatPreviewNotice({ year: 2026, month: '12', day: 7 }), "Preview mode: not today's date.");
    assert.equal(formatPreviewNotice({ year: 2026, month: 13, day: 7 }), "Preview mode: not today's date.");
    assert.equal(formatPreviewNotice(null), "Preview mode: not today's date.");
  });

  test('the notice for a parsed hostile query contains nothing from the query', () => {
    const parsed = parsePreviewDate('?advent-preview=<script>', REAL);
    assert.equal(formatPreviewNotice(parsed), "Preview mode: not today's date.");
  });
});

describe('review fixes', () => {
  const NOW = new Date('2026-10-13T12:00:00Z');
  const base = { realNow: NOW, search: '?advent-preview=2026-12-07', previewEnabled: true };

  test('single-digit months and days are not accepted', () => {
    for (const value of ['2026-12-7', '2026-1-31']) assert.equal(parse(value), null, value);
  });

  test('impossible days that would roll into range are rejected', () => {
    for (const value of ['2026-11-31', '2026-12-32', '2026-12-00', '2026-00-15', '2027-01-32']) assert.equal(parse(value), null, value);
  });

  test('the season year changes between 31 Jan and 1 Feb', () => {
    const jan31 = londonDateParts(new Date('2027-01-31T12:00:00Z'));
    const feb1 = londonDateParts(new Date('2027-02-01T12:00:00Z'));
    assert.deepEqual(parsePreviewDate('?advent-preview=2026-12-07', jan31), { year: 2026, month: 12, day: 7 });
    assert.equal(parsePreviewDate('?advent-preview=2026-12-07', feb1), null);
    assert.deepEqual(parsePreviewDate('?advent-preview=2027-12-07', feb1), { year: 2027, month: 12, day: 7 });
  });

  test('the page paths follow the configured slug; the parameter name stays advent-preview', () => {
    const slug = 'christmas-calendar';
    for (const pathname of ['/christmas-calendar', '/christmas-calendar.html', '/']) {
      assert.equal(effectiveDate({ ...base, pathname, slug }).preview, true, pathname);
    }
    assert.equal(effectiveDate({ ...base, pathname: '/advent', slug }).preview, false);
    assert.equal(effectiveDate({ ...base, pathname: '/christmas-calendar', slug }).preview, true);
    assert.equal(effectiveDate({ ...base, pathname: '/advent' }).preview, true); // default slug is advent
  });

  test('a slug that is not a plain slug is ignored, leaving only the home page', () => {
    for (const slug of ['', '../x', 'a/b', 5, null]) {
      assert.equal(effectiveDate({ ...base, pathname: '/', slug }).preview, true);
      assert.equal(effectiveDate({ ...base, pathname: '/x', slug }).preview, false);
    }
  });

  test('effectiveDate with no arguments or an empty object fails closed without throwing', () => {
    assert.deepEqual(effectiveDate(), { parts: null, preview: false });
    assert.deepEqual(effectiveDate({}), { parts: null, preview: false });
  });

  test('the notice wording is the new calm text, and bad numbers use the plain fallback', () => {
    assert.equal(formatPreviewNotice({ year: 2026, month: 12, day: 7 }), "Preview mode: not today's date. Showing 7 December 2026.");
    const fallback = "Preview mode: not today's date.";
    for (const bad of [null, {}, { year: 2025, month: 12, day: 7 }, { year: 2101, month: 12, day: 7 }, { year: 2026, month: 2, day: 30 }, { year: 2026, month: 4, day: 31 }, { year: 2026, month: 0, day: 1 }, { year: 2026.5, month: 12, day: 7 }]) {
      assert.equal(formatPreviewNotice(bad), fallback, JSON.stringify(bad));
    }
    assert.equal(formatPreviewNotice({ year: 2100, month: 1, day: 31 }), "Preview mode: not today's date. Showing 31 January 2100.");
    assert.equal(formatPreviewNotice({ year: 2028, month: 2, day: 29 }), "Preview mode: not today's date. Showing 29 February 2028.");
  });
});

describe('review gaps: slugs that are not plain slugs', () => {
  test('a bad slug never enables preview anywhere except the home page, and never falls back to /advent', () => {
    const paths = ['/a/b', '/../x', '/UPPER', '/a--b', '/', '/advent', '/advent.html'];
    for (const slug of ['a/b', '../x', 'UPPER', 'a--b', '', 123, null]) {
      for (const pathname of paths) {
        const result = effectiveDate({ realNow: REAL_NOW, search: '?advent-preview=2026-12-07', pathname, previewEnabled: true, slug });
        assert.equal(result.preview, pathname === '/', `${JSON.stringify(slug)} ${pathname}`);
      }
    }
  });

  test('the notice fails to the plain fallback for day 0', () => {
    assert.equal(formatPreviewNotice({ year: 2026, month: 12, day: 0 }), "Preview mode: not today's date.");
  });
});
