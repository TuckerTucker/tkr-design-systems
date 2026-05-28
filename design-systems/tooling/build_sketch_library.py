#!/usr/bin/env python3
"""
Build the Sketch design system's component library against the LIBRARY-SPEC
vocabulary. Sketch is contemporary_clean with warm beige, purple annotations,
and IBM Plex Sans throughout. No emoji; identity uses single-letter monograms
in rounded-square avatars.

Sketch tokens:
  IBM Plex Sans typeface (structural), Caveat (annotations only)
  8 sizes: 9, 10, 11, 12, 13, 14, 15, 17, 22
  Palette: warm beige #FAFAF8, warm-surface #F0EDE8, purple #B8A9C8,
           purple-light #C4B8D4, text #2C2C2C, text-secondary #555555,
           muted #8A8680, warm-rule #E5E3DE
  Spacing: 2-grid (2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32)
  Borders: 8-14px radius (cards/chrome), 6-8px radius (avatars/badges—rounded squares)
  Elevation: 1px borders + warm-surface fills, no shadows
  Avatar: 34×34 rounded-square (8px radius) with monogram
  Badge: 18×18 purple rounded-square (6px radius) with white digit
  Selection: warm-surface fill + 1px border, no accent bar

Coverage scope (Phase A first pass):
  Primitives: button, input, textarea, select, checkbox, radio, toggle, label,
              icon, avatar, badge, divider (all 12)
  Composites: card, list_item, form_field, table_row, table_header, nav_item,
              tab_item, breadcrumb_trail, pagination, toast, stat, key_value,
              button_group, search_bar, banner, accordion_item (~15 = substantial)

Output goes to ./sketch-library/components/
"""

import sys
from pathlib import Path

# ──────────────────────────────────────────────────────────────────────
# SKETCH WRAPPER
# ──────────────────────────────────────────────────────────────────────

STANDARD_DEFS = """  <defs>
    <style>
      .text-primary { fill: #2C2C2C; font-family: 'IBM Plex Sans', system-ui, sans-serif; }
      .text-secondary { fill: #555555; font-family: 'IBM Plex Sans', system-ui, sans-serif; }
      .text-muted { fill: #8A8680; font-family: 'IBM Plex Sans', system-ui, sans-serif; }
      .text-accent { fill: #B8A9C8; font-family: 'IBM Plex Sans', system-ui, sans-serif; }
      .text-annotation { fill: #B8A9C8; font-family: Caveat, cursive; }
    </style>
  </defs>"""


def wrap_svg(width: int, height: int, body: str, comment: str = "") -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">
{STANDARD_DEFS}
  {comment}
{body}
</svg>
"""


# ──────────────────────────────────────────────────────────────────────
# COMPONENTS
# ──────────────────────────────────────────────────────────────────────

COMPONENTS = {

    # ═════════════════════ PRIMITIVES ═════════════════════

    # Button — Sketch buttons are text-only or with rounded background.
    # Primary: text on warm-surface rounded background.
    # Secondary: text-only.
    # Ghost: minimal, no background.
    # Disabled: muted text, no interaction.

    "button-primary": (140, 48, """
  <rect x="0" y="0" width="140" height="48" fill="#F0EDE8" stroke="#E5E3DE" stroke-width="1" rx="10" ry="10"/>
  <text x="70" y="32" text-anchor="middle" class="text-primary" font-size="14" font-weight="600" letter-spacing="-0.02em">Send</text>
"""),

    "button-secondary": (140, 48, """
  <rect x="0" y="0" width="140" height="48" fill="#FAFAF8" stroke="#E5E3DE" stroke-width="1" rx="10" ry="10"/>
  <text x="70" y="32" text-anchor="middle" class="text-primary" font-size="14" font-weight="600" letter-spacing="-0.02em">Cancel</text>
"""),

    "button-ghost": (140, 48, """
  <rect x="0" y="0" width="140" height="48" fill="transparent"/>
  <text x="70" y="32" text-anchor="middle" class="text-secondary" font-size="14" font-weight="600" letter-spacing="-0.02em">Learn more</text>
