# Token Files — format, ownership, and how to consume them

Each design system has exactly one canonical token file:

```
systems/<id>/tokens.json
```

It is the **single source of truth for token values** (GitHub issue #4). It is
keyed by the fixed semantic contract defined in schema v0.3
(`docs/specs/SCHEMA-V0.3.md`, issue #6). Everything else — spec.yaml, the SVG
builders, the showcase JSX — either reads it or is checked against it.

| System id | Token file | Notes |
|-----------|------------|-------|
| `wireframe` | `systems/wireframe/tokens.json` | also serves the `neutral` registry alias (same spec, same file) |
| `swiss` | `systems/swiss/tokens.json` | |
| `terminal` | `systems/terminal/tokens.json` | |
| `editorial` | `systems/editorial/tokens.json` | |
| `sketch` | `systems/sketch/tokens.json` | |
| `prism` | `systems/prism/tokens.json` | page is a gradient — see `extras.page_gradient` |
| `revolt` | `systems/revolt/tokens.json` | |
| `riso` | `systems/riso/tokens.json` | parametric — `modes` axes `paper` × `ink` |

**Why JSON, not YAML:** Vite imports `.json` natively (no plugin), so the
showcase JSX can `import` the file directly; Python reads it with the standard
library. JSON has no comments, so explanations live in the `notes` object.

---

## 1. Format

```jsonc
{
  "contract_version": "1.0",               // must match contract.CONTRACT_VERSION
  "system": "swiss",                        // must equal spec.yaml system.id
  "source": "apps/showcase/src/systems/design-system-swiss.jsx",
  "description": "…",

  // ── contract groups: every token required, no other keys allowed ──
  "color":        { "page_bg": "#FFFFFF", "surface": "#FFFFFF", … },
  "radius":       { "default": 0, "input": 0, "chrome": 0 },
  "border_width": { "default": 1, "strong": 1, "focus": 2 },
  "space":        { "unit": 8, "steps": [8, 16, 24, 32, 40, 48, 64],
                    "xs": 8, "sm": 16, "md": 24, "lg": 32, "xl": 48 },
  "font":         { "body": "'Inter', system-ui, sans-serif", "label": "…", "mono": "…" },
  "type":         { "display": { "size": 40, "weight": 700, "line_height": 1.0,
                                 "tracking": -0.04, "family": "body", "case": "none" },
                    "title": {…}, "body": {…}, "small": {…}, "label": {…} },
  "elevation":    { "strategy": "typographic", "raised": "none",
                    "overlay": "none", "backdrop_blur": "none" },
  "motion":       { "fast":       { "enter_ms": 120, "exit_ms": 0,
                                    "easing": "cubic-bezier(0.25, 0.1, 0.25, 1)" },
                    "moderate": {…}, "slow": {…},
                    "expressive": { …, "spring": { "duration_ms": 500, "bounce": 0.2 } },
                    "reduced_motion": "none" },          // fade | none

  // ── system-specific ──
  "extras": { "color": { "rule_hairline": "#F0F0F0", … }, "type": {…}, "font": {…}, … },

  // ── optional ──
  "modes": { "axes": [ … ] },              // per-mode overrides (SCHEMA-V0.3.md § Modes)
  "contrast_pairs": [ { "fg": "color.action", "bg": "color.surface", "kind": "text", "note": "…" },
                      { "fg": "color.accent", "bg": "color.surface", "kind": "text", "note": "how inputs are identified",
                        "replaces": "color.border_input on color.surface" } ],
  "contrast_backdrops": [ "extras.color.gradient_stop_1" ],   // opaque stand-ins for page_bg (§ 7)
  "contrast_waivers": [ { "pair": "color.accent on color.surface", "modes": [ { "ink": "sunset" } ], "reason": "…" } ],
  "hue_waivers": [ { "pair": "color.accent vs color.danger", "reason": "…" } ],
  "notes": { "color.danger": { "derived": true, "note": "why this value",
                               "contrast_fix": [ { "old": "…", "new": "…", "pairs": { … } } ] } }
}
```

Units: `radius`, `border_width`, `space`, `type.*.size` are CSS pixels as
numbers; `type.*.tracking` is em; `type.*.line_height` is unitless;
`motion.*.enter_ms` / `exit_ms` / `spring.duration_ms` are milliseconds and
`motion.*.easing` is a `cubic-bezier()` string. Colours are
CSS strings (`#RRGGBB`, `#RRGGBBAA`, `rgba()`); translucent values are meant to
composite over the surface they sit on.

`notes` entries with `"derived": true` mark values that **do not appear in the
JSX** and were derived from the system's grammar (for example status colours
in systems that have none). `"derived": false` notes explain a JSX value
(where it is used, or a discrepancy inside the JSX). Treat derived values as
proposals a designer may revise.

Token paths are dotted: `color.page_bg`, `type.label`, `extras.color.ink_1`,
`motion.slow.enter_ms`.

### Motion

The `motion` group (issue #10; rules in SCHEMA-V0.3.md § Motion) holds four
tiers, ordered by the size of what moves, and the system's reduced-motion
policy. Values come from the JSX's `transition` / `animation` declarations;
every tier carries a `notes` entry naming its JSX source, and tiers the JSX
does not use are `"derived": true`. No JSX file has exit animations, so
`exit_ms` is derived everywhere (0 where the grammar cuts).

| System | fast | moderate | slow | expressive | reduced |
|--------|------|----------|------|------------|---------|
| `swiss` | 120/0 ease | 200/0 ease | 200/0 ease | 200/0 ease (derived) | none |
| `terminal` | 0/0 linear (derived) | 200/0 linear | 250/0 linear | 250/0 linear (derived) | none |
| `editorial` | 150/110 ease | 350/250 ease-out | 450/320 ease-out | 600/420 ease-out (derived) | fade |
| `sketch` | 100/70 ease | 200/140 linear | 250/170 linear | 400/280 ease, spring .2 (derived) | fade |
| `prism` | 100/70 ease | 300/210 ease | 350/250 ease | 500/350 ease-out, spring .2 (derived) | fade |
| `revolt` | 120/80 linear | 200/140 linear | 250/170 linear | 300/210 linear (derived) | none |
| `riso` | 120/0 ease | 300/0 ease-out | 400/0 ease-out | 400/0 ease-out (derived) | none |
| `wireframe` | 120/90 ease | 200/140 ease | 200/140 ease | 300/210 ease-out (derived) | fade |

Which component animates at which tier is declared in spec.yaml
(`components.<id>.motion`, `motion.elements.<id>`), not here.

JSX consumption (for the migration agent): read durations and easings from the
token file, and gate them on the media query; none of the JSX files does this
today. The declaration's `reduced` value decides what happens under the query
(`fade` → opacity-only keyframes, `none` → no animation, `keep` → unchanged).

```jsx
const m = tokens.motion;
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// @keyframes fadeSlideUp animates opacity + translateY; fadeOnly animates opacity.
const enter = (tier, reduced) => {
  const t = `${m[tier].enter_ms}ms ${m[tier].easing} both`;
  if (!reduce || reduced === "keep") return `fadeSlideUp ${t}`;
  return reduced === "fade" ? `fadeOnly ${t}` : "none";
};
// list_item: { trigger: enter, tier: moderate, reduced: fade }
<div style={{ animation: enter("moderate", "fade") }} />
```

---

## 2. Changing values

1. Edit `systems/<id>/tokens.json` only.
2. `python3 tools/design-system-skill drift --id <id>` (or `--all`).
3. `python3 tools/design-system-skill contrast --id <id>` (or `--all`): every
   pair in every mode must pass; fix a failure with
   `contrast.suggest_lightness_fix` and record it in `notes` (§ 7).
4. `python3 tools/design-system-skill validate --spec systems/<id>/spec.yaml`.
5. Regenerate the SVG libraries: `uv run python tools/builders/build.py --system <id>`
   (§ 5; CI runs `--check` and fails on stale SVGs) and, for Riso,
   `python3 tools/builders/build_riso_reference.py`.

Never re-introduce a token value into spec.yaml; reference it instead
(§ 3). To add a token every system needs, change `contract.py`, paste the
re-rendered table into SCHEMA-V0.3.md, and supply a value in all eight files in
the same change. A token only one system needs goes in `extras`.

---

## 3. spec.yaml (v0.3)

spec.yaml keeps grammar, components, rules and prose; it holds **no** token
values of its own:

```yaml
system:
  tokens_file: tokens.json
tokens:
  colors:
    palette:
      - { name: rule_warm, token: color.border_default, role: 1px borders }
  typography:
    families:
      - id: structural
        stack: "{font.body}"
  elevation:
    config:
      border_light: { width: "{border_width.default}", color: "{color.border_default}" }
```

`load_system()` resolves this (see `token_file.apply_tokens_to_spec`):
aliases are substituted, palette entries gain `value`, contract values are
projected to the v0.2 locations (`tokens.colors.page_bg`,
`tokens.borders.radius_default`, `tokens.spacing.grid_unit`, …), and the whole
document is attached at `tokens.contract`.

Tools that read spec.yaml **directly** must use
`design_system_skill.read_spec_with_tokens(path)` instead of `yaml.safe_load`.

### Drift check

`design_system_skill/drift.py` (CLI: `python3 tools/design-system-skill drift
[--all | --id X | --spec PATH]`, exit 1 on drift; also run inside
`validate_spec` for any spec that declares a token file) reports:

| kind | meaning |
|------|---------|
| `value_mismatch` | a literal at a projected location (e.g. `tokens.colors.text_muted`) differs from its token |
| `unresolved_alias` | `{group.token}` or palette `token:` names a token the file does not define |
| `palette_mismatch` | a palette entry has both `token` and `value`, and they differ |
| `unknown_literal` | a colour literal inside `tokens` / `press_presets`, or a family `stack`, is not produced by the token file in any mode |

Prose fields (`role`, `usage_constraint`, `note`, `description`,
`rendering_notes`, …) are not scanned.

---

## 4. Showcase JSX (React, Vite) — how to migrate

The JSX is declared canonical *in content*, but after migration it must read
its values from the token file instead of inline hex. Follow these steps per
system; they are written for the agent doing the JSX migration.

### 4.1 One-time Vite setup

`systems/` lives outside the Vite root (`apps/showcase`). Vite's dev server
refuses files outside `server.fs.allow`, so add an alias and allow the
directory in `apps/showcase/vite.config.js`:

```js
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const systemsDir = fileURLToPath(new URL("../../systems", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@systems": systemsDir } },
  server: { fs: { allow: [".", systemsDir] } },
});
```

### 4.2 Import and read

```jsx
import tokens from "@systems/swiss/tokens.json";

const { color: c, radius: r, space: s, font: f, type: t } = tokens;

<div style={{ background: c.page_bg, color: c.text_primary, fontFamily: f.body,
              borderRadius: r.chrome, border: `${tokens.border_width.default}px solid ${c.border_default}` }}>
```

- `neutral` imports `@systems/wireframe/tokens.json`.
- Type roles: `fontSize: t.label.size, fontWeight: t.label.weight,
  lineHeight: t.label.line_height, letterSpacing: \`${t.label.tracking}em\`,
  textTransform: t.label.case === "none" ? "none" : t.label.case,
  fontFamily: tokens.font[t.label.family]`. A small `typeStyle(tokens, role)`
  helper avoids repeating this.
- Extras: `tokens.extras.color.rule_hairline`, `tokens.extras.shadow.md`, …
- Prism's page: `background: tokens.extras.page_gradient`.

### 4.3 What to replace — and what not to

Replace every literal in the **live preview** (`<System>Chat`), the
**preview notes** that quote values, and the **spec documentation sections**
(`Sw` swatches, `Tk` rows, contrast tables, component `specs`) so the docs
regenerate from the file. A swatch becomes
`<Sw c={c.text_secondary} n="Secondary" v={c.text_secondary} />`.

Do **not** tokenise the showcase's own dark documentation chrome (`#0A0A0A`
page, `#CCC`/`#999`/`#555` doc text, the `Do`/`Dont` greens and reds); those
belong to the showcase, not the system. One exception: `TM.color` is the
system's accent and should become `tokens.color.accent`.

If the JSX uses a value that is not in the token file, **stop and add it**
(contract token if it is a contract role, otherwise `extras`) rather than
leaving a literal. If the JSX contradicts the token file, the token file now
wins; raise it in review.

### 4.4 Modes (Riso)

Riso's `paperPresets` / `inkPresets` objects are replaced by
`tokens.modes.axes`. Resolve the active selection and map it onto the existing
CSS custom properties:

```js
/**
 * Apply mode overrides to a token document (mirror of
 * design_system_skill.token_file.resolve_mode).
 * @param {object} doc token document
 * @param {Record<string,string>} selection e.g. { paper: "kraft", ink: "sunset" }
 * @returns {object} resolved copy
 */
export function resolveMode(doc, selection = {}) {
  const out = structuredClone(doc);
  for (const axis of doc.modes?.axes ?? []) {
    const overrides = axis.options[selection[axis.id] ?? axis.default];
    for (const [path, value] of Object.entries(overrides)) {
      const keys = path.split(".");
      let node = out;
      for (const k of keys.slice(0, -1)) node = node[k] ??= {};
      node[keys.at(-1)] = value;
    }
  }
  return out;
}

const t = resolveMode(risoTokens, { paper: tweaks.paperKey, ink: tweaks.inkKey });
const vars = {
  "--riso-paper": t.color.page_bg,
  "--riso-text": t.color.text_primary,
  "--riso-ink-1": t.extras.color.ink_1,          // drum: duotone, ghost, halftone, rules
  "--riso-ink-2": t.extras.color.ink_2,          // drum: duotone ghost, ticks, strips
  "--riso-ink-1-text": t.extras.color.ink_1_text, // ink-1 InkTag text (3:1 on every paper)
  "--riso-action": t.color.action,               // ink-2 InkTag text, unread chip (4.5:1)
  "--riso-focus": t.color.focus_ring,            // focus outline (3:1)
  "--riso-blend": t.extras.press.blend,
  "--riso-ink-density": String(t.extras.press.density),
  // slider-driven vars (offsets, halftone, grain, bleed, tremor) stay in system_state
};
```

Selector labels come from the spec's `press_presets` (labels/characters are
prose, not tokens).

