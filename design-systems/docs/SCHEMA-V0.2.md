# Design System Spec Schema v0.2

This document defines schema v0.2 — the next major revision after v0.1. All changes are **additive**: every v0.1 spec remains valid as a v0.2 spec without modification. New fields are optional. Systems opt into v0.2 features when they need them.

The v0.2 changes are derived from 11 documented findings across two stress-test sessions (Riso authoring + the remaining 5 systems). Each change is justified by a specific gap a real system surfaced.

This document supersedes `SCHEMA.md` (v0.1). The v0.1 document is retained for historical reference and migration tracing; runtime consumers should target v0.2.

---

## Migration Strategy

**Existing v0.1 specs continue to work.** The schema validator accepts both. A v0.1 spec loaded as v0.2 simply doesn't use the new features.

**Each change documents:**
- What problem it solves (with reference to the finding that surfaced it)
- The new field shape
- How v0.1 specs are interpreted under v0.2
- Whether existing systems should be migrated or left as-is

**The CHANGELOG section at the bottom** captures the diff in compact form for tooling.

---

## Change 1: Filter graphs as named library entries

**Finding 1 (Riso)**: filter parameters alone don't capture how the filter graph is wired. Two graphs with the same parameters can produce wildly different visual results. Riso's grain layer barely rendered because the filter graph in the SVG was malformed in a way the spec couldn't catch.

### v0.1 had

```yaml
grammar_extensions:
  family: print_texture
  grain:
    feturbulence_frequency: 0.85
    overlay_mode: multiply
    opacity: 0.12
```

The consumer interprets these parameters and constructs the SVG `<filter>` graph however it sees fit.

### v0.2 has

A new top-level `filter_library` block that names filters and embeds their full SVG `<defs>` fragments. Components and artifact treatments reference filters by id rather than by parameters.

```yaml
filter_library:
  - id: riso_grain
    description: "Continuous noise overlay simulating Riso print grain"
    svg_defs: |
      <filter id="riso_grain" x="0%" y="0%" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85"
                      numOctaves="2" seed="42"/>
        <feColorMatrix values="0 0 0 0 0
                               0 0 0 0 0
                               0 0 0 0 0
                               0 0 0 0.12 0"/>
      </filter>
    parameters:
      base_frequency: 0.85
      opacity: 0.12
      seed: 42
      role: "exposed for runtime adjustment by paper preset"

  - id: riso_duotone_classic
    description: "Classic blue+pink duotone matrix for Riso paper presets"
    svg_defs: |
      <filter id="riso_duotone_classic" color-interpolation-filters="sRGB">
        <feColorMatrix values="0.299 0.587 0.114 0  0
                               0.299 0.587 0.114 0  0
                               0.299 0.587 0.114 0  0
                               0     0     0     1  0"/>
        <feColorMatrix values="-1 0 0 0 0.106
                               -1 0 0 0 0.227
                               -1 0 0 0 0.541
                               0  0 0 1 0"/>
      </filter>
    parameters:
      ink_1: "#1B3A8A"
      ink_2: "#E5347A"
```

Components reference filters via id:

```yaml
components:
  list_item:
    variants:
      - id: default
        svg: components/list-item-default.svg
        rendering_notes: "Apply filter:riso_duotone_classic to text layer."
        applies_filters: [riso_duotone_classic]
```

### What this fixes

The schema now captures the *exact* filter graph, not just the intent. Consumers paste the `svg_defs` fragment into their output verbatim — no interpretation, no graph construction, no malformed filters.

### Backwards compatibility

v0.1 specs that put filter parameters in `grammar_extensions.grain.*` or similar still work. The v0.2 consumer interprets them the same way it always did. Systems opt into the named-filter approach when they need filter-graph fidelity.

### Migration recommendation

**Riso must migrate.** Its identity depends on filter fidelity. The other 5 systems don't currently use filters and don't need to migrate.

---

## Change 2: Top-level `artifact_treatments` block

**Finding 2 (Riso)**: some treatments apply to the entire composed artifact, not per-component. Grain overlays, paper backgrounds, registration offsets all belong at the artifact level. Per-component treatments produce visible seams at component boundaries.

### v0.1 had

No artifact-level concept. Treatments lived in `grammar_extensions` with no formal contract about when they apply.

### v0.2 has

