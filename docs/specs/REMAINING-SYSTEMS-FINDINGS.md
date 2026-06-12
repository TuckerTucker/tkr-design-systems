# Remaining Systems Findings — Terminal, Editorial, Sketch, Prism, Revolt

Authored five additional systems against schema v0.1 to validate that the schema accommodates the full range of tkr-design-systems variation. Each authored as: spec.yaml + list_item (default + selected) + dashboard layout + render preview.

## What Worked Well

The v0.1 schema accommodated all five systems without contortion. The three structural patterns (`elevation.strategy`, `tokens.colors.palette` with usage_constraint, `rulebook` with severity) carried each system's distinctive grammar reliably. No system needed schema escape hatches beyond what the existing `grammar_extensions.per_system_signature` block was designed for.

The composition pattern from Swiss (component SVGs that compose into a dashboard layout, with rulebook compliance verifiable via mechanical check) extended cleanly to all five. The `render_preview.py` (CairoSVG) renderer handled all five systems' visual grammar — including the harder cases (Terminal's box-drawing characters, Revolt's hard offset shadows, Prism's gradients and ambient orbs).

## New Schema Findings (additional to RISO-FINDINGS.md)

### Finding 6: Border style needs to be a first-class property

Terminal uses dashed 1px borders as its primary structural treatment — `1px dashed #1F2F1F` is to Terminal what 1px solid is to Swiss. The v0.1 schema's `elevation.config.border_light` only captures width and color; style is implied as solid. Authoring Terminal required adding a `style` field (`solid | dashed | dotted | double`) inline.

**Implication for v0.2**: `border_light`, `border_strong`, and `rule.weight.*` entries should explicitly support a `style` field. Default to `solid` for backwards compatibility.

### Finding 7: Typography character-set requirements need to be declared

Terminal uses Unicode box-drawing characters (┌ ─ ┐ │ └ ┘) as part of its grammar. These render correctly only when the typeface includes the relevant Unicode block (Box Drawing, U+2500-U+257F). JetBrains Mono includes them; many monospace fonts don't.

The schema currently doesn't declare typeface character-set requirements, which means a system could be authored against a font with the right glyphs and render incorrectly when a fallback font is used.

**Implication for v0.2**: `typography.families.*` should support an optional `requires_unicode_blocks: [...]` field listing the Unicode blocks the system depends on. The wireframe-skill verifies these are available in the rendering environment before generating, and warns if not.

### Finding 8: Emoji as a system primitive needs to be declared (or substituted)

Editorial, Sketch, Prism, and Revolt all use emoji avatars (🗼 🍜 📖 💪 ⚡) as part of their list_item rendering. CairoSVG without an emoji font installed renders them as boxes or omits them entirely.

**Implication for v0.2**: systems that depend on emoji should declare `requires_emoji_support: true` in their tokens or grammar_extensions. The wireframe-skill either verifies emoji rendering is available, or substitutes with text alternatives (e.g. monogram letters) when not. This affects which renderer is appropriate per system — emoji-heavy systems need a renderer with system emoji fallback.

### Finding 9: Glass blur is fundamentally not SVG-native

