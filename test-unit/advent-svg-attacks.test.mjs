// The structural rules behind the draw-cost check (security review, 14 Oct 2026): paint is charged per PAINTED shape (after it
// is inherited from the groups around the shape and through <use>), gradient paint inside a mask is charged for every
// reference, a shape counts as "large" by its real size (percentages, paths, polygons, strokes, scale transforms, scaled
// symbols), and two hard caps stand behind the weights: at most MAX_GRADIENT_SHAPES shapes painted with a gradient and at most
// MAX_LARGE_SHAPES large ones. Whatever the lint accepts is rendered in Chromium by test/advent-svg-render.spec.ts.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { lintSvg, MAX_DRAW_WEIGHT, MAX_GRADIENT_SHAPES, MAX_LARGE_SHAPES } from '../modules/advent/build.mjs';
import { ATTACKS, largestAccepted, refused } from './support/svg-attacks.mjs';

const R = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225">${body}</svg>`;
const stops = '<stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/>';
const defs = `<defs><linearGradient id="g">${stops}</linearGradient></defs>`;
const stats = (text) => { const out = {}; lintSvg(text, out); return out; };

describe('the two caps', () => {
  test('the caps are 20 gradient shapes and 15 large shapes', () => {
    assert.equal(MAX_GRADIENT_SHAPES, 20);
    assert.equal(MAX_LARGE_SHAPES, 15);
  });

  test('20 gradient shapes pass, 21 are refused', () => {
    const shapes = (n) => R(`${defs}${'<circle r="5" fill="url(#g)"/>'.repeat(n)}`);
    assert.deepEqual(lintSvg(shapes(MAX_GRADIENT_SHAPES)), []);
    assert.match(lintSvg(shapes(MAX_GRADIENT_SHAPES + 1))[0], /too many shapes painted with a gradient/);
  });

  test('15 large shapes pass, 16 are refused (a plain solid fill counts)', () => {
    const shapes = (n) => R('<rect width="400" height="225" fill="#123"/>'.repeat(n));
    assert.deepEqual(lintSvg(shapes(MAX_LARGE_SHAPES)), []);
    assert.match(lintSvg(shapes(MAX_LARGE_SHAPES + 1))[0], /too many large shapes/);
  });

  test('a shape with a gradient in BOTH fill and stroke counts once towards the gradient cap', () => {
    assert.equal(stats(R(`${defs}<circle r="5" fill="url(#g)" stroke="url(#g)"/>`)).gradientShapes, 1);
  });

  test('the real pictures and the scene stay well under both caps (at least 2.5 times the real maximum)', () => {
    const folder = new URL('../public/advent/', import.meta.url);
    const files = [...readdirSync(new URL('art/', folder)).map((n) => `art/${n}`), ...readdirSync(folder).filter((n) => /^scene.*\.svg$/.test(n))];
    let [gradients, large, weight] = [0, 0, 0];
    for (const file of files) {
      const found = stats(readFileSync(new URL(file, folder), 'utf8'));
      gradients = Math.max(gradients, found.gradientShapes);
      large = Math.max(large, found.largeShapes);
      weight = Math.max(weight, found.weight);
    }
    assert.ok(files.length >= 27, 'the 26 pictures and the scene');
    assert.ok(gradients * 2.5 <= MAX_GRADIENT_SHAPES, `real maximum of gradient shapes: ${gradients}`);
    assert.ok(large * 2.5 <= MAX_LARGE_SHAPES, `real maximum of large shapes: ${large}`);
    assert.ok(weight * 2.5 <= MAX_DRAW_WEIGHT, `real maximum weight: ${weight}`);
  });
});

