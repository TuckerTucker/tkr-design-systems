# Design System Spec Schema v0.3 — Semantic Token Contract

Schema v0.3 adds one thing to v0.2: a **fixed semantic token contract**. Every
design system supplies a value for every contract token, under the same name,
in a canonical token file (`systems/<id>/tokens.json`). Consumers — the
wireframe-skill, the MCP server, builders, the showcase JSX, and the planned
contrast gate — can then ask any system for `color.danger_foreground` or
`type.label` without knowing that system's private vocabulary.

Everything else in v0.2 (`SCHEMA-V0.2.md`) is unchanged. v0.1 and v0.2 specs
remain valid; the contract is only *required* for specs that declare
`spec_version: "0.3"`.

Source of truth for the contract is
`tools/design-system-skill/design_system_skill/contract.py`. The tables below
are rendered from it by `render_contract_table()` / `render_pairs_table()`,
and `test_contract_doc_matches_module` fails if this document and the module
disagree. Change the module, then paste the rendered tables here.

Related documents:

- `docs/specs/TOKENS.md` — token file format in full, and exactly how JSX and
  builders consume it.
- GitHub issue #6 (this contract) and #4 (single source of truth).

---

## Why

Before v0.3 each spec named its own tokens. Swiss had `page_bg, surface,
surface_elevated, text_primary, text_secondary, text_muted, accent` plus a
free-form palette; Terminal used `amber_count` and `error_red`; Riso had no
status colours at all. Nothing guaranteed that a system defined a colour for
text on its accent, a focus ring, or an input border — so nothing could check
their contrast. And because hex values were repeated across spec.yaml, the
builders and the JSX, they drifted (commit 313adc5: the Riso spec disagreed
with the implementation on every colour).

---

## What a v0.3 spec declares

```yaml
spec_version: "0.3"

system:
  id: swiss
  name: Swiss
  version: "1.0.0"
  tokens_file: tokens.json      # REQUIRED in v0.3; resolved relative to spec.yaml
```

The token file supplies every contract token (table below). spec.yaml no
longer repeats those values:

- `tokens.colors.{page_bg, surface, surface_elevated, text_primary,
  text_secondary, text_muted, accent}`, `tokens.borders.radius_{default,
  inputs, chrome}`, `tokens.spacing.{grid_unit, allowed_steps}` and
  `tokens.elevation.strategy` are **omitted**; `load_system` projects them
  from the token file so v0.2 consumers keep reading the same keys.
- Palette entries reference a token instead of repeating a value:
  `- { name: rule_warm, token: color.border_default, role: 1px borders }`.
  The loader fills `value` from the token file.
- Any other token-valued string may be an **alias**: `"{color.border_default}"`,
  `"{font.body}"`, `"1px solid {color.border_strong}"`. A string that is exactly
  one alias takes the token's native value (number, list, string); an
  embedded alias is interpolated as text.

### Validation (`validation.py`)

For a v0.3 spec, `validate_spec` fails when:

- `system.tokens_file` is missing, or the file is missing / not JSON;
- the token file's `system` differs from `system.id`;
- any contract token is missing or has the wrong shape (see *Kind* column);
- a contract group contains a non-contract key (extras go under `extras`);
- `modes` is malformed (see below), or `notes` / `contrast_pairs` reference
  unknown tokens;
- spec.yaml **drifts** from the token file (see `TOKENS.md` § Drift check).

v0.1/v0.2 specs may opt in by declaring `system.tokens_file`; the same checks
then apply.

---

## The contract

Kinds: `color` = CSS colour (`#RGB`, `#RRGGBB`, `#RRGGBBAA`, `rgb()`,
`rgba()`); `px` = non-negative number of CSS pixels; `px_list` = ascending
list of px; `font_stack` = CSS `font-family` string; `type_role` = object with
`size` (px), `weight` (100-900), `line_height` (unitless), `tracking` (em),
`family` (a key of the `font` group), `case` (`none | uppercase | lowercase |
sentence`); `shadow` = CSS `box-shadow` or `none`; `blur` = `NNpx` or `none`;
`elevation_strategy` = identifier (see `KNOWN_ELEVATION_STRATEGIES`).

