// Content-hashed asset addresses, for a host build that has none (INTEGRATION.md, feature 4). Copy this file into scripts/ and use it as the
// LAST step of making each page: `html = versionAssetUrls(html);`, with `const versionAssetUrls = createAssetVersioner(join(root, 'public'));`.
// Every same-origin <link href="/x.css"> and <script src="/x.js"> becomes "/x.css?v=<first 10 hex digits of the file's SHA-256>". A reference to
// a file that does not exist fails the build, so a typo is caught. Only the file's content decides the address, so a page changes only when
// something it loads has changed. Never write a ?v= by hand.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Returns versionAssetUrls(html) for the files under `publicDir`. */
export function createAssetVersioner(publicDir) {
  const hashes = new Map();
  const hashOf = (publicPath) => {
    if (!hashes.has(publicPath)) {
      const file = join(publicDir, publicPath);
      if (!existsSync(file)) throw new Error(`build: a page references ${publicPath}, which does not exist in public/`);
      hashes.set(publicPath, createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 10));
    }
    return hashes.get(publicPath);
  };
  return (html) => html.replace(/<(link|script)\b[^>]*>/g, (tag) =>
    tag.replace(/\b(href|src)="(\/(?!\/)[^"?#]+)"/, (_, attribute, path) => `${attribute}="${path}?v=${hashOf(path)}"`));
}
