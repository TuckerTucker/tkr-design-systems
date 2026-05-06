# tkr-kit Component Library Specification (v0.1)

## Purpose

This document defines the structure of a per-system component library — what components exist, how they're categorized, how they compose, and what shape each component's definition takes. It's authored *before* the per-system libraries themselves so that all six (and future) systems can be built against a shared vocabulary rather than each system inventing its own.

The reader audience is whoever authors a new design system for tkr-kit. The wireframe-skill consumes the libraries that result; the design-system-skill validates them against this specification.

## Relationship to Atomic Design

The three-tier hierarchy below is informed by Brad Frost's atomic design (atoms / molecules / organisms / templates / pages) but doesn't map one-to-one. Differences worth naming:

We collapse atoms+molecules into **Primitives** because the wireframe-fitness boundary doesn't sharpen the atom/molecule distinction usefully — both render as SVG fragments authored from scratch, and consumers don't need to know which is "more atomic."

We rename organisms to **Composites** to avoid implying biological inevitability — a Composite is just "a primitive built from primitives that has its own identity."

We separate templates+pages into **Patterns** because templates (structure-only) and pages (instance) collapse for wireframing — every wireframe IS a template-instance, and we don't need to track them as distinct concepts.

So the hierarchy is **Primitives → Composites → Patterns** — three tiers, not five.

## Tier Definitions

### Tier 1: Primitives

**Definition:** Atomic UI elements that don't decompose into smaller meaningful components within the wireframing context.

**Authorship:** Every system MUST define every Primitive in the library. Missing primitives are validation errors. The Primitive set is the floor below which a system isn't a complete library.

**Variation pattern:** Primitives use the existing `variants` mechanism from the schema. A `Button` primitive has variants like `primary`, `secondary`, `ghost`, `destructive`. Each variant is one SVG file.

**Wireframe role:** Primitives carry the system's basic typographic and spatial vocabulary. A wireframe with no Primitives wouldn't render at all.

### Tier 2: Composites

**Definition:** Components built from Primitives that have their own identity and recurring use across patterns.

**Authorship:** Systems SHOULD define most Composites; gaps are warnings, not errors. A system may legitimately not define every Composite (e.g. Terminal probably doesn't need a `Toast`; Editorial probably doesn't need a `KeyValue` — both are situational).

**Variation pattern:** Composites also use `variants`, but additionally declare `composed_of` — a list of Primitives the Composite is built from. This lets the wireframe-skill assemble a Composite from Primitives if the system author hasn't authored it yet, with reduced fidelity.

**Wireframe role:** Composites carry the system's component-level visual logic. They're where rendering decisions like "do badges go beside or below preview text" live.

### Tier 3: Patterns

**Definition:** Full regions or layouts assembled from Composites. The largest unit a library exposes — beyond patterns, you're into custom wireframe compositions for specific briefs.

**Authorship:** Systems MAY define Patterns. Many systems will only define a few; some may define none. Patterns are the system's *opinion* about how regions should be composed, and not every system needs a strong opinion about every region.

**Variation pattern:** Patterns also use `variants` and `composed_of`, but the composition references Composites (and occasionally Primitives directly). Patterns may also reference layout geometry (sidebar width, header height, content margins) as part of their definition.

**Wireframe role:** Patterns are what the wireframe-skill chooses from when interpreting a brief. A brief saying "settings page" maps to a Pattern; the Pattern tells the skill which Composites land where.

## The Component Vocabulary

### Primitives (12)

Every system must define all twelve. Missing any is a validation failure.

1. **button** — clickable text or icon-driven action
   - variants: `primary`, `secondary`, `ghost`, `destructive`, `link`
   - anatomy: label, icon (optional)

2. **input** — single-line text field for user input
   - variants: `text`, `password`, `search`, `numeric`
   - anatomy: placeholder, value, focus_indicator, clear_action (optional)

3. **textarea** — multi-line text field
   - variants: `default`, `auto_grow`
   - anatomy: placeholder, value, resize_handle (optional)

