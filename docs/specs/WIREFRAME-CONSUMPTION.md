# How wireframe-skill Consumes a Design System Spec

## The Composition Pattern

Two skills, clear ownership boundary:

- **design-system-skill** owns: registry of available systems, schema validation, spec loading, library file resolution. Answers "what is system X."
- **wireframe-skill** owns: brief interpretation, layout reasoning, SVG composition. Answers "render this brief."

Wireframe-skill calls into design-system-skill to load a spec, then uses the spec to render. The design system is a parameter, not a sub-routine.

## Invocation Shape

The wireframe-skill's interface gains a `system` parameter. Without it, behavior is unchanged (defaults to the existing aesthetically-neutral templates). With it, the skill loads the spec and renders against it.

Conceptually:

```
wireframe-skill(brief, system?, platform=mobile|desktop) -> svg + spec.yaml
```

Where `system` is a system id from the registry (`swiss`, `terminal`, `riso`, etc.) or unset.

## What the Skill Does With the Spec, In Order

### 1. Load and validate

The skill calls design-system-skill to fetch the spec. That call returns:
- The validated YAML as a structured object
- The resolved paths to all referenced SVG files (components, layouts)
- The rulebook entries flattened into a list

If validation fails, the skill returns an error rather than silently degrading. A spec that doesn't conform to the schema can't be reliably used.

### 2. Select a layout template as the structural starting point

The brief implies a screen archetype (login, dashboard, list, detail, etc.). The skill maps the brief's archetype to the matching `layout_templates` entry and loads its reference SVG. This becomes the structural skeleton — composition regions, hierarchy, spacing rhythm.

If the brief's archetype doesn't match any template, the skill picks the closest and notes the gap in the output's spec.yaml. This is a signal to the system author that the layout coverage needs extending.

### 3. Choose components per region

For each region in the layout (sidebar, header, main, footer, etc.), the skill identifies which components belong there based on the brief, then resolves each to the system's variant. "A list of items" becomes `components.list_item.variants[id=default]`. The variant's `svg` path is the rendering source; its `rendering_notes` and `constraints` inform any adaptation needed.

