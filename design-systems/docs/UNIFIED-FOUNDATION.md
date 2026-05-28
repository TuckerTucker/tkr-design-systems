# Unified Foundation — wireframe + design-system

This document reconciles three things:
1. What the existing `wireframe-skill` (v2.0) brings — battle-tested across 46+ wireframes
2. What we built today in this conversation — schema, six per-system specs, signature components
3. What the unified system should look like going forward

The goal is to NOT lose the existing skill's mature philosophy while adopting the structure we built today. Where they conflict, this document is the reconciliation. Where they align, this document is the merge.

---

## Part 1: What Exists (Pre-Today)

### The wireframe-skill v2.0

A working skill that produces `(mobile.svg, desktop.svg, SPEC.yaml)` triples per screen. ~700 lines of methodology in `UNIVERSAL-WIREFRAMING-PROCESS.md`. Four template SVGs (~1,900 lines total) functioning as visual reference posters: `STYLE-GUIDE-GENERIC.svg`, `COMPONENT-LIBRARY.svg`, `GRID-LAYOUT-SYSTEM.svg`, `ICON-SET.svg`.

**What's mature about it:**

The 7-token greyscale palette (`#F5F5F5` background → `#212121` primary text) is calibrated through use. It enforces hierarchy through value+weight rather than hue, which is the right philosophical choice for wireframes.

The 6-tier typography scale (title/heading/body/secondary/label/caption) with system font stack is appropriately neutral. Wireframes should not commit to a typeface.

The 7 design principles ("Mobile is the truth", "Cards are the universal container", "One channel per message", "Comments are for intent", "Consistency over creativity", "Edge cases are first-class", "Verify don't assume") are real reasoning, not platitudes.

The output conventions matter: CSS classes in `<defs><style>` (not inline fills), banner comments (`<!-- ==================== HEADER ==================== -->`), group transforms (`<g transform="translate(x,y)">`) for positioning, no double hyphens in XML comments.

The mobile-first methodology (`375px` mobile + `1280px` desktop pair, where desktop *expands* mobile rather than rearranging it) is structurally enforced.

The SPEC.yaml format bridges visual to implementation. Not just decorative — it captures data sources, edge cases, accessibility requirements.

**What's incomplete:**

The component library lives in one mega-SVG (640 lines) rather than per-component files. Hard to use programmatically.

There's no formal component schema — the templates are visual references but not structured data the wireframe-skill (or any consumer) can query.

There's no concept of design-system-conditioned rendering. Wireframes are always neutral; the skill doesn't know how to produce a Swiss-styled or Riso-styled wireframe.

There are no per-component SVG files that could be composed programmatically. Composition is implicit in the methodology, not declarative.

There's a 6-tier type scale defined in prose but no enforcement — nothing prevents a wireframe author from using off-scale sizes.

### The existing per-system design systems (tkr-design-systems)

Five React .jsx files (Sketch/Prism/Revolt as a hub, plus Terminal, Editorial, Swiss, Riso) — ~2,000+ lines of working component implementations. Each has its own grammar, tokens, and component vocabulary.

**What's mature:**

Each system has internally consistent grammar — Terminal's box-drawing chars, Editorial's drop caps, Riso's filter pipeline.

The systems are *implementations* (working React) not just specifications. They're the canonical source of what each system IS.

**What's incomplete:**

No bridge to wireframing. The .jsx files are previews/dashboards but don't expose tokens or components in a form a wireframe-skill could consume.

No formal schema. Tokens are JavaScript object literals embedded in component code; you can read them but you can't validate or compose against them.

---

## Part 2: What We Built Today

### Schema (v0.1)

A YAML schema for describing design systems. Three-tier component hierarchy (currently: tokens, components, layout_templates, rulebook, grammar_extensions). Six grammar families (`contemporary_clean`, `character_grid`, `print_texture`, `retro_platform`, `spatial_3d`, `experimental`). Six elevation strategies (`borders_only`, `paper_tiers`, `glass_blur`, `hard_offset`, `typographic`, `duotone_filter`).

### Six per-system specs

Swiss, Terminal, Editorial, Sketch, Prism, Revolt, Riso — each authored as a spec.yaml against the v0.1 schema. Each captures tokens (with usage constraints), components (currently just list_item), elevation strategy, rulebook (with severity levels), and grammar extensions.

### Per-system signature components and dashboards

For each of the six systems, a list_item (default + selected variants) and a full dashboard composing the list_item with other implicit components. Rendered via CairoSVG and verified visually.

### Tooling

`render_preview.py` (CairoSVG renderer matching Chrome behavior), `tracking_conversion.py` (em→SVG letter-spacing), `rulebook_check.py` (mechanical compliance verification), `calibrate_tracking.py` and `_v2.py` (calibration tests).

### Skill specifications