<!-- contract-table:begin -->
| Group | Token | Kind | Meaning | Used by |
|-------|-------|------|---------|---------|
| color | `page_bg` | color | Page canvas behind every container. | app shell; bg of text_primary pair; spec tokens.colors.page_bg |
| color | `surface` | color | Default container fill (cards, panels, sidebars, AI messages). | bg of text/border_input/focus_ring pairs; tokens.colors.surface |
| color | `surface_elevated` | color | Raised container fill one tier above surface. | menus, popovers, inputs on surface; tokens.colors.surface_elevated |
| color | `surface_selected` | color | Fill of the selected / active row or item. | list_item.selected, nav active; bg of text_primary pair |
| color | `surface_inverse` | color | Inverted, high-emphasis fill (e.g. user message bubble). | bg of text_inverse pair |
| color | `text_primary` | color | Body copy and headings. | fg on page_bg/surface/surface_elevated/surface_selected |
| color | `text_secondary` | color | Supporting copy: previews, descriptions, labels. | fg on surface |
| color | `text_muted` | color | De-emphasised metadata: timestamps, counters, captions. | fg on surface (large/advisory threshold) |
| color | `text_placeholder` | color | Input placeholder text. | input placeholder; advisory pair on surface |
| color | `text_inverse` | color | Text on surface_inverse. | fg on surface_inverse |
| color | `accent` | color | The system's signal hue (brand mark, unread, selection bar). | accent marks; tokens.colors.accent; bg of accent_foreground |
| color | `accent_foreground` | color | Content drawn on an accent fill. | fg on accent |
| color | `action` | color | Fill (or text colour, for text-only buttons) of the primary action. | button.primary, send; bg of action_foreground |
| color | `action_foreground` | color | Content drawn on an action fill. | fg on action |
| color | `danger` | color | Error / destructive status. | status badges, errors; bg of danger_foreground |
| color | `danger_foreground` | color | Content on a danger fill. | fg on danger |
| color | `success` | color | Positive / complete status. | status badges; bg of success_foreground |
| color | `success_foreground` | color | Content on a success fill. | fg on success |
| color | `warning` | color | Caution status. | status badges; bg of warning_foreground |
| color | `warning_foreground` | color | Content on a warning fill. | fg on warning |
| color | `info` | color | Neutral informational status. | status badges; bg of info_foreground |
| color | `info_foreground` | color | Content on an info fill. | fg on info |
| color | `border_default` | color | Default rule / container boundary. | dividers, card strokes |
| color | `border_strong` | color | Emphatic rule (section separators, strong frames). | section rules, hover strokes |
| color | `border_input` | color | Boundary of an editable control. | input/search strokes; ui pair on surface |
| color | `focus_ring` | color | Keyboard focus indicator. | focus outline; ui pair on surface and page_bg |
| radius | `default` | px | Default corner radius for containers. | cards, list items; tokens.borders.radius_default |
| radius | `input` | px | Corner radius of inputs and controls. | inputs, buttons; tokens.borders.radius_inputs |
| radius | `chrome` | px | Corner radius of the app shell / outer chrome. | app shell, modals; tokens.borders.radius_chrome |
| border_width | `default` | px | Stroke width of border_default. | dividers, card strokes |
| border_width | `strong` | px | Stroke width of border_strong. | section rules |
| border_width | `focus` | px | Stroke width of focus_ring. | focus outline |
| space | `unit` | px | Base grid unit. | tokens.spacing.grid_unit |
| space | `steps` | px_list | Every permitted spacing value, ascending. | tokens.spacing.allowed_steps; layout lint |
| space | `xs` | px | Tightest gap (icon-label, inline). | components |
| space | `sm` | px | Small gap (stacked text, control padding). | components |
| space | `md` | px | Default container padding. | cards, rows |
| space | `lg` | px | Gap between groups. | sections |
| space | `xl` | px | Major block break. | page layout |
| font | `body` | font_stack | Family for content and headings. | type roles; tokens.typography.families |
| font | `label` | font_stack | Family for metadata / labels (may equal body). | type.label; tokens.typography.families |
| font | `mono` | font_stack | Family for code / tabular figures (may equal body). | code excerpts |
| type | `display` | type_role | Largest display text (brand, hero numbers). | mastheads, stat values |
| type | `title` | type_role | Screen / section titles. | headers |
| type | `body` | type_role | Primary reading text. | messages, paragraphs |
| type | `small` | type_role | Secondary text (previews, captions). | list previews |
| type | `label` | type_role | Metadata / label text. | timestamps, tags |
| elevation | `strategy` | elevation_strategy | How depth is expressed (see KNOWN_ELEVATION_STRATEGIES). | tokens.elevation.strategy |
| elevation | `raised` | shadow | box-shadow of a raised element, or none. | cards, message bubbles |
| elevation | `overlay` | shadow | box-shadow of overlays (modal, menu), or none. | modals, dropdowns |
| elevation | `backdrop_blur` | blur | backdrop-filter blur radius, or none. | glass surfaces |
<!-- contract-table:end -->

