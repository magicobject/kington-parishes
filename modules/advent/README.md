# Advent calendar module

A small, self-contained module for a church website's Advent calendar: 25 doors,
one opening each day from 1 December, with a short Bible story, a picture and a
prayer. It is built so another church on the same website system can adopt it by
changing its settings and its content, not its code.

## What is in this folder

Generic code (the same for every church, never mentions a particular church):

- `date.mjs` works out the calendar day in the church's time zone and which doors are open.
- `preview.mjs` handles the demo switch that lets staff pretend it is another date.
- `schema.mjs` checks the settings and the 25 days of content (plus the optional bonus day) and refuses anything unsafe; `day.mjs` holds the rules for one day (no imports, so the browser runs them too); `logic.mjs` holds the pure helpers the page scripts use.
- `VERSION` and `MANIFEST.sha256` (made by `make-manifest.mjs`, `npm run advent:manifest`) pin the generic code.
- `build.mjs` is the build step: it checks everything, writes the generated files, and supplies the page markup and the page's entry for the host's page list.
- `client/` holds the browser files, written by hand and copied by the build: `advent.js` and `advent.css` (the calendar page), `advent-teaser.js` and `advent-teaser.css` (the home-page banner) and `scene.svg` (the plain default scene).

Site-owned files (each church writes its own):

- `theme.mjs` holds the site name, dates, page address, switches and colours.
- `content.mjs` holds the 25 days of story text, references, picture names and descriptions.

## The bonus door (optional)

