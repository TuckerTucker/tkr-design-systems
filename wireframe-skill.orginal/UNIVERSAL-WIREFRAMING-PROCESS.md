# SVG Wireframing — Universal Process

**Purpose:** A replicable methodology for producing SVG wireframes for any web application, independent of a specific project's design system, brand, or domain.

This document extracts the general process from a successful wireframing campaign (23 screens, 46 SVG files, 5 SPEC.yaml files) and describes it in a form that can be applied to a new project from scratch.

---

## Overview

The process produces three deliverables per screen:

1. **Mobile SVG** (375px wide) — the canonical layout
2. **Desktop SVG** (1280px wide) — an expansion of the mobile layout
3. **SPEC.yaml entry** — the implementation contract (data, components, edge cases, accessibility)

Plus two project-level tracking artifacts:

4. **Design system reference** — palette, typography, spacing, components (created once, referenced always)
5. **Progress tracker** — which screens exist, which are needed, completion percentage

The workflow is: **Establish system → Create mobile → Adapt to desktop → Specify → Track → Verify**

---

## Phase 0: Project Setup

Before creating any wireframes, establish the project's design system and file structure. This happens once per project.

### 0.1 Define the Design System

Every wireframe project needs a design system document — even a minimal one. It answers: what colors, what sizes, what shapes, what spacing?

**Minimum viable design system:**

```
PALETTE:
  background:    [hex]    # Page/section background
  surface:       [hex]    # Cards, panels, modals
  border:        [hex]    # Outlines, dividers
  disabled:      [hex]    # Placeholder text, inactive elements
  secondary:     [hex]    # Subtitles, labels, help text
  interactive:   [hex]    # Buttons, active states, links
  primary_text:  [hex]    # Headings, body copy
  inverse:       [hex]    # Text on dark fills

  Optional semantic colors:
  success:       [hex]    # Positive status
  warning:       [hex]    # Caution status
  danger:        [hex]    # Negative/critical status

TYPOGRAPHY (size / weight / use):
  title:         [px] / bold     / page headings
  heading:       [px] / semibold / section headings
  body:          [px] / regular  / primary content
  secondary:     [px] / regular  / supporting text
  label:         [px] / medium   / metadata, badges
  caption:       [px] / regular  / fine print

SPACING:
  base_unit:     [px]
  page_margin:   { mobile: [px], desktop: [px] }
  component_gap: [px]
  section_gap:   [px]
  border_radius: [px]

FONT_STACK: [system fonts or custom]
```

**Greyscale recommendation:** Start wireframes in greyscale. This forces hierarchy through value and weight alone, guarantees accessibility, and prevents brand colors from masking structural problems. A proven greyscale palette:

| Token | Hex | Role |
|-------|-----|------|
| Background | `#F5F5F5` | Page fill |
| Surface | `#FFFFFF` | Cards, headers |
| Border | `#E0E0E0` | Outlines, dividers |
| Disabled | `#BDBDBD` | Placeholders, inactive |
| Secondary | `#757575` | Subtitles, labels |
| Interactive | `#424242` | Buttons, active states |
| Primary Text | `#212121` | Headings, body |

This palette has been validated across 46+ wireframes for readability, contrast ratios, and visual hierarchy. Semantic colors (`#2E7D32` success, `#E65100` warning, `#B71C1C` danger) layer on top for status communication.

### 0.2 Create the File Structure

```
wireframes/
├── _reference/
│   ├── DESIGN-SYSTEM.[svg|md]     # Color, type, spacing, components
│   ├── LAYOUT-PATTERNS.[svg|md]   # Mobile and desktop layout templates
│   ├── TRACKER.md                 # Screen inventory and completion
│   └── PROCESS.md                 # This document (or a project-adapted copy)
├── [section-a]/
│   ├── screen-name.svg            # Mobile
│   ├── screen-name-desktop.svg    # Desktop
│   └── SPEC.yaml                  # Implementation specs for this section
├── [section-b]/
│   ├── ...
│   └── SPEC.yaml
└── ...
```

Sections are logical groupings — typically by user flow or feature area (auth, onboarding, dashboard, settings, admin). Each section gets its own directory with SVGs and a SPEC.yaml.

### 0.3 Initialize the Tracker

