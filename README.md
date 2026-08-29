# Kington Parishes

Static site for the five parishes of Kington, Titley, Old Radnor, Kinnerton and Huntington, deployed to Cloudflare Workers at [kington-parishes.magicobject.workers.dev](https://kington-parishes.magicobject.workers.dev) (auto-deploys on push to `main`). Same lightweight build pipeline as [wrightmaths.uk](https://github.com/magicobject/WrightMaths), [kingtonfoodbank.org.uk](https://github.com/magicobject/kingtonfoodbank) and [lovinggod.uk](https://github.com/magicobject/LovingGod) — see their READMEs for the full explanation; the short version is below.

**This is a proof-of-concept build showcased in the MediaWright portfolio, not the parishes' real production website.** Every page carries `<meta name="robots" content="noindex, nofollow">` so it can never get indexed or mistaken for the genuine site in search results — see "Proof-of-concept: noindex everywhere" below before removing that from anywhere.

## Quick start

```bash
npm install       # also wires up the pre-commit hook — see below
npm run build     # generate public/*.html from templates/ + src/
npm run serve     # serve public/ locally at http://localhost:4176
npm test          # run the Playwright suite
```

## How the build works

Eight real pages (`index`, `our-churches`, `services`, `parish-news`, `life-events`, `get-involved`, `contact`, `safeguarding`) plus the `404` page are assembled from four pieces by [scripts/build.mjs](scripts/build.mjs):

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
| Favicon | `public/img/favicon.svg` (also not generated) | — |
| Robots.txt | `public/robots.txt` (hand-maintained, not generated) | — |

**`public/*.html` is a build artefact.** Every one of those files opens with an auto-generated `DO-NOT-EDIT` HTML comment banner for exactly this reason: a hand-edit made directly to a file in `public/` will be **silently overwritten** the next time anyone runs `npm run build` — which happens automatically on every commit (see below).

If you're not sure whether a file in `public/` is generated or hand-maintained, check whether it has a same-named counterpart under `src/pages/` — if it does, it's generated.

## Proof-of-concept: noindex everywhere

This site exists to demonstrate the build pipeline in the MediaWright portfolio — it is **not** the real Kington Parishes website, and must never be confused with or outrank the genuine one in search results. Every page in `src/pages.config.mjs` sets `robots: 'noindex, nofollow'` (there's no sitewide default in `scripts/build.mjs` — it's explicit per page, so a new page added without it would fail the `page-content.spec.ts` test that checks every page for this).

`public/robots.txt` still says `Allow: /` rather than `Disallow: /` — that's deliberate, not an oversight. If crawling were blocked at the robots.txt level, a search engine could still index the bare URL from a link elsewhere without ever seeing the `noindex` tag on the page itself, since it would never be allowed to fetch and read it. Allowing crawl but marking every page `noindex` is the combination search engines actually document as reliable for keeping a site out of results entirely. There's no `sitemap.xml` for the same reason — publishing one would actively invite indexing of exactly the URLs this site needs to stay out of.

## What changed from the original hand-written site

This site used to be nine separate hand-written HTML files, each with the entire ~270-line shared stylesheet and the footer-year/reveal-on-scroll script pasted inline — meaning any styling change had to be made in nine places at once. Two files, `assets/style.css` and `assets/main.js`, already held a correctly extracted copy of that shared CSS and JS — but neither was ever actually linked from any page, so they sat there unused while every page kept its own inline copy. This rebuild wires those up for real (as `public/css/style.css` and `public/js/main.js`) instead of leaving them as dead weight.

A few real bugs turned up along the way and got fixed as part of this move, not left in place:

- The "jump to a church" pills on Our Churches were invisible — dark text on the page-header banner's dark background. Life Events' equivalent pills used inline styles to fix the same problem for its own page, but that fix never made it back into the shared `.jump-row` class, so Our Churches never got it. Fixed at the shared CSS level (both pages use the same class again) rather than patching it a second time in a second place.
- The 404 page's own `<style>` block defined `.card` and a plain `body { display:flex; ... }` rule that would have silently broken the site-wide `.card` component and page layout the moment everything was combined into one stylesheet. Renamed to `.notfound-card` / `.notfound` so the merge is safe.
- The 404 page's links used absolute paths (`/`, `/contact.html`) while every other page used relative ones — made consistent.

Two placeholders were deliberately left as-is, not invented: the "Open the calendar" button on Services & Events still points nowhere (`href="#"`) until there's a real shared Google Calendar link to put there, and the noticeboard/Parish News sections still show sample "replace via the CMS" content, since there's no CMS behind this site yet.

## The pre-commit hook and the build number in the footer

Every page's footer shows a build number like `Build 2026.08.29.003` (format `yyyy.mm.dd.NNN`, where `NNN` counts commits made that day, stored in [build-number.json](build-number.json)).

This is maintained automatically, not by hand. `npm install` runs the `prepare` script, which points git at the tracked [.githooks/pre-commit](.githooks/pre-commit) hook. On every commit, that hook:

1. Runs [scripts/bump-build-number.mjs](scripts/bump-build-number.mjs), which increments today's counter in `build-number.json`.
2. Runs `npm run build`, regenerating every file in `public/` — including stamping the new build number into each footer and cache-busting `css/style.css?v=...` and `js/main.js?v=...`.
3. Stages the results (`git add public build-number.json`) so they're included in the commit you're about to make.

In other words: **you never bump the build number or rebuild `public/` yourself** — just edit source files under `src/`/`templates/` and commit as normal.

## Tests

[Playwright](https://playwright.dev) specs in `test/` cover:

- **[nav.spec.ts](test/nav.spec.ts)** — the primary nav highlights the right page, the donate button appears everywhere and points at the Parish Giving Scheme, and Safeguarding (reachable only from the footer) never shows as "current" in the primary nav.
- **[contact-details.spec.ts](test/contact-details.spec.ts)** — the DRY-up's regression guard: checks the parish office email/phone, the booking secretary's contact, and the donate link actually got substituted correctly (and that no `{{TOKEN}}` placeholder was ever left un-replaced) across every generated page.
- **[footer.spec.ts](test/footer.spec.ts)** — every page with a footer shows a correctly-formatted build number and the "Site by mediawright.uk" credit.
- **[page-content.spec.ts](test/page-content.spec.ts)** — each page shows its own title/heading/canonical URL, not another page's.
- **[not-found.spec.ts](test/not-found.spec.ts)** — unknown URLs get a real 404 status and the branded 404 page, which is `noindex`, has no main nav, but does still show the footer.

`test/support/pages.ts` is the shared list of page metadata used across specs; add an entry there when adding a new page.

## Deployment

Push to `main` — Cloudflare picks up the change and deploys `public/` automatically. There's no separate deploy step to run locally.

**Note:** `wrangler.jsonc` now points `assets.directory` at `./public` instead of the repo root, since assets moved there as part of this restructure. If the Worker was previously configured to serve from the repo root, double-check the dashboard after this change lands to make sure it's picked up the new directory.
