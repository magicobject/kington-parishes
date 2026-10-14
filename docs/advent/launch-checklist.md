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
4. **The bonus door** is built and its text is in (`bonus` in `src/advent/content.mjs`, `day-26.svg` is in the art folder).
5. **Rehearse the launch, in a copy: `npm run advent:rehearse`.** It copies the repo to a temporary folder, flips the three flags,
   deletes the guard tests and applies the after-launch wording and the launch date exactly as steps 6 to 9 below say, builds, and then runs BOTH the unit suite
   and the whole browser suite (`npm test`, about 90 seconds more) there. It must print `REHEARSAL PASS` (and a line `kington-parishes (launched copy): N passed in Xs`).
   It never touches the real repo: the temporary folder is outside it, node_modules is copied (never linked), the browser suite runs on its own port,
   and the folder is removed at the end. `npm run advent:rehearse -- --unit-only` skips the browser suite: use it only for a quick look, not for this step.
6. **Flip the three launch flags together** in `src/advent/theme.mjs`:
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

   That is exactly, and only, what `npm run advent:rehearse` deletes: two files and one test, from one shared list
   (`GUARD_FILES` and `GUARD_TEST` in `scripts/advent-launch-steps.mjs`, checked against this text by a unit test). No other file or
   test needs deleting or editing: every other test follows the flags, the browser tests force `goLive` on through a route
   (`forceGoLive` in `test/support/advent.ts`), and `test-unit/advent-launch-rehearsal.test.mjs` (which describes the state BEFORE
   launch) skips itself once `goLive` is true, so it stays.
8. **Apply the after-launch wording: `npm run advent:after-launch`.** It edits `src/pages/help-advent.html` and the Advent section
   of `CLAUDE.md`, replacing every sentence that is only true while the calendar is hidden ("not public yet", "hidden from the
   public", "before launch", "nobody can find it", the pre-launch comments, and the "How to go live" section) with the wording
   in `docs/advent/after-launch/`. The command refuses, and names the edit, if any piece of text it expects is not found exactly
   once, and saying "already applied: nothing to do" (exit 0, no file changed) if you run it a second time. The full list of edits is under
   "After-launch edits" below. Do this BEFORE the next steps: with the flags on, a unit test fails while any stale wording is left.
9. **Fill in the launch date.** In `CLAUDE.md`, in the Advent section, the line `- **Launched** (date of the launch commit: ____)` came from step 8:
   replace the `____` with the real date of the launch commit (for example `2026-12-01`). A unit test fails while a literal `____` is left in
   that section once the flags are on. Then `npm run build`.
10. **Run everything with the flags flipped, in the real repo:** `npm run build`, `npm run test:unit` (the unit suite with the
   flags flipped and the wording applied: this is the run the rehearsal predicted), `npm test`, `npm run audit`,
   `npm run typecheck`. All must pass.
11. **Decide `previewEnabled` after the season (a step, not an afterthought).** Security recommends: keep it on until 6 January
   (so the team can still check any date), then set `previewEnabled: false` in `src/advent/theme.mjs` and deploy; with it false the preview
   parameter does nothing anywhere. Greg decides; write the decision in the launch commit message.
12. **Privacy policy:** update `src/pages/privacy-policy.html` only if something changed. It should not need to: the calendar
    stores nothing in the visitor's browser and uses no outside service. Confirm that is still true (the safety scans in
    `test-unit/advent-safety.test.mjs` enforce it).
