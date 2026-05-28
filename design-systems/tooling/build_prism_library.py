#!/usr/bin/env python3
"""
Build the Prism design system's component library against the LIBRARY-SPEC
vocabulary. Prism's contemporary_clean grammar applied to each component.

Prism tokens:
  Outfit typeface, 9 sizes (9, 10, 11, 12.5, 13, 13.5, 16)
  Glass elevation: rgba(255,255,255,0.08) default, 0.14 hover/selected, 0.18 user_message
  Glass border: 1px rgba(255,255,255,0.12)
  Gradient bg: 150deg (#4A5D6B → #5A4A5E → #6B5A5A → #4A6058)
  Text: 0.90 primary, 0.60 secondary, 0.40 muted, 0.30 very-muted (white with opacity)
  Teal accent: #7DDFBE (ONLY for status signals: online dots, unread badges)
  Border radius: 12 default, 10 inputs, 20 chrome
  No box-shadow; no emoji; single-letter monogram avatars
  Tracking: -0.02em on headers, 0 elsewhere

Coverage scope:
  Primitives: button (primary/secondary/ghost), input (text/password/search),
              textarea, select, checkbox, radio, toggle, label (default/required),
              icon (glyph, placeholder), avatar (monogram, with-status), badge (count/dot),
              divider (hairline/default/strong)
  Composites: card (default/elevated/glass), list_item (default/selected/compact),
              form_field (default/with_help/with_error), table_row (default/header/selected),
              table_header, nav_item (top_level/sub_item), tab_item (default/active),
              breadcrumb_trail, pagination, toast (info/success/error),
              stat (default), key_value (default), button_group (segmented),
              search_bar (default), accordion_item (default/expanded),
              banner (info/error)

Output goes to ./prism-library/components/
Each SVG embeds gradient slice for isolation + component details per Prism grammar.
"""

import sys
from pathlib import Path

# ──────────────────────────────────────────────────────────────────────
# PRISM WRAPPER & GRADIENTS
# ──────────────────────────────────────────────────────────────────────

STANDARD_DEFS = """  <defs>
    <style>
      .text-primary { fill: rgba(255,255,255,0.90); font-family: Outfit, system-ui, sans-serif; }
      .text-secondary { fill: rgba(255,255,255,0.60); font-family: Outfit, system-ui, sans-serif; }
      .text-muted { fill: rgba(255,255,255,0.40); font-family: Outfit, system-ui, sans-serif; }
      .text-very-muted { fill: rgba(255,255,255,0.30); font-family: Outfit, system-ui, sans-serif; }
      .text-accent { fill: #7DDFBE; font-family: Outfit, system-ui, sans-serif; }
    </style>
    <linearGradient id="prism-bg-strip" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#5A4A5E"/>
      <stop offset="1" stop-color="#6B5A5A"/>
    </linearGradient>
  </defs>"""


def wrap_svg(width: int, height: int, body: str, comment: str = "") -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">
{STANDARD_DEFS}
  <!-- {comment} -->
  <rect x="0" y="0" width="{width}" height="{height}" fill="url(#prism-bg-strip)"/>
{body}
</svg>
"""


# ──────────────────────────────────────────────────────────────────────
# COMPONENTS
# ──────────────────────────────────────────────────────────────────────

COMPONENTS = {

    # ═════════════════════ PRIMITIVES ═════════════════════

    # Button — glass panels with Outfit text. Primary uses teal CTA text,
    # secondary uses white-0.85, ghost is transparent with text.

    "button-primary": (140, 48, """
  <rect x="8" y="8" width="124" height="32" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="8" ry="8"/>
  <text x="70" y="32" text-anchor="middle" class="text-accent" font-size="13" font-weight="500">Send</text>
"""),

    "button-secondary": (140, 48, """
  <rect x="8" y="8" width="124" height="32" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="8" ry="8"/>
  <text x="70" y="32" text-anchor="middle" class="text-primary" font-size="13" font-weight="500">Cancel</text>
