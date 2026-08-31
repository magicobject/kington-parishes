# Kington Parishes

Static site for the five parishes of Kington, Titley, Old Radnor, Kinnerton and Huntington, deployed to Cloudflare Workers at [kington-parishes.magicobject.workers.dev](https://kington-parishes.magicobject.workers.dev) (auto-deploys on push to `main`). Same lightweight build pipeline as [wrightmaths.uk](https://github.com/magicobject/WrightMaths), [kingtonfoodbank.org.uk](https://github.com/magicobject/kingtonfoodbank) and [lovinggod.uk](https://github.com/magicobject/LovingGod) — see their READMEs for the full explanation; the short version is below.

**This is a proof-of-concept build showcased in the MediaWright portfolio, not the parishes' real production website.** Every page carries `<meta name="robots" content="noindex, nofollow">` so it can never get indexed or mistaken for the genuine site in search results — see "Proof-of-concept: noindex everywhere" below before removing that from anywhere.

## Quick start

```bash
npm install       # also wires up the git hooks (build number, npm audit) — see below
npm run build     # generate public/*.html from templates/ + src/
npm run serve     # serve public/ locally at http://localhost:4176
npm test          # run the Playwright suite
```

## How the build works

Twelve real pages (`index`, `our-churches`, `our-people`, `walkers`, `services`, `parish-news`, `parish-news-archive`, `life-events`, `get-involved`, `calendar`, `contact`, `safeguarding`) plus the `404` page are assembled from four pieces by [scripts/build.mjs](scripts/build.mjs):

1. **[templates/header.html](templates/header.html)**, **[templates/safeguard-strip.html](templates/safeguard-strip.html)**, **[templates/footer.html](templates/footer.html)**, **[templates/page.html](templates/page.html)** — the shared page shell (nav, the "concerned about a child or adult's safety" banner, footer, `<head>`) with `{{PLACEHOLDER}}` tokens. Each is optional per page — see `header`, `safeguardStrip` and `footer` flags in `src/pages.config.mjs` (the 404 page skips the header and safeguard-strip but keeps the footer, so the build number and mediawright credit still show there; the safeguarding page skips the safeguard-strip since it would just link to itself).
2. **[src/pages/\*.html](src/pages)** — just the content unique to each page. No `<head>`, no header, no footer — the build script wraps that around it.
3. **[src/pages.config.mjs](src/pages.config.mjs)** — the primary nav (`NAV`), the footer's shorter "Explore" list (`FOOTER_NAV` — deliberately a different set: it includes Safeguarding, which isn't in the primary nav), and each page's `<title>`/meta description/robots behaviour.
4. **[src/site.config.mjs](src/site.config.mjs)** — the single source of truth for contact details, the donate link and other facts repeated across pages (email, phone, address, the booking secretary's contact, the Parish Giving Scheme URL). Every `camelCase` key becomes an `{{UPPER_SNAKE_CASE}}` token (e.g. `donateUrl` → `{{DONATE_URL}}`), substituted wherever it appears — in the templates *and* in `src/pages/*.html` content.

Running `npm run build` reads all four and writes the finished files into `public/`, which is what Cloudflare actually serves (`wrangler.jsonc` points `assets.directory` at `./public`).

## What to edit, and what never to touch

| Want to change... | Edit this | Never edit this |
|---|---|---|
| Email, phone, address, donate link, booking contact | `src/site.config.mjs` | Any hard-coded string in `src/pages/` or `templates/` |
| Page content (wording, sections) | `src/pages/<page>.html` | `public/<page>.html` |
| Nav links, footer's Explore list, page title/description | `src/pages.config.mjs` | `public/<page>.html` |
| Header/footer/safeguard-strip, shared `<head>` | `templates/*.html` | `public/<page>.html` |
| Styling | `public/css/style.css` (this one genuinely lives in `public/` — it isn't generated) | — |
| The reveal-on-scroll / footer-year script | `public/js/main.js` (also not generated) | — |
| Calendar events | `public/js/calendar-events.js` (also not generated — see "Adding a calendar event" below) | — |
| Calendar behaviour (month grid, navigation) | `public/js/calendar.js` (also not generated) | — |
| Favicon | `public/img/favicon.svg` (also not generated) | — |
| Robots.txt | `public/robots.txt` (hand-maintained, not generated) | — |
| Security headers (CSP, etc.) | `public/_headers` (hand-maintained, not generated — Cloudflare-specific file, applied to every response) | — |

**`public/*.html` is a build artefact.** Every one of those files opens with an auto-generated `DO-NOT-EDIT` HTML comment banner for exactly this reason: a hand-edit made directly to a file in `public/` will be **silently overwritten** the next time anyone runs `npm run build` — which happens automatically on every commit (see below).

If you're not sure whether a file in `public/` is generated or hand-maintained, check whether it has a same-named counterpart under `src/pages/` — if it does, it's generated.

## Adding a calendar event

[Calendar](src/pages/calendar.html) reads its events from a plain data file, [public/js/calendar-events.js](public/js/calendar-events.js) — there's no CMS or database, so this file *is* the calendar's content. It isn't generated by the build (same as `main.js`), so edit it directly and commit.

Add an entry to the `window.CALENDAR_EVENTS` array:

```js
{ date: '2026-10-04', time: '18:30', title: 'Harvest Festival', location: "St Mary's, Kington" },
```

- **`date`** — `YYYY-MM-DD`.
- **`time`** — 24-hour `HH:MM`, already in local (UK) time — the calendar doesn't do any timezone conversion, so just write the wall-clock time as advertised.
- **`title`**, **`location`** — plain text (location is optional; use `''` if there isn't one, as with `Carols at the Oxford`).

Array order doesn't matter — the calendar groups events by date and sorts each day's list by time itself. No rebuild is needed to see a new event locally: `npm run serve` and reload `/calendar.html`.

**This file is for special/one-off events only** — concerts, recitals, fetes, pilgrimage & tea, and the like. It deliberately excludes the regular weekly pattern of worship at each church (that's covered in prose on [Services & Events](src/pages/services.html) and [Our Churches](src/pages/our-churches.html)) — adding every recurring Sunday service here would make the grid unreadable. The current 19 events were hand-curated from St Mary's Kington's own public Google Calendar feed for exactly this reason: the raw feed also includes daily prayer services, organ/ringing practice, and internal-only entries (committee meetings, rehearsals) that don't belong on a public calendar.

**There's no recurrence support** — `calendar-events.js` is a flat list of one-off dated entries, with no "every Sunday" or "monthly" concept. A repeating event needs one array entry per occurrence, the way `Summer Family Fun at St Mary's` appears three times (28 July, 11 and 25 August) rather than once with a repeat rule. Fine for a handful of special events; if this ever needs to cover something genuinely recurring on an ongoing basis, that'd be new work in [calendar.js](public/js/calendar.js) (expanding a rule into occurrences at render time), not a data-file change.

**Two or more events can land on the same day** — the grid cell shows up to two as chips, with a `+N more` chip if there are more, but the agenda panel always lists every event for the selected day, uncapped. [test/calendar.spec.ts](test/calendar.spec.ts) covers both the two-event case (19 July, seeded with two real events) and the overflow case (a route-intercepted third event, since no real seeded date currently has three).

[test/calendar.spec.ts](test/calendar.spec.ts) checks the calendar's behaviour (navigation, selection, multi-event days, no horizontal scroll) but not the content of `calendar-events.js` — a typo'd date or time won't fail a test, so double-check new entries by eye in the browser.

## Proof-of-concept: noindex everywhere

This site exists to demonstrate the build pipeline in the MediaWright portfolio — it is **not** the real Kington Parishes website, and must never be confused with or outrank the genuine one in search results. Every page in `src/pages.config.mjs` sets `robots: 'noindex, nofollow'` (there's no sitewide default in `scripts/build.mjs` — it's explicit per page, so a new page added without it would fail the `page-content.spec.ts` test that checks every page for this).

`public/robots.txt` still says `Allow: /` rather than `Disallow: /` — that's deliberate, not an oversight. If crawling were blocked at the robots.txt level, a search engine could still index the bare URL from a link elsewhere without ever seeing the `noindex` tag on the page itself, since it would never be allowed to fetch and read it. Allowing crawl but marking every page `noindex` is the combination search engines actually document as reliable for keeping a site out of results entirely. There's no `sitemap.xml` for the same reason — publishing one would actively invite indexing of exactly the URLs this site needs to stay out of.

## What changed from the original hand-written site

This site used to be nine separate hand-written HTML files, each with the entire ~270-line shared stylesheet and the footer-year/reveal-on-scroll script pasted inline — meaning any styling change had to be made in nine places at once. Two files, `assets/style.css` and `assets/main.js`, already held a correctly extracted copy of that shared CSS and JS — but neither was ever actually linked from any page, so they sat there unused while every page kept its own inline copy. This rebuild wires those up for real (as `public/css/style.css` and `public/js/main.js`) instead of leaving them as dead weight.

A few real bugs turned up along the way and got fixed as part of this move, not left in place:

- The "jump to a church" pills on Our Churches were invisible — dark text on the page-header banner's dark background. Life Events' equivalent pills used inline styles to fix the same problem for its own page, but that fix never made it back into the shared `.jump-row` class, so Our Churches never got it. Fixed at the shared CSS level (both pages use the same class again) rather than patching it a second time in a second place.
- The 404 page's own `<style>` block defined `.card` and a plain `body { display:flex; ... }` rule that would have silently broken the site-wide `.card` component and page layout the moment everything was combined into one stylesheet. Renamed to `.notfound-card` / `.notfound` so the merge is safe.
- The 404 page's links used absolute paths (`/`, `/contact.html`) while every other page used relative ones — made consistent.

One placeholder was deliberately left as-is, not invented: the "Open the calendar" button on Services & Events still points nowhere (`href="#"`). It was left pointing at an external Google Calendar link that doesn't exist yet, on purpose — it's a different thing from the site's own [Calendar](src/pages/calendar.html) page, which now carries real curated events (see "Adding a calendar event" above). The noticeboard and Parish News sections, which used to show sample "replace via the CMS" placeholder content, are now populated with real notices and issues.

## The Our People page

[Our People](src/pages/our-people.html) makes the point that running a parish takes a whole team, not just clergy. Two sections: a clergy team (Revd Sally Welch, Vicar, and Revd Phillippa Wright, Curate, with a shared photo of the two of them) and, specific to St Mary's, Kington, its wardens and officers (Greg Wright — churchwarden and interim treasurer, Margaret Cook — churchwarden, Christine Robinson — Parish Safeguarding Officer, linking through to her existing entry on [Safeguarding](src/pages/safeguarding.html) rather than duplicating her contact details, and Julia Reed — Health &amp; Safety Officer). It's deliberately built as a small, growing list rather than a fixed set — the `.card-grid` of `.card` profile cards is the same component used elsewhere on the site (see "Ongoing community programmes" on the homepage), so adding another person later is a new card in the same grid, not a page redesign. The clergy photo lives at [public/img/our-people/sally-welch-and-phillippa-wright.jpg](public/img/our-people/sally-welch-and-phillippa-wright.jpg) — not generated, hand-maintained, same as the other images under `public/img/`.

## Per-church giving links on Our Churches

Each church on [Our Churches](src/pages/our-churches.html) links to its own page on the Parish Giving Scheme site, since each of the five is a separate legal parish with its own giving page there — a single site-wide `{{DONATE_URL}}` (see below) wouldn't be correct here, unlike the header's donate button and Get Involved, which both point at St Mary's, Kington specifically. Kington, Titley, Old Radnor and Huntington each get a `Give to <church> →` link; Kinnerton doesn't have its own Parish Giving Scheme page, so its entry is a short note pointing to Old Radnor's instead, rather than a broken or missing link.

## The Walkers page, and "Home" not being in the primary nav

The primary nav has no "Home" link — the brand link in the header (the "Kington Parishes" text, top left of every page) already goes to `index.html`, so a second link to the same place would just be redundant. That slot is used for [Walkers](src/pages/walkers.html) instead: an open invitation to walkers on the Offa's Dyke Path and our own Pilgrim Paths to stop at St Mary's, Kington for tea, biscuits and the facilities, plus links out to [Kington Walks](https://www.kingtonwalks.org/) and [Visit Herefordshire's Kington walks guide](https://www.visitherefordshire.co.uk/discover/kington-walks).

Because Home has no nav link, `test/support/pages.ts` keeps it as a standalone `HOME_PAGE` export rather than the first entry in `NAV_PAGES` — the same pattern already used for Safeguarding and the Parish News Archive (pages that are real and tested but aren't primary-nav destinations), just for the opposite reason: those two have a *different* link elsewhere (the footer), Home has none at all. `ALL_PAGES` (used by the specs that test every page regardless of nav status) still includes it.

The homepage also gained a **Find Us** section just above the footer: a full-width Google Maps embed pinned on St Mary's, Kington, using the same `.map-full`/`.map-full-embed` pattern as the [kingtonfoodbank](https://github.com/magicobject/kingtonfoodbank) site's map, for a consistent look across the two.

## Git hooks: build number on commit, npm audit on push

`npm install` runs the `prepare` script, which points git at the tracked [.githooks/](.githooks) directory (`core.hooksPath`) — so both hooks below are wired up automatically, no manual setup.

**[.githooks/pre-commit](.githooks/pre-commit)** — every page's footer shows a build number like `Build 2026.08.29.003` (format `yyyy.mm.dd.NNN`, where `NNN` counts commits made that day, stored in [build-number.json](build-number.json)). This is maintained automatically, not by hand. On every commit, the hook:

1. Runs [scripts/bump-build-number.mjs](scripts/bump-build-number.mjs), which increments today's counter in `build-number.json`.
2. Runs `npm run build`, regenerating every file in `public/` — including stamping the new build number into each footer and cache-busting `css/style.css?v=...` and `js/main.js?v=...`.
3. Stages the results (`git add public build-number.json`) so they're included in the commit you're about to make.

**[.githooks/pre-push](.githooks/pre-push)** — runs `npm run audit` (`npm audit --audit-level=high`) and blocks the push if it finds any high or critical severity vulnerability in a dependency. Low/moderate findings don't block — those are worth a look but aren't push-blocking on their own. `npm run audit` can be run any time without pushing; `npm audit fix` will resolve most findings automatically. In the rare case you need to push past a known, already-assessed issue, `git push --no-verify` skips the hook — but treat that as a deliberate, logged exception, not a habit.

In other words: **you never bump the build number or rebuild `public/` yourself** — just edit source files under `src/`/`templates/` and commit as normal.

## Security headers

[public/_headers](public/_headers) is a Cloudflare-specific file (same convention as Cloudflare Pages) applied to every response: a Content-Security-Policy, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`, and HSTS.

The CSP is `default-src 'self'` plus the minimum extra it actually needs: `https://fonts.googleapis.com`/`https://fonts.gstatic.com` for the Google Fonts stylesheet, and `'unsafe-inline'` on `style-src` only, because several pages use inline `style="..."` attributes (a full refactor to CSS classes felt like unnecessary scope for a proof-of-concept). `script-src` stays `'self'` with no exceptions — there are no inline `<script>` blocks anywhere in `src/pages/` or `templates/`, only external files (`main.js`, `calendar.js`, `calendar-events.js`), so it doesn't need one.

This file has no effect from `npm run serve` — the local static test server doesn't apply it, since `_headers` is a Cloudflare-only convention. It was checked before ever going live by pointing a throwaway local server at `public/` that applies the same rules and watching the browser console for CSP violations across the pages most likely to break (the homepage's inline styles, the calendar's external scripts) — worth repeating that check (or the equivalent on a preview deploy) after any change to `_headers` or to what a page loads.

## Accessibility

Every page is scanned with [axe-core](https://github.com/dequelabs/axe-core) (via `@axe-core/playwright`) in [test/accessibility.spec.ts](test/accessibility.spec.ts) — part of `npm test`, so a real regression fails the suite, not just a one-off manual check.

One gotcha worth knowing if this ever needs re-running by hand: the reveal-on-scroll animation (`.reveal` / `main.js`) means elements below the fold are still at `opacity: 0` — or mid-transition — when a scan runs immediately after `page.goto()`. Axe reads that as a real color-contrast failure (a link fading in from transparent genuinely does compute as low-contrast at that instant), which it isn't. The spec force-settles every `.reveal` element (adds the `.in` class *and* kills the transition outright, since toggling the class alone just starts a fresh 0.6s animation rather than jumping to the end state) before scanning, so it tests the real final state a visitor actually sees.

Fixes that came out of the last full pass — kept here since axe won't re-explain *why* if one of these regresses:

- **Two critical ARIA bugs on the calendar.** The month grid had `role="grid"`/`role="gridcell"` without the row-grouping structure the ARIA grid pattern requires (`grid` > `row` > `gridcell`), and would need real roving-tabindex/arrow-key handling to do properly. Rather than build that out, the incomplete roles were removed — a plain `<button>` per day with a descriptive `aria-label` (now including the weekday name, e.g. "Sunday 9 August, 1 event", since the visual weekday header is `aria-hidden`) is fully accessible via standard Tab order without needing grid semantics at all. A broken ARIA role is worse than none.
- **A dark-background link with no color override.** The calendar's page-header lede links to Services & Events using the site's default link color, meant for light backgrounds — nearly invisible against the dark banner. Same class of bug the homepage hero already had fixed elsewhere; the fix is now shared via `.page-header p.lede a`.
- **An `<svg role="img">` with real links inside it.** The homepage's ridge-line church-jump navigation labelled its whole `<svg>` as a single flattened image while five real `<a>` elements sat inside it — invalid, since an "img" role shouldn't have focusable descendants. Removed the role/label (the links' own visible text already names them) and wrapped it in `<nav aria-label="Jump to a church">` instead.
- **Landmark gaps.** The safeguard-strip banner (between `<main>` and `<footer>` on every page) sat outside any landmark; 404 had no `<main>` at all. Both fixed.
- **Footer heading levels.** The footer's "Kington Parishes" / "Explore" / "Get in touch" labels were real `<h4>`s, which skips a level on any page whose last real heading was an `<h1>` or `<h2>` — true on most pages here. They're group labels, not part of the content outline, so they're `<p class="foot-heading">` now (identical styling, no heading semantics). The same skip existed on Contact, Get Involved, Safeguarding and the Parish News Archive, one level up — their card titles were `<h3>` directly under the page `<h1>` with nothing in between; bumped to `<h2>`.
- **Three real color-contrast failures** (not the animation artifact above): the header's "Donate Now" button, the footer's muted copyright/build-number text, and the footer's "mediawright.uk" credit link, which also had no non-color styling to distinguish it from the surrounding text (it does now — underlined — though that rule took two attempts, since `footer.site a { text-decoration: none }` is more specific than a `.fine a` rule and silently won).
- **Faded "other month" calendar days** used `opacity: 0.4` on the whole cell, which happened to wash a light-gray day number down to 2.39:1. Same visual de-emphasis, delivered instead by a specific `color` on just the day number, comfortably compliant.

## Tests

[Playwright](https://playwright.dev) specs in `test/` cover:

- **[nav.spec.ts](test/nav.spec.ts)** — the primary nav highlights the right page, the donate button appears everywhere and points at the Parish Giving Scheme, Safeguarding (reachable only from the footer) never shows as "current" in the primary nav, and below 860px the nav collapses behind an ellipsis "Menu" toggle (closed by default, opens on click, a link click/Escape/click-outside all close it again, focus returns to the toggle on Escape) while staying always-visible above that width.
- **[contact-details.spec.ts](test/contact-details.spec.ts)** — the DRY-up's regression guard: checks the parish office email/phone, the booking secretary's contact, and the donate link actually got substituted correctly (and that no `{{TOKEN}}` placeholder was ever left un-replaced) across every generated page.
- **[footer.spec.ts](test/footer.spec.ts)** — every page with a footer shows a correctly-formatted build number and the "Site by mediawright.uk" credit.
- **[page-content.spec.ts](test/page-content.spec.ts)** — each page shows its own title/heading/canonical URL, not another page's.
- **[not-found.spec.ts](test/not-found.spec.ts)** — unknown URLs get a real 404 status and the branded 404 page, which is `noindex`, has no main nav, but does still show the footer.
- **[calendar.spec.ts](test/calendar.spec.ts)** — the calendar defaults to the current month, Prev/Next/Today navigate correctly (including year rollover), selecting a day populates the agenda panel, a day with two or more events shows them correctly (capped chips in the grid, the full uncapped list in the agenda), and the grid never causes the page to scroll horizontally on mobile or desktop.
- **[accessibility.spec.ts](test/accessibility.spec.ts)** — an axe-core scan of every page with zero tolerated violations (see "Accessibility" above for what that's already caught and how the reveal-on-scroll animation is worked around), plus the homepage specifically at mobile viewport width in both the closed and open states of the nav toggle.

`test/support/pages.ts` is the shared list of page metadata used across specs; add an entry there when adding a new page.

## Deployment

Push to `main` — Cloudflare picks up the change and deploys `public/` automatically. There's no separate deploy step to run locally.

**Note:** `wrangler.jsonc` now points `assets.directory` at `./public` instead of the repo root, since assets moved there as part of this restructure. If the Worker was previously configured to serve from the repo root, double-check the dashboard after this change lands to make sure it's picked up the new directory.