"""),

    "button-disabled": (140, 48, """
  <rect x="0" y="0" width="140" height="48" fill="#F7F5F0" stroke="#E5E3DE" stroke-width="1" rx="10" ry="10"/>
  <text x="70" y="32" text-anchor="middle" class="text-muted" font-size="14" font-weight="600" letter-spacing="-0.02em">Unavailable</text>
"""),

    # Input — rounded 10px, single line. Placeholder in muted text.
    "input-text": (320, 56, """
  <rect x="0" y="0" width="320" height="56" fill="#FFFFFF" stroke="#E5E3DE" stroke-width="1" rx="10" ry="10"/>
  <text x="12" y="35" class="text-muted" font-size="14" letter-spacing="-0.02em">Enter text here</text>
"""),

    "input-password": (320, 56, """
  <rect x="0" y="0" width="320" height="56" fill="#FFFFFF" stroke="#E5E3DE" stroke-width="1" rx="10" ry="10"/>
  <text x="12" y="35" class="text-muted" font-size="14" letter-spacing="-0.02em">••••••••</text>
"""),

    "input-search": (320, 56, """
  <rect x="0" y="0" width="320" height="56" fill="#FFFFFF" stroke="#E5E3DE" stroke-width="1" rx="10" ry="10"/>
  <text x="12" y="35" class="text-muted" font-size="14" letter-spacing="-0.02em">Search...</text>
"""),

    # Textarea — multi-line input with rounded corners.
    "textarea-default": (320, 120, """
  <rect x="0" y="0" width="320" height="120" fill="#FFFFFF" stroke="#E5E3DE" stroke-width="1" rx="10" ry="10"/>
  <text x="12" y="28" class="text-muted" font-size="14" letter-spacing="-0.02em">Enter your message...</text>
"""),

    "textarea-autogrow": (320, 80, """
  <rect x="0" y="0" width="320" height="80" fill="#FFFFFF" stroke="#E5E3DE" stroke-width="1" rx="10" ry="10"/>
  <text x="12" y="28" class="text-primary" font-size="14" letter-spacing="-0.02em">This field grows as you type.</text>
  <text x="12" y="54" class="text-primary" font-size="14" letter-spacing="-0.02em">Useful for long-form input.</text>
"""),

    # Select — rounded input with chevron indicator (rotated Caveat ↓).
    "select-default": (320, 56, """
  <rect x="0" y="0" width="320" height="56" fill="#FFFFFF" stroke="#E5E3DE" stroke-width="1" rx="10" ry="10"/>
  <text x="12" y="35" class="text-primary" font-size="14" letter-spacing="-0.02em">Choose one</text>
  <g transform="rotate(-2, 308, 28)">
    <text x="308" y="35" text-anchor="end" font-family="Caveat, cursive" font-size="14" font-weight="700" fill="#8A8680">↓</text>
  </g>
"""),

    # Checkbox — rounded square 6px, unchecked/checked/indeterminate.
    "checkbox-default": (200, 24, """
  <rect x="0" y="0" width="20" height="20" fill="#FFFFFF" stroke="#E5E3DE" stroke-width="1" rx="6" ry="6"/>
  <text x="32" y="16" class="text-primary" font-size="13" letter-spacing="-0.02em" font-weight="600">Unchecked</text>
"""),

    "checkbox-checked": (200, 24, """
  <rect x="0" y="0" width="20" height="20" fill="#F0EDE8" stroke="#E5E3DE" stroke-width="1" rx="6" ry="6"/>
  <path d="M 3 10 L 8 15 L 17 6" fill="none" stroke="#2C2C2C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="32" y="16" class="text-primary" font-size="13" letter-spacing="-0.02em" font-weight="600">Checked</text>
"""),

    "checkbox-indeterminate": (200, 24, """
  <rect x="0" y="0" width="20" height="20" fill="#F0EDE8" stroke="#E5E3DE" stroke-width="1" rx="6" ry="6"/>
  <line x1="5" y1="10" x2="15" y2="10" stroke="#2C2C2C" stroke-width="2" stroke-linecap="round"/>
  <text x="32" y="16" class="text-primary" font-size="13" letter-spacing="-0.02em" font-weight="600">Indeterminate</text>
"""),

    # Radio — single-select, rounded square 6px (sketch grammar: no circles).
    "radio-default": (200, 24, """
  <rect x="0" y="0" width="20" height="20" fill="#FFFFFF" stroke="#E5E3DE" stroke-width="1" rx="6" ry="6"/>
  <text x="32" y="16" class="text-primary" font-size="13" letter-spacing="-0.02em" font-weight="600">Option</text>
