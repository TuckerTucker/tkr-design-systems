"""
Swiss pattern templates (Tier 3 layout-level components).

Swiss's distinctive grammar at the pattern level:
  - Strict 8-grid spacing
  - Numerical hierarchy (zero-padded counts, display-type metrics)
  - Single saturated red used in 4 categories per screen (CTAs, selection,
    user/identity tags, status dots)
  - Rules at 3 weights, never shadows
  - Tracked uppercase metadata
  - 280px fixed sidebar

dashboard (chat dashboard variant): template at the end of PATTERNS
Adding here: settings_layout, form, data_table, auth (sign_in)
Deferred: header (no strong Swiss opinion), modal/drawer (use defaults),
          empty_state (defaults are fine), command_palette/article (not Swiss-native)

Rendered by tools/builders/build.py into systems/swiss/layouts/.
Colours, fonts, radii and border widths are {token.path} placeholders
resolved from systems/swiss/tokens.json, which is authoritative;
values quoted above describe the grammar and may lag the token file.
"""

PATTERNS = {

    # ═══════════════════ SETTINGS_LAYOUT ═══════════════════
    # Swiss style: 280px sidebar with numbered nav items, content panel
    # uses display-type for section titles, hairline rules between settings groups.

    "settings-layout-default": (1280, 800, """
  <rect width="1280" height="800" fill="{color.surface}"/>

  <!-- Sidebar -->
  <line x1="280" y1="0" x2="280" y2="800" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>

  <text x="16" y="32" class="text-primary" font-size="14" font-weight="500">Settings</text>
  <line x1="0" y1="48" x2="280" y2="48" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>

  <!-- Settings nav with numbered list_items -->
  <text x="16" y="80" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">SECTIONS</text>

  <!-- 01 Profile (selected) -->
  <rect x="0" y="96" width="280" height="48" fill="{color.surface_elevated}"/>
  <rect x="0" y="96" width="2" height="48" fill="{color.accent}"/>
  <line x1="0" y1="143.5" x2="280" y2="143.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
  <text x="18" y="124" class="text-primary" font-size="14" font-weight="500">01</text>
  <text x="42" y="124" class="text-primary" font-size="13" font-weight="700">Profile</text>

  <!-- 02 Account -->
  <line x1="0" y1="191.5" x2="280" y2="191.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
  <text x="16" y="172" class="text-primary" font-size="14" font-weight="500">02</text>
  <text x="40" y="172" class="text-primary" font-size="13" font-weight="500">Account</text>

  <!-- 03 Notifications -->
  <line x1="0" y1="239.5" x2="280" y2="239.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
  <text x="16" y="220" class="text-primary" font-size="14" font-weight="500">03</text>
  <text x="40" y="220" class="text-primary" font-size="13" font-weight="500">Notifications</text>

  <!-- 04 Security -->
  <line x1="0" y1="287.5" x2="280" y2="287.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
  <text x="16" y="268" class="text-primary" font-size="14" font-weight="500">04</text>
  <text x="40" y="268" class="text-primary" font-size="13" font-weight="500">Security</text>

  <!-- 05 Integrations -->
  <line x1="0" y1="335.5" x2="280" y2="335.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
  <text x="16" y="316" class="text-primary" font-size="14" font-weight="500">05</text>
  <text x="40" y="316" class="text-primary" font-size="13" font-weight="500">Integrations</text>

  <!-- 06 Billing -->
  <line x1="0" y1="383.5" x2="280" y2="383.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
  <text x="16" y="364" class="text-primary" font-size="14" font-weight="500">06</text>
  <text x="40" y="364" class="text-primary" font-size="13" font-weight="500">Billing</text>

  <!-- ════════════ CONTENT PANEL ════════════ -->

  <!-- Section header: 32px display title, tracked metadata above -->
  <text x="320" y="40" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">SECTION 01 / 06</text>
  <text x="320" y="76" class="text-primary" font-size="32" font-weight="500">Profile</text>
  <text x="320" y="100" class="text-secondary" font-size="13">Update your personal information.</text>
  <line x1="320" y1="120" x2="1248" y2="120" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <!-- Field 1: Display name -->
  <text x="320" y="160" class="text-primary" font-size="13" font-weight="700">Display name</text>
  <text x="320" y="180" class="text-secondary" font-size="11">Shown on your profile and in messages.</text>
  <line x1="320" y1="208" x2="640" y2="208" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="320" y="232" class="text-primary" font-size="14">Alex Rivera</text>

  <line x1="320" y1="272" x2="1248" y2="272" stroke="{extras.color.rule_hairline}" stroke-width="1"/>

  <!-- Field 2: Email -->
  <text x="320" y="312" class="text-primary" font-size="13" font-weight="700">Email address</text>
  <text x="320" y="332" class="text-secondary" font-size="11">Used for account access and notifications.</text>
  <line x1="320" y1="360" x2="640" y2="360" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="320" y="384" class="text-primary" font-size="14">alex@example.com</text>

  <line x1="320" y1="424" x2="1248" y2="424" stroke="{extras.color.rule_hairline}" stroke-width="1"/>

  <!-- Field 3: Time zone -->
  <text x="320" y="464" class="text-primary" font-size="13" font-weight="700">Time zone</text>
  <text x="320" y="484" class="text-secondary" font-size="11">Used for scheduling and timestamps.</text>
  <line x1="320" y1="512" x2="640" y2="512" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="320" y="536" class="text-primary" font-size="14">America/Los_Angeles</text>

  <line x1="320" y1="576" x2="1248" y2="576" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <!-- Save action — RED USE: Send/Save CTAs are the primary category -->
  <text x="320" y="616" class="text-accent" font-size="14" font-weight="500">Save changes →</text>
"""),

    # ═══════════════════ FORM ═══════════════════
    # Swiss form: tracked uppercase labels, 1px black rules instead of full borders,
    # vertical hairline dividers between fields, red CTA at bottom

    "form-single-column": (480, 480, """
  <rect width="480" height="480" fill="{color.surface}"/>

  <!-- Field 1 -->
  <text x="0" y="14" class="text-secondary" font-size="11" font-weight="500" letter-spacing="1.76">FULL NAME</text>
  <line x1="0" y1="22" x2="480" y2="22" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="0" y="44" class="text-primary" font-size="14">Alex Rivera</text>

  <line x1="0" y1="80" x2="480" y2="80" stroke="{extras.color.rule_hairline}" stroke-width="1"/>

  <!-- Field 2 -->
  <text x="0" y="108" class="text-secondary" font-size="11" font-weight="500" letter-spacing="1.76">EMAIL ADDRESS</text>
  <line x1="0" y1="116" x2="480" y2="116" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="0" y="138" class="text-primary" font-size="14">alex@example.com</text>

  <line x1="0" y1="174" x2="480" y2="174" stroke="{extras.color.rule_hairline}" stroke-width="1"/>

  <!-- Field 3 -->
  <text x="0" y="202" class="text-secondary" font-size="11" font-weight="500" letter-spacing="1.76">ROLE</text>
  <line x1="0" y1="210" x2="480" y2="210" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="0" y="232" class="text-primary" font-size="14">Administrator</text>

  <line x1="0" y1="268" x2="480" y2="268" stroke="{extras.color.rule_hairline}" stroke-width="1"/>

  <!-- Field 4: bio (multi-line) -->
  <text x="0" y="296" class="text-secondary" font-size="11" font-weight="500" letter-spacing="1.76">BIO</text>
  <line x1="0" y1="304" x2="480" y2="304" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="0" y="328" class="text-disabled" font-size="14">Tell us about yourself…</text>

  <line x1="0" y1="416" x2="480" y2="416" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>

  <!-- Action row: Cancel | Save (Save in red) -->
  <text x="372" y="448" class="text-secondary" font-size="14" font-weight="500">Cancel</text>
  <text x="480" y="448" text-anchor="end" class="text-accent" font-size="14" font-weight="500">Save →</text>
"""),

    # ═══════════════════ DATA_TABLE ═══════════════════
    # Swiss table: zero-padded indices, hairline rows, strong header rule,
    # uppercase tracked metadata in headers and status

    "data-table-default": (1000, 400, """
  <rect width="1000" height="400" fill="{color.surface}"/>

  <!-- Header row -->
  <line x1="0" y1="31.5" x2="1000" y2="31.5" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="16" y="22" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">#</text>
  <text x="48" y="22" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">NAME</text>
  <text x="280" y="22" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">EMAIL</text>
  <text x="600" y="22" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">ROLE</text>
  <text x="800" y="22" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">JOINED</text>
  <text x="984" y="22" text-anchor="end" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">STATUS</text>

  <!-- Row 01 -->
  <text x="16" y="62" class="text-primary" font-size="13" font-weight="500">01</text>
  <text x="48" y="62" class="text-primary" font-size="13">Alex Rivera</text>
  <text x="280" y="62" class="text-secondary" font-size="13">alex@northwind.com</text>
  <text x="600" y="62" class="text-secondary" font-size="13">Administrator</text>
  <text x="800" y="62" class="text-secondary" font-size="13">Jan 2024</text>
  <text x="984" y="62" text-anchor="end" class="text-primary" font-size="11" font-weight="500" letter-spacing="1.76">ACTIVE</text>
  <line x1="0" y1="79.5" x2="1000" y2="79.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>

  <!-- Row 02 -->
  <text x="16" y="110" class="text-primary" font-size="13" font-weight="500">02</text>
  <text x="48" y="110" class="text-primary" font-size="13">Jordan Chen</text>
  <text x="280" y="110" class="text-secondary" font-size="13">jordan@northwind.com</text>
  <text x="600" y="110" class="text-secondary" font-size="13">Editor</text>
  <text x="800" y="110" class="text-secondary" font-size="13">Mar 2024</text>
  <text x="984" y="110" text-anchor="end" class="text-primary" font-size="11" font-weight="500" letter-spacing="1.76">ACTIVE</text>
  <line x1="0" y1="127.5" x2="1000" y2="127.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>

  <!-- Row 03 -->
  <text x="16" y="158" class="text-primary" font-size="13" font-weight="500">03</text>
  <text x="48" y="158" class="text-primary" font-size="13">Sam Okafor</text>
  <text x="280" y="158" class="text-secondary" font-size="13">sam@northwind.com</text>
  <text x="600" y="158" class="text-secondary" font-size="13">Editor</text>
  <text x="800" y="158" class="text-secondary" font-size="13">Apr 2024</text>
  <text x="984" y="158" text-anchor="end" class="text-secondary" font-size="11" font-weight="500" letter-spacing="1.76">PENDING</text>
  <line x1="0" y1="175.5" x2="1000" y2="175.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>

  <!-- Row 04 -->
  <text x="16" y="206" class="text-primary" font-size="13" font-weight="500">04</text>
  <text x="48" y="206" class="text-primary" font-size="13">Taylor Kim</text>
  <text x="280" y="206" class="text-secondary" font-size="13">taylor@northwind.com</text>
  <text x="600" y="206" class="text-secondary" font-size="13">Viewer</text>
  <text x="800" y="206" class="text-secondary" font-size="13">May 2024</text>
  <text x="984" y="206" text-anchor="end" class="text-disabled" font-size="11" font-weight="500" letter-spacing="1.76">INACTIVE</text>
  <line x1="0" y1="223.5" x2="1000" y2="223.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>

  <!-- Row 05 -->
  <text x="16" y="254" class="text-primary" font-size="13" font-weight="500">05</text>
  <text x="48" y="254" class="text-primary" font-size="13">Robin Patel</text>
  <text x="280" y="254" class="text-secondary" font-size="13">robin@northwind.com</text>
  <text x="600" y="254" class="text-secondary" font-size="13">Administrator</text>
  <text x="800" y="254" class="text-secondary" font-size="13">Jun 2024</text>
  <text x="984" y="254" text-anchor="end" class="text-primary" font-size="11" font-weight="500" letter-spacing="1.76">ACTIVE</text>
  <line x1="0" y1="271.5" x2="1000" y2="271.5" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <!-- Pagination -->
  <text x="0" y="320" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">05 OF 247</text>
  <text x="900" y="320" class="text-secondary" font-size="11">‹ Prev</text>
  <text x="984" y="320" text-anchor="end" class="text-primary" font-size="11">Next ›</text>
"""),

    # ═══════════════════ AUTH-SIGN-IN ═══════════════════
    # Swiss style: centered single column, no card surface, just the form on white,
    # tracked metadata for labels, single black 1px rules, red CTA

    "auth-sign-in": (1280, 800, """
  <rect width="1280" height="800" fill="{color.surface}"/>

  <!-- Centered narrow form (280-320px wide per Swiss layout_templates.login) -->

  <!-- Brand at top -->
  <text x="640" y="232" text-anchor="middle" class="text-primary" font-size="22" font-weight="500">Sign in</text>
  <text x="640" y="256" text-anchor="middle" class="text-secondary" font-size="13">Welcome back.</text>

  <!-- Email field -->
  <text x="480" y="304" class="text-secondary" font-size="11" font-weight="500" letter-spacing="1.76">EMAIL</text>
  <line x1="480" y1="312" x2="800" y2="312" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="480" y="334" class="text-disabled" font-size="14">user@example.com</text>

  <!-- Password field -->
  <text x="480" y="376" class="text-secondary" font-size="11" font-weight="500" letter-spacing="1.76">PASSWORD</text>
  <text x="800" y="376" text-anchor="end" class="text-secondary" font-size="11">Forgot?</text>
  <line x1="480" y1="384" x2="800" y2="384" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="480" y="406" class="text-primary" font-size="14" letter-spacing="2">••••••••</text>

  <!-- Sign in CTA — RED -->
  <line x1="480" y1="464" x2="800" y2="464" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="800" y="496" text-anchor="end" class="text-accent" font-size="14" font-weight="500">Sign in →</text>

  <!-- Alternate action -->
  <text x="640" y="552" text-anchor="middle" class="text-secondary" font-size="13">No account? <tspan class="text-primary" font-weight="500">Create one</tspan></text>
"""),

    # ─────────── ADDED IN PHASE 2 (Item 3): patterns Swiss legitimately needs ───────────

    # Sidebar (standalone) — 280px wide, full-height navigation column.
    # Brand at top, 1px black rule, search input, then nav items as
    # zero-padded list, then account block at bottom separated by hairline.
    # Mirrors the dashboard sidebar but as a self-contained pattern.
    "sidebar-default": (280, 800, """
  <rect width="280" height="800" fill="{color.surface}"/>
  <line x1="280" y1="0" x2="280" y2="800" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>

  <!-- Brand -->
  <text x="16" y="32" class="text-primary" font-size="14" font-weight="500">Northwind</text>
  <line x1="0" y1="48" x2="280" y2="48" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>

  <!-- Search -->
  <text x="16" y="80" class="text-disabled" font-size="14">search</text>
  <line x1="16" y1="96" x2="264" y2="96" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>

  <!-- Section label -->
  <text x="16" y="136" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">THREADS</text>

  <!-- Nav items (zero-padded indices, current = bold + accent bar) -->
  <rect x="0" y="152" width="2" height="48" fill="{color.accent}"/>
  <rect x="0" y="152" width="280" height="48" fill="{color.surface_elevated}"/>
  <text x="18" y="184" class="text-primary" font-size="14" font-weight="500">01</text>
  <text x="48" y="184" class="text-primary" font-size="13" font-weight="700">Tokyo Trip</text>
  <text x="264" y="184" text-anchor="end" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">2M</text>

  <text x="16" y="232" class="text-primary" font-size="14" font-weight="500">02</text>
  <text x="48" y="232" class="text-primary" font-size="13" font-weight="500">Recipe ideas</text>
  <text x="264" y="232" text-anchor="end" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">14M</text>

  <text x="16" y="280" class="text-primary" font-size="14" font-weight="500">03</text>
  <text x="48" y="280" class="text-primary" font-size="13" font-weight="500">Book club</text>
  <text x="264" y="280" text-anchor="end" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">1H</text>

  <text x="16" y="328" class="text-primary" font-size="14" font-weight="500">04</text>
  <text x="48" y="328" class="text-primary" font-size="13" font-weight="500">Marathon training</text>
  <text x="264" y="328" text-anchor="end" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">3H</text>

  <text x="16" y="376" class="text-primary" font-size="14" font-weight="500">05</text>
  <text x="48" y="376" class="text-primary" font-size="13" font-weight="500">Code review</text>
  <text x="264" y="376" text-anchor="end" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">YST</text>

  <!-- Account block at bottom -->
  <line x1="0" y1="720" x2="280" y2="720" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
  <text x="16" y="752" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">SIGNED IN AS</text>
  <text x="16" y="776" class="text-primary" font-size="13" font-weight="500">Alex Rivera</text>
"""),

    # Header — top horizontal bar. 64px tall, 1px black rule below. Brand
    # left, primary nav middle, search + account on the right. No shadows.
    "header-default": (1280, 64, """
  <rect width="1280" height="64" fill="{color.surface}"/>
  <line x1="0" y1="63.5" x2="1280" y2="63.5" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>

  <!-- Brand -->
  <text x="32" y="40" class="text-primary" font-size="14" font-weight="500">Northwind</text>

  <!-- Primary nav -->
  <text x="240" y="40" class="text-primary" font-size="13" font-weight="500">Dashboard</text>
  <text x="344" y="40" class="text-secondary" font-size="13">Threads</text>
  <text x="424" y="40" class="text-secondary" font-size="13">Settings</text>

  <!-- Search -->
  <text x="800" y="40" class="text-disabled" font-size="13">search</text>
  <line x1="800" y1="48" x2="1080" y2="48" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>

  <!-- Account -->
  <text x="1248" y="40" text-anchor="end" class="text-primary" font-size="13" font-weight="500">Alex Rivera</text>
"""),

    "header-with-actions": (1280, 64, """
  <rect width="1280" height="64" fill="{color.surface}"/>
  <line x1="0" y1="63.5" x2="1280" y2="63.5" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>

  <text x="32" y="40" class="text-primary" font-size="14" font-weight="500">Northwind</text>
  <text x="240" y="40" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">DASHBOARD / OVERVIEW</text>

  <!-- Right-aligned actions -->
  <text x="1024" y="40" class="text-secondary" font-size="13">Export</text>
  <line x1="1064" y1="24" x2="1064" y2="40" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
  <text x="1080" y="40" class="text-secondary" font-size="13">Share</text>
  <line x1="1120" y1="24" x2="1120" y2="40" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
  <text x="1248" y="40" text-anchor="end" class="text-accent" font-size="13" font-weight="500">New →</text>
"""),

    # Modal — focused overlay dialog. Swiss modal is a 480px-wide centered
    # panel on a translucent ink overlay. No drop shadow, no rounded
    # corners; the panel reads as a "letter" with 1px black top/bottom
    # rules framing the content.
    "modal-default": (1280, 800, """
  <rect width="1280" height="800" fill="{color.surface}"/>

  <!-- Background dim — Swiss uses a near-opaque white wash, not black scrim -->
  <rect width="1280" height="800" fill="{color.surface_elevated}"/>

  <!-- Centered modal panel: 480 x 320 -->
  <rect x="400" y="240" width="480" height="320" fill="{color.surface}"/>
  <line x1="400" y1="240" x2="880" y2="240" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <line x1="400" y1="560" x2="880" y2="560" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>

  <!-- Modal header: section metadata + close -->
  <text x="416" y="272" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">CONFIRM</text>
  <text x="864" y="272" text-anchor="end" class="text-secondary" font-size="14">×</text>

  <!-- Title -->
  <text x="416" y="320" class="text-primary" font-size="22" font-weight="500">Delete this thread?</text>

  <!-- Body -->
  <text x="416" y="360" class="text-secondary" font-size="13">Tokyo Trip will be moved to your archive.</text>
  <text x="416" y="380" class="text-secondary" font-size="13">You can restore it within 30 days.</text>

  <!-- Footer hairline -->
  <line x1="416" y1="496" x2="864" y2="496" stroke="{extras.color.rule_hairline}" stroke-width="1"/>

  <!-- Actions: cancel left as text-button, primary right as red CTA -->
  <text x="416" y="536" class="text-secondary" font-size="13">Cancel</text>
  <text x="864" y="536" text-anchor="end" class="text-accent" font-size="13" font-weight="500">Delete →</text>
"""),

    # Drawer — right-side slide-in panel, 480px wide, full height.
    # 1px black left rule frames it against the page. Contents follow the
    # form / detail patterns; this default shows a settings-style drawer.
    "drawer-right": (1280, 800, """
  <rect width="1280" height="800" fill="{color.surface}"/>

  <!-- Page surface dimmed -->
  <rect width="800" height="800" fill="{color.surface_elevated}"/>

  <!-- Drawer panel: 480 wide, anchored right -->
  <rect x="800" y="0" width="480" height="800" fill="{color.surface}"/>
  <line x1="800" y1="0" x2="800" y2="800" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>

  <!-- Header strip -->
  <text x="816" y="32" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">EDIT PROFILE</text>
  <text x="1264" y="32" text-anchor="end" class="text-secondary" font-size="14">×</text>
  <line x1="800" y1="48" x2="1280" y2="48" stroke="{extras.color.rule_hairline}" stroke-width="1"/>

  <!-- Title -->
  <text x="816" y="96" class="text-primary" font-size="22" font-weight="500">Profile</text>
  <text x="816" y="120" class="text-secondary" font-size="13">Update your personal information.</text>

  <!-- Form fields (key/value style stacked) -->
  <text x="816" y="184" class="text-secondary" font-size="11" font-weight="500" letter-spacing="1.76">DISPLAY NAME</text>
  <line x1="816" y1="192" x2="1264" y2="192" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="816" y="216" class="text-primary" font-size="14">Alex Rivera</text>

  <text x="816" y="264" class="text-secondary" font-size="11" font-weight="500" letter-spacing="1.76">EMAIL</text>
  <line x1="816" y1="272" x2="1264" y2="272" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="816" y="296" class="text-primary" font-size="14">alex@example.com</text>

  <text x="816" y="344" class="text-secondary" font-size="11" font-weight="500" letter-spacing="1.76">TIME ZONE</text>
  <line x1="816" y1="352" x2="1264" y2="352" stroke="{color.border_strong}" stroke-width="{border_width.strong}"/>
  <text x="816" y="376" class="text-primary" font-size="14">America/Los_Angeles</text>
  <text x="1264" y="376" text-anchor="end" class="text-secondary" font-size="14">↓</text>

  <!-- Footer with primary action -->
  <line x1="800" y1="752" x2="1280" y2="752" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
  <text x="816" y="784" class="text-secondary" font-size="13">Discard</text>
  <text x="1264" y="784" text-anchor="end" class="text-accent" font-size="13" font-weight="500">Save changes →</text>
"""),

    # Empty state — Swiss restraint at maximum. A single line of 13px
    # secondary text, optional 11px hint below. No illustration. Centered
    # both vertically and horizontally on the content area.
    "empty-state-default": (1280, 800, """
  <rect width="1280" height="800" fill="{color.surface}"/>

  <!-- Centered text block -->
  <text x="640" y="384" text-anchor="middle" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">NO THREADS</text>
  <text x="640" y="424" text-anchor="middle" class="text-primary" font-size="22" font-weight="500">Nothing here yet</text>
  <text x="640" y="456" text-anchor="middle" class="text-secondary" font-size="13">Start a conversation to populate this list.</text>
  <text x="640" y="496" text-anchor="middle" class="text-accent" font-size="13" font-weight="500">New thread →</text>
"""),

    "empty-state-no-results": (1280, 800, """
  <rect width="1280" height="800" fill="{color.surface}"/>

  <text x="640" y="392" text-anchor="middle" class="text-secondary" font-size="9" font-weight="500" letter-spacing="1.44">NO MATCHES</text>
  <text x="640" y="432" text-anchor="middle" class="text-primary" font-size="22" font-weight="500">No results for "tokyo"</text>
  <text x="640" y="464" text-anchor="middle" class="text-secondary" font-size="13">Try a different search or clear filters.</text>
"""),

    # ═════ DASHBOARD — the chat dashboard (formerly hand-authored layouts/dashboard.svg) ═════
    "dashboard": (1280, 800, """
  <!-- Swiss dashboard layout — desktop 1280×800
       Layout: sidebar (280px fixed) + main (1000px fluid)
       Per swiss-spec layout_templates.dashboard

       Red usage audit (rulebook: exactly 4 per screen):
         (1) Selection bar on active sidebar item — accent_bar (rect)
         (2) LIVE status dot in chat header — status dot (circle)
         (3) "TUCKER" user identity tag in session header — user/identity tag (text, set once)
         (4) "Send →" button in composer — primary CTA (text)
       Unread count (32px) rendered in color.text_primary; red reserved for the 4 categories above.
       Earlier draft put TUCKER per-message (5 red uses) — fixed by establishing identity once at session level.

       Grid audit: every spacing value is 8 / 16 / 24 / 32 / 40 / 48 / 64.
       Type scale audit: only 9, 11, 13, 14, 22, 32, 40 are used.
       No radii, no shadows, single Inter typeface throughout.
  -->

  <!-- Page background -->
  <rect x="0" y="0" width="1280" height="800" fill="{color.page_bg}"/>

  <!-- ════════════════════════════════════════════════════════════
       SIDEBAR (280px fixed)
       ════════════════════════════════════════════════════════════ -->

  <!-- Sidebar background (white — same as page) -->
  <rect x="0" y="0" width="280" height="800" fill="{color.surface}"/>

  <!-- Strong rule separating sidebar from main is drawn at the end of this
       document (just before </svg>) so it always paints over any list-item
       selection surfaces that extend toward x=280. -->

  <!-- Brand: 14px Inter medium -->
  <text class="text-primary" x="16" y="32"
        font-size="14"
        font-weight="500">Swiss Chat</text>

  <!-- Strong rule below brand (per nav.sidebar: 1px black) -->
  <line x1="0" y1="48" x2="280" y2="48" stroke="{color.border_strong}" stroke-width="1"/>

  <!-- Search input (per components.input.text)
       White bg, 1px black top rule, single-word lowercase placeholder
       Position: y=48 to y=96 (48px height = 6 grid units)
  -->
  <line x1="16" y1="64" x2="264" y2="64" stroke="{color.border_strong}" stroke-width="1"/>
  <text class="text-secondary" x="16" y="84"
        font-size="13"
        font-weight="400">type</text>

  <!-- Hairline below search -->
  <line x1="0" y1="104" x2="280" y2="104" stroke="{extras.color.rule_hairline}" stroke-width="1"/>

  <!-- Section header (metadata): 9px uppercase tracked, color color.text_secondary -->
  <text class="text-secondary" x="16" y="128"
        font-size="9"
        font-weight="500"
        letter-spacing="1.44">SESSIONS</text>

  <!-- ─── List Item 01: SELECTED ─────────────────────────────────
       Per components.list_item.selected:
       - 2px red accent bar on left
       - color.surface_selected gray surface background
       - title weight 700
       Position: y=144 to y=240 (96px height)
       Surface stops at x=279 to preserve the 1px black divider at x=280.
  -->
  <rect x="0" y="144" width="279" height="96" fill="{color.surface_selected}"/>
  <rect x="0" y="144" width="2" height="96" fill="{color.accent}"/>
  <line x1="0" y1="239.5" x2="279" y2="239.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>

  <text class="text-primary" x="18" y="172"
        font-size="14"
        font-weight="500">01</text>
  <text class="text-secondary" x="264" y="172"
        font-size="9"
        font-weight="500"
        letter-spacing="1.44"
        text-anchor="end">2M</text>
  <text class="text-primary" x="42" y="172"
        font-size="13"
        font-weight="700">Tokyo Trip</text>
  <text class="text-secondary" x="42" y="190"
        font-size="11"
        font-weight="400">Build day-by-day itinerary?</text>
  <text class="text-primary" x="42" y="224"
        font-size="32"
        font-weight="500">02</text>

  <!-- ─── List Item 02: default ──────────────────────────────────
       Position: y=240 to y=336
  -->
  <line x1="0" y1="335.5" x2="280" y2="335.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
  <text class="text-primary" x="16" y="268"
        font-size="14"
        font-weight="500">02</text>
  <text class="text-secondary" x="264" y="268"
        font-size="9"
        font-weight="500"
        letter-spacing="1.44"
        text-anchor="end">1H</text>
  <text class="text-primary" x="40" y="268"
        font-size="13"
        font-weight="500">Recipe Ideas</text>
  <text class="text-secondary" x="40" y="286"
        font-size="11"
        font-weight="400">5 ramen variations you'll love</text>

  <!-- ─── List Item 03 ───────────────────────────────────────────
       Position: y=336 to y=432
  -->
  <line x1="0" y1="431.5" x2="280" y2="431.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
  <text class="text-primary" x="16" y="364"
        font-size="14"
        font-weight="500">03</text>
  <text class="text-secondary" x="264" y="364"
        font-size="9"
        font-weight="500"
        letter-spacing="1.44"
        text-anchor="end">3H</text>
  <text class="text-primary" x="40" y="364"
        font-size="13"
        font-weight="500">Book Club</text>
  <text class="text-secondary" x="40" y="382"
        font-size="11"
        font-weight="400">Recommend starting with Murakami</text>
  <text class="text-primary" x="40" y="416"
        font-size="32"
        font-weight="500">01</text>

  <!-- ─── List Item 04 ───────────────────────────────────────────
       Position: y=432 to y=528
  -->
  <line x1="0" y1="527.5" x2="280" y2="527.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
  <text class="text-primary" x="16" y="460"
        font-size="14"
        font-weight="500">04</text>
  <text class="text-secondary" x="264" y="460"
        font-size="9"
        font-weight="500"
        letter-spacing="1.44"
        text-anchor="end">1D</text>
  <text class="text-primary" x="40" y="460"
        font-size="13"
        font-weight="500">Fitness Plan</text>
  <text class="text-secondary" x="40" y="478"
        font-size="11"
        font-weight="400">4-week progressive routine ready</text>

  <!-- ─── List Item 05 ───────────────────────────────────────────
       Position: y=528 to y=624
  -->
  <line x1="0" y1="623.5" x2="280" y2="623.5" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
  <text class="text-primary" x="16" y="556"
        font-size="14"
        font-weight="500">05</text>
  <text class="text-secondary" x="264" y="556"
        font-size="9"
        font-weight="500"
        letter-spacing="1.44"
        text-anchor="end">2D</text>
  <text class="text-primary" x="40" y="556"
        font-size="13"
        font-weight="500">Code Review</text>
  <text class="text-secondary" x="40" y="574"
        font-size="11"
        font-weight="400">Auth middleware looks solid, but…</text>

  <!-- Account block at bottom of sidebar
       Per nav.sidebar: separated by 1px hairline rule
       Position: y=720 onwards
  -->
  <line x1="0" y1="720" x2="280" y2="720" stroke="{extras.color.rule_hairline}" stroke-width="1"/>
  <text class="text-secondary" x="16" y="752"
        font-size="9"
        font-weight="500"
        letter-spacing="1.44">ACCOUNT</text>
  <text class="text-primary" x="16" y="776"
        font-size="13"
        font-weight="500">tucker@local</text>

  <!-- ════════════════════════════════════════════════════════════
       MAIN AREA (1000px fluid, starts at x=281)
       ════════════════════════════════════════════════════════════ -->

  <!-- Chat header
       Height 96px (12 grid units)
       Per layout_templates.dashboard: display type for primary,
       metadata above title.
  -->

  <!-- Hairline below header -->
  <line x1="281" y1="96" x2="1280" y2="96" stroke="{color.border_default}" stroke-width="1"/>

  <!-- Metadata above title: 9px uppercase tracked -->
  <text class="text-secondary" x="313" y="32"
        font-size="9"
        font-weight="500"
        letter-spacing="1.44">SESSION 01 / 05</text>
  <!-- User identity tag — RED USE #3 (user/identity tag, established once at the session level) -->
  <text class="text-accent" x="430" y="32"
        font-size="9"
        font-weight="700"
        letter-spacing="1.44">TUCKER</text>

  <!-- Title: display medium (32px), zero-padded count -->
  <text class="text-primary" x="313" y="64"
        font-size="32"
        font-weight="500">Tokyo Trip</text>

  <!-- Subtitle: 13px Inter, color color.text_secondary -->
  <text class="text-secondary" x="313" y="84"
        font-size="13"
        font-weight="400">04 exchanges · connected</text>

  <!-- Right side of header: status block (LIVE indicator) -->
  <!-- LIVE status dot — RED USE #2 (status dot category) -->
  <circle cx="1192" cy="44" r="4" fill="{color.accent}"/>
  <text class="text-primary" x="1208" y="48"
        font-size="9"
        font-weight="700"
        letter-spacing="1.44">LIVE</text>

  <!-- ════════════════════════════════════════════════════════════
       MESSAGES (centered column, 72% max width per spec)
       ════════════════════════════════════════════════════════════ -->

  <!-- Message 01 — USER -->
  <text class="text-secondary" x="313" y="144"
        font-size="9"
        font-weight="500"
        letter-spacing="1.44">USER · 00:01</text>
  <text class="text-primary" x="313" y="168"
        font-size="14"
        font-weight="400">Hey, can you help me plan a trip to Tokyo?</text>

  <!-- Message 02 — AI -->
  <text class="text-secondary" x="313" y="216"
        font-size="9"
        font-weight="500"
        letter-spacing="1.44">AI · 00:02</text>
  <text class="text-primary" x="313" y="240"
        font-size="14"
        font-weight="400">Absolutely. Tokyo is incredible. Are you looking for a culture-focused trip,</text>
  <text class="text-primary" x="313" y="264"
        font-size="14"
        font-weight="400">food adventure, or a mix of everything?</text>

  <!-- Message 03 — USER -->
  <text class="text-secondary" x="313" y="312"
        font-size="9"
        font-weight="500"
        letter-spacing="1.44">USER · 00:03</text>
  <text class="text-primary" x="313" y="336"
        font-size="14"
        font-weight="400">Definitely a mix — temples in the morning, ramen at night.</text>

  <!-- Message 04 — AI -->
  <text class="text-secondary" x="313" y="384"
        font-size="9"
        font-weight="500"
        letter-spacing="1.44">AI · 00:04</text>
  <text class="text-primary" x="313" y="408"
        font-size="14"
        font-weight="400">Perfect combo. I'd suggest starting in Asakusa for Senso-ji, then heading</text>
  <text class="text-primary" x="313" y="432"
        font-size="14"
        font-weight="400">to Shibuya for the evening food scene. Want me to build a day-by-day</text>
  <text class="text-primary" x="313" y="456"
        font-size="14"
        font-weight="400">itinerary?</text>

  <!-- ════════════════════════════════════════════════════════════
       COMPOSER (input + send)
       Position: bottom of main, above account block alignment
       Per components.input.text:
       - White bg, 1px black top rule, single-word lowercase placeholder
       - Send affordance in red on right
       ════════════════════════════════════════════════════════════ -->

  <!-- Composer container — height 96px, sits at y=704 to y=800 -->
  <line x1="281" y1="704" x2="1280" y2="704" stroke="{color.border_default}" stroke-width="1"/>

  <!-- Input top rule -->
  <line x1="313" y1="744" x2="1192" y2="744" stroke="{color.border_strong}" stroke-width="1"/>

  <!-- Placeholder: single lowercase word -->
  <text class="text-secondary" x="313" y="768"
        font-size="14"
        font-weight="400">type</text>

  <!-- Send button — RED USE #4 (primary CTA) -->
  <text class="text-accent" x="1192" y="768"
        font-size="14"
        font-weight="500"
        text-anchor="end">Send →</text>

  <!-- Strong rule separating sidebar from main (per separator.strong: 1px color.text_primary)
       Drawn last so it paints over any list-item selection surfaces. -->
  <line x1="280" y1="0" x2="280" y2="800" stroke="{color.border_strong}" stroke-width="1"/>
"""),

}
