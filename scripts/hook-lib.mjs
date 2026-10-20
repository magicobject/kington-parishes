// Small pure helpers shared by the git hooks (scripts/pre-commit.mjs, scripts/post-commit.mjs), the build-number
// bump and their unit tests (test-unit/hooks.test.mjs, test-unit/changelog-structure.test.mjs). See docs/hooks.md.
import { existsSync, readdirSync } from 'node:fs';
import { londonDate } from './build-date.mjs';

/** The build number that follows `saved` ({ date, build }) on the (London) day of `now`. Nothing is written. */
export function nextBuildNumber(saved, now = new Date()) {
  const date = londonDate(now).replace(/-/g, '.');
  const sameDay = saved && saved.date === date;
  return { date, build: (sameDay ? saved.build : 0) + 1 };
}

/** { date: '2026.10.14', build: 4 } becomes '2026.10.14.004'. */
export function formatBuildNumber({ date, build }) {
  return `${date}.${String(build).padStart(3, '0')}`;
}

/** The tag a build number is published under. */
export const tagFor = (state) => `build-${formatBuildNumber(state)}`;

const BUILD_FORMAT = /^\d{4}\.\d{2}\.\d{2}\.\d{3}$/;

/**
 * Reads the changelog list out of src/pages/updates.html. Returns { entries, problems }: entries is the build number
 * of every <li> in order (newest first), problems is a list of plain-English complaints (empty when well formed).
 * Well formed means: one <ul class="changelog">; each <li> is closed, not nested, not empty and holds exactly one
 * changelog-build span with a yyyy.mm.dd.NNN number; the numbers strictly descend.
 */
export function parseChangelog(html) {
  const problems = [];
  const start = /<ul class="changelog">/.exec(html);
  if (!start) return { entries: [], problems: ['no <ul class="changelog"> found'] };
  const end = html.indexOf('</ul>', start.index);
  if (end < 0) return { entries: [], problems: ['the changelog <ul> is never closed'] };
  const body = html.slice(start.index + start[0].length, end);

  const items = [];
  let depth = 0;
  let from = 0;
  for (const tag of body.matchAll(/<(\/?)li\b[^>]*>/g)) {
    if (tag[1] === '') {
      if (depth > 0) problems.push(`an <li> is nested inside another <li> (near entry ${items.length + 1})`);
      if (depth === 0) from = tag.index + tag[0].length;
      depth += 1;
    } else {
      depth -= 1;
      if (depth < 0) { problems.push('a stray </li>'); depth = 0; }
      else if (depth === 0) items.push(body.slice(from, tag.index));
    }
  }
  if (depth !== 0) problems.push('an <li> is never closed');

  const entries = [];
  items.forEach((item, i) => {
    const label = `entry ${i + 1}`;
    if (item.replace(/<[^>]*>/g, '').trim() === '') { problems.push(`${label} is empty`); return; }
    const builds = [...item.matchAll(/<span class="changelog-build">([^<]*)<\/span>/g)].map((m) => m[1].trim());
    if (builds.length !== 1) { problems.push(`${label} has ${builds.length} changelog-build spans (needs exactly 1)`); return; }
    if (!BUILD_FORMAT.test(builds[0])) { problems.push(`${label} has a malformed build number "${builds[0]}"`); return; }
    if (entries.length > 0 && !(builds[0] < entries[entries.length - 1])) {
      problems.push(`${label} (${builds[0]}) is not older than the entry above it (${entries[entries.length - 1]}); newest first, no repeats`);
    }
    entries.push(builds[0]);
  });
  return { entries, problems };
}

/** Problems that stop a commit whose new build number will be `expected` (a formatted string). Empty when fine. */
export function changelogProblems(html, expected) {
  const { entries, problems } = parseChangelog(html);
  const list = [...problems];
  if (entries.length === 0) list.push('the changelog has no entries');
  else if (entries[0] !== expected) list.push(`the top changelog entry is ${entries[0]} but this commit will be build ${expected}`);
  return list;
}

/** Why node_modules cannot be trusted, or null when it looks populated. */
export function nodeModulesProblem(dir, minimum = 5) {
  if (!existsSync(dir)) return 'node_modules is missing';
  const count = readdirSync(dir).length;
  return count < minimum ? `node_modules has only ${count} entries` : null;
}

// Files the build writes. They are regenerated from their sources, so the hook may stage them. Anything else under
// public/ (css/style.css, images) is hand-maintained and counts as a source.
const DERIVED = [
  /^public\/[^/]+\.html$/,
  /^public\/(sitemap\.xml|search-index\.json)$/,
  /^public\/js\/calendar-events\.js$/,
];
export const isDerived = (path) => DERIVED.some((pattern) => pattern.test(path));

// Files that FEED the build: whole folders the build reads (hand-maintained files under public/ included, derived files
// excluded) plus the package files and the build number. An unstaged change to one of these blocks a commit; README,
// CLAUDE.md, docs/, test/ and test-unit/ do not (the build never reads them).
const BUILD_INPUT_FOLDERS = ['src/', 'templates/', 'modules/', 'scripts/', 'newsletter-templates/', 'public/'];
const BUILD_INPUT_FILES = ['package.json', 'package-lock.json', 'build-number.json'];
export const isBuildInput = (path) => !isDerived(path) && (BUILD_INPUT_FILES.includes(path) || BUILD_INPUT_FOLDERS.some((folder) => path.startsWith(folder)));
