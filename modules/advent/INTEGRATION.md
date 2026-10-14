# Adding the Advent calendar to another church website

## In plain English (read this first)

**What you are adding.** An Advent calendar for your church's website: 25 little doors, one opening each day from 1 December, each with a short
Bible story, a picture and a prayer, plus an optional banner on the home page. It sets no cookies, stores nothing about visitors and uses no
outside service. Until the church decides to launch it, the page exists but shows only the sentence "The Advent calendar opens on 1 December."
and appears nowhere (no menu, no search, no sitemap), so nothing here can show on your live site by accident.

**Who does what.**
- **A developer** (someone who already looks after your website's code) does the 14 numbered steps below. It takes a few hours the first time.
- **A content person** supplies the 25 days of text (a title, a Bible reference, a short story of a few paragraphs, a question to think about, a
  prayer, and a description of the picture for people who cannot see it) and 25 pictures (or asks an illustrator for them). Story text and pictures
  must be your own or used with permission. The calendar's example text and the original site's text and pictures are placeholders, not for publishing.
- **The church** (vicar, wardens or website group) chooses the launch date, reads the finished days, and says yes.

**What to ask your developer for.** "Please add the Advent calendar module following `modules/advent/INTEGRATION.md`, keep it hidden until we launch,
and show me the preview at `/advent.html?advent-preview=2026-12-12` when it is ready." Later: "Please launch the calendar" (step 14).

**What is not decided here.** The terms on which this code may be shared with other churches are for the maintainer of the reference site to set;
until they say otherwise, treat it as available only to the sites that maintainer builds.

The rest of this guide is for the developer. Each step says how to check it worked. It was followed step by step on copies of two sibling
church sites to make sure it works; the fixes those runs produced are in it.

## What you are getting, and what you are not

- **Generic (the same for everyone):** everything in `modules/advent/` except `examples/`. It never mentions a particular
  church or person, and a test makes sure of that. You copy it and do not edit it.
- **Templates:** `modules/advent/examples/theme.mjs` and `content.mjs` are *placeholders* ("Example Parish", 25 days of
  "Title here", their own colour palette). They are a template, **not content to publish**. The build refuses to run while your files are still equal
  to them, and refuses to go live while any example text is left in a day or in the theme.
- **Yours:** `src/advent/theme.mjs` (name, dates, colours, switches) and `src/advent/content.mjs` (the 25 days of story text), plus
  your own pictures in `public/advent/art/`. These live outside the module so copying the module never copies anyone's text.
- **Licensing:** the reference site's story text and pictures are **not shared**. Replace every word and picture with your own (or
  with material you have permission to use). The terms on which the generic code itself may be shared are the maintainer's decision.

## Features the host site must have

The calendar quietly depends on five things in your site's build. Look for each *before* you start.

| # | Feature | Where to look | What it must do |
|---|---------|---------------|-----------------|
| 1 | `page.headHtml` | `scripts/build.mjs`, where `extraHead` is made | Put the page entry's `headHtml` text into the page `<head>` (the calendar page's two stylesheets and its script). |
| 2 | `page.unlisted` | `scripts/build-search-index.mjs`, `isIndexable` | A page with `unlisted: true` is left out of the sitemap and the search index; any value that is not `true`/`false` stops the build. This is what keeps the calendar hidden. |
| 3 | `data-search-skip` | `scripts/build-search-index.mjs`, `extractSearchEntries` | Elements carrying `data-search-skip` are removed before the page is indexed. |
| 4 | Content-hashed addresses | `scripts/build.mjs` | Every same-origin `<link>`/`<script>` address gets `?v=<content hash>` (and a missing file fails the build), and the Advent files are written **before** the page loop so their hashes are this build's. The year-long cache rules in step 11 are safe only because of this. |
| 5 | Token order | `scripts/build.mjs`, the page loop | `renderAdventToken` and `renderAdventTeaserToken` run on the page source *before* `ensureSectionIds`, so the calendar's headings get ids and are searchable. |

