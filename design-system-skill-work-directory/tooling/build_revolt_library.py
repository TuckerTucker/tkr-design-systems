#!/usr/bin/env python3
"""
Build the Revolt design system's component library against the LIBRARY-SPEC
vocabulary. Revolt is neobrutalist + Y2K: 2px black borders, 4px hard offset
shadows, Space Mono monospace throughout, generous tracking, pink/lime pairing,
two-letter uppercase avatars (no emoji).

Revolt tokens:
  Page bg: #FFFEF5 (paper offwhite)
  Text: #111111 (ink hard) with #666666/#999999 greys
  Borders: 2px solid #111111 (default), 3px for major dividers
  Shadows: 4px 4px 0 #111111 (hard offset, zero blur, drawn as <rect> first)
  Accents: #FF3366 (pink) for headers, user messages, unread badges, selected avatars
           #C8FF00 (lime) for brand bar, selected state, send button
  Typography: Space Mono ('Space Mono', ui-monospace, monospace) for ALL text
  Type scale: 8 tiny_metadata, 9 pill_label, 10 timestamp_label, 11 secondary_body,
              11.5 body, 12 header, 14 brand
  Tracking: 0.10em metadata, 0.04em body, 0.08em headers
  No radius anywhere — right angles only.
  No emoji anywhere — avatars use two-letter uppercase abbreviations.

Coverage scope:
  Primitives: button (primary/secondary/ghost/disabled/danger), input, textarea,
              select, checkbox (default/indeterminate), radio, toggle, label,
              icon, avatar, badge, divider
  Composites: card, list_item, form_field, table_row, table_header, nav_item,
              tab_item, breadcrumb_trail, pagination, toast, stat, key_value,
              button_group, search_bar, accordion_item, banner
  Total: 26+ components, most with 1-2 variants each

Output goes to ./revolt-library/components/
"""

import sys
from pathlib import Path

# ──────────────────────────────────────────────────────────────────────
# REVOLT SVG WRAPPER
# ──────────────────────────────────────────────────────────────────────

STANDARD_DEFS = """  <defs>
    <style>
      .text-primary { fill: #111111; font-family: 'Space Mono', ui-monospace, monospace; }
      .text-secondary { fill: #666666; font-family: 'Space Mono', ui-monospace, monospace; }
      .text-muted { fill: #999999; font-family: 'Space Mono', ui-monospace, monospace; }
      .text-inverse { fill: #FFFFFF; font-family: 'Space Mono', ui-monospace, monospace; }
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

    # Button — Revolt style: 2px black borders, 4px hard offset shadow underneath
    # Space Mono all-caps tracking labels. Primary white-bg, secondary lime-bg,
    # ghost text-only, disabled grey-bg, danger pink-bg with white text.

    "button-primary": (140, 48, """
  <rect x="2" y="2" width="136" height="44" fill="#111111"/>
  <rect x="0" y="0" width="136" height="44" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="68" y="30" text-anchor="middle" class="text-primary" font-size="11" font-weight="700" letter-spacing="0.44">SEND</text>
"""),

    "button-secondary": (140, 48, """
  <rect x="2" y="2" width="136" height="44" fill="#111111"/>
  <rect x="0" y="0" width="136" height="44" fill="#C8FF00" stroke="#111111" stroke-width="2"/>
  <text x="68" y="30" text-anchor="middle" class="text-primary" font-size="11" font-weight="700" letter-spacing="0.44">ACTION</text>
"""),

    "button-ghost": (140, 48, """
  <text x="68" y="30" text-anchor="middle" class="text-primary" font-size="11" font-weight="700" letter-spacing="0.44">CANCEL</text>
"""),

    "button-disabled": (140, 48, """
  <rect x="2" y="2" width="136" height="44" fill="#111111"/>
  <rect x="0" y="0" width="136" height="44" fill="#CCCCCC" stroke="#111111" stroke-width="2"/>
  <text x="68" y="30" text-anchor="middle" class="text-muted" font-size="11" font-weight="700" letter-spacing="0.44">DISABLED</text>
"""),

    "button-danger": (140, 48, """
  <rect x="2" y="2" width="136" height="44" fill="#111111"/>
  <rect x="0" y="0" width="136" height="44" fill="#FF3366" stroke="#111111" stroke-width="2"/>
  <text x="68" y="30" text-anchor="middle" class="text-inverse" font-size="11" font-weight="700" letter-spacing="0.44">DELETE</text>
