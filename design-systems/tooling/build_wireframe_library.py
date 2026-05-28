#!/usr/bin/env python3
"""
Build the wireframe library's per-component SVGs.

Each component is authored with the same standardized SVG wrapper (CSS classes
in <defs><style>, correct viewBox, banner comments, no double-hyphens).

The body of each component is a pure-SVG fragment defined inline below.
Adding a component = adding an entry to COMPONENTS.

Usage:
    python3 build_wireframe_library.py
    python3 build_wireframe_library.py --only button-primary

Output goes to ./wireframe-library/ (components/ + layouts/).
"""

import sys
from pathlib import Path

# ──────────────────────────────────────────────────────────────────────
# THE STANDARD WRAPPER
# ──────────────────────────────────────────────────────────────────────
# Every component SVG has this wrapper. The CSS classes are mandatory per
# the wireframe-spec.yaml's `wireframe-css-classes-not-inline-fills` rule.

STANDARD_DEFS = """  <defs>
    <style>
      .text-primary { fill: #212121; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .text-secondary { fill: #757575; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .text-disabled { fill: #BDBDBD; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .text-inverse { fill: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .text-danger { fill: #B71C1C; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .text-success { fill: #2E7D32; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .text-warning { fill: #E65100; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .text-info { fill: #1565C0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    </style>
  </defs>"""


def wrap_svg(width: int, height: int, body: str, comment: str = "") -> str:
    """Wrap a component body in the standard SVG envelope."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">
{STANDARD_DEFS}
  {comment}
{body}
</svg>
"""


# ──────────────────────────────────────────────────────────────────────
# COMPONENT BODIES
# ──────────────────────────────────────────────────────────────────────
# Format: { component-id: {variant-id: (width, height, body_svg)}, ... }
# Body is the inner SVG (excluding <svg>, <defs>, comments at top level).

