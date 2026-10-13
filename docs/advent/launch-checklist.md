# Advent calendar: launch checklist

This is the single source for going live. Everything here must be done, in this order, before the calendar is shown to the
public. Until then the calendar is hidden: a real visitor sees only the calm sentence on `/advent` (even in December) and
nothing on the home page; only `?advent-preview=2026-12-07` shows the calendar. Three guard tests keep it that way. Tick each
step in the launch commit message.

## Before launch

1. **Sign-offs.** The tester and the security-engineer have reviewed the real calendar (docs/advent/build-plan.md, Phase 5).
   The vicar's sign-off for the release version is recorded (spec AC32). Greg approves the wording of every day (done for the
   changes of 13 Oct 2026) and the home-page banner.
2. **Greg looks at every picture. STILL TO DO.** All 26 pictures (`public/advent/art/day-01.svg` to `day-26.svg`, nothing else
   in that folder) are in the site and show in the preview, but Greg has not yet signed each one off. The build refuses a
   picture that is unsafe OR too costly to draw (the lint bounds draw cost with a weighted budget: see the README, "Adding a
   picture"), `npm test` renders EVERY real picture and the scene in a real browser and fails if any takes 300 ms or more
   (`test/advent-svg-render.spec.ts`), and `test-unit/advent-art.test.mjs` builds in the strict launch mode against them.
3. **Look at the real thing** in preview on every date (docs/advent/ux-design.md), on a phone and a desktop, at 200% text size,
   including the home page with `/?advent-preview=2026-12-07` and the archive with `/advent?advent-preview=2026-12-28`.
4. **The bonus door** is built and its text is in (`bonus` in `modules/advent/content.mjs`, `day-26.svg` is in the art folder).
5. **Rehearse the launch, in a copy: `npm run advent:rehearse`.** It copies the repo to a temporary folder, flips the three flags,
   deletes the three guard tests exactly as steps 6 and 7 below say, builds, and runs the unit suite there. It must print
   `REHEARSAL PASS`. It never touches the real repo (the temporary folder is outside it and is removed at the end).
6. **Flip the three launch flags together** in `modules/advent/theme.mjs`:
   - `goLive: true`: the real date now drives the calendar page and the home-page banner (until then it never does);
   - `publicListing: true`: the calendar page joins the sitemap and the site search and loses its noindex, and the Advent help
     guide rejoins the (help scope) search. This does not add a menu or footer link: add those as a separate, reviewed change if
     wanted;
   - `artRequired: true`: the build refuses to continue if any picture is missing or fails the check.

   They flip together on purpose: `test-unit/advent-launch-flags.test.mjs` and the theme validator refuse `goLive: true` without
   the other two. The reverse is allowed: `publicListing: true` without `goLive: true` lists the page in the sitemap and search
   while a real visitor still sees only the calm sentence (useful if Greg wants to list it early). The unit-test fixture themes pin
   all three flags to `false` (`test-unit/support/fixture-flags.mjs`), so flipping the real ones changes no fixture.
7. **Delete the three pre-launch guards**, which would otherwise fail (that is their job):
   - `test-unit/advent-prelaunch.test.mjs` (delete the file);
   - `test/advent-prelaunch.spec.ts` (delete the file: it fakes 12 December with the real flags and asserts the calendar page is
     calm and the home banner hidden);
   - the test named "PRE-LAUNCH: the sitemap and the search index do not mention the Advent calendar" at the end of
     `test/sitemap.spec.ts` (delete that test and its comment).

   No other test needs editing: every other test follows the flags, and the browser tests force `goLive` on through a route
   (`forceGoLive` in `test/support/advent.ts`).
8. **Run everything with the flags flipped, in the real repo:** `npm run build`, `npm run test:unit` (the unit suite with the
   flags flipped: this is the run the rehearsal predicted), `npm test`, `npm run audit`, `npm run typecheck`. All must pass.
9. **Decide `previewEnabled` after the season (a step, not an afterthought).** Security recommends: keep it on until 6 January
   (so the team can still check any date), then set `previewEnabled: false` in `theme.mjs` and deploy; with it false the preview
   parameter does nothing anywhere. Greg decides; write the decision in the launch commit message.
10. **Replace the hidden-state wording** with the AFTER LAUNCH text below: `CLAUDE.md` (the Advent section) and
    `src/pages/help-advent.html`. The pre-launch sentences ("hidden from the public", "not public yet", "nobody can find it") are
    untrue once the flags are on. Then `npm run build`.
11. **Privacy policy:** update `src/pages/privacy-policy.html` only if something changed. It should not need to: the calendar
    stores nothing in the visitor's browser and uses no outside service. Confirm that is still true (the safety scans in
    `test-unit/advent-safety.test.mjs` enforce it).