The tracker is a markdown file that lists every screen in the project, its wireframe status, and overall completion. Format:

```markdown
# Wireframe Tracker

## Overview
| Section | Screens | Wireframed | Spec'd | Progress |
|---------|---------|------------|--------|----------|
| Auth    | 3       | 0          | 0      | 0%       |
| Dashboard | 2     | 0          | 0      | 0%       |
| ...     | ...     | ...        | ...    | ...      |
| **Total** | **N** | **0**      | **0**  | **0%**   |

## [Section Name]
| Screen | Mobile | Desktop | SPEC | Notes |
|--------|--------|---------|------|-------|
| Login  | ⬜     | ⬜      | ⬜   |       |
| ...    | ...    | ...     | ...  |       |

## Changelog
| Date | Change |
|------|--------|
```

---

## Phase 1: Understand the Screen

Before drawing anything, answer these questions:

### 1.1 Shell Context
- **What user is this for?** (anonymous, authenticated, admin)
- **What header does this screen use?** (none, logo-only, standard, drilldown)
- **What footer/navigation does it use?** (none, tab bar, minimal)
- **Which tab/section is active?**

### 1.2 Content Inventory
- **What data does this screen display?** List every piece of information.
- **What actions can the user take?** List buttons, links, toggles.
- **What states exist?** (empty, loading, error, populated, partial)
- **What is the primary action?** The one thing the screen wants the user to do.

### 1.3 Relationships
- **Where does the user come from?** (previous screen or entry point)
- **Where does the user go next?** (next screen or action result)
- **What sibling screens exist?** (screens in the same section with shared patterns)

### 1.4 Gather Existing Patterns
If other wireframes exist in the project:
1. Read the SPEC.yaml for the section
2. Read 1–2 existing SVGs in the same section
3. Note the header variant, tab bar, card styling, typography usage
4. Match these patterns exactly in the new wireframe

---

## Phase 2: Create Mobile SVG (375px)

Mobile first. Always.

### 2.1 SVG Boilerplate

Every wireframe starts with this skeleton:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 375 [height]" width="375" height="[height]">
  <defs>
    <style>
      .text-primary { fill: [primary_text]; font-family: [font_stack]; }
      .text-secondary { fill: [secondary]; font-family: [font_stack]; }
      .text-disabled { fill: [disabled]; font-family: [font_stack]; }
      .text-inverse { fill: [inverse]; font-family: [font_stack]; }
      /* Add semantic classes as needed */
    </style>
  </defs>

  <!-- Background -->
  <rect width="375" height="[height]" fill="[background]"/>

  <!-- ==================== HEADER ==================== -->

  <!-- ==================== CONTENT ==================== -->

  <!-- ==================== FOOTER ==================== -->

</svg>
```

**Height:** Use 812px as a starting point (iPhone viewport). Extend to fit content. Common values: 812, 900, 1000, 1200. The height accommodates the full scrollable content.

**CSS classes:** Define the minimum set in `<defs><style>`. Add more as needed but keep them consistent project-wide. Using classes instead of inline fill attributes means changing a color project-wide is a find-and-replace.

### 2.2 Section Dividers

Use banner comments to create scannable structure:

```svg
<!-- ==================== HEADER ==================== -->
<!-- ==================== ACTION BAR ==================== -->
<!-- ==================== CONTENT ==================== -->
<!-- ==================== FOOTER ==================== -->
```

Use inline comments for semantic meaning:
```svg
<!-- Primary CTA — most important action on the screen -->
<!-- Status badge: green = active, orange = warning -->
<!-- This section hidden when no data exists (see edge case: empty_state) -->
```

Comment *intent*, not *appearance*. Future readers need to know *why*, not *what*.

**XML comment syntax rule:** Never use double hyphens (`--`) inside SVG comments. XML forbids `--` within comment bodies — only `<!--` to open and `-->` to close. Decorative separators like `<!-- ---- Section ---- -->` will cause parse errors. Use `<!-- Section -->` or `<!-- ==================== SECTION ==================== -->` (equals signs are safe).

### 2.3 Layout with Groups

Use `<g transform="translate(x, y)">` to position groups of elements. This makes adjustments easy — moving a section means changing one translate, not recalculating every child coordinate.

**Vertical stacking pattern (mobile):**
```
y=0   → Header (fixed height)
y=H   → Secondary nav or action bar (optional)
y=H+N → Content cards (stack vertically, each card is a <g>)
y=end → Footer/tab bar (fixed to bottom of viewBox)
```

**Card stacking:**
```svg
<!-- Card 1 -->
<g transform="translate(12, 160)">
  <rect width="351" height="120" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <!-- card content -->
