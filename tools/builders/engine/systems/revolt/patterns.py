"""
Revolt pattern templates (Tier 3 layout-level components).

Revolt's distinctive grammar at the pattern level:
  - Hard offset shadows (4px 4px 0 #111) on every elevated element
  - 2px default borders, 3px on major dividers (sidebar/main split, brand bar, header bar)
  - Space Mono uppercase throughout, generous tracking
  - Pink/lime pairing: pink for headers, user messages, unread badges, selected avatars;
    lime for brand bar, selected state, send button
  - Two-letter uppercase abbreviation avatars (no emoji)
  - Signature Y2K aesthetic: hard edges, monospace, code-comment-style timestamps

Three patterns per LIBRARY-SPEC (target for Revolt):
  - dashboard: 1280×800, sidebar + header + message composer (already authored)
  - auth: 1280×800, centered login form with brand, bordered input fields
  - banner: 1280×400, full-width promotional band with hard shadow + lime CTA

Rendered by tools/builders/build.py into systems/revolt/layouts/.
Colours, fonts, radii and border widths are {token.path} placeholders
resolved from systems/revolt/tokens.json, which is authoritative;
values quoted above describe the grammar and may lag the token file.
"""

PATTERNS = {

    # ═══════════════════ AUTH (SIGN-IN) ═══════════════════
    # Revolt auth: centered narrowform on white, pink brand at top, bordered
    # input fields, Space Mono uppercase labels, lime Send button with hard shadow

    "auth-sign-in": (1280, 800, """
  <rect x="0" y="0" width="1280" height="800" fill="{color.page_bg}"/>

  <!-- Centered form card: 360px wide, white with 2px border and 4px hard shadow -->
  <rect x="464" y="82" width="352" height="556" fill="{extras.color.shadow}"/>
  <rect x="460" y="78" width="352" height="556" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <!-- Pink brand section at top of form -->
  <rect x="460" y="78" width="352" height="60" fill="{color.accent}"/>
  <text x="636" y="117" text-anchor="middle" class="text-inverse" font-size="14" font-weight="700" letter-spacing="1.12">REVOLT.chat</text>

  <!-- Divider below brand -->
  <line x1="460" y1="138" x2="812" y2="138" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <!-- Email field -->
  <text x="480" y="170" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.8">EMAIL ADDRESS</text>
  <rect x="480" y="176" width="312" height="32" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
  <text x="490" y="198" class="text-muted" font-size="10">your@email.com</text>

  <!-- Divider -->
  <line x1="480" y1="226" x2="792" y2="226" stroke="{color.text_muted}" stroke-width="1"/>

  <!-- Password field -->
  <text x="480" y="254" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.8">PASSWORD</text>
  <rect x="480" y="260" width="312" height="32" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
  <text x="490" y="282" class="text-primary" font-size="10" letter-spacing="1.5">••••••••</text>

  <!-- Divider -->
  <line x1="480" y1="310" x2="792" y2="310" stroke="{color.text_muted}" stroke-width="1"/>

  <!-- Sign in button — lime with 4px hard shadow -->
  <rect x="484" y="342" width="304" height="48" fill="{extras.color.shadow}"/>
  <rect x="480" y="338" width="304" height="48" fill="{color.action}" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
  <text x="632" y="368" text-anchor="middle" class="text-primary" font-size="11" font-weight="700" letter-spacing="0.44">SIGN IN</text>

  <!-- Footer link: "Create account" -->
  <text x="636" y="520" text-anchor="middle" class="text-secondary" font-size="9">No account? <tspan fill="{color.text_primary}" font-weight="700">Create one</tspan></text>
"""),

    # ═══════════════════ BANNER (PROMOTIONAL) ═══════════════════
    # Full-width 1280×400. Promotional banner with lime/pink split layout,
    # centered content card with hard shadow, oversized headline, secondary text, lime CTA

    "banner-promotional": (1280, 400, """
  <rect x="0" y="0" width="1280" height="400" fill="{color.page_bg}"/>

  <!-- Left half: pink background -->
  <rect x="0" y="0" width="640" height="400" fill="{color.accent}"/>

  <!-- Right half: lime background -->
  <rect x="640" y="0" width="640" height="400" fill="{color.action}"/>

  <!-- Centered content card with hard shadow -->
  <rect x="242" y="82" width="796" height="236" fill="{extras.color.shadow}"/>
  <rect x="240" y="80" width="796" height="236" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <!-- Headline (26px, generous tracking, uppercase) -->
  <text x="260" y="130" class="text-primary" font-size="20" font-weight="700" letter-spacing="0.8">Y2K VIBES</text>
  <text x="260" y="156" class="text-primary" font-size="20" font-weight="700" letter-spacing="0.8">UNLEASHED</text>

  <!-- Secondary text (11px, grey) -->
  <text x="260" y="188" class="text-secondary" font-size="10">Meet Revolt, the neobrutalist chat interface</text>
  <text x="260" y="206" class="text-secondary" font-size="10">built for the modern internet.</text>

  <!-- CTA button — lime with 4px shadow on right -->
  <rect x="762" y="224" width="104" height="44" fill="{extras.color.shadow}"/>
  <rect x="760" y="222" width="104" height="44" fill="{color.action}" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
  <text x="812" y="250" text-anchor="middle" class="text-primary" font-size="10" font-weight="700" letter-spacing="0.4">EXPLORE ></text>
"""),

    # ═════ DASHBOARD — signature layout (formerly hand-authored layouts/dashboard.svg) ═════
    "dashboard": (1280, 800, """
  <!-- Revolt dashboard — desktop 1280×800
       grammar_family: contemporary_clean, elevation.strategy: hard_offset
       3px borders on major dividers, 2px on components, 4px hard shadows.
  -->

  <rect x="0" y="0" width="1280" height="800" fill="{color.page_bg}"/>

  <!-- ════════════ SIDEBAR ════════════ -->

  <!-- Lime brand bar with 3px black bottom border -->
  <rect x="0" y="0" width="280" height="48" fill="{color.action}"/>
  <text x="14" y="30"
        font-family="{font.body}"
        font-size="14"
        font-weight="700"
        fill="{color.text_primary}"
        letter-spacing="1.12">REVOLT.chat</text>
  <line x1="0" y1="46.5" x2="280" y2="46.5" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>

  <!-- Search: 2px border integrated input -->
  <rect x="10" y="60" width="260" height="32" fill="{color.surface}" stroke="{color.border_input}" stroke-width="2"/>
  <text x="20" y="81"
        font-family="{font.body}"
        font-size="10"
        font-weight="700"
        fill="{color.text_secondary}"
        letter-spacing="0.5">FIND...</text>

  <!-- ─── List items ──────────────────── -->

  <!-- Tokyo Trip SELECTED: lime fill, 2px border, 4px hard shadow, pink avatar swap -->
  <rect x="12" y="108" width="252" height="50" fill="{extras.color.shadow}"/>
  <rect x="8" y="104" width="252" height="50" fill="{color.surface_selected}" stroke="{color.border_default}" stroke-width="2"/>
  <rect x="22" y="113" width="30" height="30" fill="{color.accent}" stroke="{color.border_default}" stroke-width="2"/>
  <text x="37" y="134" font-family="{font.body}" font-size="11" font-weight="700" fill="{color.text_inverse}" text-anchor="middle">TT</text>
  <text x="62" y="125" font-family="{font.body}" font-size="11" font-weight="700" fill="{color.text_primary}" letter-spacing="0.44">TOKYO TRIP</text>
  <text x="252" y="125" font-family="{font.body}" font-size="9" font-weight="700" fill="{color.text_primary}" text-anchor="end">2M</text>
  <text x="62" y="142" font-family="{font.body}" font-size="10" fill="{color.text_primary}">build itinerary?</text>
  <!-- Pink unread badge with 2px border -->
  <rect x="220" y="135" width="24" height="14" fill="{color.accent}" stroke="{color.border_default}" stroke-width="2"/>
  <text x="232" y="146" font-family="{font.body}" font-size="9" font-weight="700" fill="{color.text_inverse}" text-anchor="middle">2</text>

  <!-- Recipe Ideas (default) -->
  <rect x="22" y="188" width="30" height="30" fill="{color.surface}" stroke="{color.border_default}" stroke-width="2"/>
  <text x="37" y="209" font-family="{font.body}" font-size="11" font-weight="700" fill="{color.text_primary}" text-anchor="middle">RI</text>
  <text x="62" y="200" font-family="{font.body}" font-size="11" font-weight="700" fill="{color.text_primary}" letter-spacing="0.44">RECIPE IDEAS</text>
  <text x="266" y="200" font-family="{font.body}" font-size="9" font-weight="700" fill="{color.text_muted}" text-anchor="end">1H</text>
  <text x="62" y="217" font-family="{font.body}" font-size="10" fill="{color.text_secondary}">here are 5 ramen variations you'll love...</text>

  <!-- Book Club -->
  <rect x="22" y="252" width="30" height="30" fill="{color.surface}" stroke="{color.border_default}" stroke-width="2"/>
  <text x="37" y="273" font-family="{font.body}" font-size="11" font-weight="700" fill="{color.text_primary}" text-anchor="middle">BC</text>
  <text x="62" y="264" font-family="{font.body}" font-size="11" font-weight="700" fill="{color.text_primary}" letter-spacing="0.44">BOOK CLUB</text>
  <text x="266" y="264" font-family="{font.body}" font-size="9" font-weight="700" fill="{color.text_muted}" text-anchor="end">3H</text>
  <text x="62" y="281" font-family="{font.body}" font-size="10" fill="{color.text_secondary}">start with murakami…</text>
  <rect x="220" y="259" width="24" height="14" fill="{color.accent}" stroke="{color.border_default}" stroke-width="2"/>
  <text x="232" y="270" font-family="{font.body}" font-size="9" font-weight="700" fill="{color.text_inverse}" text-anchor="middle">1</text>

  <!-- Fitness Plan -->
  <rect x="22" y="316" width="30" height="30" fill="{color.surface}" stroke="{color.border_default}" stroke-width="2"/>
  <text x="37" y="337" font-family="{font.body}" font-size="11" font-weight="700" fill="{color.text_primary}" text-anchor="middle">MT</text>
  <text x="62" y="328" font-family="{font.body}" font-size="11" font-weight="700" fill="{color.text_primary}" letter-spacing="0.44">FITNESS PLAN</text>
  <text x="266" y="328" font-family="{font.body}" font-size="9" font-weight="700" fill="{color.text_muted}" text-anchor="end">1D</text>
  <text x="62" y="345" font-family="{font.body}" font-size="10" fill="{color.text_secondary}">your 4-week progressive routine is ready.</text>

  <!-- Code Review -->
  <rect x="22" y="380" width="30" height="30" fill="{color.surface}" stroke="{color.border_default}" stroke-width="2"/>
  <text x="37" y="401" font-family="{font.body}" font-size="11" font-weight="700" fill="{color.text_primary}" text-anchor="middle">CR</text>
  <text x="62" y="392" font-family="{font.body}" font-size="11" font-weight="700" fill="{color.text_primary}" letter-spacing="0.44">CODE REVIEW</text>
  <text x="266" y="392" font-family="{font.body}" font-size="9" font-weight="700" fill="{color.text_muted}" text-anchor="end">2D</text>
  <text x="62" y="409" font-family="{font.body}" font-size="10" fill="{color.text_secondary}">the auth middleware looks solid, but...</text>

  <!-- Account footer with 3px black top border -->
  <line x1="0" y1="744" x2="280" y2="744" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <rect x="14" y="754" width="26" height="26" fill="{color.surface_selected}" stroke="{color.border_default}" stroke-width="2"/>
  <text x="27" y="772" font-family="{font.body}" font-size="10" font-weight="900" fill="{color.text_primary}" text-anchor="middle">U</text>
  <text x="50" y="773" font-family="{font.body}" font-size="10" font-weight="700" fill="{color.text_primary}" letter-spacing="0.5">USER_01</text>

  <!-- ════════════ MAIN AREA ════════════ -->

  <!-- Pink header bar with 3px black bottom border -->
  <rect x="280" y="0" width="1000" height="48" fill="{color.accent}"/>
  <text x="314" y="30" font-family="{font.body}" font-size="14" font-weight="700">TT</text>
  <text x="344" y="30"
        font-family="{font.body}"
        font-size="12"
        font-weight="700"
        fill="{color.text_inverse}"
        letter-spacing="0.72">TOKYO TRIP</text>
  <!-- LIVE pill — bordered white rectangle in pink header -->
  <rect x="1224" y="14" width="44" height="20" fill="{color.accent}" stroke="{color.text_inverse}" stroke-width="2"/>
  <text x="1246" y="28" font-family="{font.body}" font-size="9" font-weight="700" fill="{color.text_inverse}" text-anchor="end">LIVE</text>
  <line x1="280" y1="46.5" x2="1280" y2="46.5" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>

  <!-- ─── Messages: rectangles with 2px border + 4px hard shadow ─── -->

  <!-- Message 01 — USER (pink fill, right-aligned) -->
  <rect x="824" y="100" width="436" height="44" fill="{extras.color.shadow}"/>
  <rect x="820" y="96" width="436" height="44" fill="{color.accent}" stroke="{color.border_default}" stroke-width="2"/>
  <text x="836" y="123" font-family="{font.body}" font-size="11.5" fill="{color.text_inverse}">Hey, can you help me plan a trip to Tokyo?</text>
  <text x="1256" y="156" font-family="{font.body}" font-size="8" font-weight="700" fill="{color.text_muted}" letter-spacing="0.8" text-anchor="end">YOU // 00:1</text>

  <!-- Message 02 — AI (white fill, left-aligned) -->
  <rect x="324" y="184" width="640" height="64" fill="{extras.color.shadow}"/>
  <rect x="320" y="180" width="640" height="64" fill="{color.surface}" stroke="{color.border_default}" stroke-width="2"/>
  <text x="336" y="207" font-family="{font.body}" font-size="11.5" fill="{color.text_primary}">Absolutely! Tokyo is incredible. Are you looking for a culture-focused trip,</text>
  <text x="336" y="231" font-family="{font.body}" font-size="11.5" fill="{color.text_primary}">food adventure, or a mix of everything?</text>
  <text x="320" y="260" font-family="{font.body}" font-size="8" font-weight="700" fill="{color.text_muted}" letter-spacing="0.8">BOT // 00:2</text>

  <!-- Message 03 — USER -->
  <rect x="864" y="284" width="396" height="44" fill="{extras.color.shadow}"/>
  <rect x="860" y="280" width="396" height="44" fill="{color.accent}" stroke="{color.border_default}" stroke-width="2"/>
  <text x="876" y="307" font-family="{font.body}" font-size="11.5" fill="{color.text_inverse}">Definitely a mix — temples in the morning, ramen at night.</text>
  <text x="1256" y="340" font-family="{font.body}" font-size="8" font-weight="700" fill="{color.text_muted}" letter-spacing="0.8" text-anchor="end">YOU // 00:3</text>

  <!-- Message 04 — AI -->
  <rect x="324" y="368" width="700" height="84" fill="{extras.color.shadow}"/>
  <rect x="320" y="364" width="700" height="84" fill="{color.surface}" stroke="{color.border_default}" stroke-width="2"/>
  <text x="336" y="391" font-family="{font.body}" font-size="11.5" fill="{color.text_primary}">Perfect combo. I'd suggest starting in Asakusa for Senso-ji, then heading to</text>
  <text x="336" y="415" font-family="{font.body}" font-size="11.5" fill="{color.text_primary}">Shibuya for the evening food scene. Want me to build a day-by-day</text>
  <text x="336" y="439" font-family="{font.body}" font-size="11.5" fill="{color.text_primary}">itinerary?</text>
  <text x="320" y="464" font-family="{font.body}" font-size="8" font-weight="700" fill="{color.text_muted}" letter-spacing="0.8">BOT // 00:4</text>

  <!-- Composer: integrated input with lime send button on right, 3px top border -->
  <line x1="280" y1="704" x2="1280" y2="704" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <rect x="320" y="724" width="900" height="44" fill="{color.surface}" stroke="{color.border_default}" stroke-width="2"/>
  <text x="334" y="752"
        font-family="{font.body}"
        font-size="11"
        font-weight="700"
        fill="{color.text_secondary}"
        letter-spacing="0.44">SAY SOMETHING...</text>
  <!-- Lime send button integrated on right, separated by 2px black -->
  <rect x="1218" y="724" width="44" height="44" fill="{color.action}"/>
  <line x1="1219" y1="724" x2="1219" y2="768" stroke="{color.border_default}" stroke-width="2"/>
  <text x="1240" y="754" font-family="{font.body}" font-size="20" font-weight="900" fill="{color.text_primary}" text-anchor="middle">→</text>

  <!-- Sidebar/main divider 3px solid black -->
  <line x1="280" y1="0" x2="280" y2="800" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
"""),

}