### Required contrast pairs

The contract declares which foreground/background pairs every system must make
legible, and of what kind. Thresholds per kind belong to the contrast gate
(not part of this change); suggested WCAG 2.x mapping: `text` 4.5:1,
`large_text` 3:1, `ui` 3:1 (non-text contrast), `advisory` reported only.

Semi-transparent colours composite over the pair's background; a
semi-transparent background composites over `color.page_bg`. Pairs are checked
in **every mode combination** (`token_file.iter_mode_selections`). Systems add
their own pairs in the token file's `contrast_pairs` list (e.g. Swiss declares
`color.action` on `color.surface` because its primary buttons are red text).

<!-- pairs-table:begin -->
| Foreground | Background | Kind |
|------------|------------|------|
| `color.text_primary` | `color.page_bg` | text |
| `color.text_primary` | `color.surface` | text |
| `color.text_primary` | `color.surface_elevated` | text |
| `color.text_primary` | `color.surface_selected` | text |
| `color.text_secondary` | `color.surface` | text |
| `color.text_muted` | `color.surface` | large_text |
| `color.text_placeholder` | `color.surface` | advisory |
| `color.text_inverse` | `color.surface_inverse` | text |
| `color.accent_foreground` | `color.accent` | text |
| `color.action_foreground` | `color.action` | text |
| `color.danger_foreground` | `color.danger` | text |
| `color.success_foreground` | `color.success` | text |
| `color.warning_foreground` | `color.warning` | text |
| `color.info_foreground` | `color.info` | text |
| `color.accent` | `color.surface` | ui |
| `color.border_input` | `color.surface` | ui |
| `color.focus_ring` | `color.surface` | ui |
| `color.focus_ring` | `color.page_bg` | ui |
<!-- pairs-table:end -->

---

## Extras