</g>

<!-- Card 2 (12px gap after card 1) -->
<g transform="translate(12, 292)">
  <rect width="351" height="120" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <!-- card content -->
</g>
```

### 2.4 Component Patterns

These are the atomic building blocks. Every wireframe is composed from these pieces.

**Cards** — the universal container:
```svg
<rect width="[full_width - 2*margin]" height="[varies]" rx="[border_radius]"
      fill="[surface]" stroke="[border]" stroke-width="1"/>
```
Internal padding: use the component gap value for all sides.

**Primary button:**
```svg
<rect width="[w]" height="48" rx="[radius]" fill="[interactive]"/>
<text text-anchor="middle" class="text-inverse" font-size="[body]" font-weight="500">[Label]</text>
```

**Secondary button:**
```svg
<rect width="[w]" height="48" rx="[radius]" fill="[surface]" stroke="[border]" stroke-width="1.5"/>
<text text-anchor="middle" class="text-secondary" font-size="[body]" font-weight="500">[Label]</text>
```

**Form input:**
```svg
<rect width="[w]" height="48" rx="[radius]" fill="[surface]" stroke="[border]" stroke-width="1.5"/>
<text class="text-disabled" font-size="[body]">[Placeholder]</text>
```

**Status badge:**
```svg
<rect width="[w]" height="20" rx="10" fill="[status_bg]"/>
<text class="text-[status]" font-size="10" font-weight="600">[STATUS]</text>
```

**Pill navigation (active):**
```svg
<rect width="[w]" height="28" rx="14" fill="[interactive]"/>
<text class="text-inverse" font-size="12" font-weight="500">[Label]</text>
```

**Pill navigation (inactive):**
```svg
<text class="text-secondary" font-size="12">[Label]</text>
```

**Underline tab (active):**
```svg
<text class="text-primary" font-size="12" font-weight="600">[Label]</text>
<rect x="[x]" y="[below text]" width="[w]" height="2" fill="[interactive]"/>
```

**Progress bar:**
```svg
<rect width="[total]" height="4" rx="2" fill="[border]"/>    <!-- track -->
<rect width="[filled]" height="4" rx="2" fill="[interactive]"/> <!-- value -->
```

**Metric display:**
```svg
<text class="[label_class]" font-size="[label]" letter-spacing="0.5">[METRIC LABEL]</text>
<text class="text-primary" font-size="[heading]" font-weight="700">[Value]</text>
```

**Divider:**
```svg
<line x1="[margin]" y1="[y]" x2="[width-margin]" y2="[y]" stroke="[border]" stroke-width="1"/>
```

### 2.5 Icons

Draw icons inline using SVG primitives. Never reference external assets — wireframes must be self-contained.

Keep icons simple — they communicate function, not beauty:

**User avatar:**
```svg
<circle cx="[x]" cy="[y]" r="16" fill="[border]"/>
<text x="[x]" y="[y+4]" text-anchor="middle" class="text-secondary" font-size="11" font-weight="600">[AB]</text>
```

**Logo placeholder:**
```svg
<rect x="[x]" y="[y]" width="32" height="32" rx="6" fill="[border]"/>
```

**Back arrow:**
```svg
<path d="M[x],[y] L[x+10],[y-8] M[x],[y] L[x+10],[y+8]"
      fill="none" stroke="[interactive]" stroke-width="2" stroke-linecap="round"/>
```

**More menu (⋯):**
```svg
<circle cx="[x]" cy="[y-6]" r="2" fill="[interactive]"/>
<circle cx="[x]" cy="[y]"   r="2" fill="[interactive]"/>
<circle cx="[x]" cy="[y+6]" r="2" fill="[interactive]"/>
```

**Chevron (dropdown):**
```svg
<path d="M[x],[y] L[x+6],[y+4] L[x+12],[y]"
      fill="none" stroke="[secondary]" stroke-width="1.5"/>