"""),

    "radio-selected": (200, 24, """
  <rect x="0" y="0" width="20" height="20" fill="#F0EDE8" stroke="#E5E3DE" stroke-width="1" rx="6" ry="6"/>
  <rect x="6" y="6" width="8" height="8" fill="#2C2C2C" rx="3" ry="3"/>
  <text x="32" y="16" class="text-primary" font-size="13" letter-spacing="-0.02em" font-weight="600">Selected</text>
"""),

    # Toggle — on/off switch with track + thumb.
    "toggle-on": (200, 24, """
  <rect x="0" y="0" width="44" height="24" fill="#F0EDE8" stroke="#E5E3DE" stroke-width="1" rx="12" ry="12"/>
  <rect x="24" y="4" width="16" height="16" fill="#FFFFFF" stroke="#E5E3DE" stroke-width="1" rx="4" ry="4"/>
  <text x="56" y="16" class="text-primary" font-size="13" letter-spacing="-0.02em" font-weight="600">On</text>
"""),

    "toggle-off": (200, 24, """
  <rect x="0" y="0" width="44" height="24" fill="#FAFAF8" stroke="#E5E3DE" stroke-width="1" rx="12" ry="12"/>
  <rect x="4" y="4" width="16" height="16" fill="#FFFFFF" stroke="#E5E3DE" stroke-width="1" rx="4" ry="4"/>
  <text x="56" y="16" class="text-primary" font-size="13" letter-spacing="-0.02em" font-weight="600">Off</text>
"""),

    # Label — default, required, optional.
    "label-default": (200, 20, """
  <text x="0" y="15" class="text-secondary" font-size="12" letter-spacing="-0.02em" font-weight="600">Label text</text>
"""),

    "label-required": (200, 20, """
  <text x="0" y="15" class="text-secondary" font-size="12" letter-spacing="-0.02em" font-weight="600">Label text <tspan fill="#2C2C2C">*</tspan></text>
"""),

    # Icon — using simple geometric placeholder or glyphs.
    "icon-arrow": (24, 24, """
  <text x="12" y="18" text-anchor="middle" class="text-primary" font-size="16" font-weight="600">→</text>
"""),

    "icon-plus": (24, 24, """
  <text x="12" y="18" text-anchor="middle" class="text-primary" font-size="16" font-weight="600">+</text>
"""),

    "icon-close": (24, 24, """
  <text x="12" y="18" text-anchor="middle" class="text-primary" font-size="16" font-weight="600">×</text>
"""),

    "icon-placeholder": (24, 24, """
  <rect x="0" y="0" width="24" height="24" fill="#F7F5F0" stroke="#E5E3DE" stroke-width="1" rx="4" ry="4"/>
"""),

    # Avatar — 34×34 rounded-square with monogram in IBM Plex Sans.
    "avatar-default": (34, 34, """
  <rect x="0" y="0" width="34" height="34" fill="#F0EDE8" stroke="#E5E3DE" stroke-width="1" rx="8" ry="8"/>
  <text x="17" y="24" text-anchor="middle" class="text-primary" font-size="14" font-weight="600">T</text>
"""),

    "avatar-with-status": (40, 40, """
  <rect x="0" y="0" width="34" height="34" fill="#F0EDE8" stroke="#E5E3DE" stroke-width="1" rx="8" ry="8"/>
  <text x="17" y="24" text-anchor="middle" class="text-primary" font-size="14" font-weight="600">A</text>
  <circle cx="36" cy="36" r="4" fill="#B8A9C8"/>
"""),

    # Badge — 18×18 purple rounded-square with white digit or status dot.
    "badge-count": (18, 18, """
  <rect x="0" y="0" width="18" height="18" fill="#B8A9C8" rx="6" ry="6"/>
  <text x="9" y="14" text-anchor="middle" font-family="'IBM Plex Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="#FFFFFF">2</text>
"""),

    "badge-status": (8, 8, """
  <circle cx="4" cy="4" r="4" fill="#B8A9C8"/>
