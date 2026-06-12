#!/usr/bin/env python3
"""
Build the Terminal design system's component library against the LIBRARY-SPEC
vocabulary. Terminal's grammar applied to each component.

Terminal tokens:
  JetBrains Mono typeface (required for box-drawing and cursor blocks)
  Palette: #0A0F0A background, phosphor green #00FF66, muted greens, amber
  Borders: Unicode box-drawing chars (┌─┐│└─┘) with dashed 1px #1F2F1F
  Selection: prompt character (>) + color shift, never background fills
  Typography: monospace only, sizes 9-14, lowercase body, uppercase metadata
  Cursor: █ block in active input/prompts

Coverage scope:
  Primitives (12): button, input, textarea, select, checkbox, radio, toggle,
                   label, icon, avatar, badge, divider
  Composites (12): card, list_item, form_field, table_row, table_header,
                   nav_item, tab_item, breadcrumb_trail, pagination, stat,
                   key_value, dropdown_menu
                   (skip: toast, banner per Terminal coverage notes)
  Patterns: handled by build_terminal_patterns.py

Output goes to systems/terminal/components/
"""

import sys
from pathlib import Path

STANDARD_DEFS = """  <defs>
    <style>
      .text-primary { fill: #C8F7C5; font-family: 'JetBrains Mono', ui-monospace, monospace; }
      .text-secondary { fill: #5EAA66; font-family: 'JetBrains Mono', ui-monospace, monospace; }
      .text-muted { fill: #3D7044; font-family: 'JetBrains Mono', ui-monospace, monospace; }
      .text-accent { fill: #00FF66; font-family: 'JetBrains Mono', ui-monospace, monospace; }
      .text-error { fill: #FF6B6B; font-family: 'JetBrains Mono', ui-monospace, monospace; }
      .text-amber { fill: #FFB000; font-family: 'JetBrains Mono', ui-monospace, monospace; }
    </style>
  </defs>"""


def wrap_svg(width: int, height: int, body: str, comment: str = "") -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">
{STANDARD_DEFS}
  {comment}
{body}
</svg>
"""


COMPONENTS = {

    # ═════════════════════ PRIMITIVES (12) ═════════════════════

    # Button — Terminal style: text only, monospace, bracketed for primary/secondary/danger
    # Primary: [ SEND ] in phosphor green
    # Secondary: [ cancel ] in secondary text
    # Ghost: cancel (no brackets)
    # Disabled: [unavailable] in muted
    # Danger: [ DELETE ] in red

    "button-primary": (140, 28, """
  <text x="0" y="20" class="text-accent" font-size="12" font-weight="700">[ SEND ]</text>
"""),

    "button-secondary": (140, 28, """
  <text x="0" y="20" class="text-secondary" font-size="12" font-weight="500">[ cancel ]</text>
"""),

    "button-ghost": (100, 28, """
  <text x="0" y="20" class="text-secondary" font-size="12" font-weight="400">cancel</text>
"""),

    "button-disabled": (140, 28, """
  <text x="0" y="20" class="text-muted" font-size="12" font-weight="500">[unavailable]</text>
"""),

    "button-danger": (140, 28, """
  <text x="0" y="20" class="text-error" font-size="12" font-weight="700">[ DELETE ]</text>
"""),

    # Input — single-line text field with > prompt prefix and cursor block
    "input-text": (240, 32, """
  <text x="0" y="12" class="text-muted" font-size="9" font-weight="500" letter-spacing="0.54">LABEL</text>
  <line x1="0" y1="18" x2="240" y2="18" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>
  <text x="0" y="31" class="text-secondary" font-size="12" font-weight="400">> </text>
  <text x="16" y="31" class="text-muted" font-size="12" font-weight="400">type text</text>
  <text x="88" y="31" class="text-accent" font-size="12" font-weight="700">█</text>
