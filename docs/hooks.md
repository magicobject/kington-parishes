# The git hooks, in plain English

Three small programs run automatically when you commit and push. They exist so that the rules in `CLAUDE.md`
(a changelog entry and a build tag for every commit, tests before pushing) are enforced by the computer rather than
remembered by a person. They live in `.githooks/`; the real work is in `scripts/pre-commit.mjs`,
`scripts/post-commit.mjs` and `scripts/hook-lib.mjs`. They are wired up by `npm install` (it sets
`core.hooksPath`). A fresh clone needs `npm ci` first anyway.

## When you commit (pre-commit)

Before git records your commit, the hook checks, in this order, and stops with a plain message at the first problem:

1. **`node_modules` is there.** If the folder is missing or nearly empty it tells you to run `npm ci` in this
   checkout. (It has been found empty twice with no known cause, so it is checked every time.) Never link or share a
   `node_modules` folder between checkouts: copy it with `npm ci`.
2. **The changelog entry is there.** It works out the build number this commit will get (today's date, one more than
   the last build today, or `001` on a new day) without writing anything, then reads the *staged* copy of
   `src/pages/updates.html`. The top entry must have exactly that number, and the whole list must be tidy: every
   entry has one build number, none is empty or inside another, newest first. The message says which number it
   expected and which it found.
3. **Nothing is half finished.** If a file the build reads has changes you have not staged, or a new file in a
   folder the build reads has not been added, the commit is refused and the files are listed. Otherwise the pages
   would be built from work that is not in the commit. The files that count are: everything in `src/`, `templates/`,
   `modules/`, `scripts/`, `newsletter-templates/`, the hand-written files in `public/` (such as `css/style.css`,
   `_headers` and the images; not the generated pages), `package.json`, `package-lock.json` and
   `build-number.json`. Edits to `README.md`, `CLAUDE.md`, `docs/`, `test/` and `test-unit/` never block a commit
   (and are never added to it). Add the files (`git add FILE`), set them aside (`git stash`), or use a worktree (below).
4. **Then it builds.** It bumps `build-number.json`, runs the build and stages exactly the regenerated files that
   changed (`public/*.html`, the sitemap, the search index, the calendar and Advent generated files) plus
   `build-number.json`. The commit holds what you staged plus those, and nothing else. If a generated file already
   had somebody else's unsaved changes that the build does not reproduce, the hook puts everything back exactly as it
   was and refuses; it never sweeps them into your commit. Pages you rebuilt by hand with `npm run build` are fine.
   If the build itself fails the build number is put back.

Also refused, in plain words: a commit whose build number is already taken by a tag on another commit (another branch
or worktree got there first: update your branch, then give your changelog entry the next number).

**Ways of committing.** All of these work, and each commit holds exactly what you chose plus the regenerated files:
- `git add FILE ...` then `git commit` (the plain way).
- `git commit -a` / `-am` / `--all`: git first stages every *tracked* file you changed (README and docs too, that is what
  `-a` means), the hook then checks the staged changelog entry and builds. Brand-new (untracked) files are not picked up by
  `-a`; if one sits in a folder the build reads, the hook refuses and tells you to `git add` it. VS Code's "smart commit" uses `--all`.
- `git commit FILE ...` / `--only` / `-i FILE`: the named files only (plus, for `-i`, what was already staged). The
  hook puts its regenerated files into both the commit and the index git keeps for afterwards, so nothing is left half
  staged. If another build input is staged but not named, the hook refuses (it would be built into the pages but left out of
  the commit); name it too or unstage it.
- In a second worktree, the same.

**Amending.** A message-only amend (`git commit --amend` with nothing new staged) goes straight through: it keeps its
number. An amend that changes files is refused like a commit with no new entry, and the message prints the recipe:
`npm run build`, `git add public`, `git commit --amend --no-verify`, `git tag -f build-<date>.<NNN> HEAD` (check `git status` before `git add public`: it stages everything under `public/`, including a hand edit there). Never amend
a commit you have already pushed.