"""),

    # Divider — hairline, default, strong at 1px.
    "divider-hairline": (320, 1, """
  <line x1="0" y1="0.5" x2="320" y2="0.5" stroke="#F0EDE8" stroke-width="1"/>
"""),

    "divider-default": (320, 1, """
  <line x1="0" y1="0.5" x2="320" y2="0.5" stroke="#E5E3DE" stroke-width="1"/>
"""),

    "divider-strong": (320, 1, """
  <line x1="0" y1="0.5" x2="320" y2="0.5" stroke="#D5CFC8" stroke-width="1"/>
"""),


    # ═════════════════════ COMPOSITES ═════════════════════

    # Card — default (no surface), elevated (warm-surface), outlined.
    "card-default": (320, 120, """
  <text x="0" y="20" class="text-secondary" font-size="12" font-weight="600" letter-spacing="-0.02em">Card Title</text>
  <text x="0" y="50" class="text-primary" font-size="14" letter-spacing="-0.02em">Card content goes here.</text>
  <text x="0" y="70" class="text-primary" font-size="14" letter-spacing="-0.02em">Multiple lines are supported.</text>
"""),

    "card-elevated": (320, 120, """
  <rect x="0" y="0" width="320" height="120" fill="#F0EDE8" stroke="#E5E3DE" stroke-width="1" rx="14" ry="14"/>
  <text x="16" y="28" class="text-secondary" font-size="12" font-weight="600" letter-spacing="-0.02em">Elevated</text>
  <text x="16" y="58" class="text-primary" font-size="14" letter-spacing="-0.02em">This card has a warm-surface background</text>
  <text x="16" y="78" class="text-primary" font-size="14" letter-spacing="-0.02em">for visual elevation without shadows.</text>
"""),

    "card-outlined": (320, 120, """
  <rect x="0" y="0" width="320" height="120" fill="#FFFFFF" stroke="#E5E3DE" stroke-width="1" rx="14" ry="14"/>
  <text x="16" y="28" class="text-secondary" font-size="12" font-weight="600" letter-spacing="-0.02em">Outlined</text>
  <text x="16" y="58" class="text-primary" font-size="14" letter-spacing="-0.02em">Subtle border defines the boundary.</text>
  <text x="16" y="78" class="text-primary" font-size="14" letter-spacing="-0.02em">No fill color.</text>
"""),

    # List item — default, selected, compact variants already in signature files
    # These are the same structure:
    "list-item-compact": (280, 48, """
  <rect x="0" y="0" width="280" height="48" fill="#FAFAF8"/>
  <rect x="14" y="7" width="34" height="34" fill="#F0EDE8" stroke="#E5E3DE" stroke-width="1" rx="8" ry="8"/>
  <text x="31" y="30" font-family="'IBM Plex Sans', system-ui, sans-serif" font-size="14" font-weight="600" text-anchor="middle">R</text>
  <text x="58" y="29" font-family="'IBM Plex Sans', system-ui, sans-serif" font-size="12.5" font-weight="600" fill="#2C2C2C">Recipe ideas</text>
  <text x="266" y="29" font-family="'IBM Plex Sans', system-ui, sans-serif" font-size="10" fill="#B0ADA8" text-anchor="end">1h</text>
"""),

    # Form field — label above input, optional help/error below.
    "form-field-default": (320, 56, """
  <text x="0" y="14" class="text-secondary" font-size="12" font-weight="600" letter-spacing="-0.02em">Email</text>
  <rect x="0" y="24" width="320" height="32" fill="#FFFFFF" stroke="#E5E3DE" stroke-width="1" rx="10" ry="10"/>
  <text x="12" y="46" class="text-muted" font-size="14" letter-spacing="-0.02em">user@example.com</text>
"""),

    "form-field-with-help": (320, 80, """
  <text x="0" y="14" class="text-secondary" font-size="12" font-weight="600" letter-spacing="-0.02em">Password</text>
  <rect x="0" y="24" width="320" height="32" fill="#FFFFFF" stroke="#E5E3DE" stroke-width="1" rx="10" ry="10"/>
  <text x="12" y="46" class="text-primary" font-size="14" letter-spacing="-0.02em">••••••••</text>
  <text x="0" y="68" class="text-muted" font-size="11" letter-spacing="-0.02em">Minimum 8 characters required.</text>
