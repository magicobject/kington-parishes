// Writes MANIFEST.sha256: one line per generic code file, "<sha256>  <path>", with line endings
// normalised to LF so the hashes match on every machine. The site's own files (src/advent/theme.mjs and content.mjs)
// live outside this folder, so nothing listed here needs excluding: it is generic code plus the neutral templates in examples/. Run it with `npm run advent:manifest` after any change
// to the generic code, and bump VERSION in the same commit. A unit test fails until you do.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MANIFEST_FILES = [
  'date.mjs', 'preview.mjs', 'day.mjs', 'logic.mjs', 'schema.mjs', 'build.mjs', 'site-config.mjs', 'examples/theme.mjs', 'examples/content.mjs', 'host-kit/advent-config.mjs', 'host-kit/advent-headers.mjs', 'host-kit/advent-headers.test.mjs', 'host-kit/advent-host-features.test.mjs', 'host-kit/version-asset-urls.mjs', 'host-kit/advent-version-asset-urls.test.mjs', 'make-manifest.mjs', 'client/advent.js', 'client/advent.css', 'client/advent-teaser.js', 'client/advent-early.js','client/advent-teaser.css', 'client/scene.svg',
];

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

/** The manifest text for the files in `dir` (the module folder by default). */
export function manifestText(dir = MODULE_DIR) {
  return MANIFEST_FILES.map((path) => {
    const text = readFileSync(join(dir, path), 'utf8').replace(/\r\n/g, '\n');
    return `${createHash('sha256').update(text).digest('hex')}  ${path}\n`;
  }).join('');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(join(MODULE_DIR, 'MANIFEST.sha256'), manifestText());
  console.log('wrote modules/advent/MANIFEST.sha256');
}