`design-system-skill/SKILL.md` (defining the 7-operation interface for system management), `wireframe-skill/SKILL.md` (v3.0 making the existing skill design-system-aware).

### Library spec

`LIBRARY-SPEC.md` proposing a 3-tier (Primitives/Composites/Patterns) component library structure with 42 components total.

### Findings docs

`RISO-FINDINGS.md` (4 schema gaps from filter-heavy systems), `REMAINING-SYSTEMS-FINDINGS.md` (6+ additional gaps including border styles, typography character sets, emoji declarations, glass blur format-fitness, semantic vs mechanical rule checking, selection signal enums, and spatial-yield constraints).

---

## Part 3: Reconciliation — What the New System Should Be

The honest synthesis: the existing wireframe-skill has the **philosophy** right and the **structure** wrong. What we built today has the **structure** right and the **philosophy** missing. The unified system keeps the existing philosophy and applies our structure to it.

### Architectural Decision 1: One vocabulary, two rendering modes

The unified system has ONE component vocabulary (the LIBRARY-SPEC's 42 components) rendered in two modes:

**Wireframe mode** — neutral, greyscale, system-agnostic. Uses the existing wireframe-skill's 7-token palette and 6-tier typography. This becomes the "default design system" — same schema, same composition rules, just a system whose grammar is "deliberately neutral."

**Design-system mode** — same 42-component vocabulary, rendered in each per-system grammar. Swiss's button, Terminal's button, Riso's button — same component, different rendering.

This means:
- The wireframe library IS a design system in the schema sense (`grammar_family: wireframe`, a new family value)
- The wireframe-skill consumes both the wireframe library and per-system libraries through one interface
- A wireframe with no `system` parameter uses `system=wireframe`
- A wireframe with `system=swiss` uses Swiss; falls back to wireframe library for any component Swiss doesn't define

### Architectural Decision 2: The seven design principles become the wireframe library's rulebook

The wireframe-skill's principles have always been universal — they apply to all wireframes regardless of system. In the unified system, they live in the wireframe library's `rulebook` block as `severity: required` rules. Per-system rulebooks layer on top — they don't replace, they extend.

So Swiss's rulebook still says "red used in 4 places per screen" but ALSO inherits "edge cases are first-class" from the wireframe library it builds on.

This makes the principles enforceable rather than aspirational. The mechanical/semantic check distinction we discussed (Finding 10) becomes load-bearing here — most principles are semantic ("consistency over creativity") and require model judgment to verify.

### Architectural Decision 3: Existing template SVGs become the wireframe library's reference

The four existing templates (`STYLE-GUIDE-GENERIC.svg`, `COMPONENT-LIBRARY.svg`, `GRID-LAYOUT-SYSTEM.svg`, `ICON-SET.svg`) are visual reference posters showing all components together. They keep that role in the unified system — they're the design-team-facing documentation.

The new per-component SVG files (one file per Primitive/Composite/Pattern variant) are the consumer-facing structured data. The wireframe-skill loads individual SVG files when composing wireframes.

So: the templates are documentation; the per-component files are runtime assets. Both exist; they serve different consumers.

### Architectural Decision 4: SPEC.yaml output format is preserved

The existing wireframe-skill's SPEC.yaml output (data sources, components, edge cases, accessibility) is good. The new system extends it with a `design_system` block recording which system was applied, but the existing fields stay.

This means existing wireframe consumers (anything reading old SPEC.yaml files) keeps working. The new fields are additive.

### Architectural Decision 5: Mobile-first + dual-output is preserved

Every wireframe still produces a `(mobile.svg, desktop.svg, SPEC.yaml)` triple. The unified system doesn't change this contract.

Per-system libraries author components at sizes appropriate to their use (some sidebar fragments, some full-page patterns), and the wireframe-skill composes them into the mobile + desktop outputs at the canonical 375px / 1280px widths.

### Architectural Decision 6: CSS classes in `<defs><style>` for the wireframe library; system libraries can choose

The existing convention of CSS classes in `<defs>` (with utility classes like `text-primary`, `text-secondary`) is genuinely better than inline fills — it makes color changes find-and-replace and keeps the SVG cleaner.

The wireframe library adopts this convention. Per-system libraries can adopt it or not — Swiss probably should (it has a strict palette); Riso probably can't (its colors are runtime-parameterized through tokens, not class-mapped).

### Architectural Decision 7: The wireframe-skill v3.0 SKILL.md merges with the existing v2.0

The existing v2.0 SKILL.md has the methodology and process. Our v3.0 spec adds the design-system parameter. The unified v3.0 SKILL.md keeps everything from v2.0 (the 6 phases, the SPEC.yaml format, the design principles, the verification checklist) and adds:

- New optional `system` parameter
- Step "Load and validate the system spec via design-system-skill" before Phase 0
- Step "Apply artifact-level treatments" between component composition and emit
- Pre-emit rulebook check
- New `design_system` block in SPEC.yaml output
- Renderer routing per grammar_family

The v2.0 process becomes v3.0's behavior when `system` is omitted (or is `wireframe`).

---

## Part 4: What's Kept From Each Source

### From the existing wireframe-skill (KEPT)

- ✅ The 7-token greyscale palette — becomes the wireframe library's `tokens.colors`
- ✅ The 6-tier typography scale — becomes the wireframe library's `tokens.typography.scale`
- ✅ System font stack — becomes the wireframe library's `tokens.typography.families.structural`
- ✅ The 4 semantic colors (success, warning, danger, info) — become the wireframe library's `tokens.colors.palette` extras
- ✅ The 7 design principles — become the wireframe library's `rulebook` entries
- ✅ Mobile-first methodology (375px + 1280px pair) — becomes the wireframe-skill's required output contract
- ✅ SPEC.yaml format — preserved with additive `design_system` block
- ✅ CSS classes in `<defs><style>` convention — becomes the wireframe library's convention
- ✅ Banner comments (`<!-- ==================== HEADER ==================== -->`) — becomes the wireframe library's authoring convention
- ✅ Group transforms for positioning — becomes the wireframe library's authoring convention
- ✅ No-double-hyphen XML rule — becomes a rulebook entry (mechanical check)
- ✅ The 6-phase process (understand → mobile → desktop → spec → track → verify) — preserved in wireframe-skill v3.0
- ✅ The 4 template reference SVGs — kept as design-team-facing documentation

### From the existing wireframe-skill (RESTRUCTURED)

- 🔄 The mega-SVG component library (640 lines, all components in one file) → restructured to per-component SVG files following LIBRARY-SPEC
- 🔄 Component variants documented in prose → captured as `variants` array in component spec.yaml
- 🔄 Implicit composition in methodology → declared as `composed_of` in component spec.yaml

### From today's work (KEPT)

- ✅ Schema v0.1 (with documented v0.2 improvements queued) — the spec format both wireframe and per-system libraries author against
- ✅ Six per-system specs (Swiss, Terminal, Editorial, Sketch, Prism, Revolt, Riso)
- ✅ Per-system signature components (list_item) and dashboards
- ✅ design-system-skill SKILL.md (the 7-operation interface)
- ✅ wireframe-skill v3.0 SKILL.md (the design-system-aware version)
- ✅ All tooling (render_preview, tracking_conversion, rulebook_check, calibration tests)
- ✅ LIBRARY-SPEC.md (the 3-tier component vocabulary)
- ✅ All findings docs (Riso, remaining-systems) — input to schema v0.2 planning

### From today's work (RECONSIDERED)

- 🔄 LIBRARY-SPEC.md proposed using Inter as the typeface for wireframe components → revised to use system font stack (matching existing wireframe-skill convention)
- 🔄 LIBRARY-SPEC.md proposed `#CCCCCC`/`#999999` strokes → revised to use existing 7-token palette
- 🔄 LIBRARY-SPEC.md proposed component variants from scratch → revised to align with existing COMPONENT-LIBRARY.svg variant set where they overlap (Button has Primary/Secondary/Ghost/Disabled/Danger plus size variants; not my proposed Primary/Secondary/Ghost/Destructive/Link)
- 🔄 LIBRARY-SPEC.md treated wireframe library as separate from design systems → revised: wireframe library IS a design system with `grammar_family: wireframe`

### From today's work (DISCARDED)

- ❌ My proposed neutral palette (`#CCCCCC` strokes etc.) — replaced by existing 7-token greyscale
- ❌ My proposed wireframe typography (Inter) — replaced by system font stack
- ❌ Treating wireframe library as outside the design-system-skill's purview — replaced by treating it as the default design system

---

## Part 5: The New System, At a Glance

### File layout

```
tkr-design-systems/
  schema/
    spec-schema-v0.1.json                  # JSON Schema for spec validation
  specs/
    wireframe/                             # NEW: the neutral wireframe library
      spec.yaml
      components/
        primitive-button-primary.svg
        primitive-button-secondary.svg
        ... (all 42 components)
      layouts/
        pattern-dashboard.svg
        pattern-form.svg
        ...
      references/
        STYLE-GUIDE-GENERIC.svg            # imported from existing
        COMPONENT-LIBRARY.svg              # imported from existing
        GRID-LAYOUT-SYSTEM.svg             # imported
        ICON-SET.svg                       # imported
        UNIVERSAL-WIREFRAMING-PROCESS.md   # imported, becomes the wireframe library's process doc
    swiss/
      spec.yaml                            # already authored today
      components/
        list-item-default.svg              # already authored today
        list-item-selected.svg
        ...                                # to be filled out per LIBRARY-SPEC
      layouts/
        dashboard.svg                       # already authored today
        ...
    terminal/
      ...
    (editorial, sketch, prism, revolt, riso similarly)
  registry.yaml                            # NEW: index of available systems
  (the existing .jsx files stay as the canonical source for each system)

tkr-kit/
  .claude/skills/
    wireframe-skill/
      SKILL.md                             # v3.0, design-system-aware
      UNIVERSAL-WIREFRAMING-PROCESS.md     # kept (referenced from wireframe library)
      templates/                            # kept as design-team reference
    design-system-skill/                   # NEW
      SKILL.md
```

### Operation flow when wireframe-skill is invoked

```
User: "wireframe a settings screen in Swiss"

wireframe-skill v3.0:
  1. Calls design-system-skill.load_system("swiss") → gets Swiss spec object
  2. Calls design-system-skill.load_system("wireframe") → gets the wireframe library as fallback
  3. Interprets brief → maps to "settings_layout" Pattern
  4. Looks up settings_layout in Swiss's library:
     - Swiss authored it: use Swiss's settings_layout.svg
     - Swiss didn't author it: assemble from Swiss's Composites + Primitives, falling back to wireframe library for any component Swiss doesn't define
  5. Applies tokens, runs rulebook compliance (Swiss's + wireframe's principles)
  6. Emits mobile (375px) + desktop (1280px) + SPEC.yaml (with design_system: { id: swiss, ... } block)
```

### When user invokes wireframe-skill without `system`

Same flow, but `system="wireframe"`. The wireframe library handles everything; no per-system rendering is applied. Output is the existing v2.0 wireframe style.

### What the design-system-skill manages

The wireframe library is a design system in the registry, just with `grammar_family: wireframe`. The design-system-skill loads it, validates it, exposes its rulebook, and runs compliance checks against artifacts — same operations as for Swiss/Terminal/Editorial/etc.

This means consumers (wireframe-skill, future mockup-skill, etc.) have ONE interface for accessing system definitions, regardless of whether the user picked an aesthetic system or wants a neutral wireframe.

---

## Part 6: What Comes Next

The unified foundation gives us a clear next step:

**Author the wireframe library's spec.yaml + per-component SVGs first.** This is the most foundational work because:
- It establishes the new schema's wireframe-library entry, which everything else falls back to
- It refactors the existing mature mega-SVG into per-component files
- It's the model the per-system libraries will follow when they get expanded beyond their current single-component coverage
- It produces the wireframe-skill's working default

After that:
- Expand the per-system libraries (Swiss, then others) to full LIBRARY-SPEC coverage (involves authoring 40-70 SVG files per system)
- Implement the design-system-skill operations (in code, against the existing tooling)
- Implement the wireframe-skill v3.0 changes (the system parameter, rulebook check pre-emit, artifact-level treatments step)
- Eventually, the UI Design skill on top — produces production-fidelity UI from the same component graph

The wireframe library is the foundation. We need it before any of the other moves are coherent.

---

## Open Questions to Confirm Before Authoring

Three things to confirm so the wireframe library work goes the right direction:

**Question 1 — Is `wireframe` as a `grammar_family` value the right framing?** The alternatives:
- (A) `grammar_family: wireframe` — the wireframe library is a fully-qualified design system in the schema
- (B) Special-case it as not-a-system — wireframe library has a different schema that the system-skill knows how to load
- (C) Two top-level concepts: "design systems" (Swiss et al) and "the wireframe library" (singular)

I'd argue (A) — same schema, registry, validation, compliance check. Adds one enum value. Doesn't bifurcate consumer logic.

**Question 2 — Should component naming use the existing wireframe-skill's vocabulary or LIBRARY-SPEC's?** They mostly overlap but diverge in places:
- Existing: "Primary Button" / "Secondary Button" / "Ghost Button"
- LIBRARY-SPEC: button with variants `primary` / `secondary` / `ghost`

I'd argue use LIBRARY-SPEC's pattern (component + variants) because it scales — Swiss's button has different variants from Terminal's, but they're all "button." Single-axis variation across systems requires single component name.

**Question 3 — What's the canonical typeface for the wireframe library?** Existing wireframe-skill uses system font stack (`-apple-system, ...`). Today we used Inter for Swiss. The wireframe library should pick one and document why:
- (A) System font stack — most neutral, no font dependency, what the existing skill uses
- (B) Inter — matches Swiss; works with the calibration we already did; available in browsers via Google Fonts
- (C) Both — system stack as default, Inter as opt-in

I'd argue (A) — wireframes shouldn't commit to a typeface; system stack is the most honest "we haven't picked yet" signal. Per-system libraries pick their own typefaces.

These three questions shape what gets authored. Once answered, the wireframe library work can proceed cleanly.