System-specific tokens live under `extras`, grouped like the contract
(`extras.color.rule_hairline`, `extras.font.annotation`, `extras.radius.message`,
`extras.type.dropcap`, `extras.shadow.md`). Extras are free-form apart from two
rules: `extras.color.*` must be colours (they participate in modes and in the
drift check's literal scan), and `extras.type.*` roles may name a font from
`font` *or* `extras.font`.

A token that exists in only one or two systems is an extra. A role every
consumer needs from every system belongs in the contract — propose it by
editing `contract.py` and this document together, then supply a value in all
eight token files in the same change.

---

## Modes (per-mode values)

Some systems resolve tokens differently under runtime configuration. None of
the eight systems ships light/dark variants today (all JSX files are
single-theme), but Riso is parametric: 5 paper stocks × 6 ink drums. Modes
express that without duplicating the whole file:

```json
"modes": {
  "axes": [
    {
      "id": "paper",
      "state_ref": "system_state.active_paper",
      "default": "cream",
      "options": {
        "cream": { "color.page_bg": "#F4EFE4", "color.text_primary": "#1A1614", ... },
        "kraft": { "color.page_bg": "#D4BE94", "color.text_primary": "#2A1F12", ... }
      }
    },
    { "id": "ink", "state_ref": "system_state.active_ink", "default": "classic",
      "options": { "classic": { "color.accent": "#FF48B0", ... }, ... } }
  ]
}
```

Rules:

- Base values (`color`, `type`, ...) are the **default resolved state**: the
  default option of every axis. The validator fails if a default option's
  override disagrees with the base value.
- Option overrides are flat `token.path: value` maps; paths may target
  contract tokens or extras; values are validated against the token's kind.
- Axes apply in declaration order (later axis wins on conflict).
- `state_ref` links an axis to the spec's `system_state` entry (v0.2 Change 4).
- A light/dark system would declare one axis
  `{ "id": "scheme", "default": "light", "options": { "light": {}, "dark": {...} } }`.

API: `token_file.resolve_mode(doc, {"paper": "kraft", "ink": "sunset"})`
returns a resolved copy; `iter_mode_selections(doc)` yields every combination
(exactly one empty selection for single-mode systems).

---

## Migration notes (v0.2 → v0.3)

Per system:

1. Create `systems/<id>/tokens.json` with every contract token. Take values
   from the JSX (canonical). Where a role has no obvious value, derive it from
   the system's grammar and record the derivation in `notes`
   (`{"color.danger": {"derived": true, "note": "..."}}`).
2. In spec.yaml: set `spec_version: "0.3"`, add `system.tokens_file:
   tokens.json`, delete the projected keys listed above, switch palette
   entries to `token:` references, and replace remaining token-valued
   literals (elevation config colours, family stacks) with aliases.
3. Run `python3 tools/design-system-skill drift --all` and
   `python3 tools/design-system-skill validate --spec systems/<id>/spec.yaml`.

Consumer impact:

- `load_system` output is backwards compatible: the projected keys are present
  with token-file values; `tokens.contract` holds the full token document;
  `_meta` gains `tokens_path`, `tokens_checksum`, `contract_version`. The spec
  cache now invalidates when either spec.yaml or tokens.json changes.
- Code that reads spec.yaml **directly** (not via `load_system`) must call
  `token_file.read_spec_with_tokens(path)` — raw YAML now contains aliases and
  `token:` references instead of values. `build_riso_reference.py` does this.
- wireframe-skill `export_tokens_for_authoring` / MCP `wf_get_tokens` now take
  their CSS class fills and `text_inverse` from the contract (previously the
  wireframe greys were hard-coded for every system) and return the contract
  under `contract`.
- Extension systems (`system.extends`) that override `tokens.colors.*` keep
  working, but the parent's `tokens.contract` is inherited unchanged; an
  extension that changes token values should ship its own token file.

All eight registered systems were migrated in the same change (the `neutral`
registry id is an alias of `wireframe` and shares its spec and token file).

---

## CHANGELOG v0.2 → v0.3

```
ADDED:
  - spec_version "0.3"
  - system.tokens_file: path to the canonical token file (required in v0.3)
  - token file format (contract_version "1.0"): contract groups color, radius,
    border_width, space, font, type, elevation; extras; modes; notes;
    contrast_pairs (docs/specs/TOKENS.md)
  - tokens.colors.palette[].token: token path in place of value
  - "{group.token}" aliases anywhere in spec.yaml
  - load_system: tokens.contract, _meta.tokens_path/tokens_checksum/contract_version
  - drift check: design_system_skill.drift + `drift` CLI command

MOVED (spec.yaml -> tokens.json, projected back by the loader):
  - tokens.colors.{page_bg,surface,surface_elevated,text_primary,
    text_secondary,text_muted,accent}
  - tokens.borders.radius_{default,inputs,chrome}
  - tokens.spacing.{grid_unit,allowed_steps}
  - tokens.elevation.strategy

REMOVED: nothing (v0.1/v0.2 specs remain valid)
```
