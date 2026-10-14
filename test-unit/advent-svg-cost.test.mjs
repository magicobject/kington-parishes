// The picture check bounds the cost of DRAWING a picture, not only its size (security review, 13 Oct 2026):
// resource references (mask, clip-path) may not nest, every drawn element has a weight and the total has a cap,
// dash patterns may not be microscopic, and numbers may not be enormous. Hostile pictures are generated here
// so the support file stays small.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lintSvg, svgDrawWeight, MAX_DRAW_WEIGHT } from '../modules/advent/build.mjs';
import { largestAccepted } from './support/svg-attacks.mjs';

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
    assert.equal(svgDrawWeight('<svg><defs><clipPath id="c"><rect/></clipPath></defs><rect clip-path="url(#c)"/></svg>'), 1 + (1 + 5 + 5) + 2); // plus the clipPath and its rect, once
    assert.equal(svgDrawWeight('<svg><defs><mask id="m"><rect/></mask></defs><rect mask="url(#m)" opacity=".5"/></svg>'), 1 + (1 + 5 + 5) + 2);
    // A use weighs its whole target: a symbol (1) holding three rects (3), plus the use itself (1), plus the svg (1).
    assert.equal(svgDrawWeight('<svg><defs><symbol id="s"><rect/><rect/><rect/></symbol></defs><use href="#s"/></svg>'), 1 + 1 + 4);
    // Things inside defs are only drawn through a use.
    assert.equal(svgDrawWeight('<svg><defs><g id="g"><rect/><rect/></g></defs></svg>'), 1);
  });

  test(`the cap is ${MAX_DRAW_WEIGHT}: a picture at the cap passes, one over is refused`, () => {
    assert.equal(MAX_DRAW_WEIGHT, 900); // about 3x the heaviest real picture (weight 311)
    const plain = (count) => `<svg>${'<rect/>'.repeat(count)}</svg>`;
    assert.deepEqual(lintSvg(plain(MAX_DRAW_WEIGHT - 1)), []);
    assert.match(lintSvg(plain(MAX_DRAW_WEIGHT))[0], /too costly to draw/);
  });

  test('"heavy50": 600 masked rects in a group, used 50 times, is refused (the original had 1500, which now also trips the 40 KB file cap)', () => {
    const rects = '<rect width="1" height="1" mask="url(#m)"/>'.repeat(600);
    const sample = R(`<defs><mask id="m"><rect width="9" height="9" fill="#fff"/></mask><g id="heavy">${rects}</g></defs>${'<use href="#heavy"/>'.repeat(50)}`);
    assert.ok(sample.length < 40 * 1024, 'small enough that the size rule is not what refuses it');
    const stats = {};
    assert.match(lintSvg(sample, stats)[0], /too costly to draw|at most 20/);
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

  // The old static "heaviest accepted" fixtures were rebuilt from the shape-capped classes in test/support/svg-attacks.mjs:
  // the largest picture of each class that the lint still accepts sits near the cap, and the browser spec times it.
  test('the heaviest accepted pictures of the weight-bound classes sit close under the cap', () => {
    for (const name of ['X2_thousands_of_round_caps', 'X4_clip_and_opacity_small_shapes', 'X5_scaled_group_of_small_shapes', 'Y1_mask_of_small_circles_many_references', 'Y2_uses_of_a_complex_stroked_path']) {
      const accepted = largestAccepted(name);
      assert.ok(accepted, name);
      assert.ok(accepted.stats.weight > 0.9 * MAX_DRAW_WEIGHT && accepted.stats.weight <= MAX_DRAW_WEIGHT, `${name} weight ${accepted.stats.weight}`);
    }
  });
});

