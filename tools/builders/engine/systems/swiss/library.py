"""
Swiss component templates (LIBRARY-SPEC vocabulary).
Same component names and variants as the wireframe library;
Swiss's grammar applied to each.

Swiss grammar:
  Inter typeface, 7 sizes (9, 11, 13, 14, 22, 32, 40)
  Palette: white #FFFFFF, gray #F5F5F5, black #000000, red #E3000B accent
  Spacing: strict 8-grid
  Borders: 0 radius everywhere, 1px rules at 3 weights (#F0F0F0/#E0E0E0/#000000)
  Selection: 2px red accent bar (left edge) + #F5F5F5 surface fill
  Typography signatures: zero-padded indices, numerical display for counts,
  uppercase tracked metadata, single typeface (Inter)

Coverage scope (Phase A first pass):
  Primitives: button, input, checkbox, radio, toggle, label, badge, divider
              (skip: textarea, select, icon, avatar — minor variations from wireframe)
  Composites: card, list_item, form_field, table_row, table_header, nav_item,
              tab_item, stat, search_bar
              (skip: breadcrumb_trail, pagination, toast, key_value, button_group,
              banner, accordion_item, stepper, dropdown_menu — pattern-following)
  Patterns: dashboard (already authored), settings_layout, form, data_table, auth-sign-in
              (skip: header, sidebar, modal, drawer, empty_state, command_palette,
              article — extend later as Swiss is actually used)

Rendered by tools/builders/build.py into systems/swiss/components/.
Colours, fonts, radii and border widths are {token.path} placeholders
resolved from systems/swiss/tokens.json, which is authoritative;
values quoted above describe the grammar and may lag the token file.
"""