"""),

    "button-ghost": (140, 48, """
  <rect x="8" y="8" width="124" height="32" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="8" ry="8"/>
  <text x="70" y="32" text-anchor="middle" class="text-secondary" font-size="13" font-weight="500">Dismiss</text>
"""),

    # Input — glass panel with Outfit text, rounded corners per inputs rule (10px)
    "input-text": (240, 44, """
  <rect x="0" y="0" width="240" height="44" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="10" ry="10"/>
  <text x="14" y="28" class="text-muted" font-size="13">your message</text>
"""),

    "input-password": (240, 44, """
  <rect x="0" y="0" width="240" height="44" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="10" ry="10"/>
  <text x="14" y="28" class="text-primary" font-size="13" letter-spacing="2">••••••••</text>
"""),

    "input-search": (240, 44, """
  <rect x="0" y="0" width="240" height="44" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="10" ry="10"/>
  <text x="14" y="28" class="text-muted" font-size="13">search threads…</text>
  <text x="226" y="28" class="text-accent" font-size="13" text-anchor="end">⌕</text>
"""),

    # Textarea — multi-line glass panel
    "textarea-default": (240, 100, """
  <rect x="0" y="0" width="240" height="100" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="10" ry="10"/>
  <text x="14" y="28" class="text-muted" font-size="13">compose a message…</text>
"""),

    # Select — glass panel with Outfit chevron
    "select-default": (240, 44, """
  <rect x="0" y="0" width="240" height="44" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="10" ry="10"/>
  <text x="14" y="28" class="text-primary" font-size="13">Choose</text>
  <text x="226" y="28" class="text-secondary" font-size="13" text-anchor="end">▾</text>
"""),

    # Checkbox — glass square, teal check when selected
    "checkbox-checked": (120, 32, """
  <rect x="0" y="6" width="20" height="20" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="6" ry="6"/>
  <path d="M 5 14 L 8 17 L 15 9" fill="none" stroke="#7DDFBE" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="28" y="22" class="text-primary" font-size="13">Option</text>
"""),

    "checkbox-unchecked": (120, 32, """
  <rect x="0" y="6" width="20" height="20" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="6" ry="6"/>
  <text x="28" y="22" class="text-primary" font-size="13">Option</text>
"""),

    # Radio — glass circle, teal dot when selected
    "radio-selected": (120, 32, """
  <circle cx="10" cy="16" r="9.5" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
  <circle cx="10" cy="16" r="4.5" fill="#7DDFBE"/>
  <text x="28" y="22" class="text-primary" font-size="13">Option</text>
"""),

    "radio-unselected": (120, 32, """
  <circle cx="10" cy="16" r="9.5" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
  <text x="28" y="22" class="text-primary" font-size="13">Option</text>
"""),

    # Toggle — glass track with teal thumb when on
    "toggle-on": (100, 32, """
  <rect x="0" y="10" width="44" height="20" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="10" ry="10"/>
  <rect x="24" y="12" width="16" height="16" fill="#7DDFBE" rx="8" ry="8"/>
"""),

    "toggle-off": (100, 32, """
  <rect x="0" y="10" width="44" height="20" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="10" ry="10"/>
  <rect x="4" y="12" width="16" height="16" fill="rgba(255,255,255,0.14)" rx="8" ry="8"/>
"""),

    # Label — text with optional asterisk
    "label-default": (160, 16, """
  <text x="0" y="13" class="text-secondary" font-size="11">Label</text>
"""),

    "label-required": (160, 16, """
  <text x="0" y="13" class="text-secondary" font-size="11">Label <tspan class="text-accent">*</tspan></text>
"""),

    # Icon — Outfit glyph (▾ × +) or placeholder glass rect
    "icon-chevron": (24, 24, """
  <text x="12" y="18" text-anchor="middle" class="text-secondary" font-size="14">▾</text>
"""),

    "icon-close": (24, 24, """
  <text x="12" y="18" text-anchor="middle" class="text-secondary" font-size="14">×</text>
