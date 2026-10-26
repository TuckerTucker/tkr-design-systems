# Design System Spec Schema v0.3 — Semantic Token Contract

Schema v0.3 adds one thing to v0.2: a **fixed semantic token contract**. Every
design system supplies a value for every contract token, under the same name,
in a canonical token file (`systems/<id>/tokens.json`). Consumers — the
wireframe-skill, the MCP server, builders, the showcase JSX, and the colour
gates (§ Colour gates) — can then ask any system for `color.danger_foreground` or
`type.label` without knowing that system's private vocabulary.

Everything else in v0.2 (`SCHEMA-V0.2.md`) is unchanged. v0.1 and v0.2 specs
remain valid; the contract is only *required* for specs that declare
`spec_version: "0.3"`.

Source of truth for the contract is
`tools/design-system-skill/design_system_skill/contract.py`. The tables below
are rendered from it by `render_contract_table()` / `render_pairs_table()` /
`render_motion_table()`,
and `test_contract_doc_matches_module` fails if this document and the module
disagree. Change the module, then paste the rendered tables here.

Related documents:

- `docs/specs/TOKENS.md` — token file format in full, and exactly how JSX and
  builders consume it.
- GitHub issue #6 (this contract), #4 (single source of truth), #10
  (motion), #7 (contrast gate) and #8 (accent/danger hue gate).
- `docs/adr/0002-accent-danger-hue-gate.md` — why the hue gate exists and
  which systems are waived.

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
- spec.yaml **drifts** from the token file (see `TOKENS.md` § Drift check);
- motion tiers are out of order, or a motion declaration names an unknown
  tier or a reduced-motion behaviour the policy forbids (see § Motion);
- a colour pair misses its WCAG minimum in any mode, a waiver is malformed
  or stale, or accent/action sit within 40° of danger's hue (§ Colour gates:
  `CONTRAST_FAIL`, `CONTRAST_INVALID`, `HUE_GATE_FAIL`, `HUE_GATE_INVALID`).

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
`elevation_strategy` = identifier (see `KNOWN_ELEVATION_STRATEGIES`);
`motion_tier` = object with `enter_ms`, `exit_ms` (milliseconds, exit ≤
enter), `easing` (`cubic-bezier(x1, y1, x2, y2)`, x in 0-1) and an optional
`spring` (`duration_ms` > 0, `bounce` in [0, 1)); `reduced_motion_policy` =
`fade | none` (see § Motion).

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
| motion | `fast` | motion_tier | Feedback on a control or glyph (colour, opacity, small scale). | hover, press, focus; spec.yaml motion declarations |
| motion | `moderate` | motion_tier | Small element entering, leaving or changing material in place. | list rows, menus, toasts; spec.yaml motion declarations |
| motion | `slow` | motion_tier | Large surface or content travelling into the reading flow. | messages, panels, modals; spec.yaml motion declarations |
| motion | `expressive` | motion_tier | Brand / one-off motion, at most once per view (may equal slow). | hero entrances; spec.yaml motion declarations |
| motion | `reduced_motion` | reduced_motion_policy | What the system does under prefers-reduced-motion: fade or none. | every animation; ceiling for per-animation reduced behaviour |
<!-- contract-table:end -->

### Required contrast pairs

The contract declares which foreground/background pairs every system must make
legible, and of what kind. The contrast gate (§ Colour gates) owns the
thresholds per kind: `text` 4.5:1, `large_text` 3:1, `ui` 3:1 (non-text
contrast), `advisory` and `disabled` reported only.

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

## Colour gates

GitHub issues #7 and #8. `design_system_skill/contrast.py` computes both gates
from the token file, for **every mode combination** and every page backdrop,
and `validate_spec` fails on any miss. Run them on their own with

```
uv run python tools/design-system-skill contrast [--all | --id X | --spec PATH] [--verbose]
```

