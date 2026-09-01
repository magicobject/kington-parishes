# Standing instructions for this repo

These apply to every change here, not just when explicitly asked for.

## Before any push to origin
- Run `npm test` (Playwright suite) and `npm run audit` (`npm audit --audit-level=high`). Fix real findings — don't suppress, downgrade, or skip them to get a push out.
- If the change touches page content, structure, or CSS, make sure `test/accessibility.spec.ts` is included in that run and still passes with zero violations.
- Whenever the whole suite (`npm test`) is run, report the number of tests run and the time taken (both are in Playwright's own summary line, e.g. "121 passed (15.2s)") — a quick way to notice a regression in either coverage or speed.

## Accessibility
- Every page must pass an axe-core scan (`@axe-core/playwright`, via `test/accessibility.spec.ts`) with zero violations. New pages need an entry in `test/support/pages.ts` — the accessibility spec picks them up automatically from there.
- This site uses a reveal-on-scroll animation (`.reveal` / `.in`). A scan run right after `page.goto()` will false-positive on below-the-fold elements still at `opacity:0`. If you touch the accessibility spec, keep the settle step that force-adds `.in` and kills the transition/opacity/transform inline before scanning — toggling the class alone isn't enough.
- Any new heading needs to fit the existing outline (no skipped levels — h1 → h2 → h3, not h1 → h3).
- Any new text/background color pairing must clear WCAG AA contrast (4.5:1 for normal text, 3:1 for large text/UI components) — compute it (relative luminance), don't eyeball it.
- Every `<iframe>` needs a `title`; `aria-label` only belongs on elements with an ARIA role, never a bare `<div>`.

## Security
- Keep `npm run audit` clean (no unresolved high/critical) before any push.
- Don't add third-party scripts, trackers, or embeds (iframes included) without adding whatever they need to `public/_headers`' CSP first — and actually verifying it. `npm run serve` does NOT apply `_headers` (it's a Cloudflare-only convention), so a CSP gap won't show up there; it shipped silently once already (a Google Maps embed with no `frame-src`, rendering as "This content is blocked" in production). Verify with `npx wrangler dev`, which serves `public/` through the real asset handler, `_headers` included — check the browser console for CSP violations after any change to `_headers` or to what a page loads/embeds.

## Build pipeline
- `public/*.html` is generated from `templates/*.html` + `src/pages/*.html` + `src/pages.config.mjs` + `src/site.config.mjs` by `scripts/build.mjs` — never hand-edit it, edit the source and run `npm run build`.
- `public/css/style.css` is the one thing in `public/` that's hand-maintained, not generated.
- The pre-commit hook bumps the build number and regenerates `public/` automatically on every commit — never do either by hand.

## Build numbers: tag every commit, and log it on /updates.html
The pre-commit hook bumps `build-number.json` on every commit (same date → counter +1; new date → counter resets to 1). Two more things go with that, both driven by the *same* build number:
1. **Before committing**, work out what the new build number will be (read `build-number.json`, apply the same same-date/new-date rule above) and add a new entry at the *top* of the changelog in `src/pages/updates.html` — that build number, today's date, and a one-line summary of the change. Newest entry first. Include this file in the commit like any other source change.
2. **After committing**, tag it with that same build number and push the tag: `git tag build-<date>.<NNN>` (e.g. `build-2026.08.31.007`, matching the footer's "Build 2026.08.31.007" text exactly), then `git push origin build-<date>.<NNN>`.

`/updates.html` is a real, reachable page — it's just not linked from anywhere on the site (not in NAV, not FOOTER_NAV, not any sitemap), and is marked `robots: noindex, nofollow` in `src/pages.config.mjs` for exactly that reason (matching this site's sitewide noindex policy). It's a build log for whoever knows the URL, not user-facing content.
