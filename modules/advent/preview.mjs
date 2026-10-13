// The demo "preview" switch: ?advent-preview=YYYY-MM-DD pretends it is that date.
// Pure functions. This module has no storage of any kind, so preview mode cannot
// remember anything. Anything invalid is silently ignored and never echoed back.
import { londonDateParts } from './date.mjs';

export const PREVIEW_PARAM = 'advent-preview';
const PREVIEW_PATHS = ['/advent', '/advent.html', '/'];
const FIRST_PREVIEW_YEAR = 2026;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Reads the preview date from a query string such as "?advent-preview=2026-12-07".
 * Returns {year, month, day} or null. Never throws.
 * Allowed range: 1 Nov of the season year to 31 Jan of the next year, and not before 2026.
 * A repeated parameter is treated as invalid.
 */
export function parsePreviewDate(search, realParts) {
  try {
    if (typeof search !== 'string' || !realParts) return null;
    const values = new URLSearchParams(search).getAll(PREVIEW_PARAM);
    if (values.length !== 1) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(values[0]);
    if (!match) return null;

    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const asDate = new Date(Date.UTC(year, month - 1, day));
    const roundTrips =
      asDate.getUTCFullYear() === year && asDate.getUTCMonth() === month - 1 && asDate.getUTCDate() === day;
    if (!roundTrips || year < FIRST_PREVIEW_YEAR) return null;

    const seasonYear = realParts.month >= 2 ? realParts.year : realParts.year - 1;
    const earliest = Date.UTC(seasonYear, 10, 1);
    const latest = Date.UTC(seasonYear + 1, 0, 31);
    return asDate.getTime() >= earliest && asDate.getTime() <= latest ? { year, month, day } : null;
  } catch {
    return null;
  }
}

/**
 * The date the calendar should act on. Preview applies only when it is switched on,
 * the page is the calendar or the home page, and the value is valid.
 * Returns {parts, preview}; parts is null if even the real date could not be worked out.
 */
export function effectiveDate({ realNow, search, pathname, previewEnabled, timeZone = 'Europe/London' }) {
  const realParts = londonDateParts(realNow, timeZone);
  if (previewEnabled === true && PREVIEW_PATHS.includes(pathname)) {
    const previewParts = parsePreviewDate(search, realParts);
    if (previewParts) return { parts: previewParts, preview: true };
  }
  return { parts: realParts, preview: false };
}

/** "Preview mode: pretending it is 7 December 2026", built from numbers only. */
export function formatPreviewNotice(parts) {
  const ok = parts && Number.isInteger(parts.year) && Number.isInteger(parts.month) && Number.isInteger(parts.day) &&
    parts.month >= 1 && parts.month <= 12 && parts.day >= 1 && parts.day <= 31;
  if (!ok) return 'Preview mode';
  return `Preview mode: pretending it is ${parts.day} ${MONTH_NAMES[parts.month - 1]} ${parts.year}`;
}