If feature 1, 2 or 3 is missing, `modules/advent/host-patches/` has ready-made patches (read its `README.md`: it says which variant fits which shape of
build, and gives the hand edit if a patch will not apply; check with `git apply --check <patch>`, then `git apply <patch>`). Feature 4 has a tested
snippet, `modules/advent/host-kit/version-asset-urls.mjs` (step 3). Feature 5 is step 8.

You also need: a Content-Security-Policy in `public/_headers` with `script-src 'self'` and no `'unsafe-inline'` for scripts (the calendar
adds no inline script), a local static server that serves `.json` and `.svg` files with the right types, and a Node version that supports
top-level await in .mjs files (the reference site runs Node 24). If your files use Windows line endings (CRLF), make the edits below in an editor
rather than with scripts that look for line breaks.

## Steps

1. **Work in your own branch and worktree** (`git worktree add <folder> -b claude/advent`). In the new folder get `node_modules` by COPYING the
   existing folder from your main checkout (never link it); only if you have none, run `npm ci` there.
2. **Copy the module.** Copy the whole folder `modules/advent/` from the reference site repository (ask the maintainer which repository and
   branch; it is the site this module is developed in) into your repository's `modules/`.
   Do not copy anything from the reference site's `src/advent/` (that is its text). Check: `modules/advent/VERSION` exists and
   `node -e "import('./modules/advent/make-manifest.mjs').then(m=>process.stdout.write(m.manifestText()))"` prints exactly what is in `modules/advent/MANIFEST.sha256`.
3. **Copy the host kit.** From `modules/advent/host-kit/` copy `advent-config.mjs` and `advent-headers.mjs` into `scripts/`, and
   `advent-headers.test.mjs`, `advent-host-features.test.mjs` into `test-unit/`. If your build lacks content-hashed addresses (feature 4) also copy
   `version-asset-urls.mjs` into `scripts/` and `advent-version-asset-urls.test.mjs` into `test-unit/`. Add two lines to `package.json` scripts:
   `"advent:headers": "node scripts/advent-headers.mjs"` and `"advent:manifest": "node modules/advent/make-manifest.mjs"`.
4. **Check the five host features** in the table above and apply any missing patch or snippet. Check: `node --test test-unit/advent-host-features.test.mjs`.
   Tests 1, 2 and 3 must pass now. Test 4, 5 and the last one (the page list) pass only after steps 6 to 8 and a build, so a failure there is expected here.
5. **Write your own settings and content.** Copy `modules/advent/examples/theme.mjs` to `src/advent/theme.mjs` and
   `modules/advent/examples/content.mjs` to `src/advent/content.mjs`. In each file delete the comment block at the very top (everything
   before the first line of code: it says TEMPLATE and is no longer true). Edit the theme: `siteName`, `translationName`, `timeZone`,
   the `colours` (the example palette passes the contrast rules; if you change any colour, check every pair again: the reference site's
   `test-unit/advent-contrast.test.mjs` lists the pairs and shows how), and leave `publicListing`, `artRequired` and `goLive` all `false`. Replace all
   25 days with your own text (the rules and limits are at the top of `modules/advent/day.mjs`; write titles without "Day 1:", because the page
   already says "Day 1"). Even just to try the calendar out, change at least the `siteName` and one day: a file that is still equal to its template is refused.
6. **Add the page to your page list.** In `src/pages.config.mjs`, above the first `export`, add
   `import { fileURLToPath } from 'node:url';`, `import { adventPageEntry } from '../modules/advent/build.mjs';` and
   `import { loadAdventConfigOrExit } from '../scripts/advent-config.mjs';`, then
   `export const adventConfig = await loadAdventConfigOrExit(fileURLToPath(new URL('..', import.meta.url)));` and
   `export const adventPage = adventPageEntry(adventConfig.theme);`, and put `adventPage` inside the `PAGES` list (before the `updates` page is a good place).
   It is in no navigation, footer or link. Check:
   `node -e "import('./src/pages.config.mjs').then(m=>console.log(m.adventPage))"`
   prints an entry with `unlisted: true` and `robots: 'noindex, nofollow'`. If it says "missing" or "still the placeholder", go back to step 5.
