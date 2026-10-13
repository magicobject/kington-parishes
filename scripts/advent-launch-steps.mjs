// The mechanical launch steps, as data: used by scripts/advent-rehearse.mjs (which performs them in a COPY of the repo)
// and cross-checked against docs/advent/launch-checklist.md by test-unit/advent-launch-rehearsal.test.mjs, so the
// script and the checklist cannot drift apart.
export const LAUNCH_FLAGS = ['goLive', 'publicListing', 'artRequired']; // flipped false -> true in modules/advent/theme.mjs
export const GUARD_FILES = ['test-unit/advent-prelaunch.test.mjs', 'test/advent-prelaunch.spec.ts']; // deleted outright
export const GUARD_TEST = { file: 'test/sitemap.spec.ts', name: 'PRE-LAUNCH: the sitemap and the search index do not mention the Advent calendar' }; // removed from the end of the file
