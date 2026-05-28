#!/usr/bin/env python3
"""
Build Terminal patterns (Tier 3 layout-level components).

Terminal's distinctive grammar at the pattern level:
  - Box-drawing frames: ┌─┐│└─┘ for session containers
  - Prompt-style labels: $ command, // comment, > selected, [N] enumerated
  - Monospace column alignment replaces grid systems
  - Selection via character (>) + color shift, never background fills
  - Dashed borders for elevation; solid only for strongest separation
  - Color is diagnostic: phosphor green = active, amber = count, red = error

Patterns to author (4 per LIBRARY-SPEC's Terminal coverage target):
  - dashboard (already exists; preserving signature SVG)
  - command_palette (Terminal's natural-fit pattern)
  - settings_layout (sidebar nav + form content)
  - data_table (tabular data with box-drawing frame)

Skip: article, auth per Terminal coverage notes (terminals don't auth)
"""

import sys
from pathlib import Path

STANDARD_DEFS = """  <defs>
    <style>
      .text-primary { fill: #C8F7C5; font-family: 'JetBrains Mono', ui-monospace, monospace; }
      .text-secondary { fill: #5EAA66; font-family: 'JetBrains Mono', ui-monospace, monospace; }
      .text-muted { fill: #3D7044; font-family: 'JetBrains Mono', ui-monospace, monospace; }
      .text-accent { fill: #00FF66; font-family: 'JetBrains Mono', ui-monospace, monospace; }
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


PATTERNS = {

    # ═════════════════════ COMMAND_PALETTE ═════════════════════
    # Terminal's signature overlay pattern: centered panel with search at top,
    # command list below organized by sections (COMMANDS / RECENT / FILES)
    # Selection via > prefix on hover

    "command-palette-default": (1280, 800, """
  <!-- Background dim — Terminal uses a dark wash -->
  <rect x="0" y="0" width="1280" height="800" fill="#000000" opacity="0.4"/>

  <!-- Centered panel: 600px wide × 500px tall -->
  <rect x="340" y="150" width="600" height="500" fill="#0A0F0A"/>
  <line x1="340" y1="150" x2="940" y2="150" stroke="#1F2F1F" stroke-width="1"/>

  <!-- Search input at top with prompt-style prefix -->
  <text x="356" y="178" class="text-secondary" font-size="12" font-weight="400">> </text>
  <text x="372" y="178" class="text-muted" font-size="12" font-weight="400">search commands, files, actions...</text>
  <text x="928" y="178" class="text-accent" font-size="12" font-weight="700">█</text>
  <line x1="340" y1="195" x2="940" y2="195" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- COMMANDS section header -->
  <text x="356" y="221" class="text-muted" font-size="9" font-weight="500" letter-spacing="0.54">// COMMANDS</text>

  <!-- Command list items -->
  <text x="356" y="245" class="text-secondary" font-size="11" font-weight="400"> </text>
  <text x="372" y="245" class="text-primary" font-size="11" font-weight="400">design-system-skill check</text>

  <text x="356" y="265" class="text-secondary" font-size="11" font-weight="400"> </text>
  <text x="372" y="265" class="text-primary" font-size="11" font-weight="400">wireframe-skill render</text>

  <text x="356" y="285" class="text-secondary" font-size="11" font-weight="400"> </text>
  <text x="372" y="285" class="text-primary" font-size="11" font-weight="400">validate-spec all systems</text>

  <!-- RECENT section header -->
  <text x="356" y="321" class="text-muted" font-size="9" font-weight="500" letter-spacing="0.54">// RECENT</text>

  <!-- Recent items with selection indicator -->
  <text x="356" y="345" class="text-accent" font-size="11" font-weight="700">> </text>
  <text x="372" y="345" class="text-accent" font-size="11" font-weight="400">auth_signup_pattern</text>

  <text x="356" y="365" class="text-secondary" font-size="11" font-weight="400"> </text>
  <text x="372" y="365" class="text-primary" font-size="11" font-weight="400">settings_layout</text>

  <!-- FILES section header -->
  <text x="356" y="401" class="text-muted" font-size="9" font-weight="500" letter-spacing="0.54">// FILES</text>

  <!-- File items -->
  <text x="356" y="425" class="text-secondary" font-size="11" font-weight="400"> </text>
  <text x="372" y="425" class="text-primary" font-size="11" font-weight="400">terminal-spec.yaml</text>

  <text x="356" y="445" class="text-secondary" font-size="11" font-weight="400"> </text>
  <text x="372" y="445" class="text-primary" font-size="11" font-weight="400">LIBRARY-SPEC.md</text>

  <!-- Footer hint -->
  <line x1="340" y1="625" x2="940" y2="625" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>
  <text x="356" y="645" class="text-muted" font-size="9" font-weight="400" letter-spacing="0.54">↑ ↓ navigate • ⏎ select • esc close</text>

  <!-- Outer frame -->
  <line x1="940" y1="150" x2="940" y2="650" stroke="#1F2F1F" stroke-width="1"/>
  <line x1="340" y1="650" x2="940" y2="650" stroke="#1F2F1F" stroke-width="1"/>
  <line x1="340" y1="150" x2="340" y2="650" stroke="#1F2F1F" stroke-width="1"/>
