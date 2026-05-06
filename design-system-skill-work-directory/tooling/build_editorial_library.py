#!/usr/bin/env python3
"""
Build the Editorial design system's component library against the LIBRARY-SPEC
vocabulary. Editorial tokens and grammar applied to each component.

Editorial tokens:
  Fraunces serif (#Fraunces, Georgia, serif) for body/titles/display
  Inter sans-serif (#Inter, system-ui, sans-serif) for metadata (uppercase tracked)
  Page background: #F8F4EC (warm cream paper), never pure white
  Paper tiers: #F8F4EC (page) → #F1ECDF (elevated) → #FFFFFF (rare emphasis)
  Burgundy #8B1E2D reserved for: dispatch overlines, drop caps, unread counts, masthead double
  Type scale: 9, 11, 13, 15, 24, 54 (no others)
  Rules: hairline #E8DFCA, default #D8CEB9, strong #1A1614, masthead-double 3px #8B1E2D
  Selection signal: paper-tier background shift (no accent bars)
  No emoji anywhere; identity via single-letter monogram in 32×32 paper-elevated square

Coverage scope (Phase A):
  Primitives: button, input, textarea, select, checkbox, radio, toggle, label, icon,
              avatar, badge, divider (12 required)
  Composites: card, list_item, form_field, table_row, table_header, nav_item, tab_item,
              breadcrumb_trail, pagination, toast, stat, key_value, button_group,
              search_bar, banner, accordion_item (16+ variants per Editorial's grammar)
  Patterns: dashboard, article, form, auth (4 key patterns per Editorial's content nature)

Output goes to ./editorial-library/components/ and ./editorial-library/layouts/.
"""

import sys
from pathlib import Path

# ──────────────────────────────────────────────────────────────────────
# EDITORIAL WRAPPER
# ──────────────────────────────────────────────────────────────────────

STANDARD_DEFS = """  <defs>
    <style>
      .text-primary { fill: #1A1614; font-family: Fraunces, Georgia, serif; }
      .text-secondary { fill: #5C4F44; font-family: Fraunces, Georgia, serif; }
      .text-metadata { fill: #8B7D6F; font-family: Inter, system-ui, sans-serif; }
      .text-metadata-accent { fill: #8B1E2D; font-family: Inter, system-ui, sans-serif; }
      .text-accent { fill: #8B1E2D; font-family: Fraunces, Georgia, serif; }
      .text-muted { fill: #8B7D6F; font-family: Inter, system-ui, sans-serif; }
      .text-display { fill: #1A1614; font-family: Fraunces, Georgia, serif; }
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

    # Button — Editorial has minimal, hard-edged buttons.
    # Primary (CTA): burgundy text, no fill
    # Secondary: ink text on page background
    # Ghost: ink text, transparent
    # Destructive: burgundy text
    # Link: burgundy underlined text

    "button-primary": (120, 40, """
  <rect width="120" height="40" fill="#F8F4EC"/>
  <text x="60" y="25" text-anchor="middle" class="text-accent" font-size="14" font-weight="600" letter-spacing="-0.14">Send →</text>
"""),

    "button-secondary": (120, 40, """
  <rect width="120" height="40" fill="#F8F4EC"/>
  <text x="60" y="25" text-anchor="middle" class="text-primary" font-size="14" font-weight="400" letter-spacing="-0.14">Cancel</text>
"""),

    "button-ghost": (120, 40, """
  <rect width="120" height="40" fill="transparent"/>
  <text x="60" y="25" text-anchor="middle" class="text-primary" font-size="14" font-weight="400" letter-spacing="-0.14">More</text>
"""),

    "button-destructive": (120, 40, """
  <rect width="120" height="40" fill="#F8F4EC"/>
  <text x="60" y="25" text-anchor="middle" class="text-accent" font-size="14" font-weight="600" letter-spacing="-0.14">Delete</text>
"""),

    "button-link": (120, 40, """
  <text x="0" y="25" class="text-accent" font-size="14" font-weight="400" letter-spacing="-0.14">Learn more</text>
  <line x1="0" y1="28" x2="120" y2="28" stroke="#8B1E2D" stroke-width="1"/>
