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

This skill exposes seven operations. Each is described with what it takes, what it returns, and what guarantees it provides.

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

Takes a directory containing a complete system library (spec.yaml + components/ + layouts/ + references/). Validates, then adds the system to the registry. Returns `{ registered: bool, system_id, errors: [...] }`.

If the system id already exists in the registry, the operation fails unless an explicit `replace: true` flag is passed. This prevents accidentally overwriting a system. When replacing, the prior version is recorded so rollback is possible (see `unregister_system`).

### unregister_system

Takes a system id. Removes it from the registry. Does NOT delete the spec or library files — those remain on disk. The system simply becomes unavailable to consumers.

This is intentionally conservative. Unregistering should be reversible by re-registering the same path; no destructive operation should be a single skill call.

### get_rulebook

Takes a system id. Returns the flattened rulebook: array of entries, each `{ id, rule, rationale, severity, scope }`. Scope is either `global` (applies to whole artifact) or `component:<id>` (applies only when the named component is used).

Consumers use this to perform compliance checks during artifact generation. The rulebook is intentionally exposed as a separate operation rather than embedded in `load_system`'s output, because consumers that only need rulebook (e.g. an audit tool that doesn't render anything) shouldn't pay the cost of loading components and layouts.

### check_compliance

Takes a system id and an artifact (currently SVG file path; future: also accepts inline SVG content, PNG renderings for vision-based checks). Runs the system's rulebook against the artifact and returns `{ passed: int, failed: int, advisory: int, results: [...] }`.

The mechanical checks (color palette membership, type scale enforcement, no-shadow validation, etc.) run as deterministic Python — no model invocation. The semantic checks (Swiss's "red used in 4 places per screen" requires understanding *which* uses count as the protected categories) may invoke a model. The result distinguishes mechanical from semantic checks so consumers can decide whether they trust a fully-mechanical pass or want human review for semantic findings.

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
| `check_compliance` | `{ system_id, artifact_path, scope, passed, failed, advisory, results: [{ rule_id, status, detail }], ruleset, mechanical_only }` |

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

**Provides design system *advice*.** No. The skill exposes systems as data and validates artifacts against rulebooks. Questions like "should we use Riso for this surface?" or "is Swiss the right choice for a marketing page?" are out of scope — those need human judgment.

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

Expected: JSON `{"ok": true, "data": [...]}` with descriptors for all 8 registered systems (id, name, tagline, grammar_family, version, spec_version, status).

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
| `validation.py` | `validate_spec()`; hand-rolled schema checks against v0.1 + v0.2 |
| `rulebook.py` | `get_rulebook()`, `check_compliance()`; delegates mechanical checks to `tools/builders/rulebook_check.py` |
| `errors.py` | `Result` + `Error` dataclasses; `ERROR_CODES` enumeration |
| `paths.py` | Project-root + registry-path resolution; honors `$DESIGN_SYSTEM_SKILL_REGISTRY` for tests |

CLI shim at `__main__.py` exposes every operation as a subcommand. Smoke tests at `test_design_system_skill.py` (94 assertions) cover all public operations including a register/unregister round-trip via a temp registry.
