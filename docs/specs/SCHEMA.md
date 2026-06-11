# Design System Spec Schema (v0.1)

## Design Goals

The schema has to capture six systems honestly: Sketch, Prism, Revolt, Terminal, Editorial, Swiss, Riso. They diverge on far more than tokens — they have different elevation strategies (paper tiers vs. glass blur vs. hard shadows vs. typographic spacing), different rendering primitives (box-drawing characters, halftone filters, drop caps, ambient orbs), and different fundamental grammars (character grids vs. continuous prose vs. duotone print).

Three principles from looking at the real systems:

**1. The core schema is small and shared. The extensions are large and per-grammar-family.**
Forcing every system into a single flat schema means either the schema is so loose it's not useful, or it pretends Editorial's drop caps and Riso's feColorMatrix are the same kind of thing. They aren't. The schema has a small mandatory core (tokens, components, layout) and a `grammar_extensions` block where each system declares its own primitives.

**2. Components are referenced by SVG file path, not described inline.**
A Terminal Button rendered as `[ click me ]` and a Revolt Button rendered as a 2px-bordered hard-shadow box are not the same SVG with different fills. They're different SVG fragments. The schema points at files; the files contain the actual rendering. This also keeps the YAML readable.

**3. Rules and rationale are first-class, not optional documentation.**
Swiss's "red is a finite resource: exactly 4 uses, any 5th requires audit" is a real constraint that the wireframe-skill needs to respect. Editorial's "never mix Fraunces and Inter within a line" is the same kind of thing. These can't live in comments — they live in a `rulebook` block the wireframe-skill consults during generation.

---

## Schema Structure

```yaml
# Top-level: required for every system
spec_version: "0.1"
system:
  id: string                    # machine name, e.g. "terminal"
  name: string                  # display name, e.g. "Terminal"
  tagline: string               # short positioning, e.g. "CLI + Phosphor Heritage"
  grammar_family: enum          # see below
  version: semver               # the system's own version
  source_jsx: path              # path to the React reference implementation

tokens:
  colors: { ... }               # see colors block
  typography: { ... }           # see typography block
  spacing: { ... }              # see spacing block
  borders: { ... }              # see borders block
  elevation: { ... }            # see elevation block — strategy is per-system

components:                     # core component vocabulary
  button: { ... }               # see component block
  card: { ... }
  input: { ... }
  list_item: { ... }
  badge: { ... }
  avatar: { ... }
  nav: { ... }
  section_header: { ... }
  separator: { ... }
  # extend as needed; not every system uses every component

layout_templates:               # rendered references for core screens
  login: { ... }
  dashboard: { ... }
  settings: { ... }
  list: { ... }
  detail: { ... }
  empty_state: { ... }

rulebook:                       # prose constraints the wireframe-skill consults
  - id: string
    rule: string
    rationale: string
    severity: enum              # required | recommended | advisory

grammar_extensions:             # per-grammar-family or per-system primitives
  # this block's contents vary by grammar_family — see below
```

### `grammar_family` enum

The enum exists to tell consumers (wireframe-skill, future skills) which extension shape to expect. Six values cover the current six systems:

- `contemporary_clean` — Sketch, Swiss, Editorial, Prism, Revolt all share enough core grammar to live here. Extensions handle the per-system specifics.
- `character_grid` — Terminal. Anything where the rendering primitive is monospace + character composition (box-drawing, ASCII art, prompt strings).
- `print_texture` — Riso. Anything where the rendering primitive is filter-based (feColorMatrix, halftone, grain).
- `retro_platform` — reserved for future Win95, Mac OS 7, iOS 6 skeuo, Web 1.0 systems. Each carries its own widget vocabulary from a real historical platform.
- `spatial_3d` — reserved for future Vision Pro / spatial systems where rendering involves committed 3D layers.
- `experimental` — escape hatch for systems that don't fit the others. Forces explicit declaration that something needs schema work.

Adding a new family is a schema event, not a config event. That's intentional — it forces a real design decision rather than letting families silently proliferate.

---

## Token Blocks (Detailed)

### colors

```yaml
colors:
  # required
  page_bg: hex                  # background of the page itself
  surface: hex                  # default container background
  surface_elevated: hex         # if system has multiple tiers, this is "above default"
  text_primary: hex
  text_secondary: hex
  text_muted: hex
  accent: hex                   # the system's hero accent, used sparingly
  
  # optional, per-system
  accent_secondary: hex
  status_success: hex
  status_warn: hex
  status_error: hex
  
  # palette: full named token list, e.g. for Riso's ink pairs or Terminal's phosphor scale
  palette:
    - name: string
      value: hex | gradient | rgba
      role: string              # human-readable, e.g. "dim text", "phosphor primary"
      usage_constraint: string  # e.g. "exactly 4 uses per screen" (Swiss red)
```

### typography