A site may add a 26th door that opens on a date inside the archive period (here 6 January, "Epiphany").
It needs two things: `bonus: {on: {month, day}, label}` in `theme.mjs` and a `bonus` day in `content.mjs`
(a normal day object numbered exactly 26, checked by the same rules). Until the content exists the calendar
shows 25 doors, so the theme setting can go in first. The door is "future" until its date and on the date
itself is "today" (the archive's last day); `day-26.json` is written beside the others and `day-26.svg` is
allowed in the art folder. The date rules live in `date.mjs` (`doorState(26, parts, season, bonus)`).

## What it does not do

It stores nothing in the visitor's browser: no cookies and no saved settings.
Progress is simply today's date, so no memory is needed. It uses no outside
services and has no dependencies. The date logic runs in Node, a browser or a Worker.

## What exists now (phases 0 to 3 of docs/advent/build-plan.md)

The calendar is built into the site but **hidden**: the theme's launch flags (`goLive`, `publicListing`, `artRequired`, all false) keep it so. With today's real date, even in December, the page shows only
the calm sentence "The Advent calendar opens on 1 December." With `?advent-preview=2026-12-07` on the page's address (or
on the home page's, for the banner) it pretends to be that date, shows a notice (a polite live region) and an "Exit
preview" link, and works exactly as it will on the day. The design is `docs/advent/ux-design.md`.

What a visitor gets, by season (all computed in the browser from the London date):
- **Before and after:** the calm sentence only. No day file is even requested.
- **1 to 25 December (live):** a night-sky scene with the doors as real buttons in a grid, states "not yet" (dashed, dated), "today" (gold, the word Today) and open; a status line ("Today is Day 12: <title>"), an "Open today's door" button, and the star over the ridge from 25 December.
- **26 December to 6 January (archive):** "The Christmas Story", every door open, none "today", the star, and the bonus door opening on its date.
- **Opening a door:** a native `<dialog>` (full-screen sheet on phones) with picture (when its file exists), reference, translation credit, story, "Think about it", "Try this together", prayer, hidden-detail hint, previous and next buttons named with the target day, Share (`navigator.share`, else Copy link, else a read-only box) and "Print this day". Focus moves to the title, Escape or Close returns focus to the door, and a polite live region says "Day 7 opened". A day that fails to load (a bad status, a type that is not JSON, over 64 KB, malformed, the wrong day, or no answer in 10 seconds) shows the friendly sentence and a "Try again" button; a failure is never cached, and the live region announces "Opening the door" and the error. Dragging a text selection out of the panel onto the backdrop does not close the dialog (it closes only when the press and the click are both on the backdrop). The page behind does not scroll while a day is open. The hidden-detail hint is only offered when the day has a picture. A future door shows the gentle message ("Not yet. This door opens on 12 December." with "Open it anyway" and "Not yet"). `#day-7` opens a day directly.
- **Staying current:** the page works out the date once, then again when the tab comes back into view and at the next London midnight (ONE timer, computed from the date logic and never longer than 26 hours; a preview date is fixed and never refreshes). A refresh never disturbs an open dialog: it waits until the dialog closes.
- **Home-page banner:** `{{ADVENT_TEASER}}` (see below).

### How it is wired into the site

- `scripts/build.mjs` calls `buildAdvent({theme, content, publicDir, siteUrl, pageNames})` once. It checks the theme and content with the validators and uses the copies they return, checks the pictures and the scene, and only then writes:
  - `public/advent/day-01.json` to `day-25.json` (and `day-26.json` when the bonus has content), plain text, fixed key order, checked again;
  - `public/css/advent-theme.css` (the colours as `--advent-*` variables);
  - `public/css/advent.css`, `public/css/advent-teaser.css`, `public/js/advent.js`, `public/js/advent-teaser.js` (copies of `client/`);
  - `public/js/advent/date.js`, `preview.js`, `day.js`, `logic.js` (copies of the pure modules). One source of truth: the browser runs the same files the tests do. The build rewrites each client import line to point at the copies and adds a content hash, so a changed copy is never served stale;
  - `public/advent/scene-default.svg` only when the theme names no scene of its own.

  Every generated file carries an AUTO-GENERATED banner (JSON cannot) and is written the same way every time.
- The pure, browser-safe code: `date.mjs` (dates, season and door states, the bonus door), `preview.mjs`, `day.mjs` (the rules for one day, no imports, so the browser checks every fetched day with the build's own rules) and `logic.mjs` (settings, addresses, labels, share links, the size-capped `fetchDayFile`). The two page scripts only wire these to the page.
- `renderAdventToken` replaces `{{ADVENT}}` with markup only (settings as `data-*`, the status line, the primary button, an empty door list, the scene holder, a no-JavaScript note). `renderAdventTeaserToken` replaces `{{ADVENT_TEASER}}` (below). `adventPageEntry(theme)` gives `src/pages.config.mjs` the page's entry.
- `public/_headers` has extra tightening rules for `/advent/art/*`, `/advent/scene*.svg` and `/advent/day-*.json` (see below).

### The launch flags
Three theme flags flip together at launch: `goLive` (until true, a real visitor ALWAYS gets the calm state on the calendar page and the home banner, whatever the date; the markup says `data-go-live="true"` only when it is on, and anything else is read as off), `publicListing` (sitemap, search, no noindex) and `artRequired` (the build refuses missing pictures). The theme validator and `test-unit/advent-launch-flags.test.mjs` refuse `goLive: true` without the other two. `publicListing: true` without `goLive: true` is allowed (the page is listed while a real visitor still sees only the calm sentence). `?advent-preview=` works whatever the flags say: it is the only way to see the calendar before launch. `test/advent-prelaunch.spec.ts` (deleted at launch) fakes 12 December with the real flags and asserts the calendar stays hidden; the other browser tests force `goLive` on through a route (`forceGoLive` in `test/support/advent.ts`).

### The scene
The backdrop is a picture used as `<img alt="" aria-hidden>`. A site names its own with `scene: 'scene.svg'` in the theme (a hand-made file in `public/advent/`, linted like any picture, name must be `scene.svg` or `scene-<words>.svg` so the header rule covers it). Without one the build writes the module's plain hills scene (`client/scene.svg`) to `public/advent/scene-default.svg`. The star is CSS, not part of the picture.

### The home-page banner
`{{ADVENT_TEASER}}` expands to ONE empty, hidden `<div data-advent-teaser ...>` (settings as data attributes) plus the tag for `js/advent-teaser.js`. The page puts the token INSIDE the hero section, so that outside the season the page is laid out exactly as it was (nothing sits between the hero and the next section, which keeps that section's top border); to show the banner the script moves the container to just after the hero, and it brings its own border. While previewing on the home page it also shows the same "Preview mode" notice (a polite live region, with an Exit link to the home page with no parameter) and marks the page noindex, even when the preview date is outside the season. The script (which never loads the calendar script) reveals a banner only when the effective date is live or archive: the real date, or `?advent-preview=` on the home page. It fetches only today's day file for the title, adds the two stylesheets itself, and links to the calendar page with no query. Outside the season it does nothing, so the page is exactly as it was. The home page source mentions the calendar only in that container and script tag; a test (`advent-built.test.mjs`, "the home page and the (hidden) Advent banner") lists exactly what may be there.

### Theme tokens
Colours (generated from the theme into `--advent-*`): `night`, `sky2`, `ridge`, `cream`, `accent`, `accent-ink`, `door`, `door-locked`, `door-edge`, `paper`, `text`, `text-soft`, `link`, `focus`. Every pairing used is computed in `test-unit/advent-contrast.test.mjs` with the ratios in comments; a test refuses a literal colour in the stylesheets (except black and white for print). Non-colour tokens with defaults in `advent.css`: `--advent-door-size` (4.5rem), `--advent-gap` (0.75rem), `--advent-open-ms` (450ms), `--advent-story-size` (1.125rem), `--advent-line-height` (1.6). Fonts are the host site's: the module sets none and loads none.

### Adding a picture
Put `day-NN.svg` (NN = 01 to 25, or 26 for the bonus) in `public/advent/art/`; nothing else may be in that folder. `lintSvg` allows only: `svg g defs path circle ellipse rect line polyline polygon linearGradient radialGradient stop clipPath mask use title desc symbol`, a short list of plain attributes, and style settings `fill stroke stroke-width opacity stop-color stop-opacity color`. No text outside `title`/`desc`, scripts, links, entities, comments with markup. At most 100 KB, 20 levels, 2000 elements, **50 `<use>`**, and a `<use>` may not point at an element that contains another `<use>` (this stops "billion laughs" pictures). The lint also bounds the cost of DRAWING a picture, not only its size: a `mask` or `clip-path` may not sit on, or inside, a `<mask>` or `<clipPath>` (resource references cannot nest) and a `<use>` may not sit inside one; every drawn element weighs 1, a `<use>` weighs its whole target, an element with a mask, clip-path or opacity weighs 5 more (and 5 more per mask or clip-path reference), a `<mask>` or `<clipPath>` is charged per REFERENCE (its whole subtree weight times the number of elements that use it, counting each use of a group that holds a reference, because a browser redraws the whole mask for every element that references it), there are at most 20 mask or clip-path references in a picture and at most 50 elements inside any one mask or clipPath, and the total may not exceed **1500** (`MAX_DRAW_WEIGHT` in `build.mjs`; the 26 real drafts weigh 17 to 304); a dash shorter than 0.5 and any number over 100000 are refused. `svgDrawWeight(text)` measures a picture. Browser tests time the heaviest accepted pictures, rasterised onto a canvas at 400px and 800px wide (`test/support/heaviest-accepted.svg`, weight 1351, and `heaviest-mask-accepted.svg`, a 50-shape mask referenced 20 times, weight 1482), and require each to take under a second (they take about 30 to 220 ms; the 1800-circle, 136-reference mask that the earlier budget wrongly accepted took 4.8 s). Once the file exists the day file gets an `art` key and the panel shows it.

### Door layout
The numbered doors are a grid of 3, 4 or 6 columns (always a number that divides 24 evenly, so no row has a hole); a door's height comes from padding plus its content, so large text grows it instead of overflowing. The last door (the star door, Christmas Day) and the bonus door each take a whole row of their own, at least 72px tall and labelled "Christmas Day" or the bonus label, so no door is ever left alone on a row of a few. Their accessible names are unchanged.

### Caching
`public/_headers` gives each built Advent script and stylesheet its own EXACT rule for a one-year immutable cache (no wildcard, so a made-up path like `/js/advent/nonexistent.js` gets no such header on its 404). That is safe only because every reference to them is a content-hash address (`?v=`): in the page, in the banner's data attributes and in every import. A unit test checks every reference, and fails if a built file lacks its rule, a rule names a file that does not exist, or a rule is a wildcard; the day files, the scene and the pictures keep revalidating. (Cloudflare replaces its default `max-age=0, must-revalidate` with the header from `_headers`; two rules matching one file would send the value twice, so each file has exactly one.) The calendar page fetches the title of every open day when it loads (up to 26 small files, cached by the browser); that was left as it is because the door names need the titles.

### Safety rules the build enforces

- **Pictures** as above. The art folder may be absent, but if it exists it must be a real folder holding only the day pictures.
- **Client imports** are checked line by line: each browser file may import only the known pure modules; any other import (bare, dynamic, in a comment, a re-export) stops the build.
- **Page flags:** a page's `unlisted` setting must be exactly true or false, or the build stops.
- **Safety scans** (`test-unit/advent-safety.test.mjs`) check the source and everything built from it for unsafe browser APIs, storage, dynamic code, inline script and style.
- **Versioning:** `VERSION` and `MANIFEST.sha256` pin the generic files. After changing them, bump `VERSION` and run `npm run advent:manifest`; a unit test fails until you do.

### What the headers do

- `/advent/art/*` and `/advent/scene*.svg` get an extra, stricter Content-Security-Policy (it can only tighten the site's).
- `/advent/day-*.json` gets `X-Robots-Tag: noindex`, which asks crawlers to stay away. It does **not** hide the files: anyone who knows or guesses an address can fetch one. The repository is public too, so `content.mjs` is readable on GitHub whatever the switches say. The calendar is hidden, not secret.

### Moving or renaming the page

If you change the theme's `slug`, rename `src/pages/<slug>.html` to match, rebuild, and delete the old `public/<old-slug>.html` by hand. The build does not remove stale pages.

## Going live (for the person in charge)

Follow `docs/advent/launch-checklist.md`, in order. In short: the reviews, the pictures with `artRequired: true`, the bonus text (or accept 25 doors), then `publicListing: true`, then delete the two pre-launch guard tests, run everything, and check production. The hidden help guide `/help-advent` has a plain-English summary.

## Status

Phases 0 to 3 are done. Pictures (phase 4), the release reviews (phase 5) and transferability work (phase 6) are not. Nothing about the calendar is visible to the public.
Run the tests with `npm run test:unit` (and `npm test` for the browser tests).
