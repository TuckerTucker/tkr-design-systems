"""
Editorial pattern templates (Tier 3 layout-level components).

Editorial's distinctive grammar at the pattern level:
  - Cream paper background (#F8F4EC), warm and inviting
  - Fraunces serif for body/titles, Inter tracked metadata
  - Paper-tier elevation (page → elevated → rare white)
  - Horizontal rules at 4 weights for hierarchy (no boxes/shadows)
  - Drop cap ceremony (54px Fraunces burgundy, first AI message only)
  - Masthead double rule (burgundy 3px) for authority moments
  - User messages: right-aligned italic with 2px burgundy left rule
  - No emoji anywhere; identity via monogram

Patterns (4 core patterns per Editorial's content-heavy nature):
  - dashboard (1280×800): sidebar dispatch list + conversation thread + drop cap
  - article (1040×800): masthead title + byline + body with drop cap + footnote
  - form (640×800): single-column fields with Editorial form_field grammar
  - auth (1280×800): centered narrow form (320px), masthead brand at top

Rendered by tools/builders/build.py into systems/editorial/layouts/.
Colours, fonts, radii and border widths are {token.path} placeholders
resolved from systems/editorial/tokens.json, which is authoritative;
values quoted above describe the grammar and may lag the token file.
"""

PATTERNS = {

    # ═══════════════════ ARTICLE ═══════════════════
    # Editorial's pattern of pride: long-form content layout
    # 1040×800: masthead title + byline metadata + body text with drop cap
    # on first paragraph + footnote rule at bottom

    "article-default": (1040, 800, """
  <rect width="1040" height="800" fill="{color.surface}"/>

  <!-- Masthead: title + byline metadata + divider -->
  <text x="48" y="60"
        class="text-display"
        font-size="24"
        font-weight="700"
        letter-spacing="-0.48">Tokyo Trip: A Complete Itinerary</text>

  <text x="48" y="90"
        class="text-metadata"
        font-size="9"
        font-weight="600"
        letter-spacing="1.44">DISPATCH · TOKYO DESK · JAN 2024</text>

  <text x="992" y="90"
        class="text-metadata"
        font-size="9"
        font-weight="600"
        letter-spacing="1.26"
        text-anchor="end">FILED 14:23 · 5 MIN READ</text>

  <line x1="48" y1="108" x2="992" y2="108" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>

  <!-- Body text with drop cap -->
  <!-- Drop cap: 54px Fraunces 700 burgundy, floated left -->
  <text x="48" y="188"
        class="text-accent"
        font-size="54"
        font-weight="700">A</text>

  <!-- Body wraps around drop cap for 3 lines -->
  <text x="120" y="148"
        class="text-primary"
        font-size="14"
        font-weight="400"
        letter-spacing="-0.14">bsolutely breathtaking, Tokyo combines ancient temples with cutting-edge</text>

  <text x="120" y="170"
        class="text-primary"
        font-size="14"
        font-weight="400"
        letter-spacing="-0.14">technology. Whether you're exploring Asakusa's sacred grounds or hunting for</text>

  <text x="120" y="192"
        class="text-primary"
        font-size="14"
        font-weight="400"
        letter-spacing="-0.14">ramen in Shibuya, the city rewards curiosity.</text>

  <!-- Continue body after drop cap -->
  <text x="48" y="230"
        class="text-primary"
        font-size="14"
        font-weight="400"
        letter-spacing="-0.14">This guide covers five days of essential Tokyo: temples, food, museums, and urban</text>

  <text x="48" y="252"
        class="text-primary"
        font-size="14"
        font-weight="400"
        letter-spacing="-0.14">exploration. Each day is timed for sunrise to evening, with ramen breaks built in.</text>

  <!-- Section divider -->
  <line x1="48" y1="290" x2="992" y2="290" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <!-- Next section: Day 1 -->
  <text x="48" y="328"
        class="text-primary"
        font-size="15"
        font-weight="700"
        letter-spacing="-0.15">Day 1: Temples and Dawn</text>

  <text x="48" y="360"
        class="text-primary"
        font-size="14"
        font-weight="400"
        letter-spacing="-0.14">Rise early for Senso-ji Temple at sunrise. The gate glows orange as crowds build.</text>

  <text x="48" y="382"
        class="text-primary"
        font-size="14"
        font-weight="400"
        letter-spacing="-0.14">Explore the surrounding Nakamise shopping street for souvenirs and breakfast snacks.</text>

  <text x="48" y="404"
        class="text-primary"
        font-size="14"
        font-weight="400"
        letter-spacing="-0.14">By afternoon, head to nearby Roppongi for museums and garden walks.</text>

  <!-- Footnote section -->
  <line x1="48" y1="720" x2="992" y2="720" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>

  <text x="48" y="750"
        class="text-metadata"
        font-size="9"
        font-weight="600"
        letter-spacing="1.44">EDITORIAL VOICE</text>

  <text x="48" y="770"
        class="text-secondary"
        font-size="11"
        font-style="italic">This itinerary assumes moderate pace and comfort with public transit. All venues</text>

  <text x="48" y="788"
        class="text-secondary"
        font-size="11"
        font-style="italic">are accessible by train or walking from major stations.</text>
"""),

    # ═══════════════════ FORM ═══════════════════
    # Single-column form layout (640×800)
    # Editorial form_field grammar: metadata label above, Fraunces value below,
    # hairline divider between fields. Submit CTA in burgundy.

    "form-default": (640, 800, """
  <rect width="640" height="800" fill="{color.surface}"/>

  <!-- Form header -->
  <text x="32" y="52"
        class="text-display"
        font-size="24"
        font-weight="700"
        letter-spacing="-0.48">Create Your Dispatch</text>

  <text x="32" y="80"
        class="text-secondary"
        font-size="13">Share a thought, idea, or question with the editorial voice.</text>

  <line x1="32" y1="100" x2="608" y2="100" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <!-- Field 1: Title -->
  <text x="32" y="132"
        class="text-metadata"
        font-size="9"
        font-weight="600"
        letter-spacing="1.44">TITLE</text>

  <line x1="32" y1="138" x2="608" y2="138" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <text x="32" y="160"
        class="text-primary"
        font-size="14">Tokyo Trip Planning</text>

  <line x1="32" y1="190" x2="608" y2="190" stroke="{extras.color.rule_hairline}" stroke-width="1"/>

  <!-- Field 2: Category -->
  <text x="32" y="222"
        class="text-metadata"
        font-size="9"
        font-weight="600"
        letter-spacing="1.44">CATEGORY</text>

  <line x1="32" y1="228" x2="608" y2="228" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <text x="32" y="250"
        class="text-primary"
        font-size="14">Travel</text>

  <line x1="32" y1="280" x2="608" y2="280" stroke="{extras.color.rule_hairline}" stroke-width="1"/>

  <!-- Field 3: Body (textarea) -->
  <text x="32" y="312"
        class="text-metadata"
        font-size="9"
        font-weight="600"
        letter-spacing="1.44">BODY TEXT</text>

  <line x1="32" y1="318" x2="608" y2="318" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <text x="32" y="342"
        class="text-primary"
        font-size="13">A handsome serif system with warm cream paper and no emoji. Perfect</text>

  <text x="32" y="362"
        class="text-primary"
        font-size="13">for long-form content and editorial voice.</text>

  <line x1="32" y1="448" x2="608" y2="448" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <!-- Field 4: Tags -->
  <text x="32" y="480"
        class="text-metadata"
        font-size="9"
        font-weight="600"
        letter-spacing="1.44">TAGS (OPTIONAL)</text>

  <line x1="32" y1="486" x2="608" y2="486" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <text x="32" y="508"
        class="text-secondary"
        font-size="13" font-style="italic">add tags…</text>

  <line x1="32" y1="538" x2="608" y2="538" stroke="{extras.color.rule_hairline}" stroke-width="1"/>

  <!-- Action buttons: Cancel (secondary) | Submit (primary burgundy) -->
  <text x="480" y="600"
        class="text-secondary"
        font-size="14">Cancel</text>

  <text x="608" y="600"
        text-anchor="end"
        class="text-accent"
        font-size="14"
        font-weight="700">File Dispatch →</text>
"""),

    # ═══════════════════ AUTH-SIGN-IN ═══════════════════
    # Centered narrow form (320px wide, 1280×800 canvas)
    # Masthead brand at top, stacked fields, Sign in CTA in burgundy

    "auth-sign-in": (1280, 800, """
  <rect width="1280" height="800" fill="{color.surface}"/>

  <!-- Brand masthead centered at top -->
  <text x="640" y="160"
        text-anchor="middle"
        class="text-display"
        font-size="24"
        font-weight="700"
        letter-spacing="-0.48">Editorial</text>

  <text x="640" y="200"
        text-anchor="middle"
        class="text-secondary"
        font-size="13">Enter the newsroom.</text>

  <!-- Double rule: masthead style (burgundy, 3px) -->
  <line x1="520" y1="220" x2="760" y2="220" stroke="{color.accent}" stroke-width="1"/>
  <line x1="520" y1="224" x2="760" y2="224" stroke="{color.accent}" stroke-width="1"/>

  <!-- Email field -->
  <text x="480" y="270"
        class="text-metadata"
        font-size="9"
        font-weight="600"
        letter-spacing="1.44">EMAIL ADDRESS</text>

  <line x1="480" y1="276" x2="800" y2="276" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <text x="480" y="298"
        class="text-primary"
        font-size="14">user@editorial.com</text>

  <!-- Password field -->
  <text x="480" y="340"
        class="text-metadata"
        font-size="9"
        font-weight="600"
        letter-spacing="1.44">PASSWORD</text>

  <text x="800" y="340"
        text-anchor="end"
        class="text-secondary"
        font-size="11">Forgot?</text>

  <line x1="480" y1="346" x2="800" y2="346" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <text x="480" y="368"
        class="text-primary"
        font-size="14"
        letter-spacing="2">••••••••</text>

  <!-- Sign in button (burgundy CTA) -->
  <line x1="480" y1="420" x2="800" y2="420" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <text x="800" y="452"
        text-anchor="end"
        class="text-accent"
        font-size="14"
        font-weight="700">Sign in →</text>

  <!-- Alternate action: sign up link -->
  <text x="640" y="540"
        text-anchor="middle"
        class="text-secondary"
        font-size="13">No account yet? <tspan class="text-accent" font-weight="700">Create one</tspan></text>
"""),

    # ═══════════════════ DASHBOARD (preserve existing signature layout) ═══════════════════
    # The canonical "dashboard" template is at the end of PATTERNS.
    # We preserve it as-is rather than regenerate it. But let's create a variant
    # (dashboard-narrow) for completeness — 1024×600 mobile-oriented version.

    "dashboard-narrow": (1024, 600, """
  <rect x="0" y="0" width="1024" height="600" fill="{color.surface}"/>

  <!-- Sidebar: 240px (narrower for mobile) -->
  <!-- Brand -->
  <text x="16" y="40"
        class="text-display"
        font-size="20"
        font-weight="700"
        letter-spacing="-0.4">Editorial</text>

  <text x="16" y="56"
        class="text-metadata-accent"
        font-size="9"
        font-weight="600"
        letter-spacing="1.44">VOL. I · NO. 04</text>

  <!-- Masthead rule -->
  <line x1="16" y1="72" x2="224" y2="72" stroke="{color.accent}" stroke-width="1"/>
  <line x1="16" y1="76" x2="224" y2="76" stroke="{color.accent}" stroke-width="1"/>

  <!-- Search -->
  <text x="16" y="100"
        class="text-muted"
        font-size="11"
        font-style="italic">Search…</text>
  <line x1="16" y1="108" x2="224" y2="108" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <!-- Recent Dispatches -->
  <text x="16" y="132"
        class="text-metadata"
        font-size="9"
        font-weight="600"
        letter-spacing="1.62">RECENT</text>

  <line x1="0" y1="144" x2="240" y2="144" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>

  <!-- Dispatch 01: Selected -->
  <rect x="0" y="144" width="240" height="72" fill="{color.surface_selected}"/>
  <text x="16" y="162"
        class="text-metadata"
        font-size="9"
        font-weight="600"
        letter-spacing="1.44">2M AGO</text>
  <text x="216" y="162"
        text-anchor="end"
        class="text-accent"
        font-size="11"
        font-weight="700">2 new</text>
  <text x="16" y="182"
        class="text-primary"
        font-size="13"
        font-weight="700">Tokyo Trip</text>
  <text x="16" y="202"
        class="text-secondary"
        font-size="11"
        font-style="italic">Plan a trip…</text>
  <line x1="0" y1="215" x2="240" y2="215" stroke="{extras.color.rule_hairline}" stroke-width="1"/>

  <!-- Dispatch 02 -->
  <text x="16" y="238"
        class="text-metadata"
        font-size="9"
        font-weight="600"
        letter-spacing="1.44">1H AGO</text>
  <text x="16" y="258"
        class="text-primary"
        font-size="13"
        font-weight="600">Recipe Ideas</text>
  <text x="16" y="278"
        class="text-secondary"
        font-size="11"
        font-style="italic">Ramen variations…</text>
  <line x1="0" y1="291" x2="240" y2="291" stroke="{extras.color.rule_hairline}" stroke-width="1"/>

  <!-- Byline footer -->
  <line x1="0" y1="552" x2="240" y2="552" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="16" y="568"
        class="text-metadata"
        font-size="9"
        font-weight="600"
        letter-spacing="1.44">YOUR VOICE</text>
  <text x="16" y="588"
        class="text-primary"
        font-size="12"
        font-weight="600">T. Harris</text>

  <!-- Divider between sidebar and main -->
  <line x1="240" y1="0" x2="240" y2="600" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <!-- Main area: masthead + conversation (simplified for narrow layout) -->
  <!-- Masthead -->
  <text x="272" y="36"
        class="text-metadata-accent"
        font-size="9"
        font-weight="700"
        letter-spacing="1.8">DISPATCH · TOKYO DESK</text>

  <text x="272" y="66"
        class="text-display"
        font-size="20"
        font-weight="700"
        letter-spacing="-0.4">Tokyo Trip</text>

  <text x="1000" y="66"
        text-anchor="end"
        class="text-metadata"
        font-size="9"
        font-weight="600"
        letter-spacing="1.26">FILED 14:23</text>

  <line x1="272" y1="82" x2="1000" y2="82" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>

  <!-- Message 01: User (right-aligned) -->
  <text x="272" y="116"
        class="text-metadata"
        font-size="9"
        font-weight="600"
        letter-spacing="1.44">YOU · 14:23</text>

  <line x1="480" y1="126" x2="480" y2="152" stroke="{color.accent}" stroke-width="2"/>

  <text x="498" y="144"
        class="text-primary"
        font-size="12"
        font-style="italic">Help plan a Tokyo trip?</text>

  <!-- Message 02: AI (with drop cap) -->
  <text x="272" y="188"
        class="text-metadata"
        font-size="9"
        font-weight="600"
        letter-spacing="1.44">EDITORIAL · 14:24</text>

  <text x="272" y="226"
        class="text-accent"
        font-size="40"
        font-weight="700">A</text>

  <text x="320" y="206"
        class="text-primary"
        font-size="12">bsolutely. Tokyo combines temples and food.</text>

  <text x="320" y="226"
        class="text-primary"
        font-size="12">I'll build you a perfect itinerary.</text>

  <!-- Composer -->
  <line x1="272" y1="552" x2="1000" y2="552" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <text x="272" y="580"
        class="text-muted"
        font-size="12"
        font-style="italic">Reply…</text>

  <text x="1000" y="580"
        text-anchor="end"
        class="text-metadata-accent"
        font-size="9"
        font-weight="700"
        letter-spacing="1.44">FILE →</text>
"""),

    # ═════ DASHBOARD — canonical example (formerly hand-authored layouts/dashboard.svg) ═════
    "dashboard": (1280, 800, """
  <!-- Editorial dashboard — desktop 1280×800
       grammar_family: contemporary_clean, elevation.strategy: paper_tiers
       Sidebar 280px + main 1000px on cream paper.
  -->

  <!-- Page background: cream paper -->
  <rect x="0" y="0" width="1280" height="800" fill="{color.page_bg}"/>

  <!-- ════════════════════════════════════════════════════════════
       SIDEBAR
       ════════════════════════════════════════════════════════════ -->

  <!-- Brand: serif title -->
  <text x="16" y="40"
        font-family="{font.body}"
        font-size="24"
        font-weight="700"
        fill="{color.text_primary}"
        letter-spacing="-0.48">Editorial</text>

  <!-- Volume/issue overline: tracked Inter uppercase, burgundy -->
  <text x="16" y="58"
        font-family="{font.label}"
        font-size="9"
        font-weight="600"
        fill="{color.accent}"
        letter-spacing="1.44">VOL. I · NO. 04 · APRIL</text>

  <!-- 3px double burgundy rule (masthead rule per grammar_extensions) -->
  <line x1="16" y1="76" x2="264" y2="76" stroke="{color.accent}" stroke-width="1"/>
  <line x1="16" y1="80" x2="264" y2="80" stroke="{color.accent}" stroke-width="1"/>

  <!-- Search input: Fraunces italic placeholder, 1px hairline rule below -->
  <text x="16" y="108"
        font-family="{font.body}"
        font-size="12"
        font-style="italic"
        font-weight="400"
        fill="{color.text_muted}">Search the archives…</text>
  <line x1="16" y1="116" x2="264" y2="116" stroke="{color.border_default}" stroke-width="1"/>

  <!-- Section header: tracked uppercase Inter -->
  <text x="16" y="140"
        font-family="{font.label}"
        font-size="9"
        font-weight="600"
        fill="{color.text_muted}"
        letter-spacing="1.62">RECENT DISPATCHES</text>

  <!-- Strong rule above first dispatch -->
  <line x1="0" y1="152" x2="280" y2="152" stroke="{color.border_strong}" stroke-width="1"/>

  <!-- ─── Dispatch 01: Tokyo Trip — SELECTED ────────────────────── -->
  <rect x="0" y="152" width="280" height="90" fill="{color.surface_selected}"/>
  <text x="16" y="174"
        font-family="{font.label}"
        font-size="9"
        font-weight="600"
        fill="{color.text_muted}"
        letter-spacing="1.44">2M AGO · DISPATCH</text>
  <text x="264" y="174"
        font-family="{font.body}"
        font-size="11"
        font-weight="700"
        fill="{color.accent}"
        text-anchor="end">2 new</text>
  <text x="16" y="198"
        font-family="{font.body}"
        font-size="15"
        font-weight="700"
        fill="{color.text_primary}"
        letter-spacing="-0.15">Tokyo Trip</text>
  <text x="16" y="218"
        font-family="{font.label}"
        font-size="11"
        font-style="italic"
        font-weight="400"
        fill="{color.text_secondary}">Want me to build a day-by-day itinerary?</text>
  <line x1="0" y1="241" x2="280" y2="241" stroke="{extras.color.rule_hairline}" stroke-width="1"/>

  <!-- ─── Dispatch 02: Recipe Ideas ──────────────────────────────── -->
  <text x="16" y="263"
        font-family="{font.label}"
        font-size="9"
        font-weight="600"
        fill="{color.text_muted}"
        letter-spacing="1.44">1H AGO · DISPATCH</text>
  <text x="16" y="287"
        font-family="{font.body}"
        font-size="15"
        font-weight="600"
        fill="{color.text_primary}"
        letter-spacing="-0.15">Recipe Ideas</text>
  <text x="16" y="307"
        font-family="{font.label}"
        font-size="11"
        font-style="italic"
        font-weight="400"
        fill="{color.text_secondary}">Here are 5 ramen variations you'll love…</text>
  <line x1="0" y1="330" x2="280" y2="330" stroke="{extras.color.rule_hairline}" stroke-width="1"/>

  <!-- ─── Dispatch 03: Book Club ─────────────────────────────────── -->
  <text x="16" y="352"
        font-family="{font.label}"
        font-size="9"
        font-weight="600"
        fill="{color.text_muted}"
        letter-spacing="1.44">3H AGO · DISPATCH</text>
  <text x="264" y="352"
        font-family="{font.body}"
        font-size="11"
        font-weight="700"
        fill="{color.accent}"
        text-anchor="end">1 new</text>
  <text x="16" y="376"
        font-family="{font.body}"
        font-size="15"
        font-weight="600"
        fill="{color.text_primary}"
        letter-spacing="-0.15">Book Club</text>
  <text x="16" y="396"
        font-family="{font.label}"
        font-size="11"
        font-style="italic"
        font-weight="400"
        fill="{color.text_secondary}">I'd recommend starting with Murakami's…</text>
  <line x1="0" y1="419" x2="280" y2="419" stroke="{extras.color.rule_hairline}" stroke-width="1"/>

  <!-- ─── Dispatch 04: Fitness Plan ──────────────────────────────── -->
  <text x="16" y="441"
        font-family="{font.label}"
        font-size="9"
        font-weight="600"
        fill="{color.text_muted}"
        letter-spacing="1.44">1D AGO · DISPATCH</text>
  <text x="16" y="465"
        font-family="{font.body}"
        font-size="15"
        font-weight="600"
        fill="{color.text_primary}"
        letter-spacing="-0.15">Fitness Plan</text>
  <text x="16" y="485"
        font-family="{font.label}"
        font-size="11"
        font-style="italic"
        font-weight="400"
        fill="{color.text_secondary}">Your 4-week progressive routine is ready.</text>
  <line x1="0" y1="508" x2="280" y2="508" stroke="{extras.color.rule_hairline}" stroke-width="1"/>

  <!-- ─── Dispatch 05: Code Review ───────────────────────────────── -->
  <text x="16" y="530"
        font-family="{font.label}"
        font-size="9"
        font-weight="600"
        fill="{color.text_muted}"
        letter-spacing="1.44">2D AGO · DISPATCH</text>
  <text x="16" y="554"
        font-family="{font.body}"
        font-size="15"
        font-weight="600"
        fill="{color.text_primary}"
        letter-spacing="-0.15">Code Review</text>
  <text x="16" y="574"
        font-family="{font.label}"
        font-size="11"
        font-style="italic"
        font-weight="400"
        fill="{color.text_secondary}">The auth middleware looks solid, but…</text>
  <line x1="0" y1="597" x2="280" y2="597" stroke="{extras.color.rule_hairline}" stroke-width="1"/>

  <!-- Byline footer: strong rule above, tracked metadata + serif name -->
  <line x1="0" y1="744" x2="280" y2="744" stroke="{color.border_strong}" stroke-width="1"/>
  <text x="16" y="764"
        font-family="{font.label}"
        font-size="9"
        font-weight="600"
        fill="{color.text_muted}"
        letter-spacing="1.44">YOUR BYLINE</text>
  <text x="16" y="784"
        font-family="{font.body}"
        font-size="13"
        font-weight="600"
        fill="{color.text_primary}">T. Harris</text>

  <!-- ════════════════════════════════════════════════════════════
       MAIN AREA
       ════════════════════════════════════════════════════════════ -->

  <!-- Masthead: dispatch overline + title + filing metadata
       Strong rule below per editorial-rules-not-boxes
  -->
  <text x="320" y="40"
        font-family="{font.label}"
        font-size="9"
        font-weight="700"
        fill="{color.accent}"
        letter-spacing="1.8">DISPATCH · TOKYO DESK</text>

  <text x="320" y="74"
        font-family="{font.body}"
        font-size="24"
        font-weight="700"
        fill="{color.text_primary}"
        letter-spacing="-0.48">Tokyo Trip</text>

  <text x="1264" y="74"
        font-family="{font.label}"
        font-size="9"
        font-weight="600"
        fill="{color.text_muted}"
        letter-spacing="1.26"
        text-anchor="end">FILED 14:23 · 4 EXCHANGES</text>

  <line x1="320" y1="92" x2="1264" y2="92" stroke="{color.border_strong}" stroke-width="1"/>

  <!-- ─── Messages ─────────────────────────────────────────────────
       AI left-aligned, max 86%, roman Fraunces.
       User right-aligned, max 68%, italic Fraunces with 2px burgundy left rule.
       First AI message gets a 54px Fraunces drop cap in burgundy.
  -->

  <!-- Message 01 — USER (right-aligned italic, 2px burgundy left rule) -->
  <text x="320" y="132"
        font-family="{font.label}"
        font-size="9"
        font-weight="600"
        fill="{color.text_muted}"
        letter-spacing="1.44">YOU · 14:23</text>
  <line x1="540" y1="142" x2="540" y2="172" stroke="{color.accent}" stroke-width="2"/>
  <text x="558" y="160"
        font-family="{font.body}"
        font-size="14"
        font-style="italic"
        font-weight="400"
        fill="{color.text_primary}">Hey, can you help me plan a trip to Tokyo?</text>

  <!-- Message 02 — AI (left-aligned, drop cap on first message) -->
  <text x="320" y="216"
        font-family="{font.label}"
        font-size="9"
        font-weight="600"
        fill="{color.text_muted}"
        letter-spacing="1.44">EDITORIAL · 14:24</text>

  <!-- DROP CAP per drop-cap-ceremony rule: 54px Fraunces 700 burgundy float-left -->
  <text x="320" y="276"
        font-family="{font.body}"
        font-size="54"
        font-weight="700"
        fill="{color.accent}">A</text>

  <!-- Body text wraps around drop cap for ~3 lines (drop cap reaches y~276) -->
  <text x="368" y="244"
        font-family="{font.body}"
        font-size="14"
        font-weight="400"
        fill="{color.text_primary}">bsolutely. Tokyo is incredible. Are you looking</text>
  <text x="368" y="266"
        font-family="{font.body}"
        font-size="14"
        font-weight="400"
        fill="{color.text_primary}">for a culture-focused trip, a food adventure,</text>
  <text x="368" y="288"
        font-family="{font.body}"
        font-size="14"
        font-weight="400"
        fill="{color.text_primary}">or a mix of everything?</text>

  <!-- Message 03 — USER -->
  <text x="320" y="352"
        font-family="{font.label}"
        font-size="9"
        font-weight="600"
        fill="{color.text_muted}"
        letter-spacing="1.44">YOU · 14:26</text>
  <line x1="500" y1="362" x2="500" y2="392" stroke="{color.accent}" stroke-width="2"/>
  <text x="518" y="380"
        font-family="{font.body}"
        font-size="14"
        font-style="italic"
        font-weight="400"
        fill="{color.text_primary}">Definitely a mix — temples in the morning, ramen at night.</text>

  <!-- Message 04 — AI (NO drop cap, only the first gets one) -->
  <text x="320" y="436"
        font-family="{font.label}"
        font-size="9"
        font-weight="600"
        fill="{color.text_muted}"
        letter-spacing="1.44">EDITORIAL · 14:27</text>
  <text x="320" y="464"
        font-family="{font.body}"
        font-size="14"
        font-weight="400"
        fill="{color.text_primary}">Perfect combination. I'd suggest starting in Asakusa for Senso-ji at sunrise,</text>
  <text x="320" y="486"
        font-family="{font.body}"
        font-size="14"
        font-weight="400"
        fill="{color.text_primary}">then heading to Shibuya for the evening food scene. Want me to build</text>
  <text x="320" y="508"
        font-family="{font.body}"
        font-size="14"
        font-weight="400"
        fill="{color.text_primary}">a day-by-day itinerary?</text>

  <!-- Composer: hairline above, italic Fraunces input, "Reply →" in burgundy uppercase Inter -->
  <line x1="320" y1="704" x2="1264" y2="704" stroke="{color.border_default}" stroke-width="1"/>
  <text x="320" y="744"
        font-family="{font.body}"
        font-size="14"
        font-style="italic"
        font-weight="400"
        fill="{color.text_muted}">Compose a reply…</text>
  <text x="1264" y="744"
        font-family="{font.label}"
        font-size="9"
        font-weight="700"
        fill="{color.accent}"
        letter-spacing="1.44"
        text-anchor="end">FILE REPLY →</text>

  <!-- Strong sidebar/main divider drawn last -->
  <line x1="280" y1="0" x2="280" y2="800" stroke="{color.border_default}" stroke-width="1"/>
"""),

}
