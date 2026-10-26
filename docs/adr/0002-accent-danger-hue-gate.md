# ADR-0002: Accent-vs-danger hue gate for every design system

- **Status:** Accepted (owner decisions on Revolt, Editorial and Swiss
  recorded 2026-10-26, see Decisions 3–5)
- **Date:** 2026-10-26
- **Deciders:** Tucker Harley Brown

## Context

GitHub issue #8. Every system's token file (`systems/<id>/tokens.json`,
schema v0.3) names an `accent` (the brand signal: unread counts, selection
bars, the brand mark), an `action` (the primary action) and a `danger`
(errors, destructive actions). When accent or action share danger's hue,
a user who relies on colour cannot tell "this is new / this is the main
action" from "this is broken / this deletes something". Contrast alone (issue
#7) does not catch this: two reds can both pass 4.5:1 and still mean opposite
things.

Measured in OKLCH hue, before this decision:

| System | accent vs danger | action vs danger | Why |
|--------|------------------|------------------|-----|
| Swiss | 0° | 0° | danger reuses the accent red `#E3000B` (derived) |
| Revolt | 0° | 110.6° | danger reuses the accent pink `#FF3366` |
| Editorial | 1.2° | 1.2° | danger was "Masthead Deep" `#6B1623`, oxblood like the accent `#8B1E2D` |
| Terminal | 122.7° | 122.7° | green accent, red danger |
| Prism | 150.2° | exempt (grey glass) | teal accent, pink danger |
| Sketch | 79.9° | 79.9° | purple accent, brick danger |
| Wireframe | exempt (grey) | exempt (grey) | the accent is `#424242` |
| Riso | exempt, 30 modes | exempt, 30 modes | danger is the paper's text ink (grey) |

## Decision

1. **Adopt the gate for all systems.** Per system and per mode combination,
   `color.accent` and `color.action` must sit at least **40° of OKLCH hue**
   from `color.danger` whenever both colours carry hue (OKLCH chroma ≥ 0.04;
   greys have no hue and are exempt). Colours are composited over
   `color.page_bg` first. Implemented in
   `tools/design-system-skill/design_system_skill/contrast.py`
   (`check_hue_gate`), run by `validate_spec` (error `HUE_GATE_FAIL`), the
   `contrast` CLI command and the MCP tool `ds_check_contrast`, which report
   every gap.
2. **Waivers live in the token file and need a reason.**
   `hue_waivers: [{pair, modes?, reason}]`, the same shape as the contrast
   waivers; `pair` is `"color.accent vs color.danger"` or
   `"color.action vs color.danger"`. A waiver that no longer matches a failure
   is stale and fails, as with `rulebook-exceptions.yaml`.
