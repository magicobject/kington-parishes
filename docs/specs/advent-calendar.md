# Spec: Advent Calendar

Status: DRAFT for Greg's review. Requirements only. UX design, the 25-day content and the architecture are being produced separately and must be checked against this spec.
Author: business analyst. Date: 2026-10-13.
Note (13 Oct 2026): the "Try this together" activity and the hidden-detail hint were removed by Greg; the content fields `activity` and `hidden` no longer exist.
Numbering: `docs/specs/` did not exist, so this is the first spec. It has no number prefix; if a numbering scheme is wanted, that is an open question (Q20).

Ethics check (`charter/ethics.md`): a church website feature. No excluded sector, no concern. The "permission first" rules apply in full to Bible text and images (section 4).

---

## 1. Why

**The problem.** In December, parishioners and families look for something small and daily to mark Advent. Printed calendars are bought, forgotten, and don't tell the Bible story in order. The parishes have no shared daily Advent focus online.

**Who has it.** Families with children, older parishioners who like a daily reflection, and anyone in the five parishes who visits the site in December. The vicar and team also want a warm, welcoming way to introduce the Christmas story to people who may rarely come to church.

**What changes when it's solved.** From 1 December a visitor can open one door a day and read one short part of the Christmas story, from the Old and New Testaments, with a picture. By 25 December they have followed the whole story. It is lovely to use, works for everyone including screen-reader and phone users, and costs nothing in privacy.

