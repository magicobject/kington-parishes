// The generic module code is versioned: VERSION names the release and MANIFEST.sha256 pins every generic
// code file (LF-normalised), so a copy of the module on another site can be checked against this one.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { manifestText, MANIFEST_FILES } from '../modules/advent/make-manifest.mjs';

const read = (path) => readFileSync(new URL(`../modules/advent/${path}`, import.meta.url), 'utf8');

describe('modules/advent VERSION and MANIFEST.sha256', () => {
  test('VERSION is a semantic version and a date, nothing else', () => {
    assert.match(read('VERSION'), /^\d+\.\d+\.\d+ \d{4}-\d{2}-\d{2}\n$/);
  });

  test('the manifest lists the generic code and never the site-owned files', () => {
    assert.deepEqual(MANIFEST_FILES.slice().sort(), ['build.mjs', 'client/advent.css', 'client/advent.js', 'date.mjs', 'day.mjs', 'logic.mjs', 'make-manifest.mjs', 'preview.mjs', 'schema.mjs']);
    assert.ok(!/theme\.mjs|content\.mjs/.test(read('MANIFEST.sha256')));
  });

  test('the manifest matches the code on disk', () => {
    assert.equal(
      read('MANIFEST.sha256'),
      manifestText(),
      'generic module code changed: update VERSION and run npm run advent:manifest',
    );
  });

  test('every line is "<64 hex digits>, two spaces, a path"', () => {
    for (const line of read('MANIFEST.sha256').trimEnd().split('\n')) assert.match(line, /^[0-9a-f]{64} {2}\S+$/);
  });
});
