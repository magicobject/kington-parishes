// WCAG 2 contrast checks for the colour pairings the Advent calendar uses
// (computed from modules/advent/theme.mjs, never eyeballed).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { theme } from '../modules/advent/theme.mjs';

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(foreground, background) {
  const [a, b] = [luminance(theme.colours[foreground]), luminance(theme.colours[background])];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('contrast', () => {
  test('the luminance function is right: black on white is 21:1, identical colours 1:1', () => {
    assert.ok(Math.abs((luminance('#ffffff') + 0.05) / (luminance('#000000') + 0.05) - 21) < 0.001);
    assert.equal((luminance('#336699') + 0.05) / (luminance('#336699') + 0.05), 1);
  });

  const pairs = [
    ['text', 'paper', 4.5],
    ['textSoft', 'paper', 4.5],
    ['link', 'paper', 4.5],
    ['cream', 'night', 4.5],
    ['accentInk', 'accent', 4.5],
    ['accent', 'night', 4.5],
    ['doorEdge', 'door', 3], // user-interface edge, 3:1 is the rule
    ['focus', 'night', 3], // focus ring, 3:1 is the rule
    // Phase 3 (the real calendar). Ratios computed here, recorded for the next person:
    ['cream', 'door', 4.5], //        10.58  door number and date on an open door
    ['cream', 'doorLocked', 4.5], //  12.82  door number and date on a "not yet" door
    ['cream', 'sky2', 4.5], //         9.10  heading and status on the lighter end of the sky gradient
    ['doorEdge', 'night', 3], //       4.62  a door's edge against the sky (user-interface edge)
    ['doorEdge', 'sky2', 3], //        3.16  the same against the lighter end of the sky
    ['doorEdge', 'doorLocked', 3], //  4.46  the dashed edge against its own "not yet" door
    ['doorEdge', 'paper', 3], //       3.29  hairlines between the sections of the day panel
    ['focus', 'sky2', 3], //          10.19  focus ring against the lighter end of the sky
    ['focus', 'door', 3], //          11.85  the pale "today" ring against an open door
    ['accent', 'sky2', 4.5], //        6.70  the banner heading on the lighter end of its gradient
  ];
  for (const [foreground, background, minimum] of pairs) {
    test(`${foreground} on ${background} is at least ${minimum}:1`, () => {
      const actual = ratio(foreground, background);
      assert.ok(actual >= minimum, `${foreground} on ${background} is ${actual.toFixed(2)}:1`);
    });
  }
});

// Two pairings that are NOT used, because they fail. They are listed so nobody reaches for them:
//   focus on accent 1.52 and link on accent 3.56. The focus ring on the gold "today" door works only because
//   it is drawn 3px OUTSIDE the door (outline-offset), so it sits against the dark sky, never on the gold.
describe('pairings that fail and must not be relied on', () => {
  test('focus on accent and link on accent really are below the text/ring thresholds', () => {
    assert.ok(ratio('focus', 'accent') < 3);
    assert.ok(ratio('link', 'accent') < 4.5);
  });
});

// Every colour in the stylesheets comes from a --advent-* token, so every pairing is one the table above checked.
// The only literal colours allowed are black and white, in the print stylesheet.
describe('the stylesheets use only the tokens', () => {
  for (const file of ['client/advent.css', 'client/advent-teaser.css']) {
    test(`${file} has no literal colours except black and white (print)`, () => {
      const css = readFileSync(new URL(`../modules/advent/${file}`, import.meta.url), 'utf8');
      const literal = css.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g) ?? [];
      const allowed = new Set(['#000', '#fff']);
      assert.deepEqual(literal.filter((value) => !allowed.has(value.toLowerCase())), [], file);
    });
  }
});
