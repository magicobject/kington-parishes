# Coding standards: judgement rules

These are the lessons of the Advent calendar build, written for the people and agents who write and review code here.
`CLAUDE.md` holds the repo's mechanical rules (tests before a push, accessibility, security headers); this file holds the
judgement calls. A reviewer checks a change against each rule that applies.

## Validators and linters
- Accept only what you have listed as safe: write an allow-list of the syntax, elements and values you permit.
- When a deny-list or an estimator has been bypassed twice, stop patching it. Add a measurement of the real behaviour
  (for example the render time of a picture in a real browser), and make the validator refuse the construct that confused
  it (for example units written on numbers, or repeated style declarations) so that it can no longer reach the estimator.
- Treat a heuristic cost lint as a best-effort safety net, say so where it is documented, and rely on the measurement.

## Anything switched on later by flags (a launch)
- From the first commit, build a rehearsal that flips the flags in a temporary copy of the repo and runs every suite there.
- Pin the flags in the fixture themes the unit tests use, so flipping the real flags changes no fixture.
- Make each test that describes the pre-launch state skip itself once the flags are on, and keep the few guards that
  must be deleted at launch in one named list that the rehearsal and the checklist share.

## Generic and reusable modules
- Test a generic module with neutral fixtures. Keep site facts (names, wording, dates) in site-owned files and site-owned tests.
- Enforce the boundary with a test that fails when the module mentions the site or imports from outside itself.

## Tests
- Compute a value the build computes (a hash, a build number, a file list) inside the test and compare it with the
  built result. A literal pinned in a test goes stale silently.
- A test that cannot fail is a bug: make it bite, or delete it. Prove a new test by mutation: break the code on
  purpose, watch the test fail, then restore the code.
- Never skip, weaken or delete a test to get green. Fix the cause.
- A check of a live page that is not HTTP 200 fails: a page that does not load proves nothing about its content.

## Security findings
- Security reviewers report every finding with who can exploit it, what access they need, the worst outcome and the cost
  to fix. Greg decides whether a finding blocks. By default anything an anonymous visitor or ordinary user can exploit
  blocks the release; findings that need repo write access are notes unless cheap to fix. When a review loop passes two
  rounds on one area, stop and ask Greg before a third.
- Record an accepted finding where the next person will look, with the date and who accepted it.

## Tooling that every session depends on
- Test changes to hooks, CI and other shared tooling in throwaway repositories before they reach `main`.
- Have a different agent review them: the author does not review their own tooling.

## Working in the repo
- Give each concurrent session its own git worktree. Copy `node_modules` into it; never link or share it.
- Stage your own files by name. Leave other sessions' files alone.

## Source files
- The Advent source files (`modules/advent/**`, `scripts/advent-*.mjs`, `test-unit/advent-*.mjs`) are plain ASCII, with
  `\uXXXX` escapes for other characters, and a unit test fails if one gains a non-ASCII byte. Elsewhere in the repo
  non-ASCII text is fine.
- Some file-writing tools turn an escape into the literal character. After writing an Advent file, run
  `node scripts/ascii-escape.mjs <file>` to put the escapes back.

## Documentation
- When a section of one document copies a paragraph, list or table from another file (for example a `CLAUDE.md` section
  that repeats a README), keep the text in one file and replace the copy with a one-line pointer to it, so there is one
  place to update.
- Write the plain-English `/help` page alongside every technical doc for a change a visitor or editor can see.
