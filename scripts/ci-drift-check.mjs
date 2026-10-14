#!/usr/bin/env node
// CI's generated-files drift check. Run after `npm run build`: every file under public/ must equal what is committed,
// with ONE allowed exception that depends on the date the build ran on rather than on the code: the Event structured
// data in public/calendar.html (the build drops events that have already happened). For that page the two versions are
// compared with every schema.org Event removed from the ld+json blocks; any other difference there still fails.
// Date-independent on purpose: a squash merge, rebase, cherry-pick or amend changes commit dates, not what is correct.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const CALENDAR = 'public/calendar.html';
const BLOCK = /<script type="application\/ld\+json">([\s\S]*?)<\/script>\n?/g;

/** The page with every schema.org Event taken out of its ld+json blocks (a block left empty is removed). */
export function withoutEvents(html) {
  return html.replace(BLOCK, (whole, json) => {
    let value;
    try { value = JSON.parse(json); } catch { return whole; } // unreadable: leave it, so a difference still shows
    const rest = (Array.isArray(value) ? value : [value]).filter((item) => !(item && item['@type'] === 'Event'));
    return rest.length === 0 ? '' : `<script type="application/ld+json">${JSON.stringify(rest)}</script>\n`;
  });
}

/** True when the two versions of the calendar page differ at most in their Event structured data. */
export const sameApartFromEvents = (committed, built) => withoutEvents(committed) === withoutEvents(built);

/** The problems with `git status --porcelain -- public` output plus the committed and built calendar pages. */
export function driftProblems(statusLines, committedCalendar, builtCalendar) {
  const problems = [];
  for (const line of statusLines.filter(Boolean)) {
    const path = line.slice(3);
    if (path === CALENDAR && committedCalendar !== undefined && sameApartFromEvents(committedCalendar, builtCalendar)) continue;
    problems.push(`${path} differs from a fresh build (git status: ${line.slice(0, 2).trim() || '?'})`);
  }
  return problems;
}

if (process.argv[1]?.endsWith('ci-drift-check.mjs')) {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const lines = git('status', '--porcelain', '--', 'public').split('\n');
  let committed;
  try { committed = git('show', `HEAD:${CALENDAR}`); } catch { committed = undefined; }
  const problems = driftProblems(lines, committed, readFileSync(CALENDAR, 'utf8'));
  if (problems.length > 0) {
    console.error('Generated files are out of date: the committed public/ is not what a fresh build produces.');
    for (const problem of problems) console.error(`  ${problem}`);
    console.error('Fix: run "npm run build" (the commit hook does this) and commit the result.');
    process.exit(1);
  }
  console.log('Generated files are up to date (calendar Event data excepted: it depends on the build date).');
}