"""),

    "form-field-with-error": (320, 80, """
  <text x="0" y="14" class="text-secondary" font-size="12" font-weight="600" letter-spacing="-0.02em">Username</text>
  <rect x="0" y="24" width="320" height="32" fill="#FFFFFF" stroke="#E5E3DE" stroke-width="1.5" rx="10" ry="10"/>
  <text x="12" y="46" class="text-primary" font-size="14" letter-spacing="-0.02em">invalid-user</text>
  <g transform="rotate(-1, 0, 62)">
    <text x="0" y="62" font-family="Caveat, cursive" font-size="14" font-weight="700" fill="#B8A9C8">letters and numbers only</text>
  </g>
"""),

    # Table row — header and data rows.
    "table-header": (640, 32, """
  <line x1="0" y1="31.5" x2="640" y2="31.5" stroke="#D5CFC8" stroke-width="1"/>
  <text x="16" y="22" class="text-secondary" font-size="11" font-weight="600" letter-spacing="-0.02em">#</text>
  <text x="48" y="22" class="text-secondary" font-size="11" font-weight="600" letter-spacing="-0.02em">NAME</text>
  <text x="280" y="22" class="text-secondary" font-size="11" font-weight="600" letter-spacing="-0.02em">EMAIL</text>
  <text x="480" y="22" class="text-secondary" font-size="11" font-weight="600" letter-spacing="-0.02em">ROLE</text>
"""),

    "table-row-default": (640, 48, """
  <line x1="0" y1="47.5" x2="640" y2="47.5" stroke="#E5E3DE" stroke-width="1"/>
  <text x="16" y="30" class="text-primary" font-size="13" font-weight="600" letter-spacing="-0.02em">01</text>
  <text x="48" y="30" class="text-primary" font-size="13" letter-spacing="-0.02em">Alex Rivera</text>
  <text x="280" y="30" class="text-secondary" font-size="13" letter-spacing="-0.02em">alex@example.com</text>
  <text x="480" y="30" class="text-secondary" font-size="13" letter-spacing="-0.02em">Editor</text>
"""),

    "table-row-selected": (640, 48, """
  <rect x="0" y="0" width="640" height="48" fill="#F0EDE8" stroke="#E5E3DE" stroke-width="1" rx="10" ry="10"/>
  <line x1="0" y1="47.5" x2="640" y2="47.5" stroke="#E5E3DE" stroke-width="1"/>
  <text x="16" y="30" class="text-primary" font-size="13" font-weight="700" letter-spacing="-0.02em">01</text>
  <text x="48" y="30" class="text-primary" font-size="13" font-weight="600" letter-spacing="-0.02em">Alex Rivera</text>
  <text x="280" y="30" class="text-secondary" font-size="13" letter-spacing="-0.02em">alex@example.com</text>
  <text x="480" y="30" class="text-secondary" font-size="13" letter-spacing="-0.02em">Editor</text>
"""),

    # Nav item — top-level, sub-item, with active state.
    "nav-item-default": (240, 32, """
  <text x="0" y="22" class="text-secondary" font-size="13" letter-spacing="-0.02em" font-weight="600">Projects</text>
"""),

    "nav-item-active": (240, 32, """
  <text x="0" y="22" class="text-primary" font-size="13" letter-spacing="-0.02em" font-weight="700">Dashboard</text>
  <line x1="0" y1="28" x2="240" y2="28" stroke="#B8A9C8" stroke-width="1"/>
"""),

    "nav-item-with-badge": (240, 32, """
  <text x="0" y="22" class="text-primary" font-size="13" letter-spacing="-0.02em" font-weight="600">Inbox</text>
  <rect x="224" y="12" width="18" height="18" fill="#B8A9C8" rx="6" ry="6"/>
  <text x="233" y="26" text-anchor="middle" font-family="'IBM Plex Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="#FFFFFF">3</text>
"""),

    # Tab item — default, active.
    "tab-item-default": (120, 40, """
  <text x="60" y="26" text-anchor="middle" class="text-secondary" font-size="13" letter-spacing="-0.02em" font-weight="600">Tab Label</text>