"""),

    "input-password": (240, 32, """
  <text x="0" y="12" class="text-muted" font-size="9" font-weight="500" letter-spacing="0.54">PASSWORD</text>
  <line x1="0" y1="18" x2="240" y2="18" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>
  <text x="0" y="31" class="text-secondary" font-size="12" font-weight="400">> </text>
  <text x="16" y="31" class="text-muted" font-size="12" font-weight="400">•••••••</text>
  <text x="88" y="31" class="text-accent" font-size="12" font-weight="700">█</text>
"""),

    "input-search": (240, 32, """
  <text x="0" y="12" class="text-muted" font-size="9" font-weight="500" letter-spacing="0.54">SEARCH</text>
  <line x1="0" y1="18" x2="240" y2="18" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>
  <text x="0" y="31" class="text-secondary" font-size="12" font-weight="400">> </text>
  <text x="16" y="31" class="text-muted" font-size="12" font-weight="400">find...</text>
  <text x="88" y="31" class="text-accent" font-size="12" font-weight="700">█</text>
"""),

    "input-numeric": (240, 32, """
  <text x="0" y="12" class="text-muted" font-size="9" font-weight="500" letter-spacing="0.54">AMOUNT</text>
  <line x1="0" y1="18" x2="240" y2="18" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>
  <text x="0" y="31" class="text-secondary" font-size="12" font-weight="400">> </text>
  <text x="16" y="31" class="text-primary" font-size="12" font-weight="400">1024</text>
  <text x="68" y="31" class="text-accent" font-size="12" font-weight="700">█</text>
"""),

    # Textarea — multi-line input
    "textarea-default": (240, 80, """
  <text x="0" y="12" class="text-muted" font-size="9" font-weight="500" letter-spacing="0.54">MESSAGE</text>
  <line x1="0" y1="18" x2="240" y2="18" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>
  <text x="0" y="35" class="text-secondary" font-size="11" font-weight="400">> </text>
  <text x="16" y="35" class="text-muted" font-size="11" font-weight="400">type message here</text>
  <text x="0" y="51" class="text-secondary" font-size="11" font-weight="400">> </text>
  <text x="16" y="51" class="text-muted" font-size="11" font-weight="400">continue on next line</text>
  <text x="0" y="67" class="text-secondary" font-size="11" font-weight="400">> </text>
  <text x="16" y="67" class="text-accent" font-size="11" font-weight="700">█</text>
"""),

    # Select — dropdown with ↓ chevron indicator
    "select-default": (240, 32, """
  <text x="0" y="12" class="text-muted" font-size="9" font-weight="500" letter-spacing="0.54">TIME_ZONE</text>
  <line x1="0" y1="18" x2="240" y2="18" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>
  <text x="0" y="31" class="text-secondary" font-size="12" font-weight="400">> </text>
  <text x="16" y="31" class="text-primary" font-size="12" font-weight="400">america/los_angeles</text>
  <text x="232" y="31" class="text-secondary" font-size="12" font-weight="500" text-anchor="end">↓</text>
"""),

    # Checkbox — ASCII brackets [ ] or [x] or [~]
    "checkbox-unchecked": (140, 20, """
  <text x="0" y="15" class="text-secondary" font-size="12" font-weight="500">[ ]</text>
  <text x="20" y="15" class="text-primary" font-size="12" font-weight="400">option</text>
"""),

    "checkbox-checked": (140, 20, """
  <text x="0" y="15" class="text-accent" font-size="12" font-weight="700">[x]</text>
  <text x="20" y="15" class="text-primary" font-size="12" font-weight="400">selected</text>
"""),

    "checkbox-indeterminate": (140, 20, """
  <text x="0" y="15" class="text-secondary" font-size="12" font-weight="500">[~]</text>
  <text x="20" y="15" class="text-primary" font-size="12" font-weight="400">indeterminate</text>
"""),

    # Radio — ASCII circles ( ) or (•)
    "radio-unchecked": (140, 20, """
  <text x="0" y="15" class="text-secondary" font-size="12" font-weight="500">( )</text>
  <text x="20" y="15" class="text-primary" font-size="12" font-weight="400">option</text>