"""),

    # Input — 2px black border, no shadow (inputs are minimal), white fill,
    # Space Mono placeholder text in grey, uppercase label above

    "input-text": (200, 56, """
  <text x="0" y="10" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.8">EMAIL</text>
  <rect x="0" y="18" width="200" height="32" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="8" y="40" class="text-muted" font-size="10">type…</text>
"""),

    "input-search": (200, 32, """
  <rect x="0" y="0" width="200" height="32" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="4" y="20" class="text-muted" font-size="9" font-weight="700">>FIND</text>
"""),

    "input-password": (200, 56, """
  <text x="0" y="10" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.8">PASSWORD</text>
  <rect x="0" y="18" width="200" height="32" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="8" y="40" class="text-primary" font-size="10" letter-spacing="1.5">••••••••</text>
"""),

    # Textarea — multi-line input with same border treatment

    "textarea-default": (200, 80, """
  <text x="0" y="10" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.8">MESSAGE</text>
  <rect x="0" y="18" width="200" height="64" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="8" y="38" class="text-muted" font-size="10">write here…</text>
"""),

    # Select — input grammar with ▾ chevron on right in Space Mono

    "select-default": (200, 56, """
  <text x="0" y="10" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.8">CHOOSE</text>
  <rect x="0" y="18" width="200" height="32" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="8" y="40" class="text-primary" font-size="10">Option 1</text>
  <text x="192" y="40" text-anchor="end" class="text-secondary" font-size="11" font-weight="700">▾</text>
"""),

    # Checkbox — 2px border square (not a circle), thick black checkmark on checked,
    # horizontal bar for indeterminate

    "checkbox-checked": (100, 20, """
  <rect x="0" y="0" width="16" height="16" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <line x1="3" y1="8" x2="6" y2="11" stroke="#111111" stroke-width="2.5" stroke-linecap="butt"/>
  <line x1="6" y1="11" x2="13" y2="3" stroke="#111111" stroke-width="2.5" stroke-linecap="butt"/>
  <text x="24" y="14" class="text-primary" font-size="10">checked</text>
"""),

    "checkbox-unchecked": (100, 20, """
  <rect x="0" y="0" width="16" height="16" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="24" y="14" class="text-primary" font-size="10">unchecked</text>
"""),

    "checkbox-indeterminate": (100, 20, """
  <rect x="0" y="0" width="16" height="16" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <line x1="3" y1="8" x2="13" y2="8" stroke="#111111" stroke-width="2.5"/>
  <text x="24" y="14" class="text-primary" font-size="10">indeterminate</text>
"""),

    # Radio — Revolt uses squares, not circles (per no-radius rule).
    # 2px border square, filled square inside when selected

    "radio-selected": (100, 20, """
  <rect x="0" y="0" width="16" height="16" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <rect x="4" y="4" width="8" height="8" fill="#111111"/>
  <text x="24" y="14" class="text-primary" font-size="10">selected</text>
"""),

    "radio-unselected": (100, 20, """
  <rect x="0" y="0" width="16" height="16" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="24" y="14" class="text-primary" font-size="10">unselected</text>
"""),

    # Toggle — 2px bordered square track with 4px hard offset thumb on right (on)

    "toggle-on": (80, 24, """
  <rect x="2" y="2" width="72" height="20" fill="#111111"/>
  <rect x="0" y="0" width="72" height="20" fill="#C8FF00" stroke="#111111" stroke-width="2"/>
  <rect x="50" y="2" width="20" height="16" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
"""),

    "toggle-off": (80, 24, """
  <rect x="0" y="0" width="72" height="20" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <rect x="2" y="2" width="20" height="16" fill="#111111" stroke="#111111" stroke-width="2"/>
"""),

    # Label — uppercase Space Mono tracking, optional marker as pink asterisk

    "label-default": (100, 14, """
  <text x="0" y="10" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.8">LABEL</text>
"""),

    "label-required": (100, 14, """
  <text x="0" y="10" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.8">LABEL <tspan fill="#FF3366">*</tspan></text>
"""),

    # Icon — Space Mono glyph variants (>, ×, +, ↓) or placeholder square

    "icon-arrow": (24, 24, """
  <text x="12" y="18" text-anchor="middle" class="text-primary" font-size="16" font-weight="700">></text>
"""),

    "icon-close": (24, 24, """
  <text x="12" y="18" text-anchor="middle" class="text-primary" font-size="16" font-weight="700">×</text>
"""),

    "icon-plus": (24, 24, """
  <text x="12" y="18" text-anchor="middle" class="text-primary" font-size="16" font-weight="700">+</text>
