# Advent calendar: launch checklist

This is the single source for going live. Everything here must be done, in this order, before the calendar is
shown to the public. Until then the calendar is hidden: a real visitor sees only the calm sentence on `/advent`
(even in December) and nothing on the home page; only `?advent-preview=2026-12-07` shows the calendar. Three
guard tests keep it that way. Tick each step in the launch commit message.

1. **The reviews.** The real calendar (doors, day panel, gentle message, share, print, archive, home-page banner)
   is built. Before launch the tester and the security-engineer must review it (docs/advent/build-plan.md,
   Phase 5). The placeholder note is gone.
2. **Look at the real thing** in preview on every date (docs/advent/ux-design.md), on a phone and a desktop,
   including the home page with `/?advent-preview=2026-12-07`.
3. **The pictures exist.** All 25 `public/advent/art/day-01.svg` to `day-25.svg` are in place (nothing else may be
   in that folder), Greg has looked at each one. `npm test` renders EVERY real picture (and the scene) in Chromium and
   fails if any takes 300 ms or more at 400px or 800px wide (`test/advent-svg-render.spec.ts`): run it with the real art
   in place before launch. The build refuses a picture that is unsafe OR too costly to draw
   (the lint bounds draw cost with a weighted budget, not only the `<use>` count: see the README, "Adding a
   picture").
4. **The bonus door content.** The door is built and configured (`bonus` in `theme.mjs`) but `content.mjs` has no
   `bonus` day yet, so the calendar shows 25 doors. Add the approved "Gifts for a King" text as
   `bonus: {day: 26, ...}` (and `day-26.svg`) before launch, or accept 25 doors and change what Day 21 promises.
5. **Flip the three launch flags together** in `modules/advent/theme.mjs`:
   - `goLive: true`: the real date now drives the calendar page and the home-page banner (until then it never does);
   - `publicListing: true`: the calendar page joins the sitemap and the site search and loses its noindex, and the
     Advent help guide rejoins the (help scope) search. This does not add a menu or footer link: add those as a
     separate, reviewed change if wanted;
   - `artRequired: true`: the build refuses to continue if any picture is missing or fails the check.

   They flip together on purpose: `test-unit/advent-launch-flags.test.mjs` and the theme validator refuse
   `goLive: true` without the other two. The reverse is allowed: `publicListing: true` without `goLive: true` lists
   the page in the sitemap and search while a real visitor still sees only the calm sentence (useful if Greg wants
   to list it early).
6. **Delete the three pre-launch guards**, which would otherwise fail (that is their job):
   - `test-unit/advent-prelaunch.test.mjs` (delete the file);
   - `test/advent-prelaunch.spec.ts` (delete the file: it fakes 12 December with the real flags and asserts the
     calendar page is calm and the home banner hidden);
   - the test named "PRE-LAUNCH: the sitemap and the search index do not mention the Advent calendar" at the
     end of `test/sitemap.spec.ts` (delete that test and its comment).
   No other test needs editing: every other test follows the flags, and the browser tests force `goLive` on
   through a route (`forceGoLive` in `test/support/advent.ts`).
7. **Run everything:** `npm run build`, `npm run test:unit`, `npm test`, `npm run audit`. All must pass.
8. **The home-page banner.** `src/pages/index.html` carries `{{ADVENT_TEASER}}`: one empty hidden container and a
   script tag in the home page source (Greg accepted this source-only mention while the calendar is hidden).
   `test-unit/advent-built.test.mjs` ("the home page and the (hidden) Advent banner") lists exactly what the page
   may contain. At launch the banner follows the dates by itself (live and archive); nothing to remove.
9. **Privacy policy:** update `src/pages/privacy-policy.html` only if something changed. It should not need
   to: the calendar stores nothing in the visitor's browser and uses no outside service. Confirm that is
   still true (the safety scans in `test-unit/advent-safety.test.mjs` enforce it).
10. **Decide the preview switch.** `previewEnabled` can stay on after 6 January or be turned off; Greg's call.
11. **Commit, tag, deploy.** Add the `/updates` entry, commit, tag `build-<date>.<NNN>`, push.
12. **Verify production after the deploy** (read-only):
    - `curl -I https://www.kingtonparishes.org.uk/advent` shows the normal security headers and a 200;
    - `curl -I` on one `/advent/art/day-NN.svg` and on `/advent/scene.svg` shows two Content-Security-Policy
      headers (the site one and `default-src 'none'; style-src 'unsafe-inline'; sandbox`);
    - `curl -I` on `/advent/day-03.json` shows `x-robots-tag: noindex`;
    - the hashed scripts and stylesheets (`/js/advent.js?v=...` and friends) come back with
      `cache-control: public, max-age=31536000, immutable` and the day files do not;
    - the browser console on `/advent` and `/advent?advent-preview=2026-12-07` has no errors and no CSP
      violations (Cloudflare can inject its own scripts: look for them);
    - `sitemap.xml` now lists the calendar page, and the site search finds it.

Notes: the repository is public, so `modules/advent/content.mjs` is readable on GitHub whatever the switches
say, and `public/advent/day-NN.json` can be fetched by anyone who guesses the address (the `X-Robots-Tag`
header only keeps crawlers away). The calendar is hidden, not secret.

## Picture-safety fixes (done, 13 Oct 2026)
- DONE: `lintSvg` caps `<use>` elements at 50 and refuses a `<use>` of an element that contains (or is) another
  `<use>` (no cycles, no self-reference): the "billion laughs" fix.
- DONE: `lintSvg` also bounds DRAW COST: resource references (mask, clip-path) may not nest or sit inside a mask or
  clipPath, and a weighted draw budget (cap 900) caps the total work: paths and polygons weigh by their segment count,
  masks and clip paths are charged per reference, gradients per stop. Dashed lines are not allowed, and there are caps
  on file size (40 KB), path data and numbers (see the README for every weight and limit). The hostile samples (mask
  and clipPath towers, heavy paths used 50 times, heavy masks, 6,000-point polygons, 100 KB paths) are must-reject
  tests, and `test/advent-svg-render.spec.ts` renders the heaviest accepted pictures in a real browser. Nothing to do
  at launch.
- New files under `public/js/advent*`, `public/js/advent/` or `public/css/advent*` need their own exact immutable rule in `public/_headers` (a unit test fails until they have one).
