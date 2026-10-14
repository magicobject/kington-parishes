// Hostile pictures for the draw-cost check (security and tester reviews, 14 Oct 2026). Each entry builds a picture from a
// repeat count `n`. The unit tests (test-unit/advent-svg-attacks.test.mjs) assert that a big `n` is REFUSED by lintSvg, and
// that the largest `n` the lint still ACCEPTS is found by bisection; test/advent-svg-render.spec.ts then renders that
// accepted file in Chromium at 400, 800 and 1200px and requires it to take under a second. Whatever the lint accepts must be fast.
import { lintSvg } from '../../modules/advent/build.mjs';

const wrap = (body, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225" aria-hidden="true" focusable="false"${extra}>${body}</svg>`;
const repeat = (n, text) => Array.from({ length: n }, (_, i) => (typeof text === 'function' ? text(i) : text)).join('');
const stops = (count, opacity = false) => Array.from({ length: count }, (_, i) => `<stop offset="${(i / (count - 1)).toFixed(3)}" stop-color="${i % 2 ? '#fff' : '#102030'}"${opacity ? ` stop-opacity="${i % 2 ? 0.5 : 0.9}"` : ''}/>`).join('');
const gradient = (count, kind = 'linearGradient', attributes = '', opacity = false) => `<${kind} id="g" ${attributes}>${stops(count, opacity)}</${kind}>`;
const full = '<rect width="400" height="225" fill="url(#g)"/>';
const square = 'M0 0H400V225H0Z';

export const ATTACKS = {
  // The security engineer's accepted-slow files (A, B, J, L, V) and the rest of their class.
  A_group_paint_inherited_rects: (n) => wrap(`<defs>${gradient(3)}</defs><g fill="url(#g)">${repeat(n, '<rect width="400" height="225"/>')}</g>`),
  B_group_paint_16_stops: (n) => wrap(`<defs>${gradient(16)}</defs><g fill="url(#g)">${repeat(n, '<rect width="400" height="225"/>')}</g>`),
  C_percent_rect: (n) => wrap(`<defs>${gradient(2)}</defs>${repeat(n, '<rect width="100%" height="100%" fill="url(#g)"/>')}`),
  D_path_full_canvas: (n) => wrap(`<defs>${gradient(2)}</defs>${repeat(n, `<path d="${square}" fill="url(#g)"/>`)}`),
  E_path_repeating_gradient: (n) => wrap(`<defs>${gradient(2, 'linearGradient', 'spreadMethod="repeat" x2="0.01"')}</defs>${repeat(n, `<path d="${square}" fill="url(#g)"/>`)}`),
  F_small_rect_scaled_up: (n) => wrap(`<defs>${gradient(2)}</defs>${repeat(n, '<rect width="10" height="10" transform="scale(40 22.5)" fill="url(#g)"/>')}`),
  G_use_of_a_group: (n) => wrap(`<defs>${gradient(2)}<g id="a">${repeat(8, `<path d="${square}" fill="url(#g)"/>`)}</g></defs>${repeat(Math.min(n, 49), '<use href="#a"/>')}`),
  H_radial_reflect: (n) => wrap(`<defs>${gradient(2, 'radialGradient', 'spreadMethod="reflect" r="0.001"')}</defs>${repeat(n, `<path d="${square}" fill="url(#g)"/>`)}`),
  I_thick_line_stroke: (n) => wrap(`<defs>${gradient(2)}</defs>${repeat(n, '<line x1="0" y1="100" x2="400" y2="100" stroke-width="5000" stroke="url(#g)"/>')}`),
  J_mask_of_gradient_rects: (n) => wrap(`<defs>${gradient(16)}<mask id="m">${repeat(25, full)}</mask></defs>${repeat(Math.min(n, 20), '<rect width="400" height="225" fill="#fff" mask="url(#m)"/>')}`),
  K_clip_of_many_paths: (n) => wrap(`<defs><clipPath id="c">${repeat(25, `<path d="${square}"/>`)}</clipPath></defs>${repeat(Math.min(n, 20), '<rect width="400" height="225" fill="#fff" clip-path="url(#c)"/>')}`),
  L_group_paint_with_opacity: (n) => wrap(`<defs>${gradient(2)}</defs><g fill="url(#g)" fill-opacity="0.5">${repeat(n, `<path d="${square}"/>`)}</g>`),
  M_huge_root_viewbox: (n) => wrap(`<defs>${gradient(2)}</defs>${repeat(n, '<rect width="100000" height="100000" fill="url(#g)"/>')}`).replace('viewBox="0 0 400 225"', 'viewBox="0 0 100000 100000"'),
  N_tiny_root_viewbox: (n) => wrap(`<defs>${gradient(2)}</defs>${repeat(n, '<rect width="4" height="2.25" fill="url(#g)"/>')}`).replace('viewBox="0 0 400 225"', 'viewBox="0 0 4 2.25"'),
  O_gradient_transform_repeat: (n) => wrap(`<defs>${gradient(16, 'radialGradient', 'gradientTransform="scale(0.001)" spreadMethod="repeat"')}</defs>${repeat(n, full)}`),
  P_fill_and_stroke_paint: (n) => wrap(`<defs>${gradient(2)}</defs>${repeat(n, `<path d="${square}" fill="url(#g)" stroke="url(#g)" stroke-width="200"/>`)}`),
  Q_circle_percent_radius: (n) => wrap(`<defs>${gradient(2)}</defs>${repeat(n, '<circle cx="200" cy="100" r="100%" fill="url(#g)"/>')}`),
  R_nested_svg_scaled: (n) => wrap(`<defs>${gradient(2)}</defs><svg width="40000" height="22500" viewBox="0 0 400 225">${repeat(n, `<path d="${square}" fill="url(#g)"/>`)}</svg>`),
  S_symbol_scaled_up_by_use: (n) => wrap(`<defs>${gradient(2)}<symbol id="s" viewBox="0 0 1 1">${repeat(8, '<path d="M0 0H1V1H0Z" fill="url(#g)"/>')}</symbol></defs>${repeat(Math.min(n, 49), '<use href="#s" width="400" height="225"/>')}`),
  T_plain_full_canvas_rects: (n) => wrap(repeat(n, '<rect width="400" height="225" fill="#123456"/>')),
  U_full_canvas_with_opacity: (n) => wrap(repeat(n, '<rect width="400" height="225" fill="#123456" opacity="0.5"/>')),
  V_group_stroke_inherited: (n) => wrap(`<defs>${gradient(2)}</defs><g stroke="url(#g)" stroke-width="3000">${repeat(n, '<line x1="0" y1="0" x2="400" y2="225"/>')}</g>`),
  // The tester's ten accepted attempts.
  W1_use_of_full_canvas_radial: (n) => wrap(`<defs><radialGradient id="g">${stops(16, true)}</radialGradient><rect id="r" width="400" height="225" fill="url(#g)" opacity="0.5"/></defs>${repeat(Math.min(n, 50), '<use href="#r"/>')}`),
  W2_stacked_polygons_16_stops: (n) => wrap(`<defs><linearGradient id="g">${stops(16, true)}</linearGradient></defs>${repeat(n, '<polygon points="0,0 400,0 400,225 0,225" fill="url(#g)" opacity="0.5"/>')}`),
  W3_wide_line_reflecting_stroke: (n) => wrap(`<defs><linearGradient id="g" spreadMethod="reflect" x1="0" x2="0.01">${stops(16, true)}</linearGradient></defs>${repeat(n, '<line x1="0" y1="112" x2="400" y2="112" stroke="url(#g)" stroke-width="225" opacity="0.5"/>')}`),
  W4_use_of_full_canvas_opacity: (n) => wrap(`<defs><rect id="r" width="400" height="225" fill="#fff" opacity="0.3"/></defs>${repeat(Math.min(n, 50), '<use href="#r"/>')}${repeat(n, '<rect width="400" height="225" fill="#abc" opacity="0.3"/>')}`),
  W5_nested_opacity_groups: (n) => wrap(repeat(18, '<g opacity="0.9">') + repeat(n, '<rect width="400" height="225" fill="#8ab" opacity="0.4"/>') + repeat(18, '</g>')),
  W6_tiny_rect_scaled_gradient_repeat: (n) => wrap(`<defs><radialGradient id="g" spreadMethod="repeat" r="0.002">${stops(16, true)}</radialGradient></defs>${repeat(n, '<rect width="1" height="1" transform="scale(400 225)" fill="url(#g)" opacity="0.5"/>')}`),
  W7_ellipse_just_under_a_quarter: (n) => wrap(`<defs><radialGradient id="g" spreadMethod="reflect" r="0.001">${stops(16, true)}</radialGradient></defs>${repeat(n, '<ellipse cx="200" cy="112" rx="120" ry="60" fill="url(#g)" opacity="0.5"/>')}`),
  W8_skewed_repeating_path_fill_and_stroke: (n) => wrap(`<defs><radialGradient id="g" spreadMethod="repeat" r="0.003" gradientTransform="skewX(80)">${stops(16, true)}</radialGradient></defs>${repeat(n, `<path d="${square}" fill="url(#g)" stroke="url(#g)" stroke-width="60" opacity="0.5"/>`)}`),
  W9_use_of_group_of_gradient_paths: (n) => wrap(`<defs><linearGradient id="g" spreadMethod="reflect" x2="0.001">${stops(16, true)}</linearGradient><g id="s" opacity="0.5">${repeat(3, `<path d="${square}" fill="url(#g)"/>`)}</g></defs>${repeat(Math.min(n, 50), '<use href="#s"/>')}`),
  W10_clip_and_gradient_path: (n) => wrap(`<defs><clipPath id="c"><rect width="400" height="225"/></clipPath><radialGradient id="g">${stops(16, true)}</radialGradient></defs>${repeat(Math.min(n, 20), `<path d="${square}" fill="url(#g)" clip-path="url(#c)" opacity="0.5"/>`)}${repeat(n, `<path d="${square}" fill="url(#g)" opacity="0.5"/>`)}`),
  // My own adversarial pass: multipliers that stay under every cap.
  X1_evenodd_tiny_subpaths: (n) => wrap(repeat(n, (k) => `<path fill-rule="evenodd" fill="#fa0" opacity="0.5" d="M0 0${repeat(150, (i) => `M${(i * 13 + k) % 390} ${(i * 7) % 215}h6v6h-6z`)}"/>`)),
  X2_thousands_of_round_caps: (n) => wrap(repeat(n, (i) => `<line x1="${(i * 7) % 380}" y1="${(i * 11) % 200}" x2="${(i * 7) % 380 + 12}" y2="${(i * 11) % 200 + 9}" stroke="#fa0" stroke-width="20" stroke-linecap="round" opacity="0.5"/>`)),
  X3_dense_polygon_strokes: (n) => wrap(repeat(n, (k) => `<polygon fill="none" stroke="#fa0" stroke-width="3" stroke-linejoin="round" points="${repeat(100, (i) => `${20 + ((i * 37 + k) % 60)},${20 + ((i * 53) % 60)} `)}"/>`)),
  X4_clip_and_opacity_small_shapes: (n) => wrap(`<defs><clipPath id="c"><rect x="0" y="0" width="30" height="30"/><rect x="40" y="0" width="30" height="30"/></clipPath></defs>${repeat(Math.min(n, 20), '<g opacity="0.5" clip-path="url(#c)"><circle cx="30" cy="30" r="25" fill="#fa0" opacity="0.5"/><circle cx="40" cy="30" r="25" fill="#0af" opacity="0.5"/></g>')}${repeat(n, '<circle cx="50" cy="50" r="20" fill="#fa0" opacity="0.5"/>')}`),
  X5_scaled_group_of_small_shapes: (n) => wrap(`<g transform="scale(30)">${repeat(n, '<rect width="1" height="1" fill="#fa0" opacity="0.5"/>')}</g>`),
  X6_wide_stroke_on_a_short_line: (n) => wrap(repeat(n, '<line x1="10" y1="10" x2="12" y2="12" stroke="#fa0" stroke-width="150"/>')),
  X7_big_arcs_in_a_small_box: (n) => wrap(repeat(Math.min(n, 15), `<path fill="#fa0" opacity="0.5" d="M0 0${repeat(60, (i) => `A${300 + i} ${280 + i} ${i} ${i % 2} ${(i + 1) % 2} ${(i * 5) % 30} ${(i * 7) % 30}`)}"/>`)),
  // The classes the old static fixtures covered, rebuilt from SMALL shapes so that they sit under the shape caps and bind on weight.
  Y1_mask_of_small_circles_many_references: (n) => wrap(`<defs><mask id="m">${repeat(32, (i) => `<circle cx="${30 + i * 4}" cy="50" r="20" fill-opacity=".5"/>`)}</mask></defs>${repeat(Math.min(n, 20), '<rect width="9" height="9" mask="url(#m)"/>')}`),
  Y2_uses_of_a_complex_stroked_path: (n) => wrap(`<defs><path id="h" fill="#fa0" stroke="#000" stroke-width="1" d="M0 0${repeat(160, (i) => `A${1 + (i % 5)} ${2 + (i % 4)} ${i % 90} ${i % 2} ${(i + 1) % 2} ${(i * 3) % 30} ${(i * 5) % 30}`)}"/></defs>${repeat(Math.min(n, 49), '<use href="#h"/>')}`),
  X8_mask_with_gradient_one_shape: (n) => wrap(`<defs>${gradient(16, 'linearGradient', 'spreadMethod="repeat"')}<mask id="m"><rect width="400" height="225" fill="url(#g)"/></mask></defs>${repeat(Math.min(n, 20), '<rect width="400" height="225" fill="#fff" mask="url(#m)"/>')}`),
};

/** The text of the largest picture of `name` that lintSvg accepts, with its repeat count and stats (null if even n = 1 is refused). */
export function largestAccepted(name, high = 2000) {
  const build = ATTACKS[name];
  let [low, best] = [1, null];
  let upper = high;
  while (low <= upper) {
    const middle = (low + upper) >> 1;
    const text = build(middle);
    const stats = {};
    if (lintSvg(text, stats).length === 0) { best = { n: middle, text, stats }; low = middle + 1; } else upper = middle - 1;
  }
  return best;
}

/** Whether a repeat count of `n` is refused. */
export const refused = (name, n) => lintSvg(ATTACKS[name](n)).length > 0;