"""),

    "icon-chevron-down": (24, 24, """
  <text x="12" y="18" text-anchor="middle" class="text-primary" font-size="16" font-weight="700">↓</text>
"""),

    "icon-placeholder": (24, 24, """
  <rect x="0" y="0" width="24" height="24" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
"""),

    # Avatar — 30×30 white square with 2px black border, two-letter uppercase
    # Space Mono 11px weight 700 centered. Selected variant: bg→pink, text→white.

    "avatar-default": (30, 30, """
  <rect x="0" y="0" width="30" height="30" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="15" y="22" text-anchor="middle" class="text-primary" font-size="11" font-weight="700">TT</text>
"""),

    "avatar-selected": (30, 30, """
  <rect x="0" y="0" width="30" height="30" fill="#FF3366" stroke="#111111" stroke-width="2"/>
  <text x="15" y="22" text-anchor="middle" class="text-inverse" font-size="11" font-weight="700">TT</text>
"""),

    "avatar-with-status": (38, 30, """
  <rect x="0" y="0" width="30" height="30" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="15" y="22" text-anchor="middle" class="text-primary" font-size="11" font-weight="700">TT</text>
  <rect x="24" y="18" width="10" height="10" fill="#FF3366" stroke="#111111" stroke-width="1"/>
"""),

    # Badge — count variant is pink square with white digit + 2px border;
    # status variant is small pink/lime square; tag variant is Space Mono
    # uppercase label in a bordered pill-square (no radius).

    "badge-count": (24, 20, """
  <rect x="0" y="0" width="24" height="20" fill="#FF3366" stroke="#111111" stroke-width="2"/>
  <text x="12" y="16" text-anchor="middle" class="text-inverse" font-size="9" font-weight="700">2</text>
"""),

    "badge-status-lime": (12, 12, """
  <rect x="0" y="0" width="12" height="12" fill="#C8FF00" stroke="#111111" stroke-width="1"/>
"""),

    "badge-status-pink": (12, 12, """
  <rect x="0" y="0" width="12" height="12" fill="#FF3366" stroke="#111111" stroke-width="1"/>
"""),

    "badge-tag": (60, 16, """
  <rect x="0" y="0" width="60" height="16" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="30" y="12" text-anchor="middle" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.64">TAG</text>
"""),

    # Divider — three weights: hairline (1px), default (2px), strong (3px)

    "divider-hairline": (160, 1, """
  <line x1="0" y1="0.5" x2="160" y2="0.5" stroke="#999999" stroke-width="1"/>
"""),

    "divider-default": (160, 2, """
  <line x1="0" y1="1" x2="160" y2="1" stroke="#111111" stroke-width="2"/>
"""),

    "divider-strong": (160, 3, """
  <line x1="0" y1="1.5" x2="160" y2="1.5" stroke="#111111" stroke-width="3"/>
"""),

    # ═════════════════════ COMPOSITES ═════════════════════

    # Card — white-bg, 2px border, 4px hard offset shadow (shadow drawn first)

    "card-default": (200, 100, """
  <rect x="2" y="2" width="196" height="96" fill="#111111"/>
  <rect x="0" y="0" width="196" height="96" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="8" y="20" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.8">CARD</text>
  <text x="8" y="44" class="text-primary" font-size="10">Card content here</text>
  <text x="8" y="62" class="text-secondary" font-size="9">With secondary text below.</text>
"""),

    # List item — already have examples; compose it per spec
    # Default: avatar + title + timestamp + preview, no background
    # Selected: lime fill + 2px border + 4px shadow + pink avatar

    "list-item-default": (200, 60, """
  <rect x="0" y="0" width="200" height="60" fill="#FFFEF5"/>
  <rect x="6" y="8" width="22" height="22" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="17" y="25" text-anchor="middle" font-family="'Space Mono', ui-monospace, monospace" font-size="9" font-weight="700" fill="#111111">AB</text>
  <text x="36" y="20" class="text-primary" font-size="9" font-weight="700" letter-spacing="0.36">ITEM</text>
  <text x="186" y="20" text-anchor="end" class="text-muted" font-size="8" font-weight="700">2M</text>
  <text x="36" y="38" class="text-secondary" font-size="8">preview text here…</text>
