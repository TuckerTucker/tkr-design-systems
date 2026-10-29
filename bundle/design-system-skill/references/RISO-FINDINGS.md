# Riso Stress Test — Schema Findings (v0.1 → v0.2 input)

Authored a Riso list_item against the v0.1 schema to test whether `print_texture` extensions accommodate a fundamentally different rendering grammar than the contemporary-clean systems. Three substantive findings emerged that should inform schema v0.2.

## Finding 1: Filter graphs need to be encoded, not just parameterized

**The v0.1 schema captures filter intent** — `grammar_extensions.grain.feturbulence.base_frequency: 0.85` — **but not the SVG filter graph that realizes it.** Two different filter graphs (e.g. `feTurbulence` → `feComposite` vs. `feTurbulence` → `feBlend`) with the same parameters can produce visually very different results. The Riso list_item's grain overlay barely renders because the filter graph in the SVG file is malformed in a way the spec doesn't catch.

**Implication:** the v0.2 schema's filter-related extensions should either embed the filter graph directly (as an SVG `<defs>` fragment that consumers paste into their output) or reference a named filter from a system-wide filter library. The parameters then become inputs to the named filter rather than free-floating values.

This is a meaningful change. Currently the schema treats filters declaratively ("apply grain at this frequency"); v0.2 should treat them as authored artifacts ("use the named filter `grain_v1`, which has these parameters and this graph").

## Finding 2: Artifact-level treatments don't fit a per-component schema

**The grain overlay belongs to the entire artifact, not each component.** Riso's grain is a single continuous noise field that overlays the whole rendered surface — when you put a list_item next to a button next to a card, they should share one grain layer. With per-component grain (each component carrying its own filter), seams appear at component boundaries.

**Implication:** the v0.2 schema needs a top-level `artifact_treatments` block, separate from `components` and `tokens`. Things that live there: grain overlays, paper background fills, registration offsets, any global filter that applies post-composition. The wireframe-skill applies these last, after composing all components.

Knock-on effect: the design-system-skill's `load_system` operation should expose `artifact_treatments` as a separate field in the returned object, and check_compliance should verify that artifact-level rules (like "grain layer present") are checked against the composed artifact, not against individual component fragments.

## Finding 3: Ghost layer offsets need em-based scaling

**The duotone ghost layer offset (`offset_x_px: 0.4, offset_y_px: 0.4`) doesn't scale with font size.** A 0.4px offset reads as duotone on 30px display text but is invisible on 12px metadata. Result: the duotone signature appears strong on the unread count and weak on everything else, which inverts the design intent (metadata should be subtler, but should still read as Riso).

**Implication:** ghost layer offsets should be specified in em (or as ratios of font size), then converted to px at render time. Same lesson as tracking — design intent is a ratio, not an absolute pixel value. The tracking_conversion module's pattern (verified per-typeface conversion factors) probably extends to ghost offsets as well, since different typefaces have different visual weight that affects how much offset reads as duotone vs. blur.

## Finding 4 (Bonus): The schema's `parametric_state` belongs at top level

While authoring Riso, I put `parametric_state` (active_paper, active_ink, halftone_angle, grain_opacity, registration_offset) inside `grammar_extensions`. That's the wrong location.

**These aren't extensions of the print_texture grammar — they're configuration of how the system renders.** Other parametric systems (Spatial with depth-layer toggle, future versions of Prism with light-source position, possibly Win95 with theme variation) will have analogous configuration. They all share the property of "values that change how rendering happens but aren't tokens themselves."

**Implication:** v0.2 schema should add a top-level `system_state` block (alongside `tokens`, `components`, `layout_templates`, `rulebook`, `grammar_extensions`). Every system gets one, even if most are empty. This makes the configuration concept explicit rather than buried in extensions.

## Finding 5 (Bonus): CairoSVG's filter rendering may not match Chrome's

The preview pipeline I just standardized on (`render_preview.py` using CairoSVG) renders SVG filters according to the SVG spec, but **Chrome's filter rendering has its own interpretations that may produce visually different output**. For Riso specifically, the filter pipeline is the system's identity — if the preview tool can't render it the way users will see it in Chrome/Figma, our verification loop is broken for this system.

**Implication:** for filter-heavy systems (Riso, possibly future Spatial), we may need to upgrade the preview pipeline to headless Chromium specifically for those previews. CairoSVG remains correct for contemporary-clean systems where filters aren't load-bearing. The `render_preview.py` module could route by `grammar_family`: contemporary_clean and character_grid → CairoSVG; print_texture and spatial_3d → headless Chromium.

This isn't urgent — the current Riso preview reads recognizably as Riso even with imperfect filter rendering — but it's worth surfacing now so we don't spend Riso eval cycles on what turns out to be a renderer-fidelity issue rather than a generation-quality issue.

## What This Means for the Build Sequence

The findings don't block proceeding to wireframe-skill update (step C in our sequence). They do mean:

1. The wireframe-skill SKILL.md should explicitly call out that artifact-level treatments (grain, paper bg) are applied AFTER component composition, not per-component. This is a one-paragraph addition.

2. Schema v0.2 should be planned for after the first end-to-end run with Riso. We have a clear list of four substantive changes (named filter library, artifact_treatments block, em-based ghost offsets, top-level system_state block) plus the renderer-routing improvement.

3. Before authoring more component libraries for Riso, the schema gaps should be closed. Otherwise we'll author 19 component SVGs against v0.1 conventions and have to revisit them all when v0.2 lands. Better to bump the schema once and proceed.

The Riso stress test was worth doing — it surfaced gaps that Swiss (a token-driven system) couldn't have surfaced.
