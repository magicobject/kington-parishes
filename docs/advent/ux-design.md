# Advent Calendar: UX design (condensed, with Greg's decisions applied)

Source: UX designer review (13 Oct 2026), revised for decisions made since: gentle future-door rule, no remembering (progress = day of month), home-page banner not main nav, World English Bible, in-house art, preview parameter. The look is shown in `docs/advent/mockups/advent-mockup.html` (throwaway code; use it for look and feel only: its `innerHTML`, inline script and `onclick` must not be copied).

## Principles
1. The calendar is a list of 25 real buttons. Art and animation are decoration on top. Screen reader, keyboard and reduced-motion users get the same content in the same order.
2. Content comes from the per-day JSON files (fetched on open), rendered with `textContent`. No timers, no drag, no hover-only, no swipe-only.
3. Warm, not gamified: no streaks, no counters, no "you missed it", no confetti.
4. Nothing is stored in the browser. State is the date.

## Scene and layout (concept A: night-sky ridge, chosen by Greg)
- Dark slate-to-ink sky; the site's hillside ridge in cream with the five church silhouettes along the bottom (this scene is SITE-OWNED art: the generic module ships a plain hills scene; a site supplies its own); a four-point star appears over the ridge on 25 Dec (and through the archive).
- Doors are arched buttons on a strict grid in source order 1..25. Phone (390px): status line, a single primary "Open today's door" button first, then a 5-column grid (4 columns if doors would drop below 60px); desktop: grid left, opened-day panel inline on the right at >= 900px, dialog below that.
- Door 25 is the "star door".
- 6 January bonus door ("Gifts for a King", Epiphany): a 26th door, locked until 6 Jan, same style, labelled "Epiphany".

## Door states (no read/unread state: nothing is remembered)
| State | Look | Not colour alone | Accessible name |
|---|---|---|---|
| future | dim slate, brass edge, dashed outline | date text "12 Dec" + dashed edge | "Day 12, 12 December, not yet" |
| today | gold fill with ink number, thick pale ring, soft glow (static ring under reduced motion), "Today" tag | word "Today" + ring | "Day 12, 12 December, today. <title>" |
| available | slightly lit door | none needed (default) | "Day 7, 7 December. <title>" |
| star (25) | star glyph | glyph + "25 Dec" | includes "Christmas Day" |
Doors are at least 72px square (60px minimum at very narrow widths) with 12px gaps. Past doors are never "missed". Titles of FUTURE days must never be in the page or the accessible names (only fetched when a door is actually opened).

## Gentle rule
Activating a future door opens a small message: "Not yet. This door opens on 12 December." with two buttons, "Open it anyway" and "Not yet". It never says "can't". Opening anyway shows the day normally (in memory only).

## Opening
Door swings open on a hinge (CSS rotateY, about 450ms ease-out), light fades up, panel appears; total under 700ms, no flashing, nothing loops. `prefers-reduced-motion`: no swing, instant cross-fade, glow becomes a static ring. Wrap all motion in the media query; no JS-driven animation.

## Opened-day panel
Native `<dialog>` via `showModal()` (full-screen sheet on phones; centred max 640px; side panel inline at >= 900px if feasible, else dialog everywhere). Focus moves to the Close button (or the title with `tabindex="-1"`); Escape closes; focus returns to the originating door; `aria-labelledby` on the title.
Order: Close and "n of 25" at top; artwork (`<img>` of the day SVG, 16:9, `alt` from content); eyebrow "Day 7 · 7 December"; h2 title; reference + translation credit; story paragraphs (1.125rem, line-height 1.6, max 60ch); `<details>` "Think about it" (open by default on desktop) and "Try this together"; prayer; hidden-detail hint ("Can you find ...?") inside its own details; prev/next buttons named with the target day number and (if the target is available) title: prev/next toward a future day is "not yet" via the gentle message, not hidden; Share (navigator.share or copy link) and "Print this day". Heading levels: page h1, calendar h2, dialog h2, blocks h3.
Share/copy URLs are built from `location.origin + location.pathname + '#day-N'` and never include the preview parameter. A `#day-N` deep link opens that day if available, else shows the gentle message or calm state. No read-aloud in v1.

## Status line
Live: "Today is Day 12: <title of today's door>" (only today's title is fetched). Archive: heading "The Christmas Story" and "All 25 doors are open. Read at your own pace." Before/after: one sentence "The Advent calendar opens on 1 December." No counters.

## Season states (all computed client-side from the real or preview date)
- **Launch gate:** until the site goes live (theme `goLive`), a real-date visitor ALWAYS gets the calm state on the calendar page and no home banner, even in December; a preview date is the only way to see the calendar. Anything but exactly `data-go-live="true"` is treated as off.
- before / after: calm sentence only.
- 1-25 Dec live: grid as above, "Open today's door" primary button.
- 26 Dec - 6 Jan archive: "The Christmas Story", all doors available, none "today", star over the ridge; bonus door opens on 6 Jan.
- Home-page banner (`{{ADVENT_TEASER}}`): full-width band under the hero: scene thumbnail (a small art image), "Advent at <siteName>", today's day and title, pill button "Open today's door" linking to the calendar page WITHOUT the preview parameter. Shown only when live or archive (archive: "The Christmas story, in 25 short pieces"). While publicListing is false it is only revealed in preview mode on the home page.

## Preview mode
Notice "Preview mode: not today's date. Showing 7 December 2026." with an Exit preview link, in a polite live region (`role="status"`). Nothing stored. Parameter never propagates into links, share URLs or the canonical.

## Accessibility checklist (feature-specific)
Native buttons in source order; accessible names with state; focus ring 3px, 3:1 against door and background on every state (check on the gold door); dialog behaviour above; polite live region announces a day opening; heading outline without skips; tap targets >= 44px (72 recommended); reduced motion honoured, nothing auto-plays or flashes; usable at 400% zoom / 320px with rem units and no fixed text heights; every colour pairing computed (small gold/brass text banned unless it passes 4.5:1; raw brass #A8813C is outlines/icons only); forced-colours mode: doors keep a visible 2px border (`CanvasText`), "today" distinguished by the word "Today", not only border width; art `alt` is one meaningful sentence; scene art `aria-hidden`; no-JS: calm sentence + noscript note; axe zero violations in every state including dialog open, gentle message showing, archive; keyboard-only and screen-reader notes from the tester.

## Print
Print stylesheet: an opened day prints as a clean A4 page (site name, day, title, reference, story, reflection, family activity, prayer, translation credit), black on white, serif 12pt, no scene, no buttons. "Print the whole calendar as a booklet" is a later nice-to-have.

## Theming tokens (public API of the module, `--advent-*`)
Colour: sky, sky-2, ridge, ink, paper, text, text-soft, accent, accent-ink, door, door-text, door-locked, door-edge, focus, link. Type: font-heading, font-body, story-size, line-height (fonts are the host site's; the module never loads fonts). Shape and motion: door-radius, door-size, gap, open-ms (forced to 0 under reduced motion). Contrast pairings are asserted by the unit test in `test-unit/advent-contrast.test.mjs`; add every new pairing there.
