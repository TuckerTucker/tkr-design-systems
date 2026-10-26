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

  // ── system-specific ──
  "extras": { "color": { "rule_hairline": "#F0F0F0", … }, "type": {…}, "font": {…}, … },

  // ── optional ──
  "modes": { "axes": [ … ] },              // per-mode overrides (SCHEMA-V0.3.md § Modes)
  "contrast_pairs": [ { "fg": "color.action", "bg": "color.surface", "kind": "text", "note": "…" } ],
  "notes": { "color.danger": { "derived": true, "note": "why this value" } }
}
```

Units: `radius`, `border_width`, `space`, `type.*.size` are CSS pixels as
numbers; `type.*.tracking` is em; `type.*.line_height` is unitless. Colours are
CSS strings (`#RRGGBB`, `#RRGGBBAA`, `rgba()`); translucent values are meant to
composite over the surface they sit on.

`notes` entries with `"derived": true` mark values that **do not appear in the
JSX** and were derived from the system's grammar (for example status colours
in systems that have none). `"derived": false` notes explain a JSX value
(where it is used, or a discrepancy inside the JSX). Treat derived values as
proposals a designer may revise.

Token paths are dotted: `color.page_bg`, `type.label`, `extras.color.ink_1`.

---

## 2. Changing values

1. Edit `systems/<id>/tokens.json` only.
2. `python3 tools/design-system-skill drift --id <id>` (or `--all`).
3. `python3 tools/design-system-skill validate --spec systems/<id>/spec.yaml`.
4. Re-run the system's builders (once they consume the file, § 5) and, for
   Riso, `python3 tools/builders/build_riso_reference.py`.

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

## 5. SVG builders (`tools/builders/build_<id>_{library,patterns}.py`)

Builders currently hard-code hex values (e.g. `STANDARD_DEFS` in
`build_swiss_library.py`). Migrate them to read the token file:

```python
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "tools" / "design-system-skill"))
from design_system_skill.token_file import get_token, load_tokens_for_system  # noqa: E402

_loaded = load_tokens_for_system("swiss")
if not _loaded.ok:
    raise SystemExit("; ".join(e.message for e in _loaded.errors))
T = _loaded.data

INK = get_token(T, "color.text_primary")
RULE_HAIRLINE = get_token(T, "extras.color.rule_hairline")
FONT = get_token(T, "font.body")
```

- Generate the `<defs><style>` class block from tokens using the same mapping
  the wireframe-skill uses (`wireframe_skill/tokens.py::_CLASS_TOKENS`):
  `.text-primary → color.text_primary`, `.text-secondary → color.text_secondary`,
  `.text-disabled → color.text_muted`, `.text-inverse → color.text_inverse`,
  `.text-danger/-success/-warning/-info → color.danger/…`, plus
  `.text-accent → color.accent` where a builder needs it. Keeping one mapping
  means SVGs, wireframe-skill output and `wf_get_tokens` agree.
- Strokes: `color.border_default` at `border_width.default`,
  `color.border_strong` at `border_width.strong`, inputs `color.border_input`,
  focus `color.focus_ring` at `border_width.focus`.
- Radii: `radius.default` (containers), `radius.input` (controls),
  `radius.chrome` (shell/modals).
- SVG cannot composite CSS `rgba()` the way the browser does over a gradient;
  for Prism keep alpha values as `fill-opacity` on white, and for Riso
  flatten per the spec's `format_fitness.svg` caveats.
- Riso builders take a mode selection and call `resolve_mode(T, {...})`;
  default output uses the base values (cream + classic).
- After migrating a builder, regenerate its SVGs and confirm
  `design-system-skill check` still passes for the library.

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
| `check_drift(spec_path)` / `check_drift_all()` / `find_drift(spec, doc)` | drift | spec ↔ token-file agreement |