**Which date.** The build number, the build's "has this event happened yet?" filter and CI all use the **Europe/London
date**. Setting `BUILD_DATE=YYYY-MM-DD` in the environment makes the build use that date instead (it must be a real
date). You should never need it.

**Operations the hooks do not see.** Git runs no pre-commit or post-commit hook for a merge without conflicts, a
cherry-pick or a clean rebase step, and runs only post-commit for a revert. After any of those, run `npm run build`
and check `git status`; CI compares the committed `public/` with a fresh build and will notice.

## After you commit (post-commit)

The new commit gets the tag `build-<date>.<NNN>` (for example `build-2026.10.14.005`) from `build-number.json`. It
never moves a tag that exists and never pushes. It prints the tag and the command to push it; pushing the tag is
still your job: `git push origin build-2026.10.14.005`.

## When you push (pre-push)

Runs `npm run audit` (high and critical vulnerabilities block the push), `npm run test:unit` and `npm run typecheck`
(about half a minute in all), and tells you which one failed. Pushing only a tag runs the audit alone; a push that
only deletes branches or tags runs nothing. If the audit cannot reach the npm registry the push is still blocked (so an
unaudited push never leaves by accident), but the message says it is a network problem: connect and retry, or use
`git push --no-verify` if you must. The full
browser suite (`npm test`, about 1.5 minutes) is **not** run by the hook: it runs in CI on every pull request and
every push to `main` (`.github/workflows/ci.yml`, which also checks that the committed `public/` equals a fresh
build), and you should run it yourself before a release. `git push --no-verify` skips the hook; only do that on
purpose.

## The escape hatch

If you really do need to commit while other files have unstaged changes (rare), set the variable for that one command
only:

```
HOOK_ALLOW_UNSTAGED=1 git commit -m "..."
```

The hook prints a loud warning. It skips check 3 and the generated-file check in step 4. It still never stages a
file you did not stage, but the generated pages are built from your working files, so they may not match the
committed sources. Caveats: the build then overwrites any generated page you had edited by hand (the edit is lost), and
if `public/css/style.css` or another asset has an unstaged edit, the pages are rebuilt with that asset's new
`?v=` hash while the asset itself is not in the commit, so the committed pages point at a version that is not committed.
Stage everything that belongs together instead, whenever you can. Do not put the variable in your shell profile. The changelog and `node_modules` checks cannot be
skipped this way. (`git commit --no-verify` skips everything and leaves the build number and tag to you; CI will
still check the generated files.)

## A second session or person editing at the same time: use a worktree

Two people (or two Claude sessions) must not edit the same folder: one's unfinished work blocks the other's commit,
or worse. Give the second one its own folder on its own branch:

```
git worktree add ../my-second-copy -b my-branch
cd ../my-second-copy
npm ci
```

- **Run `npm ci` in every worktree.** Each needs its own `node_modules`. Never link, junction or symlink one to
  another checkout's, and never delete the main checkout's.
- Put worktrees outside `C:\Users\magic\github` if some tool lists every folder there.
- Build numbers and tags are shared by the whole repository. Whoever commits second pulls and takes the next number,
  so pull `main` (or merge it into your branch) before writing your changelog entry.
- Remove a worktree when finished: `git worktree remove ../my-second-copy`.

## CI and the date

`.github/workflows/ci.yml` rebuilds the site and then runs `node scripts/ci-drift-check.mjs`, which fails if the committed
`public/` differs from the fresh build. One thing is allowed to differ: the schema.org Event entries in
`public/calendar.html`, because the build drops events that have already happened, so they depend on the day the build runs.
Every other difference (including any other part of `calendar.html`) fails. This does not depend on commit dates, so squash
merges, rebases, cherry-picks and amends do not cause false failures.