```

**Tab bar icons:** Draw with ~14×14px primitives:
```svg
<!-- Grid (dashboard) -->
<rect x="0" y="0" width="6" height="6" rx="1" fill="none" stroke="[color]" stroke-width="1.5"/>
<rect x="8" y="0" width="6" height="6" rx="1" fill="none" stroke="[color]" stroke-width="1.5"/>
<rect x="0" y="8" width="6" height="6" rx="1" fill="none" stroke="[color]" stroke-width="1.5"/>
<rect x="8" y="8" width="6" height="6" rx="1" fill="none" stroke="[color]" stroke-width="1.5"/>

<!-- Document with lines -->
<rect x="0" y="0" width="12" height="14" rx="2" fill="none" stroke="[color]" stroke-width="1.5"/>
<line x1="3" y1="4" x2="9" y2="4" stroke="[color]" stroke-width="1"/>
<line x1="3" y1="7" x2="9" y2="7" stroke="[color]" stroke-width="1"/>
<line x1="3" y1="10" x2="7" y2="10" stroke="[color]" stroke-width="1"/>

<!-- Gear -->
<circle cx="7" cy="7" r="6" fill="none" stroke="[color]" stroke-width="1.5"/>
<circle cx="7" cy="7" r="2" fill="[color]"/>
```

### 2.6 Placeholder Content

Use realistic sample data that's obviously fictitious. This makes wireframes feel alive without confusing them with production data.

**Names:** "Alex Rivera", "Jordan Chen", "Sam Okafor" — diverse, clearly placeholder
**Organizations:** "Northwind Trading", "Blue Harbor Consulting", "Ridge Valley Health"
**Metrics:** Vary them — 45%, 72%, 88% — not all the same, not all perfect
**Dates:** Near-future dates relative to the wireframing date
**Counts:** Believable scale — "87 responses", "240 employees", "12 surveys"

---

## Phase 3: Create Desktop SVG (1280px)

The desktop version **expands** the mobile layout. It never rearranges the information hierarchy. If mobile stacks A → B → C, desktop keeps that order even across columns.

### 3.1 Header Adaptation

| Property | Mobile | Desktop |
|----------|--------|---------|
| Height | 56px | 64px |
| Side padding | 16px | 32px |
| Title size | [body] | [body + 1px] |
| User area | Avatar only | Pill (avatar + name + chevron) |

### 3.2 Desktop Layout Patterns

Choose the pattern that fits the screen's content:

**Two-column split (main + panel):**
```
┌────────────────────────────────┐
│ Main content (60-65%)  │ Panel │
│                        │(35-40)│
└────────────────────────────────┘
```
Use for: detail views, results screens, anything with a primary content area plus contextual sidebar.

The right panel holds content that was below the fold on mobile — supplementary information, related data, notes, previews.

**Multi-column card grid:**
```
┌────────────────────────────────┐
│ [Card]  [Card]  [Card]         │
│ [Card]  [Card]                 │
└────────────────────────────────┘
```
Use for: list views, dashboards, item browsers.

Cards that stacked vertically on mobile spread into 2–3 columns. No content changes — just spatial redistribution.

**Centered constrained:**
```
┌────────────────────────────────┐
│       ┌──────────────┐         │
│       │ Content      │         │
│       │ max-[X]px    │         │
│       └──────────────┘         │
└────────────────────────────────┘
```
Use for: focused flows (forms, wizards, surveys) where attention should stay narrow.

**Left sidebar + content:**
```
┌────────────────────────────────┐
│ Nav      │ Content              │
│ 200-280px│                      │
└────────────────────────────────┘
```
Use for: filtered views, dimension/category navigation, settings panels.

Converts mobile's horizontal scroll (pills, chips) into a persistent vertical sidebar.

### 3.3 Component Adaptation Rules

| Mobile Pattern | Desktop Adaptation |
|----------------|--------------------|
| Stacked cards | Card grid (2–3 columns) |
| Bottom sheet / modal | Side sheet (right panel, ~420px) or centered modal |
| Horizontal scroll pills | Left sidebar with vertical list |
| Accordion / collapsed sections | Expanded sections, visible by default |
| Hidden supplementary content | Right column panel |
| Full-width action bar | Inline with header row |
| Single-column metrics | Horizontal metric strip |

### 3.4 Desktop-Only Elements

It's fine to add elements on desktop that don't exist on mobile — but only supplementary content. Never hide primary content behind a desktop-only panel.

Common desktop additions: activity feeds, preview panes, expanded metadata, inline charts that replace summary numbers, persistent filter sidebars.

---

## Phase 4: Write the SPEC.yaml

Every section needs a SPEC.yaml that bridges visual wireframes to implementation. The SVG shows what it looks like. The SPEC tells developers what it *does*.

### 4.1 File Structure

```yaml
# [Section Name] — Wireframe Specification
# Bridges SVG wireframes to implementation requirements.