Prism's `elevation.strategy: glass_blur` requires CSS `backdrop-filter` to render correctly. SVG has no equivalent — semi-transparent fills over a gradient bg approximate the visual but don't capture the actual blur effect (which would blur whatever's behind the glass panel).

The Prism preview reads as Prism but is *underspecified* compared to what the React implementation produces. This is the most significant renderer-format gap encountered.

**Implication**: for Prism specifically, the wireframe-skill should either:
- Document that SVG output is an approximation and the real rendering requires HTML/CSS
- Generate dual outputs (SVG for wireframing, plus an HTML preview snippet for visual verification)
- Route Prism specifically to a different output format

This isn't a schema problem — it's a format-fitness problem. SVG is the wrong format for atmospheric blur-based systems. Worth flagging in the wireframe-skill SKILL.md so users invoking Prism understand what they're getting.

### Finding 10: Some systems' rulebook entries are fundamentally semantic, not mechanical

Examples that surfaced:

- Editorial: "drop caps reserved for the FIRST AI message in a conversation, never elsewhere" — requires understanding message ordering and roles
- Sketch: "Caveat ONLY for annotations, send labels, and editorial asides" — requires understanding which text elements are which category
- Prism: "minimal metadata — AI/user messages distinguished by glass opacity, not by labels" — requires understanding what counts as redundant metadata
- Revolt: "code-style timestamps follow YOU // 00:N format" — requires understanding which text elements are timestamps vs. content

These rules can't be fully verified by mechanical checks against the SVG. They require semantic understanding of what each element *means* in the artifact.

**Implication**: the design-system-skill's `check_compliance` operation needs to support both mechanical and semantic check modes. Mechanical mode runs pure-Python checks against the SVG. Semantic mode invokes a model with the artifact + rule + context. The rulebook entries should declare which mode they require — currently `severity` says how serious a failure is, but not how to check.

A new field `check_method: mechanical | semantic | both` per rule, defaulting to mechanical, would address this.

### Finding 11.5: Component anatomy needs spatial-relationship constraints

Discovered while iterating on Sketch/Prism/Revolt list items. The schema's `components.list_item.anatomy: [avatar, title, preview, timestamp, unread_badge]` enumerates the parts but doesn't say anything about how they share horizontal space. Result: the preview text in three of the six systems was rendering past the unread badge, with text and badge overlapping.

The defect was in the SVG authoring (no width constraint on the preview text), but the *systemic* problem is that nothing in the schema told me — or would tell a future author of a new component variant — that "preview must yield space to badge when both present."

**Implication**: anatomy elements should optionally declare spatial-yield rules. Something like:

```yaml
components:
  list_item:
    anatomy:
      - { id: avatar, position: left }
      - { id: title, position: top, yields_to: [timestamp] }
      - { id: preview, position: middle, yields_to: [unread_badge] }
      - { id: timestamp, position: top_right }
      - { id: unread_badge, position: middle_right, optional: true }
```

The `yields_to` declares "I must reserve horizontal space for these siblings if they're present." A renderer that respects this can clip or truncate the preview at the right boundary; a mechanical compliance check can verify visual non-overlap.

This is more layout machinery than v0.1 carries, but the alternative is "every component author re-discovers the overflow problem." Worth promoting to v0.2.

### Finding 11: Selection signaling varies wildly across systems

Documenting because it surprised me how many distinct patterns exist for "this list item is selected":

- Swiss: 2px red accent bar on left + #F5F5F5 background fill
- Terminal: `>` prompt character + color shift to bright (no background)
- Editorial: paper-tier background fills with #F1ECDF + title weight bump (no border, no bar)
- Sketch: warm surface background fill + 1px border (no shadow, no accent)
- Prism: glass opacity tier change (0.08 → 0.14) — the only signal
- Revolt: lime fill + 2px black border + 4px hard shadow + pink avatar swap

Six systems, six different selection treatments. The v0.1 schema's `components.list_item.variants[id=selected]` correctly accommodates all of them via the `rendering_notes` field, but there's no structured way to express *which signaling primitive is being used*. This means cross-system analysis (e.g. "show me all systems that use background fill for selection") requires reading prose.

**Implication**: optional v0.2 field `selection_signal: enum` per component variant — values like `accent_bar`, `prompt_character`, `background_tier`, `surface_fill_with_border`, `glass_tier`, `hard_offset_treatment`. Doesn't replace `rendering_notes` (which is still where the specifics live), but enables structured queries.

## Schema Stability Verdict

**v0.1 is solid for production use across the current six systems.** The findings above are real but not blocking — they're refinements that surface as the system collection grows. Authoring all five remaining systems against v0.1 confirmed the schema's load-bearing structure (elevation strategy, palette with usage constraints, rulebook with severity, grammar_extensions with per-system signature) is correct.

A v0.2 schema bump is justified eventually, with these accumulated changes:
1. Filter graphs as named library entries (Riso finding 1)
2. Top-level artifact_treatments block (Riso finding 2)
3. Em-based ghost offsets and other ratio-based properties (Riso finding 3)
4. Top-level system_state block (Riso finding 4)
5. Border style as first-class property (this finding 6)
6. Typography character-set requirements (this finding 7)
7. Emoji support declaration (this finding 8)
8. Format-fitness declarations per system (this finding 9 — Prism)
9. Check method per rule (this finding 10)
10. Structured selection signal enum (this finding 11)

That's ten changes, but seven are additive and three are clarifications of existing structure. None require breaking changes to existing v0.1 specs.

## Per-System Quality Notes

**Terminal** — strongest landing of the five new systems. Box-drawing characters, prompt-style labels, color-as-signal all read clearly. `tokyo_trip` selected with `>` indicator is recognizably the Terminal treatment.

**Editorial** — most beautiful render. Drop cap, dispatch overlines, italic right-aligned user messages with burgundy left rule, byline footer. The typeface-boundary rule (Inter for metadata, Fraunces for content) holds throughout.

**Sketch** — Caveat annotations land but rendered with system fallback (no Caveat installed); the rotation transforms work but the cursive feel is approximate. Production rendering with Caveat available would be stronger.

**Prism** — gradient background and ambient orbs land cleanly. Glass approximation is honest but underspecified vs. real backdrop-filter. The atmospheric minimalism (no labels, no timestamps) reads as intended.

**Revolt** — strongest visual identity of the contemporary_clean systems. Hard shadows, 2/3px borders, lime/pink pairing, code-style timestamps — every grammar element lands. Of the five, this is the one most likely to be production-ready as-is.

## What This Concludes

We've now authored signature components and dashboards for all six tkr-design-systems against schema v0.1, with a documented set of v0.2 improvement targets and renderer-fitness observations. The schema accommodates the full range of variation in the current system collection. The pipeline (spec → component SVGs → dashboard composition → CairoSVG preview → mechanical compliance check) works end-to-end.

The natural next step is whatever you want to actually *do* with these systems — ship the design-system-skill, start the wireframe-skill v3.0 implementation, or begin the corpus generation work for the eventual finetune. The foundation is in place.