"""),

    "tab-item-active": (120, 40, """
  <text x="60" y="26" text-anchor="middle" class="text-primary" font-size="13" letter-spacing="-0.02em" font-weight="700">Active Tab</text>
  <g transform="rotate(-1.5, 60, 36)">
    <line x1="20" y1="36" x2="100" y2="36" stroke="#B8A9C8" stroke-width="1.5"/>
  </g>
"""),

    # Breadcrumb trail — segments separated by Caveat › annotation.
    "breadcrumb-default": (480, 24, """
  <text x="0" y="16" class="text-primary" font-size="13" letter-spacing="-0.02em" font-weight="600">Home</text>
  <g transform="rotate(-1, 48, 16)">
    <text x="48" y="16" font-family="Caveat, cursive" font-size="13" font-weight="700" fill="#B8A9C8">›</text>
  </g>
  <text x="64" y="16" class="text-secondary" font-size="13" letter-spacing="-0.02em">Settings</text>
  <g transform="rotate(-1, 120, 16)">
    <text x="120" y="16" font-family="Caveat, cursive" font-size="13" font-weight="700" fill="#B8A9C8">›</text>
  </g>
  <text x="136" y="16" class="text-primary" font-size="13" letter-spacing="-0.02em" font-weight="600">Profile</text>
"""),

    # Pagination — page info + prev/next.
    "pagination-default": (480, 32, """
  <text x="0" y="22" class="text-secondary" font-size="11" letter-spacing="-0.02em" font-weight="600">Page 5 of 247</text>
  <text x="408" y="22" class="text-secondary" font-size="13" letter-spacing="-0.02em">← Prev</text>
  <text x="480" y="22" text-anchor="end" class="text-primary" font-size="13" letter-spacing="-0.02em" font-weight="600">Next →</text>
"""),

    "pagination-numbered": (480, 32, """
  <text x="0" y="22" class="text-secondary" font-size="13" letter-spacing="-0.02em">←</text>
  <text x="32" y="22" class="text-primary" font-size="13" letter-spacing="-0.02em" font-weight="600">1</text>
  <text x="64" y="22" class="text-secondary" font-size="13" letter-spacing="-0.02em">2</text>
  <text x="96" y="22" class="text-secondary" font-size="13" letter-spacing="-0.02em">3</text>
  <text x="128" y="22" class="text-secondary" font-size="13" letter-spacing="-0.02em">4</text>
  <text x="160" y="22" class="text-secondary" font-size="13" letter-spacing="-0.02em">5</text>
  <text x="192" y="22" class="text-secondary" font-size="13" letter-spacing="-0.02em">→</text>
"""),

    # Toast — transient notification.
    "toast-info": (400, 64, """
  <rect x="0" y="0" width="400" height="64" fill="#F0EDE8" stroke="#E5E3DE" stroke-width="1" rx="14" ry="14"/>
  <text x="16" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="-0.02em">INFO</text>
  <text x="16" y="48" class="text-primary" font-size="13" letter-spacing="-0.02em">Profile updated successfully.</text>
  <text x="384" y="26" text-anchor="end" class="text-muted" font-size="14">×</text>
"""),

    "toast-success": (400, 64, """
  <rect x="0" y="0" width="400" height="64" fill="#F0EDE8" stroke="#E5E3DE" stroke-width="1" rx="14" ry="14"/>
  <text x="16" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="-0.02em">SUCCESS</text>
  <text x="16" y="48" class="text-primary" font-size="13" letter-spacing="-0.02em">Changes saved.</text>
  <text x="384" y="26" text-anchor="end" class="text-muted" font-size="14">×</text>
"""),

    "toast-warning": (400, 64, """
  <rect x="0" y="0" width="400" height="64" fill="#F0EDE8" stroke="#E5E3DE" stroke-width="1" rx="14" ry="14"/>
  <text x="16" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="-0.02em">WARNING</text>
  <text x="16" y="48" class="text-primary" font-size="13" letter-spacing="-0.02em">This action cannot be undone.</text>
  <text x="384" y="26" text-anchor="end" class="text-muted" font-size="14">×</text>
"""),

    "toast-error": (400, 64, """
  <rect x="0" y="0" width="400" height="64" fill="#F0EDE8" stroke="#E5E3DE" stroke-width="1" rx="14" ry="14"/>
  <text x="16" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="-0.02em">ERROR</text>
  <text x="16" y="48" class="text-primary" font-size="13" letter-spacing="-0.02em">Could not complete request.</text>
  <text x="384" y="26" text-anchor="end" class="text-muted" font-size="14">×</text>