```yaml
typography:
  families:
    - id: string                # e.g. "structural", "decorative", "metadata"
      stack: string             # CSS-style font stack
      role: string              # what this family is FOR — required, not just nice-to-have
      mixing_rule: string       # e.g. "never mix with structural in same line"
  
  scale:                        # the explicit allowed sizes
    - size: number              # in px
      role: string              # e.g. "body", "metadata", "display"
  
  case:                         # uppercase / lowercase / smallcaps usage rules per role
    metadata: enum              # uppercase | mixed | lowercase
    body: enum
    headers: enum
  
  tracking:                     # letter-spacing per role, in em
    metadata: number
    body: number
    headers: number
```

### elevation

This is the block that fragments the most across systems. Rather than pretending one model fits all, the schema declares an `elevation_strategy` and the contents follow:

```yaml
elevation:
  strategy: enum                # see below
  config: { ... }               # shape depends on strategy

# strategy values and their config shapes:

# strategy: "borders_only"      — Sketch
config:
  border_light: { width, color }
  border_strong: { width, color }
  no_shadow: true

# strategy: "paper_tiers"       — Editorial
config:
  tiers:
    - name: string
      bg: hex
      role: string              # e.g. "deep recess", "default page", "card surface"
  rules:
    - weight: enum              # hairline | default | strong | masthead
      color: hex
      width: number
      style: enum               # solid | dashed | double

# strategy: "glass_blur"        — Prism
config:
  base_blur: number             # px
  base_opacity: number
  elevation_steps:
    - name: string
      opacity: number
      role: string              # e.g. "default", "hover", "selected"
  ambient_lighting:
    enabled: true
    orbs: [ { position, size, color, opacity } ]

# strategy: "hard_offset"       — Revolt
config:
  shadow_offset: { x: number, y: number }
  shadow_color: hex
  shadow_blur: number           # always 0 for Revolt; schema permits non-zero
  border_width: number          # always 2-3 for Revolt

# strategy: "typographic"       — Swiss
config:
  rule_weight_hairline: { width, color }
  rule_weight_default: { width, color }
  rule_weight_strong: { width, color }
  accent_bar: { width, color, position }   # e.g. 2px red, left side of selected items
  spacing_units: [ ... ]        # the 8-point grid
  no_shadow: true
  no_radius: true

# strategy: "duotone_filter"    — Riso
config:
  paper_presets:                # the 5 paper options
    - id: string
      bg: hex
      blend_mode: string
      density: number
  ink_presets:                  # the 6 ink pairs
    - id: string
      ink_1: hex
      ink_2: hex
  filter_pipeline:              # the SVG filter graph
    - filter_type: enum         # halftone | duotone_matrix | grain | bleed
      params: { ... }
```

### components

Each component declares its anatomy and points at SVG files for rendering:

```yaml
components:
  button:
    anatomy:                    # the parts that make up this component
      - label                   # required
      - icon                    # optional
    variants:                   # the system's button variants
      - id: string              # e.g. "primary", "send", "ghost"
        svg: path               # path to SVG file in this system's library
        rendering_notes: string # prose: "Terminal button has no border, just `[ label ]`"
        states: [ ... ]         # default | hover | active | disabled
    constraints:                # what NOT to do
      - "Never use icon-only without aria-label"
      - "Send button always uses accent color"
```

The svg paths live in the per-system library directory:

```
systems/
  terminal/
    spec.yaml                   # the schema instance
    components/
      button-default.svg
      button-send.svg
      card-default.svg
      input-text.svg
      ...
    layouts/
      login.svg
      dashboard.svg
      ...
    references/
      jsx_extract.md            # human-readable extract of the React source
```

### rulebook

```yaml
rulebook:
  - id: "swiss-red-finite"
    rule: "Red (#E3000B) is used in exactly 4 places per screen: CTAs, selection bars, user tags, status dots. A 5th usage requires explicit audit."
    rationale: "Red is the system's only accent. Inflation breaks its semantic load."
    severity: required
  
  - id: "editorial-typeface-boundary"
    rule: "Never mix Fraunces and Inter within a single line."
    rationale: "Metadata navigation vs. content reading is signaled by family; mixing breaks the signal."
    severity: required
  
  - id: "terminal-prompt-style"
    rule: "Section headers use prompt-style labels: `$ command`, `# comment`, or `// caption`. Never plain text."
    rationale: "The terminal grammar treats every label as if it came from a shell."
    severity: required
```

The rulebook is what makes the difference between "system loaded as data" and "system loaded as guidance." The wireframe-skill consults this when generating; eval scoring checks against it.

### grammar_extensions

This is where each grammar family's specific primitives live. Examples:

```yaml
# For character_grid (Terminal):
grammar_extensions:
  family: character_grid
  monospace_required: true
  box_drawing:
    enabled: true
    style: enum                 # ascii | unicode_light | unicode_heavy | unicode_double
  prompt_labels:
    enabled: true
    formats:
      - "$ {label}"
      - "// {comment}"
      - "{user}@{host}:~$"
  comment_styling:
    prefix: "//"
    color: ref:colors.text_muted
  character_density:
    chars_per_line_target: number  # e.g. 80 for traditional terminal feel

