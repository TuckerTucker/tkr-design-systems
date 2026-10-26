"""
Terminal pattern templates (Tier 3 layout-level components).

Terminal's distinctive grammar at the pattern level:
  - Box-drawing frames: ┌─┐│└─┘ for session containers
  - Prompt-style labels: $ command, // comment, > selected, [N] enumerated
  - Monospace column alignment replaces grid systems
  - Selection via character (>) + color shift, never background fills
  - Dashed borders for elevation; solid only for strongest separation
  - Color is diagnostic: phosphor green = active, amber = count, red = error

Patterns to author (4 per LIBRARY-SPEC's Terminal coverage target):
  - dashboard (the signature session view; template at the end of PATTERNS)
  - command_palette (Terminal's natural-fit pattern)
  - settings_layout (sidebar nav + form content)
  - data_table (tabular data with box-drawing frame)

Skip: article, auth per Terminal coverage notes (terminals don't auth)

Rendered by tools/builders/build.py into systems/terminal/layouts/.
Colours, fonts, radii and border widths are {token.path} placeholders
resolved from systems/terminal/tokens.json, which is authoritative;
values quoted above describe the grammar and may lag the token file.
"""

PATTERNS = {

    # ═════════════════════ COMMAND_PALETTE ═════════════════════
    # Terminal's signature overlay pattern: centered panel with search at top,
    # command list below organized by sections (COMMANDS / RECENT / FILES)
    # Selection via > prefix on hover

    "command-palette-default": (1280, 800, """
  <!-- Background dim — Terminal uses a dark wash -->
  <rect x="0" y="0" width="1280" height="800" fill="{extras.color.void}" opacity="0.4"/>

  <!-- Centered panel: 600px wide × 500px tall -->
  <rect x="340" y="150" width="600" height="500" fill="{color.page_bg}"/>
  <line x1="340" y1="150" x2="940" y2="150" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <!-- Search input at top with prompt-style prefix -->
  <text x="356" y="178" class="text-secondary" font-size="12" font-weight="400">> </text>
  <text x="372" y="178" class="text-muted" font-size="12" font-weight="400">search commands, files, actions...</text>
  <text x="928" y="178" class="text-accent" font-size="12" font-weight="700">█</text>
  <line x1="340" y1="195" x2="940" y2="195" stroke="{color.border_default}" stroke-width="{border_width.default}" stroke-dasharray="3,2"/>

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
  <line x1="340" y1="625" x2="940" y2="625" stroke="{color.border_default}" stroke-width="{border_width.default}" stroke-dasharray="3,2"/>
  <text x="356" y="645" class="text-muted" font-size="9" font-weight="400" letter-spacing="0.54">↑ ↓ navigate • ⏎ select • esc close</text>

  <!-- Outer frame -->
  <line x1="940" y1="150" x2="940" y2="650" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
  <line x1="340" y1="650" x2="940" y2="650" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
  <line x1="340" y1="150" x2="340" y2="650" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
"""),

    # ═════════════════════ SETTINGS_LAYOUT ═════════════════════
    # Sidebar navigation (numbered sections) + content panel (form fields)
    # Matches the signature dashboard sidebar structure

    "settings-layout-default": (1280, 800, """
  <!-- Page background -->
  <rect x="0" y="0" width="1280" height="800" fill="{color.page_bg}"/>

  <!-- SIDEBAR: 280px wide -->
  <text x="14" y="24" class="text-accent" font-size="11" font-weight="700">settings@local:~$</text>
  <text x="14" y="40" class="text-secondary" font-size="10" font-weight="500">// configuration</text>
  <line x1="0" y1="56" x2="280" y2="56" stroke="{color.border_default}" stroke-width="{border_width.default}" stroke-dasharray="3,2"/>

  <!-- Section label -->
  <text x="14" y="80" class="text-muted" font-size="9" font-weight="500" letter-spacing="0.54">// SECTIONS</text>

  <!-- 01 Profile (selected) -->
  <text x="2" y="104" class="text-accent" font-size="12" font-weight="700">> </text>
  <text x="14" y="104" class="text-accent" font-size="12" font-weight="700">[01] profile</text>
  <line x1="0" y1="120" x2="280" y2="120" stroke="{color.border_default}" stroke-width="{border_width.default}" stroke-dasharray="3,2"/>

  <!-- 02 Account -->
  <text x="14" y="144" class="text-secondary" font-size="12" font-weight="500">[02] account</text>
  <line x1="0" y1="160" x2="280" y2="160" stroke="{color.border_default}" stroke-width="{border_width.default}" stroke-dasharray="3,2"/>

  <!-- 03 Notifications -->
  <text x="14" y="184" class="text-secondary" font-size="12" font-weight="500">[03] notifications</text>
  <line x1="0" y1="200" x2="280" y2="200" stroke="{color.border_default}" stroke-width="{border_width.default}" stroke-dasharray="3,2"/>

  <!-- 04 Security -->
  <text x="14" y="224" class="text-secondary" font-size="12" font-weight="500">[04] security</text>
  <line x1="0" y1="240" x2="280" y2="240" stroke="{color.border_default}" stroke-width="{border_width.default}" stroke-dasharray="3,2"/>

  <!-- 05 Integrations -->
  <text x="14" y="264" class="text-secondary" font-size="12" font-weight="500">[05] integrations</text>
  <line x1="0" y1="280" x2="280" y2="280" stroke="{color.border_default}" stroke-width="{border_width.default}" stroke-dasharray="3,2"/>

  <!-- Sidebar vertical rule -->
  <line x1="280" y1="0" x2="280" y2="800" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <!-- CONTENT PANEL: 1000px wide starting at 280 -->
  <!-- Section metadata header -->
  <text x="305" y="32" class="text-muted" font-size="9" font-weight="500" letter-spacing="0.54">SECTION [01 / 05]</text>
  <text x="305" y="60" class="text-accent" font-size="16" font-weight="700">PROFILE</text>
  <text x="305" y="78" class="text-secondary" font-size="11" font-weight="400">// manage your personal information</text>
  <line x1="305" y1="96" x2="1248" y2="96" stroke="{color.border_default}" stroke-width="{border_width.default}" stroke-dasharray="3,2"/>

  <!-- Field 1: Display name -->
  <text x="305" y="128" class="text-secondary" font-size="10" font-weight="500">DISPLAY_NAME</text>
  <line x1="305" y1="140" x2="620" y2="140" stroke="{color.border_default}" stroke-width="{border_width.default}" stroke-dasharray="3,2"/>
  <text x="305" y="160" class="text-secondary" font-size="12" font-weight="400">> </text>
  <text x="321" y="160" class="text-primary" font-size="12" font-weight="400">tucker</text>
  <line x1="305" y1="184" x2="1248" y2="184" stroke="{color.border_default}" stroke-width="{border_width.default}" stroke-dasharray="3,2"/>

  <!-- Field 2: Email -->
  <text x="305" y="216" class="text-secondary" font-size="10" font-weight="500">EMAIL</text>
  <line x1="305" y1="228" x2="620" y2="228" stroke="{color.border_default}" stroke-width="{border_width.default}" stroke-dasharray="3,2"/>
  <text x="305" y="248" class="text-secondary" font-size="12" font-weight="400">> </text>
  <text x="321" y="248" class="text-primary" font-size="12" font-weight="400">connect@tucker.sh</text>
  <line x1="305" y1="272" x2="1248" y2="272" stroke="{color.border_default}" stroke-width="{border_width.default}" stroke-dasharray="3,2"/>

  <!-- Field 3: Time zone -->
  <text x="305" y="304" class="text-secondary" font-size="10" font-weight="500">TIMEZONE</text>
  <line x1="305" y1="316" x2="620" y2="316" stroke="{color.border_default}" stroke-width="{border_width.default}" stroke-dasharray="3,2"/>
  <text x="305" y="336" class="text-secondary" font-size="12" font-weight="400">> </text>
  <text x="321" y="336" class="text-primary" font-size="12" font-weight="400">america/los_angeles</text>
  <line x1="305" y1="360" x2="1248" y2="360" stroke="{color.border_default}" stroke-width="{border_width.default}" stroke-dasharray="3,2"/>

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
  <rect x="0" y="0" width="1280" height="800" fill="{color.page_bg}"/>

  <!-- Table header with box-drawing top border -->
  <text x="14" y="24" class="text-secondary" font-size="10" font-weight="500">$ ls -la users</text>
  <line x1="0" y1="40" x2="1280" y2="40" stroke="{color.border_default}" stroke-width="{border_width.default}" stroke-dasharray="3,2"/>

  <!-- Column headers -->
  <text x="14" y="60" class="text-muted" font-size="9" font-weight="700" letter-spacing="0.54">#</text>
  <text x="48" y="60" class="text-muted" font-size="9" font-weight="700" letter-spacing="0.54">NAME</text>
  <text x="240" y="60" class="text-muted" font-size="9" font-weight="700" letter-spacing="0.54">EMAIL</text>
  <text x="640" y="60" class="text-muted" font-size="9" font-weight="700" letter-spacing="0.54">ROLE</text>
  <text x="900" y="60" class="text-muted" font-size="9" font-weight="700" letter-spacing="0.54">JOINED</text>
  <text x="1248" y="60" class="text-muted" font-size="9" font-weight="700" letter-spacing="0.54">STATUS</text>

  <!-- Header rule -->
  <line x1="0" y1="72" x2="1280" y2="72" stroke="{color.border_default}" stroke-width="{border_width.default}" stroke-dasharray="3,2"/>

  <!-- Row 01 (selected) -->
  <text x="0" y="96" class="text-accent" font-size="12" font-weight="700">> </text>
  <text x="14" y="96" class="text-accent" font-size="12" font-weight="700">[01]</text>
  <text x="48" y="96" class="text-accent" font-size="12" font-weight="700">alex_rivera</text>
  <text x="240" y="96" class="text-primary" font-size="12" font-weight="400">alex@northwind.com</text>
  <text x="640" y="96" class="text-secondary" font-size="12" font-weight="400">administrator</text>
  <text x="900" y="96" class="text-muted" font-size="11" font-weight="400">jan_2024</text>
  <text x="1248" y="96" class="text-secondary" font-size="9" font-weight="700" letter-spacing="0.54" text-anchor="end">[ACTIVE]</text>

  <!-- Row separator -->
  <line x1="0" y1="112" x2="1280" y2="112" stroke="{color.border_default}" stroke-width="{border_width.default}" stroke-dasharray="3,2"/>

  <!-- Row 02 -->
  <text x="0" y="136" class="text-secondary" font-size="12" font-weight="400"> </text>
  <text x="14" y="136" class="text-secondary" font-size="12" font-weight="500">[02]</text>
  <text x="48" y="136" class="text-primary" font-size="12" font-weight="400">jordan_chen</text>
  <text x="240" y="136" class="text-primary" font-size="12" font-weight="400">jordan@northwind.com</text>
  <text x="640" y="136" class="text-secondary" font-size="12" font-weight="400">editor</text>
  <text x="900" y="136" class="text-muted" font-size="11" font-weight="400">mar_2024</text>
  <text x="1248" y="136" class="text-secondary" font-size="9" font-weight="700" letter-spacing="0.54" text-anchor="end">[ACTIVE]</text>

  <!-- Row separator -->
  <line x1="0" y1="152" x2="1280" y2="152" stroke="{color.border_default}" stroke-width="{border_width.default}" stroke-dasharray="3,2"/>

  <!-- Row 03 -->
  <text x="0" y="176" class="text-secondary" font-size="12" font-weight="400"> </text>
  <text x="14" y="176" class="text-secondary" font-size="12" font-weight="500">[03]</text>
  <text x="48" y="176" class="text-primary" font-size="12" font-weight="400">sam_okafor</text>
  <text x="240" y="176" class="text-primary" font-size="12" font-weight="400">sam@northwind.com</text>
  <text x="640" y="176" class="text-secondary" font-size="12" font-weight="400">editor</text>
  <text x="900" y="176" class="text-muted" font-size="11" font-weight="400">apr_2024</text>
  <text x="1248" y="176" class="text-secondary" font-size="9" font-weight="700" letter-spacing="0.54" text-anchor="end">[PENDING]</text>

  <!-- Row separator -->
  <line x1="0" y1="192" x2="1280" y2="192" stroke="{color.border_default}" stroke-width="{border_width.default}" stroke-dasharray="3,2"/>

  <!-- Row 04 -->
  <text x="0" y="216" class="text-secondary" font-size="12" font-weight="400"> </text>
  <text x="14" y="216" class="text-secondary" font-size="12" font-weight="500">[04]</text>
  <text x="48" y="216" class="text-primary" font-size="12" font-weight="400">taylor_kim</text>
  <text x="240" y="216" class="text-primary" font-size="12" font-weight="400">taylor@northwind.com</text>
  <text x="640" y="216" class="text-secondary" font-size="12" font-weight="400">viewer</text>
  <text x="900" y="216" class="text-muted" font-size="11" font-weight="400">may_2024</text>
  <text x="1248" y="216" class="text-muted" font-size="9" font-weight="700" letter-spacing="0.54" text-anchor="end">[INACTIVE]</text>

  <!-- Row separator -->
  <line x1="0" y1="232" x2="1280" y2="232" stroke="{color.border_default}" stroke-width="{border_width.default}" stroke-dasharray="3,2"/>

  <!-- Row 05 -->
  <text x="0" y="256" class="text-secondary" font-size="12" font-weight="400"> </text>
  <text x="14" y="256" class="text-secondary" font-size="12" font-weight="500">[05]</text>
  <text x="48" y="256" class="text-primary" font-size="12" font-weight="400">robin_patel</text>
  <text x="240" y="256" class="text-primary" font-size="12" font-weight="400">robin@northwind.com</text>
  <text x="640" y="256" class="text-secondary" font-size="12" font-weight="400">administrator</text>
  <text x="900" y="256" class="text-muted" font-size="11" font-weight="400">jun_2024</text>
  <text x="1248" y="256" class="text-secondary" font-size="9" font-weight="700" letter-spacing="0.54" text-anchor="end">[ACTIVE]</text>

  <!-- Bottom rule -->
  <line x1="0" y1="272" x2="1280" y2="272" stroke="{color.border_default}" stroke-width="{border_width.default}" stroke-dasharray="3,2"/>

  <!-- Pagination -->
  <text x="14" y="320" class="text-secondary" font-size="11" font-weight="500">[ &lt; prev ]</text>
  <text x="140" y="320" class="text-muted" font-size="11" font-weight="400">page [05 / 247]</text>
  <text x="1200" y="320" class="text-secondary" font-size="11" font-weight="500">[ next &gt; ]</text>

  <!-- Footer hint -->
  <text x="14" y="744" class="text-muted" font-size="9" font-weight="400" letter-spacing="0.54">// use arrow keys to navigate, q to quit</text>
"""),

    # ═════ DASHBOARD — signature session view (formerly hand-authored layouts/dashboard.svg) ═════
    "dashboard": (1280, 800, """
  <!-- Terminal dashboard — desktop 1280×800
       grammar_family: character_grid
       Sidebar 280px + main 1000px, separated by 1px solid color.border_default (strong border).
       Box-drawing characters frame the session header per terminal-box-drawing-borders.
  -->

  <!-- Page background -->
  <rect x="0" y="0" width="1280" height="800" fill="{color.page_bg}"/>

  <!-- ════════════════════════════════════════════════════════════
       SIDEBAR
       ════════════════════════════════════════════════════════════ -->

  <!-- Brand: prompt-style header -->
  <text x="14" y="24"
        font-family="{font.body}"
        font-size="11"
        font-weight="700"
        fill="{color.accent}">terminal@chat:~$</text>
  <text x="14" y="40"
        font-family="{font.body}"
        font-size="10"
        font-weight="500"
        fill="{color.text_secondary}">// 5 sessions · 3 active</text>

  <!-- Dashed rule -->
  <line x1="0" y1="56" x2="280" y2="56"
        stroke="{color.border_default}" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- Search: prompt-style with $ grep prefix -->
  <text x="14" y="80"
        font-family="{font.body}"
        font-size="10"
        font-weight="500"
        fill="{color.text_secondary}">$ grep</text>
  <text x="62" y="80"
        font-family="{font.body}"
        font-size="11"
        font-weight="400"
        fill="{color.text_muted}">...</text>

  <!-- Dashed rule -->
  <line x1="0" y1="96" x2="280" y2="96"
        stroke="{color.border_default}" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- Sessions section header -->
  <text x="14" y="120"
        font-family="{font.body}"
        font-size="9"
        font-weight="500"
        fill="{color.text_muted}"
        letter-spacing="0.54">// SESSIONS</text>

  <!-- ─── List Item 01: SELECTED (tokyo_trip) ──────────────────── -->
  <text x="2" y="148"
        font-family="{font.body}"
        font-size="12"
        font-weight="700"
        fill="{color.accent}">&gt;</text>
  <text x="14" y="148"
        font-family="{font.body}"
        font-size="12"
        font-weight="700"
        fill="{color.text_primary}">tokyo_trip</text>
  <text x="92" y="148"
        font-family="{font.body}"
        font-size="11"
        font-weight="700"
        fill="{color.warning}">[2]</text>
  <text x="266" y="148"
        font-family="{font.body}"
        font-size="10"
        font-weight="500"
        fill="{color.text_muted}"
        text-anchor="end">2m</text>
  <text x="14" y="166"
        font-family="{font.body}"
        font-size="10"
        font-weight="400"
        fill="{color.text_secondary}">// build day-by-day itinerary?</text>
  <line x1="0" y1="183" x2="280" y2="183"
        stroke="{color.border_default}" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- ─── List Item 02: recipe_ideas ─────────────────────────────── -->
  <text x="14" y="207"
        font-family="{font.body}"
        font-size="12"
        font-weight="500"
        fill="{color.text_secondary}">recipe_ideas</text>
  <text x="266" y="207"
        font-family="{font.body}"
        font-size="10"
        font-weight="500"
        fill="{color.text_muted}"
        text-anchor="end">1h</text>
  <text x="14" y="225"
        font-family="{font.body}"
        font-size="10"
        font-weight="400"
        fill="{color.text_muted}">// 5 ramen variations you'll love</text>
  <line x1="0" y1="242" x2="280" y2="242"
        stroke="{color.border_default}" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- ─── List Item 03: book_club ───────────────────────────────── -->
  <text x="14" y="266"
        font-family="{font.body}"
        font-size="12"
        font-weight="500"
        fill="{color.text_secondary}">book_club</text>
  <text x="92" y="266"
        font-family="{font.body}"
        font-size="11"
        font-weight="700"
        fill="{color.warning}">[1]</text>
  <text x="266" y="266"
        font-family="{font.body}"
        font-size="10"
        font-weight="500"
        fill="{color.text_muted}"
        text-anchor="end">3h</text>
  <text x="14" y="284"
        font-family="{font.body}"
        font-size="10"
        font-weight="400"
        fill="{color.text_muted}">// recommend starting with murakami</text>
  <line x1="0" y1="301" x2="280" y2="301"
        stroke="{color.border_default}" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- ─── List Item 04: fitness_plan ────────────────────────────── -->
  <text x="14" y="325"
        font-family="{font.body}"
        font-size="12"
        font-weight="500"
        fill="{color.text_secondary}">fitness_plan</text>
  <text x="266" y="325"
        font-family="{font.body}"
        font-size="10"
        font-weight="500"
        fill="{color.text_muted}"
        text-anchor="end">1d</text>
  <text x="14" y="343"
        font-family="{font.body}"
        font-size="10"
        font-weight="400"
        fill="{color.text_muted}">// 4-week progressive routine ready</text>
  <line x1="0" y1="360" x2="280" y2="360"
        stroke="{color.border_default}" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- ─── List Item 05: code_review ─────────────────────────────── -->
  <text x="14" y="384"
        font-family="{font.body}"
        font-size="12"
        font-weight="500"
        fill="{color.text_secondary}">code_review</text>
  <text x="266" y="384"
        font-family="{font.body}"
        font-size="10"
        font-weight="500"
        fill="{color.text_muted}"
        text-anchor="end">2d</text>
  <text x="14" y="402"
        font-family="{font.body}"
        font-size="10"
        font-weight="400"
        fill="{color.text_muted}">// auth middleware looks solid, but...</text>
  <line x1="0" y1="419" x2="280" y2="419"
        stroke="{color.border_default}" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- whoami footer -->
  <line x1="0" y1="744" x2="280" y2="744"
        stroke="{color.border_default}" stroke-width="1" stroke-dasharray="3,2"/>
  <text x="14" y="768"
        font-family="{font.body}"
        font-size="10"
        font-weight="500"
        fill="{color.text_secondary}">$ whoami</text>
  <text x="14" y="784"
        font-family="{font.body}"
        font-size="10"
        font-weight="500"
        fill="{color.text_primary}">tucker<tspan fill="{color.text_muted}">@local</tspan></text>

  <!-- ════════════════════════════════════════════════════════════
       MAIN AREA
       ════════════════════════════════════════════════════════════ -->

  <!-- Box-drawing session header per terminal-box-drawing-borders.
       Uses unicode_light style: ┌─┐ │ └─┘
       This is the system's signature moment.
  -->
  <text x="313" y="32"
        font-family="{font.body}"
        font-size="10"
        font-weight="500"
        fill="{color.text_secondary}">┌─ SESSION · tokyo_trip · active ─────────────────────────────────────┐</text>
  <text x="313" y="56"
        font-family="{font.body}"
        font-size="12"
        font-weight="700"
        fill="{color.accent}">│</text>
  <text x="328" y="56"
        font-family="{font.body}"
        font-size="12"
        font-weight="500"
        fill="{color.text_primary}">Tokyo Trip</text>
  <text x="412" y="56"
        font-family="{font.body}"
        font-size="10"
        font-weight="500"
        fill="{color.text_muted}">// 4 exchanges · connected</text>
  <text x="1192" y="56"
        font-family="{font.body}"
        font-size="9"
        font-weight="700"
        fill="{color.warning}"
        letter-spacing="0.72"
        text-anchor="end">● LIVE</text>
  <text x="313" y="72"
        font-family="{font.body}"
        font-size="10"
        font-weight="500"
        fill="{color.text_secondary}">└──────────────────────────────────────────────────────────────────────┘</text>

  <!-- ─── Messages ─────────────────────────────────────────────── -->
  <!-- Message 01 — user -->
  <text x="313" y="120"
        font-family="{font.body}"
        font-size="10"
        font-weight="700"
        fill="{extras.color.accent_alt}">user@local&gt;</text>
  <text x="416" y="120"
        font-family="{font.body}"
        font-size="9"
        font-weight="500"
        fill="{color.text_muted}">[00:01:17]</text>
  <text x="328" y="142"
        font-family="{font.body}"
        font-size="12"
        font-weight="400"
        fill="{color.text_primary}">Hey, can you help me plan a trip to Tokyo?</text>

  <!-- Message 02 — ai -->
  <text x="313" y="186"
        font-family="{font.body}"
        font-size="10"
        font-weight="700"
        fill="{color.accent}">ai@system&gt;</text>
  <text x="408" y="186"
        font-family="{font.body}"
        font-size="9"
        font-weight="500"
        fill="{color.text_muted}">[00:02:31]</text>
  <text x="328" y="208"
        font-family="{font.body}"
        font-size="12"
        font-weight="400"
        fill="{extras.color.text_ai_output}">Absolutely. Tokyo is incredible. Are you looking for a culture-focused trip,</text>
  <text x="328" y="226"
        font-family="{font.body}"
        font-size="12"
        font-weight="400"
        fill="{extras.color.text_ai_output}">food adventure, or a mix of everything?</text>

  <!-- Message 03 — user -->
  <text x="313" y="270"
        font-family="{font.body}"
        font-size="10"
        font-weight="700"
        fill="{extras.color.accent_alt}">user@local&gt;</text>
  <text x="416" y="270"
        font-family="{font.body}"
        font-size="9"
        font-weight="500"
        fill="{color.text_muted}">[00:03:08]</text>
  <text x="328" y="292"
        font-family="{font.body}"
        font-size="12"
        font-weight="400"
        fill="{color.text_primary}">Definitely a mix — temples in the morning, ramen at night.</text>

  <!-- Message 04 — ai -->
  <text x="313" y="336"
        font-family="{font.body}"
        font-size="10"
        font-weight="700"
        fill="{color.accent}">ai@system&gt;</text>
  <text x="408" y="336"
        font-family="{font.body}"
        font-size="9"
        font-weight="500"
        fill="{color.text_muted}">[00:04:22]</text>
  <text x="328" y="358"
        font-family="{font.body}"
        font-size="12"
        font-weight="400"
        fill="{extras.color.text_ai_output}">Perfect combo. I'd suggest starting in Asakusa for Senso-ji, then heading</text>
  <text x="328" y="376"
        font-family="{font.body}"
        font-size="12"
        font-weight="400"
        fill="{extras.color.text_ai_output}">to Shibuya for the evening food scene. Want me to build a day-by-day</text>
  <text x="328" y="394"
        font-family="{font.body}"
        font-size="12"
        font-weight="400"
        fill="{extras.color.text_ai_output}">itinerary?</text>

  <!-- Composer: $ prompt + input + cursor block -->
  <line x1="313" y1="704" x2="1192" y2="704"
        stroke="{color.border_default}" stroke-width="1" stroke-dasharray="3,2"/>
  <text x="313" y="744"
        font-family="{font.body}"
        font-size="11"
        font-weight="700"
        fill="{color.accent}">$</text>
  <text x="328" y="744"
        font-family="{font.body}"
        font-size="12"
        font-weight="400"
        fill="{color.text_muted}">type command or message...</text>
  <!-- Cursor block per cursor extension -->
  <text x="544" y="744"
        font-family="{font.body}"
        font-size="12"
        font-weight="700"
        fill="{color.accent}">█</text>
  <text x="313" y="764"
        font-family="{font.body}"
        font-size="9"
        font-weight="500"
        fill="{color.text_muted}">// /help · /clear · ⏎ send</text>

  <!-- Strong border between sidebar and main, drawn last per the pattern
       we discovered with Swiss -->
  <line x1="280" y1="0" x2="280" y2="800" stroke="{color.border_default}" stroke-width="1"/>
"""),

}