The drum colours (`extras.color.ink_1` / `ink_2`) are print colours: on most
paper stocks they cannot carry text (pink on cream is 2.69:1, yellow on kraft
1.09:1). Since issue #7 the contract roles are the legible shades of the active
drum, resolved per ink option: `color.accent` / `color.action` (ink-2 hue,
4.5:1 against every paper, so paper-colour knock-out numerals stay legible),
`color.focus_ring` (3:1) and `extras.color.ink_1_text` (ink-1 hue, 3:1). Use
them for InkTag text, the unread chip and the focus outline; keep the drums
for duotone, ghost, halftone and tick strips. Put `resolveMode` and `typeStyle` in a shared module such
as `apps/showcase/src/tokens.js`.

### 4.5 Verifying

A later check should fail when a hex/rgba literal inside a system's live
preview is not a value of its token file (in any mode). Until it exists, grep
the component after migration: `grep -nE "#[0-9A-Fa-f]{3,8}|rgba\(" <file>`
should only hit documentation chrome.

---

## 5. SVG builders (`tools/builders/build.py`)

One engine renders every system's component library and layout patterns
(issue #5). It discovers systems from `systems/registry.yaml` (the
`neutral` alias builds `wireframe` once; every system, Riso included, has
a builder), loads
each spec's token file with `read_spec_with_tokens`, validates the
system's builder data and renders it:

```bash
uv run python tools/builders/build.py                   # every system
uv run python tools/builders/build.py --system swiss    # one (repeatable)
uv run python tools/builders/build.py --kind patterns   # layouts only
uv run python tools/builders/build.py --check           # exit 1 if a committed SVG is stale or orphaned
uv run python tools/builders/build.py --png             # also refresh existing PNG previews
```

Per-system content lives in `tools/builders/engine/systems/<id>/`:
`library.py` / `patterns.py` hold the SVG body templates
(`{id: (width, height, body)}`) and `__init__.py` declares `BUILDER` — the
text classes of the shared `<defs><style>` block plus any envelope
override (Prism paints a gradient behind its glass). Templates never hold
colour or font literals; they use placeholders resolved from the token
file:

```xml
<rect width="140" height="48" rx="{radius.input}" fill="{color.surface}"
      stroke="{color.border_input}" stroke-width="{border_width.default}"/>
<line x1="0" y1="0.5" x2="320" y2="0.5" stroke="{extras.color.rule_hairline}"/>
<stop offset="0" stop-color="{extras.color.orb_lavender|alpha=0.25}"/>
```

`|alpha=A` keeps a token's hue at a template-specific alpha (Prism's
ambient orbs and glass tiers that have no token of their own). A test keeps
colour and font literals out of the templates, and the engine reports any
unknown token or malformed entry with the system, kind, item and key.