13. **Share preview.** The page title ("Advent calendar", then the site name) and meta description ("Open a new door each day from
    1 to 25 December to read the Christmas story, from Genesis to Bethlehem.") come from the theme. The share image is the site's
    ordinary photo (`og:image` is unchanged); a dedicated image for the calendar is an optional later extra.
14. **Commit, tag, deploy.** Add the `/updates` entry, commit, tag `build-<date>.<NNN>`, push.

## After the deploy: verify production (read-only)

Run, from the repo root (replace `<n>` with the build number of the launch commit, for example `2026.12.01.004`):

```
npm run check:live -- --state launched --build <n> --wait
```

`--wait` polls `/updates` every 15 seconds until the build number appears (that is how you know Cloudflare has deployed), then runs
every check below against the live site and prints one PASS or FAIL line each, with the URL and the HTTP status. It exits 0 only if
every check passes. A page that does not answer HTTP 200 fails, because it proves nothing about what it contains. The checks
(`scripts/check-live.mjs`, tested in `test-unit/check-live.test.mjs`):

- `/updates` lists the build;
- on eight sample pages (`/`, `/church-kington`, `/advent`, `/calendar`, `/contact`, `/our-churches`, `/our-people`, `/services`) the
  sha256 of every executable inline script is in that response's Content-Security-Policy `script-src`;
- launched state: `sitemap.xml` lists the calendar page, the search index has exactly one public Advent entry, `/advent` is not
  `noindex` and says `data-go-live="true"` (the hidden state checks the opposite);
- no day title or text from `src/advent/content.mjs` is in the sitemap, the search index, `/advent` or the home page;
- every immutable-cached path in `public/_headers` returns exactly one `Cache-Control` with `immutable`, and a made-up neighbour path is
  a 404 without it; `/advent/day-03.json` has `x-robots-tag: noindex`; one `/advent/art/day-NN.svg` and `/advent/scene.svg` carry the
  site policy and the sandbox policy `default-src 'none'; style-src 'unsafe-inline'; sandbox` (as two headers or one joined header: it
  says which);
- all the day files and all the pictures (26 each while the bonus day exists) return 200.

Still by hand, in a browser (the command prints this reminder): the console on `/advent` and `/advent?advent-preview=2026-12-07` has no
errors and no CSP violations (Cloudflare can inject its own scripts: look for them), and the site search for "advent" gives one result.

Notes: the repository is public, so `src/advent/content.mjs` is readable on GitHub whatever the switches say, and
`public/advent/day-NN.json` can be fetched by anyone who guesses the address (the `X-Robots-Tag` header only keeps crawlers away).
The calendar is hidden, not secret.

## After-launch edits (step 8: `npm run advent:after-launch`)

Each edit finds one stale piece (by the start of its line, a range of lines, or exact text) and replaces it with the block of the
same id in `docs/advent/after-launch/help-advent.html.part` or `docs/advent/after-launch/CLAUDE-advent.md.part`. The rules are
in `scripts/advent-after-launch-edits.mjs`; `test-unit/advent-after-launch.test.mjs` proves that, once they are applied, none of the
stale wording is left, and that every edit is listed here.

`src/pages/help-advent.html`:

| id | what it finds | what it becomes |
| --- | --- | --- |
| `h-comment` | the line `<!-- PRE-LAUNCH TEXT: at launch replace the lede paragraph...` | removed |
| `h-lede` | the lede paragraph `<p class="lede">A calendar of 25 doors` ("is being built in stages and is **not public yet**: nobody can find it") | "It is **live** on the website from 1 December to 25 December, and stays open as The Christmas Story until 6 January" |
| `h-jump` | the jump link `<a href="#going-live">Going live</a>` (page header) | `<a href="#after-the-season">After the season</a>` |
| `h-good` | in "Good to know": ` (before launch this is the only way to see the calendar at all, whatever today's date)` | removed |
| `h-linked` | in "Look at it early": `The page is not linked from anywhere, so type it in or bookmark it.` | "The page is in the website's search and its sitemap but not in the menu or the footer, so you can also type the address in or bookmark it." |
| `h-exists` | in "What you will see": `the picture (once it exists), the Bible reference` | `the picture, the Bible reference` |
| `h-banner` | in "The home page banner": `Before launch it only appears when you add ?advent-preview=...; the real date shows nothing (and a preview...)` | "To see it on another date, add ?advent-preview=2026-12-07 to the home page address (...)" |
| `h-pictures` | in "The pictures": `Before launch every picture is also timed in a real browser. The pictures for all 26 days are in.` | "Every picture is also timed in a real browser whenever the tests run. The pictures for all 26 days are in." |
| `h-pictures-missing` | in "The pictures": `A day whose picture file is missing simply has none, until launch, when the website refuses to build without all of them.` | "The website refuses to build if a day's picture is missing." |
| `h-section` | the whole section from `<section class="alt" id="going-live">` ("How to go live", "Until we go live") to its `</section>` | a new section `id="after-the-season"`, "After the season" |

`CLAUDE.md` (the Advent calendar module section):

| id | what it finds | what it becomes |
| --- | --- | --- |
| `c-comment` | the line `<!-- PRE-LAUNCH STATE. At launch replace the five items marked [LAUNCH]...` | removed |
| `c-intro` | the intro line ``[LAUNCH] `modules/advent/` is a self-contained`` ("hidden from the public until launch") | the same intro, saying it is **live** |
| `c-launch` | the bullet `- [LAUNCH] **Launch:**` | `- **Launched** (date of the launch commit: ____)...` (fill in the date) |
| `c-flags` | the bullet `- [LAUNCH] **Three launch flags` | the flags bullet, all `true` |
| `c-home` | the bullet `- [LAUNCH] **Home page:**` (the empty container and scripts on the home page) | the home-page bullet, worded for the live calendar |
| `c-help` | the bullet `- [LAUNCH] The hidden help guide` | the help-guide bullet, listed in the help search scope |

Fill in the date in the `c-launch` result by hand (the `____`): that is step 9, and a unit test enforces it.

## Known limitation: the picture-cost check is a best-effort safety net (accepted by Greg, 14 Oct 2026)
The picture-cost lint estimates how costly a picture is to draw; it is a safety net, not a proof. The real pictures are hand-made, reviewed, and every one is timed in a real browser by the test suite. The security engineer showed the estimate can be fooled by unit suffixes (for example `10em` or `50%` written where a plain number is expected), duplicate style declarations, relative path commands, a root without a viewBox, and stroke widths in `em`. Greg accepted this on 14 Oct 2026 ("no real world threat"): the pictures are added only by the website team, so nothing here is reachable by a visitor. It is recorded so nobody mistakes the lint for a guarantee; the test suite's browser timing of the real pictures is what to rely on.

## Picture-safety fixes (done, 13 and 14 Oct 2026)
- DONE: `lintSvg` caps `<use>` elements at 50 and refuses a `<use>` of an element that contains (or is) another `<use>` (no cycles,
  no self-reference): the "billion laughs" fix.
- DONE: `lintSvg` also bounds DRAW COST: resource references (mask, clip-path) may not nest or sit inside a mask or clipPath, and a
  weighted draw budget (cap 900) caps the total work: paths and polygons weigh by their segment count, masks and clip paths are
  charged per reference, gradients per stop and per large area. Dashed lines are not allowed, an svg inside the svg is not allowed,
  and there are caps on file size (40 KB), path data and numbers (see the README for every weight and limit).
- DONE (14 Oct 2026, the security engineer's structural fix): paint is charged per PAINTED shape (a group's `fill` or `stroke` is
  inherited by every shape in it and through `<use>`; gradient paint inside a mask or clipPath is charged for every reference; a
  shape is "large" by its real size, counting percentages, path and polygon boxes, stroke width, scale transforms and scaled
  symbols), with two hard caps behind the weights: at most 20 shapes painted with a gradient and at most 15 large shapes.
  `test-unit/support/svg-attacks.mjs` holds the hostile pictures; `test/advent-svg-render.spec.ts` renders the largest accepted
  picture of every class at 400, 800 and 1200px in a real browser and requires each under a second. Nothing to do at launch.
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