"""),

    "radio-checked": (140, 20, """
  <text x="0" y="15" class="text-accent" font-size="12" font-weight="700">(•)</text>
  <text x="20" y="15" class="text-primary" font-size="12" font-weight="400">selected</text>
"""),

    # Toggle — [ off ] or [ on ] text
    "toggle-off": (140, 20, """
  <text x="0" y="15" class="text-secondary" font-size="12" font-weight="500">[ off ]</text>
"""),

    "toggle-on": (140, 20, """
  <text x="0" y="15" class="text-accent" font-size="12" font-weight="500">[ on ]</text>
"""),

    # Label — plain or required (with *)
    "label-default": (160, 14, """
  <text x="0" y="11" class="text-secondary" font-size="11" font-weight="400">label_name</text>
"""),

    "label-required": (160, 14, """
  <text x="0" y="11" class="text-secondary" font-size="11" font-weight="400">label_name <tspan class="text-error">*</tspan></text>
"""),

    # Icon — ASCII glyphs: >, *, #, !, %, @ as variants
    "icon-default": (24, 20, """
  <text x="2" y="15" class="text-secondary" font-size="14" font-weight="700">#</text>
"""),

    "icon-arrow": (24, 20, """
  <text x="2" y="15" class="text-secondary" font-size="12" font-weight="500">></text>
"""),

    "icon-asterisk": (24, 20, """
  <text x="2" y="15" class="text-secondary" font-size="14" font-weight="500">*</text>
"""),

    "icon-exclaim": (24, 20, """
  <text x="2" y="15" class="text-error" font-size="12" font-weight="700">!</text>
"""),

    # Avatar — Terminal uses snake_case name identification, no photo/emoji
    # [N] enumerated variant for lists
    "avatar-name": (120, 20, """
  <text x="0" y="15" class="text-primary" font-size="12" font-weight="400">alex_rivera</text>
"""),

    "avatar-enumerated": (40, 20, """
  <text x="0" y="15" class="text-secondary" font-size="12" font-weight="700">[01]</text>
"""),

    # Badge — [N] for count, [STATUS] uppercase for status, * dot for indicator
    "badge-count": (40, 16, """
  <text x="0" y="12" class="text-amber" font-size="11" font-weight="700">[2]</text>
"""),

    "badge-status": (80, 16, """
  <text x="0" y="12" class="text-secondary" font-size="9" font-weight="700" letter-spacing="0.54">[ACTIVE]</text>
"""),

    "badge-dot": (16, 16, """
  <text x="0" y="12" class="text-secondary" font-size="12" font-weight="700">*</text>
"""),

    # Divider — hairline (· · · ·), default (─────), strong (═════), dashed (- - - -)
    "divider-hairline": (200, 8, """
  <text x="0" y="6" class="text-muted" font-size="10" font-weight="400" letter-spacing="3">· · · ·</text>
"""),

    "divider-default": (200, 8, """
  <text x="0" y="7" class="text-muted" font-size="9" font-weight="500">─────────────────────</text>
"""),

    "divider-strong": (200, 8, """
  <text x="0" y="7" class="text-secondary" font-size="9" font-weight="700">═════════════════════</text>
"""),

    "divider-dashed": (200, 8, """
  <text x="0" y="6" class="text-muted" font-size="10" font-weight="400" letter-spacing="2">- - - - - - - - - -</text>
"""),


    # ═════════════════════ COMPOSITES (12) ═════════════════════

    # Card — box-drawing frame with header
    "card-default": (240, 80, """
  <text x="4" y="14" class="text-secondary" font-size="11" font-weight="500">┌─ CARD ─┐</text>
  <text x="4" y="30" class="text-secondary" font-size="10" font-weight="400">│</text>
  <text x="16" y="30" class="text-primary" font-size="11" font-weight="400">card content here</text>
  <text x="4" y="46" class="text-secondary" font-size="10" font-weight="400">│</text>
  <text x="16" y="46" class="text-muted" font-size="10" font-weight="400">with metadata support</text>
  <text x="4" y="62" class="text-secondary" font-size="10" font-weight="400">│</text>
  <text x="4" y="78" class="text-secondary" font-size="11" font-weight="500">└─────────┘</text>
