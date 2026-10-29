# common-tokens.v1 migration

How the design systems were brought under the portable token contract, and how to bring a new system in.

Ported from tkr-kit's `design-system-skill/MIGRATION.md` (tkr-kit commit `75d94e2a`, 2026-05-26). In tkr-kit the `tokens.common` blocks were written by hand; here they are **generated from each system's `tokens.json`**, so the per-system mapping notes below describe the derivation, not hand-picked values.

## Overview

The common-tokens layer is **additive**. A migrated `spec.yaml` carries:

1. A top-level `common_tokens_version: "1.0"` field.
2. A `tokens.common` subtree mapping the contract's role names to the system's values — generated, between `# generated:common-tokens` markers.
3. Optionally a hand-authored `tokens.system` subtree exposing system-specific extensions for atom-level `<system_id>:<dotted.path>` references. Values the token file already holds are `{group.token}` aliases there.

The rest of the spec (`tokens.colors` palette, `tokens.typography`, `tokens.elevation`, components, rulebook) is untouched. Only atomic decomposition (the wireframe skill's atom regions) and raw-YAML readers of the portable layer read `tokens.common`.

## What's in the contract

`tools/design-system-skill/schemas/common-tokens.v1.yaml` is authoritative (it carries the LLM-facing role descriptions). At a glance:

| category   | required tokens | optional |
|------------|-----------------|----------|
| color      | ink, ink-muted, surface, surface-inset, accent, accent-on, outline, outline-strong, image-placeholder | success, warning, danger |
| typography | display, headline, title, body, caption | code |
| spacing    | xs, sm, md, lg, xl | — |
| stroke     | hairline, regular, bold | — |
| radius     | none, sm, md, full | — |

## How the block is derived

The derivation rules live in `tools/design-system-skill/design_system_skill/common_tokens.py`; the rule table is in the design-system skill's SKILL.md (§ Common token contract). The principles:

- **Role-named, not value-named.** `$ink` is whatever this system's `color.text_primary` is.
- **tokens.json is the only home of values.** Every common token is read from it, except the two with no token-file equivalent, declared in code with their reason: `radius.none` (fixed at 0 by the contract) and `radius.full` (9999, a fully-rounded sentinel).
- **Paint values are hex.** `rgba()` becomes `#RRGGBBAA` (Prism's translucent whites).
- **Required tokens are never omitted.** A system whose grammar forbids a role (Swiss's `no_radius_anywhere`) still declares it; the rulebook enforces grammar, the contract enforces portability.
- **Themes are modes.** A token-file `modes` axis with id `theme` yields a generated `themes:` block (one portable colour set per option), and the contrast gate checks every option.

Regenerate after any tokens.json change:

```bash
uv run python tools/design-system-skill common-tokens --write   # rewrite stale blocks
uv run python tools/design-system-skill common-tokens --check   # CI gate (exit 1 when stale)
```

## Per-system notes

What changed relative to tkr-kit's hand-written blocks, where upstream's corrected token values now win:

- **swiss** — `ink-muted` is the corrected `#707070` (was `#666666`). `headline` reads `extras.type.display_medium` (32px), the one system with a declared tier between display and title. `tokens.system.grid` keeps 12 columns; gutter and margin alias `space.md` / `space.xl`.
- **editorial** — `surface-inset` is `color.surface_elevated` (`#FFFFFF`); `ink-muted` takes the contrast-corrected `#77695B`. `tokens.system.typography.italic-preview` and `palette.paper-white` (alias of `color.surface_elevated`) are kept.
- **prism** — the gradient stops in `tokens.system.gradient.stops` alias `extras.color.gradient_stop_1..4`; `blur.base` aliases `elevation.backdrop_blur`.
- **revolt** — `tokens.system.palette.lime` aliases `color.success`; the hard shadow colour aliases `extras.color.shadow`.
- **riso** — values follow the reconciled spec (upstream 313adc5): ink `#1A1614` on cream paper, accent `#960061`. The hand-kept `tokens.system.inks` / `papers` presets were **dropped**: tokens.json now models them as the `paper` and `ink` mode axes, which the contrast gate checks, and a second copy would drift.
- **sketch** — accent is the contrast-corrected `#7C6E8B`. Caveat annotation styles live in `tokens.system.typography` with size/weight aliased to `extras.type`. Dark theme: `themes.dark`.
- **terminal** — values follow tokens.json (`case: none` → `mixed`; the old hand block declared `lowercase`). `tokens.system.glyphs` kept.
- **wireframe** — `code` uses `font.mono`. `surface` is white and `surface-inset` the elevated surface; `image-placeholder` falls through to `color.page_bg` because the elevated surface equals the surface. Dark theme: `themes.dark`.

## Authoring a new system

1. Write `systems/<id>/tokens.json` (schema v0.3, `docs/specs/TOKENS.md`) and `spec.yaml` with `system.tokens_file: tokens.json`.
2. Run `uv run python tools/design-system-skill common-tokens --write --spec systems/<id>/spec.yaml`. It adds `common_tokens_version` and the generated block; a missing source token fails with `COMMON_TOKENS_UNDERIVABLE` naming it.
3. Optionally add `tokens.system.*` below the generated block for anything a system-scoped atom should reference (`<id>:<dotted.path>`), aliasing token-file values.
4. Run `load_system("<id>")` — it validates the block (`COMMON_TOKENS_*` errors name any problem).

## Testing the contract for one system

```python
from design_system_skill import load_system, resolve_token

spec = load_system("<your_id>").data
print(resolve_token(spec, "$ink"))            # a hex colour
print(resolve_token(spec, "$type.body"))      # a text-style dict
print(resolve_token(spec, "$space.md"))       # a number
```