The skill doesn't compose SVGs blindly — it reads `rendering_notes` to understand what's variable (label text, count values) vs. fixed (border weights, color treatments, structural elements like Terminal's box-drawing characters).

### 4. Apply tokens

Tokens propagate down to every rendered element. Colors come from `tokens.colors`, type from `tokens.typography`, spacing from `tokens.spacing`. The skill uses the token references rather than hardcoded values, which means changing a token at the system level updates every wireframe rendered against that system.

For systems with `elevation.strategy`-specific configuration (Riso's filter pipeline, Prism's glass blur, Editorial's paper tiers), the skill consults `elevation.config` to get the right rendering treatment for containment and depth.

### 5. Consult the rulebook before emitting

This is the step that's most distinct from a typical templating system. Before finalizing the SVG, the skill checks each rulebook entry with `severity: required` against the wireframe in progress. For Swiss:

- Are all spacing values multiples of 8? (`swiss-grid-alignment`)
- Is red used in 4 places or fewer? (`swiss-red-finite-resource`)
- Is every border-radius 0? (`swiss-zero-radius`)
- Are all numerical indices zero-padded? (`swiss-zero-padded-indices`)

Failures get fixed before emit. Some rules are mechanical (radius checks); some require reasoning (red usage count). The mechanical ones run as deterministic checks; the reasoning ones invoke the skill's judgment.

### 6. Apply grammar extensions

Each system's `grammar_extensions` block declares per-system signature treatments. Swiss's extension says "use numerical display as primary content treatment for counts and metrics." The skill applies these treatments where the brief implies their use. They're not optional flourishes — they're how the system signals its identity.

For character-grid systems (Terminal), this is where box-drawing characters and prompt labels get applied. For print-texture systems (Riso), this is where filter pipelines get specified in the SVG output.

### 7. Emit SVG + spec.yaml

The output pair stays the same as the current wireframe-skill: an SVG at the platform's standard dimensions (375px mobile / 1280px desktop) and a spec.yaml describing what was rendered. The spec.yaml gains a `design_system` block recording which system was applied:

```yaml
design_system:
  id: swiss
  spec_version: "0.1"
  system_version: "1.0.0"
  rulebook_compliance:
    checked: 10
    passed: 10
    failed: 0
  layout_template_used: dashboard
  components_used:
    - { id: nav.sidebar, variant: default }
    - { id: list_item, variant: default }
    - { id: button, variant: primary }
```

This makes the output traceable: anyone looking at a wireframe later can see exactly which system spec it came from, which version, which rules were checked.

## What Changes in the Existing Wireframe-Skill SKILL.md

Concretely, the skill gains:

**A new optional parameter** in its invocation interface (`system`).

**A new dependency** declared upfront: requires design-system-skill to be available. If invoked with a `system` parameter and design-system-skill isn't installed, fails with an actionable error.

**A new section** explaining the system loading flow and how it changes layout decisions.

**A new pre-emit step** for rulebook compliance checking.

**Modified output schema** with the `design_system` block in spec.yaml.

**Backwards compatibility**: invocations without `system` parameter behave identically to the current skill. Existing workflows don't break.

## What the Design-System-Skill SKILL.md Looks Like

A new skill, scoped to system management. Its interface:

```
list_systems()                    -> [system_id, ...]
load_system(system_id)            -> validated spec object + resolved paths
validate_spec(yaml_path)          -> validation result
register_system(spec_dir)         -> add a new system to the registry
get_rulebook(system_id)           -> rulebook entries for compliance checking
```

It does not produce wireframes. It does not call wireframe-skill. It exposes design system definitions as a first-class resource that any skill (wireframe-skill, future mockup-skill, future brand-audit-skill) can consume.

## The Per-System Library Authoring Workflow

Adding a new system involves authoring the directory structure described in the schema:

```
systems/swiss/
  spec.yaml                       # the schema instance
  components/                     # SVG files referenced by spec.components.*.variants[*].svg
    button-primary.svg
    button-text.svg
    card-default.svg
    card-gray.svg
    input-text.svg
    list-item-default.svg
    list-item-selected.svg
    avatar-index.svg
    nav-sidebar.svg
    section-header-metadata.svg
    separator-hairline.svg
    separator-default.svg
    separator-strong.svg
  layouts/                        # SVG files referenced by spec.layout_templates.*.svg
    login.svg
    dashboard.svg
    settings.svg
    list.svg
    detail.svg
    empty-state.svg
  references/
    jsx_extract.md                # human-readable distillation of the React source
```

For Swiss, that's roughly 40-70 SVG files across the full Primitives/Composites/Patterns vocabulary, plus the spec.yaml and the JSX extract.

Per-system authoring scope: a designer can produce the component library by extracting from the existing React implementation and authoring new SVGs per the LIBRARY-SPEC. Work scales with grammar complexity and pattern count. Layout templates require careful study of the system's region composition.

Two approaches to reduce manual labor:

**Option A: author one system fully (Swiss), then use it as a template for the others.** Components and layouts have parallel structure across systems even when their rendering grammar diverges. A designer authoring Editorial's library can start from Swiss's file structure and rewrite the visual content per file.

**Option B: have the design-system-skill embed an authoring workflow that bootstraps libraries.** Given a system's React .jsx, generate draft component SVGs by applying the system's tokens and rendering grammar to a standard component skeleton. The designer's role becomes editing rather than authoring from blank. Requires more engineering upfront but reduces per-system authoring burden.

For the first pass, Option A is right — author Swiss fully by hand. After Swiss is authored and proven, the question of whether Option B's tooling justifies its engineering cost becomes empirical.

## What This Doesn't Address Yet

A few real questions the consumption pattern doesn't resolve:

**How does the skill handle missing components?** If Swiss's spec doesn't define a `tooltip` component and the brief implies one, what happens? Current draft: skill uses a system-neutral fallback and notes the gap in spec.yaml. Better long-term: the design-system-skill provides a "component shape inference" capability that generates a draft per the system's grammar. Out of scope for v0.1.

**How does the skill handle conflicting rulebook entries across composed components?** Doesn't currently. Not yet a real problem with one system at a time. Watch for it once multiple systems are in use.

**Do design systems version their rulebook independently?** Yes — system version bumps when rulebook changes. Wireframes record which version they were rendered against. Old wireframes don't auto-revalidate against new rulebook versions; that would be a separate audit workflow.

**What's the testing story?** Each system needs an eval set: briefs that exercise the system's distinctive treatments, expected outputs that demonstrate correct rendering. The design-system-skill should expose a `test_system(system_id, brief_set)` capability. Out of scope for the schema itself; needed for the broader pipeline.

## Sequence to Build

1. **Schema document** ✓ — see SCHEMA.md
2. **Swiss spec authored against the schema** ✓ — see swiss-spec.yaml
3. **Swiss component library** — 13 SVG files, hand-authored against the spec
4. **Swiss layout templates** — 6 SVG files, hand-authored
5. **design-system-skill SKILL.md** — defines the load/validate/register interface
6. **wireframe-skill SKILL.md update** — add system parameter, consumption flow, rulebook check, output schema update
7. **End-to-end test** — invoke wireframe-skill with a brief and `system=swiss`, verify the output is a Swiss-styled wireframe that passes rulebook compliance
8. **Repeat 2-4 for the other 5 systems** — Sketch, Prism, Revolt, Terminal, Editorial, Riso
9. **Conditioning prototype evaluation** — measure where stock Sonnet + the consumption pattern produces good wireframes vs. where it falls short; this is the evidence for whether finetuning is justified per system
10. **Targeted finetune for systems where conditioning isn't enough** — informed by step 9's evidence
