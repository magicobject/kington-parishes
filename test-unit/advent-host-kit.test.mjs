// modules/advent/host-kit/ holds the host-side files a second church copies (INTEGRATION.md). They must stay byte-identical to the
// working copies this site uses, so what a second church copies is what is tested here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const KIT = [
  ['advent-config.mjs', 'scripts/advent-config.mjs'],
  ['advent-headers.mjs', 'scripts/advent-headers.mjs'],
  ['advent-headers.test.mjs', 'test-unit/advent-headers.test.mjs'],
  ['advent-host-features.test.mjs', 'test-unit/advent-host-features.test.mjs'],
  ['version-asset-urls.mjs', 'scripts/version-asset-urls.mjs'],
  ['advent-version-asset-urls.test.mjs', 'test-unit/advent-version-asset-urls.test.mjs'],
];

for (const [kitName, livePath] of KIT) {
  test(`host-kit/${kitName} is identical to ${livePath}`, () => {
    const kit = readFileSync(new URL(`../modules/advent/host-kit/${kitName}`, import.meta.url), 'utf8');
    const live = readFileSync(new URL(`../${livePath}`, import.meta.url), 'utf8');
    assert.equal(kit, live, `copy ${livePath} to modules/advent/host-kit/${kitName} (or the other way round) so they match`);
  });
}