"""),

    # Stat — large numeric display with label.
    "stat-default": (200, 80, """
  <text x="0" y="14" class="text-secondary" font-size="9" font-weight="600" letter-spacing="-0.02em">REVENUE</text>
  <text x="0" y="56" class="text-primary" font-size="22" font-weight="700" letter-spacing="-0.02em">24,580</text>
  <text x="0" y="76" class="text-muted" font-size="11" letter-spacing="-0.02em">vs 21,200 last month</text>
"""),

    "stat-with-trend": (200, 80, """
  <text x="0" y="14" class="text-secondary" font-size="9" font-weight="600" letter-spacing="-0.02em">GROWTH</text>
  <text x="0" y="56" class="text-primary" font-size="22" font-weight="700" letter-spacing="-0.02em">12.5%</text>
  <text x="0" y="76" class="text-muted" font-size="11" letter-spacing="-0.02em">↑ 3.2% from last quarter</text>
"""),

    # Key-value — data display rows.
    "key-value-default": (320, 40, """
  <text x="0" y="16" class="text-secondary" font-size="11" font-weight="600" letter-spacing="-0.02em">DISPLAY NAME</text>
  <text x="0" y="34" class="text-primary" font-size="13" letter-spacing="-0.02em">Alex Rivera</text>
"""),

    "key-value-inline": (320, 24, """
  <text x="0" y="16" class="text-secondary" font-size="11" font-weight="600" letter-spacing="-0.02em">PLAN</text>
  <text x="80" y="16" class="text-primary" font-size="13" letter-spacing="-0.02em" font-weight="600">Pro</text>
"""),

    # Button group — related buttons separated by borders.
    "button-group-default": (320, 48, """
  <rect x="0" y="0" width="320" height="48" fill="#FAFAF8" stroke="#E5E3DE" stroke-width="1" rx="10" ry="10"/>
  <text x="40" y="32" text-anchor="middle" class="text-primary" font-size="14" font-weight="600" letter-spacing="-0.02em">All</text>
  <line x1="80" y1="8" x2="80" y2="40" stroke="#E5E3DE" stroke-width="1"/>
  <text x="120" y="32" text-anchor="middle" class="text-secondary" font-size="14" letter-spacing="-0.02em">Active</text>
  <line x1="160" y1="8" x2="160" y2="40" stroke="#E5E3DE" stroke-width="1"/>
  <text x="200" y="32" text-anchor="middle" class="text-secondary" font-size="14" letter-spacing="-0.02em">Archived</text>
  <line x1="240" y1="8" x2="240" y2="40" stroke="#E5E3DE" stroke-width="1"/>
  <text x="280" y="32" text-anchor="middle" class="text-secondary" font-size="14" letter-spacing="-0.02em">Draft</text>
"""),

    "button-group-segmented": (320, 48, """
  <rect x="0" y="0" width="80" height="48" fill="#F0EDE8" stroke="#E5E3DE" stroke-width="1" rx="10" ry="10"/>
  <text x="40" y="32" text-anchor="middle" class="text-primary" font-size="14" font-weight="600" letter-spacing="-0.02em">Day</text>
  <rect x="80" y="0" width="80" height="48" fill="#FAFAF8" stroke="#E5E3DE" stroke-width="1"/>
  <text x="120" y="32" text-anchor="middle" class="text-secondary" font-size="14" letter-spacing="-0.02em">Week</text>
  <rect x="160" y="0" width="80" height="48" fill="#FAFAF8" stroke="#E5E3DE" stroke-width="1"/>
  <text x="200" y="32" text-anchor="middle" class="text-secondary" font-size="14" letter-spacing="-0.02em">Month</text>
  <rect x="240" y="0" width="80" height="48" fill="#FAFAF8" stroke="#E5E3DE" stroke-width="1" rx="0" ry="0" rx="10" ry="10"/>
  <text x="280" y="32" text-anchor="middle" class="text-secondary" font-size="14" letter-spacing="-0.02em">Year</text>