"""),

    # Input — single-line text field with Fraunces italic placeholder,
    # default-weight rule below

    "input-text": (280, 48, """
  <text x="0" y="14" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">LABEL</text>
  <line x1="0" y1="20" x2="280" y2="20" stroke="#D8CEB9" stroke-width="1"/>
  <text x="0" y="40" class="text-muted" font-size="14" font-style="italic">text</text>
"""),

    "input-password": (280, 48, """
  <text x="0" y="14" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">PASSWORD</text>
  <line x1="0" y1="20" x2="280" y2="20" stroke="#D8CEB9" stroke-width="1"/>
  <text x="0" y="40" class="text-primary" font-size="14" letter-spacing="2">••••••••</text>
"""),

    "input-search": (280, 32, """
  <line x1="0" y1="0" x2="280" y2="0" stroke="#D8CEB9" stroke-width="1"/>
  <text x="0" y="22" class="text-muted" font-size="13" font-style="italic">search</text>
"""),

    "input-numeric": (280, 48, """
  <text x="0" y="14" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">QUANTITY</text>
  <line x1="0" y1="20" x2="280" y2="20" stroke="#D8CEB9" stroke-width="1"/>
  <text x="0" y="40" class="text-primary" font-size="14">5</text>
"""),

    # Textarea — multi-line input, italic placeholder, default rule below

    "textarea-default": (280, 100, """
  <text x="0" y="14" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">MESSAGE</text>
  <line x1="0" y1="20" x2="280" y2="20" stroke="#D8CEB9" stroke-width="1"/>
  <text x="0" y="42" class="text-muted" font-size="13" font-style="italic">compose…</text>
  <line x1="0" y1="99" x2="280" y2="99" stroke="#E8DFCA" stroke-width="1"/>
"""),

    "textarea-filled": (280, 100, """
  <text x="0" y="14" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">NOTES</text>
  <line x1="0" y1="20" x2="280" y2="20" stroke="#D8CEB9" stroke-width="1"/>
  <text x="0" y="42" class="text-primary" font-size="13">A handsome serif system with warm cream paper.</text>
  <text x="0" y="62" class="text-primary" font-size="13">No emoji, no shadows, no rounded corners.</text>
  <line x1="0" y1="99" x2="280" y2="99" stroke="#E8DFCA" stroke-width="1"/>
"""),

    # Select — dropdown with indicator arrow, default rule

    "select-default": (280, 48, """
  <text x="0" y="14" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">CATEGORY</text>
  <line x1="0" y1="20" x2="280" y2="20" stroke="#D8CEB9" stroke-width="1"/>
  <text x="0" y="40" class="text-primary" font-size="14">Essays</text>
  <text x="280" y="40" text-anchor="end" class="text-muted" font-size="14">›</text>
"""),

    "select-empty": (280, 48, """
  <text x="0" y="14" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">GENRE</text>
  <line x1="0" y1="20" x2="280" y2="20" stroke="#D8CEB9" stroke-width="1"/>
  <text x="0" y="40" class="text-muted" font-size="14" font-style="italic">choose…</text>
  <text x="280" y="40" text-anchor="end" class="text-muted" font-size="14">›</text>
"""),

    # Checkbox — square box, Fraunces serif label, no radius

    "checkbox-checked": (200, 24, """
  <rect x="0" y="0" width="20" height="20" fill="#1A1614"/>
  <path d="M 4 10 L 8 14 L 16 5" fill="none" stroke="#F8F4EC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="32" y="16" class="text-primary" font-size="13">Include</text>
"""),

    "checkbox-unchecked": (200, 24, """
  <rect x="0" y="0" width="20" height="20" fill="#F8F4EC" stroke="#1A1614" stroke-width="1"/>
  <text x="32" y="16" class="text-primary" font-size="13">Option</text>
"""),

    "checkbox-indeterminate": (200, 24, """
  <rect x="0" y="0" width="20" height="20" fill="#1A1614"/>
  <line x1="4" y1="10" x2="16" y2="10" stroke="#F8F4EC" stroke-width="2" stroke-linecap="round"/>
  <text x="32" y="16" class="text-primary" font-size="13">Partial</text>
