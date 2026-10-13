// WCAG 2 contrast checks for the colour pairings the Advent calendar uses
// (computed from modules/advent/theme.mjs, never eyeballed).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
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
  ];
  for (const [foreground, background, minimum] of pairs) {
    test(`${foreground} on ${background} is at least ${minimum}:1`, () => {
      const actual = ratio(foreground, background);
      assert.ok(actual >= minimum, `${foreground} on ${background} is ${actual.toFixed(2)}:1`);
    });
  }
});