(exit 1 on failure; MCP tool `ds_check_contrast`). `validate_spec` /
`ds_validate_spec` return the reports under `data.contrast` and
`data.hue_gate`; `load_system` attaches them at `_meta.color_gates`. Each
report lists the worst result per pair: `ratio`, `minimum`, `passes`, `mode`,
`backdrop`, and `waived` / `waiver_reason`. `--verbose` adds every pair in
every mode.

### Contrast gate (#7)

WCAG 2.x relative luminance (sRGB transfer function) and ratio
`(L1 + 0.05) / (L2 + 0.05)`. A ratio is compared unrounded: `#777` on `#FFF`
is 4.48:1 and fails 4.5:1.

<!-- thresholds-table:begin -->
| Kind | Minimum | WCAG 2.x | Waivable |
|------|---------|----------|----------|
| text | 4.5:1 | 1.4.3 Contrast (Minimum) | no |
| large_text | 3:1 | 1.4.3, large-scale text | no |
| ui | 3:1 | 1.4.11 Non-text Contrast | yes, with a reason |
| advisory | — | reported only (placeholders; decorative text, with a note) | no |
| disabled | — | reported only: 1.4.3 exempts inactive UI (note + disabled-role token) | no |
<!-- thresholds-table:end -->

The table is rendered by `contrast.render_thresholds_table()`;
`test_contrast_docs_match_module` keeps it in sync.

Pairs checked: the contract pairs above plus the file's `contrast_pairs`.
`advisory` and `disabled` file pairs need a `note`; `disabled` (WCAG 1.4.3
exempts inactive components) also needs a disabled-role token on one side
(a path whose last segment contains `disabled`, e.g.
`extras.color.disabled_fill`), so it cannot silence ordinary text. Builder
templates may only paint text in declared pairs (`TOKENS.md` § 7, Text
coverage). A
file pair that repeats a contract pair with a stricter kind supersedes it
(Prism declares `color.accent` on `color.surface` as `text` because its teal
numerals are text).

**Alpha compositing.** Ratios are computed on the colours the browser
actually paints, source-over in gamma-encoded sRGB:

1. The backdrop is `color.page_bg` (must be opaque) and, in turn, each colour
   listed in the token file's optional `contrast_backdrops` (token paths of
   opaque colours that stand in for `page_bg`). Prism lists its four gradient
   stops, so every pair is checked over the gradient's darkest and lightest
   points as well as the solid stand-in; the worst result counts.
2. A translucent pair background composites over the backdrop.
3. The foreground composites over that composited background.

