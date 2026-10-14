#!/usr/bin/env node
// The post-commit hook (run by .githooks/post-commit): tags the commit just made with its build number, so the
// "build-<date>.<NNN>" tag that CLAUDE.md requires can't be forgotten. It never moves an existing tag and never pushes.
import { execFileSync } from 'node:child_process';
import { tagFor } from './hook-lib.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

let state;
try { state = JSON.parse(git('show', 'HEAD:build-number.json')); } catch { process.exit(0); } // no build number in this commit
const tag = tagFor(state);

function isAncestor(sha) {
  try { execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { stdio: 'ignore' }); return true; } catch { return false; }
}

let existing = null;
try { existing = git('rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`); } catch { /* no such tag */ }
if (existing) {
  const head = git('rev-parse', 'HEAD');
  if (existing === head) console.error(`post-commit: tag ${tag} already points at this commit.`);
  else if (isAncestor(existing)) console.error(`post-commit: tag ${tag} already exists on an earlier commit (${existing.slice(0, 7)}), so it was NOT moved. (This commit did not get a new build number.)`);
  else console.error(`post-commit: tag ${tag} is on ${existing.slice(0, 7)}, which is no longer part of this branch (an amend or rebase?), and was NOT moved. If this commit should carry the tag, and the tag has not been pushed, run:  git tag -f ${tag} HEAD`);
  process.exit(0);
}
git('tag', tag, 'HEAD');
console.error(`post-commit: tagged this commit ${tag}. Remember to push it:  git push origin ${tag}`);
