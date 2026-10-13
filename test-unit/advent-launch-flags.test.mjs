// The three launch flags in theme.mjs must flip together at launch (docs/advent/launch-checklist.md).
// This test is PERMANENT (it is not one of the pre-launch guards): it stops the real date from driving the
// calendar (goLive) before the pictures are required (artRequired) and the page is listed (publicListing).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { theme } from '../modules/advent/theme.mjs';
import { validateTheme } from '../modules/advent/schema.mjs';

describe('the launch flags', () => {
  test('goLive is a boolean, and the schema requires it', () => {
    assert.equal(typeof theme.goLive, 'boolean');
    const without = structuredClone(theme);
    delete without.goLive;
    assert.throws(() => validateTheme(without), /goLive/);
    assert.throws(() => validateTheme({ ...structuredClone(theme), goLive: 'true' }), /goLive/);
  });

  test('goLive true needs artRequired true and publicListing true (all three flip together)', () => {
    if (theme.goLive === true) {
      assert.equal(theme.artRequired, true, 'goLive is on but artRequired is not');
      assert.equal(theme.publicListing, true, 'goLive is on but publicListing is not');
    }
  });

  test('the schema refuses a theme that goes live without them', () => {
    assert.throws(() => validateTheme({ ...structuredClone(theme), goLive: true, artRequired: false, publicListing: true }), /goLive/);
    assert.throws(() => validateTheme({ ...structuredClone(theme), goLive: true, artRequired: true, publicListing: false }), /goLive/);
    assert.doesNotThrow(() => validateTheme({ ...structuredClone(theme), goLive: true, artRequired: true, publicListing: true }));
  });
});
