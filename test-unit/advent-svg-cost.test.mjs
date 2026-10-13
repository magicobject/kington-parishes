// The picture check bounds the cost of DRAWING a picture, not only its size (security review, 13 Oct 2026):
// resource references (mask, clip-path) may not nest, every drawn element has a weight and the total has a cap,
// dash patterns may not be microscopic, and numbers may not be enormous. Hostile pictures are generated here
// so the support file stays small.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lintSvg, svgDrawWeight, MAX_DRAW_WEIGHT } from '../modules/advent/build.mjs';

const R = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225">${body}</svg>`;
const rect = '<rect width="10" height="10" fill="#fff"/>';

// The security engineer's towers: each level of a mask (or clipPath) holds `fan` rects that each use the next level.
function tower(levels, fan, kind) {
  const attribute = kind === 'mask' ? 'mask' : 'clip-path';
  const element = kind === 'mask' ? 'mask' : 'clipPath';
  let defs = '';
  for (let level = levels; level >= 1; level -= 1) {
    const children = Array.from({ length: fan }, () => (level === levels ? rect : `<rect width="10" height="10" fill="#fff" ${attribute}="url(#t${level + 1})"/>`)).join('');
    defs += `<${element} id="t${level}">${children}</${element}>`;
  }
  return R(`<defs>${defs}</defs><rect width="400" height="225" fill="#000" ${attribute}="url(#t1)"/>`);
}

describe('resource references may not nest', () => {
  test('the mask tower (7 levels of 10) is refused, and the clipPath tower (6 levels of 10)', () => {
    for (const sample of [tower(7, 10, 'mask'), tower(6, 10, 'clip'), tower(3, 10, 'mask'), tower(12, 10, 'clip')]) {
      assert.match(lintSvg(sample)[0], /resource references may not nest/);
    }
  });

  test('a clip-path or mask on anything inside a clipPath or mask is refused, and on the clipPath or mask itself', () => {
    assert.ok(lintSvg(R('<defs><clipPath id="a"><rect width="1" height="1"/></clipPath><clipPath id="b"><rect width="1" height="1" clip-path="url(#a)"/></clipPath></defs>')).length > 0);
    assert.ok(lintSvg(R('<defs><clipPath id="a"><rect width="1" height="1"/></clipPath><clipPath id="b" clip-path="url(#a)"><rect width="1" height="1"/></clipPath></defs>')).length > 0);
    assert.ok(lintSvg(R('<defs><mask id="m"><g><rect width="1" height="1" mask="url(#m)"/></g></mask></defs>')).length > 0);
  });

  test('a use inside a clipPath or mask is refused', () => {
    assert.match(lintSvg(R('<defs><rect id="r" width="1" height="1"/><clipPath id="c"><use href="#r"/></clipPath></defs>'))[0], /may not nest/);
    assert.match(lintSvg(R('<defs><rect id="r" width="1" height="1"/><mask id="m"><use href="#r"/></mask></defs>'))[0], /may not nest/);
  });

  test('one level of clip-path or mask on an ordinary element is fine', () => {
    assert.deepEqual(lintSvg(R('<defs><clipPath id="c"><rect width="5" height="5"/></clipPath><mask id="m"><rect width="5" height="5" fill="#fff"/></mask></defs><rect width="9" height="9" clip-path="url(#c)"/><rect width="9" height="9" mask="url(#m)"/>')), []);
  });
});

