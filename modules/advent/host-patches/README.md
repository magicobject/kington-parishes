# Host patches

Small changes a host site's build may need before it can run the Advent calendar (see `../INTEGRATION.md`, "Features the host must have").
Each patch was made on a COPY of a sibling church website that lacked the feature, applied while following INTEGRATION.md, and proved by that
copy's build and its whole test suite. They are ports of what the reference site already does.
Apply one with `git apply modules/advent/host-patches/<file>` from the root of the host repository, and always run `git apply --check <file>`
first. If a checkout uses Windows line endings (CRLF) a patch may not apply: make the edit by hand in an editor instead (each patch is only
two or three lines, shown below).

| Patch | Feature | Changes | Fits a host whose build... |
|-------|---------|---------|----------------------------|
| `1-page-headhtml.patch` | 1. `page.headHtml` | `scripts/build.mjs`: a page entry's `headHtml` goes into the page head | has the line `if (page.robots) extraHead += ...` |
| `1b-page-headhtml-robots-variable.patch` | 1. `page.headHtml` | the same change | has the line `if (robots) extraHead += ...` (a `robots` variable worked out per page) |
| `2-page-unlisted.patch` | 2. `page.unlisted` | `scripts/build-search-index.mjs`: `isIndexable` refuses an unlisted page (and a non-boolean flag) | has an `isIndexable` that only checks the never-indexed slugs |
| `3-data-search-skip.patch` | 3. `data-search-skip` | `scripts/build-search-index.mjs`: `extractSearchEntries` drops `[data-search-skip]` elements | does not know the attribute |

Use 1 OR 1b, never both. Each of 1 and 1b was checked with `git apply --check` against an untouched clone of the host it was made for, and
fails on the other shape (that is how you tell which to use).

**The hand edit for patch 1 and 1b** (the same two lines, whatever your host looks like): in `scripts/build.mjs`, where the page's `extraHead`
text is built, right after the line that adds the robots meta tag, add

    if (page.headHtml) extraHead += `${page.headHtml}\n`;

The text then goes into the page head through your page template's extra-head placeholder.

Not patched, on purpose:

- **4. Content-hashed addresses (`?v=<hash>`)** have no patch because they are a new function, not an edit. `../host-kit/version-asset-urls.mjs` is a
  tested, generic version (about 14 lines): copy it to `scripts/`, then in the page loop make `versionAssetUrls(html)` the LAST step of each page
  (`const versionAssetUrls = createAssetVersioner(join(root, 'public'));`). It checks the files exist, so run it after the Advent files are written.
  Until content-hashed addresses work on your site, do NOT paste the cache rules from `npm run advent:headers` into `_headers` (a year-long cache without
  hashed addresses would keep visitors on old files).
- **5. Token order and the `buildAdvent` call** are wiring in the host's own `scripts/build.mjs`, described step by step in INTEGRATION.md
  (steps 6 to 8); they differ from host to host, so there is no patch.

The check in `../host-kit/advent-host-features.test.mjs` says whether each feature is really there.