"""),

    "icon-plus": (24, 24, """
  <text x="12" y="18" text-anchor="middle" class="text-secondary" font-size="14">+</text>
"""),

    "icon-placeholder": (24, 24, """
  <rect x="2" y="2" width="20" height="20" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="6" ry="6"/>
"""),

    # Avatar — single-letter monogram on glass square, with optional status dot
    "avatar-monogram": (34, 34, """
  <rect x="0" y="0" width="34" height="34" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="8" ry="8"/>
  <text x="17" y="24" text-anchor="middle" class="text-primary" font-size="15" font-weight="500">T</text>
"""),

    "avatar-with-status": (34, 34, """
  <rect x="0" y="0" width="34" height="34" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="8" ry="8"/>
  <text x="17" y="24" text-anchor="middle" class="text-primary" font-size="15" font-weight="500">T</text>
  <circle cx="28" cy="28" r="4" fill="#7DDFBE" stroke="rgba(74,93,107,0.8)" stroke-width="1.5"/>
"""),

    # Badge — small glass panel, count or dot variant
    "badge-count": (28, 18, """
  <rect x="0" y="0" width="28" height="18" fill="rgba(125,223,190,0.25)" stroke="rgba(125,223,190,0.40)" stroke-width="1" rx="6" ry="6"/>
  <text x="14" y="14" text-anchor="middle" class="text-accent" font-size="9" font-weight="600">2</text>
"""),

    "badge-dot": (8, 8, """
  <circle cx="4" cy="4" r="4" fill="#7DDFBE"/>
"""),

    # Divider — hairline, default, strong
    "divider-hairline": (240, 1, """
  <line x1="0" y1="0.5" x2="240" y2="0.5" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
"""),

    "divider-default": (240, 1, """
  <line x1="0" y1="0.5" x2="240" y2="0.5" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
"""),

    "divider-strong": (240, 1, """
  <line x1="0" y1="0.5" x2="240" y2="0.5" stroke="rgba(255,255,255,0.20)" stroke-width="1"/>
"""),


    # ═════════════════════ COMPOSITES ═════════════════════

    # Card — glass elevation tiers
    "card-default": (240, 120, """
  <rect x="0" y="0" width="240" height="120" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="12" ry="12"/>
  <text x="12" y="24" class="text-secondary" font-size="11">Card label</text>
  <text x="12" y="50" class="text-primary" font-size="13">Content lives here with flexibility</text>
  <text x="12" y="70" class="text-muted" font-size="11">supporting text or description</text>
"""),

    "card-elevated": (240, 120, """
  <rect x="0" y="0" width="240" height="120" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="12" ry="12"/>
  <text x="12" y="24" class="text-secondary" font-size="11">Elevated card</text>
  <text x="12" y="50" class="text-primary" font-size="13">Higher prominence tier for</text>
  <text x="12" y="70" class="text-muted" font-size="11">featured or interactive content</text>
"""),

    "card-glass": (240, 120, """
  <rect x="0" y="0" width="240" height="120" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="12" ry="12"/>
  <text x="12" y="24" class="text-secondary" font-size="11">Glass variant</text>
  <text x="12" y="50" class="text-primary" font-size="13">Explicit glass tier (0.08) for</text>
  <text x="12" y="70" class="text-muted" font-size="11">subtle differentiation</text>
"""),

    # List item — signature Prism component (default/selected/compact)
    "list-item-default": (280, 64, """
  <rect x="8" y="8" width="264" height="48" fill="none" stroke="none" rx="12" ry="12"/>
  <rect x="14" y="15" width="34" height="34" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="10" ry="10"/>
  <text x="31" y="38" text-anchor="middle" class="text-primary" font-size="15" font-weight="500">T</text>
  <circle cx="46" cy="47" r="4" fill="#7DDFBE" stroke="rgba(74,93,107,0.8)" stroke-width="2"/>
  <text x="58" y="29" class="text-primary" font-size="12.5" font-weight="500">Tokyo Trip</text>
  <text x="266" y="29" class="text-very-muted" font-size="10" text-anchor="end">2m</text>
  <text x="58" y="46" class="text-muted" font-size="11">Build day-by-day itinerary…</text>
  <rect x="244" y="38" width="18" height="18" fill="rgba(125,223,190,0.25)" stroke="rgba(125,223,190,0.40)" stroke-width="1" rx="6" ry="6"/>
  <text x="253" y="51" class="text-accent" font-size="9" font-weight="600" text-anchor="middle">2</text>
