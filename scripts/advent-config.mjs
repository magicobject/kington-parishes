// The host's loader for the Advent calendar's two site-owned files, src/advent/theme.mjs and src/advent/content.mjs.
// src/pages.config.mjs calls it, and only because the Advent page is part of this site; a site without the calendar never does.
// It stops the build with a plain message when a file is missing or is still the placeholder copied from modules/advent/examples/.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertNotPlaceholder } from '../modules/advent/site-config.mjs';

/** Imports `<root>/src/advent/theme.mjs` and `content.mjs` and returns { theme, content }. Throws a plain Error on a problem. */
export async function loadAdventConfig(root) {
  const loaded = {};
  for (const name of ['theme', 'content']) {
    const path = join(root, 'src', 'advent', `${name}.mjs`);
    if (!existsSync(path)) {
      throw new Error(`Advent: src/advent/${name}.mjs is missing. Copy modules/advent/examples/${name}.mjs to src/advent/${name}.mjs and write your own (see modules/advent/INTEGRATION.md).`);
    }
    loaded[name] = (await import(pathToFileURL(path).href))[name];
  }
  assertNotPlaceholder(loaded);
  return loaded;
}

/** The same, for a build: a problem prints ONE plain message (no stack trace) and ends the build with exit code 1. */
export async function loadAdventConfigOrExit(root) {
  try {
    return await loadAdventConfig(root);
  } catch (error) {
    console.error(`\n${error.message}\n`);
    process.exit(1);
  }
}