"""),

    # ═════════════════════ SETTINGS_LAYOUT ═════════════════════
    # Sidebar navigation (numbered sections) + content panel (form fields)
    # Matches the signature dashboard sidebar structure

    "settings-layout-default": (1280, 800, """
  <!-- Page background -->
  <rect x="0" y="0" width="1280" height="800" fill="#0A0F0A"/>

  <!-- SIDEBAR: 280px wide -->
  <text x="14" y="24" class="text-accent" font-size="11" font-weight="700">settings@local:~$</text>
  <text x="14" y="40" class="text-secondary" font-size="10" font-weight="500">// configuration</text>
  <line x1="0" y1="56" x2="280" y2="56" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- Section label -->
  <text x="14" y="80" class="text-muted" font-size="9" font-weight="500" letter-spacing="0.54">// SECTIONS</text>

  <!-- 01 Profile (selected) -->
  <text x="2" y="104" class="text-accent" font-size="12" font-weight="700">> </text>
  <text x="14" y="104" class="text-accent" font-size="12" font-weight="700">[01] profile</text>
  <line x1="0" y1="120" x2="280" y2="120" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- 02 Account -->
  <text x="14" y="144" class="text-secondary" font-size="12" font-weight="500">[02] account</text>
  <line x1="0" y1="160" x2="280" y2="160" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- 03 Notifications -->
  <text x="14" y="184" class="text-secondary" font-size="12" font-weight="500">[03] notifications</text>
  <line x1="0" y1="200" x2="280" y2="200" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- 04 Security -->
  <text x="14" y="224" class="text-secondary" font-size="12" font-weight="500">[04] security</text>
  <line x1="0" y1="240" x2="280" y2="240" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- 05 Integrations -->
  <text x="14" y="264" class="text-secondary" font-size="12" font-weight="500">[05] integrations</text>
  <line x1="0" y1="280" x2="280" y2="280" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- Sidebar vertical rule -->
  <line x1="280" y1="0" x2="280" y2="800" stroke="#1F2F1F" stroke-width="1"/>

  <!-- CONTENT PANEL: 1000px wide starting at 280 -->
  <!-- Section metadata header -->
  <text x="305" y="32" class="text-muted" font-size="9" font-weight="500" letter-spacing="0.54">SECTION [01 / 05]</text>
  <text x="305" y="60" class="text-accent" font-size="16" font-weight="700">PROFILE</text>
  <text x="305" y="78" class="text-secondary" font-size="11" font-weight="400">// manage your personal information</text>
  <line x1="305" y1="96" x2="1248" y2="96" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- Field 1: Display name -->
  <text x="305" y="128" class="text-secondary" font-size="10" font-weight="500">DISPLAY_NAME</text>
  <line x1="305" y1="140" x2="620" y2="140" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>
  <text x="305" y="160" class="text-secondary" font-size="12" font-weight="400">> </text>
  <text x="321" y="160" class="text-primary" font-size="12" font-weight="400">tucker</text>
  <line x1="305" y1="184" x2="1248" y2="184" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- Field 2: Email -->
  <text x="305" y="216" class="text-secondary" font-size="10" font-weight="500">EMAIL</text>
  <line x1="305" y1="228" x2="620" y2="228" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>
  <text x="305" y="248" class="text-secondary" font-size="12" font-weight="400">> </text>
  <text x="321" y="248" class="text-primary" font-size="12" font-weight="400">connect@tucker.sh</text>
  <line x1="305" y1="272" x2="1248" y2="272" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- Field 3: Time zone -->
  <text x="305" y="304" class="text-secondary" font-size="10" font-weight="500">TIMEZONE</text>
  <line x1="305" y1="316" x2="620" y2="316" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>
  <text x="305" y="336" class="text-secondary" font-size="12" font-weight="400">> </text>
  <text x="321" y="336" class="text-primary" font-size="12" font-weight="400">america/los_angeles</text>
  <line x1="305" y1="360" x2="1248" y2="360" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- Actions at bottom -->
  <text x="1100" y="744" class="text-secondary" font-size="12" font-weight="500" text-anchor="end">[ cancel ]</text>
  <text x="1248" y="744" class="text-accent" font-size="12" font-weight="700" text-anchor="end">[ SAVE ]</text>