describe('paint is charged per painted shape, wherever it comes from', () => {
  test('a group\'s fill is inherited by every shape inside it', () => {
    assert.equal(stats(R(`${defs}<g fill="url(#g)">${'<rect width="9" height="9"/>'.repeat(10)}</g>`)).gradientShapes, 10);
    assert.equal(stats(R(`${defs}<g fill="url(#g)"><g><rect width="9" height="9"/></g></g>`)).gradientShapes, 1);
  });

  test('a shape\'s own fill beats the group\'s, and fill="none" ends the inheritance', () => {
    assert.equal(stats(R(`${defs}<g fill="url(#g)"><rect width="9" height="9" fill="#fff"/><rect width="9" height="9" fill="none"/></g>`)).gradientShapes, 0);
  });

  test('a group\'s stroke and stroke-width are inherited', () => {
    assert.equal(stats(R(`${defs}<g stroke="url(#g)">${'<line x2="9" y2="9"/>'.repeat(4)}</g>`)).gradientShapes, 4);
    assert.equal(stats(R(`<g stroke="#000" stroke-width="3000"><line x2="9" y2="9"/></g>`)).largeShapes, 1);
  });

  test('a use carries its own paint to its target, and the target is charged again for each use', () => {
    const body = `${defs}<defs><rect id="r" width="9" height="9"/></defs>`;
    assert.equal(stats(R(`${body}<use href="#r" fill="url(#g)"/><use href="#r" fill="url(#g)"/>`)).gradientShapes, 2);
    assert.equal(stats(R(`${body}<g fill="url(#g)"><use href="#r"/></g>`)).gradientShapes, 1);
  });

  test('gradient paint inside a mask is charged for EVERY reference, in the weight and in the cap', () => {
    const body = (references) => `${defs}<defs><mask id="m"><rect width="9" height="9" fill="url(#g)"/></mask></defs>${'<rect width="9" height="9" mask="url(#m)"/>'.repeat(references)}`;
    assert.equal(stats(R(body(1))).gradientShapes, 1);
    assert.equal(stats(R(body(7))).gradientShapes, 7);
    assert.match(lintSvg(R(body(20).replace('<rect width="9" height="9" fill="url(#g)"/>', '<rect width="9" height="9" fill="url(#g)"/><rect width="9" height="9" fill="url(#g)"/>')))[0], /too many shapes painted with a gradient/);
  });
});

describe('what counts as a large shape', () => {
  const large = (shape, extra = '') => stats(R(`${extra}${shape}`)).largeShapes;

  test('a rectangle, circle or ellipse over a quarter of the picture is large; under it is not', () => {
    assert.equal(large('<rect width="400" height="57"/>'), 1);
    assert.equal(large('<rect width="400" height="55"/>'), 0);
    assert.equal(large('<circle cx="200" cy="100" r="100"/>'), 1);
    assert.equal(large('<circle cx="200" cy="100" r="50"/>'), 0);
    assert.equal(large('<ellipse rx="200" ry="50"/>'), 1);
  });

  test('a percentage size is large', () => {
    assert.equal(large('<rect width="100%" height="10"/>'), 1);
    assert.equal(large('<circle r="50%"/>'), 1);
  });

  test('a path or polygon is large by its box, relative commands included', () => {
    assert.equal(large('<path d="M0 0H400V225H0Z"/>'), 1);
    assert.equal(large('<path d="M0 0h400v225h-400z"/>'), 1);
    assert.equal(large('<path d="M100 100C150 120 160 90 200 100"/>'), 0);
    assert.equal(large('<polygon points="0,0 400,0 400,225"/>'), 1);
    assert.equal(large('<polygon points="0,0 40,0 40,22"/>'), 0);
    assert.equal(large('<polyline points="0,0 400,225"/>'), 1, 'a browser fills an open polyline too');
    assert.equal(large('<polyline points="0,0 400,225" fill="none"/>'), 0, 'unfilled and unstroked it paints nothing');
  });

  test('a long thick stroke is large, a thin outline of the same box is not', () => {
    assert.equal(large('<path d="M0 0H400V225H0Z" fill="none" stroke="#000" stroke-width="1"/>'), 0);
    assert.equal(large('<line x1="0" y1="100" x2="400" y2="100" stroke="#000" stroke-width="120"/>'), 1);
    assert.equal(large('<line x1="0" y1="0" x2="4" y2="4" stroke="#000" stroke-width="101"/>'), 1);
    assert.equal(large('<line x1="0" y1="0" x2="400" y2="225" stroke="#000" stroke-width="2"/>'), 0);
  });

  test('a scale transform (own or from a group) multiplies the size', () => {
    assert.equal(large('<rect width="10" height="10" transform="scale(40 22.5)"/>'), 1);
    assert.equal(large('<g transform="scale(160)"><rect width="1" height="1"/></g>'), 1);
    assert.equal(large('<g transform="matrix(160 0 0 160 0 0)"><rect width="1" height="1"/></g>'), 1);
    assert.equal(large('<g transform="translate(300 100) rotate(20)"><rect width="10" height="10"/></g>'), 0);
  });

  test('a symbol scaled up by its use counts at the scaled size', () => {
    const symbol = '<defs><symbol id="s" viewBox="0 0 1 1"><rect width="1" height="1"/></symbol></defs>';
    assert.equal(large('<use href="#s" width="400" height="225"/>', symbol), 1);
    assert.equal(large('<use href="#s" width="8" height="8"/>', symbol), 0);
    assert.equal(large('<use href="#s"/>', symbol), 1, 'a use without a size fills the picture');
  });

  test('an svg inside the svg is refused', () => {
    assert.match(lintSvg(R('<svg width="40000" height="22500" viewBox="0 0 400 225"><rect width="1" height="1"/></svg>'))[0], /svg inside the svg/);
  });
});

