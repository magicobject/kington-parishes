# Advent calendar: launch checklist

Everything here must be done, in this order, before the calendar is shown to the public. Until then the
calendar is hidden and two guard tests keep it that way. Tick each step in the launch commit message.

1. **Phase 3 is built; it still needs its reviews.** The real calendar (doors, day panel, gentle message, share, print, archive, banner) is in. Before launch the tester and the security-engineer must review it (docs/advent/build-plan.md, Phase 5). The placeholder note is gone.
2. **Look at the real thing** in preview on every date (docs/advent/ux-design.md), on a phone and a desktop.
3. **The pictures exist and are required.** All 25 `public/advent/art/day-01.svg` to `day-25.svg` are in
   place (nothing else may be in that folder), Greg has looked at each one, and `artRequired` in
   `modules/advent/theme.mjs` is `true`. The build now refuses to continue if any picture is missing or
   fails the safety check.
3a. **The home-page banner.** `src/pages/index.html` carries `{{ADVENT_TEASER}}`, which is one empty hidden container and a script tag in the home page source (Greg accepted this source-only mention while the calendar is hidden). It shows nothing to visitors. `test-unit/advent-built.test.mjs` ("the home page and the (hidden) Advent banner") lists exactly what the page may contain. At launch the banner follows the dates by itself (live and archive); remove nothing, and decide whether the home-page mention test needs wording changes.
4. **Flip the listing switch.** Set `publicListing: true` in `modules/advent/theme.mjs`. The calendar page
   joins the sitemap and the site search and loses its noindex; the Advent help guide rejoins the (help
   scope) search. This does not add a menu, footer or home-page link: add those as a separate, reviewed
   change if wanted.
5. **Delete the two pre-launch guards**, which would otherwise fail (that is their job):
   - `test-unit/advent-prelaunch.test.mjs` (delete the file);
   - the test named "PRE-LAUNCH: the sitemap and the search index do not mention the Advent calendar" at the
     end of `test/sitemap.spec.ts` (delete that test and its comment).
   No other test needs editing: every other test follows the two switches.
6. **Run everything:** `npm run build`, `npm run test:unit`, `npm test`, `npm run audit`. All must pass.
7. **Privacy policy:** update `src/pages/privacy-policy.html` only if something changed. It should not need
   to: the calendar stores nothing in the visitor's browser and uses no outside service. Confirm that is
   still true (the safety scans in `test-unit/advent-safety.test.mjs` enforce it).
8. **Remember the 6 January bonus door.** Day 21 promises it and the module does not have it yet (build-plan,
   "Known later items"): decide to build it or change that promise before launch.
9. **Decide the preview switch.** `previewEnabled` can stay on after 6 January or be turned off; Greg's call.
10. **Commit, tag, deploy.** Add the `/updates` entry, commit, tag `build-<date>.<NNN>`, push.
11. **Verify production after the deploy** (read-only):
    - `curl -I https://www.kingtonparishes.org.uk/advent` shows the normal security headers and a 200;
    - `curl -I` on one `/advent/art/day-NN.svg` shows two Content-Security-Policy headers (the site one and
      `default-src 'none'; style-src 'unsafe-inline'; sandbox`);
    - `curl -I` on `/advent/day-03.json` shows `x-robots-tag: noindex`;
    - the browser console on `/advent` and `/advent?advent-preview=2026-12-07` has no errors and no CSP
      violations (Cloudflare can inject its own scripts: look for them);
    - `sitemap.xml` now lists the calendar page, and the site search finds it.

Notes: the repository is public, so `modules/advent/content.mjs` is readable on GitHub whatever the switches
say, and `public/advent/day-NN.json` can be fetched by anyone who guesses the address (the `X-Robots-Tag`
header only keeps crawlers away). The calendar is hidden, not secret.

## Picture-safety fix (done, 13 Oct 2026)
- DONE: `lintSvg` now caps `<use>` elements at 50 and refuses a `<use>` of an element that contains (or is) another `<use>`, which also rules out cycles and self-reference. The "billion laughs" sample is in `test-unit/support/hostile-svgs.mjs` as a must-reject case, with a fixture proving ordinary art (three symbols used about ten times) is still accepted. Nothing to do at launch.