4. **select** — choose one from a discrete set
   - variants: `dropdown`, `native_select`
   - anatomy: label, current_value, indicator (chevron/arrow)

5. **checkbox** — boolean on/off, multiple-select context
   - variants: `default`, `indeterminate`
   - anatomy: box, check_mark, label (optional)

6. **radio** — one of N exclusive options
   - variants: `default`
   - anatomy: circle, dot, label (optional)

7. **toggle** — boolean on/off, settings context
   - variants: `default`
   - anatomy: track, thumb, label (optional)

8. **label** — text identifying another element's purpose
   - variants: `default`, `required`, `optional`
   - anatomy: text, marker (asterisk/optional)

9. **icon** — visual symbol for an action or concept
   - variants: `default`, `outlined`, `filled`
   - anatomy: glyph
   - Note: wireframes typically use placeholder boxes or system-specific glyphs (e.g. Terminal's `>` `█`); fidelity is not the goal

10. **avatar** — visual identifier for a person/entity
    - variants: `photo`, `monogram`, `emoji`, `index`, `none`
    - anatomy: identifier, status_dot (optional)
    - System-specific: Swiss uses `index`, Terminal uses `none` (identity via name), Editorial uses `monogram`, Sketch/Prism/Revolt use `emoji`

11. **badge** — small labeled marker (count, status, tag)
    - variants: `count`, `status`, `tag`, `dot`
    - anatomy: text or shape, color
    - Notable: Swiss explicitly forbids badge components (rulebook: counts are display type, statuses are dots)

12. **divider** — visual separation between content
    - variants: `hairline`, `default`, `strong`, `dashed`, `double`
    - anatomy: line

### Composites (18)

Systems SHOULD define most. Gaps are warnings.

13. **card** — bounded container for related content
    - variants: `default`, `elevated`, `outlined`, `gray_surface`, `glass`
    - composed_of: [divider (optional)]
    - System-specific: Swiss uses `gray_surface` only when needed; Prism uses `glass`; Revolt uses bordered+shadowed

14. **list_item** — single row in a list (we have this)
    - variants: `default`, `selected`, `compact`, `with_action`, `with_metadata`
    - composed_of: [avatar, label, badge (optional), divider]

15. **form_field** — labeled input with optional help and error
    - variants: `default`, `inline`, `with_help`, `with_error`
    - composed_of: [label, input | textarea | select | checkbox | radio | toggle, label (for help text)]

16. **table_row** — one row of a tabular layout
    - variants: `default`, `header`, `selected`, `expanded`
    - composed_of: [label (per cell), checkbox (optional, for select column)]

17. **table_header** — column headers row
    - variants: `default`, `sortable`, `with_filter`
    - composed_of: [label, icon (sort indicator), button (filter)]

18. **nav_item** — single entry in a navigation list
    - variants: `top_level`, `sub_item`, `breadcrumb_segment`
    - composed_of: [icon (optional), label, badge (optional)]

19. **tab_item** — single tab in a tab bar
    - variants: `default`, `active`, `disabled`
    - composed_of: [label, icon (optional), badge (optional)]

20. **breadcrumb_trail** — sequence of nav_items showing hierarchy
    - variants: `default`, `truncated`
    - composed_of: [nav_item, divider (separator chevron)]

21. **pagination** — page navigation for long lists
    - variants: `default`, `numbered`, `infinite_scroll_indicator`
    - composed_of: [button, label]

22. **toast** — transient notification overlaid on content
    - variants: `info`, `success`, `warning`, `error`
    - composed_of: [icon, label, button (dismiss)]

23. **stat** — large numeric display with label and trend
    - variants: `default`, `with_trend`, `with_sparkline`
    - composed_of: [label, label (the value as display type)]

24. **key_value** — definition-list-style data display
    - variants: `default`, `inline`, `tabular`
    - composed_of: [label (key), label (value)]

25. **button_group** — visually grouped related buttons
    - variants: `default`, `segmented`, `attached`
    - composed_of: [button (multiple)]

26. **search_bar** — input plus search affordance
    - variants: `default`, `with_filters`, `with_results_count`
    - composed_of: [input, icon, button (clear, optional)]

27. **banner** — full-width emphasis above content
    - variants: `info`, `success`, `warning`, `error`, `promotional`
    - composed_of: [icon, label, button (action, optional), button (dismiss)]

28. **accordion_item** — one collapsible row in a list
    - variants: `default`, `expanded`
    - composed_of: [label, icon (chevron), divider]

29. **stepper** — multi-step progress indicator
    - variants: `linear`, `numbered`, `dotted`
    - composed_of: [label (per step), divider (per connector)]

30. **dropdown_menu** — actions list shown on trigger
    - variants: `default`, `with_groups`, `with_search`
    - composed_of: [button (trigger), list_item (per action), divider]

### Patterns (12)

Systems MAY define. Highly variable; Patterns are where each system's grammar most strongly shows.

31. **sidebar** — vertical navigation column
    - variants: `default`, `collapsed`, `with_sections`
    - composed_of: [card (brand area), search_bar, nav_item (multiple), card (account/footer)]
    - Geometry: typically 240–320px wide, full height

32. **header** — top horizontal bar
    - variants: `default`, `with_search`, `with_actions`
    - composed_of: [card (brand), nav_item (top-level nav), search_bar, button_group (actions)]
    - Geometry: typically 48–80px tall, full width

33. **form** — multi-field data entry
    - variants: `single_column`, `two_column`, `inline`, `wizard`
    - composed_of: [form_field (multiple), button (submit), button (cancel/secondary)]

34. **data_table** — tabular data with rows and columns
    - variants: `default`, `with_actions`, `with_pagination`, `with_filters`
    - composed_of: [table_header, table_row (multiple), pagination]

35. **modal** — focused overlay dialog
    - variants: `default`, `confirmation`, `form_modal`, `wide`
    - composed_of: [card (container), label (title), label (body), button_group (actions), button (close)]

36. **drawer** — side panel that slides in
    - variants: `right`, `left`, `bottom`
    - composed_of: [card (container), label (title), button (close), form (or other content)]

37. **empty_state** — placeholder when content is missing
    - variants: `no_data`, `no_results`, `first_use`, `error`
    - composed_of: [icon (illustration), label (title), label (description), button (action)]

38. **command_palette** — keyboard-first quick switcher
    - variants: `default`, `with_groups`, `with_recent`
    - composed_of: [search_bar, list_item (per command), divider, label (kbd shortcut)]
    - Note: most natural fit for Terminal; Swiss/Editorial may not define

39. **settings_layout** — sidebar nav + content panel
    - variants: `default`, `with_subsections`
    - composed_of: [sidebar (settings nav), card (content panel), form (per settings group)]

40. **article** — long-form content layout
    - variants: `default`, `with_toc`, `with_sidebar_meta`
    - composed_of: [label (title), label (byline/metadata), label (body), divider]
    - Note: most natural fit for Editorial

41. **dashboard** — region with metrics + lists + composer (we have this)
    - variants: `metrics_heavy`, `conversation`, `list_focus`, `mixed`
    - composed_of: [sidebar, header, card (multiple), stat (multiple), list_item (multiple)]

42. **auth** — sign-in / sign-up / reset flows
    - variants: `sign_in`, `sign_up`, `reset_password`, `verify_code`
    - composed_of: [card (container), label (title), form, button (primary), label (alternate action link)]

## Component Definition Format

Each component (in any tier) extends the existing schema's `components.{id}` block with two additional fields:

```yaml
components:
  list_item:
    tier: composite          # NEW: primitive | composite | pattern
    composed_of:             # NEW: list of component ids this is built from (composites + patterns only)
      - avatar
      - label
      - label
      - badge
    anatomy:                 # existing: human-readable parts list
      - avatar
      - title
      - preview
      - timestamp
      - unread_badge
    variants:                # existing
      - id: default
        svg: components/list-item-default.svg
        rendering_notes: "..."
        states: [default, hover, selected]
    constraints:             # existing
      - "..."
```

**`tier`** is required and lets the consumer (wireframe-skill, design-system-skill) reason about composition correctness — Patterns can't compose into Primitives, etc.

**`composed_of`** is required for Composites and Patterns, optional for Primitives (most Primitives compose nothing). It declares the dependency graph: if a Composite's `composed_of` includes `avatar` and the system doesn't define `avatar`, that's a validation error.

The other fields (`anatomy`, `variants`, `constraints`, `rendering_notes`) work as before.

## Coverage Scorecard

Each system gets an automatically-computed coverage scorecard:

```yaml
# Generated by design-system-skill, included in load_system response
coverage:
  primitives: { defined: 12, total: 12, percent: 100, status: complete }
  composites: { defined: 14, total: 18, percent: 78, status: substantial, missing: [accordion_item, stepper, banner, dropdown_menu] }
  patterns: { defined: 4, total: 12, percent: 33, status: partial, missing: [...] }
  overall_status: usable_with_gaps
```

Status values:
- `complete` — 100% defined
- `substantial` — 75-99% defined
- `partial` — 25-74% defined
- `minimal` — under 25% defined
- `unused` — 0% defined (valid for some systems)

The wireframe-skill uses this when interpreting briefs: a brief that requires components a system doesn't have triggers either a fallback (use the wireframe-skill's neutral template for that component) or an error (if the system explicitly forbids fallback).