"""),

    # Radio — circle, one dot when selected

    "radio-selected": (200, 24, """
  <circle cx="10" cy="10" r="9" fill="#F8F4EC" stroke="#1A1614" stroke-width="1"/>
  <circle cx="10" cy="10" r="5" fill="#1A1614"/>
  <text x="32" y="16" class="text-primary" font-size="13">Selected</text>
"""),

    "radio-unselected": (200, 24, """
  <circle cx="10" cy="10" r="9" fill="#F8F4EC" stroke="#1A1614" stroke-width="1"/>
  <text x="32" y="16" class="text-primary" font-size="13">Option</text>
"""),

    # Toggle — hard-edged track, thumb moves left/right

    "toggle-on": (200, 24, """
  <rect x="0" y="0" width="40" height="24" fill="#1A1614"/>
  <rect x="20" y="2" width="18" height="20" fill="#F8F4EC"/>
  <text x="56" y="16" class="text-primary" font-size="13">On</text>
"""),

    "toggle-off": (200, 24, """
  <rect x="0" y="0" width="40" height="24" fill="#F8F4EC" stroke="#1A1614" stroke-width="1"/>
  <rect x="2" y="2" width="18" height="20" fill="#1A1614"/>
  <text x="56" y="16" class="text-primary" font-size="13">Off</text>
"""),

    # Label — metadata and display labels, optional marker for required/optional

    "label-default": (200, 13, """
  <text x="0" y="11" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">LABEL</text>
"""),

    "label-required": (200, 13, """
  <text x="0" y="11" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">LABEL *</text>
"""),

    "label-optional": (200, 13, """
  <text x="0" y="11" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">LABEL (optional)</text>
"""),

    # Icon — minimal Fraunces glyphs (→, ›, etc.) or placeholder rect

    "icon-arrow": (24, 24, """
  <text x="12" y="18" text-anchor="middle" class="text-primary" font-size="16" font-weight="400">→</text>
"""),

    "icon-chevron": (24, 24, """
  <text x="12" y="18" text-anchor="middle" class="text-primary" font-size="16" font-weight="400">›</text>
"""),

    "icon-check": (24, 24, """
  <path d="M 4 12 L 9 16 L 20 5" fill="none" stroke="#1A1614" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
"""),

    "icon-placeholder": (24, 24, """
  <rect x="0" y="0" width="24" height="24" fill="#F1ECDF"/>
"""),

    # Avatar — 32×32 monogram in paper-elevated square, no photo/emoji per Editorial grammar

    "avatar-monogram": (32, 32, """
  <rect x="0" y="0" width="32" height="32" fill="#F1ECDF"/>
  <text x="16" y="24" text-anchor="middle" class="text-primary" font-size="16" font-weight="700">T</text>
"""),

    "avatar-monogram-alt": (32, 32, """
  <rect x="0" y="0" width="32" height="32" fill="#F1ECDF"/>
  <text x="16" y="24" text-anchor="middle" class="text-primary" font-size="16" font-weight="700">A</text>
"""),

    "avatar-with-status": (40, 32, """
  <rect x="0" y="0" width="32" height="32" fill="#F1ECDF"/>
  <text x="16" y="24" text-anchor="middle" class="text-primary" font-size="16" font-weight="700">T</text>
  <circle cx="36" cy="4" r="3" fill="#8B1E2D"/>
"""),

    # Badge — per Editorial rulebook: count is "N new" in Fraunces burgundy,
    # status is a dot, tag is a label. No pills.

    "badge-count": (80, 16, """
  <text x="0" y="13" class="text-accent" font-size="11" font-weight="700" letter-spacing="-0.11">2 new</text>
"""),

    "badge-status-dot": (8, 8, """
  <circle cx="4" cy="4" r="4" fill="#8B1E2D"/>
"""),

    "badge-tag": (120, 16, """
  <text x="0" y="13" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">DISPATCH</text>