section: [section_name]           # kebab-case identifier
shell: [public|app|survey|...]    # which layout shell this section uses
route_prefix: "/[base-path]"     # URL prefix for all screens in this section

screens:
  - id: [screen-id]               # kebab-case, matches filename
    file: [screen-id].svg
    desktop: [screen-id]-desktop.svg
    route: "/full/route/path"
    purpose: "One-sentence description"

    shell_header:
      type: [standard|drilldown|minimal|none]
      left: "Left slot content"
      center: "Center slot content"
      right: "Right slot content"

    data_sources:
      - table: [table_name]
        fields: [field1, field2, field3]
        filter: "condition expression"
        order: "sort expression"
        note: "Implementation context"

      - view: [view_name]          # Pre-computed query/view
        fields: [field1, field2]

      - derived: [name]            # Client-side computation
        logic: "How it's calculated"

    layout:
      mobile: "Description of mobile layout approach"
      desktop: "Description of desktop layout approach"

    components:
      - element: [element_name]
        type: [card|button|toolbar|form|list|chart|custom]
        content: "What it displays"
        behavior: "What happens on interaction"
        note: "Implementation guidance"

    edge_cases:
      - [case_name]: "Description and handling"

    accessibility:
      - "ARIA/keyboard/screen-reader requirement"

shared:
  header:
    type: [header_variant]
    left: "Left content"
    center: "Center content"
    right: "Right content"

  navigation:
    type: [tab_bar|sidebar|none]
    items:
      - { icon: "description", label: "Name", route: "/path" }