7. **Add the page source.** Create `src/pages/advent.html` in your site's usual page frame (copy a simple page such as the safeguarding
   page: `<main id="main">`, a `page-header` block with a single `<h1>Advent</h1>`, then a section holding the token `{{ADVENT}}` where the calendar goes).
   The calendar adds only `<h2>` headings, so the page must have exactly one `<h1>`.
8. **Call the build and the tokens.** In `scripts/build.mjs`: add `adventConfig` and `adventPage` to the import from `../src/pages.config.mjs`; import
   `buildAdvent`, `renderAdventToken`, `renderAdventTeaserToken` from `../modules/advent/build.mjs`; **before the page loop** (just above where
   `searchEntries` is declared) call
   `const advent = buildAdvent({ theme: adventConfig.theme, content: adventConfig.content, publicDir: join(root, 'public'), siteUrl: SITE_URL, pageNames: PAGES.filter((page) => page !== adventPage).map((page) => page.slug) });`
   and, under it, `console.log(`built public/advent/ (${advent.files.length} files)`);`.
   **Leave the calendar out of `pageNames` by identity (`page !== adventPage`), never by comparing slugs.** Comparing slugs removes a clashing page before
   the module can notice, and then one page silently replaces the other.
   In the page loop wrap the page source so the Advent tokens are the INNERMOST step, inside `ensureSectionIds(...)`:
   `ensureSectionIds(...your other token steps...(renderAdventTeaserToken(renderAdventToken(read(...).trimEnd(), advent.tokenContext), advent.tokenContext)))`.
   If your build has no content-hashed addresses yet, add them now (`version-asset-urls.mjs`, see `host-patches/README.md`).
   Check: `npm run build` prints `built public/advent/ (N files)` and writes `public/advent.html`, and now all of
   `node --test test-unit/advent-host-features.test.mjs` passes. Also check the clash guard by hand once: set `slug: 'contact'` (any other page's name)
   in `src/advent/theme.mjs`, run the build, expect it to stop with "already used by another page", then put `'advent'` back.
9. **(Optional) the home-page banner.** In `src/pages/index.html` put `{{ADVENT_TEASER}}` as the last thing INSIDE the hero section (after the
   hero's inner `<div class="wrap">`, before `</section>`). It adds one empty hidden container and two script tags, and shows nothing outside
   the season. Skip this step if you do not want a banner.
10. **Pictures.** Make 25 pictures, `public/advent/art/day-01.svg` to `day-25.svg` (rules in `README.md`, "Adding a picture"; the folder may hold
    nothing else). Until you have them leave `artRequired: false`; a day without a picture simply has none. For testing only, 25 tiny valid
    placeholder SVGs are enough (a `<svg>` with a `viewBox`, a `<title>` and a rect), but never launch with them. Name your own scene in the theme
    (`scene: 'scene.svg'`, a file in `public/advent/`) or leave `scene: null` for the plain hills.
11. **Headers.** Only when content-hashed addresses work (feature 4: the host-features test passes) run `npm run --silent advent:headers` (the `--silent`
    keeps npm's own lines out) and paste its output into `public/_headers`, after the site-wide `/*` block, with a blank line before it.
    **Do not paste the cache rules before that:** a year-long cache on files with no hash in their address keeps visitors on old files.
    These rules are the stricter policy for pictures, noindex for the day files and one exact cache rule for each built script and stylesheet. Check:
    `node --test test-unit/advent-headers.test.mjs` passes (it fails whenever `_headers` and the printed rules differ, so re-run it after a module
    upgrade). The static server does not apply `_headers`, so also run `npx wrangler dev --port <a free port>` (the first run downloads wrangler), open
    the pages and watch the browser console for policy errors; stop it by its process id when done (kill the parent node process, or its workerd restarts).
12. **Tests.** Make your own tests know about the new page:
    - *Accessibility:* add `/advent.html` to the list of pages your accessibility test scans (in `test/support/pages.ts` the list of all pages, with
      `heading: /^advent$/i`). If your site has no such list, add the path to whatever list your accessibility test loops over, or add one test that
      opens `/advent.html` and runs the same scan.
    - *Sitemap:* the page must NOT be in the sitemap yet. If your sitemap test checks that every page is listed, add `/advent.html` to its list of
      exceptions (`NOINDEX_PATHS` in some sites). If it has no such list, add an exception in whatever way that test skips pages, or the test fails (that
      failure is the hidden-page guarantee working).
    - *Pre-launch guard* (deleted at launch): add to your sitemap spec a test named `PRE-LAUNCH: the sitemap and the search index do not mention the Advent calendar`
      that fetches `/sitemap.xml` and `/search-index.json`, removes your OWN ordinary mentions of the word from the search text, and expects `advent`
      to be gone. Keep the removable phrases in one short, documented list at the top of the test, for example
      `const OWN_MENTIONS = ['Advent Sunday', 'Advent, Epiphany, Holy Week and Easter'];`, and strip each (case-insensitively) before checking. A real church
      page says things like "our Advent, Epiphany, Holy Week and Easter services", and without this list the guard fails on the first run. Add to the list only phrases
      a person wrote; never strip anything the calendar produces.
    Then run everything: unit tests, typecheck, the browser tests and the audit. Also open `/advent.html?advent-preview=2026-12-12` and check: the doors
    appear, a door opens a day, the picture shows, and the browser console shows no errors; the plain address shows only "The Advent calendar opens on 1 December."
13. **Tell the next person.** Add a short section to your `CLAUDE.md`: "`modules/advent/` is generic: never edit it; your site's words
    are `src/advent/`; the three launch flags stay false until launch; run `npm run advent:headers` after upgrading the module." Nothing is needed
    in the privacy policy: the calendar sets no cookies, stores nothing in the browser and uses no outside service.
14. **Launch (later).** Use the reference repository's `docs/advent/launch-checklist.md` as the model: rehearse first, then flip
    `goLive`, `publicListing` and `artRequired` together in `src/advent/theme.mjs`, delete the pre-launch guard test from step 12, build, check production.
    The three flags are refused unless they flip together, and with `goLive` on the build also refuses any day or theme field that still holds the
    example's own text (it names what is left). Things that happened in a trial launch on a sibling site and that you should expect:
    the sitemap then lists `/advent.html` and the page loses its noindex tag; a site-wide test such as "every page carries noindex" must exclude the
    calendar page; and a site-wide `X-Robots-Tag: noindex` rule in `_headers` (a site that is not live yet) still applies to the calendar until the site itself goes live.

## Known limits (for a later version)

- The calendar has exactly 25 doors (plus an optional 26th "bonus" door on a date you choose), wording such as "Christmas Day" for the star
  door and "December", the English (UK) language, and the preview address `?advent-preview=`. These are fixed in the module.
- The data folder is always `/advent/` (day files, pictures, scene) even if your page address (`slug`) is different.
- The module's own unit tests are still in the reference repository's `test-unit/advent-*.test.mjs` and use its content; only the host kit tests travel with the module.
- `modules/advent/VERSION` and `MANIFEST.sha256` let you check that your copy equals the reference copy.

## Adoption checklist

- [ ] Own branch and worktree; `node_modules` copied, not linked.
- [ ] `modules/advent/` copied; manifest matches.
- [ ] Host kit copied; `package.json` scripts added.
- [ ] Five host features present (host-features test passes after step 8).
- [ ] `src/advent/theme.mjs` and `content.mjs` are yours (comment blocks removed); all three launch flags `false`.
- [ ] Page entry exported as `adventPage` and in `PAGES`; `src/pages/advent.html` written.
- [ ] `buildAdvent` called before the page loop with `pageNames` left out by identity; tokens nested before `ensureSectionIds`; slug-clash tried by hand.
- [ ] (Optional) `{{ADVENT_TEASER}}` inside the home page hero.
- [ ] Pictures made (or knowingly missing); `artRequired` still `false`.
- [ ] Content-hashed addresses working BEFORE `npm run --silent advent:headers` is pasted into `_headers`; headers test passes; checked under `wrangler dev`.
- [ ] Accessibility test lists the page; sitemap test excludes it and has the pre-launch guard with its own exemption list; full suite and audit green.
- [ ] `?advent-preview=2026-12-12` shows the calendar, a day opens, no console errors; the plain address shows only the calm sentence.
- [ ] `CLAUDE.md` note written.
- [ ] Launch plan agreed with the church (step 14).