"""),

    # Divider — four weights per Editorial: hairline, default, strong, masthead-double

    "divider-hairline": (280, 1, """
  <line x1="0" y1="0.5" x2="280" y2="0.5" stroke="#E8DFCA" stroke-width="1"/>
"""),

    "divider-default": (280, 1, """
  <line x1="0" y1="0.5" x2="280" y2="0.5" stroke="#D8CEB9" stroke-width="1"/>
"""),

    "divider-strong": (280, 1, """
  <line x1="0" y1="0.5" x2="280" y2="0.5" stroke="#1A1614" stroke-width="1"/>
"""),

    "divider-double": (280, 2, """
  <line x1="0" y1="0" x2="280" y2="0" stroke="#8B1E2D" stroke-width="1"/>
  <line x1="0" y1="1.5" x2="280" y2="1.5" stroke="#8B1E2D" stroke-width="1"/>
"""),


    # ═════════════════════ COMPOSITES ═════════════════════

    # Card — simple container on paper background. Default has no extra surface;
    # elevated uses paper-elevated; outlined has a rule border

    "card-default": (280, 80, """
  <text x="0" y="13" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">CARD</text>
  <text x="0" y="36" class="text-primary" font-size="13">Content with no surface, just type on paper.</text>
  <text x="0" y="56" class="text-secondary" font-size="13">Clean and minimal per Editorial grammar.</text>
"""),

    "card-elevated": (280, 80, """
  <rect width="280" height="80" fill="#F1ECDF"/>
  <text x="16" y="25" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">ELEVATED</text>
  <text x="16" y="48" class="text-primary" font-size="13">Paper-elevated surface for emphasis.</text>
  <text x="16" y="68" class="text-secondary" font-size="13">One tier above page background.</text>
"""),

    "card-outlined": (280, 80, """
  <line x1="0" y1="0" x2="280" y2="0" stroke="#D8CEB9" stroke-width="1"/>
  <line x1="280" y1="0" x2="280" y2="80" stroke="#D8CEB9" stroke-width="1"/>
  <line x1="0" y1="80" x2="280" y2="80" stroke="#D8CEB9" stroke-width="1"/>
  <line x1="0" y1="0" x2="0" y2="80" stroke="#D8CEB9" stroke-width="1"/>
  <text x="16" y="25" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">OUTLINED</text>
  <text x="16" y="48" class="text-primary" font-size="13">Default rule border, no fill.</text>
  <text x="16" y="68" class="text-secondary" font-size="13">Contained but open feel.</text>
"""),

    # List item — we have default/selected in the library already.
    # Add a compact variant.

    "list-item-compact": (280, 48, """
  <rect x="0" y="0" width="280" height="48" fill="#F8F4EC"/>
  <text x="16" y="18" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">1H AGO</text>
  <text x="16" y="36" class="text-primary" font-size="13" font-weight="600">Recipe Ideas</text>
  <text x="280" y="18" text-anchor="end" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">DISPATCH</text>
  <line x1="0" y1="47" x2="280" y2="47" stroke="#E8DFCA" stroke-width="1"/>
"""),

    # Form field — label above, input below, hairline divider between fields

    "form-field-default": (280, 48, """
  <text x="0" y="13" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">DISPLAY NAME</text>
  <line x1="0" y1="19" x2="280" y2="19" stroke="#D8CEB9" stroke-width="1"/>
  <text x="0" y="38" class="text-primary" font-size="13">Alex Rivera</text>
"""),

    "form-field-with-help": (280, 64, """
  <text x="0" y="13" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">EMAIL</text>
  <line x1="0" y1="19" x2="280" y2="19" stroke="#D8CEB9" stroke-width="1"/>
  <text x="0" y="38" class="text-primary" font-size="13">user@example.com</text>
  <text x="0" y="56" class="text-secondary" font-size="11" font-style="italic">Used for account access.</text>
