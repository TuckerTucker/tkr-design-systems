"""
Riso component templates.

Riso's SVG library is deliberately small: the system is parametric (paper
and ink presets re-resolve every colour at runtime, see the spec's
``modes.axes``), so the authored SVGs show the default press only —
cream paper, classic drums (ink_1 federal blue, ink_2 fluorescent pink).

Riso grammar in SVG:
  Two ink layers: a ghost copy of the type in ink_2, offset +0.4px, under
  the primary ink_1 layer (the misregistration that reads as print).
  Grain: an feTurbulence overlay (``#grain`` in the shared ``<defs>``)
  applied last.
  Corners: square (radius 0 throughout).

The full HTML reference is generated separately by
tools/builders/build_riso_reference.py.

Rendered by tools/builders/build.py into systems/riso/components/.
Colours, fonts and radii are {token.path} placeholders resolved from
systems/riso/tokens.json, which is authoritative.
"""

COMPONENTS = {

    # ═════ List item — default (formerly hand-authored) ═════
    "list-item-default": (280, 96, """
  <!-- Riso list item — default state
       grammar_family: print_texture
       Active paper: cream (color.page_bg)
       Active ink: classic (ink_1=extras.color.ink_1 blue, ink_2=extras.color.ink_2 pink)

       Layered rendering:
         1. Paper background (cream)
         2. Ghost ink_2 layer (text duplicated, offset, in pink)
         3. Primary ink_1 layer (text in blue, on top)
         4. Grain overlay (feTurbulence multiply, applied last)

       Schema observation: per-component grain overlay is awkward at the
       component level — the grain should really apply to the WHOLE artifact,
       not per-component. Standalone component preview includes its own grain
       so the preview reads as Riso, but in real composition the grain is at
       the artifact level. Schema v0.2 should clarify this.
  -->

  <!-- Paper background -->
  <rect x="0" y="0" width="280" height="96" fill="{color.page_bg}"/>

  <!-- ─── GHOST INK LAYER (ink_2 pink, offset) ───
       Text duplicated, shifted +0.4px x and +0.4px y, in ink_2.
       This is what creates the duotone "registration" feel.
  -->
  <g opacity="0.65">
    <!-- Index ghost -->
    <text x="16.4" y="28.4"
          font-family="{font.mono}"
          font-size="14"
          font-weight="500"
          fill="{extras.color.ink_2}"
          letter-spacing="1.4">01</text>
    <!-- Title ghost -->
    <text x="46.4" y="28.4"
          font-family="{font.body}"
          font-size="14"
          font-weight="500"
          fill="{extras.color.ink_2}">Tokyo Trip</text>
    <!-- Preview ghost -->
    <text x="46.4" y="48.4"
          font-family="{font.body}"
          font-size="12"
          font-weight="400"
          fill="{extras.color.ink_2}">Build day-by-day itinerary?</text>
    <!-- Unread count ghost -->
    <text x="46.4" y="84.4"
          font-family="{font.body}"
          font-size="30"
          font-weight="700"
          fill="{extras.color.ink_2}">02</text>
  </g>

  <!-- ─── PRIMARY INK LAYER (ink_1 blue, on top) ───
       Same text in primary ink color, no offset.
  -->
  <!-- Index — Space Mono per riso-monospace-metadata rulebook entry -->
  <text x="16" y="28"
        font-family="{font.mono}"
        font-size="14"
        font-weight="500"
        fill="{extras.color.ink_1}"
        letter-spacing="1.4">01</text>

  <!-- Title — Space Grotesk -->
  <text x="46" y="28"
        font-family="{font.body}"
        font-size="14"
        font-weight="500"
        fill="{extras.color.ink_1}">Tokyo Trip</text>

  <!-- Timestamp top-right — Space Mono uppercase, 60% density -->
  <text x="264" y="28"
        font-family="{font.mono}"
        font-size="12"
        font-weight="500"
        fill="{extras.color.ink_1}"
        opacity="0.6"
        text-anchor="end">2M</text>

  <!-- Preview — Space Grotesk, lighter weight -->
  <text x="46" y="48"
        font-family="{font.body}"
        font-size="12"
        font-weight="400"
        fill="{extras.color.ink_1}"
        opacity="0.7">Build day-by-day itinerary?</text>

  <!-- Unread count — large duotone numeral -->
  <text x="46" y="84"
        font-family="{font.body}"
        font-size="30"
        font-weight="700"
        fill="{extras.color.ink_1}">02</text>

  <!-- ─── GRAIN OVERLAY ───
       feTurbulence noise applied as a multiply layer over everything.
       Without this, the artifact reads as flat vector — with it, it
       reads as printed.
  -->
  <rect x="0" y="0" width="280" height="96" fill="{extras.color.ink_1}" opacity="0.06"
        filter="url(#grain)"/>
"""),

    # ═════ List item — selected (formerly hand-authored) ═════
    "list-item-selected": (280, 96, """
  <!-- Riso list item — selected state
       grammar_family: print_texture
       Active paper: cream (color.page_bg)
       Active ink: classic (ink_1=extras.color.ink_1 blue, ink_2=extras.color.ink_2 pink)

       Selection signal (per riso-spec selection_signal):
         A heavier ink_1 outline rectangle wraps the row. The interior
         picks up a slightly deeper paper tone to read as "pressed
         into the page" rather than a digital highlight. The ghost ink
         offset and grain overlay are preserved so the selected row
         remains unmistakably Riso.
  -->

  <!-- Paper background, deepened by the selected-row tint
       (color.surface_selected, the JSX's selected-row fill) -->
  <rect x="0" y="0" width="280" height="96" fill="{color.page_bg}"/>
  <rect x="0" y="0" width="280" height="96" fill="{color.surface_selected}"/>

  <!-- Selection outline: thick ink_1 stroke, inset 2px -->
  <rect x="2" y="2" width="276" height="92" fill="none"
        stroke="{extras.color.ink_1}" stroke-width="2"/>

  <!-- ─── GHOST INK LAYER (ink_2 pink, offset) ─── -->
  <g opacity="0.65">
    <text x="16.4" y="28.4"
          font-family="{font.mono}"
          font-size="14"
          font-weight="500"
          fill="{extras.color.ink_2}"
          letter-spacing="1.4">01</text>
    <text x="46.4" y="28.4"
          font-family="{font.body}"
          font-size="14"
          font-weight="500"
          fill="{extras.color.ink_2}">Tokyo Trip</text>
    <text x="46.4" y="48.4"
          font-family="{font.body}"
          font-size="12"
          font-weight="400"
          fill="{extras.color.ink_2}">Build day-by-day itinerary?</text>
    <text x="46.4" y="84.4"
          font-family="{font.body}"
          font-size="30"
          font-weight="700"
          fill="{extras.color.ink_2}">02</text>
  </g>

  <!-- ─── PRIMARY INK LAYER (ink_1 blue, on top) ─── -->
  <text x="16" y="28"
        font-family="{font.mono}"
        font-size="14"
        font-weight="500"
        fill="{extras.color.ink_1}"
        letter-spacing="1.4">01</text>

  <text x="46" y="28"
        font-family="{font.body}"
        font-size="14"
        font-weight="500"
        fill="{extras.color.ink_1}">Tokyo Trip</text>

  <text x="264" y="28"
        font-family="{font.mono}"
        font-size="12"
        font-weight="500"
        fill="{extras.color.ink_1}"
        opacity="0.6"
        text-anchor="end">2M</text>

  <text x="46" y="48"
        font-family="{font.body}"
        font-size="12"
        font-weight="400"
        fill="{extras.color.ink_1}"
        opacity="0.7">Build day-by-day itinerary?</text>

  <text x="46" y="84"
        font-family="{font.body}"
        font-size="30"
        font-weight="700"
        fill="{extras.color.ink_1}">02</text>

  <!-- ─── GRAIN OVERLAY ─── -->
  <rect x="0" y="0" width="280" height="96" fill="{extras.color.ink_1}" opacity="0.06"
        filter="url(#grain)"/>
"""),

}