"""),

    "list-item-selected": (280, 64, """
  <rect x="8" y="8" width="264" height="48" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="12" ry="12"/>
  <rect x="14" y="15" width="34" height="34" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="10" ry="10"/>
  <text x="31" y="38" text-anchor="middle" class="text-primary" font-size="15" font-weight="500">T</text>
  <circle cx="46" cy="47" r="4" fill="#7DDFBE" stroke="rgba(74,93,107,0.8)" stroke-width="2"/>
  <text x="58" y="29" class="text-primary" font-size="12.5" font-weight="500">Tokyo Trip</text>
  <text x="266" y="29" class="text-very-muted" font-size="10" text-anchor="end">2m</text>
  <text x="58" y="46" class="text-muted" font-size="11">Build day-by-day itinerary…</text>
  <rect x="244" y="38" width="18" height="18" fill="rgba(125,223,190,0.25)" stroke="rgba(125,223,190,0.40)" stroke-width="1" rx="6" ry="6"/>
  <text x="253" y="51" class="text-accent" font-size="9" font-weight="600" text-anchor="middle">2</text>
"""),

    "list-item-compact": (280, 40, """
  <rect x="14" y="6" width="34" height="28" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="8" ry="8"/>
  <text x="31" y="26" text-anchor="middle" class="text-primary" font-size="13" font-weight="500">R</text>
  <text x="58" y="26" class="text-primary" font-size="12.5" font-weight="500">Recipe ideas</text>
  <text x="266" y="26" class="text-very-muted" font-size="10" text-anchor="end">1h</text>
"""),

    # Form field — label + input + optional help/error
    "form-field-default": (240, 60, """
  <text x="0" y="14" class="text-secondary" font-size="11">Email</text>
  <rect x="0" y="20" width="240" height="32" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="10" ry="10"/>
  <text x="12" y="44" class="text-muted" font-size="13">user@example.com</text>
"""),

    "form-field-with-help": (240, 80, """
  <text x="0" y="14" class="text-secondary" font-size="11">Email</text>
  <rect x="0" y="20" width="240" height="32" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="10" ry="10"/>
  <text x="12" y="44" class="text-primary" font-size="13">user@example.com</text>
  <text x="0" y="68" class="text-muted" font-size="10">We'll use this for login and notifications.</text>
"""),

    "form-field-with-error": (240, 80, """
  <text x="0" y="14" class="text-secondary" font-size="11">Email</text>
  <rect x="0" y="20" width="240" height="32" fill="rgba(255,255,255,0.08)" stroke="rgba(255,140,140,0.85)" stroke-width="1" rx="10" ry="10"/>
  <text x="12" y="44" class="text-primary" font-size="13">invalid-email</text>
  <text x="0" y="68" fill="rgba(255,140,140,0.85)" font-size="10">Please enter a valid email address.</text>
"""),

    # Table row — default/header/selected
    "table-row-default": (480, 40, """
  <rect x="0" y="0" width="480" height="40" fill="none" stroke="none"/>
  <text x="12" y="28" class="text-primary" font-size="12.5" font-weight="500">Alex Rivera</text>
  <text x="200" y="28" class="text-secondary" font-size="12">alex@northwind.com</text>
  <text x="380" y="28" class="text-secondary" font-size="12">Administrator</text>
  <line x1="0" y1="39.5" x2="480" y2="39.5" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