"""),

    "form-field-with-error": (280, 64, """
  <text x="0" y="13" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">PASSWORD</text>
  <line x1="0" y1="19" x2="280" y2="19" stroke="#8B1E2D" stroke-width="1.5"/>
  <text x="0" y="38" class="text-primary" font-size="13">••••••••</text>
  <text x="0" y="56" class="text-accent" font-size="11">Password must be at least 8 characters.</text>
"""),

    # Table row — three variants: default, header, selected

    "table-row-default": (560, 32, """
  <rect width="560" height="32" fill="#F8F4EC"/>
  <text x="16" y="21" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">JAN 2024</text>
  <text x="120" y="21" class="text-primary" font-size="13" font-weight="600">Alex Rivera</text>
  <text x="280" y="21" class="text-secondary" font-size="13">alex@example.com</text>
  <text x="480" y="21" class="text-secondary" font-size="13">Editor</text>
  <line x1="0" y1="31" x2="560" y2="31" stroke="#E8DFCA" stroke-width="1"/>
"""),

    "table-row-header": (560, 24, """
  <rect width="560" height="24" fill="#F8F4EC"/>
  <line x1="0" y1="0" x2="560" y2="0" stroke="#1A1614" stroke-width="1"/>
  <text x="16" y="16" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">JOINED</text>
  <text x="120" y="16" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">NAME</text>
  <text x="280" y="16" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">EMAIL</text>
  <text x="480" y="16" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">ROLE</text>
  <line x1="0" y1="23" x2="560" y2="23" stroke="#1A1614" stroke-width="1"/>
"""),

    "table-row-selected": (560, 32, """
  <rect width="560" height="32" fill="#F1ECDF"/>
  <text x="16" y="21" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">MAR 2024</text>
  <text x="120" y="21" class="text-primary" font-size="13" font-weight="700">Jordan Chen</text>
  <text x="280" y="21" class="text-secondary" font-size="13">jordan@example.com</text>
  <text x="480" y="21" class="text-secondary" font-size="13">Administrator</text>
  <line x1="0" y1="31" x2="560" y2="31" stroke="#E8DFCA" stroke-width="1"/>
"""),

    # Table header — same as table-row-header but standalone

    "table-header-default": (560, 24, """
  <rect width="560" height="24" fill="#F8F4EC"/>
  <line x1="0" y1="0" x2="560" y2="0" stroke="#1A1614" stroke-width="1"/>
  <text x="16" y="16" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">JOINED</text>
  <text x="120" y="16" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">NAME</text>
  <text x="280" y="16" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">EMAIL</text>
  <line x1="0" y1="23" x2="560" y2="23" stroke="#1A1614" stroke-width="1"/>
"""),

    # Nav item — for sidebar navigation, with compact metadata label

    "nav-item-default": (240, 24, """
  <text x="0" y="16" class="text-primary" font-size="13">Dispatches</text>
"""),

    "nav-item-active": (240, 24, """
  <line x1="0" y1="0" x2="0" y2="24" stroke="#8B1E2D" stroke-width="2"/>
  <text x="8" y="16" class="text-primary" font-size="13" font-weight="700">Dashboard</text>
"""),

    "nav-item-with-count": (240, 24, """
  <text x="0" y="16" class="text-primary" font-size="13">Inbox</text>
  <text x="240" y="16" text-anchor="end" class="text-accent" font-size="11" font-weight="700">3 new</text>
"""),

    # Tab item — text-only tabs, underline on active

    "tab-item-default": (120, 32, """
  <text x="60" y="20" text-anchor="middle" class="text-secondary" font-size="13">Tab</text>
"""),

    "tab-item-active": (120, 32, """
  <text x="60" y="20" text-anchor="middle" class="text-primary" font-size="13" font-weight="700">Active</text>
  <line x1="0" y1="28" x2="120" y2="28" stroke="#8B1E2D" stroke-width="2"/>
"""),

    # Breadcrumb trail — /─ separator, current is bold

    "breadcrumb-default": (400, 16, """
  <text x="0" y="13" class="text-secondary" font-size="11">Home</text>
  <text x="56" y="13" class="text-secondary" font-size="11">/</text>
  <text x="72" y="13" class="text-secondary" font-size="11">Settings</text>
  <text x="160" y="13" class="text-secondary" font-size="11">/</text>
  <text x="176" y="13" class="text-primary" font-size="11" font-weight="700">Profile</text>