"""),

    # Search bar — input with optional annotation.
    "search-bar-default": (480, 56, """
  <rect x="0" y="0" width="480" height="56" fill="#FFFFFF" stroke="#E5E3DE" stroke-width="1" rx="10" ry="10"/>
  <text x="12" y="35" class="text-muted" font-size="14" letter-spacing="-0.02em">Search conversations...</text>
  <g transform="rotate(-1.5, 460, 28)">
    <text x="460" y="35" text-anchor="end" font-family="Caveat, cursive" font-size="14" font-weight="700" fill="#C4B8D4">↓ your chats</text>
  </g>
"""),

    # Banner — full-width emphasis notice.
    "banner-info": (640, 56, """
  <rect x="0" y="0" width="640" height="56" fill="#F0EDE8" stroke="#E5E3DE" stroke-width="1" rx="14" ry="14"/>
  <text x="16" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="-0.02em">INFO</text>
  <text x="80" y="34" class="text-primary" font-size="13" letter-spacing="-0.02em">A new version is available.</text>
  <text x="624" y="34" text-anchor="end" class="text-primary" font-size="13" letter-spacing="-0.02em" font-weight="600">Refresh →</text>
"""),

    "banner-warning": (640, 56, """
  <rect x="0" y="0" width="640" height="56" fill="#F0EDE8" stroke="#E5E3DE" stroke-width="1" rx="14" ry="14"/>
  <text x="16" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="-0.02em">WARNING</text>
  <text x="80" y="34" class="text-primary" font-size="13" letter-spacing="-0.02em">Your trial ends in 3 days.</text>
  <text x="624" y="34" text-anchor="end" class="text-primary" font-size="13" letter-spacing="-0.02em" font-weight="600">Upgrade →</text>
"""),

    # Accordion item — collapsible row.
    "accordion-default": (480, 56, """
  <rect x="0" y="0" width="480" height="56" fill="#FAFAF8" stroke="#E5E3DE" stroke-width="1" rx="10" ry="10"/>
  <text x="16" y="34" class="text-primary" font-size="14" letter-spacing="-0.02em" font-weight="600">Notifications</text>
  <g transform="rotate(-2, 464, 28)">
    <text x="464" y="34" text-anchor="end" font-family="Caveat, cursive" font-size="14" font-weight="700" fill="#8A8680">↓</text>
  </g>
"""),

    "accordion-expanded": (480, 144, """
  <rect x="0" y="0" width="480" height="144" fill="#F0EDE8" stroke="#E5E3DE" stroke-width="1" rx="10" ry="10"/>
  <text x="16" y="34" class="text-primary" font-size="14" letter-spacing="-0.02em" font-weight="600">Notifications</text>
  <g transform="rotate(-2, 464, 28)">
    <text x="464" y="34" text-anchor="end" font-family="Caveat, cursive" font-size="14" font-weight="700" fill="#8A8680">↑</text>
  </g>
  <line x1="16" y1="50" x2="464" y2="50" stroke="#E5E3DE" stroke-width="1"/>
  <text x="16" y="78" class="text-secondary" font-size="11" font-weight="600" letter-spacing="-0.02em">EMAIL DIGEST</text>
  <text x="16" y="102" class="text-primary" font-size="13" letter-spacing="-0.02em">Daily digest at 09:00</text>
  <text x="16" y="126" class="text-muted" font-size="13" letter-spacing="-0.02em">Replies in real time</text>
"""),

}


# ──────────────────────────────────────────────────────────────────────
# WRITE
# ──────────────────────────────────────────────────────────────────────

def main():
    only = None
    if len(sys.argv) > 2 and sys.argv[1] == "--only":
        only = sys.argv[2]

    # Script lives in tooling/; output goes up one level into the project root.
    out_dir = Path(__file__).resolve().parent.parent / "sketch-library" / "components"
    out_dir.mkdir(parents=True, exist_ok=True)

    written = []
    for component_id, (width, height, body) in COMPONENTS.items():
        if only and component_id != only:
            continue
        path = out_dir / f"{component_id}.svg"
        comment = f"<!-- ==================== {component_id.upper()} ==================== -->"
        svg = wrap_svg(width, height, body, comment)
        path.write_text(svg)
        written.append(path)

    print(f"Wrote {len(written)} Sketch component SVGs to {out_dir}")


if __name__ == "__main__":
    main()