COMPONENTS = {

    # ═════════════════════ PRIMITIVES ═════════════════════

    # Button — Swiss has minimal, hard-edged buttons. Primary uses red text
    # (CTA category in the rulebook), no fill. Secondary is black text on
    # gray surface. Disabled is muted gray.

    "button-primary": (140, 48, """
  <rect width="140" height="48" fill="{color.surface}"/>
  <text x="70" y="30" text-anchor="middle" class="text-accent" font-size="14" font-weight="500">Send →</text>
"""),

    "button-secondary": (140, 48, """
  <rect width="140" height="48" fill="{color.surface}"/>
  <text x="70" y="30" text-anchor="middle" class="text-primary" font-size="14" font-weight="500">Cancel</text>
"""),

    "button-text": (140, 48, """
  <rect width="140" height="48" fill="transparent"/>
  <text x="70" y="30" text-anchor="middle" class="text-secondary" font-size="14">Learn more</text>
"""),

    "button-disabled": (140, 48, """
  <rect width="140" height="48" fill="{color.surface_elevated}"/>
  <text x="70" y="30" text-anchor="middle" class="text-disabled" font-size="14" font-weight="500">Unavailable</text>
"""),

    # Input — single-line text. Swiss style: 1px black top rule (no full border),
    # placeholder is a single lowercase word per rulebook.

    "input-text": (320, 56, """
  <text x="0" y="14" class="text-secondary" font-size="11" font-weight="500" letter-spacing="1.76">LABEL</text>
  <line x1="0" y1="22" x2="320" y2="22" stroke="{color.border_input}" stroke-width="{border_width.default}"/>
  <text x="0" y="44" class="text-disabled" font-size="14">type</text>
"""),

    "input-search": (320, 32, """
  <line x1="0" y1="0" x2="320" y2="0" stroke="{color.border_input}" stroke-width="{border_width.default}"/>
  <text x="0" y="22" class="text-disabled" font-size="14">search</text>
"""),

    # Checkbox — Swiss style: zero radius square, black fill when checked
    "checkbox-checked": (200, 24, """
  <rect width="20" height="20" fill="{color.text_primary}"/>
  <path d="M 5 10 L 9 14 L 16 6" fill="none" stroke="{color.text_inverse}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="32" y="15" class="text-primary" font-size="13">Selected option</text>
"""),

    "checkbox-unchecked": (200, 24, """
  <rect width="20" height="20" fill="{color.surface}" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="32" y="15" class="text-primary" font-size="13">Unselected option</text>
"""),

    # Radio — Swiss prefers the same hard-edged geometry; circle for radio
    # is permissible since it's the universal radio shape, but kept minimal.
    "radio-selected": (200, 24, """
  <circle cx="10" cy="10" r="9.5" fill="{color.surface}" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <circle cx="10" cy="10" r="5" fill="{color.text_primary}"/>
  <text x="32" y="15" class="text-primary" font-size="13">Selected</text>
"""),

    "radio-unselected": (200, 24, """
  <circle cx="10" cy="10" r="9.5" fill="{color.surface}" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="32" y="15" class="text-primary" font-size="13">Unselected</text>
"""),

    # Toggle — Swiss uses hard-edged track (no radius), red when on
    "toggle-on": (200, 24, """
  <rect width="44" height="24" fill="{color.text_primary}"/>
  <rect x="22" y="2" width="20" height="20" fill="{color.surface}"/>
  <text x="56" y="17" class="text-primary" font-size="13">On</text>
"""),

    "toggle-off": (200, 24, """
  <rect width="44" height="24" fill="{color.surface}" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <rect x="2" y="2" width="20" height="20" fill="{color.text_primary}"/>
  <text x="56" y="17" class="text-primary" font-size="13">Off</text>
"""),

    # Label — minimal, uses the metadata pattern when 9px+
    "label-default": (200, 14, """
  <text x="0" y="11" class="text-secondary" font-size="11">Label text</text>
"""),

    "label-required": (200, 14, """
  <text x="0" y="11" class="text-secondary" font-size="11">Label text *</text>
"""),

    "label-metadata": (200, 14, """
  <text x="0" y="11" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">METADATA LABEL</text>
"""),

    # Badge — per Swiss rulebook, NO badge variants for counts (use display type).
    # Status dots and tags are permitted.
    "badge-status-dot": (8, 8, """
  <circle cx="4" cy="4" r="4" fill="{color.accent}"/>
"""),

    "badge-tag": (80, 22, """
  <text x="0" y="14" class="text-secondary" font-size="11" font-weight="500" letter-spacing="0.44">CATEGORY</text>
"""),

    # Divider — three weights per Swiss elevation strategy
    "divider-hairline": (320, 1, """
  <line x1="0" y1="0.5" x2="320" y2="0.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
"""),

    "divider-default": (320, 1, """
  <line x1="0" y1="0.5" x2="320" y2="0.5" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
"""),

    "divider-strong": (320, 1, """
  <line x1="0" y1="0.5" x2="320" y2="0.5" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
"""),


    # ═════════════════════ COMPOSITES ═════════════════════

    # Card — Swiss has minimal cards. Default has no surface (transparent),
    # gray surface only when containment is needed.

    "card-default": (320, 120, """
  <text x="0" y="14" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">CARD LABEL</text>
  <text x="0" y="40" class="text-primary" font-size="14">Card content with no surface,</text>
  <text x="0" y="60" class="text-secondary" font-size="13">just label and content.</text>
"""),

    "card-gray-surface": (320, 120, """
  <rect width="320" height="120" fill="{color.surface_elevated}"/>
  <text x="16" y="30" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">CONTAINED CARD</text>
  <text x="16" y="56" class="text-primary" font-size="14">Used when layout demands</text>
  <text x="16" y="76" class="text-primary" font-size="14">visual containment.</text>
  <text x="16" y="100" class="text-secondary" font-size="13">No border, no radius.</text>
"""),

    # List item — Swiss's signature component, already authored in v0.1.
    # Re-author here against the new structured anatomy from v0.2.

    "list-item-default": (280, 96, """
  <rect width="280" height="96" fill="{color.surface}"/>
  <line x1="0" y1="95.5" x2="280" y2="95.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
  <text x="16" y="28" class="text-primary" font-size="14" font-weight="500">01</text>
  <text x="264" y="28" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44" text-anchor="end">2M</text>
  <text x="40" y="28" class="text-primary" font-size="13" font-weight="500">Tokyo Trip</text>
  <text x="40" y="46" class="text-secondary" font-size="11">Build day-by-day…</text>
  <text x="40" y="80" class="text-primary" font-size="32" font-weight="500">02</text>
"""),

    "list-item-selected": (280, 96, """
  <rect width="280" height="96" fill="{color.surface_selected}"/>
  <rect x="0" y="0" width="2" height="96" fill="{color.accent}"/>
  <line x1="0" y1="95.5" x2="280" y2="95.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
  <text x="18" y="28" class="text-primary" font-size="14" font-weight="500">01</text>
  <text x="264" y="28" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44" text-anchor="end">2M</text>
  <text x="42" y="28" class="text-primary" font-size="13" font-weight="700">Tokyo Trip</text>
  <text x="42" y="46" class="text-secondary" font-size="11">Build day-by-day…</text>
  <text x="42" y="80" class="text-primary" font-size="32" font-weight="500">02</text>
"""),

    "list-item-compact": (280, 48, """
  <rect width="280" height="48" fill="{color.surface}"/>
  <line x1="0" y1="47.5" x2="280" y2="47.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
  <text x="16" y="30" class="text-primary" font-size="14" font-weight="500">02</text>
  <text x="40" y="30" class="text-primary" font-size="13" font-weight="500">Recipe Ideas</text>
  <text x="264" y="30" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44" text-anchor="end">1H</text>
"""),

    # Form field — Swiss style: label above input, input is single black top rule
    "form-field-default": (320, 56, """
  <text x="0" y="14" class="text-secondary" font-size="11" font-weight="500" letter-spacing="1.76">EMAIL ADDRESS</text>
  <line x1="0" y1="22" x2="320" y2="22" stroke="{color.border_input}" stroke-width="{border_width.default}"/>
  <text x="0" y="44" class="text-disabled" font-size="14">user@example.com</text>
"""),

    # Error treatment (spec components.error_message): typographic only.
    # The input keeps its ordinary black rule; the error is the ink line
    # "Error: <what failed>." below it. No red rule, icon or fill.
    "form-field-with-error": (320, 70, """
  <text x="0" y="14" class="text-secondary" font-size="11" font-weight="500" letter-spacing="1.76">EMAIL ADDRESS</text>
  <line x1="0" y1="22" x2="320" y2="22" stroke="{color.border_input}" stroke-width="{border_width.default}"/>
  <text x="0" y="44" class="text-primary" font-size="14">invalid-email</text>
  <text x="0" y="64" class="text-primary" font-size="11">Error: invalid email address.</text>
"""),

    # Table row — Swiss style: zero-padded row numbers, hairline dividers,
    # uppercase metadata
    "table-row-default": (640, 48, """
  <rect width="640" height="48" fill="{color.surface}"/>
  <line x1="0" y1="47.5" x2="640" y2="47.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
  <text x="16" y="30" class="text-primary" font-size="13" font-weight="500">01</text>
  <text x="48" y="30" class="text-primary" font-size="13">Alex Rivera</text>
  <text x="240" y="30" class="text-secondary" font-size="13">alex@northwind.com</text>
  <text x="480" y="30" class="text-secondary" font-size="13">Administrator</text>
  <text x="624" y="30" text-anchor="end" class="text-secondary" font-size="11" font-weight="500" letter-spacing="1.76">ACTIVE</text>
"""),

    "table-row-header": (640, 32, """
  <rect width="640" height="32" fill="{color.surface}"/>
  <line x1="0" y1="31.5" x2="640" y2="31.5" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="16" y="22" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">#</text>
  <text x="48" y="22" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">NAME</text>
  <text x="240" y="22" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">EMAIL</text>
  <text x="480" y="22" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">ROLE</text>
  <text x="624" y="22" text-anchor="end" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">STATUS</text>
"""),

    "table-row-selected": (640, 48, """
  <rect width="640" height="48" fill="{color.surface_selected}"/>
  <rect x="0" y="0" width="2" height="48" fill="{color.accent}"/>
  <line x1="0" y1="47.5" x2="640" y2="47.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
  <text x="18" y="30" class="text-primary" font-size="13" font-weight="700">01</text>
  <text x="50" y="30" class="text-primary" font-size="13" font-weight="500">Alex Rivera</text>
  <text x="240" y="30" class="text-secondary" font-size="13">alex@northwind.com</text>
  <text x="480" y="30" class="text-secondary" font-size="13">Administrator</text>
  <text x="624" y="30" text-anchor="end" class="text-secondary" font-size="11" font-weight="500" letter-spacing="1.76">ACTIVE</text>
"""),

    # Table header — same as table-row-header but standalone for composability
    "table-header-default": (640, 32, """
  <rect width="640" height="32" fill="{color.surface}"/>
  <line x1="0" y1="31.5" x2="640" y2="31.5" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="16" y="22" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">#</text>
  <text x="48" y="22" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">NAME</text>
  <text x="240" y="22" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">EMAIL</text>
  <text x="480" y="22" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">ROLE</text>
"""),

    # Nav item — Swiss style: minimal, label + optional metadata badge
    "nav-item-default": (240, 32, """
  <text x="16" y="20" class="text-secondary" font-size="13">Projects</text>
"""),

    "nav-item-active": (240, 32, """
  <rect x="0" y="0" width="2" height="32" fill="{color.accent}"/>
  <text x="18" y="20" class="text-primary" font-size="13" font-weight="700">Dashboard</text>
"""),

    "nav-item-with-count": (240, 32, """
  <text x="16" y="20" class="text-secondary" font-size="13">Inbox</text>
  <text x="224" y="20" text-anchor="end" class="text-primary" font-size="22" font-weight="500">12</text>
"""),

    # Tab item — underline pattern in red
    "tab-item-default": (120, 40, """
  <text x="60" y="26" text-anchor="middle" class="text-secondary" font-size="13">Tab Label</text>
"""),

    "tab-item-active": (120, 40, """
  <text x="60" y="26" text-anchor="middle" class="text-primary" font-size="13" font-weight="600">Active Tab</text>
  <line x1="0" y1="38" x2="120" y2="38" stroke="{color.accent}" stroke-width="2"/>
"""),

    # Stat — Swiss's hero treatment. Numerical display is the system's signature.
    "stat-default": (200, 80, """
  <text x="0" y="14" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">REVENUE</text>
  <text x="0" y="56" class="text-primary" font-size="40" font-weight="500">24,580</text>
  <text x="0" y="76" class="text-secondary" font-size="11">vs 21,200 last month</text>
"""),

    "stat-with-currency": (200, 80, """
  <text x="0" y="14" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">REVENUE USD</text>
  <text x="0" y="56" class="text-primary" font-size="40" font-weight="500">24,580</text>
  <text x="0" y="76" class="text-secondary" font-size="11">vs 21,200 last month</text>
"""),

    "stat-large": (240, 100, """
  <text x="0" y="14" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">ACTIVE SESSIONS</text>
  <text x="0" y="72" class="text-primary" font-size="40" font-weight="500">1,247</text>
  <text x="0" y="96" class="text-secondary" font-size="11">+8% this week</text>
"""),

    # Search bar — Swiss style: 1px black top rule, lowercase placeholder
    "search-bar-default": (480, 32, """
  <line x1="0" y1="0" x2="480" y2="0" stroke="{color.border_input}" stroke-width="{border_width.default}"/>
  <text x="0" y="22" class="text-disabled" font-size="14">search</text>
"""),

    "search-bar-with-results": (480, 56, """
  <line x1="0" y1="0" x2="480" y2="0" stroke="{color.border_input}" stroke-width="{border_width.default}"/>
  <text x="0" y="22" class="text-primary" font-size="14">design</text>
  <text x="0" y="48" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">247 RESULTS</text>
"""),

    # ─────────── ADDED IN PHASE 2 (Item 3): missing primitives ───────────

    # Textarea — multi-line input. Same 1px black top-rule grammar as input,
    # extended height. Placeholder is single lowercase word per Swiss.
    "textarea-default": (320, 120, """
  <text x="0" y="14" class="text-secondary" font-size="11" font-weight="500" letter-spacing="1.76">MESSAGE</text>
  <line x1="0" y1="22" x2="320" y2="22" stroke="{color.border_input}" stroke-width="{border_width.default}"/>
  <text x="0" y="44" class="text-disabled" font-size="14">type</text>
  <line x1="0" y1="119.5" x2="320" y2="119.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
"""),

    "textarea-filled": (320, 120, """
  <text x="0" y="14" class="text-secondary" font-size="11" font-weight="500" letter-spacing="1.76">BIO</text>
  <line x1="0" y1="22" x2="320" y2="22" stroke="{color.border_input}" stroke-width="{border_width.default}"/>
  <text x="0" y="44" class="text-primary" font-size="14">Designer based in Zürich, focused on</text>
  <text x="0" y="64" class="text-primary" font-size="14">systems and editorial typography.</text>
  <line x1="0" y1="119.5" x2="320" y2="119.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
"""),

    # Select — Swiss dropdown is the input grammar with a small ↓ on the right.
    # No box, no rounded corners; the indicator is a typographic glyph.
    "select-default": (320, 56, """
  <text x="0" y="14" class="text-secondary" font-size="11" font-weight="500" letter-spacing="1.76">TIME ZONE</text>
  <line x1="0" y1="22" x2="320" y2="22" stroke="{color.border_input}" stroke-width="{border_width.default}"/>
  <text x="0" y="44" class="text-primary" font-size="14">America/Los_Angeles</text>
  <text x="320" y="44" text-anchor="end" class="text-secondary" font-size="14">↓</text>
"""),

    "select-empty": (320, 56, """
  <text x="0" y="14" class="text-secondary" font-size="11" font-weight="500" letter-spacing="1.76">ROLE</text>
  <line x1="0" y1="22" x2="320" y2="22" stroke="{color.border_input}" stroke-width="{border_width.default}"/>
  <text x="0" y="44" class="text-disabled" font-size="14">choose</text>
  <text x="320" y="44" text-anchor="end" class="text-secondary" font-size="14">↓</text>
"""),

    # Icon — Swiss uses minimal typographic glyphs (→, ↓, +, ×) rather than
    # bitmap or stroke icons. The "default" variant is a sized → on
    # background; the "outlined"/"filled" variants are not meaningful in
    # Swiss's ascetic vocabulary, so we render placeholder boxes that read
    # as "icon slot reserved" — wireframe consumers pick more specific
    # glyphs at composition time.
    "icon-arrow": (24, 24, """
  <text x="12" y="18" text-anchor="middle" class="text-primary" font-size="14" font-weight="500">→</text>
"""),

    "icon-plus": (24, 24, """
  <text x="12" y="18" text-anchor="middle" class="text-primary" font-size="14" font-weight="500">+</text>
"""),

    "icon-close": (24, 24, """
  <text x="12" y="18" text-anchor="middle" class="text-primary" font-size="14" font-weight="500">×</text>
"""),

    "icon-placeholder": (24, 24, """
  <rect x="0" y="0" width="24" height="24" fill="{color.surface_elevated}"/>
"""),

    # Avatar — Swiss explicitly forbids photo/emoji avatars (rulebook
    # swiss-no-emoji-imagery). Identity is a zero-padded numeric index, or
    # for chat-style headers, a single uppercase letter monogram. No fill,
    # no border, no radius. The avatar IS the type.
    "avatar-index": (40, 40, """
  <text x="0" y="32" class="text-primary" font-size="22" font-weight="500">01</text>
"""),

    "avatar-monogram": (40, 40, """
  <text x="0" y="32" class="text-primary" font-size="22" font-weight="500">T</text>
"""),

    "avatar-with-status": (48, 40, """
  <text x="0" y="32" class="text-primary" font-size="22" font-weight="500">01</text>
  <circle cx="44" cy="8" r="3" fill="{color.accent}"/>
"""),

    # ─────────── ADDED IN PHASE 2 (Item 3): missing composites ───────────

    # Breadcrumb trail — Swiss uses typographic `/` as separator (not
    # chevron). Current segment is black + weight 500; ancestor segments
    # in #666 secondary. Last segment trails to nothing.
    "breadcrumb-default": (480, 24, """
  <text x="0" y="16" class="text-secondary" font-size="11">Home</text>
  <text x="48" y="16" class="text-secondary" font-size="11">/</text>
  <text x="64" y="16" class="text-secondary" font-size="11">Settings</text>
  <text x="120" y="16" class="text-secondary" font-size="11">/</text>
  <text x="136" y="16" class="text-primary" font-size="11" font-weight="500">Profile</text>
"""),

    "breadcrumb-truncated": (480, 24, """
  <text x="0" y="16" class="text-secondary" font-size="11">Home</text>
  <text x="48" y="16" class="text-secondary" font-size="11">/</text>
  <text x="64" y="16" class="text-secondary" font-size="11">…</text>
  <text x="80" y="16" class="text-secondary" font-size="11">/</text>
  <text x="96" y="16" class="text-primary" font-size="11" font-weight="500">Profile</text>
"""),

    # Pagination — Swiss "N OF TOTAL" metadata + prev/next as text.
    # No buttons-as-pills; the navigation IS the type.
    "pagination-default": (480, 32, """
  <text x="0" y="22" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">05 OF 247</text>
  <text x="408" y="22" class="text-secondary" font-size="11">‹ Prev</text>
  <text x="448" y="22" class="text-primary" font-size="11" font-weight="500">Next ›</text>
"""),

    "pagination-numbered": (480, 32, """
  <text x="0" y="22" class="text-secondary" font-size="11">‹</text>
  <text x="32" y="22" class="text-primary" font-size="11" font-weight="500">01</text>
  <text x="64" y="22" class="text-secondary" font-size="11">02</text>
  <text x="96" y="22" class="text-secondary" font-size="11">03</text>
  <text x="128" y="22" class="text-secondary" font-size="11">04</text>
  <text x="160" y="22" class="text-secondary" font-size="11">05</text>
  <text x="192" y="22" class="text-secondary" font-size="11">›</text>
"""),

    # Toast — transient notification. Swiss toast is a 1px black band with
    # 9px tracked uppercase severity label, body text in 13px, and a × dismiss
    # right-aligned. No box, no shadow, no rounded surface. Severity is
    # carried by copy, not colour: the error toast's body reads
    # "Error: <what failed>." in ink (spec components.error_message); red
    # stays inside its four contexts (swiss-red-finite-resource).
    "toast-info": (400, 64, """
  <line x1="0" y1="0" x2="400" y2="0" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="0" y="22" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">UPDATE</text>
  <text x="0" y="46" class="text-primary" font-size="13">Profile saved successfully.</text>
  <text x="392" y="22" text-anchor="end" class="text-secondary" font-size="14">×</text>
  <line x1="0" y1="63.5" x2="400" y2="63.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
"""),

    "toast-error": (400, 64, """
  <line x1="0" y1="0" x2="400" y2="0" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="0" y="22" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">CONNECTION</text>
  <text x="0" y="46" class="text-primary" font-size="13">Error: could not connect to the server.</text>
  <text x="392" y="22" text-anchor="end" class="text-secondary" font-size="14">×</text>
  <line x1="0" y1="63.5" x2="400" y2="63.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
"""),

    # Key-value — Swiss key:value rows. KEY in 9px tracked uppercase
    # secondary; value in 13px primary. Inline variant aligns left;
    # tabular variant uses right-aligned key column.
    "key-value-default": (320, 40, """
  <text x="0" y="16" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">DISPLAY NAME</text>
  <text x="0" y="34" class="text-primary" font-size="13">Alex Rivera</text>
"""),

    "key-value-inline": (320, 24, """
  <text x="0" y="16" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">PLAN</text>
  <text x="80" y="16" class="text-primary" font-size="11" font-weight="500">Pro</text>
"""),

    "key-value-tabular": (320, 24, """
  <text x="120" y="16" text-anchor="end" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">JOINED</text>
  <text x="136" y="16" class="text-primary" font-size="11">Jan 2024</text>
"""),

    # Button group — Swiss buttons separated by 1px hairlines, no shared
    # background. Each button is text-only.
    "button-group-default": (320, 48, """
  <text x="40" y="30" text-anchor="middle" class="text-primary" font-size="14" font-weight="500">All</text>
  <line x1="80" y1="16" x2="80" y2="32" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
  <text x="120" y="30" text-anchor="middle" class="text-primary" font-size="14">Active</text>
  <line x1="160" y1="16" x2="160" y2="32" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
  <text x="200" y="30" text-anchor="middle" class="text-primary" font-size="14">Archived</text>
  <line x1="240" y1="16" x2="240" y2="32" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
  <text x="280" y="30" text-anchor="middle" class="text-secondary" font-size="14">Draft</text>
"""),

    "button-group-segmented": (320, 48, """
  <line x1="0" y1="0" x2="320" y2="0" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="40" y="32" text-anchor="middle" class="text-primary" font-size="14" font-weight="500">Day</text>
  <text x="120" y="32" text-anchor="middle" class="text-secondary" font-size="14">Week</text>
  <text x="200" y="32" text-anchor="middle" class="text-secondary" font-size="14">Month</text>
  <text x="280" y="32" text-anchor="middle" class="text-secondary" font-size="14">Year</text>
  <line x1="0" y1="47.5" x2="320" y2="47.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
"""),

    # Banner — full-width thin band. Hairlines top and bottom, 9px tracked
    # uppercase grey label on the left, body 13px ink in middle, optional
    # action on the right (red text → for primary). A warning is typographic
    # like error_message: grey label, ink copy, no red (the JSX lists red
    # warning messages as a Don't; spec components.warning_message).
    "banner-info": (640, 56, """
  <line x1="0" y1="0" x2="640" y2="0" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="0" y="34" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">UPDATE</text>
  <text x="80" y="34" class="text-primary" font-size="13">A new version of the editor is available.</text>
  <text x="624" y="34" text-anchor="end" class="text-accent" font-size="13" font-weight="500">Reload →</text>
  <line x1="0" y1="55.5" x2="640" y2="55.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
"""),

    "banner-warning": (640, 56, """
  <line x1="0" y1="0" x2="640" y2="0" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="0" y="34" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">ATTENTION</text>
  <text x="96" y="34" class="text-primary" font-size="13">Your trial ends in 3 days.</text>
  <text x="624" y="34" text-anchor="end" class="text-primary" font-size="13" font-weight="500">Upgrade →</text>
  <line x1="0" y1="55.5" x2="640" y2="55.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
"""),

    # Accordion item — title row with chevron indicator. Default shows
    # only the row; expanded shows the body indented below with hairline.
    "accordion-default": (480, 56, """
  <text x="0" y="34" class="text-primary" font-size="14" font-weight="500">Notifications</text>
  <text x="472" y="34" text-anchor="end" class="text-secondary" font-size="14">↓</text>
  <line x1="0" y1="55.5" x2="480" y2="55.5" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
"""),

    "accordion-expanded": (480, 144, """
  <text x="0" y="34" class="text-primary" font-size="14" font-weight="500">Notifications</text>
  <text x="472" y="34" text-anchor="end" class="text-secondary" font-size="14">↑</text>
  <line x1="0" y1="55.5" x2="480" y2="55.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
  <text x="0" y="80" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">EMAIL</text>
  <text x="0" y="104" class="text-primary" font-size="13">Daily digest at 09:00</text>
  <text x="0" y="128" class="text-secondary" font-size="13">Replies in real time</text>
  <line x1="0" y1="143.5" x2="480" y2="143.5" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
"""),

    # Stepper — zero-padded indices connected by horizontal rules. Active
    # step is black + weight 500; future steps are #666; completed steps
    # render the same as future (Swiss minimalism — no checkmarks).
    "stepper-numbered": (640, 64, """
  <text x="40" y="32" text-anchor="middle" class="text-primary" font-size="22" font-weight="500">01</text>
  <text x="40" y="56" text-anchor="middle" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">ACCOUNT</text>
  <line x1="80" y1="24" x2="200" y2="24" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
  <text x="240" y="32" text-anchor="middle" class="text-secondary" font-size="22">02</text>
  <text x="240" y="56" text-anchor="middle" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">PLAN</text>
  <line x1="280" y1="24" x2="400" y2="24" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
  <text x="440" y="32" text-anchor="middle" class="text-secondary" font-size="22">03</text>
  <text x="440" y="56" text-anchor="middle" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">PAYMENT</text>
  <line x1="480" y1="24" x2="600" y2="24" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
  <text x="640" y="32" text-anchor="end" class="text-secondary" font-size="22">04</text>
  <text x="640" y="56" text-anchor="end" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">REVIEW</text>
"""),

    "stepper-linear": (640, 32, """
  <text x="0" y="22" class="text-primary" font-size="9" font-weight="500" letter-spacing="1.44">STEP 02 / 04</text>
  <line x1="0" y1="31.5" x2="320" y2="31.5" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <line x1="320" y1="31.5" x2="640" y2="31.5" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
"""),

    # Dropdown menu — vertical list of actions, hairline separators. No
    # surrounding box (the dropdown sits on the page surface), no shadow.
    # Every item is ink, Sign out included: a menu item is not one of red's
    # four contexts (it is no CTA label, and a red exit would read as a
    # warning, which the JSX forbids in red).
    "dropdown-default": (240, 144, """
  <line x1="0" y1="0" x2="240" y2="0" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="16" y="32" class="text-primary" font-size="13">Edit profile</text>
  <line x1="0" y1="47.5" x2="240" y2="47.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
  <text x="16" y="80" class="text-primary" font-size="13">Notifications</text>
  <line x1="0" y1="95.5" x2="240" y2="95.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
  <text x="16" y="128" class="text-primary" font-size="13">Sign out</text>
  <line x1="0" y1="143.5" x2="240" y2="143.5" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
"""),

    "dropdown-with-groups": (240, 200, """
  <line x1="0" y1="0" x2="240" y2="0" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="16" y="24" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">ACCOUNT</text>
  <text x="16" y="48" class="text-primary" font-size="13">Profile</text>
  <text x="16" y="72" class="text-primary" font-size="13">Settings</text>
  <line x1="0" y1="87.5" x2="240" y2="87.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
  <text x="16" y="112" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">WORKSPACE</text>
  <text x="16" y="136" class="text-primary" font-size="13">Switch team</text>
  <text x="16" y="160" class="text-primary" font-size="13">Members</text>
  <line x1="0" y1="175.5" x2="240" y2="175.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
  <text x="16" y="192" class="text-primary" font-size="13">Sign out</text>
  <line x1="0" y1="199.5" x2="240" y2="199.5" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
"""),

}