# For print_texture (Riso):
grammar_extensions:
  family: print_texture
  duotone:
    matrix_strategy: "rec709_luminance"
    ghost_layer:
      enabled: true
      alpha_curve: "1 - luminance"
  halftone:
    dot_size_range: [number, number]
    angle_default: number
    angle_jitter: number
  grain:
    feturbulence_frequency: number
    overlay_mode: string
  registration_offset:
    enabled: true
    range_px: [number, number]

# For contemporary_clean (multiple systems share this):
grammar_extensions:
  family: contemporary_clean
  # this family's extensions are mostly per-system rather than family-wide
  per_system_signature:
    # Sketch:
    annotations:
      enabled: true
      typeface_ref: typography.families.decorative
      rotation_range_deg: [-3, -1]
      color_ref: colors.accent
    # Prism would override this whole block with its own extensions
    # Editorial would override with drop_caps, paper_tier_rules, etc.
```

The pattern: `grammar_extensions.family` declares which family's extension shape to expect, and the rest is per-system within that family's vocabulary.

---

## What This Schema Doesn't Try To Do

A few deliberate omissions worth naming, because they came up while drafting:

**No animation/motion specs.** Wireframes are static SVGs. The React systems have animation rules (Revolt's -0.5deg hover rotation, Sketch's 80ms message stagger), but they don't apply to the wireframe artifact. Animation lives in the React source, not the spec.

**No interaction state machines.** Same reason. Wireframes show one state. Interactive states (hover, focus, selected) are documented in `components.*.states` as references, but the spec doesn't model transitions.

**No content/copy generation.** The system tells the wireframe-skill *how* to render labels, not *what* labels to use. Copy is the brief's responsibility.

**No accessibility metadata.** Could be added later. Wireframes typically don't carry accessibility annotations and adding them would bloat the spec without payoff for the current job.

---

## The Schema's Honesty Test

A schema is honest if it can describe the systems you have without contortion, AND if a system you might add tomorrow has a place to land. Test cases:

✓ **Terminal** — `grammar_family: character_grid`, extensions cover box_drawing + prompt_labels.
✓ **Riso** — `grammar_family: print_texture`, extensions cover duotone + halftone + grain.
✓ **Swiss** — `grammar_family: contemporary_clean`, `elevation.strategy: typographic`, rulebook captures the red-as-finite-resource constraint.
✓ **Editorial** — `grammar_family: contemporary_clean`, `elevation.strategy: paper_tiers`, rulebook captures the typeface-boundary rule, extensions add drop_caps as a per-system signature.
✓ **Sketch** — `grammar_family: contemporary_clean`, `elevation.strategy: borders_only`, extensions add annotations.
✓ **Prism** — `grammar_family: contemporary_clean`, `elevation.strategy: glass_blur`, extensions add ambient_lighting.
✓ **Revolt** — `grammar_family: contemporary_clean`, `elevation.strategy: hard_offset`, extensions add rotation_interaction (deferred — no wireframe impact since static).
? **Web 1.0** (future) — needs `grammar_family: retro_platform`, would need a new extension shape modeling table-era widget grammar. Schema accommodates but extensions need authoring.
? **Win95** (future) — same family, different extension shape (beveled 3D widgets, dithered fills). Schema accommodates.
? **iOS 6 skeuo** (future) — same family again. Extension shape for material textures (leather, felt, wood grain).

The retro_platform extension shape doesn't exist yet because no current system uses it. That's correct — the schema admits incompleteness rather than over-fitting to imagined needs.

---

## Open Questions

These are real, not rhetorical:

1. **Should `grammar_extensions` be free-form per-system or constrained per-family?** Constrained is safer (consumers can rely on shape) but means adding a per-system primitive requires a schema bump. Free-form is more flexible but loses type guarantees. Current draft leans constrained.

2. **Where do per-component constraints live?** Some constraints are global (Swiss's red-as-finite-resource, in rulebook). Some are component-scoped (button.constraints). The boundary is fuzzy and the schema currently allows both, which might cause duplication.

3. **How do composed components work?** A "Chat Dashboard" is a composition of sidebar + message list + input. The schema currently has primitive components but no composition layer. Layout templates fill some of this gap, but not all of it. Worth thinking about whether `components.composed.*` is needed.

4. **Versioning per-system vs. per-spec.** A system's `version` and the `spec_version` are independent. Bumping the spec means every system needs to declare what changed. Bumping a system's version means only its consumers need to react. Current design treats them separately; needs a migration story documented.

These are the kinds of things to resolve while authoring the first concrete spec (Swiss), not in advance.
