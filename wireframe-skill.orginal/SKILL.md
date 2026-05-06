---
name: wireframe
description: Create SVG wireframes for web applications using a universal wireframing process. Produces mobile (375px) and desktop (1280px) SVG files with SPEC.yaml implementation contracts. Use when user asks about wireframes, mockups, screen designs, or UI layouts.
allowed-tools: [Read, Write, Glob, Grep, Bash]
source: tkr-kit
version: 2.0.0
---

# SVG Wireframing Skill

> **Layer 1 — Capability.** This is a skill. It encapsulates SVG wireframe generation for a single screen using a systematic, repeatable process. It does NOT orchestrate batch creation across multiple screens — that belongs to Layer 3 (commands). It produces structured deliverables that agents and commands can verify and aggregate.

## Composition

| Layer | Component | Status |
|-------|-----------|--------|
| L3 Command | `wireframe-batch` | discovers screens from SPEC/tracker, fans out agents in parallel, aggregates tracker |
| L2 Agent | `wireframe-agent` | wraps this skill with isolation, design system verification, structured reporting |
| **L1 Skill** | **`wireframe` (this file)** | **generates mobile SVG + desktop SVG + SPEC.yaml entry for one screen** |

## When to Use

- User asks to create a wireframe or mockup
- User wants to visualize a screen or UI layout
- User mentions wireframing, screen design, or layout design
- User asks to design a page or view
- Agent invokes this skill to generate a single screen's wireframes

## Process

Follow the full methodology in `UNIVERSAL-WIREFRAMING-PROCESS.md` in this skill directory. That document covers:

1. **Phase 0 — Project Setup:** Design system, file structure, tracker initialization
2. **Phase 1 — Understand the Screen:** Shell context, content inventory, relationships, existing patterns
3. **Phase 2 — Create Mobile SVG (375px):** Boilerplate, layout, components, icons, placeholder content
4. **Phase 3 — Create Desktop SVG (1280px):** Header adaptation, layout patterns, component adaptation
5. **Phase 4 — Write SPEC.yaml:** Data sources, components, edge cases, accessibility
6. **Phase 5 — Track Progress:** Update tracker with completion status
7. **Phase 6 — Verify:** SVG validation, SPEC validation, cross-screen consistency

## Instructions

1. **Read context** — check for existing wireframes in the target section. Read 1-2 existing SVGs and SPEC.yaml to match patterns.
2. **Understand the screen** — answer the Phase 1 questions (shell context, content inventory, relationships) before drawing anything
3. **Create mobile SVG** — 375px wide, using the design system tokens and component patterns from the process doc
4. **Create desktop SVG** — 1280px wide, expanding (not rearranging) the mobile layout
5. **Write SPEC.yaml entry** — data sources, components, edge cases (minimum 2), accessibility (minimum 2)
6. **Update tracker** — mark screen as complete, update section percentage
7. **Verify** — run the verification checklist from Phase 6
8. **Format output** — return results per the Output Contract below

## Deliverables Per Screen

| Artifact | Description |
|----------|-------------|
| Mobile SVG | 375px wide, full scrollable height, greyscale design system |
| Desktop SVG | 1280px wide, expanded layout from mobile |
| SPEC.yaml entry | Implementation contract: data, components, edge cases, accessibility |
| Tracker update | Completion status marked in section tracker |

## Excalidraw Canvas Integration

After generating SVG wireframes, output can be converted to Excalidraw JSON for the collaborative canvas:

```typescript
import { convertWireframe, renderToCanvas } from "core/canvas/pipeline.js";
const result = convertWireframe(svgContent);
const idMap = await renderToCanvas(result, canvasAdapter);
```

Entity tagging prefixes in text elements (`screen:`, `flow:`, `component:`) are automatically recognized as knowledge graph entity candidates.

## Output Contract

> This contract is the interface between layers. If an agent (L2) wraps this skill, it will parse these formats to build its report. Do not change this structure without updating any corresponding agent.

### Success

```
STATUS: SUCCESS

**Screen:** <screen-name>
**Section:** <section-name>
**Files:** <N> created

| Artifact | Path | Dimensions |
|----------|------|------------|
| Mobile SVG | wireframes/<section>/<screen>.svg | 375 x <height> |
| Desktop SVG | wireframes/<section>/<screen>-desktop.svg | 1280 x <height> |
| SPEC entry | wireframes/<section>/SPEC.yaml | — |

### Verification
- Design system compliance: PASS/FAIL
- SPEC required fields: PASS/FAIL
- Cross-screen consistency: PASS/FAIL (<N> patterns matched)
```

### Failure

```
STATUS: FAILURE

**Screen:** <screen-name>
**Section:** <section-name>
**Error:** <what went wrong>

### Partial Deliverables
<list any files that were created before failure>

### Diagnostic
<missing design system, missing section directory, SPEC parse error, etc.>
```

## Examples

### Example 1: New screen in existing section
```
/wireframe login screen for the auth section
```
Expected: Reads existing auth wireframes for pattern matching, creates mobile + desktop SVGs, adds entry to `wireframes/auth/SPEC.yaml`, updates tracker.

### Example 2: First screen in new section
```
/wireframe dashboard overview — new section
```
Expected: Creates `wireframes/dashboard/` directory, establishes section patterns, creates mobile + desktop SVGs, creates new `wireframes/dashboard/SPEC.yaml`, initializes tracker section.

### Example 3: Screen from SPEC definition
```
/wireframe the settings-profile screen from wireframes/settings/SPEC.yaml
```
Expected: Reads the existing SPEC entry for data sources and components, generates SVGs matching the specification, marks screen as complete in tracker.
