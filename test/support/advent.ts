// Shared by the specs that treat the Advent calendar page specially.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADVENT_PAGE } from './pages';

// Reads the theme's publicListing switch from its source (theme.mjs is an ES module and the
// specs are CommonJS), so the specs follow the switch instead of hard-coding today's value.
export function adventPubliclyListed(): boolean {
  const source = readFileSync(join(__dirname, '..', '..', 'modules', 'advent', 'theme.mjs'), 'utf8');
  const match = /^\s*publicListing:\s*(true|false)\s*,/m.exec(source);
  if (!match) throw new Error('could not read publicListing from modules/advent/theme.mjs');
  return match[1] === 'true';
}

/** Paths that should carry noindex and be missing from the sitemap, besides the help guide and changelog. */
export function adventHiddenPaths(): string[] {
  return adventPubliclyListed() ? [] : [ADVENT_PAGE.path];
}
