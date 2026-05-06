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

This v3.0 lives in `design-system-skill-draft/wireframe-skill/` for review. The production v2.0 is at `.claude/skills/wireframe-skill/`. When v3.0 merges into production, it replaces v2.0 in place; the agent + command above continue to work because the skill's invocation interface is additive (the new `system` parameter is optional).

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
python3 wireframe-skill substitution-prompt \
  --brief "dashboard for a meditation app" \
  --system swiss \
  --out /tmp/req.json

# Calling Claude reads /tmp/req.json, generates substitutions, and writes:
# /tmp/resp.json:
# {"substitutions": [{"find": "Tokyo Trip", "replace": "Calm App", "rationale": "..."}]}

# Pass 2: apply the response with grammar validation
python3 wireframe-skill apply-substitutions \
  --pattern swiss-library/layouts/dashboard.svg \
  --substitutions /tmp/resp.json \
  --out /tmp/wireframe.svg
```

Apply enforces grammar invariants: Revolt warns on lowercase replacements; Editorial warns on title-case violations; Terminal warns on non-snake-case identifiers; etc. Replacements happen only inside `<text>` and `<tspan>` content — never inside `<style>` blocks or attribute values.

### `decompose-prompt` and `apply-decomposition` (item 9.2)

For briefs that imply layouts the system hasn't authored (e.g. "kanban board with three columns"), assemble from the system's Primitives + Composites instead of falling back to a pre-authored pattern.

```
# Pass 1: emit a request listing all components in the system catalog
python3 wireframe-skill decompose-prompt \
  --brief "kanban board with three columns" \
  --system swiss \
  --platform desktop \
  --out /tmp/req.json

# Calling Claude reads /tmp/req.json and writes a LayoutBlueprint:
# {"canvas": {"width": 1280, "height": 800},
#  "regions": [{"id": "main", ..., "components": [{"component_id": "card-default", "x": 24, "y": 24}, ...]}]}

# Pass 2: assemble the blueprint into a single composited SVG
python3 wireframe-skill apply-decomposition \
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
  "system_id": "<system actually used>" | null
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

The CLI shim emits the returned object as JSON to stdout. Exit code is 0 when `ok` is true, 1 otherwise. Files are written regardless of exit code (when applicable per the cases above).

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

**Doesn't choose between systems.** The user picks the system; the skill applies it. "Should we use Swiss or Editorial for this?" is a design conversation, not a wireframe-skill decision.

**Doesn't run finetune workflows.** Future finetune work for system-specific generation lives in a separate skill (or is a non-skill ML workflow). wireframe-skill is the production interface; finetune training is a different concern.

## Open Questions for v3.1

Things that came up while writing this and are worth flagging:

**How does the skill handle multi-system wireframes?** A user might want "the same brief rendered in Swiss AND Riso AND Editorial" for comparison. Currently they'd invoke the skill three times. A `systems: [...]` array parameter could batch this; deferred until there's clear demand.

**How does the skill handle system extensions/overrides?** A user might want "Swiss but with the accent color changed to navy." Currently they'd need to author a derived system spec. A `system_overrides: {...}` parameter could accept lightweight tweaks; deferred pending a clear use case.

**How does the skill handle systems mid-evolution?** When a system author bumps their version (Swiss 1.0 → 1.1) with breaking rulebook changes, in-flight wireframes might suddenly fail compliance. The current behavior is "wireframes record which system version they were generated against; re-validation against newer versions is a separate audit workflow." Whether this is the right behavior long-term is open.

## Examples

### Example 1: Swiss dashboard, desktop

```bash
python3 wireframe-skill --brief "dashboard for a chat app" --system swiss --out ./out
```

Expected: emits `out/wireframe.svg` (1280×800) + `out/wireframe.spec.yaml`. Selection rationale records that the keyword `dashboard` matched. Compliance summary shows mechanical_failed=0.

### Example 2: Mobile auth screen

```bash
python3 wireframe-skill --brief "sign in screen" --system swiss --platform mobile --out ./out
```

Expected: emits an SVG at the platform's mobile dimensions, falling back to the desktop auth pattern if the system has no mobile-suffixed variant. spec.yaml records `platform: mobile`.

### Example 3: System-agnostic neutral wireframe

```bash
python3 wireframe-skill --brief "settings page with sidebar nav" --out ./out
```

Expected: routes through the wireframe library (the implicit default system). `design_system.id` is `wireframe` in the emitted spec.yaml.

### Example 4: Unknown system fails fast

```bash
python3 wireframe-skill --brief "anything" --system no_such_system --out ./out
```

Expected: exit code 1, JSON `{"ok": false, "errors": ["Could not load system 'no_such_system': ..."]}` mentioning the available systems. No files written.

## Implementation

The Python implementation lives at `wireframe_skill/` (package) with these modules:

| Module | Responsibility |
|--------|----------------|
| `generator.py` | `wireframe()`; orchestrates the 7-step flow; entry point |
| `placement.py` | `select_layout_pattern()` — keyword-heuristic brief→pattern routing; `derive_content_substitutions()` — LLM seam (currently no-op) |
| `compose.py` | `compose_svg()` — reads pattern SVG, applies substitutions, extracts viewBox; `apply_artifact_treatments()` — assembles the Riso filter pipeline (filter_library injection, layer=bottom page-bg rect, layer=top filter overlay) for systems that declare `artifact_treatments`; no-op for the contemporary-clean systems (Swiss, Editorial, Sketch, Prism, Revolt, Terminal) |
| `substitution.py` | `extract_text_nodes()`, `build_substitution_request()`, `validate_substitutions()`, `apply_substitutions()` — backs the `substitution-prompt` / `apply-substitutions` two-pass subcommands (item 9.1) |
| `decomposition.py` | `build_decomposition_request()`, `validate_blueprint()` — backs the `decompose-prompt` subcommand (item 9.2) |
| `assembler.py` | `assemble_blueprint()` — composes a blueprint into a single SVG with `<defs>` id deduplication and per-component transforms (item 9.2) |
| `emit.py` | `emit_artifact()` — writes wireframe.svg + spec.yaml; builds the `design_system` block per the Output Contract |

CLI shim at `__main__.py` exposes the operation as `python3 wireframe-skill --brief "..." [--system X] [--platform Y] [--out dir]`. End-to-end tests at `test_wireframe_skill.py` (38 assertions) cover Swiss + wireframe library at desktop and mobile, all keyword routing cases, unknown-system + invalid-platform failures, mobile-variant routing, advisory-warning emit, custom filename stem.