## Composition Rules

When the wireframe-skill assembles a wireframe from the library, it follows these rules:

**Rule 1: Higher-tier components reference lower-tier components.** Patterns reference Composites and Primitives. Composites reference Primitives. Primitives reference nothing. Cycles are validation errors.

**Rule 2: A `composed_of` reference can be satisfied by either an authored variant OR a fallback.** If the brief calls for a `dashboard` Pattern and the system has authored `dashboard.svg`, use it. If not, the wireframe-skill assembles `dashboard` from its `composed_of` Composites (sidebar, header, etc.), each of which is either authored or further decomposed.

**Rule 3: System-specific overrides win at the highest tier where they're defined.** If both Swiss `dashboard.svg` (authored Pattern) and Swiss `sidebar.svg` (authored Composite) exist, the Pattern wins — it's already an opinion about how the Composites compose. The skill doesn't re-assemble.

**Rule 4: Cross-tier substitution is forbidden.** A Pattern can't substitute for a Composite, and a Composite can't substitute for a Primitive. The tiers exist precisely to prevent this confusion.

**Rule 5: Unauthored components fall back to wireframe-skill's neutral library.** If the system doesn't define `tooltip`, the wireframe-skill uses its built-in neutral tooltip and records the fallback in the output spec.yaml.

## What This Spec Doesn't Try To Do