describe('the hostile pictures', () => {
  // The size each was found accepted at (security: A 880, B 870, J 20 references, L 880, V 870; tester: the ten attempts).
  const ORIGINAL = {
    A_group_paint_inherited_rects: 880, B_group_paint_16_stops: 870, C_percent_rect: 290, D_path_full_canvas: 440, E_path_repeating_gradient: 88,
    F_small_rect_scaled_up: 440, G_use_of_a_group: 49, H_radial_reflect: 88, I_thick_line_stroke: 440, J_mask_of_gradient_rects: 20,
    K_clip_of_many_paths: 20, L_group_paint_with_opacity: 880, M_huge_root_viewbox: 60, N_tiny_root_viewbox: 60, O_gradient_transform_repeat: 25,
    P_fill_and_stroke_paint: 250, Q_circle_percent_radius: 290, R_nested_svg_scaled: 400, S_symbol_scaled_up_by_use: 49, T_plain_full_canvas_rects: 700,
    U_full_canvas_with_opacity: 140, V_group_stroke_inherited: 870, W1_use_of_full_canvas_radial: 35, W2_stacked_polygons_16_stops: 64,
    W3_wide_line_reflecting_stroke: 60, W4_use_of_full_canvas_opacity: 60, W5_nested_opacity_groups: 60, W6_tiny_rect_scaled_gradient_repeat: 60,
    W7_ellipse_just_under_a_quarter: 60, W8_skewed_repeating_path_fill_and_stroke: 60, W9_use_of_group_of_gradient_paths: 50, W10_clip_and_gradient_path: 60,
    X1_evenodd_tiny_subpaths: 40, X2_thousands_of_round_caps: 880, X3_dense_polygon_strokes: 100, X4_clip_and_opacity_small_shapes: 200,
    X5_scaled_group_of_small_shapes: 400, X6_wide_stroke_on_a_short_line: 100,
  };

  for (const [name, n] of Object.entries(ORIGINAL)) {
    test(`${name} at its original size (${n}) is refused`, () => {
      assert.equal(refused(name, n), true);
    });
  }

  test('every class has an accepted size (or is refused whole), and what is accepted is inside every cap', () => {
    for (const name of Object.keys(ATTACKS)) {
      const accepted = largestAccepted(name);
      if (accepted === null) continue;
      assert.ok(accepted.stats.weight <= MAX_DRAW_WEIGHT, name);
      assert.ok(accepted.stats.gradientShapes <= MAX_GRADIENT_SHAPES, name);
      assert.ok(accepted.stats.largeShapes <= MAX_LARGE_SHAPES, name);
    }
  });

  test('the caps are what bind: full-size shapes stop at 15 (large cap), plain full-size rectangles too', () => {
    assert.equal(largestAccepted('B_group_paint_16_stops').n, MAX_LARGE_SHAPES);
    assert.equal(largestAccepted('T_plain_full_canvas_rects').stats.largeShapes, MAX_LARGE_SHAPES);
  });
});
