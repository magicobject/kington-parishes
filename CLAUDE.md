# Standing instructions for this repo

These apply to every change here, not just when explicitly asked for.

## Before any push to origin
- Run `npm test` (Playwright suite) and `npm run audit` (`npm audit --audit-level=high`). Fix real findings — don't suppress, downgrade, or skip them to get a push out.
- If the change touches page content, structure, or CSS, make sure `test/accessibility.spec.ts` is included in that run and still passes with zero violations.

## Accessibility
- Every page must pass an axe-core scan (`@axe-core/playwright`, via `test/accessibility.spec.ts`) with zero violations. New pages need an entry in `test/support/pages.ts` — the accessibility spec picks them up automatically from there.
- This site uses a reveal-on-scroll animation (`.reveal` / `.in`). A scan run right after `page.goto()` will false-positive on below-the-fold elements still at `opacity:0`. If you touch the accessibility spec, keep the settle step that force-adds `.in` and kills the transition/opacity/transform inline before scanning — toggling the class alone isn't enough.
- Any new heading needs to fit the existing outline (no skipped levels — h1 → h2 → h3, not h1 → h3).
- Any new text/background color pairing must clear WCAG AA contrast (4.5:1 for normal text, 3:1 for large text/UI components) — compute it (relative luminance), don't eyeball it.
- Every `<iframe>` needs a `title`; `aria-label` only belongs on elements with an ARIA role, never a bare `<div>`.

## Security
- Keep `npm run audit` clean (no unresolved high/critical) before any push.
- Don't add third-party scripts, trackers, or embeds without checking what they contribute to CSP/privacy first.

## Build pipeline
- `public/*.html` is generated from `templates/*.html` + `src/pages/*.html` + `src/pages.config.mjs` + `src/site.config.mjs` by `scripts/build.mjs` — never hand-edit it, edit the source and run `npm run build`.
- `public/css/style.css` is the one thing in `public/` that's hand-maintained, not generated.
- The pre-commit hook bumps the build number and regenerates `public/` automatically on every commit — never do either by hand.