"""),

    "list-item-selected": (200, 60, """
  <rect x="2" y="2" width="196" height="56" fill="#111111"/>
  <rect x="0" y="0" width="196" height="56" fill="#C8FF00" stroke="#111111" stroke-width="2"/>
  <rect x="8" y="8" width="22" height="22" fill="#FF3366" stroke="#111111" stroke-width="2"/>
  <text x="19" y="25" text-anchor="middle" font-family="'Space Mono', ui-monospace, monospace" font-size="9" font-weight="700" fill="#FFFFFF">AB</text>
  <text x="38" y="20" class="text-primary" font-size="9" font-weight="700" letter-spacing="0.36">ITEM</text>
  <text x="186" y="20" text-anchor="end" class="text-primary" font-size="8" font-weight="700">2M</text>
  <text x="38" y="38" class="text-primary" font-size="8">preview text here…</text>
"""),

    # Form field — label above, input with 2px border, optional error message

    "form-field-default": (200, 60, """
  <text x="0" y="10" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.8">NAME</text>
  <rect x="0" y="16" width="200" height="28" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="6" y="36" class="text-primary" font-size="9">Alex Rivera</text>
"""),

    "form-field-with-error": (200, 80, """
  <text x="0" y="10" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.8">EMAIL</text>
  <rect x="0" y="16" width="200" height="28" fill="#FFFFFF" stroke="#FF3366" stroke-width="2"/>
  <text x="6" y="36" class="text-primary" font-size="9">invalid-email</text>
  <text x="0" y="60" class="text-secondary" font-size="8" font-weight="700">ERROR // INVALID</text>
"""),

    # Table row — zero-padded index + cells, 2px bottom border (hairline) except header

    "table-row-default": (320, 40, """
  <text x="0" y="24" class="text-primary" font-size="9" font-weight="700">01</text>
  <text x="32" y="24" class="text-primary" font-size="9">Alex Rivera</text>
  <text x="160" y="24" class="text-secondary" font-size="9">alex@example.com</text>
  <text x="296" y="24" text-anchor="end" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.64">ACTIVE</text>
  <line x1="0" y1="38" x2="320" y2="38" stroke="#999999" stroke-width="1"/>
"""),

    "table-row-header": (320, 32, """
  <rect x="0" y="0" width="320" height="32" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="0" y="20" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.64">#</text>
  <text x="32" y="20" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.64">NAME</text>
  <text x="160" y="20" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.64">EMAIL</text>
  <text x="296" y="20" text-anchor="end" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.64">STATUS</text>
"""),

    # Nav item — uppercase label, optional icon/badge, selected state has lime bg

    "nav-item-default": (160, 28, """
  <text x="0" y="20" class="text-primary" font-size="9" font-weight="700" letter-spacing="0.36">PROJECTS</text>
"""),

    "nav-item-selected": (160, 28, """
  <rect x="2" y="2" width="156" height="24" fill="#111111"/>
  <rect x="0" y="0" width="156" height="24" fill="#C8FF00" stroke="#111111" stroke-width="2"/>
  <text x="6" y="18" class="text-primary" font-size="9" font-weight="700" letter-spacing="0.36">DASHBOARD</text>
"""),

    # Tab item — minimal label, active variant has 3px black bottom border (underline)

    "tab-item-default": (100, 32, """
  <text x="50" y="20" text-anchor="middle" class="text-secondary" font-size="9" font-weight="700">TAB</text>
"""),

    "tab-item-active": (100, 32, """
  <text x="50" y="20" text-anchor="middle" class="text-primary" font-size="9" font-weight="700">ACTIVE</text>
  <line x1="0" y1="29" x2="100" y2="29" stroke="#111111" stroke-width="3"/>
"""),

    # Breadcrumb trail — uppercase segments with /​/ separator (Space Mono //)

    "breadcrumb-default": (240, 18, """
  <text x="0" y="14" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.64">HOME</text>
  <text x="48" y="14" class="text-secondary" font-size="8" font-weight="700">//</text>
  <text x="72" y="14" class="text-primary" font-size="8" font-weight="700">SETTINGS</text>
"""),

    # Pagination — "N OF M" metadata + prev/next links

    "pagination-default": (200, 20, """
  <text x="0" y="14" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.64">01 OF 10</text>
  <text x="200" y="14" text-anchor="end" class="text-primary" font-size="8" font-weight="700">NEXT ></text>
"""),

    # Toast — bordered card (2px border, 4px shadow) with severity label and dismiss

    "toast-info": (240, 44, """
  <rect x="2" y="2" width="236" height="40" fill="#111111"/>
  <rect x="0" y="0" width="236" height="40" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="6" y="14" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.64">INFO</text>
  <text x="6" y="30" class="text-primary" font-size="9">Profile saved.</text>
  <text x="230" y="14" text-anchor="end" class="text-secondary" font-size="11" font-weight="700">×</text>