"""),

    "breadcrumb-truncated": (400, 16, """
  <text x="0" y="13" class="text-secondary" font-size="11">Home</text>
  <text x="56" y="13" class="text-secondary" font-size="11">/</text>
  <text x="72" y="13" class="text-secondary" font-size="11">…</text>
  <text x="96" y="13" class="text-secondary" font-size="11">/</text>
  <text x="112" y="13" class="text-primary" font-size="11" font-weight="700">Profile</text>
"""),

    # Pagination — "Page N of M" in Fraunces, prev/next as text

    "pagination-default": (320, 20, """
  <text x="0" y="14" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">PAGE 5 OF 247</text>
  <text x="320" y="14" text-anchor="end" class="text-secondary" font-size="11">Next ›</text>
"""),

    "pagination-numbered": (320, 20, """
  <text x="0" y="14" class="text-secondary" font-size="11">‹</text>
  <text x="24" y="14" class="text-primary" font-size="11" font-weight="700">1</text>
  <text x="48" y="14" class="text-secondary" font-size="11">2</text>
  <text x="72" y="14" class="text-secondary" font-size="11">3</text>
  <text x="96" y="14" class="text-secondary" font-size="11">4</text>
  <text x="120" y="14" class="text-secondary" font-size="11">5</text>
  <text x="144" y="14" class="text-secondary" font-size="11">›</text>
"""),

    # Toast — transient notification with severity indicator

    "toast-info": (360, 56, """
  <line x1="0" y1="0" x2="360" y2="0" stroke="#D8CEB9" stroke-width="1"/>
  <text x="16" y="20" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">UPDATE</text>
  <text x="16" y="40" class="text-primary" font-size="13">Profile saved successfully.</text>
  <text x="352" y="20" text-anchor="end" class="text-secondary" font-size="14">×</text>
  <line x1="0" y1="55" x2="360" y2="55" stroke="#E8DFCA" stroke-width="1"/>
"""),

    "toast-error": (360, 56, """
  <line x1="0" y1="0" x2="360" y2="0" stroke="#8B1E2D" stroke-width="1"/>
  <text x="16" y="20" class="text-metadata-accent" font-size="9" font-weight="600" letter-spacing="1.44">ERROR</text>
  <text x="16" y="40" class="text-primary" font-size="13">Could not connect to server.</text>
  <text x="352" y="20" text-anchor="end" class="text-secondary" font-size="14">×</text>
  <line x1="0" y1="55" x2="360" y2="55" stroke="#E8DFCA" stroke-width="1"/>
"""),

    # Stat — display number + label + metadata

    "stat-default": (200, 80, """
  <text x="0" y="13" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">SUBSCRIBERS</text>
  <text x="0" y="56" class="text-display" font-size="32" font-weight="700" letter-spacing="-0.64">2,847</text>
  <text x="0" y="76" class="text-secondary" font-size="11">+240 this month</text>
"""),

    "stat-with-trend": (200, 80, """
  <text x="0" y="13" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">REVENUE</text>
  <text x="0" y="56" class="text-display" font-size="32" font-weight="700" letter-spacing="-0.64">$48.2k</text>
  <text x="0" y="76" class="text-accent" font-size="11" font-weight="600">↑ 12% vs last month</text>
"""),

    # Key-value — uppercase key + serif value

    "key-value-default": (280, 32, """
  <text x="0" y="13" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">PUBLISHED</text>
  <text x="0" y="30" class="text-primary" font-size="13">January 14, 2024</text>
"""),

    "key-value-inline": (240, 16, """
  <text x="0" y="12" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">STATUS</text>
  <text x="80" y="12" class="text-primary" font-size="11" font-weight="700">PUBLISHED</text>
