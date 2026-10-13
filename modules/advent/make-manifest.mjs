// Writes MANIFEST.sha256: one line per generic code file, "<sha256>  <path>", with line endings
// normalised to LF so the hashes match on every machine. theme.mjs and content.mjs are the
// site's own and are deliberately NOT listed. Run it with `npm run advent:manifest` after any change
// to the generic code, and bump VERSION in the same commit. A unit test fails until you do.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MANIFEST_FILES = [
  'date.mjs', 'preview.mjs', 'day.mjs', 'logic.mjs', 'schema.mjs', 'build.mjs', 'make-manifest.mjs', 'client/advent.js', 'client/advent.css', 'client/advent-teaser.js', 'client/advent-teaser.css', 'client/scene.svg',
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