"""),

    # ═════════════════════ DATA_TABLE ═════════════════════
    # Tabular data with box-drawing frame, column headers, row separators
    # Status cells use [UPPERCASE] bracketed notation
    # Selection via > prefix in left margin

    "data-table-default": (1280, 800, """
  <!-- Page background -->
  <rect x="0" y="0" width="1280" height="800" fill="#0A0F0A"/>

  <!-- Table header with box-drawing top border -->
  <text x="14" y="24" class="text-secondary" font-size="10" font-weight="500">$ ls -la users</text>
  <line x1="0" y1="40" x2="1280" y2="40" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- Column headers -->
  <text x="14" y="60" class="text-muted" font-size="9" font-weight="700" letter-spacing="0.54">#</text>
  <text x="48" y="60" class="text-muted" font-size="9" font-weight="700" letter-spacing="0.54">NAME</text>
  <text x="240" y="60" class="text-muted" font-size="9" font-weight="700" letter-spacing="0.54">EMAIL</text>
  <text x="640" y="60" class="text-muted" font-size="9" font-weight="700" letter-spacing="0.54">ROLE</text>
  <text x="900" y="60" class="text-muted" font-size="9" font-weight="700" letter-spacing="0.54">JOINED</text>
  <text x="1248" y="60" class="text-muted" font-size="9" font-weight="700" letter-spacing="0.54">STATUS</text>

  <!-- Header rule -->
  <line x1="0" y1="72" x2="1280" y2="72" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- Row 01 (selected) -->
  <text x="0" y="96" class="text-accent" font-size="12" font-weight="700">> </text>
  <text x="14" y="96" class="text-accent" font-size="12" font-weight="700">[01]</text>
  <text x="48" y="96" class="text-accent" font-size="12" font-weight="700">alex_rivera</text>
  <text x="240" y="96" class="text-primary" font-size="12" font-weight="400">alex@northwind.com</text>
  <text x="640" y="96" class="text-secondary" font-size="12" font-weight="400">administrator</text>
  <text x="900" y="96" class="text-muted" font-size="11" font-weight="400">jan_2024</text>
  <text x="1248" y="96" class="text-secondary" font-size="9" font-weight="700" letter-spacing="0.54" text-anchor="end">[ACTIVE]</text>

  <!-- Row separator -->
  <line x1="0" y1="112" x2="1280" y2="112" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- Row 02 -->
  <text x="0" y="136" class="text-secondary" font-size="12" font-weight="400"> </text>
  <text x="14" y="136" class="text-secondary" font-size="12" font-weight="500">[02]</text>
  <text x="48" y="136" class="text-primary" font-size="12" font-weight="400">jordan_chen</text>
  <text x="240" y="136" class="text-primary" font-size="12" font-weight="400">jordan@northwind.com</text>
  <text x="640" y="136" class="text-secondary" font-size="12" font-weight="400">editor</text>
  <text x="900" y="136" class="text-muted" font-size="11" font-weight="400">mar_2024</text>
  <text x="1248" y="136" class="text-secondary" font-size="9" font-weight="700" letter-spacing="0.54" text-anchor="end">[ACTIVE]</text>

  <!-- Row separator -->
  <line x1="0" y1="152" x2="1280" y2="152" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- Row 03 -->
  <text x="0" y="176" class="text-secondary" font-size="12" font-weight="400"> </text>
  <text x="14" y="176" class="text-secondary" font-size="12" font-weight="500">[03]</text>
  <text x="48" y="176" class="text-primary" font-size="12" font-weight="400">sam_okafor</text>
  <text x="240" y="176" class="text-primary" font-size="12" font-weight="400">sam@northwind.com</text>
  <text x="640" y="176" class="text-secondary" font-size="12" font-weight="400">editor</text>
  <text x="900" y="176" class="text-muted" font-size="11" font-weight="400">apr_2024</text>
  <text x="1248" y="176" class="text-secondary" font-size="9" font-weight="700" letter-spacing="0.54" text-anchor="end">[PENDING]</text>

  <!-- Row separator -->
  <line x1="0" y1="192" x2="1280" y2="192" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- Row 04 -->
  <text x="0" y="216" class="text-secondary" font-size="12" font-weight="400"> </text>
  <text x="14" y="216" class="text-secondary" font-size="12" font-weight="500">[04]</text>
  <text x="48" y="216" class="text-primary" font-size="12" font-weight="400">taylor_kim</text>
  <text x="240" y="216" class="text-primary" font-size="12" font-weight="400">taylor@northwind.com</text>
  <text x="640" y="216" class="text-secondary" font-size="12" font-weight="400">viewer</text>
  <text x="900" y="216" class="text-muted" font-size="11" font-weight="400">may_2024</text>
  <text x="1248" y="216" class="text-muted" font-size="9" font-weight="700" letter-spacing="0.54" text-anchor="end">[INACTIVE]</text>

  <!-- Row separator -->
  <line x1="0" y1="232" x2="1280" y2="232" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- Row 05 -->
  <text x="0" y="256" class="text-secondary" font-size="12" font-weight="400"> </text>
  <text x="14" y="256" class="text-secondary" font-size="12" font-weight="500">[05]</text>
  <text x="48" y="256" class="text-primary" font-size="12" font-weight="400">robin_patel</text>
  <text x="240" y="256" class="text-primary" font-size="12" font-weight="400">robin@northwind.com</text>
  <text x="640" y="256" class="text-secondary" font-size="12" font-weight="400">administrator</text>
  <text x="900" y="256" class="text-muted" font-size="11" font-weight="400">jun_2024</text>
  <text x="1248" y="256" class="text-secondary" font-size="9" font-weight="700" letter-spacing="0.54" text-anchor="end">[ACTIVE]</text>

  <!-- Bottom rule -->
  <line x1="0" y1="272" x2="1280" y2="272" stroke="#1F2F1F" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- Pagination -->
  <text x="14" y="320" class="text-secondary" font-size="11" font-weight="500">[ < prev ]</text>
  <text x="140" y="320" class="text-muted" font-size="11" font-weight="400">page [05 / 247]</text>
  <text x="1200" y="320" class="text-secondary" font-size="11" font-weight="500">[ next > ]</text>

  <!-- Footer hint -->
  <text x="14" y="744" class="text-muted" font-size="9" font-weight="400" letter-spacing="0.54">// use arrow keys to navigate, q to quit</text>
"""),

}


def main():
    only = None
    if len(sys.argv) > 2 and sys.argv[1] == "--only":
        only = sys.argv[2]

    # Script lives in tooling/; output goes up one level into the project root.
    out_dir = Path(__file__).resolve().parent.parent / "terminal-library" / "layouts"
    out_dir.mkdir(parents=True, exist_ok=True)

    written = []
    for pattern_id, (width, height, body) in PATTERNS.items():
        if only and pattern_id != only:
            continue
        path = out_dir / f"{pattern_id}.svg"
        comment = f"<!-- ==================== {pattern_id.upper()} ==================== -->"
        svg = wrap_svg(width, height, body, comment)
        path.write_text(svg)
        written.append(path)

    print(f"Wrote {len(written)} Terminal pattern SVGs to {out_dir}")


if __name__ == "__main__":
    main()