"""),

    # List_item — already have default/selected in signature SVGs
    # Including compact and with_action variants here
    "list-item-compact": (240, 28, """
  <text x="0" y="22" class="text-secondary" font-size="12" font-weight="500">thread_name</text>
  <text x="200" y="22" class="text-muted" font-size="9" font-weight="500" letter-spacing="0.54" text-anchor="end">2M</text>
"""),

    "list-item-with-action": (280, 48, """
  <text x="2" y="24" class="text-secondary" font-size="12" font-weight="400"> </text>
  <text x="14" y="24" class="text-secondary" font-size="12" font-weight="500">thread_name</text>
  <text x="240" y="24" class="text-amber" font-size="11" font-weight="700">[1]</text>
  <text x="14" y="40" class="text-muted" font-size="10" font-weight="400">// preview text</text>
  <text x="252" y="40" class="text-secondary" font-size="10" font-weight="400">></text>
"""),

    # Form field — label above, input with rule, optional help/error below
    "form-field-default": (240, 48, """
  <text x="0" y="12" class="text-muted" font-size="9" font-weight="500" letter-spacing="0.54">EMAIL_ADDRESS</text>
  <line x1="0" y1="18" x2="240" y2="18" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>
  <text x="0" y="34" class="text-secondary" font-size="12" font-weight="400">> </text>
  <text x="16" y="34" class="text-primary" font-size="12" font-weight="400">user@example.com</text>
"""),

    "form-field-with-error": (240, 64, """
  <text x="0" y="12" class="text-muted" font-size="9" font-weight="500" letter-spacing="0.54">EMAIL_ADDRESS</text>
  <line x1="0" y1="18" x2="240" y2="18" stroke="#FF6B6B" stroke-width="1" stroke-dasharray="3,2"/>
  <text x="0" y="34" class="text-secondary" font-size="12" font-weight="400">> </text>
  <text x="16" y="34" class="text-primary" font-size="12" font-weight="400">invalid-email</text>
  <text x="0" y="52" class="text-error" font-size="9" font-weight="500" letter-spacing="0.54">! INVALID EMAIL</text>
"""),

    # Table row — zero-padded index, cells, metadata
    "table-row-default": (480, 28, """
  <text x="0" y="22" class="text-secondary" font-size="12" font-weight="500">[01]</text>
  <text x="40" y="22" class="text-primary" font-size="12" font-weight="400">alex_rivera</text>
  <text x="200" y="22" class="text-secondary" font-size="12" font-weight="400">admin</text>
  <text x="400" y="22" class="text-muted" font-size="10" font-weight="500" letter-spacing="0.54">ACTIVE</text>
"""),

    "table-row-header": (480, 24, """
  <text x="0" y="18" class="text-muted" font-size="9" font-weight="700" letter-spacing="0.54">#</text>
  <text x="40" y="18" class="text-muted" font-size="9" font-weight="700" letter-spacing="0.54">NAME</text>
  <text x="200" y="18" class="text-muted" font-size="9" font-weight="700" letter-spacing="0.54">ROLE</text>
  <text x="400" y="18" class="text-muted" font-size="9" font-weight="700" letter-spacing="0.54">STATUS</text>
  <line x1="0" y1="22" x2="480" y2="22" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>
"""),

    # Table header — standalone header row
    "table-header-default": (480, 24, """
  <text x="0" y="18" class="text-muted" font-size="9" font-weight="700" letter-spacing="0.54">#</text>
  <text x="40" y="18" class="text-muted" font-size="9" font-weight="700" letter-spacing="0.54">NAME</text>
  <text x="200" y="18" class="text-muted" font-size="9" font-weight="700" letter-spacing="0.54">EMAIL</text>
  <text x="400" y="18" class="text-muted" font-size="9" font-weight="700" letter-spacing="0.54">STATUS</text>
  <line x1="0" y1="22" x2="480" y2="22" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>