3. **Swiss is waived** (the owner's decision): Swiss has exactly one chromatic
   colour and its danger state is carried by type and copy, not by a second
   hue. On 2026-10-26 the owner had the spec give Swiss an explicit error
   treatment so the waiver describes enforced behaviour (see "Swiss's error
   treatment" below).
4. **Revolt is waived permanently** (owner decision, confirmed 2026-10-26).
   The five-colour palette is inviolable (the JSX marks it INVIOLABLE: "No
   new colors"), so danger reuses pink. Its only chromatic colours are pink
   (accent) and lime (action, success); any danger 40° away from pink would
   be a sixth colour and change the system's identity. Errors are carried by
   the uppercase `ERROR` status label (JSX status pill variants `LIVE /
   TYPING / OFFLINE / ERROR`) and black text on pink (`danger_foreground
   #111111`, 5.3:1). `systems/revolt/spec.yaml` now states this as the
   rule `revolt-error-status` (judgment, with a mechanical part for builder
   error components), the rule `revolt-pink-not-text` and the
   `grammar_extensions.per_system_signature.error_status` block. Action
   (lime) passes at 110.6°.
5. **Editorial is fixed, not waived; the owner accepted the fix on
   2026-10-26.** Danger is a derived token, not a signature colour, so it
   moved: `#6B1623` → `#5F1B4F` (plum), hue 17.6° → 338.5° (gap 40.3°),
   lightness and chroma unchanged. It stays a deep wine on the paper
   (danger_foreground 10.9:1). The warm side (~59°) was rejected because it
   lands next to warning `#8A5A12` (~70°). "Masthead Deep" remains available
   as `extras.color.accent_deep`.

### Owner decisions (2026-10-26)

| System | Decision | Recorded in |
|--------|----------|-------------|
| Revolt | Confirm the accent-vs-danger waiver permanently | `systems/revolt/tokens.json` `hue_waivers`; spec rule `revolt-error-status` |
| Editorial | Accept the plum danger `#5F1B4F` (no value change) | `systems/editorial/tokens.json` `color.danger` |
| Swiss | Add an explicit, partly enforced error treatment to the spec | `systems/swiss/spec.yaml` `components.error_message`; rules `swiss-error-prefix`, `swiss-error-not-red`, `swiss-error-typographic` |

### Swiss's error treatment

Before this decision the Swiss waiver rested only on the showcase JSX voice
table (Error: "Error: send failed.", "Lowercase 'Error:' + what failed"); the
spec defined no error treatment. `systems/swiss/spec.yaml` now defines one,
grounded in that table and in the JSX's red budget:

- **Copy, not colour.** Error copy reads `Error: <what failed>.`: the prefix
  `Error:` (capital E, colon), the failure as a lowercase sentence, a closing
  period. Never `ERROR`, `error:` or `Error -`.
- **No icon, shape or fill.** No glyph, badge, pill, fill, coloured or
  thickened border; the input keeps its ordinary black rule. No `●`: a red
  `●` is Swiss's *active* status dot and would read as "live".
- **No red.** The JSX gives red four contexts (CTA labels, selection bar,
  user-message tag, status dot + unread count) and lists "Use red for hover
  states, warning messages, or decorative underlines" as a Don't, so error
  copy is ink. A recovery action inside an error surface ("Retry →") is a
  CTA label and counts toward the four-use red budget
  (`swiss-red-finite-resource`).
- **Warnings follow suit** (#8 follow-up). `components.warning_message`
  gives warnings the same typographic treatment without inventing a prefix
  (the voice table defines none): a grey 9px label, an ink message, red only
  on a CTA label. The builder's `banner-warning` had a red `ATTENTION`
  label and is now grey, checked mechanically by `swiss-warning-not-red`.
  Its dropdowns' red "Sign out" was in none of red's four contexts (a menu
  item, not a CTA label) and is now ink.

Enforcement: `swiss-error-prefix` and `swiss-error-not-red` are mechanical
(`tools/builders/rulebook_check.py`, swiss ruleset): any text starting with
the word "error" must have the `Error: … .` form, a builder component named
`*-ERROR` / `*-WITH-ERROR` must carry such a text, and `Error:` text must not
resolve to the accent red. `swiss-error-typographic` (no icons or shapes,
lowercase message naming what failed) is a semantic rule, checked by
judgment. The Swiss builder's `form-field-with-error` (was a red rule and a
red "Please enter a valid email address.") and `toast-error` (was a red
`ERROR` label) were brought into line.

## Alternatives Considered

- **No gate; rely on the contrast gate.** Rejected: contrast measures
  legibility, not meaning. Swiss, Revolt and Editorial pass contrast while
  their danger is indistinguishable from their accent by colour.
- **A smaller threshold (20–30°).** Rejected: neighbouring reds and pinks
  (Editorial's oxblood vs a crimson, Revolt's pink vs a red at ~29°) are
  still read as "the same red" at that distance, especially under colour
  vision deficiencies that compress the red–green axis.
- **A larger threshold (60°+).** Rejected: it would force danger into
  orange or magenta in systems whose accent is a warm red, colliding with
  warning hues, for little extra safety.
- **Perceptual distance (ΔE OK) instead of hue.** Rejected: two colours of
  the same hue but different lightness have a large ΔE (Editorial's accent
  and Masthead Deep) yet still read as one colour family; hue is what makes
  "brand red" and "error red" confusable.
- **Per-system opt-in.** Rejected: the collision is a property of the token
  values, so every system is checked; exceptions are explicit waivers with
  reasons, visible in review.

## Consequences

- Every system is checked in every mode; a new system that reuses its accent
  as danger fails validation until it moves danger or adds a reasoned waiver.
- Editorial's destructive states become plum rather than oxblood; builders
  and the showcase pick this up from `tokens.json`.
- Two systems carry waivers, both confirmed by the owner. Revolt keeps its
  five colours. The Revolt builder's error components (`banner-error`,
  `toast-error`, `form-field-with-error`) used to set `ERROR` as pink text on
  white with no pill, and the field marked the error with a pink border
  only. The #7 text-coverage pass then made that pink text pass 4.5:1 by
  darkening `color.danger` to `#E80B55` with a white `danger_foreground`, a
  sixth colour that this decision rules out. That change was reverted
  (`#FF3366` / `#111111`) and the usage fixed instead: the three components
  now carry the ERROR status pill (pink fill, 2px black border, black
  9px/700 uppercase text, radius 0), the field keeps its black border, and
  the required `*` is ink. Two mechanical revolt rules back this up
  (`tools/builders/rulebook_check.py`): `revolt-pink-not-text` (no text or
  tspan filled with the pink: it is under 4.5:1 on every Revolt
  background) and the mechanical part of `revolt-error-status` (a
  `*-ERROR` / `*-WITH-ERROR` component must contain the pink pill rect and
  the black 9px/700 `ERROR` label).
- Swiss's waiver now points at an error treatment its spec defines and the
  rulebook check partly enforces (see "Swiss's error treatment").
- Reversal cost is low: the gate is one function and one key in the token
  file; removing it is a code change, and waivers can be deleted once a
  system changes its danger colour (the stale-waiver check forces that
  clean-up).