```yaml
artifact_treatments:
  - id: page_background
    layer: bottom              # painted before any components
    type: fill
    fill: ref:tokens.colors.page_bg
    description: "Always-on paper-tinted background"

  - id: grain_overlay
    layer: top                 # painted after all components
    type: filter_overlay
    filter_ref: riso_grain     # references filter_library entry
    description: "Continuous grain noise across the entire artifact"

  - id: registration_offset
    layer: per_component       # applies inside the component layer, not above/below
    type: transform
    transform: "translate({offset_x}, {offset_y})"
    parameters:
      offset_x: 0    # px, runtime-adjustable from system_state
      offset_y: 0
    description: "Simulates Riso print misalignment"
```

The `layer` enum: `bottom` (painted before components), `per_component` (applied to each component as it renders), `top` (painted after all components).

The wireframe-skill applies these in order: bottom treatments first → component composition → top treatments last.

### What this fixes

Riso's grain becomes a single continuous noise layer instead of N seamed per-component layers. Paper background becomes a guaranteed substrate that all components compose against.

### Backwards compatibility

v0.1 specs without an `artifact_treatments` block produce no artifact-level treatments. The wireframe-skill renders components only.

### Migration recommendation

**Riso must add.** Other systems may add as needed (e.g. a future Spatial system might add a global lighting layer).

---

## Change 3: Em-based ratio properties

**Finding 3 (Riso)**: the duotone ghost layer offset was specified in absolute pixels (0.4px), which doesn't scale with font size. Same lesson as letter-spacing — design intent is a ratio of font size, not an absolute value.

### v0.1 had

```yaml
ghost_layer:
  offset_x_px: 0.4
  offset_y_px: 0.4
```

### v0.2 has

```yaml
ghost_layer:
  offset_x: { value: 0.04, unit: em }
  offset_y: { value: 0.04, unit: em }
```

The schema accepts an object `{ value, unit }` for properties that have meaningful unit interpretation. Unit values: `em`, `px`, `rem`, `pct`. Em is converted to px at render time using the same machinery as letter-spacing (per-typeface verified factors via `tracking_conversion.py`).

This pattern extends beyond ghost offsets — anywhere v0.2 introduces a property that's conceptually a ratio of type size, it uses the `{ value, unit }` form.

### What this fixes

Ghost offsets read consistently across all type sizes — strong on display type (24px × 0.04em ≈ 1px offset), subtle on metadata (11px × 0.04em ≈ 0.44px offset). The Riso aesthetic holds at every scale instead of inverting between metadata and content.

### Backwards compatibility

v0.1 specs with `offset_x_px: 0.4` continue to work — the consumer treats them as `{ value: 0.4, unit: px }`. Systems opt into em-based properties when they need ratio behavior.

### Migration recommendation

**Riso should migrate.** Other systems probably don't have analogous properties yet but should use em when they introduce them.

---

## Change 4: Top-level `system_state` block

**Finding 4 (Riso)**: parametric configuration (active_paper, active_ink, halftone_angle, grain_opacity, registration_offset) was buried in `grammar_extensions`. It's structurally different — it's runtime-adjustable state, not extension grammar.

### v0.1 had

State buried inside `grammar_extensions`:

```yaml
grammar_extensions:
  family: print_texture
  parametric_state:
    active_paper: cream
    active_ink: classic
    halftone_angle: 15
    grain_opacity: 0.12
```

### v0.2 has

A top-level `system_state` block alongside `tokens`, `components`, `layout_templates`, `rulebook`, `grammar_extensions`, `artifact_treatments`, `filter_library`:

```yaml
system_state:
  - id: active_paper
    type: enum
    options: [cream, kraft, white, gray, newsprint]
    default: cream
    affects: [tokens.colors.page_bg, artifact_treatments.page_background]

  - id: active_ink
    type: enum
    options: [classic, bold, organic]
    default: classic
    affects: [filter_library.riso_duotone_classic, ...]

  - id: halftone_angle
    type: number
    range: [0, 90]
    default: 15
    affects: [filter_library.riso_halftone]

  - id: grain_opacity
    type: number
    range: [0.0, 0.5]
    default: 0.12
    affects: [filter_library.riso_grain]

  - id: registration_offset
    type: number
    range: [0, 2]
    default: 0
    affects: [artifact_treatments.registration_offset]
```

Each state entry declares its type, valid range/options, default, and which schema elements it affects (so consumers know what to re-render when state changes).