COMPONENTS = {

    # ═════════════════════════ PRIMITIVES ═════════════════════════

    "button-primary": (160, 48, """
  <rect width="160" height="48" rx="6" fill="#424242"/>
  <text x="80" y="30" text-anchor="middle" class="text-inverse" font-size="14" font-weight="500">Primary</text>
"""),

    "button-secondary": (160, 48, """
  <rect width="160" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="80" y="30" text-anchor="middle" class="text-secondary" font-size="14" font-weight="500">Secondary</text>
"""),

    "button-ghost": (160, 48, """
  <rect width="160" height="48" rx="6" fill="transparent"/>
  <text x="80" y="30" text-anchor="middle" class="text-secondary" font-size="14" font-weight="500">Ghost</text>
"""),

    "button-disabled": (160, 48, """
  <rect width="160" height="48" rx="6" fill="#E0E0E0"/>
  <text x="80" y="30" text-anchor="middle" class="text-disabled" font-size="14" font-weight="500">Disabled</text>
"""),

    "button-danger": (160, 48, """
  <rect width="160" height="48" rx="6" fill="#B71C1C"/>
  <text x="80" y="30" text-anchor="middle" class="text-inverse" font-size="14" font-weight="500">Delete</text>
"""),

    "button-small": (100, 32, """
  <rect width="100" height="32" rx="4" fill="#424242"/>
  <text x="50" y="21" text-anchor="middle" class="text-inverse" font-size="12" font-weight="500">Small</text>
"""),

    "button-large": (200, 56, """
  <rect width="200" height="56" rx="8" fill="#424242"/>
  <text x="100" y="34" text-anchor="middle" class="text-inverse" font-size="16" font-weight="500">Large</text>
"""),

    "button-full-width": (351, 48, """
  <rect width="351" height="48" rx="6" fill="#424242"/>
  <text x="175.5" y="30" text-anchor="middle" class="text-inverse" font-size="14" font-weight="500">Full Width Action</text>
"""),

    # Inputs

    "input-text": (320, 76, """
  <text x="0" y="14" class="text-secondary" font-size="12">Label</text>
  <rect y="22" width="320" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="16" y="52" class="text-disabled" font-size="14">Placeholder text</text>
"""),

    "input-password": (320, 76, """
  <text x="0" y="14" class="text-secondary" font-size="12">Password</text>
  <rect y="22" width="320" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="16" y="55" class="text-primary" font-size="18" letter-spacing="2">••••••••</text>
"""),

    "input-search": (320, 48, """
  <rect width="320" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <circle cx="20" cy="24" r="6" fill="none" stroke="#757575" stroke-width="1.5"/>
  <line x1="25" y1="29" x2="30" y2="34" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>
  <text x="40" y="30" class="text-disabled" font-size="14">Search</text>
"""),

    "input-numeric": (160, 76, """
  <text x="0" y="14" class="text-secondary" font-size="12">Quantity</text>
  <rect y="22" width="160" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="144" y="52" text-anchor="end" class="text-primary" font-size="14">42</text>
"""),

    # Textarea

    "textarea-default": (320, 124, """
  <text x="0" y="14" class="text-secondary" font-size="12">Description</text>
  <rect y="22" width="320" height="96" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="16" y="46" class="text-disabled" font-size="14">Enter longer text...</text>
  <text x="296" y="106" text-anchor="end" class="text-disabled" font-size="11">0/500</text>
"""),

    "textarea-auto-grow": (320, 124, """
  <text x="0" y="14" class="text-secondary" font-size="12">Notes</text>
  <rect y="22" width="320" height="96" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="16" y="46" class="text-disabled" font-size="14">Type here, the field will grow...</text>
"""),

    # Select

    "select-dropdown": (320, 76, """
  <text x="0" y="14" class="text-secondary" font-size="12">Category</text>
  <rect y="22" width="320" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="16" y="52" class="text-primary" font-size="14">Selected option</text>
  <path d="M 290 44 L 298 52 L 306 44" fill="none" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>
"""),

    "select-native": (320, 76, """
  <text x="0" y="14" class="text-secondary" font-size="12">Category</text>
  <rect y="22" width="320" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="16" y="52" class="text-primary" font-size="14">Selected option</text>
  <path d="M 290 44 L 298 52 L 306 44" fill="none" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>
"""),

    # Checkbox

    "checkbox-default": (200, 28, """
  <rect width="20" height="20" rx="4" fill="#424242"/>
  <path d="M 4 10 L 8 14 L 16 6" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="32" y="15" class="text-primary" font-size="14">Checked option</text>
"""),

    "checkbox-indeterminate": (200, 28, """
  <rect width="20" height="20" rx="4" fill="#424242"/>
  <line x1="5" y1="10" x2="15" y2="10" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
  <text x="32" y="15" class="text-primary" font-size="14">Some selected</text>
"""),

    # Radio

    "radio-default": (200, 28, """
  <circle cx="10" cy="10" r="10" fill="none" stroke="#424242" stroke-width="1.5"/>
  <circle cx="10" cy="10" r="4" fill="#424242"/>
  <text x="32" y="15" class="text-primary" font-size="14">Selected</text>
"""),

    # Toggle

    "toggle-default": (200, 24, """
  <rect width="44" height="24" rx="12" fill="#424242"/>
  <circle cx="32" cy="12" r="10" fill="#FFFFFF"/>
  <text x="56" y="17" class="text-primary" font-size="14">On</text>
"""),

    # Label

    "label-default": (200, 16, """
  <text x="0" y="13" class="text-secondary" font-size="12">Label text</text>
"""),

    "label-required": (200, 16, """
  <text x="0" y="13" class="text-secondary" font-size="12">Label text</text>
  <text x="68" y="13" class="text-danger" font-size="12">*</text>
"""),

    "label-optional": (200, 16, """
  <text x="0" y="13" class="text-secondary" font-size="12">Label text</text>
  <text x="68" y="13" class="text-disabled" font-size="11">(optional)</text>
"""),

    # Icon (16x16 generic placeholders, drawn as outlined)

    "icon-outlined": (16, 16, """
  <rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="#757575" stroke-width="1.5"/>
"""),

    "icon-filled": (16, 16, """
  <rect x="2" y="2" width="12" height="12" rx="2" fill="#757575"/>
"""),

    # Avatar

    "avatar-monogram": (32, 32, """
  <circle cx="16" cy="16" r="16" fill="#E0E0E0"/>
  <text x="16" y="20" text-anchor="middle" class="text-secondary" font-size="11" font-weight="600">AR</text>
"""),

    "avatar-photo-placeholder": (32, 32, """
  <defs>
    <pattern id="diag" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="6" stroke="#BDBDBD" stroke-width="1"/>
    </pattern>
  </defs>
  <circle cx="16" cy="16" r="16" fill="url(#diag)"/>
  <circle cx="16" cy="16" r="16" fill="none" stroke="#E0E0E0" stroke-width="1"/>
"""),

    "avatar-index": (32, 32, """
  <circle cx="16" cy="16" r="16" fill="none" stroke="#E0E0E0" stroke-width="1"/>
  <text x="16" y="20" text-anchor="middle" class="text-secondary" font-size="12" font-weight="600">01</text>
"""),

    "avatar-none": (32, 32, """
  <circle cx="16" cy="16" r="16" fill="#F5F5F5" stroke="#E0E0E0" stroke-width="1"/>
"""),

    # Badge

    "badge-count": (32, 20, """
  <rect width="32" height="20" rx="10" fill="#424242"/>
  <text x="16" y="14" text-anchor="middle" class="text-inverse" font-size="11" font-weight="600">12</text>
"""),

    "badge-status": (80, 20, """
  <rect width="80" height="20" rx="10" fill="#2E7D32"/>
  <text x="40" y="14" text-anchor="middle" class="text-inverse" font-size="11" font-weight="600" letter-spacing="0.5">ACTIVE</text>
"""),

    "badge-tag": (80, 20, """
  <rect width="80" height="20" rx="10" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="40" y="14" text-anchor="middle" class="text-secondary" font-size="11">category</text>
"""),

    "badge-dot": (8, 8, """
  <circle cx="4" cy="4" r="4" fill="#2E7D32"/>
"""),

    # Divider

    "divider-hairline": (320, 1, """
  <line x1="0" y1="0.5" x2="320" y2="0.5" stroke="#E0E0E0" stroke-width="1"/>
"""),

    "divider-default": (320, 1, """
  <line x1="0" y1="0.5" x2="320" y2="0.5" stroke="#E0E0E0" stroke-width="1"/>
"""),

    "divider-strong": (320, 2, """
  <line x1="0" y1="1" x2="320" y2="1" stroke="#757575" stroke-width="1.5"/>
"""),

    "divider-dashed": (320, 1, """
  <line x1="0" y1="0.5" x2="320" y2="0.5" stroke="#E0E0E0" stroke-width="1" stroke-dasharray="4,4"/>
"""),

    "divider-section": (320, 64, """
  <line x1="0" y1="32" x2="320" y2="32" stroke="#E0E0E0" stroke-width="1"/>
"""),

    # ═════════════════════════ COMPOSITES ═════════════════════════

    "card-default": (320, 120, """
  <rect width="320" height="120" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="16" y="32" class="text-primary" font-size="14" font-weight="600">Card title</text>
  <text x="16" y="52" class="text-secondary" font-size="13">Supporting content goes here.</text>
  <text x="16" y="72" class="text-secondary" font-size="13">Lorem ipsum dolor sit amet.</text>
"""),

    "card-with-header": (320, 160, """
  <rect width="320" height="160" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="16" y="26" class="text-primary" font-size="14" font-weight="600">Header title</text>
  <line x1="0" y1="40" x2="320" y2="40" stroke="#E0E0E0" stroke-width="1"/>
  <text x="16" y="64" class="text-primary" font-size="13">Body content below the header,</text>
  <text x="16" y="84" class="text-secondary" font-size="13">separated by a hairline divider.</text>
  <text x="16" y="104" class="text-secondary" font-size="13">Lorem ipsum dolor sit amet.</text>
"""),

    "card-interactive": (320, 120, """
  <rect width="320" height="120" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="16" y="32" class="text-primary" font-size="14" font-weight="600">Interactive card</text>
  <text x="16" y="52" class="text-secondary" font-size="13">Whole card is a click target.</text>
  <text x="16" y="72" class="text-secondary" font-size="13">Stronger 1.5px stroke.</text>
"""),

    "card-selected": (320, 120, """
  <rect width="320" height="120" rx="6" fill="#FFFFFF" stroke="#424242" stroke-width="2"/>
  <text x="16" y="32" class="text-primary" font-size="14" font-weight="600">Selected card</text>
  <text x="16" y="52" class="text-secondary" font-size="13">Currently selected — 2px #424242 stroke.</text>
"""),

    "card-empty": (320, 120, """
  <rect width="320" height="120" rx="6" fill="transparent" stroke="#E0E0E0" stroke-width="1.5" stroke-dasharray="4,4"/>
  <text x="160" y="58" text-anchor="middle" class="text-secondary" font-size="18">+</text>
  <text x="160" y="80" text-anchor="middle" class="text-secondary" font-size="13">Add new</text>
"""),

    "card-disabled": (320, 120, """
  <rect width="320" height="120" rx="6" fill="#FAFAFA" stroke="#E0E0E0" stroke-width="1"/>
  <text x="16" y="32" class="text-disabled" font-size="14" font-weight="600">Disabled card</text>
  <text x="16" y="52" class="text-disabled" font-size="13">Non-interactive — content</text>
  <text x="16" y="72" class="text-disabled" font-size="13">faded to disabled state.</text>
"""),

    # List item

    "list-item-default": (320, 72, """
  <rect width="320" height="72" fill="#FFFFFF"/>
  <circle cx="28" cy="36" r="16" fill="#E0E0E0"/>
  <text x="28" y="40" text-anchor="middle" class="text-secondary" font-size="11" font-weight="600">AR</text>
  <text x="56" y="32" class="text-primary" font-size="14" font-weight="500">Alex Rivera</text>
  <text x="56" y="50" class="text-secondary" font-size="12">Last message preview text...</text>
  <text x="304" y="32" text-anchor="end" class="text-secondary" font-size="11">2m</text>
  <line x1="0" y1="71.5" x2="320" y2="71.5" stroke="#E0E0E0" stroke-width="1"/>
"""),

    "list-item-selected": (320, 72, """
  <rect width="320" height="72" fill="#F5F5F5"/>
  <circle cx="28" cy="36" r="16" fill="#E0E0E0"/>
  <text x="28" y="40" text-anchor="middle" class="text-secondary" font-size="11" font-weight="600">AR</text>
  <text x="56" y="32" class="text-primary" font-size="14" font-weight="600">Alex Rivera</text>
  <text x="56" y="50" class="text-secondary" font-size="12">Last message preview text...</text>
  <text x="304" y="32" text-anchor="end" class="text-secondary" font-size="11">2m</text>
  <line x1="0" y1="71.5" x2="320" y2="71.5" stroke="#E0E0E0" stroke-width="1"/>
"""),

    "list-item-compact": (320, 48, """
  <rect width="320" height="48" fill="#FFFFFF"/>
  <text x="16" y="30" class="text-primary" font-size="14" font-weight="500">Compact item title</text>
  <text x="304" y="30" text-anchor="end" class="text-secondary" font-size="11">2m</text>
  <line x1="0" y1="47.5" x2="320" y2="47.5" stroke="#E0E0E0" stroke-width="1"/>
"""),

    "list-item-with-action": (320, 72, """
  <rect width="320" height="72" fill="#FFFFFF"/>
  <circle cx="28" cy="36" r="16" fill="#E0E0E0"/>
  <text x="28" y="40" text-anchor="middle" class="text-secondary" font-size="11" font-weight="600">JC</text>
  <text x="56" y="32" class="text-primary" font-size="14" font-weight="500">Jordan Chen</text>
  <text x="56" y="50" class="text-secondary" font-size="12">Item with secondary action menu</text>
  <text x="304" y="32" text-anchor="end" class="text-secondary" font-size="11">1h</text>
  <circle cx="296" cy="48" r="2" fill="#757575"/>
  <circle cx="304" cy="48" r="2" fill="#757575"/>
  <circle cx="312" cy="48" r="2" fill="#757575"/>
  <line x1="0" y1="71.5" x2="320" y2="71.5" stroke="#E0E0E0" stroke-width="1"/>
"""),

    "list-item-with-metadata": (320, 88, """
  <rect width="320" height="88" fill="#FFFFFF"/>
  <circle cx="28" cy="44" r="16" fill="#E0E0E0"/>
  <text x="28" y="48" text-anchor="middle" class="text-secondary" font-size="11" font-weight="600">SO</text>
  <text x="56" y="28" class="text-primary" font-size="14" font-weight="500">Sam Okafor</text>
  <text x="56" y="46" class="text-secondary" font-size="12">Item with extra metadata row below</text>
  <text x="56" y="66" class="text-disabled" font-size="11">Active · Updated 3h ago · #design</text>
  <text x="304" y="28" text-anchor="end" class="text-secondary" font-size="11">3h</text>
  <line x1="0" y1="87.5" x2="320" y2="87.5" stroke="#E0E0E0" stroke-width="1"/>
"""),

    # Form field

    "form-field-default": (320, 96, """
  <text x="0" y="14" class="text-secondary" font-size="12">Email address</text>
  <rect y="22" width="320" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="16" y="52" class="text-disabled" font-size="14">user@example.com</text>
"""),

    "form-field-inline": (320, 28, """
  <text x="0" y="20" class="text-secondary" font-size="13">Notify me</text>
  <rect x="276" width="44" height="24" rx="12" fill="#424242"/>
  <circle cx="308" cy="12" r="10" fill="#FFFFFF"/>
"""),

    "form-field-with-help": (320, 116, """
  <text x="0" y="14" class="text-secondary" font-size="12">Username</text>
  <rect y="22" width="320" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="16" y="52" class="text-disabled" font-size="14">alex_rivera</text>
  <text x="0" y="92" class="text-secondary" font-size="11">Letters, numbers, and underscores only.</text>
"""),

    "form-field-with-error": (320, 116, """
  <text x="0" y="14" class="text-danger" font-size="12" font-weight="500">Email address</text>
  <rect y="22" width="320" height="48" rx="6" fill="#FFFFFF" stroke="#B71C1C" stroke-width="2"/>
  <text x="16" y="52" class="text-primary" font-size="14">invalid-email</text>
  <text x="0" y="92" class="text-danger" font-size="11">Please enter a valid email address.</text>
"""),

    # Table row

    "table-row-default": (640, 48, """
  <rect width="640" height="48" fill="#FFFFFF"/>
  <text x="16" y="30" class="text-primary" font-size="13">Alex Rivera</text>
  <text x="200" y="30" class="text-primary" font-size="13">alex@northwind.com</text>
  <text x="440" y="30" class="text-secondary" font-size="13">Admin</text>
  <text x="600" y="30" text-anchor="end" class="text-secondary" font-size="13">Active</text>
  <line x1="0" y1="47.5" x2="640" y2="47.5" stroke="#E0E0E0" stroke-width="1"/>
"""),

    "table-row-header": (640, 40, """
  <rect width="640" height="40" fill="#FFFFFF"/>
  <text x="16" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">NAME</text>
  <text x="200" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">EMAIL</text>
  <text x="440" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">ROLE</text>
  <text x="600" y="26" text-anchor="end" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">STATUS</text>
  <line x1="0" y1="38.5" x2="640" y2="38.5" stroke="#757575" stroke-width="1.5"/>
"""),

    "table-row-selected": (640, 48, """
  <rect width="640" height="48" fill="#F5F5F5"/>
  <text x="16" y="30" class="text-primary" font-size="13" font-weight="600">Alex Rivera</text>
  <text x="200" y="30" class="text-primary" font-size="13">alex@northwind.com</text>
  <text x="440" y="30" class="text-secondary" font-size="13">Admin</text>
  <text x="600" y="30" text-anchor="end" class="text-secondary" font-size="13">Active</text>
  <line x1="0" y1="47.5" x2="640" y2="47.5" stroke="#E0E0E0" stroke-width="1"/>
"""),

    "table-row-expanded": (640, 120, """
  <rect width="640" height="120" fill="#FFFFFF"/>
  <text x="16" y="30" class="text-primary" font-size="13">Alex Rivera</text>
  <path d="M 600 22 L 608 30 L 616 22" fill="none" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="0" y1="47.5" x2="640" y2="47.5" stroke="#E0E0E0" stroke-width="1"/>
  <rect x="16" y="56" width="608" height="56" fill="#F5F5F5" rx="4"/>
  <text x="32" y="78" class="text-secondary" font-size="12">Expanded detail content here.</text>
  <text x="32" y="98" class="text-secondary" font-size="12">Lorem ipsum dolor sit amet.</text>
"""),

    "table-header-default": (640, 40, """
  <rect width="640" height="40" fill="#FFFFFF"/>
  <text x="16" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">NAME</text>
  <text x="200" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">EMAIL</text>
  <text x="440" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">ROLE</text>
  <text x="600" y="26" text-anchor="end" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">STATUS</text>
  <line x1="0" y1="38.5" x2="640" y2="38.5" stroke="#757575" stroke-width="1.5"/>
"""),

    "table-header-sortable": (640, 40, """
  <rect width="640" height="40" fill="#FFFFFF"/>
  <text x="16" y="26" class="text-primary" font-size="11" font-weight="600" letter-spacing="0.5">NAME</text>
  <path d="M 60 22 L 64 18 L 68 22" fill="none" stroke="#424242" stroke-width="1.5" stroke-linecap="round"/>
  <text x="200" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">EMAIL</text>
  <text x="440" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">ROLE</text>
  <text x="600" y="26" text-anchor="end" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">STATUS</text>
  <line x1="0" y1="38.5" x2="640" y2="38.5" stroke="#757575" stroke-width="1.5"/>
"""),

    "table-header-with-filter": (640, 40, """
  <rect width="640" height="40" fill="#FFFFFF"/>
  <text x="16" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">NAME</text>
  <path d="M 60 22 L 64 26 L 68 22" fill="none" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>
  <text x="200" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">EMAIL</text>
  <path d="M 240 22 L 244 26 L 248 22" fill="none" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>
  <text x="440" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">ROLE</text>
  <text x="600" y="26" text-anchor="end" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">STATUS</text>
  <line x1="0" y1="38.5" x2="640" y2="38.5" stroke="#757575" stroke-width="1.5"/>
"""),

    # Nav item

    "nav-item-top-level": (240, 32, """
  <rect width="240" height="32" rx="4" fill="#F5F5F5"/>
  <rect x="8" y="8" width="16" height="16" rx="2" fill="none" stroke="#424242" stroke-width="1.5"/>
  <text x="32" y="21" class="text-primary" font-size="14" font-weight="500">Dashboard</text>
"""),

    "nav-item-sub-item": (240, 32, """
  <rect width="240" height="32" fill="transparent"/>
  <text x="32" y="21" class="text-secondary" font-size="13">Sub-item label</text>
"""),

    "nav-item-breadcrumb": (140, 16, """
  <text x="0" y="13" class="text-secondary" font-size="13">Section name</text>
"""),

    # Tab item

    "tab-item-default": (120, 40, """
  <text x="60" y="26" text-anchor="middle" class="text-secondary" font-size="13" font-weight="500">Tab Label</text>
"""),

    "tab-item-active": (120, 40, """
  <text x="60" y="26" text-anchor="middle" class="text-primary" font-size="13" font-weight="600">Active Tab</text>
  <rect x="36" y="36" width="48" height="2" fill="#424242"/>
"""),

    "tab-item-disabled": (120, 40, """
  <text x="60" y="26" text-anchor="middle" class="text-disabled" font-size="13" font-weight="500">Disabled</text>
"""),

    # Breadcrumb trail

    "breadcrumb-trail-default": (480, 16, """
  <text x="0" y="13" class="text-secondary" font-size="13">Home</text>
  <text x="48" y="13" class="text-disabled" font-size="13">/</text>
  <text x="64" y="13" class="text-secondary" font-size="13">Section</text>
  <text x="124" y="13" class="text-disabled" font-size="13">/</text>
  <text x="140" y="13" class="text-secondary" font-size="13">Subsection</text>
  <text x="220" y="13" class="text-disabled" font-size="13">/</text>
  <text x="236" y="13" class="text-primary" font-size="13" font-weight="500">Current page</text>
"""),

    "breadcrumb-trail-truncated": (300, 16, """
  <text x="0" y="13" class="text-secondary" font-size="13">Home</text>
  <text x="48" y="13" class="text-disabled" font-size="13">/</text>
  <text x="64" y="13" class="text-disabled" font-size="13">…</text>
  <text x="80" y="13" class="text-disabled" font-size="13">/</text>
  <text x="96" y="13" class="text-secondary" font-size="13">Subsection</text>
  <text x="176" y="13" class="text-disabled" font-size="13">/</text>
  <text x="192" y="13" class="text-primary" font-size="13" font-weight="500">Current</text>
"""),

    # Pagination

    "pagination-numbered": (400, 32, """
  <text x="0" y="20" class="text-secondary" font-size="13">‹ Prev</text>
  <rect x="64" y="0" width="32" height="32" rx="4" fill="#F5F5F5"/>
  <text x="80" y="20" text-anchor="middle" class="text-primary" font-size="13" font-weight="600">1</text>
  <text x="112" y="20" text-anchor="middle" class="text-secondary" font-size="13">2</text>
  <text x="144" y="20" text-anchor="middle" class="text-secondary" font-size="13">3</text>
  <text x="176" y="20" text-anchor="middle" class="text-disabled" font-size="13">…</text>
  <text x="208" y="20" text-anchor="middle" class="text-secondary" font-size="13">10</text>
  <text x="280" y="20" class="text-secondary" font-size="13">Next ›</text>
"""),

    "pagination-simple": (320, 16, """
  <text x="0" y="13" class="text-secondary" font-size="13">‹ Prev</text>
  <text x="160" y="13" text-anchor="middle" class="text-secondary" font-size="13">Page 3 of 10</text>
  <text x="320" y="13" text-anchor="end" class="text-secondary" font-size="13">Next ›</text>
"""),

    "pagination-infinite-scroll-indicator": (320, 16, """
  <text x="160" y="13" text-anchor="middle" class="text-secondary" font-size="12">247 of 1,247 items</text>
"""),

    # Toast

    "toast-info": (360, 48, """
  <rect width="360" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <circle cx="24" cy="24" r="8" fill="none" stroke="#1565C0" stroke-width="1.5"/>
  <line x1="24" y1="20" x2="24" y2="20" stroke="#1565C0" stroke-width="2" stroke-linecap="round"/>
  <line x1="24" y1="24" x2="24" y2="29" stroke="#1565C0" stroke-width="2" stroke-linecap="round"/>
  <text x="44" y="30" class="text-primary" font-size="13">Information message</text>
  <text x="340" y="30" text-anchor="end" class="text-secondary" font-size="16">×</text>
"""),

    "toast-success": (360, 48, """
  <rect width="360" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <circle cx="24" cy="24" r="8" fill="none" stroke="#2E7D32" stroke-width="1.5"/>
  <path d="M 20 24 L 23 27 L 28 21" fill="none" stroke="#2E7D32" stroke-width="1.5" stroke-linecap="round"/>
  <text x="44" y="30" class="text-primary" font-size="13">Action completed successfully</text>
  <text x="340" y="30" text-anchor="end" class="text-secondary" font-size="16">×</text>
"""),

    "toast-warning": (360, 48, """
  <rect width="360" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <path d="M 24 16 L 32 30 L 16 30 Z" fill="none" stroke="#E65100" stroke-width="1.5" stroke-linejoin="round"/>
  <line x1="24" y1="22" x2="24" y2="25" stroke="#E65100" stroke-width="2" stroke-linecap="round"/>
  <circle cx="24" cy="28" r="0.5" fill="#E65100"/>
  <text x="44" y="30" class="text-primary" font-size="13">Warning — please review</text>
  <text x="340" y="30" text-anchor="end" class="text-secondary" font-size="16">×</text>
"""),

    "toast-error": (360, 48, """
  <rect width="360" height="48" rx="6" fill="#FFFFFF" stroke="#B71C1C" stroke-width="1"/>
  <circle cx="24" cy="24" r="8" fill="none" stroke="#B71C1C" stroke-width="1.5"/>
  <line x1="20" y1="20" x2="28" y2="28" stroke="#B71C1C" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="28" y1="20" x2="20" y2="28" stroke="#B71C1C" stroke-width="1.5" stroke-linecap="round"/>
  <text x="44" y="30" class="text-primary" font-size="13">Something went wrong</text>
  <text x="340" y="30" text-anchor="end" class="text-secondary" font-size="16">×</text>
"""),

    # Stat

    "stat-default": (160, 80, """
  <text x="0" y="14" class="text-secondary" font-size="12" font-weight="600" letter-spacing="0.5">REVENUE</text>
  <text x="0" y="48" class="text-primary" font-size="24" font-weight="700">$24,580</text>
  <text x="0" y="72" class="text-secondary" font-size="12">vs. $21,200 last month</text>
"""),

    "stat-with-trend": (160, 80, """
  <text x="0" y="14" class="text-secondary" font-size="12" font-weight="600" letter-spacing="0.5">REVENUE</text>
  <text x="0" y="48" class="text-primary" font-size="24" font-weight="700">$24,580</text>
  <text x="0" y="70" class="text-success" font-size="12" font-weight="600">▲ +12%</text>
  <text x="48" y="70" class="text-secondary" font-size="12">vs. last month</text>
"""),

    "stat-with-sparkline": (200, 80, """
  <text x="0" y="14" class="text-secondary" font-size="12" font-weight="600" letter-spacing="0.5">SIGNUPS</text>
  <text x="0" y="48" class="text-primary" font-size="24" font-weight="700">1,247</text>
  <polyline points="0,72 12,68 24,70 36,64 48,66 60,58 72,60 84,52 96,54 108,48"
            fill="none" stroke="#757575" stroke-width="1.5"/>
"""),

    # Key value

    "key-value-default": (200, 48, """
  <text x="0" y="14" class="text-secondary" font-size="12">Email</text>
  <text x="0" y="36" class="text-primary" font-size="14">alex@example.com</text>
"""),

    "key-value-inline": (320, 16, """
  <text x="0" y="13" class="text-secondary" font-size="12">Status:</text>
  <text x="56" y="13" class="text-primary" font-size="14">Active</text>
"""),

    "key-value-tabular": (320, 96, """
  <text x="0" y="20" class="text-secondary" font-size="12">Email</text>
  <text x="320" y="20" text-anchor="end" class="text-primary" font-size="14">alex@northwind.com</text>
  <line x1="0" y1="32" x2="320" y2="32" stroke="#E0E0E0" stroke-width="1"/>
  <text x="0" y="52" class="text-secondary" font-size="12">Role</text>
  <text x="320" y="52" text-anchor="end" class="text-primary" font-size="14">Administrator</text>
  <line x1="0" y1="64" x2="320" y2="64" stroke="#E0E0E0" stroke-width="1"/>
  <text x="0" y="84" class="text-secondary" font-size="12">Joined</text>
  <text x="320" y="84" text-anchor="end" class="text-primary" font-size="14">Jan 2024</text>
"""),

    # Button group

    "button-group-segmented": (360, 40, """
  <rect x="0" y="0" width="120" height="40" rx="6" ry="6" fill="#F5F5F5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="60" y="26" text-anchor="middle" class="text-primary" font-size="13" font-weight="500">Day</text>
  <rect x="120" y="0" width="120" height="40" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="180" y="26" text-anchor="middle" class="text-secondary" font-size="13">Week</text>
  <rect x="240" y="0" width="120" height="40" rx="6" ry="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="300" y="26" text-anchor="middle" class="text-secondary" font-size="13">Month</text>
"""),

    "button-group-attached": (320, 48, """
  <rect x="0" y="0" width="160" height="48" rx="6" ry="6" fill="#424242"/>
  <text x="80" y="30" text-anchor="middle" class="text-inverse" font-size="14" font-weight="500">Save</text>
  <rect x="160" y="0" width="160" height="48" rx="6" ry="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="240" y="30" text-anchor="middle" class="text-secondary" font-size="14" font-weight="500">Cancel</text>
"""),

    "button-group-spaced": (336, 48, """
  <rect x="0" y="0" width="160" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="80" y="30" text-anchor="middle" class="text-secondary" font-size="14" font-weight="500">Cancel</text>
  <rect x="176" y="0" width="160" height="48" rx="6" fill="#424242"/>
  <text x="256" y="30" text-anchor="middle" class="text-inverse" font-size="14" font-weight="500">Save</text>
"""),

    # Search bar

    "search-bar-default": (480, 48, """
  <rect width="480" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <circle cx="20" cy="24" r="6" fill="none" stroke="#757575" stroke-width="1.5"/>
  <line x1="25" y1="29" x2="30" y2="34" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>
  <text x="40" y="30" class="text-disabled" font-size="14">Search</text>
"""),

    "search-bar-with-filters": (480, 88, """
  <rect width="480" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <circle cx="20" cy="24" r="6" fill="none" stroke="#757575" stroke-width="1.5"/>
  <line x1="25" y1="29" x2="30" y2="34" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>
  <text x="40" y="30" class="text-disabled" font-size="14">Search</text>
  <rect x="0" y="60" width="80" height="20" rx="10" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="40" y="74" text-anchor="middle" class="text-secondary" font-size="11">Active</text>
  <rect x="88" y="60" width="80" height="20" rx="10" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="128" y="74" text-anchor="middle" class="text-secondary" font-size="11">This week</text>
"""),

    "search-bar-with-results-count": (480, 72, """
  <rect width="480" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <circle cx="20" cy="24" r="6" fill="none" stroke="#757575" stroke-width="1.5"/>
  <line x1="25" y1="29" x2="30" y2="34" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>
  <text x="40" y="30" class="text-primary" font-size="14">design</text>
  <text x="0" y="68" class="text-secondary" font-size="12">247 results</text>
"""),

    # Banner

    "banner-info": (640, 48, """
  <rect width="640" height="48" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <circle cx="24" cy="24" r="8" fill="none" stroke="#1565C0" stroke-width="1.5"/>
  <text x="24" y="28" text-anchor="middle" class="text-info" font-size="11" font-weight="700">i</text>
  <text x="44" y="30" class="text-primary" font-size="13">New features available — explore what's new in this release.</text>
  <text x="624" y="30" text-anchor="end" class="text-secondary" font-size="13">Learn more</text>
"""),

    "banner-success": (640, 48, """
  <rect width="640" height="48" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <circle cx="24" cy="24" r="8" fill="none" stroke="#2E7D32" stroke-width="1.5"/>
  <path d="M 20 24 L 23 27 L 28 21" fill="none" stroke="#2E7D32" stroke-width="1.5" stroke-linecap="round"/>
  <text x="44" y="30" class="text-primary" font-size="13">Changes saved successfully.</text>
"""),

    "banner-warning": (640, 48, """
  <rect width="640" height="48" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <path d="M 24 16 L 32 30 L 16 30 Z" fill="none" stroke="#E65100" stroke-width="1.5" stroke-linejoin="round"/>
  <line x1="24" y1="22" x2="24" y2="26" stroke="#E65100" stroke-width="2" stroke-linecap="round"/>
  <text x="44" y="30" class="text-primary" font-size="13">Action required — review pending items before they expire.</text>
"""),

    "banner-error": (640, 48, """
  <rect width="640" height="48" fill="#FFFFFF" stroke="#B71C1C" stroke-width="1"/>
  <circle cx="24" cy="24" r="8" fill="none" stroke="#B71C1C" stroke-width="1.5"/>
  <line x1="20" y1="20" x2="28" y2="28" stroke="#B71C1C" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="28" y1="20" x2="20" y2="28" stroke="#B71C1C" stroke-width="1.5" stroke-linecap="round"/>
  <text x="44" y="30" class="text-primary" font-size="13">Connection error — your last changes may not have saved.</text>
  <text x="624" y="30" text-anchor="end" class="text-danger" font-size="13" font-weight="500">Retry</text>
"""),

    "banner-promotional": (640, 96, """
  <rect width="640" height="96" rx="6" fill="#F5F5F5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="24" y="36" class="text-primary" font-size="16" font-weight="700">Upgrade to Pro</text>
  <text x="24" y="58" class="text-secondary" font-size="13">Unlock advanced features, unlimited usage, and priority support.</text>
  <rect x="24" y="68" width="120" height="32" rx="4" fill="#424242"/>
  <text x="84" y="89" text-anchor="middle" class="text-inverse" font-size="13" font-weight="500">Upgrade</text>
"""),

    # Accordion item

    "accordion-item-collapsed": (320, 48, """
  <rect width="320" height="48" fill="#FFFFFF"/>
  <text x="16" y="30" class="text-primary" font-size="14" font-weight="500">Section title</text>
  <path d="M 296 22 L 304 26 L 296 30" fill="none" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="0" y1="47.5" x2="320" y2="47.5" stroke="#E0E0E0" stroke-width="1"/>
"""),

    "accordion-item-expanded": (320, 144, """
  <rect width="320" height="144" fill="#FFFFFF"/>
  <text x="16" y="30" class="text-primary" font-size="14" font-weight="500">Section title</text>
  <path d="M 296 24 L 300 30 L 304 24" fill="none" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="0" y1="48" x2="320" y2="48" stroke="#E0E0E0" stroke-width="1"/>
  <text x="16" y="76" class="text-secondary" font-size="13">Expanded content goes here.</text>
  <text x="16" y="96" class="text-secondary" font-size="13">Lorem ipsum dolor sit amet, consectetur</text>
  <text x="16" y="116" class="text-secondary" font-size="13">adipiscing elit.</text>
  <line x1="0" y1="143.5" x2="320" y2="143.5" stroke="#E0E0E0" stroke-width="1"/>
"""),

    # Stepper

    "stepper-linear": (480, 48, """
  <circle cx="24" cy="24" r="12" fill="#424242"/>
  <path d="M 18 24 L 22 28 L 30 20" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="36" y1="24" x2="148" y2="24" stroke="#424242" stroke-width="2"/>
  <circle cx="160" cy="24" r="12" fill="#424242"/>
  <text x="160" y="29" text-anchor="middle" class="text-inverse" font-size="12" font-weight="600">2</text>
  <line x1="172" y1="24" x2="284" y2="24" stroke="#E0E0E0" stroke-width="2"/>
  <circle cx="296" cy="24" r="12" fill="none" stroke="#BDBDBD" stroke-width="1.5"/>
  <text x="296" y="29" text-anchor="middle" class="text-disabled" font-size="12" font-weight="600">3</text>
  <line x1="308" y1="24" x2="420" y2="24" stroke="#E0E0E0" stroke-width="2"/>
  <circle cx="432" cy="24" r="12" fill="none" stroke="#BDBDBD" stroke-width="1.5"/>
  <text x="432" y="29" text-anchor="middle" class="text-disabled" font-size="12" font-weight="600">4</text>
"""),

    "stepper-numbered": (480, 80, """
  <circle cx="24" cy="24" r="14" fill="#424242"/>
  <text x="24" y="29" text-anchor="middle" class="text-inverse" font-size="12" font-weight="700">1</text>
  <text x="24" y="60" text-anchor="middle" class="text-primary" font-size="12">Account</text>
  <line x1="38" y1="24" x2="146" y2="24" stroke="#E0E0E0" stroke-width="2"/>
  <circle cx="160" cy="24" r="14" fill="none" stroke="#BDBDBD" stroke-width="1.5"/>
  <text x="160" y="29" text-anchor="middle" class="text-disabled" font-size="12" font-weight="700">2</text>
  <text x="160" y="60" text-anchor="middle" class="text-secondary" font-size="12">Profile</text>
  <line x1="174" y1="24" x2="282" y2="24" stroke="#E0E0E0" stroke-width="2"/>
  <circle cx="296" cy="24" r="14" fill="none" stroke="#BDBDBD" stroke-width="1.5"/>
  <text x="296" y="29" text-anchor="middle" class="text-disabled" font-size="12" font-weight="700">3</text>
  <text x="296" y="60" text-anchor="middle" class="text-secondary" font-size="12">Confirm</text>
"""),

    "stepper-dotted": (240, 12, """
  <circle cx="6" cy="6" r="4" fill="#424242"/>
  <circle cx="42" cy="6" r="4" fill="#424242"/>
  <circle cx="78" cy="6" r="6" fill="#424242"/>
  <circle cx="114" cy="6" r="4" fill="#E0E0E0"/>
  <circle cx="150" cy="6" r="4" fill="#E0E0E0"/>
  <circle cx="186" cy="6" r="4" fill="#E0E0E0"/>
"""),

    # Dropdown menu (closed + open)

    "dropdown-menu-default": (200, 200, """
  <rect width="200" height="40" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="16" y="26" class="text-primary" font-size="13">Actions</text>
  <path d="M 174 18 L 178 22 L 182 18" fill="none" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>
  <rect x="0" y="48" width="200" height="148" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="16" y="76" class="text-primary" font-size="14">Edit</text>
  <text x="16" y="108" class="text-primary" font-size="14">Duplicate</text>
  <text x="16" y="140" class="text-primary" font-size="14">Share</text>
  <line x1="8" y1="156" x2="192" y2="156" stroke="#E0E0E0" stroke-width="1"/>
  <text x="16" y="180" class="text-danger" font-size="14">Delete</text>
"""),

    "dropdown-menu-with-groups": (200, 240, """
  <rect width="200" height="40" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="16" y="26" class="text-primary" font-size="13">Actions</text>
  <path d="M 174 18 L 178 22 L 182 18" fill="none" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>
  <rect x="0" y="48" width="200" height="188" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="16" y="68" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">CONTENT</text>
  <text x="16" y="92" class="text-primary" font-size="14">Edit</text>
  <text x="16" y="116" class="text-primary" font-size="14">Duplicate</text>
  <line x1="8" y1="132" x2="192" y2="132" stroke="#E0E0E0" stroke-width="1"/>
  <text x="16" y="152" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">SHARING</text>
  <text x="16" y="176" class="text-primary" font-size="14">Copy link</text>
  <text x="16" y="200" class="text-primary" font-size="14">Share via email</text>
  <text x="16" y="224" class="text-primary" font-size="14">Embed</text>
"""),

    "dropdown-menu-with-search": (240, 240, """
  <rect width="240" height="40" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="16" y="26" class="text-primary" font-size="13">Select user</text>
  <path d="M 214 18 L 218 22 L 222 18" fill="none" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>
  <rect x="0" y="48" width="240" height="184" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <rect x="8" y="56" width="224" height="32" rx="4" fill="#F5F5F5"/>
  <text x="20" y="76" class="text-disabled" font-size="13">Search users...</text>
  <text x="16" y="116" class="text-primary" font-size="14">Alex Rivera</text>
  <text x="16" y="148" class="text-primary" font-size="14">Jordan Chen</text>
  <text x="16" y="180" class="text-primary" font-size="14">Sam Okafor</text>
  <text x="16" y="212" class="text-primary" font-size="14">Taylor Kim</text>
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
    out_dir = Path(__file__).resolve().parent.parent / "wireframe-library" / "components"
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

    print(f"Wrote {len(written)} component SVGs to {out_dir}")
    if not only:
        for p in written:
            print(f"  {p.name}")


if __name__ == "__main__":
    main()
