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
  "contrast_pairs": [ { "fg": "color.action", "bg": "color.surface", "kind": "text", "note": "…" } ],
  "notes": { "color.danger": { "derived": true, "note": "why this value" } }
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
3. `python3 tools/design-system-skill validate --spec systems/<id>/spec.yaml`.
4. Regenerate the SVG libraries: `uv run python tools/builders/build.py --system <id>`
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
  "--riso-ink-1": t.extras.color.ink_1,
  "--riso-ink-2": t.extras.color.ink_2,
  "--riso-blend": t.extras.press.blend,
  "--riso-ink-density": String(t.extras.press.density),
  // slider-driven vars (offsets, halftone, grain, bleed, tremor) stay in system_state
};
```

Selector labels come from the spec's `press_presets` (labels/characters are
prose, not tokens). Put `resolveMode` and `typeStyle` in a shared module such
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