"""),

    "table-row-header": (480, 32, """
  <rect x="0" y="0" width="480" height="32" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="8" ry="8"/>
  <text x="12" y="21" class="text-secondary" font-size="10" font-weight="600">Name</text>
  <text x="200" y="21" class="text-secondary" font-size="10" font-weight="600">Email</text>
  <text x="380" y="21" class="text-secondary" font-size="10" font-weight="600">Role</text>
"""),

    "table-row-selected": (480, 40, """
  <rect x="0" y="0" width="480" height="40" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="8" ry="8"/>
  <text x="12" y="28" class="text-primary" font-size="12.5" font-weight="500">Alex Rivera</text>
  <text x="200" y="28" class="text-secondary" font-size="12">alex@northwind.com</text>
  <text x="380" y="28" class="text-secondary" font-size="12">Administrator</text>
"""),

    # Table header — column headers row
    "table-header-default": (480, 32, """
  <rect x="0" y="0" width="480" height="32" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="8" ry="8"/>
  <text x="12" y="21" class="text-secondary" font-size="10" font-weight="600">Name</text>
  <text x="200" y="21" class="text-secondary" font-size="10" font-weight="600">Email</text>
  <text x="380" y="21" class="text-secondary" font-size="10" font-weight="600">Role</text>
"""),

    # Nav item — top level / sub item
    "nav-item-top-level": (140, 32, """
  <text x="0" y="22" class="text-primary" font-size="13" font-weight="500">Dashboard</text>
"""),

    "nav-item-sub-item": (140, 28, """
  <text x="16" y="20" class="text-secondary" font-size="12">Settings</text>
"""),

    # Tab item — default / active
    "tab-item-default": (100, 40, """
  <text x="50" y="26" text-anchor="middle" class="text-secondary" font-size="13">Tab</text>
"""),

    "tab-item-active": (100, 40, """
  <text x="50" y="26" text-anchor="middle" class="text-primary" font-size="13" font-weight="600">Active</text>
  <line x1="10" y1="38" x2="90" y2="38" stroke="#7DDFBE" stroke-width="1.5"/>
"""),

    # Breadcrumb trail
    "breadcrumb-default": (240, 20, """
  <text x="0" y="16" class="text-secondary" font-size="11">Home</text>
  <text x="40" y="16" class="text-secondary" font-size="11">›</text>
  <text x="60" y="16" class="text-primary" font-size="11">Settings</text>
"""),

    # Pagination
    "pagination-default": (240, 28, """
  <text x="0" y="20" class="text-secondary" font-size="10">1 of 12</text>
  <rect x="160" y="8" width="20" height="20" fill="rgba(125,223,190,0.25)" stroke="rgba(125,223,190,0.40)" stroke-width="1" rx="4" ry="4"/>
  <text x="170" y="22" text-anchor="middle" class="text-accent" font-size="10" font-weight="600">2</text>
  <text x="196" y="20" class="text-secondary" font-size="10">›</text>
"""),

    # Toast — info/success/error
    "toast-info": (280, 56, """
  <rect x="0" y="0" width="280" height="56" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="12" ry="12"/>
  <circle cx="18" cy="28" r="4" fill="#7DDFBE"/>
  <text x="36" y="20" class="text-secondary" font-size="9" font-weight="600">UPDATE</text>
  <text x="36" y="40" class="text-primary" font-size="12">Profile saved successfully.</text>
  <text x="266" y="28" text-anchor="end" class="text-secondary" font-size="12">×</text>
"""),

    "toast-error": (280, 56, """
  <rect x="0" y="0" width="280" height="56" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="12" ry="12"/>
  <circle cx="18" cy="28" r="4" fill="rgba(255,140,140,0.85)"/>
  <text x="36" y="20" class="text-secondary" font-size="9" font-weight="600">ERROR</text>
  <text x="36" y="40" class="text-primary" font-size="12">Connection lost. Try again.</text>
  <text x="266" y="28" text-anchor="end" class="text-secondary" font-size="12">×</text>