### What this fixes

Parametric systems get a first-class concept for "configuration that changes how rendering happens but isn't a token." Future systems (Spatial, future Prism with adjustable lighting, Win95 with theme variants) will share this shape.

### Backwards compatibility

v0.1 specs without `system_state` are treated as having no runtime-adjustable configuration. v0.1 specs with `parametric_state` inside `grammar_extensions` continue to work.

### Migration recommendation

**Riso should migrate.** Other systems with no parametric state can leave the block absent.

---

## Change 5: Border `style` as first-class property

**Finding 6 (Terminal)**: Terminal uses `1px dashed #1F2F1F` as its primary structural treatment. The v0.1 schema's `elevation.config.border_*` only captures width and color; style is implied as solid.

### v0.1 had

```yaml
elevation:
  strategy: borders_only
  config:
    border_light: { width: 1, color: "#E5E3DE" }
    border_strong: { width: 1, color: "#D5CFC8" }
```

### v0.2 has

```yaml
elevation:
  strategy: borders_only
  config:
    border_light: { width: 1, color: "#E5E3DE", style: solid }
    border_strong: { width: 1, color: "#D5CFC8", style: solid }
    border_dashed: { width: 1, color: "#1F2F1F", style: dashed, dash_pattern: "3,2" }
```

The `style` field accepts: `solid` (default), `dashed`, `dotted`, `double`. When `style: dashed` or `style: dotted`, an optional `dash_pattern` field overrides the SVG default `stroke-dasharray`.

This applies anywhere borders are declared — `elevation.config.border_*`, `elevation.config.rules.weight.*`, component-level border definitions.

### What this fixes

Terminal can declare its dashed-border grammar formally. Future systems (e.g. blueprint aesthetics with dashed construction lines, doodle aesthetics with dotted strokes) have a place to land.

### Backwards compatibility

v0.1 borders without `style` are treated as `style: solid`.

### Migration recommendation

**Terminal should migrate.** Other systems leave borders as solid.

---

## Change 6: Typography character-set requirements

**Finding 7 (Terminal)**: Terminal uses Unicode box-drawing characters (`┌─┐│└─┘`) as part of its grammar. These render correctly only when the typeface includes the relevant Unicode block. The schema couldn't declare this dependency, so a wireframe-skill rendering Terminal had no way to verify the typeface had the required glyphs.

### v0.1 had

```yaml
typography:
  families:
    - id: structural
      stack: "'JetBrains Mono', ui-monospace, monospace"
      role: every piece of text
```

### v0.2 has

```yaml
typography:
  families:
    - id: structural
      stack: "'JetBrains Mono', ui-monospace, monospace"
      role: every piece of text
      requires_unicode_blocks:
        - { name: "Box Drawing", range: "U+2500-U+257F", reason: "Terminal frames" }
        - { name: "Block Elements", range: "U+2580-U+259F", reason: "Cursor block █" }
      fallback_strategy: "warn"   # warn | substitute | fail
```

The `requires_unicode_blocks` field declares which Unicode blocks the system depends on. The wireframe-skill verifies the rendering environment has them; if not, it follows `fallback_strategy`:

- `warn`: render anyway with potential glyph substitution, surface a warning
- `substitute`: replace missing glyphs with declared text alternatives (per-component)
- `fail`: refuse to render, surface an error

### What this fixes

Terminal's box-drawing characters become a verifiable dependency. Future systems with esoteric character requirements (BBS systems with CP437 block characters, IPA pronunciation systems with phonetic blocks) have a place to declare them.

### Backwards compatibility

v0.1 typography families without `requires_unicode_blocks` declare no dependency, and the wireframe-skill assumes the basic Latin block is sufficient.

### Migration recommendation

**Terminal should migrate.** Other systems may not need it; emoji-using systems should consider Change 7 below instead.

---

## Change 7: Emoji support declaration

**Finding 8 (Editorial, Sketch, Prism, Revolt)**: these systems use emoji avatars (🗼 🍜 📖 💪 ⚡) as part of their list_item rendering. CairoSVG without an emoji font installed renders them as boxes. The schema can't declare this dependency.

### v0.1 had

No mechanism to declare emoji support requirements.

### v0.2 has

A `requires_emoji: true` flag at the system level, with optional substitution mappings per-component:

```yaml
system:
  id: editorial
  requires_emoji: true
  emoji_fallback_strategy: substitute  # warn | substitute | fail
  emoji_substitutions:
    "🗼": { mode: monogram, value: "T" }
    "🍜": { mode: monogram, value: "R" }
    "📖": { mode: monogram, value: "B" }
    "💪": { mode: monogram, value: "F" }
    "⚡": { mode: text_label, value: "Code" }
```

When rendering in an environment without emoji support and `emoji_fallback_strategy: substitute`, the wireframe-skill replaces emoji characters with the substitution mapping. `mode: monogram` produces a single letter in the system's avatar treatment; `mode: text_label` produces a small text replacement.

### What this fixes

Emoji-dependent systems become explicit about their dependency. Render environments without emoji support get a documented fallback path instead of silently producing missing glyphs.

### Backwards compatibility

v0.1 specs without `requires_emoji` are assumed to not require it. The wireframe-skill renders emoji as-is and accepts whatever the renderer produces.

### Migration recommendation

**Editorial, Sketch, Prism, Revolt should migrate** — they all use emoji avatars. Swiss, Terminal, Riso don't currently use emoji and should leave the flag absent.

---

## Change 8: Format-fitness declarations

**Finding 9 (Prism)**: Prism's `glass_blur` elevation requires CSS `backdrop-filter`, which has no SVG equivalent. SVG output approximates with semi-transparent fills but underspecifies the visual. The schema couldn't declare this format-fitness gap.

### v0.1 had

No mechanism to declare which output formats a system renders correctly in.

### v0.2 has

A `format_fitness` block at the system level declaring which output formats render the system correctly:

```yaml
system:
  id: prism
  format_fitness:
    svg:
      level: approximation
      caveat: "backdrop-filter has no SVG equivalent; semi-transparent fills only approximate the glass blur"
      acceptable_for: [wireframing, layout_review]
      not_acceptable_for: [final_design_review, production_handoff]
    html_css:
      level: native
      caveat: null
      acceptable_for: [all]
    pdf:
      level: degraded
      caveat: "PDF backdrop-filter support varies by reader"
      acceptable_for: [layout_review]
```

