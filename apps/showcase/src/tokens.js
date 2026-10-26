/* ═══════════════════════════════════════════════════════════════
   TOKEN HELPERS
   Shared by the showcase pages, which read every design value from
   systems/<id>/tokens.json (docs/specs/TOKENS.md § 4).
   ═══════════════════════════════════════════════════════════════ */

/**
 * Apply mode overrides to a token document (mirror of
 * design_system_skill.token_file.resolve_mode).
 * @param {object} doc token document
 * @param {Record<string, string>} [selection] option id per axis id, e.g. { paper: "kraft", ink: "sunset" };
 *   axes not named use their default option
 * @returns {object} resolved copy; the input is not modified
 */
export function resolveMode(doc, selection = {}) {
  const out = structuredClone(doc);
  for (const axis of doc.modes?.axes ?? []) {
    const overrides = axis.options[selection[axis.id] ?? axis.default] ?? {};
    for (const [path, value] of Object.entries(overrides)) {
      const keys = path.split(".");
      let node = out;
      for (const k of keys.slice(0, -1)) node = node[k] ??= {};
      node[keys.at(-1)] = value;
    }
  }
  return out;
}

/**
 * Option ids of one mode axis, in file order.
 * @param {object} doc token document
 * @param {string} axisId e.g. "paper"
 * @returns {string[]}
 */
export function modeOptions(doc, axisId) {
  const axis = doc.modes?.axes?.find((a) => a.id === axisId);
  return axis ? Object.keys(axis.options) : [];
}

/**
 * CSS style object for a type role (type.<role> or extras.type.<role>).
 * @param {object} doc token document
 * @param {string} role e.g. "label", or "extras.item" for extras.type.item
 * @returns {{fontFamily: string, fontSize: number, fontWeight: number, lineHeight: number,
 *   letterSpacing: string, textTransform: string}}
 */
export function typeStyle(doc, role) {
  const t = role.startsWith("extras.") ? doc.extras.type[role.slice(7)] : doc.type[role];
  const family = doc.font[t.family] ?? doc.extras?.font?.[t.family];
  return {
    fontFamily: family,
    fontSize: t.size,
    fontWeight: t.weight,
    lineHeight: t.line_height,
    letterSpacing: `${t.tracking}em`,
    textTransform: t.case === "sentence" ? "none" : t.case,
  };
}

/**
 * Duration + easing of a motion tier, for CSS `animation` / `transition`
 * shorthands: "200ms cubic-bezier(0.25, 0.1, 0.25, 1)".
 * @param {object} doc token document
 * @param {"fast"|"moderate"|"slow"|"expressive"} tier motion tier
 * @param {"enter"|"exit"} [phase] which duration to use
 * @returns {string}
 */
export function motion(doc, tier, phase = "enter") {
  const t = doc.motion[tier];
  return `${t[`${phase}_ms`]}ms ${t.easing}`;
}

/**
 * CSS implementing the system's reduced-motion policy (motion.reduced_motion,
 * SCHEMA-V0.3.md § Motion) for its own UI under
 * `@media (prefers-reduced-motion: reduce)`.
 *   fade — keyframe entrances keep their tier duration but animate opacity
 *          only (`fadeOnly`); hover/press transforms are dropped; loops stop.
 *   none — every animation and transition inside `scope` is removed.
 * @param {object} doc token document
 * @param {{scope: string, animated?: string[], transforms?: string[], loops?: string[]}} sel
 *   scope: root selector of the system's UI; animated: selectors running an
 *   entrance keyframe; transforms: selectors that move/scale/rotate on
 *   interaction; loops: selectors running an infinite animation
 * @returns {string} CSS text
 */
export function reducedMotionCss(doc, { scope, animated = [], transforms = [], loops = [] }) {
  const within = (list) => list.map((s) => `${scope} ${s}`).join(", ");
  const rules = [];
  if (doc.motion.reduced_motion === "none") {
    rules.push(`${scope}, ${scope} *, ${scope} *::before, ${scope} *::after { animation: none !important; transition: none !important }`);
  } else {
    if (animated.length) rules.push(`${within(animated)} { animation-name: fadeOnly !important }`);
    if (transforms.length) rules.push(`${within(transforms)} { transform: none !important }`);
    if (loops.length) rules.push(`${within(loops)} { animation: none !important }`);
  }
  return `@keyframes fadeOnly { from { opacity: 0 } to { opacity: 1 } }\n` +
    `@media (prefers-reduced-motion: reduce) {\n  ${rules.join("\n  ")}\n}`;
}