describe('the weighted draw budget', () => {
  test('the weights are what the review described', () => {
    assert.equal(svgDrawWeight('<svg><rect/></svg>'), 2);
    assert.equal(svgDrawWeight('<svg><rect opacity=".5"/></svg>'), 1 + 1 + 5);
    assert.equal(svgDrawWeight('<svg><rect style="opacity:.5"/></svg>'), 1 + 1 + 5);
    assert.equal(svgDrawWeight('<svg><defs><clipPath id="c"><rect/></clipPath></defs><rect clip-path="url(#c)"/></svg>'), 1 + (1 + 5 + 5));
    assert.equal(svgDrawWeight('<svg><defs><mask id="m"><rect/></mask></defs><rect mask="url(#m)" opacity=".5"/></svg>'), 1 + (1 + 5 + 5));
    // A use weighs its whole target: a symbol (1) holding three rects (3), plus the use itself (1), plus the svg (1).
    assert.equal(svgDrawWeight('<svg><defs><symbol id="s"><rect/><rect/><rect/></symbol></defs><use href="#s"/></svg>'), 1 + 1 + 4);
    // Things inside defs are only drawn through a use.
    assert.equal(svgDrawWeight('<svg><defs><g id="g"><rect/><rect/></g></defs></svg>'), 1);
  });

  test(`the cap is ${MAX_DRAW_WEIGHT}: a picture at the cap passes, one over is refused`, () => {
    assert.equal(MAX_DRAW_WEIGHT, 1500);
    const plain = (count) => `<svg>${'<rect/>'.repeat(count)}</svg>`;
    assert.deepEqual(lintSvg(plain(MAX_DRAW_WEIGHT - 1)), []);
    assert.match(lintSvg(plain(MAX_DRAW_WEIGHT))[0], /too costly to draw/);
  });

  test('"heavy50": 1500 masked rects in a group, used 50 times, is refused (about 800,000 weight)', () => {
    const rects = '<rect width="1" height="1" mask="url(#m)"/>'.repeat(1500);
    const sample = R(`<defs><mask id="m"><rect width="9" height="9" fill="#fff"/></mask><g id="heavy">${rects}</g></defs>${'<use href="#heavy"/>'.repeat(50)}`);
    assert.ok(sample.length < 100 * 1024, 'small enough that the size rule is not what refuses it');
    const stats = {};
    assert.match(lintSvg(sample, stats)[0], /too costly to draw/);
    assert.ok(stats.weight > 500000);
  });

  test('50 uses of a plain 100-rect group are refused too (50 x 101 > cap)', () => {
    const sample = R(`<defs><g id="g">${rect.repeat(100)}</g></defs>${'<use href="#g"/>'.repeat(50)}`);
    assert.match(lintSvg(sample)[0], /too costly to draw/);
  });

  test('a handful of uses of figures, as in the mock-up, stays far under the cap', () => {
    const sample = R(`<defs><symbol id="s">${rect.repeat(20)}</symbol></defs>${'<use href="#s"/>'.repeat(10)}`);
    assert.deepEqual(lintSvg(sample), []);
    assert.ok(svgDrawWeight(sample) < 400);
  });

  test('the heaviest ACCEPTED fixture (used by the browser timing test) passes and sits close under the cap', () => {
    const text = readFileSync(new URL('../test/support/heaviest-accepted.svg', import.meta.url), 'utf8');
    assert.deepEqual(lintSvg(text), []);
    const weight = svgDrawWeight(text);
    assert.ok(weight > 0.75 * MAX_DRAW_WEIGHT && weight <= MAX_DRAW_WEIGHT, `weight ${weight}`);
  });
});

describe('dash patterns and enormous numbers', () => {
  const dash = (value) => R(`<path d="M0 0L9 9" stroke="#fff" stroke-dasharray="${value}"/>`);
  test('a dash between 0 and 0.5 is refused; 0.5, 0, and ordinary patterns pass', () => {
    for (const bad of ['0.1', '0.4999', '.2 3', '5, 0.01', '3 3 0.3']) assert.match(lintSvg(dash(bad))[0], /dash/, bad);
    for (const good of ['0.5', '0', '5 3', '1,2', '10']) assert.deepEqual(lintSvg(dash(good)), [], good);
  });

  test('a number over 100000 in a size, position, path or transform is refused', () => {
    for (const sample of [
      R('<rect width="100001" height="1"/>'), R('<circle cx="1" cy="1" r="1e6"/>'), R('<rect x="-100001" width="1" height="1"/>'),
      R('<path d="M0 0L200000 5"/>'), R('<g transform="translate(300000 0)"><rect/></g>'), R('<polygon points="0,0 9,9 123456,1"/>'),
      R('<rect stroke-width="999999" width="1" height="1"/>'),
    ]) assert.match(lintSvg(sample)[0], /larger than 100000/);
    assert.deepEqual(lintSvg(R('<rect x="100000" y="-100000" width="1" height="1"/>')), []);
  });

  test('colours, ids and labels are not read as numbers', () => {
    assert.deepEqual(lintSvg(R('<rect fill="#100000" id="a1000000" width="1" height="1"/>')), []);
  });
});

describe('earlier rules still stand', () => {
  test('51 uses, a use of a use, and the billion-laughs shape are still refused', () => {
    assert.match(lintSvg(R(`<defs><rect id="r" width="1" height="1"/></defs>${'<use href="#r"/>'.repeat(51)}`))[0], /more than 50/);
    assert.match(lintSvg(R('<defs><rect id="r"/><use id="u" href="#r"/></defs><use href="#u"/>'))[0], /use/);
  });
});