```

### 4.2 Required Fields

Every screen entry must include:
- `id` — unique kebab-case identifier
- `file` and `desktop` — SVG filenames
- `route` — URL path
- `purpose` — one-sentence description
- `data_sources` — at least one, with table/view name and fields
- `components` — at least the primary content elements
- `edge_cases` — at least 2 (empty state + one error/boundary case)
- `accessibility` — at least 2 items (keyboard + screen reader)

### 4.3 Edge Cases Worth Specifying

Every screen should address applicable items from this list:

- **Empty state** — no data yet, first-time use
- **Error state** — network failure, server error, timeout
- **Loading state** — skeleton screen or spinner pattern
- **Permission denied** — user lacks access
- **Data below threshold** — too few items to display meaningfully
- **Concurrent edit** — multiple users modifying the same data
- **Stale data** — data that's changed since the page loaded
- **Boundary values** — very long text, very large numbers, zero values
- **Missing optional data** — what shows when non-required fields are empty

### 4.4 Accessibility Items Worth Specifying

- Keyboard navigation: Tab order, Enter/Space activation, Escape to close
- Screen reader: ARIA labels, live regions for dynamic content, role attributes
- Focus management: Where focus goes after modal open/close, after form submit
- Color independence: Information conveyed without relying solely on color

---

## Phase 5: Track Progress

After creating wireframes, update the tracker:

1. Mark the screen's mobile, desktop, and SPEC columns as complete (✅)
2. Update section and total completion percentages
3. Add a changelog entry with the date and description
4. Update the file inventory if applicable

The tracker is a project-level dashboard. It should always reflect reality. Updating it is part of the deliverable, not an afterthought.

---

## Phase 6: Verify

Run a verification pass after every batch of wireframes. Check:

### SVG Validation
- [ ] Files exist and have non-trivial content
- [ ] viewBox dimensions match width/height attributes
- [ ] Mobile viewBox width = 375
- [ ] Desktop viewBox width = 1280
- [ ] All text uses CSS classes from the design system (not arbitrary inline fills)
- [ ] No colors appear that aren't in the design system palette
- [ ] Comment dividers separate major sections
- [ ] No double hyphens (`--`) inside XML comments (only `<!--` and `-->` may contain `--`)
- [ ] Positioning uses `<g transform="translate(x,y)">`
- [ ] Font sizes match the typography scale

### SPEC Validation
- [ ] Every SVG file has a corresponding screen entry in SPEC.yaml
- [ ] Route patterns are unique and don't conflict
- [ ] Required fields are present (id, file, desktop, route, purpose, data_sources, components, edge_cases, accessibility)

### Cross-Screen Consistency
- [ ] Header variant matches the shell type for this section
- [ ] Navigation (tab bar, pill bar) active state matches the current screen
- [ ] Card styling (radius, padding, stroke) is identical across screens
- [ ] Typography scale is applied consistently
- [ ] Spacing values match the design system

---

## Efficiency Techniques

### Batch Creation

When creating multiple wireframes:

1. **Create the first screen inline** — establish patterns for the section (header, tab bar, card layout, spacing)
2. **Use parallel agents for the rest** — provide detailed pattern specifications so each agent produces consistent output
3. **Verify the batch** — check all files together for consistency

This is faster than creating screens sequentially and catches pattern drift.

### Pattern Extraction

When starting a new section, extract patterns from existing sections:
- Read 1–2 existing SVGs → note header structure, card dimensions, spacing values
- Read the section's SPEC.yaml → note the data source format, edge case style
- Apply these patterns to the new section

### Specification Before Drawing

For complex screens, write the SPEC.yaml *first*. List every component, every data source, every edge case. Then draw the SVG to match the spec. This prevents discovering missing components mid-drawing.

For simple screens, draw first and spec after — the visual exploration helps discover what the screen needs.

---

## Design Principles

These aren't rules about colors or spacing — they're principles about *how to think* about wireframes.

### Mobile Is the Truth

The mobile wireframe defines the information hierarchy. If something matters, it's visible on mobile. Desktop adds space and supplementary context, but the mobile version is the canonical content list.

### Cards Are the Universal Container

If a piece of content is distinct — it has a boundary, a title, related data — it's a card. Cards are the only container type needed for 90% of wireframe content. Using a single container pattern creates visual consistency without effort.

### One Channel Per Message

Status is communicated through *one* visual channel, not multiple. If card borders show status (green = active, orange = warning), then background color, icon changes, and text color don't also encode status. One signal, clearly defined.

### Comments Are for Intent

SVG comments explain *why*, not *what*. `<!-- Active client — green border indicates active survey -->` teaches future readers the system. `<!-- Green rectangle 4px wide -->` does not.

### Consistency Over Creativity

Wireframes aren't art. Every card should look like every other card. Every button should use the same dimensions. Every header should follow the same pattern. Uniformity makes the wireframes feel like one product. Creativity belongs in the production design phase, not the wireframe phase.

### Edge Cases Are First-Class

Empty states, error states, and permission boundaries aren't afterthoughts — they're part of the screen specification and should be considered during wireframing. A screen that only works with perfect data isn't designed yet.

### Verify, Don't Assume

After creating wireframes, verify them. Check that files exist, dimensions are correct, specs are complete, and patterns are consistent. Verification catches errors before they compound across screens.

---

## Appendix: Checklist for a New Project

Starting wireframes for a new project? Walk through this list:

1. **Define the design system** — palette (7+ greyscale values), typography scale (5–7 sizes), spacing system (base unit + margins + gaps), border radius, font stack
2. **Identify all screens** — list every screen the application needs, grouped by section
3. **Identify shells** — what header/footer/nav patterns exist? How many distinct "wrappers" does the app have?
4. **Create the file structure** — `wireframes/_reference/` + one directory per section
5. **Create the design system document** — either an SVG showing the system visually, or a markdown file defining it textually
6. **Create the tracker** — list all screens with empty checkboxes
7. **Start with the highest-traffic screen** — the one most users see most often. This establishes patterns that all other screens follow.
8. **Work section by section** — complete all screens in a section before moving to the next. This ensures intra-section consistency.
9. **Verify each batch** — don't accumulate unverified wireframes
10. **Update the tracker with each batch** — keep it current, always