/**
 * Format helpers for spec tables that print token values as text.
 * px(8) → "8px"; em(-0.04) → "-0.04em", em(0) → "0"; lh(1) → "1.0", lh(1.55) → "1.55".
 */
export const px = (n) => `${n}px`;
export const em = (n) => (n === 0 ? "0" : `${n}em`);
export const lh = (n) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/**
 * One-line summary of a type role: "40px / 700 / -0.04em".
 * @param {{size: number, weight: number, tracking: number}} t type role
 * @returns {string}
 */
export const typeSummary = (t) => `${px(t.size)} / ${t.weight} / ${em(t.tracking)}`;

/**
 * The same colour at a different opacity, for tints the token file defines
 * as "token X at alpha a" (e.g. a placeholder at 0.5 of the ink).
 * Accepts #RGB, #RRGGBB, #RRGGBBAA and rgb()/rgba(); the result is rgba().
 * @param {string} color CSS colour from the token file
 * @param {number} a opacity 0–1 (multiplied with any alpha already present)
 * @returns {string}
 */
export function alpha(color, a) {
  let r, g, b, a0 = 1;
  const hex = color.trim().match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) h = [...h].map((ch) => ch + ch).join("");
    [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    if (h.length === 8) a0 = parseInt(h.slice(6, 8), 16) / 255;
  } else {
    const fn = color.match(/^rgba?\(([^)]*)\)$/i);
    if (!fn) throw new Error(`alpha(): unsupported colour ${color}`);
    const parts = fn[1].split(",").map((p) => parseFloat(p));
    [r, g, b] = parts;
    if (parts.length > 3) a0 = parts[3];
  }
  return `rgba(${r},${g},${b},${+(a0 * a).toFixed(3)})`;
}

/**
 * Parse a CSS colour from the token file into [r, g, b, a].
 * @param {string} color #RGB, #RRGGBB, #RRGGBBAA, rgb() or rgba()
 * @returns {number[]}
 */
function parseColor(color) {
  const m = alpha(color, 1).match(/^rgba\(([^)]*)\)$/);
  return m[1].split(",").map(Number);
}

/**
 * WCAG 2.x contrast ratio of a foreground over a background. A translucent
 * foreground is composited over the background first; the background must
 * be opaque (composite it yourself if it is not).
 * @param {string} fg CSS colour
 * @param {string} bg CSS colour (opaque)
 * @returns {number} ratio ≥ 1
 */
export function contrastRatio(fg, bg) {
  const [br, bgG, bb] = parseColor(bg);
  const [fr, fgG, fb, fa] = parseColor(fg);
  const mix = (f, b) => f * fa + b * (1 - fa);
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const l1 = lum([mix(fr, br), mix(fgG, bgG), mix(fb, bb)]);
  const l2 = lum([br, bgG, bb]);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Contrast ratio formatted the way the spec pages print it ("4.5:1").
 * @param {string} fg CSS colour
 * @param {string} bg CSS colour (opaque)
 * @returns {string}
 */
export function contrastText(fg, bg) {
  const r = contrastRatio(fg, bg).toFixed(1);
  return `${r.endsWith(".0") && +r >= 10 ? r.slice(0, -2) : r}:1`;
}

/**
 * WCAG 2.x level a ratio reaches for normal-size text.
 * @param {number} ratio contrast ratio
 * @param {{aaa?: string, aa?: string, large?: string, fail?: string}} [labels] the page's label vocabulary
 * @returns {string}
 */
export function wcagLevel(ratio, labels = {}) {
  const { aaa = "AAA", aa = "AA", large = "AA (lg)", fail = "Fail" } = labels;
  if (ratio >= 7) return aaa;
  if (ratio >= 4.5) return aa;
  if (ratio >= 3) return large;
  return fail;
}