describe('dash patterns and enormous numbers', () => {
  const dash = (value) => R(`<path d="M0 0L9 9" stroke="#fff" stroke-dasharray="${value}"/>`);
  test('dashed lines are not allowed at all: the number of dashes is the path length over the dash length, which no weight can bound', () => {
    for (const value of ['0.1', '0.5', '5 3', '1,2', '10', '0']) assert.match(lintSvg(dash(value))[0], /stroke-dasharray/, value);
    assert.match(lintSvg(R('<circle r="9" stroke="#000" stroke-dashoffset="3"/>'))[0], /stroke-dashoffset/);
    // The security review's cases: a 100000-radius circle and a long line, dashed finely and used 40 times.
    assert.ok(lintSvg(R('<circle cx="200" cy="112" r="100000" fill="none" stroke="#000" stroke-dasharray="0.5"/>')).length > 0);
    assert.ok(lintSvg(R('<defs><line id="l" x1="0" y1="0" x2="100000" y2="100000" stroke="#000" stroke-dasharray="0.5 0.5"/></defs>' + '<use href="#l"/>'.repeat(40))).length > 0);
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

// A browser redraws the WHOLE content of a mask or clipPath for EVERY element that references it (security review,
// round 3). So a mask costs (its subtree) x (the number of references to it, counting each use of a group that holds
// a reference), and there are hard caps on references and on the size of a mask.
describe('masks and clip paths are charged per reference', () => {
  const circles = (count) => '<circle cx="200" cy="112" r="20" fill-opacity=".5"/>'.repeat(count);
  const maskPicture = (inside, references, element = 'mask') => {
    const attribute = element === 'mask' ? 'mask' : 'clip-path';
    const tag = element === 'mask' ? 'mask' : 'clipPath';
    return R(`<defs><${tag} id="m">${inside}</${tag}></defs>${`<rect width="40" height="40" ${attribute}="url(#m)"/>`.repeat(references)}`);
  };
  const costly = /too costly to draw|too many|at most (?:20|50)|larger than 40 KB/;

  test('the security engineer\'s reproducer (1800 circles in one mask, 136 references) is refused', () => {
    assert.match(lintSvg(maskPicture(circles(1800), 136))[0], costly);
  });

  test('mask900x130 and the clipPath variants (900 or 1800 shapes, 130 or 136 references) are refused', () => {
    assert.match(lintSvg(maskPicture(circles(900), 130))[0], costly);
    assert.match(lintSvg(maskPicture('<path d="M0 0L400 0L200 225z" opacity=".5"/>'.repeat(1800), 136, 'clip'))[0], costly);
    assert.match(lintSvg(maskPicture('<rect width="400" height="225"/>'.repeat(1800), 136, 'clip'))[0], costly);
    assert.match(lintSvg(maskPicture(circles(1500), 130))[0], costly);
  });

  test('a mask holding at most 50 elements is allowed; 51 are refused, however few references there are', () => {
    assert.deepEqual(lintSvg(maskPicture(circles(50), 1)), []);
    assert.match(lintSvg(maskPicture(circles(51), 1))[0], /at most 50/);
    assert.match(lintSvg(maskPicture('<rect width="4" height="4"/>'.repeat(51), 1, 'clip'))[0], /at most 50/);
  });

  test('at most 20 mask or clip-path references in a picture; 21 are refused', () => {
    assert.deepEqual(lintSvg(maskPicture('<rect width="9" height="9"/>', 20)), []);
    assert.match(lintSvg(maskPicture('<rect width="9" height="9"/>', 21))[0], /at most 20/);
  });

  test('a use of a group that holds a reference multiplies the mask cost (and counts toward the 20)', () => {
    const body = `<defs><mask id="m">${circles(40)}</mask><g id="g"><rect width="400" height="225" mask="url(#m)"/></g></defs>`;
    assert.deepEqual(lintSvg(R(`${body}${'<use href="#g"/>'.repeat(3)}`)), []);
    assert.match(lintSvg(R(`${body}${'<use href="#g"/>'.repeat(21)}`))[0], /at most 20/);
    // 20 uses x 41-element mask = 820 plus the references themselves (20 x 12), the rects and uses: over the cap together with more shapes
    const heavy = R(`${body}${'<use href="#g"/>'.repeat(20)}${'<rect width="9" height="9" opacity=".5"/>'.repeat(300)}`);
    assert.match(lintSvg(heavy)[0], costly);
  });

  test('a small legitimate gradient mask on a few shapes is still accepted, with its cost counted', () => {
    const sample = R('<defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient><mask id="soft"><rect width="400" height="225" fill="url(#fade)"/></mask></defs><circle cx="100" cy="100" r="50" mask="url(#soft)"/><circle cx="200" cy="100" r="50" mask="url(#soft)"/><circle cx="300" cy="100" r="50" mask="url(#soft)"/>');
    assert.deepEqual(lintSvg(sample), []);
    // svg 1, three circles 11 each (1 + 5 + 5), and the mask x 3 references: the mask 1 + its rect 1 + the gradient (1 for two stops, 10 for
    // covering the picture) = 13 each time, because the paint INSIDE a mask is charged for every reference
    assert.equal(svgDrawWeight(sample), 1 + 33 + 39);
  });
});

// Round 4: geometry is weighted by its COMPLEXITY (a 4,000-arc path is not "one draw"), and size and data caps sit far
// above real art but far below hostile files. Hostile pictures are generated here.
describe('path and polygon complexity is part of the weight', () => {
  const arcs = (count) => {
    let d = 'M0 0';
    for (let i = 0; i < count; i += 1) d += `A${50 + (i % 50)} ${60 + (i % 40)} ${i % 90} ${i % 2} ${(i + 1) % 2} ${(i * 13) % 400} ${(i * 7) % 225}`;
    return d;
  };
  const weigh = (body) => svgDrawWeight(R(body));

  test('a path weighs 1 + floor(segments / 10); every command, and every repeated implicit coordinate set, is a segment', () => {
    assert.equal(weigh('<path d="M0 0L1 1"/>'), 1 + 1);
    assert.equal(weigh('<path d="M0 0L1 1L2 2L3 3L4 4L5 5L6 6L7 7L8 8L9 9"/>'), 1 + (1 + 1)); // 10 segments
    assert.equal(weigh(`<path d="${arcs(25)}"/>`), 1 + (1 + 2)); // 1 move + 25 arcs = 26 segments
    assert.equal(weigh('<path d="M0 0L1 1 2 2 3 3 4 4 5 5 6 6 7 7 8 8 9 9"/>'), 1 + (1 + 1)); // implicit repeats count: 10 segments
    assert.equal(weigh('<path d="M0 0C1 1 2 2 3 3 4 4 5 5 6 6"/>'), 1 + 1); // 1 move + 2 curves
    assert.equal(weigh('<path d="M0 0h1v1h-1z"/>'), 1 + 1);
    assert.equal(weigh('<path d="M0 0L1 1" opacity=".5"/>'), 1 + (1 + 5));
  });

  test('compact numbers are still counted (1-2.5.3 is three numbers)', () => {
    assert.equal(weigh('<path d="M0 0L1-2.5.3-4L5 6L7 8L9 1L2 3L4 5L6 7L8 9L1 2"/>'), 1 + (1 + 1));
  });

  test('polygon and polyline weigh 1 + floor(points / 5); line, rect, circle and ellipse stay 1', () => {
    const points = (n) => Array.from({ length: n }, (_, i) => `${i},${i}`).join(' ');
    assert.equal(weigh(`<polygon points="${points(4)}"/>`), 1 + 1);
    assert.equal(weigh(`<polygon points="${points(12)}"/>`), 1 + (1 + 2));
    assert.equal(weigh(`<polyline points="${points(50)}"/>`), 1 + (1 + 10));
    assert.equal(weigh('<line x1="0" y1="0" x2="9" y2="9"/><rect width="9" height="9"/><circle r="9"/><ellipse rx="9" ry="3"/>'), 1 + 4);
  });

  test('a use charges the full weight of its target EACH time, so complexity multiplies', () => {
    const heavy = `<defs><path id="h" d="${arcs(100)}"/></defs>`; // 101 segments: weight 1 + 10 = 11
    assert.equal(weigh(`${heavy}<use href="#h"/>`), 1 + (1 + 11));
    assert.equal(weigh(`${heavy}${'<use href="#h"/>'.repeat(10)}`), 1 + 10 * 12);
  });

  test('a mask holding a complex path is charged per reference (the path complexity is in the mask weight)', () => {
    const body = `<defs><mask id="m"><path d="${arcs(100)}" fill="#fff"/></mask></defs>${'<rect width="400" height="225" mask="url(#m)"/>'.repeat(5)}`;
    // svg 1, five masked rects 11 each, and the mask (itself 1 + path 11) x 5
    assert.equal(weigh(body), 1 + 55 + 12 * 5);
  });
});

describe('size and data caps', () => {
  const bigPath = (arcsCount) => {
    let d = 'M0 0';
    for (let i = 0; i < arcsCount; i += 1) d += `A${50 + (i % 50)} ${60 + (i % 40)} ${i % 90} ${i % 2} ${(i + 1) % 2} ${(i * 13) % 400} ${(i * 7) % 225}`;
    return d;
  };

  test('a file over 40 KB is refused, one just under it is fine', () => {
    assert.match(lintSvg(`<svg><desc>${'a'.repeat(40 * 1024 + 10)}</desc></svg>`)[0], /40 KB/);
    assert.deepEqual(lintSvg(`<svg><desc>${'a'.repeat(40 * 1024 - 40)}</desc></svg>`), []);
  });

  test('a single path longer than 4 KB is refused; one under it is fine', () => {
    assert.match(lintSvg(R(`<path d="M0 0${'L1 1'.repeat(1100)}"/>`))[0], /4 KB/);
    assert.deepEqual(lintSvg(R(`<path d="M0 0${'L1 1'.repeat(900)}"/>`)), []);
  });

  test('all the path data in a picture together may not exceed 24 KB', () => {
    const path = `<path d="M0 0${'L1 1'.repeat(900)}"/>`; // about 3.6 KB each
    assert.deepEqual(lintSvg(R(path.repeat(6))), []); // about 21.6 KB
    assert.match(lintSvg(R(path.repeat(7)))[0], /24 KB/);
  });

  test('a polygon or polyline with a points list longer than 1 KB is refused', () => {
    const points = (n) => Array.from({ length: n }, (_, i) => `${i % 400},${i % 225}`).join(' ');
    assert.deepEqual(lintSvg(R(`<polygon points="${points(100)}"/>`)), []);
    assert.match(lintSvg(R(`<polygon points="${points(6000)}"/>`))[0], /1 KB|40 KB/);
    assert.match(lintSvg(R(`<polyline points="${points(200)}"/>`))[0], /1 KB/);
  });

  test('the hostile class from the security review is refused: use50heavyPath, its small version, heavy masks and clips', () => {
    const useHeavy = (arcsCount) => R(`<defs><path id="h" d="${bigPath(arcsCount)}" fill="#fa0" stroke="#000" stroke-width="5"/></defs>${'<use href="#h"/>'.repeat(50)}`);
    assert.ok(lintSvg(useHeavy(4300)).length > 0);
    assert.ok(lintSvg(useHeavy(1200)).length > 0);
    assert.ok(lintSvg(useHeavy(230)).length > 0, '50 uses of the biggest allowed path are over the budget');
    const heavyMask = (tag, attribute) => R(`<defs><${tag} id="m"><path d="${bigPath(4000)}" fill="#fff"/></${tag}></defs>${`<rect width="400" height="225" ${attribute}="url(#m)"/>`.repeat(20)}`);
    assert.ok(lintSvg(heavyMask('mask', 'mask')).length > 0);
    assert.ok(lintSvg(heavyMask('clipPath', 'clip-path')).length > 0);
    assert.ok(lintSvg(heavyMask('mask', 'mask').replace(bigPath(4000), bigPath(230))).length > 0, '20 references to a mask holding the biggest allowed path');
  });

  test('more variants: 6000-point polygons used 50 times, one 100 KB path, 500 medium paths, a stroked path of tiny segments', () => {
    const points = Array.from({ length: 6000 }, (_, i) => `${i % 400},${(i * 7) % 225}`).join(' ');
    assert.ok(lintSvg(R(`<defs><polygon id="p" points="${points}" fill="#fa0"/></defs>${'<use href="#p"/>'.repeat(50)}`)).length > 0);
    assert.match(lintSvg(R(`<path d="M0 0${'l1 1'.repeat(30000)}" stroke="#000"/>`))[0], /40 KB/);
    const medium = `<path d="M0 0${'L3 4'.repeat(100)}" stroke="#000" fill="none"/>`;
    assert.ok(lintSvg(R(medium.repeat(500))).length > 0, '500 paths x 100 segments = 50,000 segments');
    assert.ok(lintSvg(R(`<path d="M0 0${'l0.01 0.01'.repeat(400)}" stroke="#000" stroke-width="3" fill="none"/>`.repeat(30))).length > 0);
  });

  test('legitimate pictures stay accepted: the mock-up crowd scene and a drawing of a few hundred segments', () => {
    const picture = R(`<path d="${bigPath(60)}" fill="#E8C27A" stroke="#fff" stroke-width="2"/><polygon points="0,0 100,0 50,80 20,40" fill="#fff"/>`);
    assert.deepEqual(lintSvg(picture), []);
  });
});

describe('gradients are charged for their stops, per shape that uses them', () => {
  const stops = (n) => Array.from({ length: n }, (_, i) => `<stop offset="${(i / n).toFixed(3)}" stop-color="#8000ff"/>`).join('');
  const gradient = (n, shapes) => R(`<defs><radialGradient id="g">${stops(n)}</radialGradient></defs>${'<rect width="400" height="225" fill="url(#g)"/>'.repeat(shapes)}`);

  test('a gradient with more than 16 stops is refused', () => {
    assert.deepEqual(lintSvg(gradient(16, 1)), []);
    assert.match(lintSvg(gradient(17, 1))[0], /16 stops/);
  });

  test('each paint reference to a gradient pays ceil(stops / 2), +8 if it repeats or reflects, +10 if the shape covers more than 25% of the picture', () => {
    // A full-size rectangle: 1 + ceil(4/2)=2 + 10 (large) = 13 each, plus the svg
    assert.equal(svgDrawWeight(gradient(4, 10)), 1 + 10 * 13);
    assert.equal(svgDrawWeight(gradient(10, 10)), 1 + 10 * (1 + 5 + 10));
    // A small circle with the same gradient as fill AND stroke pays twice (no large-area charge): 1 + 8 + 8
    assert.equal(svgDrawWeight(R(`<defs><linearGradient id="g">${stops(15)}</linearGradient></defs><circle r="9" stroke="url(#g)" fill="url(#g)"/>`)), 1 + (1 + 8 + 8));
    // Repeat and reflect cost 8 more per reference
    const spread = (kind) => R(`<defs><linearGradient id="g" spreadMethod="${kind}">${stops(4)}</linearGradient></defs><circle r="9" fill="url(#g)"/>`);
    assert.equal(svgDrawWeight(spread('pad')), 1 + (1 + 2));
    assert.equal(svgDrawWeight(spread('repeat')), 1 + (1 + 2 + 8));
    assert.equal(svgDrawWeight(spread('reflect')), 1 + (1 + 2 + 8));
    // Large circles and ellipses count too (a 100000-radius circle covers the picture); a small rectangle does not
    assert.equal(svgDrawWeight(R(`<defs><linearGradient id="g">${stops(4)}</linearGradient></defs><circle r="99999" fill="url(#g)"/>`)), 1 + (1 + 2 + 10));
    assert.equal(svgDrawWeight(R(`<defs><linearGradient id="g">${stops(4)}</linearGradient></defs><rect width="50" height="50" fill="url(#g)"/>`)), 1 + (1 + 2));
  });

  // The security engineer's accepted files from the third review (a06_radial_rects, a14_lin_rects, a01_bigcircle_grad):
  // 16-stop repeat/reflect gradients on hundreds of full-size shapes took 0.7 to 2.1 seconds at 800 and 1200px.
  const hostileStops = (n = 16) => Array.from({ length: n }, (_, i) => `<stop offset="${(i / (n - 1)).toFixed(3)}" stop-color="#${(i * 16).toString(16).padStart(2, '0')}80ff" stop-opacity=".6"/>`).join('');
  const radial = `<defs><radialGradient id="g" cx="0.5" cy="0.5" r="0.02" fx="0.9" fy="0.1" spreadMethod="reflect">${hostileStops()}</radialGradient></defs>`;
  const linear = `<defs><linearGradient id="l" x1="0" x2="0.003" spreadMethod="repeat">${hostileStops()}</linearGradient></defs>`;

  test('a06: 200 full-size rectangles filled with a reflecting 16-stop radial gradient are refused', () => {
    assert.match(lintSvg(R(radial + '<rect width="400" height="225" fill="url(#g)"/>'.repeat(200)))[0], /too costly|too many shapes/);
    assert.match(lintSvg(R(radial + '<rect width="400" height="225" fill="url(#g)"/>'.repeat(213)))[0], /too costly|too many shapes/); // the reviewer's accepted count
  });

  test('a14: 120 full-size rectangles with a repeating 16-stop linear gradient as fill and stroke are refused', () => {
    assert.match(lintSvg(R(linear + '<rect width="400" height="225" fill="url(#l)" fill-opacity=".3" stroke="url(#l)" stroke-width="50"/>'.repeat(126)))[0], /too costly|too many shapes/);
    assert.match(lintSvg(R(linear + '<rect width="400" height="225" fill="url(#l)" fill-opacity=".3" stroke="url(#l)" stroke-width="50"/>'.repeat(60)))[0], /too costly|too many shapes/);
  });

  test('a01: 126 huge circles with gradient fill and stroke are refused', () => {
    const both = radial.replace('</defs>', '') + linear.replace('<defs>', '');
    assert.match(lintSvg(R(both + '<circle cx="200" cy="100" r="99999" fill="url(#g)" stroke="url(#l)" stroke-width="99999" fill-opacity=".4"/>'.repeat(126)))[0], /too costly|too many shapes/);
  });

  test('ordinary use stays accepted: a few big gradient backgrounds and a handful of gradient shapes', () => {
    const sky = '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1530"/><stop offset=".7" stop-color="#1b2a55"/><stop offset="1" stop-color="#34406b"/></linearGradient></defs>';
    const picture = R(sky + '<rect width="400" height="225" fill="url(#g)"/>' + '<circle cx="50" cy="50" r="20" fill="url(#g)"/>'.repeat(10) + '<rect width="400" height="60" y="165" fill="url(#g)"/>');
    assert.deepEqual(lintSvg(picture), []);
    assert.ok(svgDrawWeight(picture) < 100);
  });

  test('450 stops on 300 full-size rectangles (607 ms in a browser) and 16 stops on 300 shapes (over the budget) are refused', () => {
    assert.ok(lintSvg(gradient(450, 300)).length > 0);
    assert.match(lintSvg(gradient(16, 300))[0], /too costly|too many shapes/);
  });

  test('a use of a shape with a gradient charges it again each time', () => {
    const body = `<defs><radialGradient id="g">${stops(15)}</radialGradient><rect id="r" width="400" height="225" fill="url(#g)"/></defs>`;
    assert.equal(svgDrawWeight(R(`${body}${'<use href="#r"/>'.repeat(10)}`)), 1 + 10 * (1 + 1 + 8 + 10)); // use 1, rect 1, 15 stops 8, large 10
  });
});
