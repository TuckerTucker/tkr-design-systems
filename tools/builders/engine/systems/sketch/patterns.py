"""
Sketch pattern templates (Tier 3 layouts).

Sketch patterns are full-region compositions showing the system's opinions
about major layout structures: dashboard, form, settings, auth. Each uses
Sketch's warm beige, purple Caveat annotations, and rounded-square avatars.

Coverage scope:
  Patterns: dashboard (already authored, preserved), form, settings_layout,
            auth (sign_in)

Rendered by tools/builders/build.py into systems/sketch/layouts/.
Colours, fonts, radii and border widths are {token.path} placeholders
resolved from systems/sketch/tokens.json, which is authoritative;
values quoted above describe the grammar and may lag the token file.
"""

PATTERNS = {

    # ═══════════════════ FORM ═══════════════════
    # Single-column form: labels above inputs, rounded fields, submit/cancel.
    "form-single-column": (640, 640, """
  <rect x="0" y="0" width="640" height="640" fill="{color.page_bg}"/>

  <!-- Page title -->
  <text x="32" y="40" class="text-primary" font-size="22" font-weight="700" letter-spacing="-0.02em">Create Account</text>
  <text x="32" y="60" class="text-muted" font-size="13" letter-spacing="-0.02em">Join our community today.</text>

  <line x1="32" y1="80" x2="608" y2="80" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <!-- Field 1: Full Name -->
  <text x="32" y="120" class="text-secondary" font-size="12" font-weight="600" letter-spacing="-0.02em">Full Name</text>
  <rect x="32" y="132" width="576" height="40" fill="{color.surface_elevated}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.input}" ry="{radius.input}"/>
  <text x="44" y="158" class="text-muted" font-size="14" letter-spacing="-0.02em">Alex Rivera</text>

  <!-- Field 2: Email -->
  <text x="32" y="200" class="text-secondary" font-size="12" font-weight="600" letter-spacing="-0.02em">Email Address</text>
  <rect x="32" y="212" width="576" height="40" fill="{color.surface_elevated}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.input}" ry="{radius.input}"/>
  <text x="44" y="238" class="text-muted" font-size="14" letter-spacing="-0.02em">alex@example.com</text>

  <!-- Field 3: Password -->
  <text x="32" y="280" class="text-secondary" font-size="12" font-weight="600" letter-spacing="-0.02em">Password</text>
  <rect x="32" y="292" width="576" height="40" fill="{color.surface_elevated}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.input}" ry="{radius.input}"/>
  <text x="44" y="318" class="text-primary" font-size="14" letter-spacing="2">••••••••</text>

  <!-- Field 4: Bio (textarea) -->
  <text x="32" y="360" class="text-secondary" font-size="12" font-weight="600" letter-spacing="-0.02em">Bio</text>
  <rect x="32" y="372" width="576" height="100" fill="{color.surface_elevated}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.input}" ry="{radius.input}"/>
  <text x="44" y="400" class="text-muted" font-size="14" letter-spacing="-0.02em">Tell us about yourself...</text>

  <line x1="32" y1="520" x2="608" y2="520" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <!-- Actions -->
  <text x="32" y="560" class="text-secondary" font-size="13" letter-spacing="-0.02em" font-weight="600">Cancel</text>
  <rect x="520" y="540" width="88" height="40" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.input}" ry="{radius.input}"/>
  <text x="564" y="565" text-anchor="middle" class="text-primary" font-size="14" font-weight="600" letter-spacing="-0.02em">Sign up</text>
"""),

    # ═══════════════════ SETTINGS_LAYOUT ═══════════════════
    # Sidebar nav + content panel. Settings items in sidebar, form fields in main.
    "settings-layout": (1280, 800, """
  <rect x="0" y="0" width="1280" height="800" fill="{color.page_bg}"/>

  <!-- ════════════ SIDEBAR ════════════ -->
  <line x1="280" y1="0" x2="280" y2="800" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <!-- Brand -->
  <text x="16" y="32" class="text-primary" font-size="15" font-weight="600" letter-spacing="-0.02em">Sketch</text>
  <line x1="0" y1="48" x2="280" y2="48" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <!-- Settings nav -->
  <text x="16" y="80" class="text-secondary" font-size="11" font-weight="600" letter-spacing="-0.02em">ACCOUNT</text>

  <!-- 01 Profile (selected) -->
  <rect x="6" y="96" width="268" height="48" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.default}" ry="{radius.default}"/>
  <text x="20" y="124" class="text-primary" font-size="13" font-weight="700" letter-spacing="-0.02em">Profile</text>

  <!-- 02 Preferences -->
  <text x="16" y="172" class="text-secondary" font-size="13" letter-spacing="-0.02em" font-weight="600">Preferences</text>

  <!-- 03 Privacy -->
  <text x="16" y="220" class="text-secondary" font-size="13" letter-spacing="-0.02em" font-weight="600">Privacy</text>

  <!-- 04 Notifications -->
  <text x="16" y="268" class="text-secondary" font-size="13" letter-spacing="-0.02em" font-weight="600">Notifications</text>

  <!-- 05 Security -->
  <text x="16" y="316" class="text-secondary" font-size="13" letter-spacing="-0.02em" font-weight="600">Security</text>

  <!-- ════════════ CONTENT PANEL ════════════ -->

  <!-- Section header -->
  <text x="320" y="40" class="text-secondary" font-size="11" font-weight="600" letter-spacing="-0.02em">SETTINGS</text>
  <text x="320" y="76" class="text-primary" font-size="22" font-weight="700" letter-spacing="-0.02em">Profile</text>
  <text x="320" y="100" class="text-muted" font-size="13" letter-spacing="-0.02em">Manage your account information.</text>
  <line x1="320" y1="120" x2="1248" y2="120" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <!-- Field 1: Display Name -->
  <text x="320" y="160" class="text-secondary" font-size="12" font-weight="600" letter-spacing="-0.02em">Display Name</text>
  <rect x="320" y="172" width="576" height="40" fill="{color.surface_elevated}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.input}" ry="{radius.input}"/>
  <text x="332" y="198" class="text-primary" font-size="14" letter-spacing="-0.02em">Alex Rivera</text>

  <line x1="320" y1="240" x2="1248" y2="240" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <!-- Field 2: Email -->
  <text x="320" y="280" class="text-secondary" font-size="12" font-weight="600" letter-spacing="-0.02em">Email Address</text>
  <text x="320" y="300" class="text-muted" font-size="11" letter-spacing="-0.02em">Used for account access and recovery.</text>
  <rect x="320" y="312" width="576" height="40" fill="{color.surface_elevated}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.input}" ry="{radius.input}"/>
  <text x="332" y="338" class="text-primary" font-size="14" letter-spacing="-0.02em">alex@example.com</text>

  <line x1="320" y1="380" x2="1248" y2="380" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <!-- Field 3: Time zone -->
  <text x="320" y="420" class="text-secondary" font-size="12" font-weight="600" letter-spacing="-0.02em">Time Zone</text>
  <rect x="320" y="432" width="576" height="40" fill="{color.surface_elevated}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.input}" ry="{radius.input}"/>
  <text x="332" y="458" class="text-primary" font-size="14" letter-spacing="-0.02em">America/Los_Angeles</text>
  <g transform="rotate(-2, 888, 452)">
    <text x="888" y="458" text-anchor="end" font-family="{extras.font.annotation}" font-size="14" font-weight="700" fill="{color.text_muted}">↓</text>
  </g>

  <line x1="320" y1="500" x2="1248" y2="500" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <!-- Save button -->
  <rect x="1160" y="530" width="88" height="40" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.input}" ry="{radius.input}"/>
  <text x="1204" y="555" text-anchor="middle" class="text-primary" font-size="14" font-weight="600" letter-spacing="-0.02em">Save</text>
"""),

    # ═══════════════════ AUTH SIGN-IN ═══════════════════
    # Centered narrow form on warm-surface card.
    "auth-sign-in": (1280, 800, """
  <rect x="0" y="0" width="1280" height="800" fill="{color.page_bg}"/>

  <!-- Centered card: 320px wide, rounded radius.chrome -->
  <rect x="480" y="200" width="320" height="400" fill="{color.surface_elevated}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.chrome}" ry="{radius.chrome}"/>

  <!-- Card title and subtitle -->
  <text x="640" y="250" text-anchor="middle" class="text-primary" font-size="22" font-weight="700" letter-spacing="-0.02em">Sign In</text>
  <text x="640" y="270" text-anchor="middle" class="text-muted" font-size="13" letter-spacing="-0.02em">Welcome back to Sketch.</text>

  <!-- Email field -->
  <text x="496" y="310" class="text-secondary" font-size="12" font-weight="600" letter-spacing="-0.02em">Email</text>
  <rect x="496" y="322" width="288" height="40" fill="{extras.color.surface_subtle}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.input}" ry="{radius.input}"/>
  <text x="508" y="348" class="text-muted" font-size="14" letter-spacing="-0.02em">your@email.com</text>

  <!-- Password field -->
  <text x="496" y="390" class="text-secondary" font-size="12" font-weight="600" letter-spacing="-0.02em">Password</text>
  <text x="784" y="390" text-anchor="end" class="text-secondary" font-size="11" letter-spacing="-0.02em" font-weight="600">Forgot?</text>
  <rect x="496" y="402" width="288" height="40" fill="{extras.color.surface_subtle}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.input}" ry="{radius.input}"/>
  <text x="508" y="428" class="text-primary" font-size="14" letter-spacing="2">••••••••</text>

  <!-- Sign in button -->
  <rect x="496" y="470" width="288" height="40" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.input}" ry="{radius.input}"/>
  <text x="640" y="495" text-anchor="middle" class="text-primary" font-size="14" font-weight="600" letter-spacing="-0.02em">Sign In</text>

  <!-- Alternate action -->
  <text x="640" y="545" text-anchor="middle" class="text-muted" font-size="13" letter-spacing="-0.02em">No account? <tspan class="text-primary" font-weight="600">Create one</tspan></text>
"""),

    # ═══════════════════ DASHBOARD ═══════════════════
    # Preserved from signature file — updated reference only.
    # Shows sidebar + main content area with messages and suggestion chips.
    "dashboard": (1280, 800, """
  <rect x="0" y="0" width="1280" height="800" fill="{color.page_bg}"/>

  <!-- ════════════ SIDEBAR ════════════ -->

  <!-- Brand: structural + Caveat annotation rotated -->
  <text x="14" y="30"
        font-family="{font.body}"
        font-size="15"
        font-weight="600"
        fill="{color.text_primary}"
        letter-spacing="-0.3">Sketch</text>
  <g transform="rotate(-3, 80, 30)">
    <text x="80" y="30"
          font-family="{extras.font.annotation}"
          font-size="14"
          font-weight="700"
          fill="{color.accent}">AI</text>
  </g>

  <!-- Search input: rounded rect with border -->
  <rect x="14" y="48" width="252" height="32" fill="{color.page_bg}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.input}" ry="{radius.input}"/>
  <text x="26" y="68"
        font-family="{font.body}"
        font-size="12"
        font-weight="400"
        fill="{extras.color.icon_muted}">Search...</text>

  <!-- Caveat section header rotated -->
  <g transform="rotate(-1.5, 14, 100)">
    <text x="14" y="100"
          font-family="{extras.font.annotation}"
          font-size="13"
          font-weight="700"
          fill="{extras.color.accent_light}">your chats</text>
  </g>

  <!-- ─── Selected list item (Tokyo Trip) ─── -->
  <rect x="6" y="116" width="268" height="56" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.default}" ry="{radius.default}"/>
  <rect x="20" y="125" width="34" height="34" fill="{color.page_bg}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{extras.radius.avatar}" ry="{extras.radius.avatar}"/>
  <text x="37" y="148" font-family="{font.body}" font-size="14" font-weight="600" text-anchor="middle">T</text>
  <text x="64" y="139" font-family="{font.body}" font-size="12.5" font-weight="600" fill="{color.text_primary}">Tokyo Trip</text>
  <text x="260" y="139" font-family="{font.body}" font-size="10" fill="{color.text_placeholder}" text-anchor="end">2m</text>
  <text x="64" y="156" font-family="{font.body}" font-size="11" fill="{color.text_muted}">Build itinerary?</text>
  <rect x="238" y="148" width="18" height="18" fill="{color.accent}" rx="{extras.radius.badge}" ry="{extras.radius.badge}"/>
  <text x="247" y="161" font-family="{font.body}" font-size="9" font-weight="700" fill="{color.accent_foreground}" text-anchor="middle">2</text>

  <!-- ─── Recipe Ideas ─── -->
  <rect x="14" y="190" width="34" height="34" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{extras.radius.avatar}" ry="{extras.radius.avatar}"/>
  <text x="31" y="213" font-family="{font.body}" font-size="14" font-weight="600" text-anchor="middle">R</text>
  <text x="58" y="204" font-family="{font.body}" font-size="12.5" font-weight="600" fill="{color.text_primary}">Recipe Ideas</text>
  <text x="266" y="204" font-family="{font.body}" font-size="10" fill="{color.text_placeholder}" text-anchor="end">1h</text>
  <text x="58" y="221" font-family="{font.body}" font-size="11" fill="{color.text_muted}">Here are 5 ramen variations…</text>

  <!-- ─── Book Club ─── -->
  <rect x="14" y="252" width="34" height="34" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{extras.radius.avatar}" ry="{extras.radius.avatar}"/>
  <text x="31" y="275" font-family="{font.body}" font-size="14" font-weight="600" text-anchor="middle">B</text>
  <text x="58" y="266" font-family="{font.body}" font-size="12.5" font-weight="600" fill="{color.text_primary}">Book Club</text>
  <text x="266" y="266" font-family="{font.body}" font-size="10" fill="{color.text_placeholder}" text-anchor="end">3h</text>
  <text x="58" y="283" font-family="{font.body}" font-size="11" fill="{color.text_muted}">Start with Murakami…</text>
  <rect x="244" y="275" width="18" height="18" fill="{color.accent}" rx="{extras.radius.badge}" ry="{extras.radius.badge}"/>
  <text x="253" y="288" font-family="{font.body}" font-size="9" font-weight="700" fill="{color.accent_foreground}" text-anchor="middle">1</text>

  <!-- Account footer -->
  <line x1="0" y1="744" x2="280" y2="744" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
  <rect x="14" y="754" width="28" height="28" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{extras.radius.avatar_small}" ry="{extras.radius.avatar_small}"/>
  <text x="28" y="773" font-family="{font.body}" font-size="11" fill="{color.text_muted}" text-anchor="middle">Y</text>
  <text x="50" y="773" font-family="{font.body}" font-size="11.5" font-weight="500" fill="{color.text_secondary}">Your account</text>

  <!-- ════════════ MAIN AREA ════════════ -->

  <!-- Header: monogram + title + Caveat 'active' annotation -->
  <rect x="320" y="12" width="32" height="32" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{extras.radius.avatar}" ry="{extras.radius.avatar}"/>
  <text x="336" y="32" text-anchor="middle" font-family="{font.body}" font-size="13" font-weight="600" fill="{color.text_primary}">T</text>
  <text x="368" y="32" font-family="{font.body}" font-size="13.5" font-weight="600" fill="{color.text_primary}">Tokyo Trip</text>
  <g transform="rotate(-2, 1240, 32)">
    <text x="1240" y="32" font-family="{extras.font.annotation}" font-size="13" font-weight="700" fill="{color.accent}" text-anchor="end">active</text>
  </g>
  <line x1="320" y1="52" x2="1264" y2="52" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <!-- Message 01 — USER (right-aligned, dark bubble) -->
  <rect x="780" y="80" width="484" height="40" fill="{color.text_primary}" rx="{extras.radius.message}" ry="{extras.radius.message}"/>
  <text x="800" y="105" font-family="{font.body}" font-size="13" fill="{color.text_inverse}">Hey, can you help me plan a trip?</text>

  <!-- Caveat annotation above AI message -->
  <g transform="rotate(-1.5, 320, 158)">
    <text x="320" y="158" font-family="{extras.font.annotation}" font-size="13" font-weight="700" fill="{color.accent}">ooh fun one!</text>
  </g>

  <!-- Message 02 — AI (left-aligned, warm bubble with border) -->
  <rect x="320" y="170" width="640" height="60" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{extras.radius.message}" ry="{extras.radius.message}"/>
  <text x="340" y="195" font-family="{font.body}" font-size="13" fill="{color.text_primary}">Absolutely! Tokyo is incredible. What kind of</text>
  <text x="340" y="215" font-family="{font.body}" font-size="13" fill="{color.text_primary}">experience are you looking for?</text>

  <!-- Message 03 — USER -->
  <rect x="836" y="260" width="428" height="40" fill="{color.text_primary}" rx="{extras.radius.message}" ry="{extras.radius.message}"/>
  <text x="856" y="285" font-family="{font.body}" font-size="13" fill="{color.text_inverse}">Mix of culture, temples, and great food.</text>

  <!-- Message 04 — AI -->
  <rect x="320" y="330" width="700" height="80" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{extras.radius.message}" ry="{extras.radius.message}"/>
  <text x="340" y="355" font-family="{font.body}" font-size="13" fill="{color.text_primary}">Perfect! I'd suggest starting in Asakusa, then heading</text>
  <text x="340" y="375" font-family="{font.body}" font-size="13" fill="{color.text_primary}">to Shibuya for the evening. Want me to build an</text>
  <text x="340" y="395" font-family="{font.body}" font-size="13" fill="{color.text_primary}">itinerary?</text>

  <!-- Caveat 'pick a vibe' above suggestion chips -->
  <g transform="rotate(-1, 320, 448)">
    <text x="320" y="448" font-family="{extras.font.annotation}" font-size="13" font-weight="700" fill="{extras.color.accent_light}">pick a vibe</text>
  </g>

  <!-- Suggestion chips: 2-column grid -->
  <rect x="320" y="460" width="240" height="40" fill="{extras.color.surface_subtle}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.input}" ry="{radius.input}"/>
  <text x="440" y="485" font-family="{font.body}" font-size="11.5" text-anchor="middle" fill="{color.text_secondary}">Temples</text>
  <rect x="568" y="460" width="240" height="40" fill="{extras.color.surface_subtle}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.input}" ry="{radius.input}"/>
  <text x="688" y="485" font-family="{font.body}" font-size="11.5" text-anchor="middle" fill="{color.text_secondary}">Ramen</text>
  <rect x="320" y="508" width="240" height="40" fill="{extras.color.surface_subtle}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.input}" ry="{radius.input}"/>
  <text x="440" y="533" font-family="{font.body}" font-size="11.5" text-anchor="middle" fill="{color.text_secondary}">Culture</text>
  <rect x="568" y="508" width="240" height="40" fill="{extras.color.surface_subtle}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.input}" ry="{radius.input}"/>
  <text x="688" y="533" font-family="{font.body}" font-size="11.5" text-anchor="middle" fill="{color.text_secondary}">Parks</text>

  <!-- Composer: rounded input + Caveat send label -->
  <line x1="320" y1="664" x2="1264" y2="664" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
  <rect x="320" y="684" width="944" height="40" fill="{color.surface_elevated}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.default}" ry="{radius.default}"/>
  <text x="338" y="709" font-family="{font.body}" font-size="13" fill="{extras.color.icon_muted}">Type here...</text>
  <g transform="rotate(-1.5, 1244, 700)">
    <text x="1244" y="709" font-family="{extras.font.annotation}" font-size="17" font-weight="700" fill="{color.accent}" text-anchor="end">go</text>
  </g>

  <line x1="280" y1="0" x2="280" y2="800" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
"""),

}
