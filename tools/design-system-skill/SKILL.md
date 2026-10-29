---
name: design-system
description: Registry, schema validation, and library resolution for tkr-kit's design systems. Other skills load a system spec via this skill instead of reading spec files directly. Use when work involves design systems as first-class objects — loading a system, validating a draft spec, fetching a rulebook, or checking artifact compliance.
allowed-tools: [Read, Glob, Grep, Bash]
source: tkr-kit
version: 0.1.0
---

# design-system-skill

> **Layer 1 — Capability.** This is a skill. It encapsulates registry management, schema validation, and rulebook checking for a single concern: design systems as first-class objects. It does NOT generate artifacts (that's wireframe-skill or future mockup-skill); it does NOT orchestrate multiple systems in parallel (that's an L3 command). It produces structured JSON output that L2 agents and L3 commands can parse.

## Composition

| Layer | Component | Status |
|-------|-----------|--------|
| L3 Command | _none yet_ — could fan out per-system audits | future |
| L2 Agent | _none yet_ — could wrap operations with structured reporting | future |
| **L1 Skill** | **`design-system` (this file)** | **provides registry / validate / load / check capability** |

Owns the registry, schema validation, and library resolution for tkr-kit's design systems. Other skills (notably wireframe-skill) call into this skill to load a system spec, look up a component variant, or check rulebook compliance — they don't reimplement those concerns themselves.

## When to Use This Skill

Invoke this skill when the work involves design systems as first-class objects:

- A consumer skill (wireframe-skill, future mockup-skill, brand-audit-skill, etc.) needs the spec for a named system before it can render anything system-aware.
- A user is authoring a new design system and needs schema validation, scaffold generation, or integration with the registry.
- A user is asking introspective questions about systems — what's available, what does Swiss define, how does Riso's filter pipeline work — that the spec files can answer better than the React source.
- A workflow needs to verify that a generated artifact (wireframe SVG, mockup, design review report) complies with a system's rulebook.

Do NOT invoke this skill for:

- Generating the artifact itself. That's the consumer skill's job. design-system-skill provides the system definition; consumers do the rendering.
- Editing the React source files in `apps/showcase/src/systems/*.jsx`. Those are the design intent; this skill manages the *extracted* spec that consumers use. When the React source changes, the spec needs to be re-extracted (a workflow this skill supports), but the React source itself is owned by the design team.

## Mental Model

Three concepts, kept separate:

**The system source** lives in `apps/showcase/src/systems/design-system-{id}.jsx`. This is the React implementation — the canonical statement of what the system *is*. Authored by designers, evolves with the design.

**The system spec** lives in `systems/{id}/spec.yaml` plus the per-system library directory (components/, layouts/, references/). This is the *consumer-facing* form of the system: structured tokens, component SVG references, rulebook entries, grammar extensions. Derived from the source but stable enough that consumers can rely on its shape.

**The registry** is the index of which systems exist, where their specs live, what versions they're at. design-system-skill owns this index and is the only skill that should write to it. Consumers query it; humans rebuild it when systems are added or removed.

The flow when wireframe-skill (or any consumer) wants a system:

```
consumer  →  design-system-skill.load_system("swiss")
                ├── reads registry to find spec.yaml path
                ├── parses YAML, validates against schema
                ├── resolves component SVG paths to absolute file references
                ├── flattens rulebook for downstream checking
                └── returns structured object
consumer  ←──── (uses returned object to render artifact)
```

The consumer never reads spec.yaml or component SVG files directly. That's important for two reasons. First, the spec format may evolve (v0.1 → v0.2 → ...) and design-system-skill is responsible for handling version compatibility — consumers should keep working through schema changes. Second, validation is centralized — every consumer gets the same guarantees about spec shape rather than each one re-implementing checks.

## Capabilities

This skill exposes the operations below. Each is described with what it takes, what it returns, and what guarantees it provides.

### load_system

Takes a system id (`swiss`, `terminal`, `riso`, etc.). Returns a structured spec object: tokens, components (with SVG paths resolved to absolute references), layout templates (same), rulebook entries, grammar extensions.

Validates the spec against the current schema before returning. If validation fails, returns a structured error rather than partial data — consumers get all-or-nothing. The validation includes: required fields present, enum values within allowed range (`grammar_family`, `elevation.strategy`), referenced SVG files actually exist on disk, no circular references in `palette.role` or `components.anatomy`.

