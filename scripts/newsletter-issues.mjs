// Pure date-splitting/formatting logic behind the InSpire Newsletter's two
// listing pages ({{NEWSLETTERS:recent}} / {{NEWSLETTERS:archive}} in
// scripts/build.mjs) — kept separate so it's testable without a full build,
// same pattern as build-search-index.mjs.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// '2026-10-01' -> 'October 2026'.
export function formatIssueMonth(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

// Splits issues into "recent" (published within the last six months of
// `today`) and "archive" (everything older), each sorted newest first.
// `today` is injectable so tests don't depend on the real current date —
// the split only needs to be right as of whenever the site last built, not
// live for a visitor's exact moment (unlike the homepage noticeboard, which
// really does need same-day precision for a notice that expires today).
export function splitNewsletterIssues(issues, today = new Date()) {
  const cutoff = new Date(today);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setMonth(cutoff.getMonth() - 6);

  const sorted = [...issues].sort((a, b) => b.date.localeCompare(a.date));
  const recent = sorted.filter((issue) => new Date(`${issue.date}T00:00:00`) >= cutoff);
  const archive = sorted.filter((issue) => new Date(`${issue.date}T00:00:00`) < cutoff);
  return { recent, archive };
}
