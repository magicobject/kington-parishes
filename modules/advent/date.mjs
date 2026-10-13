// Date logic for the Advent calendar. Pure functions: no DOM, no storage, no
// network, no imports. Safe to load in a browser, in Node, or in a Worker.
//
// Season states (see seasonState):
//   'before'  the 30 days leading up to the start date (1 to 30 Nov by default):
//             shows a calm "opens on 1 December" message.
//   'live'    start to end inclusive (1 to 25 Dec): today's door and earlier doors open.
//   'archive' the day after the end up to archiveUntil inclusive (26 Dec to 6 Jan):
//             "The Christmas Story", every door open, none is "today".
//   'after'   everything else (7 Jan to 31 Oct), and the fail-closed answer when the
//             date could not be worked out. Same calm "opens on 1 December" message.
// 1 to 6 Jan belong to the previous December's season.
//
// Door states (see doorState): 'future' | 'today' | 'available'.
// There is deliberately no 'missed': a past door is simply available.

const BEFORE_WINDOW_DAYS = 30;
const DAY_MS = 86400000;
const MAX_DOOR = 25;

/**
 * The calendar date (and time) of an instant in the given time zone, as numbers.
 * Built from Intl.DateTimeFormat#formatToParts, never by parsing locale text.
 * Fails closed: returns null if the input is not a valid date or Intl misbehaves.
 */
export function londonDateParts(dateOrMs, timeZone = 'Europe/London') {
  try {
    const date = dateOrMs instanceof Date ? dateOrMs : new Date(dateOrMs);
    if (Number.isNaN(date.getTime())) return null;
    const formatter = new Intl.DateTimeFormat('en-GB-u-ca-gregory-nu-latn', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
    });
    const found = {};
    for (const part of formatter.formatToParts(date)) {
      if (['year', 'month', 'day', 'hour', 'minute', 'second'].includes(part.type)) {
        found[part.type] = Number(part.value);
      }
    }
    const parts = {
      year: found.year,
      month: found.month,
      day: found.day,
      hour: found.hour,
      minute: found.minute,
      second: found.second,
    };
    const sane =
      Object.values(parts).every(Number.isInteger) &&
      parts.month >= 1 && parts.month <= 12 &&
      parts.day >= 1 && parts.day <= 31 &&
      parts.hour >= 0 && parts.hour <= 23 &&
      parts.minute >= 0 && parts.minute <= 59 &&
      parts.second >= 0 && parts.second <= 59;
    return sane ? parts : null;
  } catch {
    return null;
  }
}

const monthDay = (month, day) => month * 100 + day;

function utcDay(year, month, day) {
  return Date.UTC(year, month - 1, day);
}

/** Whole days from the given date to the season start (this year); negative once it has started. */
export function daysUntilStart(parts, cfg) {
  return Math.round((utcDay(parts.year, cfg.start.month, cfg.start.day) - utcDay(parts.year, parts.month, parts.day)) / DAY_MS);
}

/** 'before' | 'live' | 'archive' | 'after'. A null date fails closed to 'after'. */
export function seasonState(parts, cfg) {
  if (!parts) return 'after';
  const today = monthDay(parts.month, parts.day);
  const start = monthDay(cfg.start.month, cfg.start.day);
  const end = monthDay(cfg.end.month, cfg.end.day);
  if (today >= start && today <= end) return 'live';

  if (cfg.archiveUntil) {
    const until = monthDay(cfg.archiveUntil.month, cfg.archiveUntil.day);
    const inArchive = until < start
      ? today > end || today <= until // runs over New Year into January
      : today > end && today <= until;
    if (inArchive) return 'archive';
  }

  const daysAway = daysUntilStart(parts, cfg);
  return daysAway > 0 && daysAway <= BEFORE_WINDOW_DAYS ? 'before' : 'after';
}

function checkDay(day) {
  if (!Number.isInteger(day) || day < 1 || day > MAX_DOOR) {
    throw new RangeError('day must be an integer from 1 to 25');
  }
}

/** 'future' | 'today' | 'available' for one door. Throws if day is not an integer 1 to 25. */
export function doorState(day, parts, cfg) {
  checkDay(day);
  const season = seasonState(parts, cfg);
  if (season === 'archive') return 'available';
  if (season !== 'live') return 'future';
  const todaysDoor = 1 - daysUntilStart(parts, cfg);
  if (day < todaysDoor) return 'available';
  return day === todaysDoor ? 'today' : 'future';
}

/** True when a door can be read without the gentle "open it anyway" step. */
export function isDayUnlocked(day, parts, cfg) {
  return doorState(day, parts, cfg) !== 'future';
}
