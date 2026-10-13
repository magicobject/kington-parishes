# Advent calendar: launch checklist

Everything here must be done, in this order, before the calendar is shown to the public. Until then the
calendar is hidden and two guard tests keep it that way. Tick each step in the launch commit message.

1. **Phase 3 must be built and reviewed first.** The live page currently shows plain placeholder doors, a
   visible "Placeholder doors" note and nothing else. Build the real doors, day panel, pictures, reading
   text, share and read-aloud (docs/advent/build-plan.md, Phase 3), and have the tester and the
   security-engineer review it. Do not go live on the placeholder page.
2. **Remove the placeholder note.** Delete the placeholder note and the `aria-describedby` that ties it to
   the door list in `modules/advent/client/advent.js` (the note is created in `showDoors`), plus the
   `.advent-placeholder-note` rule in `modules/advent/client/advent.css`. Then `npm run advent:manifest`
   and bump `modules/advent/VERSION`.
3. **The pictures exist and are required.** All 25 `public/advent/art/day-01.svg` to `day-25.svg` are in
   place (nothing else may be in that folder), Greg has looked at each one, and `artRequired` in
   `modules/advent/theme.mjs` is `true`. The build now refuses to continue if any picture is missing or
   fails the safety check.
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

## Must be done BEFORE the first SVG is committed (security review, 13 Oct 2026)
- `lintSvg` accepts a "billion laughs" picture (10 nested groups, each holding 10 `<use>` of the previous): about 100 elements, 1.8 KB, passes the caps, but hangs the browser when loaded as an image. Fix: cap the number of `<use>` elements (for example 50) and refuse a `<use>` that references an element containing another `<use>`, or resolve the reference graph and cap the total expansion. Add the sample from the review scratch (laugh.mjs) to `test-unit/support/hostile-svgs.mjs` as a must-reject case.