12. **Share preview.** The page title ("Advent calendar", then the site name) and meta description ("Open a new door each day from
    1 to 25 December to read the Christmas story, from Genesis to Bethlehem.") come from the theme. The share image is the site's
    ordinary photo (`og:image` is unchanged); a dedicated image for the calendar is an optional later extra.
13. **Commit, tag, deploy.** Add the `/updates` entry, commit, tag `build-<date>.<NNN>`, push.

## After the deploy: verify production (read-only)

- `curl -I https://www.kingtonparishes.org.uk/advent` shows the normal security headers and a 200;
- `curl -I` on one `/advent/art/day-NN.svg` and on `/advent/scene.svg` shows two Content-Security-Policy headers (the site one and
  `default-src 'none'; style-src 'unsafe-inline'; sandbox`);
- `curl -I` on `/advent/day-03.json` shows `x-robots-tag: noindex` and `cache-control: public, max-age=0, must-revalidate`;
- the hashed scripts and stylesheets (`/js/advent.js?v=...` and friends) come back with
  `cache-control: public, max-age=31536000, immutable`, and a made-up path such as `/js/advent/nothing.js` does not;
- the browser console on `/advent` and `/advent?advent-preview=2026-12-07` has no errors and no CSP violations (Cloudflare can
  inject its own scripts: look for them);
- `sitemap.xml` now lists the calendar page, and the site search finds it exactly once;
- **no day title or text is in the pages that are not the calendar's own day files** (the sitemap, the search index, the calendar
  page and the home page). Run, from the repo root:

```
node --input-type=module -e "const {content}=await import('./modules/advent/content.mjs');const titles=[...content.days,content.bonus].map((d)=>d.title);for(const u of ['sitemap.xml','search-index.json','advent','']){const t=await (await fetch('https://www.kingtonparishes.org.uk/'+u)).text();const hits=titles.filter((x)=>t.includes(x));console.log(u||'/',hits.length?'LEAK: '+hits.join(', '):'clean');}"
```

  Every line must say `clean`.

Notes: the repository is public, so `modules/advent/content.mjs` is readable on GitHub whatever the switches say, and
`public/advent/day-NN.json` can be fetched by anyone who guesses the address (the `X-Robots-Tag` header only keeps crawlers away).
The calendar is hidden, not secret.

## AFTER LAUNCH wording (copy and paste at step 10)

### CLAUDE.md: replace these five items of the "Advent calendar module" section

Intro paragraph (replaces the one that says "hidden from the public until launch"):

> `modules/advent/` is a self-contained, transferable Advent calendar (spec `docs/specs/advent-calendar.md`, plan `docs/advent/build-plan.md`, details `modules/advent/README.md`). It is **live**: the page `/advent` shows the real calendar from 1 December (door grid, day dialog, gentle "not quite yet" message, share, print, archive until 6 January, the 6 January bonus door) and the home page shows a banner while it is open; before and after the season the page shows only the calm sentence "The Advent calendar opens on 1 December.". The page is in the sitemap and the site search, but in no nav or footer link. `?advent-preview=2026-12-07` still shows any date while `previewEnabled` is true.

"Launch" item:

> - **Launched** (date of the launch commit: ____). The three launch flags in `theme.mjs` (`goLive`, `publicListing`, `artRequired`) are all `true`, and the three pre-launch guard tests are gone. `VERSION`/`MANIFEST.sha256` pin the generic code: after changing it run `npm run advent:manifest` and bump `VERSION`. Fixture themes in the unit tests pin the three flags to false (`test-unit/support/fixture-flags.mjs`); keep it that way.

