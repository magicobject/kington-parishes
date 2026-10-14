// The one date basis for the build, the commit hook and CI: the Europe/London calendar date, written YYYY-MM-DD.
// (The server and the people are in the UK; a UTC date would disagree with the local one for an hour each summer night.)
// BUILD_DATE=YYYY-MM-DD in the environment overrides "today" for the build (useful for checking how the calendar will
// look on another day). The build drops calendar events that have already happened, so its output depends on the date;
// CI copes with that in scripts/ci-drift-check.mjs.
const LONDON = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });

/** The London calendar date of an instant, as YYYY-MM-DD. */
export function londonDate(instant = new Date()) {
  return LONDON.format(instant);
}

/** The date the build should treat as today: BUILD_DATE if set (and a real date), otherwise today in London. */
export function resolveBuildDate(env = process.env, now = new Date()) {
  const given = env.BUILD_DATE;
  if (given === undefined || given === '') return londonDate(now);
  const parsed = new Date(`${given}T00:00:00Z`);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(given) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === given;
  if (!valid) throw new Error(`BUILD_DATE must be a real date written YYYY-MM-DD, not "${given}"`);
  return given;
}