"""),

    # Stat — large number display
    "stat-default": (160, 80, """
  <text x="0" y="14" class="text-secondary" font-size="10">REVENUE</text>
  <text x="0" y="56" class="text-primary" font-size="32" font-weight="500">24.5K</text>
  <text x="0" y="74" class="text-muted" font-size="10">+12% from last month</text>
"""),

    # Key-value
    "key-value-default": (180, 32, """
  <text x="0" y="12" class="text-secondary" font-size="10" font-weight="600">JOINED</text>
  <text x="0" y="30" class="text-primary" font-size="12">January 2024</text>
"""),

    # Button group — segmented
    "button-group-segmented": (240, 40, """
  <rect x="0" y="0" width="240" height="40" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="10" ry="10"/>
  <text x="40" y="26" text-anchor="middle" class="text-primary" font-size="12" font-weight="500">All</text>
  <line x1="80" y1="8" x2="80" y2="32" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
  <text x="120" y="26" text-anchor="middle" class="text-secondary" font-size="12">Active</text>
  <line x1="160" y1="8" x2="160" y2="32" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
  <text x="200" y="26" text-anchor="middle" class="text-secondary" font-size="12">Archive</text>
"""),

    # Search bar
    "search-bar-default": (240, 44, """
  <rect x="0" y="0" width="240" height="44" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="10" ry="10"/>
  <text x="14" y="28" class="text-muted" font-size="13">search threads…</text>
  <text x="226" y="28" class="text-accent" font-size="13" text-anchor="end">⌕</text>
"""),

    # Accordion item — default / expanded
    "accordion-default": (240, 48, """
  <rect x="0" y="0" width="240" height="48" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="10" ry="10"/>
  <text x="12" y="30" class="text-primary" font-size="12.5" font-weight="500">Notifications</text>
  <text x="228" y="30" class="text-secondary" font-size="12" text-anchor="end">▾</text>
"""),

    "accordion-expanded": (240, 128, """
  <rect x="0" y="0" width="240" height="128" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="10" ry="10"/>
  <text x="12" y="30" class="text-primary" font-size="12.5" font-weight="500">Notifications</text>
  <text x="228" y="30" class="text-secondary" font-size="12" text-anchor="end">▴</text>
  <line x1="0" y1="47.5" x2="240" y2="47.5" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  <text x="12" y="70" class="text-secondary" font-size="10">Email digests daily at 9am</text>
  <text x="12" y="90" class="text-secondary" font-size="10">Desktop notifications enabled</text>
  <text x="12" y="110" class="text-secondary" font-size="10">Mobile notifications enabled</text>
"""),

    # Banner — info / error (full width; we'll show 240px)
    "banner-info": (240, 48, """
  <rect x="0" y="0" width="240" height="48" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="10" ry="10"/>
  <circle cx="12" cy="24" r="3" fill="#7DDFBE"/>
  <text x="24" y="20" class="text-secondary" font-size="9" font-weight="600">UPDATE</text>
  <text x="24" y="36" class="text-primary" font-size="11">New version available.</text>
"""),

    "banner-error": (240, 48, """
  <rect x="0" y="0" width="240" height="48" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" rx="10" ry="10"/>
  <circle cx="12" cy="24" r="3" fill="rgba(255,140,140,0.85)"/>
  <text x="24" y="20" class="text-secondary" font-size="9" font-weight="600">ERROR</text>
  <text x="24" y="36" class="text-primary" font-size="11">Connection failed.</text>
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
    out_dir = Path(__file__).resolve().parent.parent / "prism-library" / "components"
    out_dir.mkdir(parents=True, exist_ok=True)

    written = []
    for component_id, (width, height, body) in COMPONENTS.items():
        if only and component_id != only:
            continue
        path = out_dir / f"{component_id}.svg"
        svg = wrap_svg(width, height, body, component_id.upper())
        path.write_text(svg)
        written.append(path)

    print(f"Wrote {len(written)} Prism component SVGs to {out_dir}")


if __name__ == "__main__":
    main()
