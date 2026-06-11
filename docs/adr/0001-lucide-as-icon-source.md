# ADR-0001: Lucide as the icon source for emoji replacement

- **Status:** Accepted
- **Date:** 2026-06-10
- **Deciders:** Tucker Harley Brown

## Context

The project has a project-wide no-emoji policy, already enforced mechanically for
wireframe SVG artifacts (`design-systems/design-system-skill/design_system_skill/rulebook.py`
scans Unicode emoji blocks) and already designed into every system spec: each
`*-library/spec.yaml` declares `requires_emoji: false` plus a per-system
`avatar_strategy` (Editorial: Fraunces monograms; Prism: glass-tier monograms;
Riso: index numbers; Swiss: no avatars at all — typography only).

The rationale recorded in `editorial-library/spec.yaml` is the binding
constraint: emoji glyphs depend on system fonts and degrade silently in
CairoSVG, so generated wireframes must be self-contained — no font-dependent
glyphs, no external references.

Two gaps remain:

1. The eight root showcase JSX files (`design-system-*.jsx`) still use emoji —
   a shared demo `CHATS` array with emoji avatars duplicated across all eight
   files, Sketch's `"Emoji + label"` tag-chip token, and incidental examples.
   The showcases document the systems but contradict the specs they document.
2. No decision existed for *functional* icons (send, search, status marks) in
   showcase/studio UI or future wireframe components — the per-system
   avatar strategies cover identity, not iconography.

## Decision

Adopt **Lucide** as the canonical source of icon geometry, mediated through a
semantic icon registry rather than used directly:

1. **Identity slots never use icon-library glyphs.** Avatars follow each
   system's own `avatar_strategy` (monogram, index number, or none). The
   showcase JSX files are brought into line with the specs, with the shared
   demo data extracted to one module so each showcase renders identity in its
   own grammar.
2. **Functional icons resolve through a semantic registry** (L1 concern):
   semantic names (`identity`, `status.online`, `send`) map to per-system
   renderings. The default rendering is a Lucide path baked inline at build
   time (`lucide-static` / icon-node JSON — raw `<path>` data, no fonts, no
   `<use>` refs, CairoSVG-safe). Showcases use `lucide-react`.
3. **Grammar overrides where Lucide's stroke style doesn't fit:**
   - Terminal renders text glyphs (`●`, `▲`, `✗` — geometric/box characters,
     outside the banned emoji blocks), not SVG paths.
   - Sketch either keeps its `✎`/`✦` dingbats as typography or runs Lucide
     path data through rough.js at build time; its `"Emoji + label"` chip
     token is rewritten.
   - Swiss renders nothing — typography carries the meaning, per its spec.

## Alternatives Considered

- **Phosphor (MIT):** six weights (thin→fill) could map to system
  personalities. Rejected: heavier dependency, and the per-system registry
  already provides personality variation via stroke-width and overrides; one
  consistent geometry source is simpler to bake into SVG libraries.
- **Tabler (MIT):** ~5,900 icons, visually similar to Lucide. Rejected: the
  coverage advantage is unneeded at this scale; Lucide's icon-node JSON and
  React package are a better fit for the dual showcase/SVG-bake pipeline.
- **Heroicons (MIT):** small, Tailwind-flavored set. Rejected: limited range
  and a house style tied to another design ecosystem.
- **Icon fonts (any):** rejected outright — identical failure mode to emoji
  (font-dependent rendering, silent degradation in CairoSVG), which is the
  very reason the no-emoji policy exists.
- **Fully custom icon set:** best aesthetic fidelity per system, but the cost
  is unjustified when only two systems (Terminal, Sketch) need grammar
  overrides — and those overrides are cheaper than authoring a full set.
- **Status quo (keep emoji in showcases):** rejected — the showcases would
  continue to contradict the specs and the mechanical policy they advertise.

## Consequences

- Commits the project to Lucide's ISC license (compatible with Apache-2.0)
  and to `lucide-react` / `lucide-static` as dependencies of the showcase
  build and the SVG bake step respectively.
- Commits to maintaining the semantic icon registry as the single chokepoint
  between icon geometry and system rendering — new systems must declare their
  icon rendering mode (lucide-path, glyph, roughened, none) rather than
  importing icons ad hoc. This is what prevents spec/showcase drift from
  recurring.
- The eight showcase files and the Sketch spec's chip token require migration;
  the shared `CHATS` demo data must be extracted to one module.
- The rulebook's codepoint scan should be extended (or mirrored as a lint/hook)
  over `*.jsx` so showcase regressions are caught mechanically. The scan range
  question must be settled: `✎` (U+270E) and `✦` (U+2726) sit inside the
  scanned U+2700–27BF block, so either the Sketch spec's dingbats get an
  explicit allowlist or the policy is restated as "emoji presentation" rather
  than raw block membership.
- Reversal cost is low-to-moderate: because all icon usage routes through the
  registry, swapping Lucide for another geometry source later is a registry
  change plus a re-bake — not a sweep of every showcase and library.
