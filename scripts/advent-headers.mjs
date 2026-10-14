// `npm run advent:headers` prints the exact `_headers` rules the Advent calendar needs (see modules/advent/INTEGRATION.md),
// worked out from the files the build really writes. Paste them into public/_headers; test-unit/advent-headers.test.mjs
// fails if public/_headers lacks any of them. Nothing in the repository is written: the build runs in a temporary folder.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildAdvent, adventHeadersText } from '../modules/advent/build.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The headers text for the site's own theme and content (the list of built files does not depend on the launch flags or the scene). */
export async function headersForSite(root = ROOT) {
  const { loadAdventConfig } = await import('./advent-config.mjs');
  const { theme, content } = await loadAdventConfig(root);
  const publicDir = mkdtempSync(join(tmpdir(), 'advent-headers-'));
  try {
    const built = buildAdvent({ theme: { ...theme, scene: null, artRequired: false, goLive: false, publicListing: false }, content, publicDir, siteUrl: 'https://example.org', pageNames: [] });
    return adventHeadersText(built.files);
  } finally {
    rmSync(publicDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(await headersForSite());
}
