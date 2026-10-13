# Advent Calendar: phased build plan (DRAFT)

Status (13 Oct 2026): phases 0 to 3 are built (logic, build integration, the real calendar UI, the bonus door and the home-page banner), all still hidden. Still to do: phase 4 content and art (the 21 pictures, the bonus text), phase 5 release gates (tester and security-engineer reviews), phase 6 transferability. Originally: planning. Inputs: `docs/specs/advent-calendar.md` (requirements, decisions, security review), `docs/advent/content-plan.md` (25 days), `docs/advent/mockups/advent-mockup.html` (look and feel only; its code is throwaway).

Target: live for the public on 1 Dec 2026, with a **demo available earlier** via the preview parameter. Content approval and artwork are the long poles, not code.

## Ground rules (from CLAUDE.md, the spec and the security review)
- Test first. Before any push: `npm test` and `npm run audit`; report "kington-parishes: N tests passed in Xs".
- Every commit gets a `/updates` entry (author from `gh api user --jq .login` via `users.json`) and a `build-<date>.<NNN>` tag.
- Axe zero violations on every state; computed contrast; no skipped heading levels; `{{ADVENT}}` expands before ids/search.
- No inline script, no storage, no third-party anything, no `innerHTML`. Verify headers with `npx wrangler dev`.
- No agent checks its own work: developer builds, tester and security-engineer review.

## Phase 0: housekeeping (small, now)
1. Spec cleanup: reconcile AC27/3.4 and storage ACs with the decisions (done in notes; fold into the spec body).
2. Decide the module's folder name and the one-line integration points (`modules/advent/`, token, page entry, tests).
3. Help page outline (`/help-advent`, plain English) and privacy-policy check (expect no change).

## Phase 1: pure logic, tests first (unit tests, no browser)
- `date.mjs`: `londonDateParts`, `seasonState`, `isDayUnlocked`, preview-date parser (strict, bounded). Fail closed if `Intl` misbehaves.
- `schema.mjs`: validators for content and theme (exact keys, length caps, no `<`/`>`/`{{`/URLs, no control or bidi characters, hex colours, art path allowlist).
- Boundary test: no "Kington" or `../../src` imports in generic module files.
- Static test: no unsafe DOM APIs, no storage APIs, in module source and built JS.
Gate: all green.

## Phase 2: build integration
- `{{ADVENT}}` (page) and `{{ADVENT_TEASER}}` (home banner) tokens expanding to markup only; config via `data-*` attributes.
- Generated files with AUTO-GENERATED banners: per-day JSON, theme CSS variables (contrast asserted at build). Module CSS and client JS hand-maintained in `modules/advent/client/`, copied/hashed by the build.
- `_headers`: only the tightening rule for `/advent/art/*`. No loosening.
- Page in `pages.config.mjs`, `test/support/pages.ts`, sitemap entry (bare URL), search index with generic text only.
Gate: build refuses invalid content; search index and sitemap contain no day text.

## Phase 3: the client
- Door grid (real buttons, accessible names with state), "today" highlight, gentle "not yet / open it anyway", day panel (native `dialog`), prev/next, reduced-motion, forced-colours, print stylesheet.
- Season states: before 1 Dec, 1 to 25 Dec, 26 Dec to 6 Jan ("The Christmas Story", all open), after.
- Preview parameter (compiled out when `previewEnabled` is false): notice, exit link, never propagated, never stored.
- Share (`navigator.share`/copy link) and optional read-aloud (local voices only).
- Playwright with `page.clock`: boundary dates, timezone contexts, keyboard-only, axe in every state incl. dark mode and dialog open, network test (same-origin, no `Set-Cookie`).
Gate: tester agent exploratory pass (phone and desktop, zoom 200/400%, keyboard, screen-reader notes).

## Phase 4: content and art (runs in parallel from Phase 1)
- Clergy-free sign-off path: Greg approves text (WEB only, licence status recorded in a credits file).
- Illustrations: draw the other 21 in the gold-thread style using the shared figure symbols (sheep, shepherd, kneeler); lint SVGs; alt text and hidden details per the content plan; Greg reviews each picture.
- Local tie-ins only if Greg supplies confirmed facts; otherwise omitted.

## Phase 5: release gates
1. security-engineer review of S1-S14 (storage items now "no storage APIs"), production header and console check after deploy.
2. Accessibility and tester sign-off.
3. Changelog, help page, tag, push. Deploy; check production console (Cloudflare injections) and a read-only request to `/advent?advent-preview=2026-12-07`.
4. Demo to Greg using preview; Greg approves wording and pictures; flip on for 1 Dec (or let the date do it).
5. After 6 Jan: set `previewEnabled` false (or leave, Greg's call).

## Phase 6: make it transferable
- `modules/advent/README.md` and `INTEGRATION.md` for a non-technical maintainer, adoption checklist, `VERSION`, `MANIFEST.sha256`, a second-church sample config used as a test fixture.
- Port to one other site (Chelsfield or Leominster) only after 1 Dec, fix what the boundary test and checklist missed, then consider a sync script. Sharing terms are Greg's decision.

## Rough order and timing (internal targets, not commitments to anyone)
Phases 0-1 first; phase 2-3 next; phase 4 starts at once and finishes before phase 5; a preview demo for Greg as soon as phase 3 works on a few days with placeholder art. Release on or before 1 Dec 2026.

## Risks
- Artwork and approvals are the schedule risk: 21 pictures to draw and review.
- Gentle mode means future text is fetchable by URL (accepted).
- No-JS visitors see an explanation only (accepted).
- Vendored-module drift across sites (mitigated by manifest).

## Known later items (from review, 13 Oct 2026)
- **6 January bonus door.** Greg decided yes and Day 21 promises it. Needs either DAY_COUNT/archive support or a separate bonus entry in the content shape, plus its own content ("Gifts for a King", per the content plan, Bonus A).
- **Missing art must stop a go-live.** The credits say "original illustration" but the SVGs do not exist yet. The build must refuse to publish while any art file named in the content is missing.
- **S12: `VERSION` and `MANIFEST.sha256`** for the generic module files, checked by a unit test.
- **Built-JS scan.** The storage and unsafe-API scan currently covers module source only; extend it to the built client JS once phase 3 exists.
- **Confirm with Greg:** RESOLVED 13 Oct 2026: Day 3 now says "Hergest Ridge" (Greg's decision). Still open: "our village and town" (Day 13 prayer) is local colour that has not been confirmed.
- **Archive-mode wording.** Days 24 and 25 say "It's Christmas Eve. Tonight, perhaps..." and similar. From 26 Dec to 6 Jan every door is read in archive mode, so that wording will read oddly; give those lines an archive-safe variant.
- **HTML-escape the names.** The theme's `siteName` and `translationName` are limited to letters, digits, spaces and `. , ' -`, but the build must still HTML-escape them in every attribute, title and meta tag it writes them into.
- **Use the validator's returned copy.** `validateContent` and `validateTheme` return a checked copy; callers must use that copy, never the original object they passed in.
- **Credit text vs missing art.** Each day's `credit` says "Original illustration", so the build must refuse to go live if any art file named in the content is missing (same item as the art check above, repeated here because the wording makes a false claim until the pictures exist).