The `level` enum: `native` (renders correctly), `approximation` (visually close but not exact), `degraded` (visually different but structurally readable), `unsupported` (don't use this format).

### What this fixes

Consumers know upfront which formats are appropriate for which use. The wireframe-skill can route Prism wireframes to HTML/CSS preview output instead of SVG when fidelity matters.

### Backwards compatibility

v0.1 specs without `format_fitness` are assumed to render natively in all formats (which may not be true, but the schema can't know).

### Migration recommendation

**Prism should migrate** with explicit SVG approximation declaration. Other systems are mostly SVG-native and may leave the block absent.

---

## Change 9: Rule check method declaration

**Finding 10 (multiple systems)**: rules vary in checkability. Swiss's "red used in 4 places per screen" is mechanical; Editorial's "drop cap on first AI message only" is semantic. The v0.1 schema's `severity` says how serious a failure is, but not how to check.

### v0.1 had

```yaml
rulebook:
  - id: editorial-drop-cap-ceremony
    rule: "..."
    rationale: "..."
    severity: required
```

### v0.2 has

```yaml
rulebook:
  - id: editorial-drop-cap-ceremony
    rule: "..."
    rationale: "..."
    severity: required
    check_method: semantic   # mechanical | semantic | both
    check_implementation: |
      Verify by reading the message ordering and AI/user roles.
      The first AI message (by chronological order, where role=ai)
      should have a drop cap; no other message should.
```

The `check_method` enum:
- `mechanical`: pure-Python regex/parse against the SVG, no model invocation
- `semantic`: requires model judgment (vision or reasoning)
- `both`: mechanical pre-check, semantic post-check for nuance

The `check_implementation` field provides guidance for implementers (mechanical: regex pattern or measurement formula; semantic: prompt template or evaluation rubric).

### What this fixes

Consumers (rulebook_check.py, design-system-skill's check_compliance operation) know which rules they can verify mechanically vs. which require model invocation. Mechanical rules run as fast deterministic checks; semantic rules invoke a model with the artifact.

### Backwards compatibility

v0.1 rules without `check_method` default to `mechanical` (since v0.1's rulebook_check.py only does mechanical checks). Authors should annotate semantic rules explicitly when migrating.

### Migration recommendation

**All systems should migrate** to annotate `check_method` on each rule. The work is small (one new field per rule) and unblocks proper compliance checking.

---

## Change 10: Selection signal enum

**Finding 11 (multiple systems)**: six systems use six different mechanisms for "this list item is selected" (accent bar, prompt character, paper tier, surface fill, glass tier, hard offset). The v0.1 schema accommodates all of them via `rendering_notes` prose, but cross-system analysis requires reading prose.

### v0.1 had

Selection treatment described in prose:

```yaml
components:
  list_item:
    variants:
      - id: selected
        rendering_notes: "Same as default plus 2px red accent bar on left edge..."
```

### v0.2 has

An optional `selection_signal` field on component variants where selection is meaningful:

```yaml
components:
  list_item:
    variants:
      - id: selected
        selection_signal: accent_bar
        selection_signal_detail:
          width: 2
          color_ref: tokens.colors.accent
          position: left
        rendering_notes: "..."   # still here for the full description
```

The `selection_signal` enum:
- `accent_bar`: colored bar on one edge (Swiss, Editorial-style)
- `prompt_character`: leading character changes (Terminal-style `>`)
- `surface_fill`: background tier shifts (Editorial paper-tier, Prism glass-tier, Sketch warm-surface)
- `border_treatment`: border weight or style changes (Revolt 2px → highlighted)
- `hard_offset`: shadow/offset added (Revolt's lime + shadow)
- `text_treatment`: weight/color shift only (most subtle, used in some Riso variants)

`selection_signal_detail` carries structured parameters per signal type.

### What this fixes

Cross-system queries become possible: "show me all systems using surface_fill for selection," "verify no system uses both accent_bar AND surface_fill (would be one_channel_per_message violation)."

### Backwards compatibility

v0.1 variants without `selection_signal` continue to work — the prose `rendering_notes` is the source of truth.

### Migration recommendation

**All systems should migrate** to annotate selection variants. Small work, enables tooling improvements.

---

## Change 11: Component anatomy spatial-yield constraints

**Finding 11.5 (Sketch, Prism, Revolt)**: anatomy enumerated component parts but didn't say how those parts share space. Multiple systems had preview text overflowing into unread badges because nothing in the schema told the wireframe-skill (or future authors) to truncate.

### v0.1 had

```yaml
components:
  list_item:
    anatomy: [avatar, title, preview, timestamp, unread_badge]
```

### v0.2 has

```yaml
components:
  list_item:
    anatomy:
      - { id: avatar, position: left, fixed_width: 32 }
      - { id: title, position: top_main, yields_to: [timestamp] }
      - { id: timestamp, position: top_right, fixed_width: 40 }
      - { id: preview, position: bottom_main, yields_to: [unread_badge], min_gap: 8 }
      - { id: unread_badge, position: middle_right, fixed_width: 24, optional: true }
```

Each anatomy entry can declare:
- `id`: the part identifier (was implicit; now explicit)
- `position`: structured position (was implicit)
- `fixed_width` / `fixed_height`: reserves space
- `yields_to`: list of sibling part ids this part must yield horizontal space to
- `min_gap`: minimum px gap to yielded-to siblings
- `optional`: whether this part may be absent (default false)

The wireframe-skill computes effective widths from these declarations and truncates content accordingly. The rulebook's overflow check (already in rulebook_check.py) verifies the result.

### What this fixes

Spatial relationships become declarative instead of implicit. Authors of new component variants get the truncation constraint surfaced upfront. The mechanical overflow check has structured truth to verify against, not just viewBox-edge approximation.

### Backwards compatibility

v0.1 anatomy lists without spatial declarations continue to work — they're treated as flat lists with no spatial constraints. The mechanical overflow check still runs against viewBox edges.

### Migration recommendation

**All component variants should migrate** when next revised. Existing components keep working as-is.

---

## Change 12: Rule check scope declaration

**Finding 12 (Swiss library work)**: rulebook rules vary in what they apply to. `swiss-red-finite-resource` is meaningful only for a complete screen — "exactly 4 red usages per artifact" is correct for a composed wireframe and incorrect for an individual component fragment (which legitimately has 0 red usages). When `rulebook_check.py --batch` ran every rule against every component SVG in `swiss-library/components/`, it produced 91 false-positive failures on 41 files: artifact-level rules firing on component fragments, plus rules that vacuously fail when their target element type isn't present in the fragment.

The v0.2 schema's `check_method` says *how* to check (mechanical vs semantic). `check_scope` says *what to check it against*.

### v0.1 had

No notion of scope. Every rule was implicitly artifact-scoped because the original consumer (single-artifact `check_compliance`) only ran against composed wireframes.

### v0.2 has

```yaml
rulebook:
  - id: swiss-red-finite-resource
    rule: "Red is used in exactly 4 places per screen..."
    severity: required
    check_method: mechanical
    check_scope: artifact          # NEW

  - id: swiss-zero-radius
    rule: "border-radius is 0 on every element."
    severity: required
    check_method: mechanical
    check_scope: both              # NEW: meaningful at both levels

  - id: swiss-metadata-uppercase
    rule: "All metadata is rendered uppercase, 9px Inter..."
    severity: required
    check_method: mechanical
    check_scope: component         # NEW: applies wherever 9px text appears,
                                   # but only when 9px text is present
    applies_when: "element font-size == 9"
```

The `check_scope` enum:
- `artifact`: rule is meaningful only for a complete composed wireframe. Skip in component-fragment batch checks.
- `component`: rule applies wherever its target element type appears, but vacuous on fragments lacking the target. The check should pass-vacuous, not fail.
- `both`: rule applies at every level (e.g. zero-radius — never a rounded corner anywhere, period).

The optional `applies_when` field guards component-scoped rules that are vacuous unless a specific element/attribute is present. When the predicate doesn't match any element in the fragment, the check passes vacuously instead of failing.

### What this fixes

`rulebook_check.py --batch <components/>` no longer produces false-positive failures. Artifact-level rules are skipped; vacuously-passed component-level rules pass. Real violations still surface — the noise floor drops to zero.

It also makes the rulebook honest about scope: authors must explicitly state whether a rule is screen-level or element-level.

### Backwards compatibility

Rules without `check_scope` default to `both` — the previous (over-eager) behavior. Authors should annotate scope explicitly when migrating. The default keeps v0.1 specs working without modification.

`applies_when` is optional; rules that don't declare it are checked against every matching element regardless of presence.

### Migration recommendation

**All systems should migrate** to annotate `check_scope` on every rule. The work is small (one new field per rule). Most rules are `both`; a few are scope-specific:

- Artifact-only rules: anything counting "X per screen" or "X total occurrences" (red-finite-resource, four-color-process limits, drop-cap-once-per-document).
- Component-only rules: rules that match a specific element class which may legitimately be absent (metadata-uppercase, zero-padded-indices when no list_item is present).
- Both: most structural and palette rules (zero-radius, no-shadows, color-palette, single-typeface, fixed-type-scale).

Without this migration, batch component checks remain unusable for any system whose rulebook includes artifact-level counting rules.

---

## Change 13: Project-wide no-emoji policy + `avatar_strategy` declaration

**Finding 13 (cross-system review)**: emoji-as-avatar imagery (🗼/🍜/📖/💪/⚡ used across editorial/sketch/prism/revolt) created two problems. First, emoji rendering depends on system fonts and degrades silently in CairoSVG and other non-browser renderers. Second, the `emoji_substitutions` block (Change 7) was a runtime-only band-aid: it described how to substitute glyphs during rendering, but the source SVGs still contained emoji codepoints — meaning consumers had to remember to apply substitutions and any consumer that didn't would produce broken output.

The cleaner answer is to ban emoji at the source. Every system declares its identifier strategy via `avatar_strategy`, and a mechanical `<system>-no-emoji-imagery` rulebook entry enforces the policy.

### v0.2 (pre-Change-13) had

```yaml
system:
  requires_emoji: true
  emoji_fallback_strategy: substitute
  emoji_substitutions:
    "🗼": { mode: monogram, value: "T" }
    "🍜": { mode: monogram, value: "R" }
    # ... per-emoji mapping
```

The system-source SVGs contained literal emoji codepoints. Substitution happened at render time.

### v0.2 (post-Change-13) has

```yaml
system:
  requires_emoji: false
  avatar_strategy:
    mode: monogram | abbreviation | numeric_index | none
    placeholder_size_px: <int>
    placeholder_surface: <hex or rgba or token-ref>
    placeholder_letter_typeface_ref: typography.families.<id>
    placeholder_letter_weight: <int>
    rendering_notes: |
      How identity is rendered in this system without emoji.

# Plus, in rulebook:
  - id: <system>-no-emoji-imagery
    rule: "No emoji glyphs anywhere in any artifact (avatar slots, decorative annotations, status indicators)."
    severity: required
    check_method: mechanical
    check_scope: both
    check_implementation: "Scan SVG text for codepoints in the Unicode emoji blocks (U+1F300-U+1F5FF, U+1F600-U+1F64F, U+1F680-U+1F6FF, U+1F900-U+1F9FF, U+2600-U+26FF, U+2700-U+27BF, U+1FA70-U+1FAFF). Any match is a violation."
```

The `avatar_strategy` enum:
- `monogram` — single-letter identity (Editorial / Sketch / Prism)
- `abbreviation` — two-letter uppercase identity (Revolt's TT/RI/BC matches the neobrutalist code-comment affect)
- `numeric_index` — zero-padded numeric identifier (Swiss; Riso could adopt)
- `none` — no avatar slot at all (Terminal — identity is the snake_case name)

`emoji_substitutions` and `emoji_fallback_strategy` are deprecated and should be removed from any spec that adopts Change 13.

### What this fixes

Source SVGs are rendering-environment-independent. CairoSVG, Chrome, Figma, ImageMagick, and any future renderer get identical output without per-renderer substitution logic. The mechanical no-emoji check enforces the policy continuously rather than relying on author discipline.

The four systems that previously used emoji avatars (editorial, sketch, prism, revolt) all now declare `avatar_strategy` matching their grammar:

| System | Strategy | Placeholder |
|--------|----------|-------------|
| Editorial | `monogram` | 32×32 paper-elevated square, Fraunces weight 700 |
| Sketch | `monogram` | 34×34 rounded square (8px radius), IBM Plex Sans weight 600 |
| Prism | `monogram` | 34×34 glass tier square (rgba 0.08 + 1px rgba 0.12 border), Outfit weight 500 |
| Revolt | `abbreviation` | 30×30 white square + 2px black border, Space Mono weight 700; pink swap on selection |
| Swiss | `numeric_index` | (already the rule under Swiss's spec) |
| Terminal | `none` | (already the rule — identity is the snake_case name) |
| Riso | `numeric_index` | (declared but signature SVG hasn't been re-authored yet) |

### Backwards compatibility

A spec without `avatar_strategy` defaults to `mode: numeric_index` — the most conservative interpretation that doesn't require any visual element. Specs still using `emoji_substitutions` continue to validate but the policy ban means every spec eventually needs Change 13.

The mechanical no-emoji check is now in `tooling/rulebook_check.py` as `check_no_emoji()`, registered in every per-system `CHECKS_BY_RULESET` entry. `design-system-skill check` against any system's artifact runs this check.

### Migration recommendation

**All systems should migrate.** The work per system: (1) flip `requires_emoji: true → false`, (2) replace `emoji_substitutions` block with `avatar_strategy`, (3) add a `<system>-no-emoji-imagery` rulebook entry, (4) re-author any SVG that contains an emoji codepoint to use the system's chosen avatar strategy. Steps 1-3 are one-shot per spec; step 4 scales with how much per-system imagery the system has authored.

---

## Schema v0.2 Block Order

For consistency, the canonical block order in a v0.2 spec.yaml is:

```yaml
spec_version: "0.2"

system: { ... }                # required, with new format_fitness, requires_emoji, emoji_substitutions
tokens: { ... }                # required, typography may include requires_unicode_blocks
spacing: { ... }
borders: { ... }               # may include style on border definitions
elevation: { ... }             # may include style on rules

system_state: [ ... ]          # NEW: parametric configuration
filter_library: [ ... ]        # NEW: named SVG filter definitions
artifact_treatments: [ ... ]   # NEW: bottom/per_component/top layer treatments

components: { ... }            # anatomy may include spatial-yield, variants may include selection_signal
layout_templates: { ... }
rulebook: [ ... ]              # entries may include check_method, check_scope, applies_when
grammar_extensions: { ... }
```

New blocks are optional; existing blocks gain optional fields.

---

## Per-System Migration Status

After v0.2 lands, each existing system needs review:

| System | Required migrations | Optional migrations |
|--------|---------------------|---------------------|
| **Wireframe** | check_method + check_scope on rulebook entries; spatial-yield on list_item anatomy | None |
| **Swiss** | check_method + check_scope on rulebook entries; selection_signal on list_item.selected | spatial-yield on list_item |
| **Terminal** | requires_unicode_blocks on JetBrains Mono; border style: dashed; check_method + check_scope | selection_signal on list_item.selected |
| **Editorial** | requires_emoji + substitutions; check_method + check_scope | selection_signal on list_item.selected |
| **Sketch** | requires_emoji + substitutions; check_method + check_scope; spatial-yield on list_item | selection_signal on list_item.selected |
| **Prism** | requires_emoji + substitutions; format_fitness for SVG; check_method + check_scope; spatial-yield | selection_signal on list_item.selected |
| **Revolt** | requires_emoji + substitutions; check_method + check_scope; spatial-yield on list_item | selection_signal on list_item.selected |
| **Riso** | filter_library entries; artifact_treatments block; em-based ghost offsets; system_state block; check_method + check_scope | selection_signal |

The wireframe library and Riso are the systems most affected. The others get small additive changes (mostly check_method annotations and emoji declarations).

---

## What v0.2 Doesn't Address

Things that came up but didn't make this revision:

**No interaction state machines.** Wireframes and design previews are static; modeling state transitions adds complexity without clear payoff.

**No accessibility metadata schema.** Worth doing eventually as `a11y_notes` per component variant; out of scope for v0.2.

**No animation primitives.** Same reasoning as state machines.

**No cross-system asset sharing (e.g. icons that are identical across systems).** Worth revisiting if duplication becomes painful.

**No theme variant relationships (e.g. Sketch/Prism/Revolt as siblings of Integrated).** Currently each is its own system; the relationship lives only in the .jsx source.

**Multi-format output coordination** (e.g. an SVG and HTML/CSS variant of the same wireframe rendered for the same brief). The format_fitness change makes this thinkable but doesn't define the multi-output pipeline.

These are real questions but not yet blocking work. They'll surface naturally when systems require them.

---

## CHANGELOG v0.1 → v0.2

```
ADDED:
  - filter_library: top-level array of named SVG filter definitions
  - artifact_treatments: top-level array of layer-aware artifact-level treatments
  - system_state: top-level array of runtime-adjustable parametric state
  - system.format_fitness: per-output-format fitness declaration
  - system.requires_emoji: boolean
  - system.emoji_fallback_strategy: enum (warn|substitute|fail)
  - system.emoji_substitutions: per-emoji substitution mapping
  - tokens.typography.families[].requires_unicode_blocks: array
  - tokens.typography.families[].fallback_strategy: enum
  - elevation.config.border_*.style: enum (solid|dashed|dotted|double)
  - elevation.config.border_*.dash_pattern: string (SVG stroke-dasharray)
  - elevation.config.rules[].style: enum
  - components.*.anatomy[]: now structured objects (id, position, fixed_width,
                            yields_to, min_gap, optional) instead of flat strings
  - components.*.variants[].selection_signal: enum (accent_bar|prompt_character|
                                              surface_fill|border_treatment|
                                              hard_offset|text_treatment)
  - components.*.variants[].selection_signal_detail: structured parameters
  - components.*.variants[].applies_filters: array of filter_library ids
  - rulebook[].check_method: enum (mechanical|semantic|both)
  - rulebook[].check_implementation: prose guidance for implementers
  - rulebook[].check_scope: enum (artifact|component|both)
  - rulebook[].applies_when: predicate string guarding component-scoped rules
  - properties accepting { value, unit } objects for em-based ratios
  - system.avatar_strategy: structured replacement for emoji-based identity
                            (Change 13; mode enum: monogram | abbreviation |
                            numeric_index | none)

DEPRECATED (still supported, but new specs should use replacements):
  - components.*.anatomy as flat string array (use structured objects)
  - parametric_state inside grammar_extensions (use top-level system_state)
  - filter parameters as free-floating values (use filter_library + applies_filters)
  - em-equivalent properties as _px values (use { value, unit })
  - system.requires_emoji: true                  (project-wide no-emoji policy
                                                  per Change 13; set false +
                                                  declare avatar_strategy)
  - system.emoji_fallback_strategy               (Change 13 obsoletes substitution)
  - system.emoji_substitutions                   (Change 13 obsoletes substitution)

REMOVED: nothing (all v0.1 specs remain valid v0.2 specs)
```