"""),

    "toast-error": (240, 44, """
  <rect x="2" y="2" width="236" height="40" fill="#111111"/>
  <rect x="0" y="0" width="236" height="40" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="6" y="14" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.64" fill="#FF3366">ERROR</text>
  <text x="6" y="30" class="text-primary" font-size="9">Something went wrong.</text>
  <text x="230" y="14" text-anchor="end" class="text-secondary" font-size="11" font-weight="700">×</text>
"""),

    # Stat — large display number with tracked label above

    "stat-default": (140, 70, """
  <text x="0" y="12" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.8">METRIC</text>
  <text x="0" y="48" class="text-primary" font-size="28" font-weight="700">1,247</text>
  <text x="0" y="64" class="text-secondary" font-size="8">vs 1,100 last period</text>
"""),

    # Key-value — uppercase key + value, minimal layout

    "key-value-default": (160, 32, """
  <text x="0" y="12" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.64">JOINED</text>
  <text x="0" y="28" class="text-primary" font-size="9">January 2024</text>
"""),

    # Button group — segmented buttons with 2px borders and dividers

    "button-group-default": (180, 32, """
  <rect x="2" y="2" width="56" height="28" fill="#111111"/>
  <rect x="0" y="0" width="56" height="28" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="28" y="20" text-anchor="middle" class="text-primary" font-size="8" font-weight="700">ALL</text>
  <line x1="58" y1="2" x2="58" y2="30" stroke="#111111" stroke-width="2"/>
  <rect x="60" y="0" width="56" height="28" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="88" y="20" text-anchor="middle" class="text-secondary" font-size="8" font-weight="700">ACTIVE</text>
  <line x1="118" y1="2" x2="118" y2="30" stroke="#111111" stroke-width="2"/>
  <rect x="120" y="0" width="56" height="28" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="148" y="20" text-anchor="middle" class="text-secondary" font-size="8" font-weight="700">DONE</text>
"""),

    # Search bar — bordered input with > prompt prefix

    "search-bar-default": (200, 32, """
  <rect x="0" y="0" width="200" height="32" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="4" y="22" class="text-secondary" font-size="11" font-weight="700">>SEARCH</text>
"""),

    # Accordion item — label with ↓ chevron, expandable

    "accordion-default": (180, 28, """
  <text x="0" y="20" class="text-primary" font-size="9" font-weight="700">SECTION</text>
  <text x="172" y="20" text-anchor="end" class="text-secondary" font-size="11" font-weight="700">↓</text>
  <line x1="0" y1="26" x2="180" y2="26" stroke="#111111" stroke-width="2"/>
"""),

    "accordion-expanded": (180, 80, """
  <text x="0" y="20" class="text-primary" font-size="9" font-weight="700">SECTION</text>
  <text x="172" y="20" text-anchor="end" class="text-secondary" font-size="11" font-weight="700">↑</text>
  <line x1="0" y1="26" x2="180" y2="26" stroke="#111111" stroke-width="2"/>
  <text x="0" y="50" class="text-secondary" font-size="8" font-weight="700">ITEM ONE</text>
  <text x="0" y="68" class="text-secondary" font-size="8" font-weight="700">ITEM TWO</text>
"""),

    # Banner — full-width bordered band with severity label + message + optional action

    "banner-info": (320, 48, """
  <rect x="2" y="2" width="316" height="44" fill="#111111"/>
  <rect x="0" y="0" width="316" height="44" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="6" y="16" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.64">INFO</text>
  <text x="6" y="34" class="text-primary" font-size="9">New version available.</text>
  <text x="310" y="34" text-anchor="end" class="text-primary" font-size="8" font-weight="700">UPDATE ></text>
"""),

    "banner-error": (320, 48, """
  <rect x="2" y="2" width="316" height="44" fill="#111111"/>
  <rect x="0" y="0" width="316" height="44" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="6" y="16" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.64" fill="#FF3366">ERROR</text>
  <text x="6" y="34" class="text-primary" font-size="9">Something failed.</text>
  <text x="310" y="34" text-anchor="end" class="text-primary" font-size="8" font-weight="700">RETRY ></text>
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
    out_dir = Path(__file__).resolve().parent.parent / "revolt-library" / "components"
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

    print(f"Wrote {len(written)} Revolt component SVGs to {out_dir}")


if __name__ == "__main__":
    main()