A few deliberate omissions worth naming:

**No prescription about responsive behavior.** Wireframes are static SVGs at fixed dimensions (375 mobile, 1280 desktop). Responsive design is an implementation concern; the library is a wireframing concern.

**No interaction states beyond what the schema captures.** `variants` includes states like `hover`, `selected`, `disabled`, but the library doesn't model state transitions or animation. One state per SVG.

**No accessibility metadata in this version.** Could be added later as `a11y_notes` per component variant. Out of scope for v0.1 of the library spec.

**No domain-specific components.** No `pricing_card`, `testimonial`, `feature_grid` — those are content patterns, not UI primitives. They get assembled from generic Composites and Patterns when the brief calls for them.

**No mobile-specific patterns.** Things like `bottom_sheet`, `swipe_actions`, `pull_to_refresh` are mobile UX patterns that don't translate cleanly to wireframes. Out of scope for v0.1.

## Authoring Workflow Per System

Adding a system's library against this spec, in order:

**Step 1 — Audit existing artifacts.** Check what's already in the system's React .jsx for components matching the library vocabulary. Many primitives (Button, Input, Card) will already exist in the .jsx and can be extracted to SVG.

**Step 2 — Author all 12 Primitives.** This is required. Most are 30-60 line SVGs; complexity varies by system's grammar.