"""),

    # Nav item — top level or sub item with enumeration
    "nav-item-top": (160, 20, """
  <text x="0" y="15" class="text-secondary" font-size="12" font-weight="500">[1] threads</text>
"""),

    "nav-item-sub": (160, 20, """
  <text x="0" y="15" class="text-secondary" font-size="12" font-weight="400">  [1.1] tokyo_trip</text>
"""),

    "nav-item-active": (160, 20, """
  <text x="0" y="15" class="text-accent" font-size="12" font-weight="700">> [1.1] tokyo_trip</text>
"""),

    # Tab item — default or active with * prefix
    "tab-item-default": (120, 20, """
  <text x="0" y="15" class="text-secondary" font-size="12" font-weight="400">tab_label</text>
"""),

    "tab-item-active": (120, 20, """
  <text x="0" y="15" class="text-accent" font-size="12" font-weight="700">* tab_label</text>
"""),

    # Breadcrumb trail — / separator between segments
    "breadcrumb-trail": (320, 20, """
  <text x="0" y="15" class="text-secondary" font-size="12" font-weight="400">/ users / alex / threads</text>
"""),

    # Pagination — [ < prev ] [ page info ] [ next > ]
    "pagination-default": (280, 20, """
  <text x="0" y="15" class="text-secondary" font-size="12" font-weight="500">[ < prev ]</text>
  <text x="100" y="15" class="text-muted" font-size="11" font-weight="400">page [05 / 247]</text>
  <text x="240" y="15" class="text-secondary" font-size="12" font-weight="500">[ next > ]</text>
"""),

    # Stat — large phosphor number + uppercase label
    "stat-default": (140, 56, """
  <text x="0" y="14" class="text-muted" font-size="9" font-weight="500" letter-spacing="0.54">ACTIVE_USERS</text>
  <text x="0" y="44" class="text-accent" font-size="28" font-weight="700">1247</text>
"""),

    # Key-value — KEY .... value with dotted leader
    "key-value-default": (200, 20, """
  <text x="0" y="15" class="text-muted" font-size="9" font-weight="700" letter-spacing="0.54">PLAN</text>
  <text x="50" y="15" class="text-muted" font-size="11" font-weight="400" letter-spacing="1">. . . .</text>
  <text x="140" y="15" class="text-primary" font-size="12" font-weight="400">Professional</text>
"""),

    # Dropdown menu — box-drawing frame with text items
    "dropdown-menu": (160, 64, """
  <text x="2" y="14" class="text-secondary" font-size="10" font-weight="400">┌─ menu ─┐</text>
  <text x="4" y="28" class="text-secondary" font-size="10" font-weight="400">│</text>
  <text x="12" y="28" class="text-primary" font-size="11" font-weight="400">edit_profile</text>
  <text x="4" y="44" class="text-secondary" font-size="10" font-weight="400">│</text>
  <text x="12" y="44" class="text-primary" font-size="11" font-weight="400">settings</text>
  <text x="4" y="60" class="text-secondary" font-size="10" font-weight="400">│</text>
  <text x="12" y="60" class="text-error" font-size="11" font-weight="400">sign_out</text>
  <text x="2" y="76" class="text-secondary" font-size="10" font-weight="400">└──────────┘</text>
"""),

}


def main():
    only = None
    if len(sys.argv) > 2 and sys.argv[1] == "--only":
        only = sys.argv[2]

    # Script lives in tooling/; output goes up one level into the project root.
    out_dir = Path(__file__).resolve().parents[2] / "systems" / "terminal" / "components"
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

    print(f"Wrote {len(written)} Terminal component SVGs to {out_dir}")


if __name__ == "__main__":
    main()