"""),

    # Button group — vertically separated buttons

    "button-group-default": (280, 40, """
  <text x="0" y="20" text-anchor="middle" class="text-primary" font-size="13" font-weight="600">All</text>
  <line x1="56" y1="4" x2="56" y2="32" stroke="#D8CEB9" stroke-width="1"/>
  <text x="112" y="20" text-anchor="middle" class="text-primary" font-size="13">Active</text>
  <line x1="168" y1="4" x2="168" y2="32" stroke="#D8CEB9" stroke-width="1"/>
  <text x="224" y="20" text-anchor="middle" class="text-secondary" font-size="13">Archived</text>
"""),

    "button-group-segmented": (280, 40, """
  <line x1="0" y1="0" x2="280" y2="0" stroke="#D8CEB9" stroke-width="1"/>
  <text x="56" y="24" text-anchor="middle" class="text-primary" font-size="13" font-weight="700">Day</text>
  <text x="140" y="24" text-anchor="middle" class="text-secondary" font-size="13">Week</text>
  <text x="224" y="24" text-anchor="middle" class="text-secondary" font-size="13">Month</text>
  <line x1="0" y1="39" x2="280" y2="39" stroke="#D8CEB9" stroke-width="1"/>
"""),

    # Search bar — input + optional metadata count

    "search-bar-default": (400, 32, """
  <line x1="0" y1="0" x2="400" y2="0" stroke="#D8CEB9" stroke-width="1"/>
  <text x="0" y="22" class="text-muted" font-size="13" font-style="italic">search…</text>
  <text x="400" y="22" text-anchor="end" class="text-secondary" font-size="13">→</text>
"""),

    "search-bar-with-results": (400, 48, """
  <line x1="0" y1="0" x2="400" y2="0" stroke="#D8CEB9" stroke-width="1"/>
  <text x="0" y="22" class="text-primary" font-size="13">tokyo</text>
  <text x="0" y="44" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">847 RESULTS</text>
"""),

    # Banner — full-width band with rule above, severity label, action

    "banner-info": (560, 48, """
  <line x1="0" y1="0" x2="560" y2="0" stroke="#D8CEB9" stroke-width="1"/>
  <text x="16" y="20" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">UPDATE</text>
  <text x="16" y="40" class="text-primary" font-size="13">A new version is available.</text>
  <text x="544" y="40" text-anchor="end" class="text-accent" font-size="13" font-weight="600">Reload →</text>
"""),

    "banner-warning": (560, 48, """
  <line x1="0" y1="0" x2="560" y2="0" stroke="#8B1E2D" stroke-width="1"/>
  <text x="16" y="20" class="text-metadata-accent" font-size="9" font-weight="600" letter-spacing="1.44">NOTICE</text>
  <text x="16" y="40" class="text-primary" font-size="13">Your subscription renews in 3 days.</text>
  <text x="544" y="40" text-anchor="end" class="text-accent" font-size="13" font-weight="600">Review →</text>
"""),

    # Accordion — collapsible row with chevron

    "accordion-default": (400, 32, """
  <text x="0" y="20" class="text-primary" font-size="13" font-weight="600">Notifications</text>
  <text x="392" y="20" text-anchor="end" class="text-secondary" font-size="13">›</text>
  <line x1="0" y1="31" x2="400" y2="31" stroke="#E8DFCA" stroke-width="1"/>
"""),

    "accordion-expanded": (400, 96, """
  <text x="0" y="20" class="text-primary" font-size="13" font-weight="700">Notifications</text>
  <text x="392" y="20" text-anchor="end" class="text-secondary" font-size="13">›</text>
  <line x1="0" y1="31" x2="400" y2="31" stroke="#E8DFCA" stroke-width="1"/>
  <text x="0" y="57" class="text-metadata" font-size="9" font-weight="600" letter-spacing="1.44">EMAIL</text>
  <text x="0" y="77" class="text-primary" font-size="13">Daily digest at 09:00</text>
  <line x1="0" y1="95" x2="400" y2="95" stroke="#E8DFCA" stroke-width="1"/>
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
    out_dir = Path(__file__).resolve().parent.parent / "editorial-library" / "components"
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

    print(f"Wrote {len(written)} Editorial component SVGs to {out_dir}")


if __name__ == "__main__":
    main()