- Text classes follow the wireframe-skill mapping
  (`wireframe_skill/tokens.py::_CLASS_TOKENS`): `.text-primary →
  color.text_primary`, `.text-secondary → color.text_secondary`,
  `.text-disabled → color.text_muted`, `.text-inverse → color.text_inverse`,
  `.text-danger/-success/-warning/-info → color.danger/…`, `.text-accent →
  color.accent`. One mapping means SVGs, wireframe-skill output and
  `wf_get_tokens` agree.
- Strokes: `color.border_default` at `border_width.default`,
  `color.border_strong` at `border_width.strong`, inputs `color.border_input`,
  focus `color.focus_ring` at `border_width.focus`.
- Radii: every `rx`/`ry` is a token, `0`, or `{full:N}` (half of the
  element's shorter side `N`: pills, toggle tracks, round knobs). Roles:
  `radius.default` (containers, list items, cards), `radius.input` (fields,
  buttons), `radius.chrome` (shell, modals, dialog panels); anything else is
  an `extras.radius.<role>` (`avatar`, `avatar_small`, `badge`, `checkbox`,
  `knob`, `icon`, `control`, `message`, `message_tail`) with a `notes` entry
  citing the JSX or marked `derived: true`. Corners with different radii
  (chat-bubble tails) use path data from
  `{extras.radius.message|rrect=x,y,w,h,br:extras.radius.message_tail}`.
  `test_build.py` fails on radius literals like it does on colour literals.
- Orphans: `--check` also fails when a system's `components/` or `layouts/`
  holds an SVG no template produces (hand-authored files that token changes
  never reach), unless `tools/builders/orphan-allowlist.yaml` lists it with
  a reason; allow-list entries that are missing or now produced fail too.
- SVG cannot composite CSS `rgba()` the way the browser does over a gradient;
  for Prism the glass tiers stay white-with-alpha fills painted over a slice
  of `extras.color.gradient_stop_*`, and for Riso flatten per the spec's
  `format_fitness.svg` caveats.
- After changing a token value, run `build.py` and commit the regenerated
  SVGs with the token change; `build.py --check` in CI fails until you do.
  Previews (`*.png` next to an SVG) are refreshed with `--png`.
- New system: add `engine/systems/<id>/` with a `BUILDER` and register the
  system; `build.py --system <id>` writes `systems/<id>/components/` and
  `layouts/`.

---

## 6. Python API summary (`tools/design-system-skill/design_system_skill`)

| Function | Module | Purpose |
|----------|--------|---------|
| `load_system(id)` | loader | spec with tokens applied; `tokens.contract` = document |
| `load_tokens_for_system(id)` | token_file | token document by registry id (builders) |
| `read_spec_with_tokens(path)` | token_file | spec file with tokens applied, no registry |
| `load_token_file(path)` / `validate_token_document(doc)` | token_file | parse / contract-check a file |
| `get_token(doc, "color.page_bg")` | token_file | read a dotted path |
| `resolve_mode(doc, sel)` / `iter_mode_selections(doc)` | token_file | per-mode values; every combination |
| `CONTRACT_TOKENS`, `CONTRAST_PAIRS`, `parse_color`, `normalize_color` | contract | contract data and colour helpers (contrast gate) |
| `MOTION_TIERS`, `parse_cubic_bezier`, `is_timing_function` | contract | motion tiers and easing helpers |
| `validate_motion_declarations(spec, doc)` / `iter_motion_declarations(spec)` | token_file | spec.yaml motion declarations |
| `check_drift(spec_path)` / `check_drift_all()` / `find_drift(spec, doc)` | drift | spec ↔ token-file agreement |
| `check_contrast(doc)` / `check_hue_gate(doc)` / `check_color_gates(doc)` | contrast | colour gates over every mode (reports + errors) |
| `check_color_gates_for_spec(path)` / `check_color_gates_all()` | contrast | colour gates for a spec / every registered system (CLI `contrast`, MCP `ds_check_contrast`) |
| `contrast_ratio`, `composite`, `rgb_to_oklch`, `oklch_to_rgb`, `suggest_lightness_fix` | contrast | WCAG ratio, alpha compositing, OKLCH with gamut clamp, minimum-lightness fixes |

---

## 7. Colour gates and the values they changed (issues #7, #8)

`validate_spec` runs the WCAG contrast gate and the accent/danger hue gate
over every token file in every mode (rules in SCHEMA-V0.3.md § Colour gates;
CLI `python3 tools/design-system-skill contrast --all`). The token-file keys
involved:

| Key | Purpose |
|-----|---------|
| `contrast_pairs[]` | `{fg, bg, kind, note}`: `kind` is `text`, `large_text`, `ui`, `advisory` (decorative text such as Riso's ghost ink; placeholders) or `disabled` (inactive components: one side must be a `*disabled*` token). `advisory` / `disabled` never fail and need a `note`. Every colour a builder template paints text in must appear here or in the contract pairs (`tools/builders/engine/text_coverage.py`). |
| `contrast_pairs[].replaces` | Re-express `color.border_input on color.surface` when inputs are identified another way (Terminal: the `$` prompt glyph). Needs a `note`. |
| `contrast_backdrops` | Opaque colours that stand in for `page_bg` beneath translucent layers (Prism's gradient stops). Every pair is checked over each. |
| `contrast_waivers` | `{pair, modes?, reason}` for decorative `ui` pairs only; stale entries fail. None are in use. |
| `hue_waivers` | `{pair, modes?, reason}` for the hue gate; stale entries fail. |
| `notes[path].contrast_fix` / `hue_fix` | Record of every value a gate changed: old, new, OKLCH before/after, ratio (or hue gap) before/after per pair. |

When the gate was introduced these values failed and were corrected with the
minimum OKLCH lightness change that passes, keeping hue and chroma (Prism's
white glass text, already at L = 1, gained opacity instead). Ratios are the
worst over every mode and backdrop that uses the value. The table is the
`contrast_fix` records of the token files:

| System | Token | Mode | Old → new | Pair: ratio before → after (minimum) |
|--------|-------|------|-----------|--------------------------------------|
| editorial | `color.border_input` | — | `#D8CEB9` → `#968C79` | border_input on surface 1.42 → 3.03 (min 3) |
| prism | `color.text_primary` | — | `rgba(255,255,255,0.95)` → `rgba(255,255,255,0.98)` | text_primary on surface_elevated 4.38 → 4.54 (min 4.5); text_primary on surface_selected 4.38 → 4.54 (min 4.5) |
| prism | `color.text_secondary` | — | `rgba(255,255,255,0.8)` → `rgba(255,255,255,0.87)` | text_secondary on surface 4.1 → 4.51 (min 4.5) |
| prism | `color.surface_inverse` | — | `rgba(255,255,255,0.18)` → `rgba(222,222,222,0.18)` | text_inverse on surface_inverse 4.01 → 4.51 (min 4.5) |
| prism | `color.text_inverse` | — | `rgba(255,255,255,0.95)` → `rgba(255,255,255,0.98)` | text_inverse on surface_inverse 4.01 → 4.51 (min 4.5) |
| prism | `color.text_muted` | — | `rgba(255,255,255,0.4)` → `rgba(255,255,255,0.59)` | text_muted on surface 2.2 → 3.01 (min 3) |
| prism | `color.action_foreground` | — | `rgba(255,255,255,0.7)` → `rgba(255,255,255,0.87)` | action_foreground on action 3.55 → 4.51 (min 4.5) |
| prism | `color.border_input` | — | `rgba(255,255,255,0.12)` → `rgba(255,255,255,0.59)` | border_input on surface 1.29 → 3.01 (min 3) |
| prism | `color.accent` | — | `#7DDFBE` → `#9CFFDD` | accent on surface 3.35 → 4.52 (min 4.5) |
| revolt | `color.accent_foreground` | — | `#FFFFFF` → `#111111` | accent_foreground on accent 3.55 → 5.32 (min 4.5) |
| revolt | `color.text_muted` | — | `#999999` → `#949494` | text_muted on surface 2.85 → 3.03 (min 3) |
| riso | `color.accent` | ink=classic | `#FF48B0` → `#960061` | accent_foreground on accent 1.64 → 4.52 (min 4.5); accent on surface 1.64 → 4.52 (min 3) |
| riso | `color.accent` | ink=electric | `#00A95C` → `#00592E` | accent_foreground on accent 1.63 → 4.52 (min 4.5); accent on surface 1.63 → 4.52 (min 3) |
| riso | `color.accent` | ink=sunset | `#E8C700` → `#5A4C00` | accent_foreground on accent 1.09 → 4.52 (min 4.5); accent on surface 1.09 → 4.52 (min 3) |
| riso | `color.accent` | ink=forest | `#00A95C` → `#00592E` | accent_foreground on accent 1.63 → 4.52 (min 4.5); accent on surface 1.63 → 4.52 (min 3) |
| riso | `color.accent` | ink=spritz | `#E8C700` → `#5A4C00` | accent_foreground on accent 1.09 → 4.52 (min 4.5); accent on surface 1.09 → 4.52 (min 3) |
| riso | `color.accent` | ink=ink | `#FF48B0` → `#960061` | accent_foreground on accent 1.64 → 4.52 (min 4.5); accent on surface 1.64 → 4.52 (min 3) |
| riso | `color.action` | ink=classic | `#FF48B0` → `#960061` | action_foreground on action 1.64 → 4.52 (min 4.5); action on page_bg 1.64 → 4.52 (min 3) |
| riso | `color.action` | ink=electric | `#00A95C` → `#00592E` | action_foreground on action 1.63 → 4.52 (min 4.5); action on page_bg 1.63 → 4.52 (min 3) |
| riso | `color.action` | ink=sunset | `#E8C700` → `#5A4C00` | action_foreground on action 1.09 → 4.52 (min 4.5); action on page_bg 1.09 → 4.52 (min 3) |
| riso | `color.action` | ink=forest | `#00A95C` → `#00592E` | action_foreground on action 1.63 → 4.52 (min 4.5); action on page_bg 1.63 → 4.52 (min 3) |
| riso | `color.action` | ink=spritz | `#E8C700` → `#5A4C00` | action_foreground on action 1.09 → 4.52 (min 4.5); action on page_bg 1.09 → 4.52 (min 3) |
| riso | `color.action` | ink=ink | `#FF48B0` → `#960061` | action_foreground on action 1.64 → 4.52 (min 4.5); action on page_bg 1.64 → 4.52 (min 3) |
| riso | `color.focus_ring` | ink=classic | `#FF48B0` → `#C60081` | focus_ring on surface 1.64 → 3.0 (min 3); focus_ring on page_bg 1.64 → 3.0 (min 3) |
| riso | `color.focus_ring` | ink=electric | `#00A95C` → `#00773F` | focus_ring on surface 1.63 → 3.01 (min 3); focus_ring on page_bg 1.63 → 3.01 (min 3) |
| riso | `color.focus_ring` | ink=sunset | `#E8C700` → `#786600` | focus_ring on surface 1.09 → 3.02 (min 3); focus_ring on page_bg 1.09 → 3.02 (min 3) |
| riso | `color.focus_ring` | ink=forest | `#00A95C` → `#00773F` | focus_ring on surface 1.63 → 3.01 (min 3); focus_ring on page_bg 1.63 → 3.01 (min 3) |
| riso | `color.focus_ring` | ink=spritz | `#E8C700` → `#786600` | focus_ring on surface 1.09 → 3.02 (min 3); focus_ring on page_bg 1.09 → 3.02 (min 3) |
| riso | `color.focus_ring` | ink=ink | `#FF48B0` → `#C60081` | focus_ring on surface 1.64 → 3.0 (min 3); focus_ring on page_bg 1.64 → 3.0 (min 3) |
| riso | `extras.color.ink_1_text` | ink=classic | `#3255A4` → `#3255A4` | ink_1_text on page_bg 3.76 → 3.76 (min 3) |
| riso | `extras.color.ink_1_text` | ink=electric | `#FF48B0` → `#C60081` | ink_1_text on page_bg 1.64 → 3.0 (min 3) |
| riso | `extras.color.ink_1_text` | ink=sunset | `#FF665E` → `#C32C2C` | ink_1_text on page_bg 1.53 → 3.0 (min 3) |
| riso | `extras.color.ink_1_text` | ink=forest | `#00838F` → `#00727D` | ink_1_text on page_bg 2.4 → 3.01 (min 3) |
| riso | `extras.color.ink_1_text` | ink=spritz | `#3255A4` → `#3255A4` | ink_1_text on page_bg 3.76 → 3.76 (min 3) |
| riso | `extras.color.ink_1_text` | ink=ink | `#1A1A1A` → `#1A1A1A` | ink_1_text on page_bg 9.25 → 9.25 (min 3) |
| sketch | `color.action` | — | `#B8A9C8` → `#7F718E` | action on surface_elevated 2.2 → 4.51 (min 3); action_foreground on action 2.2 → 4.51 (min 4.5) |
| sketch | `color.accent` | — | `#B8A9C8` → `#7F718E` | accent on surface 1.88 → 3.86 (min 3); accent_foreground on accent 2.2 → 4.51 (min 4.5) |
| sketch | `color.border_input` | — | `#E5E3DE` → `#8A8984` | border_input on surface 1.1 → 3.0 (min 3) |
| swiss | `color.accent_foreground` | — | `#000000` → `#FFFFFF` | accent_foreground on accent 4.27 → 4.92 (min 4.5) |
| swiss | `color.action_foreground` | — | `#000000` → `#FFFFFF` | action_foreground on action 4.27 → 4.92 (min 4.5) |
| wireframe | `color.border_input` | — | `#E0E0E0` → `#949494` | border_input on surface 1.32 → 3.03 (min 3) |
| wireframe | `color.text_muted` | — | `#BDBDBD` → `#949494` | text_muted on surface 1.88 → 3.03 (min 3) |
| wireframe | `color.warning` | — | `#E65100` → `#D14900` | warning_foreground on warning 3.79 → 4.5 (min 4.5) |

Judgement calls (each explained in the token's note):

- **Sketch accent/action** moved further than the 3:1 UI minimum (`#9283A1`)
  so the white label keeps 4.5:1, instead of turning the label near-black
  (a 0.75 lightness move).
- **Swiss accent/action foreground**: the signature red stays; black became
  white (the minimum passing value is `#F5F5F5`, snapped to Swiss white).
- **Revolt accent foreground**: minimum `#212121`, snapped to the system black
  `#111111` because the five-colour palette is inviolable.
- **Wireframe warning**: the fill moved rather than the white text, so every
  wireframe status keeps white text.
- **Riso**: the drums are untouched; the contract roles became per-ink legible
  shades (§ 4.4). The token pair for ink-1 text now checks
  `extras.color.ink_1_text` (new) instead of the drum.
- **Input borders** (editorial, prism, sketch, wireframe) were fixed because
  the stroke is what identifies those inputs; `border_default` keeps the light
  hairline. Terminal re-expresses the pair instead (prompt glyph).

### Text coverage (follow-up to #7)

The gate only checks declared pairs, so a colour used as text in no pair
passed unchecked (Sketch's `extras.color.accent_light` annotations were
1.8:1). `tools/builders/engine/text_coverage.py` now derives every
`(text colour, background)` the builder templates render and
`test_build.py::test_every_template_text_colour_is_a_checked_contrast_pair`
fails when one is not a declared pair at least as strict as the text:

- **Usage**: each `<text>`/`<tspan>` with content; colour from its `fill`,
  its `class` (the system's `TextClass`), or the nearest ancestor's. A
  stroked text also counts as a `ui` usage of the stroke. A text with no
  token fill (SVG default black) fails.
- **Class**: WCAG large text (>= 24px, or >= 18.66px at weight >= 700) is
  `large_text`, anything smaller `text`. A foreground the contract pairs
  with a weaker kind keeps that kind on every background (`text_muted` is
  `large_text`, `text_placeholder` `advisory`).
- **Background**: the topmost shape painted before the text whose box
  contains the centre of the text's estimated box (0.55 em per character,
  shifted by `text-anchor`); `|rrect=` paths use their geometry. Nothing
  found, or a non-token fill (a gradient), means `color.page_bg` (Prism's
  gradient stops are `contrast_backdrops`). Small `rotate` tilts are
  ignored.
- **Template alpha**: a text fill written with `|alpha=` or under
  `opacity` < 1 is not the token's value; it is accepted only when its pair
  is `advisory`/`disabled`.

Template role fixes made with it: Sketch timestamps used
`color.text_placeholder` (now `color.text_muted`) and input placeholders
used `extras.color.icon_muted` (now `color.text_placeholder`); Revolt text
on pink fills used `color.text_inverse` (now `color.accent_foreground`, the
value the earlier fix chose) and the required `*` uses `color.danger`;
Prism's dashboard alpha variants of `text_primary` map to
`text_primary`/`text_secondary`/`text_muted`/`text_placeholder` and the
modal's teal `Delete` became a danger button; Riso's primary type uses
`extras.color.ink_1_text` at full density (the 60%/70% screens are gone)
while the ghost ink stays the raw drum, declared `advisory`; avatar
initials with no fill got `color.text_primary` / `color.accent_foreground`.
Disabled pairs: `color.text_muted` on `extras.color.disabled_fill`
(wireframe, revolt) and on `extras.color.surface_disabled` (wireframe).

Values these new pairs changed (minimum OKLCH lightness change that passes,
hue and chroma kept; Prism's white glass text gained opacity):

| System | Token | Mode | Old → new | Pair: ratio before → after (minimum) |
|--------|-------|------|-----------|--------------------------------------|
| prism | `color.danger` | — | `#F59A9A` → `#FFCBC9` | danger on page_bg 3.08 → 4.52 (min 4.5) |
| prism | `extras.color.accent_tint` | — | `rgba(125,223,190,0.25)` → `rgba(70,170,140,0.25)` | accent on accent_tint 3.72 → 4.51 (min 4.5) |
| prism | `color.text_secondary` | — | `rgba(255,255,255,0.87)` → `rgba(255,255,255,0.98)` | text_secondary on surface_elevated 3.97 → 4.54 (min 4.5); text_secondary on surface_selected 3.97 → 4.54 (min 4.5) |
| prism | `color.text_muted` | — | `rgba(255,255,255,0.59)` → `rgba(255,255,255,0.66)` | text_muted on surface_elevated 2.72 → 3.01 (min 3); text_muted on surface_selected 2.72 → 3.01 (min 3) |
| revolt | `color.danger` | — | `#FF3366` → `#E80B55` | danger_foreground on danger 5.32 → 4.56 (min 4.5); danger on page_bg 3.51 → 4.5 (min 4.5); danger on surface 3.55 → 4.56 (min 4.5) |
| revolt | `color.danger_foreground` | — | `#111111` → `#FFFFFF` | danger_foreground on danger 5.32 → 4.56 (min 4.5) |
| revolt | `color.text_muted` | — | `#949494` → `#939393` | text_muted on page_bg 3.0 → 3.04 (min 3) |
| riso | `extras.color.ink_1_text` | ink=classic | `#3255A4` → `#234492` | ink_1_text on page_bg 3.76 → 4.82 (min 4.5); ink_1_text on surface_selected 3.53 → 4.54 (min 4.5) |
| riso | `extras.color.ink_1_text` | ink=electric | `#C60081` → `#8F005C` | ink_1_text on page_bg 3.0 → 4.81 (min 4.5); ink_1_text on surface_selected 2.82 → 4.52 (min 4.5) |
| riso | `extras.color.ink_1_text` | ink=sunset | `#C32C2C` → `#970010` | ink_1_text on page_bg 3.0 → 4.8 (min 4.5); ink_1_text on surface_selected 2.82 → 4.52 (min 4.5) |
| riso | `extras.color.ink_1_text` | ink=forest | `#00727D` → `#00515A` | ink_1_text on page_bg 3.01 → 4.8 (min 4.5); ink_1_text on surface_selected 2.83 → 4.51 (min 4.5) |
| riso | `extras.color.ink_1_text` | ink=spritz | `#3255A4` → `#234492` | ink_1_text on page_bg 3.76 → 4.82 (min 4.5); ink_1_text on surface_selected 3.53 → 4.54 (min 4.5) |
| sketch | `color.accent` | — | `#7F718E` → `#7C6E8B` | accent on page_bg 4.32 → 4.51 (min 4.5) |
| sketch | `extras.color.accent_light` | — | `#C4B8D4` → `#7A6F89` | accent_light on surface_elevated 1.88 → 4.71 (min 4.5); accent_light on page_bg 1.8 → 4.5 (min 4.5) |
| swiss | `color.text_muted` | — | `#949494` → `#8E8E8E` | text_muted on surface_elevated 2.78 → 3.01 (min 3) |
| wireframe | `color.text_secondary` | — | `#757575` → `#636363` | text_secondary on page_bg 4.23 → 5.51 (min 4.5); text_secondary on border_default 3.49 → 4.55 (min 4.5); text_secondary on surface_selected 4.23 → 5.51 (min 4.5) |
| wireframe | `color.text_muted` | — | `#949494` → `#8E8E8E` | text_muted on page_bg 2.78 → 3.01 (min 3); text_muted on surface_selected 2.78 → 3.01 (min 3) |

Judgement calls (each explained in the token's note):

- **Revolt danger**: no pink passes both 4.5:1 as text on white and with
  black text on it, so `danger_foreground` became white and `danger` took
  the minimum darkening (`#E80B55`); the signature `accent` `#FF3366` is
  unchanged. This adds a sixth colour to the "inviolable" five-colour
  palette.
- **Prism accent tint**: the teal numerals cannot get lighter (no lighter
  teal reaches 4.5:1 on the tint), so the badge tint behind them darkened.
- **Prism danger** lost chroma (0.110 → 0.059) because the sRGB gamut
  cannot hold it at the passing lightness.
- **Sketch accent_light** is now about as deep as `color.accent`; the
  annotations stay lavender at 4.5:1.
- **Riso** ink-1 text shades now reach 4.5:1 (they were checked at 3:1 as
  InkTag large text, but the builder sets 12-14px type in them).

Hue gate (issue #8, ADR-0002), the `hue_fix` records and waivers:

| System | Token | Old → new | Hue gap to accent | OKLCH |
|--------|-------|-----------|-------------------|-------|
| editorial | `color.danger` | `#6B1623` → `#5F1B4F` | 1.2° → 40.3° | oklch(0.352 0.118 17.6) → oklch(0.351 0.117 338.5) |

- **Swiss** waives accent and action vs danger (one chromatic colour by
  design; errors carried by the `Error:` copy prefix).
- **Revolt** waives accent vs danger, provisionally: the five-colour palette
  has no non-pink danger to offer.