**Fix policy.** A failing text or UI colour is corrected with the minimum
OKLCH lightness change that passes, keeping hue and chroma (chroma is reduced
only as far as the sRGB gamut requires): `contrast.suggest_lightness_fix`.
The colour moved is chosen by role, usually the foreground or fill that
defines the system least; a signature accent may change lightness but never
hue. A translucent white already at L = 1 gains opacity instead. Every
changed value keeps a `notes` entry with a `contrast_fix` record (old, new,
OKLCH before/after, each pair's ratio before/after); `TOKENS.md` § 7 lists
them.

**Waivers** (`ui` pairs only; text is fixed, never waived):

```json
"contrast_waivers": [
  { "pair": "color.accent on color.surface",
    "modes": [ { "ink": "sunset" } ],
    "reason": "why this mark is decorative here" }
]
```

`pair` is `"<fg> on <bg>"`; `modes` (optional) are partial selections, and a
pattern matches every combination that agrees on the axes it names; `reason`
is required. A waiver, or one of its mode patterns, that matches no failing
result is **stale** and fails (`CONTRAST_FAIL` with `detail.stale`), the same
discipline as `rulebook-exceptions.yaml`. No registered system needs a
contrast waiver.

**Input boundaries.** WCAG 1.4.11 asks for 3:1 on the visual information
needed to identify a control. Where a system identifies inputs by something
other than their stroke, it re-expresses the contract pair instead of
waiving it: a `contrast_pairs` entry with
`"replaces": "color.border_input on color.surface"` and a `note` saying how
the control is identified is checked in its place (only that pair is
replaceable). Terminal does this: its inputs are identified by the bold `$`
prompt glyph in accent (checked as text, 4.5:1), and `#1F2F1F` is a section
rule, not a control boundary.

### Hue gate (#8)

Per system and mode, `color.accent` and `color.action` must sit at least
**40° of OKLCH hue** from `color.danger` whenever both colours carry hue
(OKLCH chroma ≥ 0.04; greys have no hue and are exempt), so a destructive
state never reads as the brand signal. Colours are composited over
`color.page_bg` before conversion. The report gives every gap, hue and
chroma. Waivers use the contrast waiver shape under `hue_waivers`, with
`pair` spelled `"color.accent vs color.danger"` or
`"color.action vs color.danger"`; a reason is required and a stale waiver
fails (`HUE_GATE_FAIL`). A fix moves the non-signature colour (normally
danger) by hue or lightness only. ADR-0002 records the decision, the results
per system and the waivers (Swiss; Revolt provisionally).

---

## Motion

GitHub issue #10. The UX philosophy (`claude.md`) says the system adapts to the
user's motion preference; that needs every system to say *how fast* things move
and *what happens* under `prefers-reduced-motion`, under shared names. Motion
has two halves: **tiers** (values, in `tokens.json`, contract group `motion`)
and **declarations** (which component animates at which tier, in spec.yaml).

### Tiers — bigger thing, slower tier

Four named tiers, each `{enter_ms, exit_ms, easing, spring?}`. Pick the tier by
the size of what moves, not by taste:

<!-- motion-table:begin -->
| Tier | What moves | Examples | Fine-design prior art (enter / exit) |
|------|------------|----------|--------------------------------------|
| `fast` | Feedback on a control or glyph: colour, opacity or a small scale, no travel. | hover, press, focus, toggle thumb, send affordance, cursor | 80 / 60 ms |
| `moderate` | A small element appearing, leaving or changing material in place. | list rows, menus, toasts, accordion content, row selection | 160 / 120 ms |
| `slow` | A large surface, or content that travels into the reading flow. | messages, panels, drawers, modals, section content | 240 / 160 ms, spring bounce .12 |
| `expressive` | Brand or one-off motion, at most once per view. | hero entrances, empty-state illustration, celebration | 420 ms, spring bounce .28 |
<!-- motion-table:end -->

Rules (enforced by `validate_token_document`):

- Tier `enter_ms` never decreases from `fast` to `expressive`. A system with
  no expressive motion repeats its slow values; a system whose controls give
  instant feedback sets `fast` to 0.
- `exit_ms` ≤ `enter_ms`: things leave faster than they arrive. `0` means the
  element cuts out (Swiss, Terminal, Riso).
- `easing` is a `cubic-bezier()`; CSS keywords are spelled out
  (`ease` = `cubic-bezier(0.25, 0.1, 0.25, 1)`, `ease-out` =
  `cubic-bezier(0, 0, 0.58, 1)`, `linear` = `cubic-bezier(0, 0, 1, 1)`).
- `spring` is optional, for platforms that animate with springs; its
  `duration_ms` is the perceived duration.

Fine-design prior art (the values in the table) is a reference point, not a
default: each system's values come from its JSX, and tiers the JSX does not
use are derived and marked `"derived": true` in `notes`.

### Reduced motion

`motion.reduced_motion` is the system's policy when the user asks for reduced
motion:

| Policy | Meaning |
|--------|---------|
| `fade` | Drop travel, scale and rotation; keep opacity cross-fades at the tier's duration; stop loops. |
| `none` | Every transition is instant; loops stop. |

### Per-component declarations (spec.yaml)

Each animated component lists its animations under `motion` on its own
component entry. Animated elements the spec does not model as components (the
chat message, the send affordance, Terminal's cursor) are declared under the
top-level `motion.elements` block, keyed by a stable id:

```yaml
components:
  list_item:
    motion:
      - trigger: enter            # enter | exit | hover | press | focus | select | expand | loop
        tier: moderate            # a contract tier
        properties: [opacity, transform]
        reduced: fade             # fade | none | keep
        stagger_ms: 40            # optional, per-item delay in a list
        note: "JSX .ci fadeSlideUp 0.2s ease"

motion:
  elements:
    cursor:
      - trigger: loop
        tier: fast
        properties: [opacity]
        reduced: none
        timing: { duration_ms: 1000, easing: step-end }   # optional override
        derived: false            # optional; true = not in the JSX, derived from grammar
```

Validation (`token_file.validate_motion_declarations`, run by
`validate_spec`) fails when:

- `motion` is not a non-empty list, or a declaration lacks `trigger`, `tier`,
  `properties` or `reduced`, or carries an unknown key;
- `tier` is not a contract tier, or `trigger` / `reduced` is not a known value;
- `reduced: keep` is used on an animation that moves (`transform`,
  `translate`, `scale`, `rotate`, `position`, `size`) or on a `loop`;
- the system policy is `none` and a declaration says anything but `none`;
- `stagger_ms` or `timing` is malformed (`timing.easing` may be any CSS timing
  function, including `steps()` / `step-end`);
- a `motion.elements` id is also a component id.

A state change with no declaration is instant. Durations live only in
`tokens.json`; spec.yaml may reference them with an alias
(`transition_ms: "{motion.fast.enter_ms}"` in Revolt's rotation signature).

### Findings from the JSX (issue #10 audit)

None of the eight showcase JSX files honours `prefers-reduced-motion`: every
entrance and hover transition plays regardless of the user setting. Each token
file records this in `notes["motion.reduced_motion"]`. Other discrepancies, kept
as notes rather than fixed here:

- Prism, Revolt and Sketch document message entrances (500ms ease-out, 300ms,
  400ms ease) that differ from their CSS (350ms ease, 250ms linear, 250ms
  linear). The token files use the CSS values; the documented values became
  the derived `expressive` tier where one was needed.
- Terminal's prose allows "no transitions longer than 150ms" while its message
  entrance runs 250ms; its cursor blinks unfocused, although the spec says it
  should blink only when the input is focused.
- Riso's rule `riso-no-dissolve` forbids fades, but the send affordance and the
  carousel buttons fade (150ms / 120ms).
- The showcase's documentation chrome (section `fadeIn 0.2s`, the nav chevron
  `0.15s`) is shared by every file and is not system motion.

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
    border_width, space, font, type, elevation, motion; extras; modes; notes;
    contrast_pairs (docs/specs/TOKENS.md)
  - motion (issue #10): tiers fast/moderate/slow/expressive and
    reduced_motion in tokens.json; components.<id>.motion and
    motion.elements declarations in spec.yaml
  - tokens.colors.palette[].token: token path in place of value
  - "{group.token}" aliases anywhere in spec.yaml
  - load_system: tokens.contract, _meta.tokens_path/tokens_checksum/contract_version
  - drift check: design_system_skill.drift + `drift` CLI command
  - colour gates (#7, #8): design_system_skill.contrast + `contrast` CLI
    command + MCP ds_check_contrast; token file keys contrast_backdrops,
    contrast_waivers, hue_waivers; contrast_pairs[].replaces;
    notes[].contrast_fix / hue_fix records; error codes CONTRAST_FAIL,
    CONTRAST_INVALID, HUE_GATE_FAIL, HUE_GATE_INVALID

MOVED (spec.yaml -> tokens.json, projected back by the loader):
  - tokens.colors.{page_bg,surface,surface_elevated,text_primary,
    text_secondary,text_muted,accent}
  - tokens.borders.radius_{default,inputs,chrome}
  - tokens.spacing.{grid_unit,allowed_steps}
  - tokens.elevation.strategy

REMOVED: nothing (v0.1/v0.2 specs remain valid)
```
