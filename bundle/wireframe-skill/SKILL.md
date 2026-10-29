---
name: wireframe
description: Generate wireframe SVGs from a brief, optionally rendered in a specific design system. v3.0 adds design-system-aware generation — invoke with `system=swiss` (or any registered system) to render the wireframe in that grammar. Without a system, falls back to the neutral wireframe library. Use when user wants a wireframe, mockup, screen design, or UI layout.
allowed-tools: [Read, Write, Glob, Grep, Bash]
source: tkr-kit
version: 3.0.0
---

# wireframe-skill (v3.0 — design-system-aware)

> **Layer 1 — Capability.** This is a skill. It encapsulates wireframe generation for a single brief through a deterministic 7-step flow. It does NOT batch-generate across multiple briefs (that's an L3 command's job — see `wireframe-batch` in the production `.claude/commands/`); it does NOT define design systems (that's `design-system-skill`). It does call into `design-system-skill` to load the chosen system's spec — a skill-to-skill call for a single composite capability, not orchestration.

## Composition

| Layer | Component | Status |
|-------|-----------|--------|
| L3 Command | `wireframe-batch` (production v2.0 lives at `.claude/commands/wireframe-batch.md`) | discovers screens from SPEC, fans out wireframe agents, aggregates tracker |
| L2 Agent | `wireframe-agent` (production v2.0 lives at `.claude/agents/wireframe-agent.md`) | wraps this skill with isolation + structured reporting |
| **L1 Skill** | **`wireframe` (this file, v3.0)** | **generates one wireframe SVG + spec.yaml; system-aware** |

This skill is authored in the tkr-design-systems repository and vendored by tkr-kit at `.claude/skills/wireframe-skill/`. The agent and command above keep working across versions because the skill's invocation interface is additive (the `system` parameter is optional).

Generates wireframe SVGs from a brief, optionally rendered in a specific design system. This is the skill end users invoke when they want a wireframe; it is NOT the skill that defines design systems (that's design-system-skill).

## What's New in v3.0

The previous version (v2.0) generated aesthetically-neutral wireframes against built-in templates. v3.0 adds optional design-system conditioning — when invoked with a `system` parameter, the skill loads a system spec via design-system-skill and produces a wireframe rendered in that system's grammar.

The change is additive. Invocations without a `system` parameter behave exactly as v2.0, falling back to the neutral template library. Existing workflows don't break.

The other meaningful change: previews are now rendered through `render_preview.py` (CairoSVG-based) rather than ad-hoc tooling. This matches Chrome/Figma rendering closely so what you see in previews matches what users see when they open the SVG.

## When to Use This Skill

Invoke for any task that produces a wireframe artifact:

- "Wireframe a login screen" — neutral, no system specified
- "Wireframe a Tokyo trip planner dashboard in Swiss" — system-conditioned
- "Wireframe the onboarding flow for a recipe app, in Riso" — system-conditioned, multi-screen
- "Generate alternate wireframes for the same brief in three different systems" — comparative

Do NOT invoke for:

- Generating final UI mockups. Wireframes are structural; mockups are pixel-perfect. Future mockup-skill will handle the latter.
- Editing existing SVG files outside the wireframe context. Use file tools directly.
- Creating component primitives for a design system. That's the design-system authoring workflow under design-system-skill.

## Invocation Interface

```
wireframe(
  brief: str,                          # required: what to wireframe
  platform: "mobile" | "desktop" = "desktop",
  system: str | None = None,           # optional: design system id
  output_dir: path = ".",              # where to write SVG + spec.yaml
  spec_version: str | None = None,     # optional: pin a specific spec version
  filename_stem: str = "wireframe",
  escalate: bool = True,               # off-catalog brief → decomposition request (see Layer 1)
  layout_id: str | None = None,        # explicit pattern; bypasses keyword routing
  request_routing: bool = False,       # return the routing inventory instead of routing
  substitute: bool = False,            # return the substitution request for the chosen pattern
  compose: bool = False,               # return the decomposition request; skip pattern selection
)
```

When `system` is provided:
- The skill calls `design-system-skill.load_system(system)` to fetch the spec.
- The wireframe renders against that system's component library, layout templates, and rulebook.
- The output spec.yaml records which system was applied (id, version, spec_version) for traceability.

When `system` is omitted:
- The skill uses the built-in neutral templates (existing v2.0 behavior).
- The output spec.yaml notes `design_system: null`.

## Subcommands (v3.0+ — two-pass LLM modes)

In addition to the legacy single-shot invocation above, the CLI exposes four subcommands for richer flows. The skill itself never makes outbound LLM calls; instead, it emits a structured request that the calling Claude (in a Claude Code session) fulfills, then accepts the response back. This keeps the skill deterministic and testable while letting the orchestrator supply judgment.

### `substitution-prompt` and `apply-substitutions` (item 9.1)

Replace placeholder text in a chosen pattern SVG with brief-specific content (e.g. "Northwind / Tokyo Trip" → "Calm App / Day 3 Asakusa") while respecting per-system case rules.

```
# Pass 1: emit a JSON request describing the brief and the pattern's text nodes
python3 ${CLAUDE_SKILL_DIR}/scripts/__main__.py substitution-prompt \
  --brief "dashboard for a meditation app" \
  --system swiss \
  --out /tmp/req.json

# Calling Claude reads /tmp/req.json, generates substitutions, and writes:
# /tmp/resp.json:
# {"substitutions": [{"find": "Tokyo Trip", "replace": "Calm App", "rationale": "..."}]}

# Pass 2: apply the response with grammar validation
python3 ${CLAUDE_SKILL_DIR}/scripts/__main__.py apply-substitutions \
  --pattern ${CLAUDE_SKILL_DIR}/../design-system-skill/libraries/swiss-library/layouts/dashboard.svg \
  --substitutions /tmp/resp.json \
  --out /tmp/wireframe.svg
```

Apply enforces grammar invariants: Revolt warns on lowercase replacements; Editorial warns on title-case violations; Terminal warns on non-snake-case identifiers; etc. Replacements happen only inside `<text>` and `<tspan>` content — never inside `<style>` blocks or attribute values.

### `decompose-prompt` and `apply-decomposition` (item 9.2)

For briefs that imply layouts the system hasn't authored (e.g. "kanban board with three columns"), assemble from the system's Primitives + Composites instead of falling back to a pre-authored pattern.

```
# Pass 1: emit a request listing all components in the system catalog
python3 ${CLAUDE_SKILL_DIR}/scripts/__main__.py decompose-prompt \
  --brief "kanban board with three columns" \
  --system swiss \
  --platform desktop \
  --out /tmp/req.json

# Calling Claude reads /tmp/req.json and writes a LayoutBlueprint:
# {"canvas": {"width": 1280, "height": 800},
#  "regions": [{"id": "main", ..., "components": [{"component_id": "card-default", "x": 24, "y": 24}, ...]}]}

# Pass 2: assemble the blueprint into a single composited SVG
python3 ${CLAUDE_SKILL_DIR}/scripts/__main__.py apply-decomposition \
  --blueprint /tmp/resp.json \
  --system swiss \
  --out /tmp/wireframe.svg
```

The assembler reads each referenced component SVG, deduplicates `<defs>` ids across the composition (renaming collisions and updating `url(#id)` and `filter="..."` references in the affected component bodies), wraps each in `<g transform="translate(x,y)">`, and applies system-level `artifact_treatments` (so Riso decompositions still get grain + page background).

Validation rejects: unknown component_ids, components placed outside their region, regions placed outside the canvas. The pre-authored pattern path remains the high-quality default; decomposition is for briefs that need novel composition.

### Choosing a path

| Situation | Use |
|-----------|-----|
| Brief matches a system pattern (`dashboard`, `auth`, `settings-layout`, etc.) | Legacy `--brief` flow (deterministic, fast) |
| Same as above, but you want brief-specific content | `substitution-prompt` + `apply-substitutions` |
| Brief implies a layout the system hasn't authored | `decompose-prompt` + `apply-decomposition` |
| Brief is genuinely off-catalog (carousel, slider, filter chip strip, etc.) | Skill auto-escalates to decomposition; see Layer 1 below |
| You authored a layout *tree* (containers + token-named spacing, no coordinates) | `solve-layout`, then `apply-decomposition` |

### `solve-layout` (layout tree → blueprint)

Pass 1 of the compose flow may author a layout TREE instead of literal x/y integers. `solve-layout` hands the tree to tkr-kit's `design.solve_layout` operation, which reads the spacing scale of the REGISTERED system (`tokens.common.spacing`) and returns positioned regions in exactly the blueprint shape `apply-decomposition` consumes:

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/__main__.py solve-layout --tree tree.json --system swiss --out blueprint.json \
  [--platform desktop | --canvas-width W --canvas-height H] [--scope swiss] [--project DIR] [--allow-overflow]
python3 ${CLAUDE_SKILL_DIR}/scripts/__main__.py apply-decomposition --blueprint blueprint.json --system swiss --out out.svg
```

It needs a tkr-kit CLI: `$TKR_CLI` (the command that runs it), else `tkr` on `PATH`, else a checkout at `$TKR_KIT_HOME` run with `bun`. It refuses (exit 1, blueprint not written) when the solved layout does not fit its artboard; `--allow-overflow` writes it with the overflows as warnings.


## Layer 1 — Router escalation (Phase B)

By default, when the keyword router doesn't match AND none of the brief's nouns name one of the system's **authored layout patterns**, `select_layout_pattern` returns an `EscalateToDecomposition` sentinel instead of silently degrading to the dashboard fallback. `wireframe()` surfaces this as:

```python
result.requires_orchestrator_pass = True
result.pass_request = { ... a complete decomposition request payload ... }
result.escalation_reason = "no keyword pattern matched and brief nouns ..."
result.ok = False  # by convention — the skill didn't produce an SVG
```

The orchestrator (`/wireframe-compose`) is expected to detect this branch and run the two-pass decomposition flow. `/wireframe-batch` handles it too, reporting the pair as `🔀` and saving the pass request. The single-shot CLI exits with code 2 and a stderr message in this case.

To preserve the legacy "dashboard fallback on miss" behavior on a specific call, pass `escalate=False` (Python API) or `--no-escalate` (CLI).

**The overlap test considers layout-pattern names only — never the component catalog.** Components are the raw material of every screen, so a brief mentioning "card" or "filter" says nothing about whether the system has authored that *screen*. Testing against them (by bidirectional substring, against 190+ names) made escalation effectively unreachable: `"board"` matched `dashboard`, so `"kanban board with three columns"` silently rendered as a dashboard. Variant suffixes and generic structural words (`single`, `column`, `narrow`, `default`) are stripped, so what remains is the set of terms naming a screen genre the system actually authored.

A corollary: when a brief *does* name an authored pattern that no keyword rule covers (revolt's `banner-promotional`), the router selects that pattern rather than falling through to `DEFAULT_PATTERN_FALLBACK`.

## Agent-driven layout routing

The keyword heuristic is a deterministic default, not the only router. When the brief is ambiguous — or when the calling agent wants to own the routing decision — use the two-call agent-driven flow instead:

```python
# Pass 1 — ask for the inventory instead of a heuristic guess.
result = wireframe(brief, system="swiss", request_routing=True)
result.routing_request  # {available_patterns, available_components,
                        #  canvas, grammar_caveats, instructions, ...}

# The agent reviews the inventory and decides, then:
# Pass 2a — a pattern fits: call again with the explicit choice.
result = wireframe(brief, system="swiss", layout_id="data-table")

# Pass 2b — nothing fits: run the decomposition flow (item 9.2 / atoms),
# or ask for the decomposition request directly:
result = wireframe(brief, system="swiss", compose=True)
result.decomposition_request
```

The MCP server's `wf_generate` is agent-driven by default: without `layout_id` or `compose` it returns the routing inventory (it passes `request_routing=True`). The Python API and CLI default to the keyword router above.

`substitute=True` stops after pattern selection and returns `substitution_request` (the `substitution-prompt` payload) for the chosen pattern instead of emitting files.

Module-level pieces (also exported from `wireframe_skill`):

- `build_layout_selection_request(brief, spec, platform)` — pattern inventory with descriptions, canvas, and grammar caveats for the agent.
- `apply_layout_selection({selected_pattern_id, rationale}, spec, platform)` — turns the agent's choice into a `LayoutSelection`; returns `None` if the pattern doesn't exist.
- `select_layout_pattern(..., select_mode=...)` — `"heuristic"` (default), `"exact"` (match only patterns explicitly named in the brief), `"auto"`/`"request"` (always return `None`, deferring to the agent).

`layout_id` always wins over the heuristic, and an unknown `layout_id` fails cleanly with `ok=False` rather than silently re-routing.

## Atom regions in blueprints (Phase C, v3.1)

When the decomposition flow needs to express a component the system catalog doesn't contain (e.g. a carousel in a system that hasn't authored one), regions may declare an `atoms` array instead of `components`. Each atom is rendered directly to SVG with all paint, type, spacing, stroke, and radius values resolved from the system's `tokens.common.*` subtree via the common-tokens.v1 contract.

**Atom types (v1):** `rect`, `text`, `line`, `circle`, `image_placeholder`, `group`.

**Reference syntax:**

| form               | resolves through                          | scope            |
|--------------------|-------------------------------------------|------------------|
| `$ink`             | `tokens.common.color.ink`                 | portable         |
| `$color.ink`       | same, explicit form                       | portable         |
| `$type.headline`   | `tokens.common.typography.headline`       | portable         |
| `$space.md`        | `tokens.common.spacing.md`                | portable         |
| `$stroke.regular`  | `tokens.common.stroke.regular`            | portable         |
| `$radius.full`     | `tokens.common.radius.full`               | portable         |
| `swiss:grid.columns` | `tokens.system.grid.columns`            | system-locked, requires `blueprint.scope == "swiss"` |

**Example region:**

```yaml
- id: hero
  x: 0
  y: 0
  w: 1280
  h: 480
  atoms:
    - { type: rect, x: 0, y: 0, w: 1280, h: 480, fill: $surface-inset }
    - { type: image_placeholder, x: 48, y: 48, w: 1184, h: 320 }
    - { type: text, x: 48, y: 410, value: "Featured trips", style: $type.headline, fill: $ink }
    - { type: group, x: 48, y: 460,
        atoms: [{ type: circle, cx: 0, cy: 0, r: 4, fill: $ink-muted }],
        repeat: 5, gap: 16, direction: horizontal }
```

**Rules enforced by `validate_blueprint`:**

- Atom types must be in the whitelist.
- Required fields per type must be present (see `_ATOM_FIELDS` in `decomposition.py`).
- Paint references must be `$tokens` — raw hex `#fff` is rejected.
- Text styles must reference `$type.<role>` and resolve to a text-style dict.
- A region declares EITHER `atoms` or `components`, not both.
- In portable scope (no `blueprint.scope`), `<system_id>:<...>` refs are rejected.
- Group atoms support `repeat` + `gap` for chip strips / slide indicators.

The decomposition request emitted by `build_decomposition_request` now includes an `atom_vocabulary` block alongside the existing `components` catalog. The LLM authoring a blueprint can choose component placements where they exist OR fall back to atoms for novel composition.

## Decision Guide

> The tables and lists in this section are generated from `../design-system-skill/libraries/registry.yaml`, each system's `spec.yaml`, `tokens.json` and library, `../design-system-skill/references/LIBRARY-SPEC.md` and `https://github.com/TuckerTucker/tkr-design-systems/blob/main/tools/docs/guidance.yaml` by `https://github.com/TuckerTucker/tkr-design-systems/blob/main/tools/docs/generate.py` in the tkr-design-systems repository. CI fails when they are stale. Change the sources, then regenerate; don't edit between the markers.

### Which system

The user picks the system; the skill applies it. The table says what each registered system is for, from its spec. When no system is named, use `wireframe` (the default); `neutral` is the same library under another id.

<!-- generated:which-system -->
| System | Intent | Grammar | Suits | Components / layouts | Rules |
|--------|--------|---------|-------|----------------------|-------|
| `wireframe` Wireframe | Neutral Greyscale Reference Library (showcase: Greyscale Wireframe Reference) | `wireframe` | Structure before a visual language is chosen. The default when the user names no system, and the fallback library for components another system has not authored. | 100 / 53 | 12 |
| `swiss` Swiss | Grid + Grotesk + Single Saturated Accent (showcase: Grid-strict + Rams Heritage) | `contemporary_clean` | General-purpose product UI: dashboards, settings, forms, data tables, sign-in. Dense information where hierarchy comes from type and grid, with one accent. | 71 / 12 | 14 |
| `terminal` Terminal | CLI + Phosphor Heritage | `character_grid` | Developer tools, logs, monitoring and command palettes; keyboard-first surfaces. Not long-form reading or consumer sign-in. | 53 / 4 | 8 |
| `editorial` Editorial | Long-form Serif + Newsprint Masthead | `contemporary_clean` | Long-form reading: articles, briefings, newsletters, transcripts. The article pattern is its strength. | 73 / 5 | 9 |
| `sketch` Sketch | Linear + Hand-Drawn | `contemporary_clean` | Early product UI that carries an annotation layer: design reviews, onboarding, explained flows. | 91 / 4 | 6 |
| `prism` Prism | Liquid Glass + Bento | `contemporary_clean` | Atmospheric, short compositions: dashboards, modals, drawers. Built for HTML/CSS; its SVG glass is an approximation for layout review only. | 56 / 4 | 6 |
| `revolt` Revolt | Neobrutalist + Y2K | `contemporary_clean` | Expressive, loud moments: launches, campaigns, banners, playful sign-in. | 57 / 3 | 9 |
| `riso` Riso | Duotone Print + Tweakable Press | `print_texture` | Content-heavy, print-flavoured surfaces: zines, features, articles, with parametric ink and paper presets. | 2 / 0 | 20 |
| `neutral` | Alias of `wireframe`: same spec and library. |  |  |  |  |
<!-- /generated:which-system -->

### Which component

Pick by the job, not by habit. Component ids and variants are the LIBRARY-SPEC vocabulary; a system that has not authored one falls back to the neutral library (LIBRARY-SPEC composition rule 5). The *Not* column is what the project's UX policies (`claude.md`) rule out.

<!-- generated:which-component -->
| Job | Use | Not | Why |
|-----|-----|-----|-----|
| Status that persists (sync failed, offline, plan expiring) | `banner` | `toast` | NO toast notifications: a toast forces a context switch and is gone before it is read. A banner stays in place until the condition clears. |
| Result of one action (saved, sent, failed to send) | `badge` (`status`) | `toast`, `modal` | Status and errors appear contextual to the action: mark the item that was acted on, in place. |
| Destructive action (delete, archive, remove) | `button` (`destructive`), `undo_row`, `banner` | `modal` | NO "Are you sure?" dialogs: act immediately and offer undo (the undo_row pattern holds the vacated row open with an Undo action until it settles), so responsibility is not shifted to the user. The ux-no-confirm-dialog-without-undo rulebook check reports a confirmation dialog with no undo. |
| List or table under 100 items | `list_item`, `data_table` (`default`), `search_bar` | `pagination`, `data_table` (`with_pagination`) | NO pagination for small datasets: show every row; filter with search instead of making the user page. |
| Required and optional form fields | `label` (`required`), `label` (`optional`) | `label` (`default`) | NO required fields without indication: an unmarked required field is an error discovered after the fact. |
| Invalid input | `form_field` (`with_error`) | `modal`, `toast` | Validate inline as they type and show how to fix it, in place; constrain inputs so invalid states are impossible where you can. |
| Action that is not available yet | `button` | — | Render it in its disabled state, not hidden; a tooltip says what is required to enable it. Disable instead of erroring after the fact. |
| Edit a value or a setting | `input`, `toggle`, `settings_layout` | `modal` (`form_modal`) | Edit in place, not in modals; keep context visible during the operation. |
| On/off setting that applies immediately | `toggle` | `checkbox` | LIBRARY-SPEC: toggle is the settings-context boolean; checkbox is for multiple-select context or a form that is submitted. |
| Advanced or secondary detail | `accordion_item`, `drawer` | `modal` | Progressive disclosure: basics first, reveal on demand without leaving the page. |
| Missing, empty, failed or denied content | `empty_state` (`no_data`), `empty_state` (`no_results`), `empty_state` (`first_use`), `empty_state` (`error`) | — | Never a blank region. Edge cases are first-class deliverables (wireframe-edge-cases-first-class) and say what went wrong and how to fix it. |
| A count or metric that matters | `stat` | `badge` (`count`) | Numbers carry meaning as display type (swiss-numerical-display); Swiss forbids count badges outright. |
| Identity of a person or thread | `avatar` (`monogram`), `avatar` (`index`), `avatar` (`none`) | `avatar` (`emoji`), `avatar` (`photo`) | Follow the system's avatar_strategy; emoji are banned (ADR-0001) and photos are content, not structure. |
<!-- /generated:which-component -->

### Rules agents get wrong

The violations that recur, each with the rule or decision behind it.

<!-- generated:rules-agents-get-wrong -->
| Wrong | Why | Source |
|-------|-----|--------|
| Spacing of 12px or 20px in Swiss | Every Swiss spacing value is a multiple of 8; off-grid breaks the rhythm. | `swiss-grid-alignment` |
| A fifth red mark in Swiss, or an error set in red | Red is finite: CTA, selection bar, identity tag, status dot, at most four per screen. Swiss danger reuses that red (hue-gate waiver), so an error is ink copy reading "Error: what failed." with no icon, badge, fill or border change. | `swiss-red-finite-resource`, `swiss-error-not-red`, `swiss-error-typographic`, [0002-accent-danger-hue-gate.md](https://github.com/TuckerTucker/tkr-design-systems/blob/main/docs/adr/0002-accent-danger-hue-gate.md) |
| An error in Revolt shown only by a new colour | Revolt's five colours are fixed; an error is labelled with the uppercase ERROR status pill, not recoloured. | `revolt-error-status` |
| Emoji in an avatar, label, status or decoration | Emoji depend on system fonts and degrade silently in CairoSVG. Identity uses the system's avatar_strategy; functional icons come from Lucide. | `swiss-no-emoji-imagery`, `riso-no-emoji`, [0001-lucide-as-icon-source.md](https://github.com/TuckerTucker/tkr-design-systems/blob/main/docs/adr/0001-lucide-as-icon-source.md) |
| A font size between steps (12px in Swiss, 15px in the wireframe library) | Each system has a fixed type scale; nudge to the nearest allowed size (sizes per system below). | `swiss-fixed-type-scale`, `wireframe-type-scale-discipline` |
| A colour literal instead of a token (a hex in a template, an off-palette fill) | tokens.json is canonical. Read colours through the token file (wf_get_tokens); the drift check flags literals the file does not produce, and the rulebook flags off-palette fills. | [TOKENS.md](../design-system-skill/references/TOKENS.md), `wireframe-palette-discipline` |
| An unescaped < or > in SVG text, such as `[ < prev ]` | The SVG is no longer well-formed XML and the rulebook check aborts. Write `&lt;` and `&gt;`. | `xml-well-formed` |
| A double hyphen inside an SVG comment | XML forbids `--` inside a comment body; the file will not parse. | `wireframe-no-double-hyphens-in-comments` |
| An animation with no tier, or one that ignores reduced motion | Every animation names a motion tier and a reduced behaviour within the system's reduced_motion policy; keep is not allowed on anything that moves. | [SCHEMA-V0.3.md](../design-system-skill/references/SCHEMA-V0.3.md#motion) |
| Rounded corners or soft shadows in Swiss, Terminal or Revolt | Radius is 0 in all three. Swiss and Terminal use no shadows; Revolt's only shadow is the hard 4px 4px 0 offset. | `swiss-zero-radius`, `swiss-no-shadows`, `terminal-no-radius`, `revolt-hard-shadows-only` |
| A pure white page in Editorial or Sketch | Both pages are warm paper; white is reserved for deliberate emphasis. | `editorial-paper-bg-required`, `sketch-warm-paper-bg` |
| Status shown twice (a red border and a red badge on one card) | One status, one visual channel; doubling it adds noise, not meaning. | `wireframe-one-channel-per-message` |
| Selection shown with a background fill in Terminal | Terminal selects by changing characters (' ' to '>') and colour, never by fill. | `terminal-selection-via-character` |
| A third ink in Riso | Exactly two inks per artifact from one press preset; neutrals come from the paper. | `riso-two-inks-only`, `riso-paper-is-the-neutral` |
| A toast for status, an "Are you sure?" dialog before deleting, or a required field with no marker | Use a banner or inline status, and undo (the undo_row pattern). Mark every required field. The rulebook reports a placed toast, a confirmation dialog without undo, and an unmarked required label in every system. See the Which component table. | [claude.md](https://github.com/TuckerTucker/tkr-design-systems/blob/main/claude.md), `ux-no-toast-notifications`, `ux-no-confirm-dialog-without-undo`, `ux-required-fields-indicated` |
<!-- /generated:rules-agents-get-wrong -->

### Rules per system

The first sentence of every rulebook entry, with its severity and check method. `design-system-skill.get_rulebook(system)` returns the full rule, rationale and scope; step 6 below checks the mechanical ones. The tokens line is read from the system's `tokens.json` (default mode).

<!-- generated:system-rules -->
#### Wireframe (`wireframe`, alias `neutral`)

Tokens: spacing 4, 8, 12, 16, 20, 24, 32, 40, 48, 64; type sizes 11, 12, 13, 14, 16, 18, 24; radius 6; accent `#424242`; reduced motion `fade`; default mode.

- `wireframe-mobile-first` (required, semantic): Every wireframe is authored at mobile (375px) first, then desktop (1280px) is created as an EXPANSION of mobile.
- `wireframe-cards-universal-container` (recommended, semantic): Distinct content (anything with a boundary, title, and related data) is presented in a card.
- `wireframe-one-channel-per-message` (required, semantic): Status is communicated through ONE visual channel, not multiple simultaneously.
- `wireframe-comments-for-intent` (required, semantic): SVG comments explain INTENT (why this element, what role does it play), not appearance (what color, what dimensions).
- `wireframe-consistency-over-creativity` (required, semantic): Every card looks like every other card.
- `wireframe-edge-cases-first-class` (required, semantic): Empty state, error state, loading state, and permission-denied state are required deliverables alongside the populated state.
- `wireframe-verify-dont-assume` (required, mechanical): After creating wireframes, verify them: file exists with non-trivial content, viewBox matches dimensions, all colors come from the palette, all sizes from the type scale, all spacing from the grid.
- `wireframe-palette-discipline` (required, mechanical): Every fill and stroke value is one of the 12 palette colors (7 greyscale + 4 semantic + inverse white).
- `wireframe-type-scale-discipline` (required, mechanical): Every font-size is one of the 7 scale values (11, 12, 13, 14, 16, 18, 24).
- `wireframe-no-double-hyphens-in-comments` (required, mechanical): SVG comments NEVER contain '--' (double hyphens).
- `wireframe-css-classes-not-inline-fills` (required, mechanical): Text element fills MUST use CSS classes (text-primary, text-secondary, text-disabled, text-inverse) defined in `<defs><style>`, not inline fill attributes.
- `wireframe-mobile-desktop-pair` (required, mechanical): Every wireframe screen is delivered as a (mobile.svg, desktop.svg) pair.

#### Swiss (`swiss`)

Tokens: spacing 8, 16, 24, 32, 40, 48, 64; type sizes 9, 11, 13, 14, 22, 32, 40; radius 0; accent `#E3000B`; reduced motion `none`.

- `swiss-red-finite-resource` (required, mechanical): Red (#E3000B) is bounded above by 4 usages per screen.
- `swiss-grid-alignment` (required, both): All spacing values are multiples of 8 (8, 16, 24, 32, 40, 48, 64).
- `swiss-zero-radius` (required, mechanical): border-radius is 0 on every element.
- `swiss-no-shadows` (required, mechanical): box-shadow is never used.
- `swiss-numerical-display` (required, semantic): Numerical values (counts, indices, metrics) are rendered as display type (22px–40px) when they're meaningful information.
- `swiss-zero-padded-indices` (required, semantic): List item indices are zero-padded to 2 digits (01, 02, ..., 99). 3-digit lists pad to 3 (001, 002).
- `swiss-fixed-type-scale` (required, mechanical): Only 7 type sizes are permitted: 9, 11, 13, 14, 22, 32, 40.
- `swiss-single-typeface` (required, mechanical): Inter is the only typeface.
- `swiss-metadata-uppercase` (required, mechanical): All metadata (timestamps, labels, captions) is rendered uppercase, 9px Inter, tracked 0.16em, color #666.
- `swiss-no-emoji-imagery` (required, semantic): No emoji avatars, no decorative imagery, no illustrations.
- `swiss-error-prefix` (required, mechanical): Error copy reads 'Error: `<what failed>`.' — the prefix 'Error:' with a capital E and a colon, a space, the failure, and a closing period (JSX voice table: 'Error: send failed.').
- `swiss-error-not-red` (required, mechanical): Text beginning 'Error:' is set in ink (color.text_primary), never in the accent red.
- `swiss-warning-not-red` (required, mechanical): Warnings are typographic, like errors: the severity label is grey and the message ink; neither is red.
- `swiss-error-typographic` (required, semantic): Error states are carried by copy and type alone: no icon, glyph, shape, badge, pill, fill, coloured or thickened border, and no ● (the red ● is the active-status dot).

#### Terminal (`terminal`)

Tokens: spacing 4, 8, 12, 14, 16, 20, 24, 32, 40, 48, 64; type sizes 9, 10, 11, 12, 14; radius 0; accent `#00FF66`; reduced motion `none`.

- `terminal-monospace-only` (required, mechanical): Every text element uses JetBrains Mono (or another monospace fallback).
- `terminal-no-radius` (required, mechanical): border-radius is 0 on every element.
- `terminal-no-shadows` (required, mechanical): box-shadow is never used.
- `terminal-prompt-style-labels` (required, semantic): Section headers use prompt-style or comment-style prefixes: `$ command`, `// comment`, `> path`, or `[n]` for enumerated items.
- `terminal-color-as-signal` (required, both): Color usage is diagnostic, never decorative.
- `terminal-box-drawing-borders` (required, semantic): Structural borders should use ASCII/Unicode box-drawing characters (┌─┐│└─┘) where possible, falling back to 1px dashed #1F2F1F lines.
- `terminal-selection-via-character` (required, mechanical): Selection is signaled by changing characters (e.g. ' ' → '>') and color shifts, NEVER by adding a background fill or accent bar.
- `terminal-snake-case-names` (recommended, semantic): Object names (sessions, files, identifiers) are lowercase_snake_case to feel terminal-native.

#### Editorial (`editorial`)

Tokens: spacing 4, 8, 10, 12, 16, 18, 20, 24, 32, 40, 48, 64; type sizes 8.5, 9, 12, 13, 15, 18, 24, 54; radius 0; accent `#8B1E2D`; reduced motion `fade`.

- `editorial-typeface-boundary` (required, mechanical): Fraunces and Inter never appear on the same line.
- `editorial-paper-bg-required` (required, mechanical): Page background is #F8F4EC (warm cream paper), not pure white.
- `editorial-no-shadows` (required, mechanical): box-shadow is never used.
- `editorial-rules-not-boxes` (required, mechanical): Sections are separated by horizontal rules, not by boxed containers with borders.
- `editorial-tracked-metadata` (required, mechanical): All metadata (timestamps, overlines, bylines, section labels, dispatch headers) is rendered uppercase Inter at 8.5–9px with 0.16em–0.20em letter-spacing.
- `editorial-drop-cap-ceremony` (required, semantic): Drop caps are reserved for the FIRST AI message in a conversation, never elsewhere. 54px Fraunces weight 700 in burgundy, float-left, with body text wrapping for 3 lines.
- `editorial-no-bubbles` (required, both): Messages are NOT enclosed in chat bubbles.
- `editorial-burgundy-discipline` (required, both): Burgundy (#8B1E2D) is used in: dispatch overlines, drop caps, unread 'N new' markers, masthead double rule, and the user-message left rule.
- `editorial-no-emoji-imagery` (required, mechanical): No emoji glyphs anywhere in any artifact (avatar slots, decorative annotations, status indicators).

#### Sketch (`sketch`)

Tokens: spacing 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32; type sizes 10, 11, 13, 13.5, 17, 18; radius 10; accent `#7C6E8B`; reduced motion `fade`; default mode.

- `sketch-purple-on-annotations-only` (required, both): Purple (#7F718E) is used on Caveat annotation elements and unread badges.
- `sketch-no-shadows` (required, mechanical): box-shadow is never used.
- `sketch-typeface-roles` (required, both): IBM Plex Sans for all structural text.
- `sketch-rounded-not-pilled` (required, mechanical): Rounded corners use 8–14px radius.
- `sketch-warm-paper-bg` (required, mechanical): Page background is the theme's warm paper: #FAFAF8 (light, default) or #211F1C (dark).
- `sketch-no-emoji-imagery` (required, mechanical): No emoji glyphs anywhere in any artifact (avatar slots, decorative annotations, category labels).

#### Prism (`prism`)

Tokens: spacing 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32; type sizes 10, 11, 13, 13.5, 16; radius 12; accent `#9CFFDD`; reduced motion `fade`.

- `prism-glass-elevation` (required, mechanical): All elevated surfaces use semi-transparent glass: rgba(255,255,255,0.08) base with 1px rgba(255,255,255,0.12) border.
- `prism-no-shadows` (required, mechanical): box-shadow is never used.
- `prism-gradient-bg-required` (required, mechanical): The page background is the multi-stop gradient (150deg, #4A5D6B → #5A4A5E → #6B5A5A → #4A6058).
- `prism-teal-as-signal` (required, both): Teal is reserved for online indicators, unread badges, and other status signals (accent #9CFFDD for teal text and numerals on glass; #7DDFBE for status fills, dots and the focus ring).
- `prism-minimal-metadata` (required, semantic): Timestamps, sender labels, and other metadata are minimized.
- `prism-no-emoji-imagery` (required, mechanical): No emoji glyphs anywhere in any artifact (avatar slots, decorative annotations, status indicators).

#### Revolt (`revolt`)

Tokens: spacing 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32; type sizes 8, 9, 10, 11.5, 12, 14; radius 0; accent `#FF3366`; reduced motion `none`.

- `revolt-no-radius` (required, mechanical): border-radius is 0 on every element.
- `revolt-hard-shadows-only` (required, mechanical): All box-shadows are 4px 4px 0 #111 — zero blur, exact offset.
- `revolt-2px-borders` (required, mechanical): Default borders are 2px solid #111.
- `revolt-monospace-uppercase` (required, both): All metadata, names, and labels are uppercase Space Mono with letter-spacing 0.04–0.08em.
- `revolt-color-pairing` (required, both): Pink (#FF3366) and lime (#C8FF00) are paired accent colors.
- `revolt-code-style-timestamps` (required, semantic): Message timestamps follow the format `{SENDER} // 00:N` (e.g. YOU // 00:1, BOT // 00:2).
- `revolt-no-emoji-imagery` (required, mechanical): No emoji glyphs anywhere in any artifact (avatar slots, decorative annotations).
- `revolt-error-status` (required, both): An error is labelled, not recoloured: it carries the uppercase status label ERROR (JSX Status Pills variants LIVE / TYPING / OFFLINE / ERROR) in a rectangular bordered pill: 2px solid border, padding 2px 8px, 9px/700 Space Mono uppercase, radius 0.
- `revolt-pink-not-text` (required, mechanical): Pink (#FF3366, color.accent, reused as color.danger) is a fill, never a text colour.

#### Riso (`riso`)

Tokens: spacing 6, 8, 10, 12, 14, 16, 18, 20, 22, 24; type sizes 8.5, 9, 11, 14, 16, 28, 30; radius 0; accent `#960061`; reduced motion `none`; default mode.

- `riso-two-inks-only` (required, semantic): Exactly two inks are active per artifact, drawn from one press_presets.ink pair.
- `riso-paper-is-the-neutral` (required, mechanical): Grays, neutrals, and backgrounds come from the paper color.
- `riso-paper-preset-atomic` (required, mechanical): Paper is selected as a whole preset — color, blend mode, density, and text ink change together.
- `riso-no-shadows` (required, mechanical): No box-shadow, no filter: drop-shadow, no text-shadow — ever.
- `riso-grain-once-at-root` (required, mechanical): Exactly one grain layer, applied at the theme root above all content (z-index 100, mix-blend-mode: overlay).
- `riso-duotone-display-only` (required, mechanical): DuotoneText applies only to type at 16px and above.
- `riso-metadata-is-inktag` (required, mechanical): All metadata — timestamps, indices, section labels, sender tags, counts — uses JetBrains Mono uppercase at 0.14-0.16em tracking, 11px or below, and never receives a duotone ghost.
- `riso-halftone-is-gradient` (required, mechanical): Halftone is a rotated radial-gradient dot field inside an oversized (inset: -50%) clipping container — not noise, not a texture image.
- `riso-halftone-not-full-page` (required, semantic): Halftone appears as explicit strips and blocks.
- `riso-registration-not-on-controls` (required, mechanical): Registration offset applies to ghost layers of display type and images only — never to icons, buttons, inputs, or other interactive elements.
- `riso-selection-is-text-treatment` (required, mechanical): Selection is signalled by the title gaining its duotone ghost plus a paper darkening at most rgba(0,0,0,0.03).
- `riso-srgb-filters` (required, mechanical): All feColorMatrix filters declare color-interpolation-filters="sRGB".
- `riso-scoped-filter-ids` (required, mechanical): Filter ids are scoped per theme instance, never global constants.
- `riso-images-wrapped` (required, mechanical): Every raster image passes through RisoImage (primary duotone + offset ghost + halftone overlay).
- `riso-ink2-not-body` (required, mechanical): The ink-2 drum colour is never used for text (on cream it measures 2.69:1).
- `riso-bleed-ceiling` (required, mechanical): Ink bleed on body copy is 0.4x the global bleed value and must not exceed 0.8px effective blur.
- `riso-no-emoji` (required, mechanical): No emoji in any copy, label, or avatar slot.
- `riso-print-vocabulary` (recommended, semantic): UI copy uses printing verbs (compose, file, print, reprint, edition, issue) rather than chat-app verbs (send, submit, post, ping).
- `riso-sentence-case` (recommended, mechanical): Headlines and UI chrome are sentence case.
- `riso-no-dissolve` (recommended, mechanical): State transitions cut.
<!-- /generated:system-rules -->

## Generation Flow

The skill follows seven steps when generating a system-aware wireframe. The first six produce the SVG; the seventh validates and emits.

### 1. Load and validate the system spec

Call `design-system-skill.load_system(system)`. Receive a structured spec object (tokens, components, layout templates, rulebook, grammar extensions, plus `_meta` with version info).

If load fails, surface the error and stop. The skill does not silently fall back to neutral templates — explicit system invocation is a contract.

### 2. Interpret the brief into a layout archetype

Map the brief to one of the system's defined `layout_templates`. The mapping is heuristic: "login" / "sign in" / "auth" → login template; "dashboard" / "overview" / "home" → dashboard; etc.

If the brief implies an archetype the system doesn't have a template for, pick the closest available and record the gap in spec.yaml. This gap is a signal to the system's author that template coverage should be extended.

### 3. Decompose the brief into component placements

For each region of the chosen layout template (sidebar, main, header, footer, etc.), determine which components belong there and in what arrangement. The brief drives content decisions; the system spec drives form decisions.

This step uses model judgment — there's no deterministic mapping from "a list of recipes" to specific component variants. The skill picks variants that fit the content and respects the system's constraints.

### 4. Resolve components to SVG fragments and apply tokens

For each placed component, resolve its SVG file from the system's library (paths come pre-resolved in the spec object from step 1). Substitute placeholder values with brief-derived content (real labels, real timestamps, real counts).

Token references in component SVGs (e.g. fill="ref:colors.accent") are resolved to actual values from the system's tokens block.

For typography, em-based tracking values are converted to SVG letter-spacing using the `tracking_conversion.py` module. The conversion factor is per-typeface; the skill checks `tracking_conversion.report_calibration_status()` before generation and warns if any typeface used in the wireframe has not been verified for the target renderer.

#### Text fitting (REQUIRED for every text element)

SVG `<text>` does not auto-wrap. Every string emitted must fit within the horizontal space available to its container. Before writing any `<text>` element:

1. **Identify the available width.** This is the parent container's width (card, sidebar, region) minus the text's left offset minus the right padding. For a 343px-wide mobile card with 16px inner padding and text starting at x=16, available width is `343 - 16 - 16 = 311px`.

2. **Compute the character budget.** Use the per-typeface glyph-width ratio (mirrors `_GLYPH_WIDTH_RATIO` in `rulebook_check.py`):

   | Typeface family | Ratio (× font-size = avg glyph width) |
   |-----------------|---------------------------------------|
   | Inter, Outfit   | 0.52 |
   | IBM Plex Sans, Space Grotesk, default proportional | 0.55 |
   | Fraunces (serif) | 0.50 |
   | JetBrains Mono, monospace | 0.60 |
   | Space Mono | 0.62 |
   | Caveat | 0.45 |

   `max_chars = floor(available_width / (font_size * ratio))`

   Example: 311px available, 12px Inter → `floor(311 / (12 × 0.52)) = floor(49.8) = 49 chars`.

3. **Constrain the content.** Author the string to fit the budget. If the natural content is longer:
   - Prefer rewriting (shorter labels, fewer modifiers, abbreviated nouns)
   - Truncate with a trailing `…` (single character) only when the content is genuinely user-data — count the ellipsis against the budget
   - Split into multiple `<text>` elements with stacked `y` offsets when the layout permits a second line
   - Never let text run past its container — even if the run-off is hidden by clipping in some renderers, others (and the rulebook check) will flag it

4. **`text-anchor="middle"` and `text-anchor="end"`** position differently. For middle-anchored text, the budget is the smaller of `(x - container_left)` and `(container_right - x)`, doubled. For end-anchored text, the budget is `x - container_left`.

5. **Mobile (375px viewport) is the tightest constraint.** Card descriptions, list-item previews, and metadata strings are the most frequent overflow sources. Author them first, then let desktop versions inherit or expand.

This budget calculation is also what the `text-overflow` rulebook check enforces in step 6 — if you respect the budget here, the check passes.

### 5. Apply artifact-level treatments (NEW in v3.0, important for filter-based systems)

Some systems (notably print_texture systems like Riso, future spatial systems) require treatments that apply to the WHOLE artifact, not per-component. Examples:

- Riso's grain overlay (single feTurbulence layer over everything)
- Riso's paper-tinted background fill (applied to the artifact-level rect, not each component)
- Future: Spatial's depth shadow layer

After all components are composed into the artifact, the skill consults the system spec's `grammar_extensions` for any artifact-level treatments and applies them as a final layer. This is critical — applying these per-component creates visual seams.

For systems without artifact-level treatments (Swiss, Editorial, contemporary-clean systems generally), this step is a no-op.

### 6. Pre-emit rulebook compliance check

Run the system's rulebook against the in-progress artifact. The check distinguishes mechanical rules (color palette membership, type scale, no shadows, etc.) from semantic rules (Swiss's "red used in 4 places per screen" — semantic because it requires knowing which uses count).

Mechanical failures get fixed automatically — if a color outside the palette appears, find and remap it. Type-scale violations get nudged to the nearest allowed size.

Semantic failures invoke the skill's judgment: re-read the rule, look at the artifact, decide whether to fix or whether the apparent failure is actually compliant for a reason the mechanical check can't see. If unfixable, surface the failure in the output spec.yaml's compliance block but still emit the SVG (with the failure documented).

Required-severity rules block emit if unfixable. Recommended and advisory rules emit with a warning.

### 7. Emit SVG and spec.yaml

Write two files to the output directory:

- `wireframe.svg` — the artifact at the platform's standard dimensions (375×812 mobile or 1280×800 desktop)
- `wireframe.spec.yaml` — structured metadata about what was generated

The spec.yaml has a `design_system` block recording which system was applied:

```yaml
design_system:
  id: swiss
  spec_version: "0.1"
  system_version: "1.0.0"
  layout_template_used: dashboard
  components_used:
    - { id: nav.sidebar, variant: default }
    - { id: list_item, variant: selected }
    - { id: list_item, variant: default }
    - { id: button, variant: primary }
  rulebook_compliance:
    checked: 10
    mechanical_passed: 8
    mechanical_failed: 0
    semantic_passed: 2
    semantic_failed: 0
    advisory_warnings: 1
  artifact_treatments_applied: []  # for Swiss; would list grain etc. for Riso
```

After emit, optionally render a preview PNG via `render_preview.py` if the user's workflow expects one.

## Output Contract

> This contract is the interface between layers. If an L2 agent wraps this skill, it parses these formats to build its report. The L3 `wireframe-batch` command aggregates many of these. Do not change this format without updating the corresponding agent / command.

The skill returns a `GenerationResult` (Python dataclass; CLI shim emits JSON) and writes two files to the output directory.

### Returned object

```json
{
  "ok": true | false,
  "svg_path": "<absolute path to wireframe.svg>" | null,
  "spec_path": "<absolute path to wireframe.spec.yaml>" | null,
  "errors": [ "<message>", ... ],
  "warnings": [ "<message>", ... ],
  "compliance_summary": {
    "passed": <int>,
    "failed": <int>,
    "advisory": <int>
  } | null,
  "selection": {
    "pattern_id": "<chosen pattern variant>",
    "base_pattern": "<base pattern, e.g. dashboard>",
    "fallback": <bool>,
    "rationale": "<why this pattern matched>"
  } | null,
  "system_id": "<system actually used>" | null,
  "requires_orchestrator_pass": <bool>,          // true on escalation (see Layer 1)
  "pass_request": { ... } | null,                // decomposition request when escalated
  "escalation_reason": "<why the brief is off-catalog>" | null,
  "routing_request": { ... } | null,             // request_routing=True
  "substitution_request": { ... } | null,        // substitute=True
  "decomposition_request": { ... } | null        // compose=True
}
```

`ok` is false when (a) the system is not in the registry, (b) the platform is invalid, (c) the chosen system has no patterns, or (d) the rulebook compliance check found mechanical failures of required-severity rules. The SVG + spec.yaml are still written in case (d) so the user can inspect what failed; in cases (a)–(c) no files are written.

### Files written to `output_dir`

```
<output_dir>/
  <filename_stem>.svg          # the wireframe at the platform's standard dimensions
  <filename_stem>.spec.yaml    # structured metadata; see "spec.yaml shape" below
```

`filename_stem` defaults to `wireframe`.

### `spec.yaml` shape

```yaml
wireframe:
  brief: <str>
  platform: mobile | desktop
  dimensions: { width: <int>, height: <int> }
  generated_at: <ISO 8601 UTC>
  generator_version: "3.0-deterministic"
  svg: <relative filename>
design_system:
  id: <system_id> | null
  spec_version: <str> | null
  system_version: <str> | null
  layout_template_used: <pattern_id>
  base_pattern: <base pattern>
  pattern_source_svg: <absolute path>
  selection_rationale: <str>
  selection_was_fallback: <bool>      # only present when true
  components_used: []                 # populated when LLM placement seam lands (currently empty)
  rulebook_compliance:
    checked: <int>
    mechanical_passed: <int>
    mechanical_failed: <int>
    advisory_warnings: <int>
    failed_rules: [ <rule_id>, ... ]
    ruleset: <str>
    scope: artifact | component
  artifact_treatments_applied: []     # populated when artifact_treatments support lands
notes:
  - text: <str>                       # optional; only present when the run produced advisory notes
```

### CLI exit codes

The CLI shim emits the returned object as JSON to stdout. Exit code is 0 when `ok` is true, 1 otherwise, and 2 on escalation (`requires_orchestrator_pass`; the JSON is still on stdout and the reason on stderr). Files are written regardless of exit code (when applicable per the cases above).

## Composition Pattern with design-system-skill

This is the architecture point worth being explicit about: wireframe-skill **calls into** design-system-skill, never the reverse. design-system-skill is the source of truth for what a system IS; wireframe-skill is the consumer that uses that knowledge to produce wireframes.

When design-system-skill bumps schema versions or adds new operations, wireframe-skill's contract with it is the operation interface (load_system, get_rulebook, check_compliance) — those signatures stay stable across schema versions because design-system-skill normalizes specs to a current internal representation. wireframe-skill should not need to change just because a spec format changes.

If wireframe-skill ever needs to update specs (it shouldn't, but if), it does so through design-system-skill's mutation operations — never by writing spec.yaml files directly.

## Built-in Neutral Templates (Preserved from v2.0)

When invoked without a `system` parameter, the skill uses its built-in template library:

```
wireframe-skill/templates/
  components/
    button.svg
    card.svg
    input.svg
    list-item.svg
    nav.svg
    ...
  layouts/
    login.svg
    dashboard.svg
    settings.svg
    ...
```

These are intentionally aesthetically neutral — no strong color, generous neutral spacing, light gray strokes. Their job is to communicate structure and hierarchy without committing to a visual language. They remain the default because most early-stage wireframing happens before a design system is in play.

## Renderer Choice

For preview generation, the skill uses `render_preview.py` which wraps CairoSVG. The choice is deliberate:

- **CairoSVG matches Chrome's letter-spacing and basic rendering closely.** Verified against calibration_v2.svg.
- **CairoSVG handles SVG filters per spec** but may render filter-heavy artifacts (Riso's grain pipeline, future spatial systems) slightly differently than Chrome. For systems where filter rendering is load-bearing, the skill should route to a Chrome-equivalent renderer (headless Chromium) rather than CairoSVG.
- **ImageMagick is NOT used.** It renders SVG letter-spacing significantly wider than Chrome at the same value, leading to false-positive "bug" findings.

Per-system renderer routing happens via `render_preview.py`'s grammar-family check (Riso → headless Chromium when available; everything else → CairoSVG).

## Output Quality Expectations

Wireframes are not mockups. They communicate:

- Structure: which regions exist, what's in each, hierarchy of attention
- System fit: what the artifact would look like rendered in the named system
- Layout intent: spacing, alignment, grid behavior

Wireframes do NOT communicate:

- Final pixel-perfect treatment
- Animation or interaction states beyond a single static state
- Real content (placeholder text is intentional)
- Production-ready code (the SVG is for design review, not for direct ship)

This boundary is important because it shapes what counts as a successful wireframe. A wireframe that captures structure correctly in the right system grammar is successful. A wireframe that's pixel-perfect-pretty but doesn't follow the system's rulebook is not.

## Failure Modes and Recovery

Three predictable failure modes the skill handles:

**System not found.** The user requested a system that isn't in the registry. The skill returns an error listing available systems via `design-system-skill.list_systems()`.

**Rulebook violation that can't be auto-fixed.** Some rules require human judgment to satisfy (e.g. "this composition feels too dense" in a future qualitative rulebook). The skill emits the SVG with the violation documented in spec.yaml's compliance block, marked as `severity: required, status: unresolved`. Downstream consumers (or human reviewers) decide what to do.

**Component gap.** The system spec doesn't define a component the brief requires (e.g. brief asks for a tooltip but Swiss doesn't define one). The skill uses a system-neutral fallback for that component and records the gap in spec.yaml. Repeated gaps for the same system are a signal to extend that system's library.

## What This Skill Doesn't Do

**Doesn't author design systems.** That's the design-system-skill's authoring workflow.

**Doesn't generate final UI.** Wireframes are structural; mockups are visual; production UI is implementation. Three different deliverables.

**Doesn't handle interactive states.** Wireframes are single-state. If multiple states need to be wireframed, invoke the skill multiple times, one per state.

**Doesn't choose between systems.** The user picks the system; the skill applies it. The Decision Guide's *Which system* table informs that conversation; "Should we use Swiss or Editorial for this?" stays a design decision, not a wireframe-skill one.

**Doesn't run finetune workflows.** Future finetune work for system-specific generation lives in a separate skill (or is a non-skill ML workflow). wireframe-skill is the production interface; finetune training is a different concern.

## Open Questions for v3.1

Things that came up while writing this and are worth flagging:

**How does the skill handle multi-system wireframes?** A user might want "the same brief rendered in Swiss AND Riso AND Editorial" for comparison. Currently they'd invoke the skill three times. A `systems: [...]` array parameter could batch this; deferred until there's clear demand.

**How does the skill handle system extensions/overrides?** A user might want "Swiss but with the accent color changed to navy." Currently they'd need to author a derived system spec. A `system_overrides: {...}` parameter could accept lightweight tweaks; deferred pending a clear use case.

**How does the skill handle systems mid-evolution?** When a system author bumps their version (Swiss 1.0 → 1.1) with breaking rulebook changes, in-flight wireframes might suddenly fail compliance. The current behavior is "wireframes record which system version they were generated against; re-validation against newer versions is a separate audit workflow." Whether this is the right behavior long-term is open.

## Examples

### Example 1: Swiss dashboard, desktop

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/__main__.py --brief "dashboard for a chat app" --system swiss --out ./out
```

Expected: emits `out/wireframe.svg` (1280×800) + `out/wireframe.spec.yaml`. Selection rationale records that the keyword `dashboard` matched. Compliance summary shows mechanical_failed=0.

### Example 2: Mobile auth screen

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/__main__.py --brief "sign in screen" --system swiss --platform mobile --out ./out
```

Expected: emits an SVG at the platform's mobile dimensions, falling back to the desktop auth pattern if the system has no mobile-suffixed variant. spec.yaml records `platform: mobile`.

### Example 3: System-agnostic neutral wireframe

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/__main__.py --brief "settings page with sidebar nav" --out ./out
```

Expected: routes through the wireframe library (the implicit default system). `design_system.id` is `wireframe` in the emitted spec.yaml.

### Example 4: Unknown system fails fast

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/__main__.py --brief "anything" --system no_such_system --out ./out
```

Expected: exit code 1, JSON `{"ok": false, "errors": ["Could not load system 'no_such_system': ..."]}` mentioning the available systems. No files written.

## Implementation

The Python implementation lives at `scripts/wireframe_skill/` (package) with these modules:

| Module | Responsibility |
|--------|----------------|
| `generator.py` | `wireframe()`; orchestrates the 7-step flow; entry point. Supports `layout_id`, `request_routing`, `substitute`, `compose` and escalation |
| `placement.py` | `select_layout_pattern()` — brief→pattern routing (`heuristic` default with escalation, `exact`, `auto`/`request` deferral); `build_layout_selection_request()` / `apply_layout_selection()` — agent-driven routing pair; `derive_content_substitutions()` — LLM seam (currently no-op) |
| `atoms.py` | `render_atom_region()` — renders portable atomic SVG fragments with common-token resolution (Phase C) |
| `solve.py` | `solve_layout()` — layout tree → blueprint through tkr-kit's `design.solve_layout` operation (`solve-layout` subcommand) |
| `_design_system_path.py` | Puts the `design_system_skill` package on `sys.path` (repository layout, skill-bundle layout, or `$DESIGN_SYSTEM_SKILL_DIR`) |
| `compose.py` | `compose_svg()` — reads pattern SVG, applies substitutions, extracts viewBox; `apply_artifact_treatments()` — assembles the Riso filter pipeline (filter_library injection, layer=bottom page-bg rect, layer=top filter overlay) for systems that declare `artifact_treatments`; no-op for systems that declare none |
| `substitution.py` | `extract_text_nodes()`, `build_substitution_request()`, `validate_substitutions()`, `apply_substitutions()` — backs the `substitution-prompt` / `apply-substitutions` two-pass subcommands (item 9.1) |
| `decomposition.py` | `build_decomposition_request()`, `validate_blueprint()` — backs the `decompose-prompt` subcommand (item 9.2). Blueprint regions hold library components, `{"type": "custom", "svg": ...}` inline SVG, or `atoms` |
| `assembler.py` | `assemble_blueprint()` — composes a blueprint into a single SVG with `<defs>` id deduplication and per-component transforms (item 9.2); renders atom regions and inline custom SVG |
| `emit.py` | `emit_artifact()` — writes wireframe.svg + spec.yaml; builds the `design_system` block per the Output Contract |

CLI shim at `__main__.py` exposes the operation as `python3 ${CLAUDE_SKILL_DIR}/scripts/__main__.py --brief "..." [--system X] [--platform Y] [--out dir] [--no-escalate] [--layout-id ID] [--request-routing] [--compose]`, plus the `substitution-prompt`, `apply-substitutions`, `decompose-prompt`, `apply-decomposition` and `solve-layout` subcommands. `mcp_bridge.py` is a subprocess entry point for hosts in other languages (one JSON envelope on stdout per call; `python3 mcp_bridge.py <action> '<json-args>'`). Tests: `test_wireframe_skill.py` (routing — keyword, agent-driven, escalation — atoms, custom SVG, token export, component reading, substitution, decomposition, composition, failures), `test_solve.py`, `test_design_system_path.py`, `test_wireframe_mcp_bridge.py`.