"Three launch flags" item:

> - **Launch flags in `theme.mjs`:** `goLive` (the real date drives the calendar and the home banner), `publicListing` (in the sitemap and search, no noindex) and `artRequired` (the build refuses a missing `public/advent/art/day-NN.svg`) are `true`; the schema refuses `goLive` without the other two. `previewEnabled` decides whether `?advent-preview=` still works: security recommends setting it to `false` after 6 January.

"Home page" item (replace its last sentence about Greg accepting a source-only mention):

> - **Home page:** `src/pages/index.html` has `{{ADVENT_TEASER}}` inside the hero section: one empty hidden container and a script tag, no text, link or heading in the source; the banner script builds the banner and shows it only inside the season. `test-unit/advent-built.test.mjs` documents exactly what the home page may contain.

Help-guide item:

> - The help guide `src/pages/help-advent.html` (plain English: previewing, editing a day, replacing a picture, after the season) is now listed in the help search scope and may mention the calendar; no other page may mention `advent-preview`, besides the unlinked `/updates`.

### help-advent.html: replace these parts

Lede paragraph (replaces the "not public yet" one):

> A calendar of 25 doors for December, with one short Bible story behind each. It is **live** on the website from 1 December to 25 December, and stays open as "The Christmas Story" until 6 January. This page explains how to look at it on any date, what you will see, how to change a day's words or picture, and what to do after the season.

The whole "How to go live" section (id `going-live`; also rename its jump link and heading to "After the season") becomes:

> **After the season.** The calendar closes by itself on 7 January: the page shows "The Advent calendar opens on 1 December." until next year. Nothing needs switching off. To stop people using the pretend-date trick, set `previewEnabled` to false (ask Claude); to put the calendar away completely, set `adventEnabled` to false. To run it again next year, check the dates and the words, add any new pictures, and ask Claude to run the tests.

In the "What you will see" section, delete the sentence that says the real date shows nothing before launch, and in "Good to know" remove "(before launch this is the only way to see the calendar at all, whatever today's date)".

## Picture-safety fixes (done, 13 Oct 2026)
- DONE: `lintSvg` caps `<use>` elements at 50 and refuses a `<use>` of an element that contains (or is) another `<use>` (no cycles,
  no self-reference): the "billion laughs" fix.
- DONE: `lintSvg` also bounds DRAW COST: resource references (mask, clip-path) may not nest or sit inside a mask or clipPath, and a
  weighted draw budget (cap 900) caps the total work: paths and polygons weigh by their segment count, masks and clip paths are
  charged per reference, gradients per stop and per large area. Dashed lines are not allowed, and there are caps on file size
  (40 KB), path data and numbers (see the README for every weight and limit). The hostile samples are must-reject tests, and
  `test/advent-svg-render.spec.ts` renders the heaviest accepted pictures at 400, 800 and 1200px in a real browser. Nothing to do
  at launch.
- New files under `public/js/advent*`, `public/js/advent/` or `public/css/advent*` need their own exact immutable rule in
  `public/_headers` (a unit test fails until they have one).

## Content decisions made (13 Oct 2026, Greg)
- The "Try this together" activity and the hidden-detail hint are removed everywhere (the content fields `activity` and `hidden` no
  longer exist; a day carrying either is refused). The pictures keep their hidden objects (the Day 25 picture was simplified).
- Day 3 says "Hergest Ridge" (the "Radnor hills" confirmation is resolved), and the Day 13 prayer says "our villages and towns" (the
  "our village and town" confirmation is resolved). Days 24 and 25 are date-neutral, so every day reads correctly whenever it is
  opened, including 26 December to 6 January. Day 21 ends "We will meet them properly at Epiphany, on 6 January."
- Wording fixes: Day 1 ("Every dawn since then has been a small reminder..."), Day 2 ("He came looking. "Where are you?" he asked.")
  and Day 4 ("Many centuries later").
- The Day 21 and Day 26 pictures still draw three travellers although no text says how many there were (a decision for Greg).