**Second goal (Greg's brief).** It is built as a self-contained module that another church website on the same pipeline can adopt with little work.

---

## 2. Users and their jobs

| Audience | Their job | Needs |
|---|---|---|
| Children (with a grown-up) | Open the day's door, see the picture, hear the story read | Big doors, a satisfying open moment, short text, no reading pressure. Not shown anything they could be misled by. |
| Families | Do it together each evening, perhaps on one shared phone | Quick to find, today's door obvious (progress is simply the date; nothing is remembered), easy for a parent to read aloud |
| Older parishioners | Read a calm daily reflection | Large readable text, high contrast, no fiddly gestures, works at 200% zoom |
| Phone users (likely most) | Do all of the above on a small screen, one-handed | Touch targets large, no horizontal scrolling, works in portrait and landscape, light on data |
| Screen-reader and keyboard users | Know which doors exist, which are open, which are not yet available, and read the story | Real buttons, clear names ("Door 7, open", "Door 8, not available until 8 December"), focus managed when a door opens, pictures with proper descriptions |
| Vicar / parish team (editors) | Approve and publish the content once a year | Simple, plain-text content files, a clear approval record |
| Other churches' site owners (later) | Adopt the module | Change name, colours, dates and content without touching code |

**What visitors can and can't see.**
- Anyone can see the calendar page. No account, no login.
- A visitor can see doors up to and including today's date (Europe/London). Future doors are visible as closed with a kind "not yet" and an "open it anyway" choice (gentle mode, decided 13 Oct). Future text is kept out of the page, search index and sitemap and is fetched per day.
- Content for future days must not be discoverable through search, sitemap, page source or network requests unless Greg decides otherwise (Q4).

---

## 3. Behaviour

Plain English. Unless stated, "today" means today's date in Europe/London, taken from the visitor's device clock (there is no server logic; the site is static).

### 3.1 When the section appears (date-visibility rules)

| Date (Europe/London) | What a visitor sees |
|---|---|
| 1 Nov to 30 Nov (RECOMMENDED DEFAULT: nothing, see Q1) | Calendar is not shown anywhere on the site. The calendar page, if visited directly, shows a short friendly "Our Advent calendar opens on 1 December" message, not a 404. |
| 1 Dec to 25 Dec | Home page shows a promo link to the calendar. The calendar page shows 25 doors. |
| 26 Dec to 6 Jan | DECIDED (13 Oct): the home page promo is removed; the page stays open as "The Christmas Story", read-only, with all 25 doors available and none marked "today". From 7 Jan the "opens next 1 December" message returns. |
| 1 Jan to 30 Nov | As the 1 Nov to 30 Nov row. |

Rules:
- The "year" is derived from the date, so the calendar returns every December with no code change.
- The calendar's start/end rules live in one configuration (module config), not scattered in code.
- If the visitor's device clock is wrong, the calendar follows the device clock. This is accepted and documented (Q5 covers whether to mitigate).
- Dates are compared as calendar dates in Europe/London, not UTC. The doors must change at local midnight, including on days when clocks change (not in December in the UK, but the logic must not break around the late-October change).
- A page left open across midnight updates itself on next interaction or within a reasonable time (exact behaviour for UX/architecture; must not require a refresh to open the new door).

### 3.2 The doors

- 25 doors, numbered 1 to 25, one per day.
- Door N is "available" when today is on or after N December; today's door is "today"; later doors are "future". These are the only three door states. There is no "missed", "read" or "unread" state. Past doors are simply available, so a late visitor can read everything up to today. A future door says "not yet" kindly and offers "open it anyway" (gentle mode).
- Today's door is visually distinguished (not by colour alone). During the 26 Dec to 6 Jan "The Christmas Story" period no door is "today".
- Opening a door reveals that day's story part: a heading, a short passage, a graphic with alt text, and the Bible reference. Reading time target: under two minutes (Q9 for the exact length).
- Opening is by click, tap, or keyboard (Enter/Space). No drag or swipe is required.
- An opened door can be closed again and reopened freely. A door opened in the current visit may be shown as selected in the page only (in memory); it resets on reload.
- The module stores nothing in the visitor's browser (decided 13 Oct: no localStorage, sessionStorage, IndexedDB or cookies). Progress is simply the day of the month. There is no "start again" control, no "opened X of Y" counter and no "next unread".

### 3.3 Story content shape (requirements only; writing is a separate task)

- Drawn from both Old and New Testaments, building toward the birth of Jesus on 25 December. The order and choice of passages is the vicar's to approve (Q8).
- Each day has: day number, title, short passage text, scripture reference(s), translation name, a graphic with alt text and credit, and an optional short reflection or prayer line (Q10).
- Every passage names its translation and licence on the page (section 4).
- Day 25 is the Nativity.

### 3.4 Errors, empty states and edge cases

- **Before 1 December / after Epiphany:** friendly message (3.1), link back to the home page. Never a blank page or error.
- **JavaScript disabled:** page shows an explanation and a plain list of the days already available (the readable content of available days, as text). This uses the site's existing `<noscript>` pattern. Future days are not included. Because the site is static, any no-JS list can only be correct as of the last build (see Q6 for how this is handled).
- **Image fails to load:** the text is still fully readable, the alt text shows, layout doesn't jump.
- **Slow or offline connection:** text must not depend on images; images are sized so the page doesn't shift as they load.
- **Reduced motion:** if the visitor has asked their device for reduced motion, the door-opening animation is replaced with a simple fade or instant reveal.
- **Very small or very large screens, 200 to 400% zoom, text-only zoom:** no loss of content or function.
- **Print:** RECOMMENDED but not essential: a day's story prints cleanly (Q11).
- **Sharing a day:** each opened day gets a stable link (deep link) only for days already available; a link to a future day shows the closed door with the gentle "not yet" message (Q12).
- **Date forced for demo or testing:** the only way to change the date is the constrained preview parameter (`?advent-preview=YYYY-MM-DD`, see "Demo / preview switch" and the security review at the end of this spec): strict format, bounded, only on `/advent` and `/`, shown with a clear notice, never stored, and compiled out when the theme's `previewEnabled` is false. Automated tests also use a mocked clock.

### 3.5 Look and feel

"Lovely and engaging" is a goal, not a testable criterion. UX design (separate agent) defines it. Requirements here: warm, uses the site's existing visual language, calm animation that respects reduced motion, nothing flashing, no sound by default, no autoplay.

---

## 4. Content, approval and licensing

**Approval workflow.**
1. Content drafted (separate agent). Every day marked DRAFT.
2. Vicar reviews all 25 days for theology, tone and suitability for children. Sign-off recorded (who, date, version) in the repo, e.g. in the content file header or a sign-off note. Not released without it.
3. A different agent checks facts (references exist and match quoted text) and accessibility. No agent checks its own work.
4. Greg approves publication (outward-facing words are drafts until approved by Greg at the check-in).
5. If any text changes after sign-off, sign-off is repeated for the changed days.

**Bible translation licensing.**
- Only public-domain translations are used unless written permission is held. Which one(s) are public-domain in the UK must be confirmed before use; do not assume (Q7). Several modern translations are copyrighted and have specific quotation limits; none is used without recorded permission or confirmation that our usage is inside the publisher's published terms.
- Paraphrased "story" text written for this site is the site's own words, but its source passages are still cited.
- Each passage shows its translation name and any required notice.
- A licence record (translation, licence/permission, who confirmed, date) is kept next to the content.

**Imagery provenance and permission (charter: "permission first").**
- Every graphic has a recorded source, creator, licence or written permission, and date, in a credits file kept with the images. No image is used because it merely appears publicly online.
- No AI-generated or stock images are used unless Greg decides and the licence is recorded (Q13).
- Children's artwork (if used) needs a parent/guardian's permission and the safeguarding policy applied; no names or identifiable details (Q13).
- Credits are visible to visitors on the page where the licence requires it.
- Each graphic has alt text that describes it usefully; decorative images are marked as decorative.

**Local content.** Local tie-ins (a parish's church building, a local event) are optional and only used with the parish's permission (Q14).

---

## 5. Security and privacy rules

**Personal data.** None is collected. The calendar has no forms, no accounts, no comments and no sharing widgets.

**What is stored.** Nothing. The module reads and writes no browser storage at all (decided 13 Oct). Nothing is sent anywhere.

**Rules.**
- No cookies. No third-party trackers, fonts, scripts, embeds, iframes or CDNs. All code, images and fonts are served from the site itself. If anything third-party is later proposed, the CSP rule in the repo's `CLAUDE.md` applies and `security-architect` reviews first.
- No inline script or style unless its hash is added to `_headers` and verified with `wrangler dev` (see repo `CLAUDE.md` and memory note on CSP).
- No analytics by default (see section 6).
- Content is inserted as text, never as unescaped HTML from storage or the URL.
- The module reads no data from the URL other than, at most, a day number validated as an integer 1 to 25, and the constrained `advent-preview` date described in the security review below.
- **Privacy policy:** no new passage is needed for storage, because nothing is stored. If read-aloud ships, one sentence on local voices only. The PECR question no longer arises (Q15).

**Abuse cases to test.**
1. Visitor changes the device clock to read future days. Accepted for a static site (the content for future days is only hidden if Q4 decides so; if "no peeking" is wanted strongly, future content must not be shipped in the page at all, which is an architecture decision with a trade-off).
2. (Void: the module stores nothing, so there is no stored value to tamper with. Replaced by security criterion S7: a test greps module source and built JS for any storage API.)
3. Direct URL to a future day or an invalid day (0, 26, "abc", script text). Expect: closed door or friendly message, no content leak, no error, no injected markup.
4. Reading future content via view-source, network tab or search. Expect: result matches the decision in Q4; the search index and sitemap must not expose future days unless Q4 says so.
5. Reuse on another site: a misconfigured module must not load external resources.
6. Content files containing HTML or script: the build must escape or reject.

**Needs `security-architect` review:** how future-day content is protected (Q4), the privacy policy wording, the CSP impact of any inline code, and the transferable module's config surface. `security-engineer` before release.

---

## 6. Analytics

None by default. No page-view counters, no event tracking, no third-party tool. If the parish wants to know whether it was used, the only candidate is Cloudflare's existing server-side page-view numbers, which need no script (Q16 asks whether to use them and whether the privacy policy mentions this). Any change to this is Greg's decision.

---

## 7. Accessibility rules (WCAG 2.2 AA at least)

- Zero axe-core violations, scanned in every state: before opening, a door open, several doors open, the "before 1 December" message, the "after Advent" view, the no-JS view, with and without a stored state, mobile viewport, and dark mode if the site has one.
- Doors are real `<button>` elements with an accessible name stating number and state (open, closed, not yet available). Not yet available doors are communicated as unavailable without relying on colour or on a bare `disabled` that hides the reason.
- Opening a door moves or announces focus sensibly (UX decides: reveal region with a heading, or a dialog). If a dialog is used: focus trapped, Escape closes, focus returns to the door.
- Heading levels continue the page outline with no skipped levels; the repo's own test checks this.
- Every new text/background pairing computed against WCAG AA (4.5:1, 3:1 for large text/UI) and recorded beside the colour tokens.
- Visible keyboard focus. Tab order follows door order. Touch targets at least 44 by 44 CSS pixels (WCAG 2.2 AA minimum is 24 by 24; 44 is the recommended target here).
- Respects `prefers-reduced-motion`. No flashing content.
- Text readable at 200% zoom and in text-only zoom; reflows at 320 px width.
- Pictures: meaningful alt text for each of the 25; decorative flourishes hidden from assistive technology.
- Content reading level plain and suitable for children (editorial guidance for the content agent, not tested automatically).
- The reveal-on-scroll note in the repo `CLAUDE.md` applies if the module uses scroll animations: force-settle before scanning.

---

## 8. Reuse by other churches (transferable module)

**Requirement:** the module is self-contained: its own folder of code, styles, content and images, no edits scattered through the host site beyond a small, documented set of hook-up steps.

**Configurable (settings, no code):**
- Church/site name and the page address.
- Start and end dates (default 1 to 25 December; how long it remains after) and timezone (default Europe/London).
- Number of doors (default 25).
- Colours and fonts from tokens, with contrast checks.
- Wording of messages (not yet open, finished, no-JS note).
- Whether to show a promo on the home page.
- Whether future days are protected (depends on Q4).

**Content (replaced by each church, with its own approval):**
- The 25 days of text and references, images with alt text and credits, the translation and its licence record, and the local tie-ins.
- A church may reuse the module's sample content only if licences for the text and images cover transfer (Q17). Images and text from Kington Parishes are not given to another church without permission recorded.

**Not allowed:** hard-coded Kington names, URLs, dates or colours inside the module.

Hook-up steps and a "how to adopt this module" guide are required deliverables (section 10). Whether other churches get it free, paid or as a MediaWright product is a commercial matter for Greg (Q17).

---

## 9. Yearly maintenance

- Goal: the same content runs again each year with no code change (dates are derived from the current year).
- **Who:** RECOMMENDED: the vicar or a named parish editor edits plain-text content files and Greg or Claude rebuilds. Who this is is Q18.
- **Yearly checklist (to be written in the `/help` guide):** review content and re-approve if changed; check licences still valid; check images' permissions; check dates; run tests with a mocked December clock; confirm the home promo and privacy wording; check production in the first week of December.
- Changing the text for a year should mean editing one content file and rebuilding. No edits to the HTML.
- Nothing is stored in browsers, so a previous year's visit cannot affect the new year; doors depend only on the date. Tested with a mocked December of the following year (AC5).
- A different story each year is out of scope but the content file format must allow swapping the file.

---

## 10. Repo obligations (from `CLAUDE.md`)

- Changelog entry at the top of `src/pages/updates.html` for every commit, author resolved via `gh api user --jq .login` and `users.json`, linking every page touched; tag `build-<date>.<NNN>` and push the tag.
- Plain-English `/help` guide page for editors (how to update, approve, add a year), added alongside the technical README for the module. Help pages sit in the hidden help scope for search.
- New page(s) added to `test/support/pages.ts`. Page title authored pre-escaped in `pages.config.mjs`. Page present in the sitemap only when appropriate (Q1/Q4). Searchability of future days follows Q4.
- Generated files (`public/*.html`, search index, sitemap) are not hand-edited; build tokens expand before anchor ids and the search index are generated.
- No hand-written `?v=`; assets get content hashes from the build.
- Any email address uses the obfuscation helper.
- New content that has a natural counterpart: the calendar of services (`src/events.config.mjs`) may want an entry if a related church event exists (Q14). Check for duplicates first.
- CSP verified with `npx wrangler dev` and the browser console. Production console checked after deploy.
- Merge-ready only after `npm test` and `npm run audit` pass, reported as "kington-parishes: N tests passed in Xs".
- Gates: `security-architect` at design, `security-engineer` before release, tester sign-off. A failed gate blocks the change.

---

## 11. Acceptance criteria

Each states how it will be tested. "Mocked clock" means a Playwright test that sets the browser date (e.g. `page.clock`) to a fixed Europe/London instant.

**Date visibility**
- AC1. With the clock at 30 Nov 23:59 Europe/London (and no preview parameter), the calendar page shows the "opens on 1 December" message and no doors, and the home page shows no calendar promo. *Mocked-clock Playwright test.*
- AC2. At 1 Dec 00:00, 1 Dec 12:00 and 25 Dec 23:59, the page shows 25 doors, the promo is on the home page, and exactly doors 1, 1 and 1 to 25 respectively are available. *Mocked-clock test.*
- AC3. At 26 Dec and 6 Jan the page is "The Christmas Story": all 25 doors available, none "today", no home promo; at 7 Jan it shows the "opens next 1 December" message. *Mocked-clock test.*
- AC4. Dates are evaluated in Europe/London regardless of the browser's timezone: tests run with the browser timezone set to UTC, America/Los_Angeles and Pacific/Auckland, around midnight on 1 Dec, and give the same result as London time. *Mocked clock with timezone override.*
- AC5. The calendar works unchanged in a following year (clock set to December of next year). *Mocked-clock test.*
- AC6. A page open across midnight 7/8 Dec offers door 8 without a manual reload (exact mechanism per architecture). *Mocked clock advancing.*

**Doors and behaviour**
- AC7. Each door can be opened by mouse, tap and keyboard (Enter and Space) and reveals heading, passage, graphic, reference, translation name. *Playwright.*
- AC8. A door not yet available says "not yet" kindly (with its date) and offers an "open it anyway" choice; it is not marked as available or as today. *Playwright.*
- AC9. Nothing is remembered: after a reload no door shows as opened, and there is no "start again" control or opened counter. *Playwright.*
- AC10. With browser storage blocked or throwing, the page works identically and shows no error (it never touches storage). *Playwright with storage disabled.*
- AC11. (Void.) Replaced by S7: the module never reads or writes browser storage; module source and built JS contain no storage API. *Grep unit test.*
- AC12. (Void; see AC5.) Nothing is stored, so there is no previous-year progress to carry over.
- AC13. Invalid deep links (0, 26, text) show a safe friendly state; a future day shows the closed door and the gentle "not yet" message. No injected markup. *Playwright.*
- AC14. With JavaScript disabled, the page explains and lists only the currently available days' text (as of build). *Playwright with JS disabled.*
- AC15. With a failed image request, text and layout remain usable and the alt text is present. *Playwright blocking images.*

**Accessibility**
- AC16. axe-core reports zero violations in every state listed in section 7, on desktop and mobile viewports. *Playwright with `@axe-core/playwright`, using the page list in `test/support/pages.ts`.*
- AC17. No skipped heading levels on the calendar page, in any state. *Repo heading-outline test.*
- AC18. Every door has an accessible name containing its number and state. All 25 images have non-empty alt text (or are explicitly decorative). *Playwright role/name queries.*
- AC19. Keyboard-only run through the page: reach, open and close a door, focus is visible and returns sensibly. *Playwright keyboard test.*
- AC20. With reduced motion emulated, no animated transition runs on opening. *Playwright `reducedMotion`.*
- AC21. At 320 px width and 200% zoom there's no horizontal scroll and nothing is cut off. *Playwright viewport test.*
- AC22. Every colour pairing meets WCAG AA and the computed ratios are recorded. *Contrast calculation checked by tester.*
- AC23. Touch targets of doors measure at least 44 by 44 CSS px at 320 px width. *Playwright bounding box test.*

**Privacy and security**
- AC24. During a full run of the page, the site sets no cookies and makes requests only to its own origin. *Playwright network and cookie assertions.*
- AC25. No analytics or tracking code is present. *Test searches the built page for known tracker patterns and checks network requests.*
- AC26. No console errors or CSP violations on the page locally and under `wrangler dev`; production console checked after deploy. *`wrangler dev` run and manual production check, recorded.*
- AC27. Future days' text is not present in the page source, search index or sitemap; it is reachable only through the per-day files (gentle mode, accepted and stated plainly). *Test fetches page source, `search-index.json` and the sitemap and asserts absence.*
- AC28. Content inserted as text: a content file containing `<script>` text renders as visible text or fails the build. *Unit test.*
- AC29. (Void for storage.) The privacy policy needs no storage passage; if read-aloud ships, it has one approved sentence on local voices only. *Review by Greg.*

**Content and licensing**
- AC30. All 25 days exist, each with title, text, reference, translation name, image, alt text and credit. *Unit test of the content file validating completeness; build fails if one is missing.*
- AC31. Every image and every translation has a licence/permission record. *Unit test checking the credits file covers every image file and every translation used.*
- AC32. Vicar's sign-off is recorded for the release version. *Manual checklist signed in the PR; tester confirms.*
- AC33. Scripture quotations match the cited reference in the named translation. *Second-agent review against the source text; recorded.*

**Reuse and repo**
- AC34. The module folder contains no hard-coded "Kington" names, domains or dates; a test builds it with a sample second church's config (different name, dates, colours, five-door minimal content) and it passes the same axe and date tests. *Unit and Playwright test using a fixture config.*
- AC35. The "how to adopt" guide steps, followed by a second agent on a clean fixture site, work. *Walk-through by a different agent, recorded.*
- AC36. Help page, README, changelog entry, build tag and `test/support/pages.ts` entry exist for the change. *Reviewer checklist.*
- AC37. `npm test` and `npm run audit` pass, reported as "kington-parishes: N tests passed in Xs". *Run by Claude and the tester.*

---

## 12. Out of scope

- Accounts, logins, progress syncing across devices, leaderboards or any user-generated content.
- Analytics, tracking, A/B testing, marketing email capture or sharing buttons.
- Audio narration, video and games (could be a later phase; Q10).
- A server component or database. The site remains static.
- Paid or secret "prize" mechanics.
- Writing the 25 days of content, designing the visuals, the architecture (other agents).
- Translations into other languages.
- Adapting the module for other seasons (Lent, Easter) though the configurable design should not prevent it.
- Physical/printed calendars and social media posts (any outward posts need Greg's approval separately).
- Commissioning artwork (decision in Q13; the commission itself is separate).

---

## 13. Open questions

Recommended defaults are given so work can proceed; none is settled. Answerer: Greg unless stated.

**Visibility**
- Q1. Does the calendar appear before 1 December (a teaser) or only 1 to 25 Dec? Does it stay visible after 25 December through Epiphany (6 Jan), or end on 25 Dec? *Recommended: hidden before 1 Dec (direct link shows friendly message); after 25 Dec, link removed from home page but page stays openable with all doors until 6 Jan.* (Greg; the vicar may have a view on Twelve Days of Christmas.)
- Q2. If it stays after Christmas, does the page then become "catch-up for everyone" or only for those who have been following? (Greg.)
- Q3. Epiphany/Magi: are the Magi in Advent's 25 days (traditionally they come after Christmas) or in a bonus "Twelfth Night/Epiphany" door on 6 January? How should the Magi be presented (the Bible gives no number or names; avoid presenting tradition as Scripture)? (Greg and the vicar.)

**No-peeking vs catch-up**
- Q4. Can a visitor open a past door they missed? Can they see or open future doors? *Recommended default: past and today's doors always openable (catch-up allowed, so no child is shut out); future doors show a closed door and a "opens on N December" message, with their content not in the page, search index or sitemap until the day.* The trade-off: with a static site, true no-peeking means future text is only published when its day arrives (daily rebuild/deploy) or is otherwise hidden; if future text ships in the page, a determined visitor can read it. Greg decides whether that level of protection matters or a gentle "no peeking" is enough. (Greg; architect advises cost.)
- Q5. Should we guard against a wrong device clock (e.g. a child changing the date)? *Recommended: no; accept and document.*
- Q6. Is a daily automatic rebuild/deploy acceptable (needed for the no-JS list and strict no-peeking)? (Greg.)

**Content and licensing**
- Q7. Which Bible translation(s)? Public-domain only unless permission. Who confirms the public-domain status in the UK (the vicar, or Greg's own check)? Does the diocese or parish already hold a licence that covers website use? (The vicar via Greg.) I have not assumed any translation is free to use.
- Q8. Who chooses and signs off the 25 passages and the theology? Is it the vicar alone, or the whole benefice's clergy (Kington Parishes covers five churches)? Is any denominational or diocesan guidance to follow? (The vicar via Greg.)
- Q9. Target length per day and reading age?
- Q10. Include a short reflection, prayer or "something to do/think about" each day? Include audio (read-aloud)? *Recommended: short optional reflection; no audio in version 1.*
- Q11. Printing a day's page: wanted? *Recommended: yes if it's cheap; not essential.*
- Q12. Should individual days be shareable by link? *Recommended: yes for available days.*

**Imagery**
- Q13. Commission artwork (who, from the parish or an illustrator, what budget) or use licensed/public-domain images, or children's artwork from parish groups? Any use of AI-generated images? All permission, cost and timescale commitments are Greg's decisions. (Greg.) No image is assumed to be available.
- Q14. Local church tie-ins (e.g. the five churches shown, a local Christmas service listed on the day, or a "come to our crib service" invitation on the relevant day)? Which services, with whose permission? Should related events be added to the calendar (`src/events.config.mjs`)? (Greg and the vicar.) Without these, no local detail is invented.

**Privacy and legal**
- Q15. Who approves the privacy-policy wording, and does anyone need to check whether browser storage counts as needing consent here? (Greg; legal check if he wants one.)
- Q16. Any usage numbers wanted at all (e.g. existing Cloudflare page views), or none? *Recommended: none.* (Greg.)

**Reuse and operations**
- Q17. How will other churches get it (free, shared with the benefice, paid, or a MediaWright product), and under what terms? Can Kington's content and images be shared? Pricing or offers to any church are Greg's decisions and are not made in this spec. Are the other parish sites Greg's memory notes mention (St Martin of Tours Chelsfield, Leominster Priory) the first intended adopters? (Greg.)
- Q18. Who updates the calendar each year and who approves it? (Greg and the vicar.)
- Q19. Deadline: is 1 December this year the target? That is a timing commitment for Greg; the spec makes none. (Greg.)
- Q20. Spec numbering/format: `docs/specs/` was empty. Does Greg want a numbering scheme (e.g. `001-...`) adopted for future specs?
- Q21. Is the Advent calendar to appear in the main navigation, or reached only by a home-page promo and direct link, as with Donate and the news archive? (Greg; UX advises.)

---

## 14. Decisions needed from Greg (summary)

1. Q1/Q2/Q3: visibility after 25 Dec, the Magi.
2. Q4/Q6: how strict "no peeking" should be, and whether a daily rebuild is acceptable.
3. Q7/Q8: translation and vicar sign-off route (who exactly).
4. Q13: artwork route and any budget; any commitments on cost or date are his alone.
5. Q17: terms for sharing with other churches.
6. Q15: privacy wording owner.

---

## Decisions from Greg (13 Oct 2026)

These settle the matching open questions above. Greg is the sole approver for this site.

1. **Future doors: gentle.** A locked door says "not yet" kindly and offers "open it anyway". Future day text is still kept out of the page, search index and sitemap (fetched per day).
2. **After 25 Dec: stays open** as "The Christmas Story", read-only with all doors available, until 6 Jan.
3. **Magi:** journey begins Day 21; full visit is a bonus door on 6 Jan.
4. **Bible text: World English Bible** (public domain) only. KJV short quotes are acceptable if labelled. Licence status to be confirmed and recorded.
5. **Artwork: designed in-house** as original simple SVG in the "golden thread" style, with a credits file. Greg approves; a person must review each picture.
6. **Sign-off: Greg only.**
7. **Placement: home-page banner** (plus the `/advent` page). Not in the main nav.
8. **Sharing with other churches:** terms left with Greg (commercial); not decided here.

### Demo / preview switch (new requirement)
Greg needs to demo the calendar on the live site outside 1-25 Dec.
- A URL parameter forces the calendar on and sets the pretend date, e.g. `/advent?advent-preview=2026-12-07` (also usable on the home page so the banner can be demoed).
- It must: show a clear "Preview mode, not today's date" notice; NOT write to the visitor's saved opened-doors (use memory only); not be linked from anywhere; leave the canonical URL and search index unaffected.
- Honest limitation: a static site cannot keep a parameter secret. With the gentle rule and per-day files this reveals nothing that is not already obtainable, so the cost is a spoiled surprise only. An optional site-specific preview key in `theme.mjs` can reduce casual use; it is obscurity, not security.
- Tests: preview parameter is ignored when absent or malformed; never persists state; real date logic is unchanged without it. Needs security-architect review as part of design.
- Supersedes the architect's advice not to ship a production query override: that advice assumed no demo need.

---

## Security design review (13 Oct 2026): PASS, conditional

Reviewer: security-architect. No hard blocks. Items below are must-fix before build. This section supersedes spec 3.4 ("no URL parameter changes the date") and AC27 where they conflict with Greg's decisions above.

### Design changes required
1. **Preview parameter, constrained form.** Only on `/advent` and `/`. Strict `YYYY-MM-DD`, round-trip checked, bounded to 1 Nov this year to 31 Jan next (and 2026+); anything else is silently ignored. Notice built from parsed numbers via `textContent`, never the raw value. Read from `location.search` only. Memory-only: no localStorage read or write. Never propagated into links, share URL or canonical (build them from `location.origin + location.pathname`). "Exit preview" link. `noindex` added by JS when active; canonical is static. Compiled out of the build when `theme.previewEnabled` is false (default true for Kington, false for other churches; Greg turns it off after 6 Jan). **No preview key in v1** (adds nothing as security).
2. **Per-day JSON is public in gentle mode.** `wrangler.jsonc` has no `run_worker_first`, so files in `public/` are served directly and a Worker "gate" would never run. For 2026 we ship gentle mode and say plainly that future days are fetchable by URL. A real gate (phase 2) means moving day files out of `public/`, scoping `run_worker_first` to the day path, `no-store` on locked responses, and a 404 identical to a missing day. Client builds the URL from a validated integer only; validates the JSON (size cap, content type, `day` matches) before use.
3. **No unsafe DOM APIs.** The mock-up uses `innerHTML`, inline `<script>` and `onclick=`; none may survive into the module. Zero `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write`/`eval`/`new Function` (grep test). Text via `textContent` only.
4. **Artwork as `<img src>` SVG files, never inlined.** Build lint rejects script, foreignObject, event handlers, external refs, entities. `/advent/art/*` served with a locked-down CSP (tightening only).
5. **Strict schemas**, build-time and client-side: exact key allowlist, length caps, no `<`/`>`, no control or bidi characters, art path `^[a-z0-9-]+\.svg$` resolved inside the art folder, no URLs/`@`/`{{` in content, colours hex only, timezone from the supported list, unknown keys fail the build.
6. **localStorage as untrusted input**, versioned and year-tagged key, size-capped, schema-checked, try/catch on every access.
7. **Failure behaviour:** if `Intl` misbehaves, fail closed to the "opens 1 December" state. Friendly errors only; no stack traces or paths shown.
8. **Read-aloud:** local voices only (`localService === true`), otherwise hide the control; cancel on close and `pagehide`. Share/copy never include preview or progress.
9. **Home banner computed client-side** from the same date function; no future titles in the home page HTML. A `adventEnabled` build flag allows quick rollback.
10. **Module integrity:** zero runtime dependencies; `VERSION` + `MANIFEST.sha256` of generic code files, checked by a unit test.
11. **Children's safety:** no forms, uploads, external links, `mailto` or `target=_blank` in the built page (tested); network test asserts same-origin only and no `Set-Cookie`, including in preview.

### Security acceptance criteria (added)
S1 no unsafe DOM APIs (grep test) · S2 no inline script, `_headers` CSP unchanged, no violations under `wrangler dev` · S3 day JSON validated at build and in client · S4 SVG via `<img>` with lint and locked-down CSP · S5 path allowlist + resolved-path check · S6 preview rules above, each tested (absent/malformed/out of range ignored; no storage; `<script>` value renders nothing; links/share/sitemap/search contain no `advent-preview`; byte-identical behaviour without it; string absent from build when flag off) · S7 storage hostile-value tests · S8 no cookies/third-party requests in every state · S9 privacy-policy wording approved before release · S10 future text absent from page HTML, search index and sitemap, reachable only via per-day JSON · S11 content/theme validators · S12 zero dependencies + manifest · S13 read-aloud/share rules · S14 no forms/links/mailto in built page.

### Open item for Greg
Browser storage and PECR: the ICO treats local storage like cookies, and "remember which doors I opened" is arguably a convenience, not "strictly necessary". Options: (a) accept the small risk with clear policy wording; (b) a small opt-in "remember my doors on this device" toggle (default off, memory-only) — cleanest; (c) no persistence. Security-architect recommends (b). Not legal advice; a legal check is Greg's call.

### Gates
security-engineer before release (S1-S14, production headers and console check, preview absent when flag off). security-architect re-review only if a Worker gate, any external link or resource, cross-device persistence, a daily-rebuild deploy token, or a second church with a different CSP is added.

---

## Decision: no remembering (Greg, 13 Oct 2026)

Option 3 chosen. **The module stores nothing in the visitor's browser** (no localStorage, sessionStorage, IndexedDB or cookies). Progress is simply the day of the month, so no memory is needed.

Consequences, which supersede earlier wording in this spec:
- Door states are only: **future** ("not yet"), **today**, **available** (past days, equal, never "missed"). No read/unread/peeked states, no "opened X of Y" counter, no "Next unread", no "Start again".
- Storage requirements and tests are void: AC on hostile localStorage values, S6's storage clauses, S7, and the PECR question. Replace S7 with: **the module never reads or writes any browser storage; a test greps module source and built JS for `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`.**
- Privacy policy: no new passage is needed for storage. If read-aloud ships, one sentence on local voices only.
- Preview mode needs no special storage rule: nothing is ever stored.
- A door opened in the current visit may be shown as selected in the page only (in memory); it resets on reload.

---

## Spec reconciliation (Phase 0)

Done 13 Oct 2026. The sections above were edited only where the three decision sections (Decisions from Greg, Security design review, Decision: no remembering) now contradict them. The decision sections themselves are unchanged and still win on any remaining conflict. Edits made:

- Section 2 (families, what visitors can see): "remembers where they got to" removed; future doors are gentle.
- 3.1: the 26 Dec row is now the decided "The Christmas Story" period to 6 Jan.
- 3.2: three door states only (future, today, available); gentle "not yet / open it anyway"; the localStorage and "start again" bullets replaced by "stores nothing".
- 3.4: the storage-failure and corrupted-storage bullets removed; "date forced for testing" now describes the constrained preview parameter (replaces "no URL parameter changes the date"); future deep links show the gentle message.
- Section 5: "What is stored" now "nothing"; stored-data validation rule removed; the URL rule allows the preview date; privacy-policy storage passage and PECR point removed; abuse case 2 marked void (replaced by S7); review list no longer mentions localStorage.
- Section 8: storage key setting removed. Section 9: previous-year progress rule replaced.
- Acceptance criteria: AC1 and AC3 clarified; AC8, AC9, AC10, AC13, AC27 reworded; AC11, AC12 void; AC29 void for storage.
- Unchanged on purpose: all open questions (Q1 to Q21) and the "Decisions needed" summary, which record the history; the appended decision sections.