**Step 3 — Author the Composites the system needs.** Aim for 75% coverage of the 18 Composites. Skip ones that don't apply (Terminal probably doesn't need a `toast` because terminals don't show toasts — they emit log lines).

**Step 4 — Author 3-5 Patterns the system most strongly opines about.** Sidebar, dashboard, and either form, settings_layout, or auth — roughly.

**Step 5 — Run the design-system-skill's `validate_spec` to confirm no missing references and no cycles.**

**Step 6 — Verify renders against the rulebook with `check_compliance`.**

Total per-system scope: authoring 40-70 SVG files (Primitives + Composites + Patterns) against established conventions and the validated spec. The current authoring (one signature component per system) covered 2-3 files; full library scales with grammar complexity.

## Coverage Targets For tkr-kit's Six Systems

Based on each system's grammar and likely use cases:

- **Swiss** — full primitives + most composites + 5 patterns (dashboard, settings_layout, form, data_table, auth). Highest coverage target because it's the most general-purpose. Involves authoring ~70 files.
- **Terminal** — full primitives + most composites (skip `toast`, `banner`) + 4 patterns (dashboard, command_palette, settings_layout, data_table). Skip `article` and `auth` (terminals don't auth, they assume sudo). Involves authoring ~60 files.
- **Editorial** — full primitives + most composites (skip `command_palette`, `data_table`) + 4 patterns (dashboard, article, form, auth). Article is the system's pattern of pride. Involves authoring ~65 files.
- **Sketch** — full primitives + most composites + 4 patterns (dashboard, form, settings_layout, auth). General-purpose like Swiss but with the editorial annotation layer. Involves authoring ~65 files.
- **Prism** — full primitives + most composites + 3 patterns (dashboard, modal, drawer). Atmospheric systems often live in shorter compositions. Involves authoring ~55 files.
- **Revolt** — full primitives + most composites + 3 patterns (dashboard, auth, banner). Y2K-feeling systems often live in expressive moments. Involves authoring ~55 files.
- **Riso** — full primitives + 75% composites + 2 patterns (dashboard, article). Print-style systems are most useful for content-heavy surfaces. Involves authoring ~45 files.

These are targets, not commitments. Authoring against them surfaces the systems' real strengths and gaps.

## Open Questions for v0.2 of the Library Spec

Things this v0.1 doesn't resolve:

**Component-level versioning.** When `card.svg` evolves from v1 to v2, do consumers automatically get the new version? Currently yes (specs are loaded fresh). But what about systems that depend on a specific v1 behavior? Out of scope for now.

**Cross-system shared primitives.** Some components (e.g. icons) are visually identical across many systems. A `shared_assets/` directory would reduce duplication. Deferred — let duplication exist until it's painful enough to justify the resolution complexity.

**Component composition reuse across systems.** If Swiss's dashboard Pattern composes the same way Terminal's does (just with different visual treatment), is there value in factoring out the composition rules? Probably yes, but only after multiple systems have authored the same pattern and we can see the actual overlap.

**Dynamic content sizing.** Real cards/lists/tables have variable content lengths. Wireframes use representative content. Whether the library should expose "compact" vs. "comfortable" vs. "spacious" density variants is open.

## What Comes Next

Two paths after this spec:

**Path A — Build Swiss's full library against this spec.** Validates the structure end-to-end on one system. Produces ~40 SVGs.

**Path B — Build a thin slice (one Primitive, one Composite, one Pattern) for Swiss to test composition.** Produces 3-5 SVGs that exercise the full hierarchy.

I recommend Path B as a test of the spec, then Path A if the slice succeeds.