The returned object includes a `_meta` block recording: spec_version (the schema version this was validated against), system_version (the system's own version from spec.yaml), checksum of the spec file (for cache invalidation in long-running consumers).

### list_systems

Takes nothing. Returns an array of system descriptors: `{ id, name, tagline, grammar_family, version, spec_version, status }`. Status is one of `available` (loadable), `draft` (in registry but failing validation), `deprecated` (loadable but marked for removal).

Useful for UI affordances — "which systems can I wireframe in?" — and for diagnostic workflows. Doesn't load full specs; just enumerates.

### validate_spec

Takes a path to a spec.yaml (typically a draft being authored). Returns a structured validation result: `{ valid: bool, errors: [...], warnings: [...] }`. Errors are blocking; warnings are advisory (e.g. "rulebook has no `severity: required` entries — system may not enforce its own constraints").

This is the operation the design system authoring workflow uses. Does not modify the registry or any files; pure validation.

### register_system

Registrations write to the **user registry overlay** (`~/.claude/design-systems/registry.yaml`), never to the built-in `systems/registry.yaml` — see [Registry layers](#registry-layers). Takes a directory containing a complete system library (spec.yaml + components/ + layouts/ + references/). Validates, then adds the system to the registry. Returns `{ registered: bool, system_id, errors: [...] }`.

If the system id already exists in the registry, the operation fails unless an explicit `replace: true` flag is passed. This prevents accidentally overwriting a system. When replacing, the prior version is recorded so rollback is possible (see `unregister_system`).

### unregister_system

Takes a system id. Removes it from the user registry overlay; a built-in system cannot be unregistered (`BUILTIN_SYSTEM_IMMUTABLE` — edit `systems/registry.yaml` instead), and removing a user entry that shadowed a built-in reveals the built-in again. Does NOT delete the spec or library files — those remain on disk. The system simply becomes unavailable to consumers.

This is intentionally conservative. Unregistering should be reversible by re-registering the same path; no destructive operation should be a single skill call.

### get_rulebook

Takes a system id. Returns the flattened rulebook: array of entries, each `{ id, rule, rationale, severity, scope }`. Scope is either `global` (applies to whole artifact) or `component:<id>` (applies only when the named component is used).

Consumers use this to perform compliance checks during artifact generation. The rulebook is intentionally exposed as a separate operation rather than embedded in `load_system`'s output, because consumers that only need rulebook (e.g. an audit tool that doesn't render anything) shouldn't pay the cost of loading components and layouts.

### check_compliance

Takes a system id and an artifact (currently SVG file path; future: also accepts inline SVG content, PNG renderings for vision-based checks). Runs the system's rulebook against the artifact and returns `{ passed: int, failed: int, advisory: int, waived: int, results: [...] }`.

Deliberate deviations are allow-listed per system in `systems/{id}/rulebook-exceptions.yaml` (entries: `file` path/glob relative to the system directory, `rule` id, optional `match` token, required non-empty `reason`; format documented in `tools/builders/rulebook_check.py`). A waived violation is reported with `status: "waived"` and its reasons under `detail.waivers`, and counts as passing. An entry naming the artifact that matched no violation is reported as a failing `rulebook-exception-stale` result, so the list can't rot. An invalid exceptions file (e.g. an entry without a reason) fails the call with `EXCEPTIONS_INVALID`.

The mechanical checks (color palette membership, type scale enforcement, no-shadow validation, etc.) run as deterministic Python — no model invocation. The semantic checks (Swiss's "red used in 4 places per screen" requires understanding *which* uses count as the protected categories) may invoke a model. The result distinguishes mechanical from semantic checks so consumers can decide whether they trust a fully-mechanical pass or want human review for semantic findings.

### check_drift

Compares a spec.yaml with its canonical token file (`systems/<id>/tokens.json`, schema v0.3) and reports every disagreement: stale literals at projected locations, unresolved `{group.token}` aliases or palette `token:` references, and colour/font literals the token file does not produce. `python3 design-system-skill drift --all` (default), `--id swiss`, or `--spec path`; exit 1 on drift. `validate_spec` runs the same check for any spec that declares `system.tokens_file`. See `docs/specs/TOKENS.md`.

### check_color_gates

Runs the WCAG 2.x contrast gate (issue #7: every contract and token-file pair, `text` 4.5:1, `large_text` 3:1, `ui` 3:1, `advisory` reported) and the accent/danger hue gate (issue #8: accent and action at least 40° of OKLCH hue from danger, greys exempt; ADR-0002) over a system's token file in every mode combination, compositing translucent colours over the page and any declared `contrast_backdrops`. `python3 design-system-skill contrast --all` (default), `--id riso`, or `--spec path`, `--verbose` for every result; exit 1 on failure. MCP: `ds_check_contrast`. `validate_spec` runs both gates (errors `CONTRAST_FAIL`, `HUE_GATE_FAIL`, ...) and returns the per-pair reports as `data.contrast` / `data.hue_gate`. Waivers (`contrast_waivers`, `hue_waivers`) need a reason and fail when stale. See `docs/specs/SCHEMA-V0.3.md` § Colour gates.

### check_jsx_drift

Scans each showcase page (`apps/showcase/src/systems/design-system-{id}.jsx`) for colour literals (hex, rgb[a], hsl[a]) and fails on any literal that equals a token value in any mode (it should reference `tokens.json`) or that is not on the allow-list. The allow-list, `apps/showcase/jsx-color-allowlist.yaml`, covers documentation chrome around the preview; every entry needs a reason, entries that collide with a token value must be scoped to a region or line context, and stale entries fail. `python3 design-system-skill jsx-drift` (every page), `--id swiss` (repeatable), `--allowlist path`; exit 1 on drift. See `docs/specs/TOKENS.md` § 4.5.

### common_tokens (generate / check)

Each spec's portable `tokens.common` block, and a `themes:` block for systems whose `tokens.json` has a `theme` mode axis, are **derived from `tokens.json`**, written between `# generated:common-tokens` / `# generated:themes` markers. `python3 design-system-skill common-tokens [--check]` (checking is the default) exits 1 when a block is stale; `--write` regenerates; `--id swiss` / `--spec path` narrow it. CI runs `--check`. See [Common token contract](#common-token-contract-v10).

## Common token contract (v1.0)

The portable token layer. Every system that wants to be a target for atomic component synthesis (the wireframe skill's atom regions) declares `tokens.common.*` in its spec.yaml satisfying the contract at `tools/design-system-skill/schemas/common-tokens.v1.yaml`, and `common_tokens_version: "1.0"` at the top level.

**Why it exists.** System vocabularies differ (Swiss `text_primary`, Riso's ink presses, Prism's opacities). The common layer names ROLES — `$ink`, `$accent`, `$type.headline` — that resolve to each system's value, so one atom blueprint targets Swiss, Riso or Editorial unchanged.

**Where the values come from.** `tokens.json` is the only home of token values, so the block is generated, never hand-edited (`design_system_skill/common_tokens.py`):

| Common token | Derived from |
|---|---|
| `color.ink` / `ink-muted` | `color.text_primary` / `color.text_muted` |
| `color.surface` / `surface-inset` | `color.surface` / `color.surface_elevated` |
| `color.accent` / `accent-on` | `color.accent` / `color.accent_foreground` |
| `color.outline` / `outline-strong` | `color.border_default` / `color.border_strong` |
| `color.image-placeholder` | first of `surface_elevated`, `page_bg`, `border_default` that differs from `color.surface` (a placeholder in the surface colour would be invisible) |
| `color.success` / `warning` / `danger` | `color.success` / `warning` / `danger` |
| `typography.display` / `title` / `body` | `type.display` / `type.title` / `type.body` |
| `typography.headline` | `type.title` (no tier between display and title exists); Swiss: `extras.type.display_medium` |
| `typography.caption` | `type.label` |
| `typography.code` | `type.body` in `font.mono`, only when `font.mono` is a `monospace` stack |
| `spacing.xs`…`xl` | `space.xs`…`xl` |
| `stroke.hairline` / `regular` / `bold` | min of `border_width.*` / `border_width.default` / `border_width.focus` |
| `radius.sm` / `md` | `radius.input` / `radius.default` |
| `radius.none` / `full` | authored: `0` (fixed by the contract) / `9999` (fully-rounded sentinel; no token-file equivalent) |

Colours are written as hex (`rgba()` becomes `#RRGGBBAA`), font stacks as plain unquoted family lists, `case: none` as `mixed`, `line_height` as `leading`.

A spec may also carry `tokens.system.*` — system-extension tokens referenced as `<system_id>:<dotted.path>` from atoms scoped to that system (`swiss:grid.columns`). Values the token file holds are written as `{group.token}` aliases there, so drift checks them.

### Resolver API

```python
from design_system_skill import (
    load_contract,           # parse the versioned contract file
    validate_common_tokens,  # validate a spec's tokens.common against the contract
    resolve_token,           # resolve $ink, $type.headline, swiss:grid.columns
    UnknownTokenError, CrossSystemTokenError, MalformedTokenRefError,
)

spec = load_system("swiss").data
resolve_token(spec, "$ink")                # → "#000000"
resolve_token(spec, "$type.headline")      # → {family: "Inter, system-ui, sans-serif", size: 32, ...}
resolve_token(spec, "$space.md")           # → 24
resolve_token(spec, "swiss:grid.columns", scope="swiss")  # → 12
resolve_token(spec, "swiss:grid.columns")  # → CrossSystemTokenError (portable scope)
resolve_token(spec, "$nonexistent")        # → UnknownTokenError
```

| form | resolves through | scope |
|---|---|---|
| `$ink` | `tokens.common.color.ink` | portable |
| `$color.ink` | same, explicit form | portable |
| `$type.headline` | `tokens.common.typography.headline` | portable |
| `$space.md` | `tokens.common.spacing.md` | portable |
| `$stroke.regular` | `tokens.common.stroke.regular` | portable |
| `$radius.full` | `tokens.common.radius.full` | portable |
| `<system>:<dotted.path>` | `tokens.system.<dotted.path>` | system-locked (only when `scope == system`) |

### Validation behaviour

`validate_spec` runs `validate_common_tokens` whenever `tokens.common` is present and reports problems as errors: `COMMON_TOKENS_MISSING_CATEGORY`, `COMMON_TOKENS_MISSING_TOKEN`, `COMMON_TOKENS_BAD_COLOR` (not hex), `COMMON_TOKENS_BAD_LENGTH`, `COMMON_TOKENS_TEXT_STYLE_MISSING_FIELD`, `COMMON_TOKENS_TEXT_STYLE_BAD_WEIGHT` (outside 100..900), `COMMON_TOKENS_TEXT_STYLE_BAD_CASE`, `COMMON_TOKENS_UNKNOWN_TOKEN` (typo guard). A draft spec with no `tokens.common` is allowed. The generator adds `COMMON_TOKENS_STALE` and `COMMON_TOKENS_UNDERIVABLE`. Migration notes: `docs/specs/COMMON-TOKENS-MIGRATION.md`.

## Themes

A theme is a mode of the token file: an axis with id `theme` in `tokens.json` `modes` (`light` = default = the base values, `dark` = overrides). Because it is a mode, `contrast --all` checks every dark pair and `drift` accepts its colours. The spec's `themes:` block (`default`, and per theme a `common:` colour set) is generated from it. Wireframe and Sketch ship `light` + `dark`; Sketch's dark palette comes from the tkr-agent Console UI, Wireframe's is the greyscale scale inverted. Riso's `paper` / `ink` axes are print variants, not themes, and produce no `themes:` block.

## Registry layers

Two registry files combine at load time:

- **Built-in** — `systems/registry.yaml` in this repository (or `libraries/registry.yaml` in the skill-bundle layout). Read-only to the skill's operations.
- **User overlay** — `~/.claude/design-systems/registry.yaml` (relocate with `$DESIGN_SYSTEM_SKILL_USER_REGISTRY`). Per-user registrations, e.g. a system living in another project. User entries shadow built-ins by id; `register_system` / `unregister_system` write here only. A user-layer system may `extends:` a built-in; each side's SVG paths resolve against its own library before the merge.

`$DESIGN_SYSTEM_SKILL_REGISTRY` names a single file that is the whole registry (no overlay, fully mutable) — the hermetic mode tests use. The repository gates (`drift --all`, `contrast --all`, `common-tokens`) check the built-in layer only; a user-layer system belongs to another project, whose own gates own it. The test suite points the overlay at an empty temp path (`conftest.py`), so a developer's own overlay cannot leak in.

## UX-philosophy clauses

`tools/builders/rulebook_check.py` implements the measurable rows of tkr-kit's UX philosophy. They are policy rather than per-system taste, so `_with_ux()` appends them to every ruleset at registration — a ruleset cannot be registered without them.

| rule_id | scope | Decides |
|---|---|---|
| `ux-no-toast-notifications` | artifact | no toast/snackbar component is placed in a composed screen |
| `ux-no-confirm-dialog-without-undo` | artifact | no confirmation-dialog component without an undo affordance |
| `ux-required-fields-indicated` | both | every part the artifact declares `-required` renders its indicator, inside its own subtree |

All three answer from the artifact's **component inventory** — the assembler's `<g id="{region}__{component-id}_{index}">` groups and `<!-- COMPONENT-NAME -->` banner comments. An artifact naming neither is not silently green: each result carries `component_ids` and `inventory_source`, so a vacuous pass is visibly vacuous. A catalog sheet that legitimately places every primitive declares `<!-- CATALOG-SHEET: ... -->` and is exempt from the placement clauses, with the reason in the artifact. Each clause has a violating fixture and a clean twin under `tools/builders/fixtures/ux/`, driven from both sides by `tools/builders/test_ux_clauses.py` — a clause with no failing fixture is not enforced, it is decorative.

## Decision Guide

> The tables and lists in this section are generated from `systems/registry.yaml`, each system's `spec.yaml`, `tokens.json` and library, `docs/specs/LIBRARY-SPEC.md` and `tools/docs/guidance.yaml` by `uv run python tools/docs/generate.py`. CI fails when they are stale. Change the sources, then regenerate; don't edit between the markers.

### Which system

The user picks the system; this skill does not decide for them. The table says what each registered system is for, from its spec, so an agent can explain the options or notice a mismatch. When no system is named, consumers use `wireframe`.

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
| A fifth red mark in Swiss, or an error set in red | Red is finite: CTA, selection bar, identity tag, status dot, at most four per screen. Swiss danger reuses that red (hue-gate waiver), so an error is ink copy reading "Error: what failed." with no icon, badge, fill or border change. | `swiss-red-finite-resource`, `swiss-error-not-red`, `swiss-error-typographic`, [0002-accent-danger-hue-gate.md](../../docs/adr/0002-accent-danger-hue-gate.md) |
| An error in Revolt shown only by a new colour | Revolt's five colours are fixed; an error is labelled with the uppercase ERROR status pill, not recoloured. | `revolt-error-status` |
| Emoji in an avatar, label, status or decoration | Emoji depend on system fonts and degrade silently in CairoSVG. Identity uses the system's avatar_strategy; functional icons come from Lucide. | `swiss-no-emoji-imagery`, `riso-no-emoji`, [0001-lucide-as-icon-source.md](../../docs/adr/0001-lucide-as-icon-source.md) |
| A font size between steps (12px in Swiss, 15px in the wireframe library) | Each system has a fixed type scale; nudge to the nearest allowed size (sizes per system below). | `swiss-fixed-type-scale`, `wireframe-type-scale-discipline` |
| A colour literal instead of a token (a hex in a template, an off-palette fill) | tokens.json is canonical. Read colours through the token file (wf_get_tokens); the drift check flags literals the file does not produce, and the rulebook flags off-palette fills. | [TOKENS.md](../../docs/specs/TOKENS.md), `wireframe-palette-discipline` |
| An unescaped < or > in SVG text, such as `[ < prev ]` | The SVG is no longer well-formed XML and the rulebook check aborts. Write `&lt;` and `&gt;`. | `xml-well-formed` |
| A double hyphen inside an SVG comment | XML forbids `--` inside a comment body; the file will not parse. | `wireframe-no-double-hyphens-in-comments` |
| An animation with no tier, or one that ignores reduced motion | Every animation names a motion tier and a reduced behaviour within the system's reduced_motion policy; keep is not allowed on anything that moves. | [SCHEMA-V0.3.md](../../docs/specs/SCHEMA-V0.3.md#motion) |
| Rounded corners or soft shadows in Swiss, Terminal or Revolt | Radius is 0 in all three. Swiss and Terminal use no shadows; Revolt's only shadow is the hard 4px 4px 0 offset. | `swiss-zero-radius`, `swiss-no-shadows`, `terminal-no-radius`, `revolt-hard-shadows-only` |
| A pure white page in Editorial or Sketch | Both pages are warm paper; white is reserved for deliberate emphasis. | `editorial-paper-bg-required`, `sketch-warm-paper-bg` |
| Status shown twice (a red border and a red badge on one card) | One status, one visual channel; doubling it adds noise, not meaning. | `wireframe-one-channel-per-message` |
| Selection shown with a background fill in Terminal | Terminal selects by changing characters (' ' to '>') and colour, never by fill. | `terminal-selection-via-character` |
| A third ink in Riso | Exactly two inks per artifact from one press preset; neutrals come from the paper. | `riso-two-inks-only`, `riso-paper-is-the-neutral` |
| A toast for status, an "Are you sure?" dialog before deleting, or a required field with no marker | Use a banner or inline status, and undo (the undo_row pattern). Mark every required field. The rulebook reports a placed toast, a confirmation dialog without undo, and an unmarked required label in every system. See the Which component table. | [claude.md](../../claude.md), `ux-no-toast-notifications`, `ux-no-confirm-dialog-without-undo`, `ux-required-fields-indicated` |
<!-- /generated:rules-agents-get-wrong -->

### Rules per system

The first sentence of every rulebook entry, with its severity and check method. `get_rulebook` returns the full rule, rationale and scope. The tokens line is read from the system's `tokens.json` (default mode).

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

## File Layout

The skill expects this directory structure on disk:

```
tkr-design-systems/
  apps/showcase/src/systems/
    design-system-{id}.jsx      # the React source
  systems/
    registry.yaml               # the index of available systems
    {id}/
      spec.yaml                 # the schema instance
      components/               # SVG files referenced from spec
        button-primary.svg
        card-default.svg
        ...
      layouts/                  # SVG files for layout templates
        login.svg
        dashboard.svg
        ...
      references/
        jsx_extract.md          # human-readable distillation of source
  tools/
    design-system-skill/        # this skill
      design_system_skill/      # the Python package
      schemas/
        common-tokens.v1.yaml   # the portable common-token contract
```

This skill's `register_system` operation handles the workflow of authoring the spec extract for an existing .jsx file, including scaffolding the directory structure.

## Schema Versioning

The schema evolves. design-system-skill handles version compatibility so individual system specs don't all have to migrate in lockstep.

Each spec.yaml declares its `spec_version`. The skill maintains a JSON Schema file per version. When loading a system, the skill picks the matching schema, validates against it, and returns the spec in a normalized form that consumers can rely on (i.e. an internal "current" representation).

When the schema bumps from v0.1 to v0.2, two things happen:

1. The new schema file is added; the old one is kept indefinitely.
2. The skill's normalization logic learns to upgrade v0.1 specs to the v0.2 representation on load. Old specs don't need to be rewritten unless they want to use new features.

This means consumers are insulated from schema changes — they always see the current normalized representation. Authors are insulated too — their spec.yaml stays valid until they choose to migrate.

The CHANGELOG.md in the schema directory documents what changed between versions and how to migrate. Required reading when bumping the schema.

## Output Contract

> This contract is the interface between layers. Agents (L2) parse this output to build their reports. Commands (L3) aggregate agent reports built from this format. Do not change this format without updating the corresponding agent / command.

All operations return a `Result` object. The CLI shim serializes it as JSON to stdout; Python consumers receive it as a dataclass with `.ok`, `.data`, `.errors`, `.warnings`. Exit code is 0 when `ok` is true, 1 otherwise.

### Success

```json
{
  "ok": true,
  "data": { ... },           // operation-specific payload (see per-operation shapes below)
  "warnings": [              // optional; only present when warnings exist
    { "code": "REFERENCED_FILE_MISSING", "message": "...", "detail": { ... } }
  ]
}
```

### Failure

```json
{
  "ok": false,
  "errors": [
    {
      "code": "SYSTEM_NOT_FOUND" | "SPEC_FILE_MISSING" | "SCHEMA_VALIDATION_FAILED" | ...,
      "message": "human-readable explanation",
      "detail": { ... }      // optional structured context
    }
  ]
}
```

### Per-operation success payloads

| Operation | `data` shape |
|-----------|--------------|
| `load_system` | full normalized spec dict + `_meta: { system_id, system_version, spec_version, spec_path, library_root, checksum, registry_status }` + every `components.*.variants[*]` and `layout_templates.*` decorated with absolute `svg_path` |
| `list_systems` | `[{ id, name, tagline, grammar_family, version, spec_version, status }, ...]` (one entry per registered system, sorted by id) |
| `validate_spec` | `{ valid: bool, system_id, spec_version, errors: [...], warnings: [...] }` |
| `register_system` | the new `RegistryEntry.to_dict()`: `{ id, spec, status, library_root }` |
| `unregister_system` | the removed `RegistryEntry.to_dict()` |
| `get_rulebook` | `[{ id, rule, rationale, severity, check_method, check_scope, applies_when, scope, check_implementation }, ...]` |
| `check_compliance` | `{ system_id, artifact_path, scope, passed, failed, advisory, waived, results: [{ rule_id, status, detail }], ruleset, mechanical_only, exceptions_file }` (status: pass \| fail \| advisory \| waived) |

### Error code vocabulary

`SYSTEM_NOT_FOUND` · `SPEC_FILE_MISSING` · `SPEC_PARSE_FAILED` · `SCHEMA_VALIDATION_FAILED` · `REFERENCED_FILE_MISSING` · `REGISTRY_FILE_MISSING` · `REGISTRY_PARSE_FAILED` · `ALREADY_REGISTERED` · `INVALID_PATH` · `RULESET_UNKNOWN` · `INTERNAL`

The set is documented at `design_system_skill/errors.py::ERROR_CODES`. New codes are added when they're needed; existing codes are not renamed once consumers have started keying on them.

This shape makes it easy for consumers to check `if result.ok` and reason about failure modes without parsing exception messages. It also makes the skill scriptable from non-Python consumers — the CLI emits the same JSON, so a future Node.js wireframe-skill could invoke this skill via shell and parse the result.

## Performance Notes

`load_system` is the hot path. Consumers often call it at the start of every artifact generation, and a slow load directly impacts wireframe-skill's perceived latency.

Two optimizations that matter:

The skill caches loaded specs by checksum. If the spec.yaml hasn't changed since the last load, the cached object is returned. Cache lives in-process per session; survives across multiple wireframe generations within one session, doesn't leak across sessions.

SVG component files are NOT loaded into memory at `load_system` time. Only their paths are resolved. The wireframe-skill's renderer loads SVGs lazily as it composes the artifact — most generations only touch a handful of components, so lazy-loading saves significant I/O.

## Things This Skill Doesn't Do

Naming these explicitly because they've come up in conversation and the boundary matters:

**Generates wireframes.** No. That's wireframe-skill. design-system-skill provides the spec; wireframe-skill applies it to a brief.

**Edits the React source files.** No. The .jsx files are owned by the design team; this skill works with the extracted specs. If the source changes, re-run the spec extraction workflow (`register_system` with a refreshed spec).

**Chooses the system.** No. The skill exposes systems as data and validates artifacts against rulebooks. The Decision Guide's *Which system* table states what each spec says a system is for; whether Riso suits a given surface, or Swiss a marketing page, is still the user's call.

**Handles authentication or access control.** No. All systems are equally available to all consumers. If access control becomes necessary, it lives in the layer above this skill, not here.

**Renders previews.** No, but it shells out to render_preview.py when needed for compliance checking that requires rendered artifacts. The renderer module is the canonical previewer; this skill is its consumer in that direction.

## Authoring Workflow

The expected flow when adding a new design system to the registry:

First, the design team authors the React implementation in `apps/showcase/src/systems/design-system-{newid}.jsx`. This is the design intent.

Second, a designer or engineer runs the spec extraction workflow (this is a sub-workflow this skill exposes, currently invoked by humans rather than automated): the workflow reads the .jsx, generates a draft spec.yaml plus skeleton component SVGs and layout templates, and places them in `specs/{newid}/`. The draft is opinionated — it makes its best guesses about tokens, component anatomy, rulebook entries — and is meant to be edited.

Third, the designer reviews the draft, fills in rulebook entries that the automated extraction couldn't infer, hand-authors or refines component SVGs, and authors the layout templates. This is the meaningful design work; the extraction just removes the busywork.

Fourth, the designer runs `validate_spec` on the completed draft. Iterates until valid.

Fifth, `register_system` adds the system to the registry. It's now available to wireframe-skill and other consumers.

Sixth (optional but recommended), the designer authors a small set of "golden" wireframes — hand-designed examples that demonstrate the system's correct rendering. These become the eval set for downstream finetune work and the human reference for rulebook calibration.

The whole workflow involves authoring a spec.yaml, populating a components/ directory with SVG files for the system's vocabulary, authoring layout templates, and validating against the schema.

The R&D investment pays off as soon as a second consumer (mockup-skill, audit, etc.) needs the system — the spec is then reused rather than re-extracted. Complexity varies by system; the workflow scales with system grammar and component coverage targets.

## Open Questions for v0.2

Things this skill doesn't yet handle but probably should:

**Composed components.** A "Chat Dashboard" is sidebar + message list + input + composer. The current schema treats components as primitives; compositions live only in `layout_templates`. Consumers needing composed components have to assemble them from primitives, which loses some structure. v0.2 schema may add `components.composed.*`.

**Theme variants within a system.** Sketch, Prism, and Revolt all live inside `design-system-integrated.jsx` — they're sub-systems sharing a hub. The current schema treats each as an independent system. This works but doesn't capture the relationship. v0.2 may add an optional `parent_system` field.

**Per-component edge behavior.** When a list_item with a fill background composes into a container with edge strokes, the component's fill paints over the stroke. Current convention is "structural strokes paint last in z-order" but the schema doesn't formalize this. v0.2 may add `edge_treatment` declarations per component variant.

**Cross-system asset sharing.** Some components (icons, certain primitives) are visually identical across multiple systems. Currently each system's library duplicates them. A `shared_assets/` directory with references would reduce duplication but complicate the resolution logic.

These aren't blocking — v0.1 covers the systems we have today. They're noted so they don't get forgotten when the natural moment to bump the schema arrives.

## Examples

### Example 1: list registered systems

```bash
python3 design-system-skill list
```

Expected: JSON `{"ok": true, "data": [...]}` with one descriptor per registry entry (id, name, tagline, grammar_family, version, spec_version, status): <!-- generated:system-count -->9 registry entries (8 systems plus 1 alias: `neutral` → `wireframe`)<!-- /generated:system-count -->.

### Example 2: load and inspect Swiss

```bash
python3 design-system-skill load --id swiss
```

Expected: JSON `{"ok": true, "data": <full normalized spec>}`. The data includes `_meta`, all tokens, all components with absolute `svg_path` populated, all layout templates, the rulebook, and grammar extensions.

### Example 3: check artifact compliance

```bash
python3 design-system-skill check --id swiss --artifact systems/swiss/components/list-item-default.svg
```

Expected: JSON `{"ok": true, "data": { passed: 6, failed: 0, advisory: 1, results: [...] }}`. Scope auto-detects to `component` because the artifact path contains `/components/`.

### Example 4: validate a draft spec

```bash
python3 design-system-skill validate --spec /path/to/draft-spec.yaml
```

Expected: JSON `{"ok": true, "data": { valid: true, ... }}` or `{"ok": false, "errors": [...]}` with all collected schema violations in one pass.

## Implementation

The Python implementation lives at `design_system_skill/` (package) with these modules:

| Module | Responsibility |
|--------|----------------|
| `loader.py` | `load_system()`; checksum-cached spec loading + SVG path resolution |
| `registry.py` | `Registry` class wrapping `registry.yaml`; `list_systems()`, `register_system()`, `unregister_system()` |
| `validation.py` | `validate_spec()`; hand-rolled schema checks against v0.1, v0.2 and v0.3 (token contract + drift) |
| `contract.py` | The v0.3 semantic token contract (`CONTRACT_TOKENS`, `CONTRAST_PAIRS`, `MOTION_TIERS`), colour and easing parsing — `docs/specs/SCHEMA-V0.3.md` |
| `token_file.py` | Canonical `systems/<id>/tokens.json`: load, validate, modes, aliases, projection into the spec — `docs/specs/TOKENS.md` |
| `drift.py` | `check_drift()` / `check_drift_all()`: spec.yaml vs tokens.json (`drift` CLI subcommand) |
| `contrast.py` | Colour gates: WCAG contrast and accent/danger hue over every mode, OKLCH conversion with gamut clamp, minimum-lightness fixes (`contrast` CLI subcommand) |
| `jsx_drift.py` | Showcase JSX colour literals vs tokens.json, with a reasoned allow-list (`jsx-drift` CLI subcommand) |
| `rulebook.py` | `get_rulebook()`, `check_compliance()`; delegates mechanical checks to `tools/builders/rulebook_check.py` |
| `errors.py` | `Result` + `Error` dataclasses; `ERROR_CODES` enumeration |
| `paths.py` | Skill root, built-in registry, user overlay and override resolution (`$DESIGN_SYSTEM_SKILL_REGISTRY`, `$DESIGN_SYSTEM_SKILL_USER_REGISTRY`) |
| `tokens.py` | Common token contract: `load_contract()`, `validate_common_tokens()`, `resolve_token()` |
| `common_tokens.py` | Derives `tokens.common` / `themes` from tokens.json (`common-tokens` CLI subcommand) |

CLI shim at `__main__.py` exposes every operation as a subcommand. `mcp_bridge.py` is a subprocess entry point for hosts in other languages (`python3 mcp_bridge.py <list|validate|rulebook|compliance> '<json-args>'`, or `@/path.json`): exactly one JSON envelope on stdout, logging on stderr, exit 0 whenever an envelope was printed. Tests: `test_design_system_skill.py` (all public operations, the registry overlay and a register/unregister round-trip), `test_tokens.py` (contract + resolver), `test_common_tokens.py` (the generator, themes, the committed blocks), `test_design_system_mcp_bridge.py`, `test_jsx_drift.py`.
