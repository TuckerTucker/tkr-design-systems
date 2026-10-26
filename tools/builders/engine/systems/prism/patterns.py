"""
Prism pattern templates (Tier 3 layout-level components).

Prism's contemporary_clean grammar at the pattern level:
  - Gradient background + ambient orbs
  - Glass elevation tiers (0.08 default, 0.14 elevated, 0.18 user_message)
  - Outfit typeface throughout (9 sizes)
  - Teal (#7DDFBE) accent ONLY for status signals
  - No box-shadow; no emoji
  - Single-letter monograms for identity
  - Rounded corners: radius.default items, radius.input composer,
    radius.chrome modals, extras.radius.control for 32px controls

Patterns to author:
  1. dashboard — 1280×800 with sidebar, main content, message composition
  2. modal — 1280×800 with dimmed overlay + centered glass panel
  3. drawer — 1280×800 with right-anchored slide-in panel

Rendered by tools/builders/build.py into systems/prism/layouts/.
Colours, fonts, radii and border widths are {token.path} placeholders
resolved from systems/prism/tokens.json, which is authoritative;
values quoted above describe the grammar and may lag the token file.
"""

PATTERNS = {

    # ═════════════════════ DASHBOARD ═════════════════════
    # Prism signature layout: sidebar + main content + message composition.
    # Compact variant of the "dashboard" template at the end of this module.

    "dashboard-default": (1280, 800, """
  <!-- Gradient page background -->
  <rect x="0" y="0" width="1280" height="800" fill="url(#prism-bg)"/>

  <!-- Ambient orbs: top-right lavender, bottom-left teal -->
  <circle cx="1220" cy="-20" r="260" fill="url(#orb-lavender)"/>
  <circle cx="80" cy="780" r="220" fill="url(#orb-teal)"/>

  <!-- ════════════ SIDEBAR ════════════ -->

  <!-- Brand -->
  <text x="14" y="36" class="text-primary" font-size="16" font-weight="500" letter-spacing="-0.32">Prism</text>

  <!-- Search -->
  <rect x="14" y="54" width="252" height="32" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{extras.radius.control}" ry="{extras.radius.control}"/>
  <text x="26" y="74" class="text-muted" font-size="12">⌕  Search...</text>

  <!-- Selected list item -->
  <rect x="6" y="106" width="268" height="56" fill="{color.surface_elevated}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.default}" ry="{radius.default}"/>
  <rect x="20" y="115" width="34" height="34" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{extras.radius.avatar}" ry="{extras.radius.avatar}"/>
  <text x="37" y="138" class="text-primary" font-size="15" font-weight="500" text-anchor="middle">T</text>
  <circle cx="52" cy="147" r="4" fill="{color.accent}" stroke="{extras.color.status_ring}" stroke-width="2"/>
  <text x="64" y="129" class="text-primary" font-size="12.5" font-weight="500">Tokyo Trip</text>
  <text x="260" y="129" class="text-very-muted" font-size="10" text-anchor="end">2m</text>
  <text x="64" y="146" class="text-muted" font-size="11">Build itinerary?</text>
  <rect x="238" y="138" width="18" height="18" fill="{extras.color.accent_tint}" stroke="{extras.color.accent_border}" stroke-width="1" rx="{extras.radius.badge}" ry="{extras.radius.badge}"/>
  <text x="247" y="151" class="text-accent" font-size="9" font-weight="600" text-anchor="middle">2</text>

  <!-- More list items (compact) -->
  <rect x="14" y="180" width="34" height="34" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{extras.radius.avatar}" ry="{extras.radius.avatar}"/>
  <text x="31" y="203" class="text-primary" font-size="15" font-weight="500" text-anchor="middle">R</text>
  <text x="58" y="194" class="text-primary" font-size="12.5" font-weight="500">Recipe Ideas</text>
  <text x="266" y="194" class="text-very-muted" font-size="10" text-anchor="end">1h</text>

  <rect x="14" y="242" width="34" height="34" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{extras.radius.avatar}" ry="{extras.radius.avatar}"/>
  <text x="31" y="265" class="text-primary" font-size="15" font-weight="500" text-anchor="middle">B</text>
  <circle cx="46" cy="274" r="4" fill="{color.accent}" stroke="{extras.color.status_ring}" stroke-width="2"/>
  <text x="58" y="256" class="text-primary" font-size="12.5" font-weight="500">Book Club</text>
  <text x="266" y="256" class="text-very-muted" font-size="10" text-anchor="end">3h</text>

  <!-- Account footer -->
  <line x1="0" y1="744" x2="280" y2="744" stroke="{extras.color.divider_subtle}" stroke-width="1"/>
  <rect x="14" y="754" width="28" height="28" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{extras.radius.avatar_small}" ry="{extras.radius.avatar_small}"/>
  <text x="28" y="773" class="text-secondary" font-size="12" text-anchor="middle">◈</text>
  <text x="50" y="773" class="text-secondary" font-size="11">You · active</text>

  <!-- ════════════ MAIN CONTENT ════════════ -->

  <!-- Header panel -->
  <rect x="312" y="14" width="952" height="56" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.default}" ry="{radius.default}"/>
  <text x="328" y="46" class="text-primary" font-size="16" font-weight="700">T</text>
  <text x="354" y="44" class="text-primary" font-size="13.5" font-weight="500">Tokyo Trip</text>
  <text x="354" y="60" class="text-muted" font-size="10">active session</text>

  <!-- Message 1 — USER (right, 0.18 opacity) -->
  <path d="{extras.radius.message|rrect=788,108,464,44,br:extras.radius.message_tail}"
        fill="{color.surface_inverse}" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
  <text x="800" y="135" class="text-primary" font-size="13">Hey, can you plan my Tokyo trip?</text>

  <!-- Message 2 — AI (left, 0.08 opacity) -->
  <path d="{extras.radius.message|rrect=320,180,632,70,bl:extras.radius.message_tail}"
        fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
  <text x="338" y="208" class="text-secondary" font-size="13">Absolutely! Tokyo is incredible. I'd suggest</text>
  <text x="338" y="232" class="text-secondary" font-size="13">starting with Asakusa temples.</text>

  <!-- Message 3 — USER -->
  <path d="{extras.radius.message|rrect=844,278,408,44,br:extras.radius.message_tail}"
        fill="{color.surface_inverse}" stroke="{color.border_default}" stroke-width="{border_width.default}"/>
  <text x="856" y="305" class="text-primary" font-size="13">Perfect! Temples + food.</text>

  <!-- Composer panel -->
  <rect x="320" y="724" width="908" height="44" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.input}" ry="{radius.input}"/>
  <text x="338" y="751" class="text-muted" font-size="13">Message...</text>
  <rect x="1234" y="730" width="32" height="32" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{extras.radius.control}" ry="{extras.radius.control}"/>
  <text x="1250" y="751" class="text-secondary" font-size="14" text-anchor="middle">↑</text>

  <!-- Vertical divider -->
  <line x1="280" y1="0" x2="280" y2="800" stroke="{extras.color.divider}" stroke-width="1"/>
"""),

    # ═════════════════════ MODAL ═════════════════════
    # Centered glass panel on dimmed background.

    "modal-default": (1280, 800, """
  <!-- Gradient background -->
  <rect x="0" y="0" width="1280" height="800" fill="url(#prism-bg)"/>

  <!-- Dimming overlay -->
  <rect x="0" y="0" width="1280" height="800" fill="{extras.color.scrim}"/>

  <!-- Centered modal panel: 480×320 -->
  <rect x="400" y="240" width="480" height="320" fill="{color.surface_elevated}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{radius.chrome}" ry="{radius.chrome}"/>

  <!-- Header -->
  <text x="416" y="272" class="text-secondary" font-size="9" font-weight="600">CONFIRM</text>
  <text x="864" y="272" text-anchor="end" class="text-secondary" font-size="14" font-weight="500">×</text>

  <!-- Title -->
  <text x="416" y="320" class="text-primary" font-size="16" font-weight="500">Delete thread?</text>

  <!-- Body -->
  <text x="416" y="360" class="text-secondary" font-size="12">Tokyo Trip will be moved to archive.</text>
  <text x="416" y="380" class="text-secondary" font-size="12">You can restore it within 30 days.</text>

  <!-- Divider -->
  <line x1="416" y1="496" x2="864" y2="496" stroke="{extras.color.divider_subtle}" stroke-width="1"/>

  <!-- Actions -->
  <text x="416" y="536" class="text-secondary" font-size="12" font-weight="500">Cancel</text>
  <text x="864" y="536" text-anchor="end" class="text-accent" font-size="12" font-weight="500">Delete</text>
"""),

    # ═════════════════════ DRAWER ═════════════════════
    # Right-side slide-in panel.

    "drawer-right": (1280, 800, """
  <!-- Gradient background -->
  <rect x="0" y="0" width="1280" height="800" fill="url(#prism-bg)"/>

  <!-- Ambient orbs -->
  <circle cx="1220" cy="-20" r="260" fill="url(#orb-lavender)"/>
  <circle cx="80" cy="780" r="220" fill="url(#orb-teal)"/>

  <!-- Dimming overlay (left side only) -->
  <rect x="0" y="0" width="800" height="800" fill="{extras.color.scrim|alpha=0.15}"/>

  <!-- Drawer panel: 480 wide, right-anchored -->
  <rect x="800" y="0" width="480" height="800" fill="{color.surface|alpha=0.12}" stroke="{color.border_default}" stroke-width="{border_width.default}"/>

  <!-- Header strip -->
  <text x="816" y="32" class="text-secondary" font-size="9" font-weight="600">EDIT PROFILE</text>
  <text x="1264" y="32" text-anchor="end" class="text-secondary" font-size="13">×</text>
  <line x1="800" y1="48" x2="1280" y2="48" stroke="{extras.color.divider_subtle}" stroke-width="1"/>

  <!-- Title -->
  <text x="816" y="96" class="text-primary" font-size="16" font-weight="500">Profile</text>
  <text x="816" y="120" class="text-secondary" font-size="12">Update your personal information.</text>

  <!-- Form fields -->
  <text x="816" y="160" class="text-secondary" font-size="10">Display Name</text>
  <rect x="816" y="172" width="432" height="32" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{extras.radius.control}" ry="{extras.radius.control}"/>
  <text x="828" y="196" class="text-primary" font-size="12">Alex Rivera</text>

  <text x="816" y="240" class="text-secondary" font-size="10">Email</text>
  <rect x="816" y="252" width="432" height="32" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{extras.radius.control}" ry="{extras.radius.control}"/>
  <text x="828" y="276" class="text-primary" font-size="12">alex@example.com</text>

  <text x="816" y="320" class="text-secondary" font-size="10">Time zone</text>
  <rect x="816" y="332" width="432" height="32" fill="{color.surface}" stroke="{color.border_default}" stroke-width="{border_width.default}" rx="{extras.radius.control}" ry="{extras.radius.control}"/>
  <text x="828" y="356" class="text-primary" font-size="12">America/Los_Angeles</text>

  <!-- Footer -->
  <line x1="800" y1="752" x2="1280" y2="752" stroke="{extras.color.divider_subtle}" stroke-width="1"/>
  <text x="816" y="784" class="text-secondary" font-size="12" font-weight="500">Discard</text>
  <text x="1264" y="784" text-anchor="end" class="text-accent" font-size="12" font-weight="500">Save</text>
"""),

    # ═════ DASHBOARD — full session list (formerly hand-authored layouts/dashboard.svg) ═════
    "dashboard": (1280, 800, """
  <!-- Prism dashboard — desktop 1280×800
       grammar_family: contemporary_clean, elevation.strategy: glass_blur
       Gradient bg + ambient orbs + glass panels.
       SVG approximation: backdrop-filter doesn't render; we use rgba opacity.
  -->

  <!-- Gradient page background -->
  <rect x="0" y="0" width="1280" height="800" fill="url(#prism-bg)"/>

  <!-- Ambient orbs: top-right lavender, bottom-left teal -->
  <circle cx="1220" cy="-20" r="260" fill="url(#orb-lavender)"/>
  <circle cx="80" cy="780" r="220" fill="url(#orb-teal)"/>

  <!-- ════════════ SIDEBAR ════════════ -->

  <!-- Brand: Outfit 16px white -->
  <text x="14" y="36"
        font-family="{font.body}"
        font-size="16"
        font-weight="500"
        fill="{color.text_primary|alpha=0.9}"
        letter-spacing="-0.32">Prism</text>

  <!-- Search: glass panel -->
  <rect x="14" y="54" width="252" height="32" fill="{color.surface}" stroke="{color.border_default}" stroke-width="1" rx="{extras.radius.control}" ry="{extras.radius.control}"/>
  <text x="26" y="74" font-family="{font.body}" font-size="12" fill="{color.text_primary|alpha=0.35}">⌕  Search...</text>

  <!-- ─── List items (5 sessions) ──────────────────── -->
  <!-- Selected item gets elevated glass tier -->
  <rect x="6" y="106" width="268" height="56" fill="{color.surface_elevated}" stroke="{color.border_default}" stroke-width="1" rx="{radius.default}" ry="{radius.default}"/>
  <rect x="20" y="115" width="34" height="34" fill="{color.surface}" stroke="{color.border_default}" stroke-width="1" rx="{extras.radius.avatar}" ry="{extras.radius.avatar}"/>
  <text x="37" y="138" font-family="{font.body}" font-size="15" font-weight="500" fill="{color.text_primary}" text-anchor="middle">T</text>
  <circle cx="52" cy="147" r="4" fill="{color.accent}" stroke="{extras.color.status_ring}" stroke-width="2"/>
  <text x="64" y="129" font-family="{font.body}" font-size="12.5" font-weight="500" fill="{color.text_primary|alpha=0.85}">Tokyo Trip</text>
  <text x="260" y="129" font-family="{font.body}" font-size="10" fill="{color.text_primary|alpha=0.30}" text-anchor="end">2m</text>
  <text x="64" y="146" font-family="{font.body}" font-size="11" fill="{color.text_muted}">Build itinerary?</text>
  <rect x="238" y="138" width="18" height="18" fill="{extras.color.accent_tint}" stroke="{extras.color.accent_border}" stroke-width="1" rx="{extras.radius.badge}" ry="{extras.radius.badge}"/>
  <text x="247" y="151" font-family="{font.body}" font-size="9" font-weight="600" fill="{color.accent}" text-anchor="middle">2</text>

  <!-- Recipe Ideas -->
  <rect x="14" y="180" width="34" height="34" fill="{color.surface}" stroke="{color.border_default}" stroke-width="1" rx="{extras.radius.avatar}" ry="{extras.radius.avatar}"/>
  <text x="31" y="203" font-family="{font.body}" font-size="15" font-weight="500" fill="{color.text_primary}" text-anchor="middle">R</text>
  <text x="58" y="194" font-family="{font.body}" font-size="12.5" font-weight="500" fill="{color.text_primary|alpha=0.85}">Recipe Ideas</text>
  <text x="266" y="194" font-family="{font.body}" font-size="10" fill="{color.text_primary|alpha=0.30}" text-anchor="end">1h</text>
  <text x="58" y="211" font-family="{font.body}" font-size="11" fill="{color.text_muted}">Here are 5 ramen variations you'll love...</text>

  <!-- Book Club -->
  <rect x="14" y="242" width="34" height="34" fill="{color.surface}" stroke="{color.border_default}" stroke-width="1" rx="{extras.radius.avatar}" ry="{extras.radius.avatar}"/>
  <text x="31" y="265" font-family="{font.body}" font-size="15" font-weight="500" fill="{color.text_primary}" text-anchor="middle">B</text>
  <circle cx="46" cy="274" r="4" fill="{color.accent}" stroke="{extras.color.status_ring}" stroke-width="2"/>
  <text x="58" y="256" font-family="{font.body}" font-size="12.5" font-weight="500" fill="{color.text_primary|alpha=0.85}">Book Club</text>
  <text x="266" y="256" font-family="{font.body}" font-size="10" fill="{color.text_primary|alpha=0.30}" text-anchor="end">3h</text>
  <text x="58" y="273" font-family="{font.body}" font-size="11" fill="{color.text_muted}">Start with Murakami…</text>
  <rect x="244" y="265" width="18" height="18" fill="{extras.color.accent_tint}" stroke="{extras.color.accent_border}" stroke-width="1" rx="{extras.radius.badge}" ry="{extras.radius.badge}"/>
  <text x="253" y="278" font-family="{font.body}" font-size="9" font-weight="600" fill="{color.accent}" text-anchor="middle">1</text>

  <!-- Fitness Plan -->
  <rect x="14" y="304" width="34" height="34" fill="{color.surface}" stroke="{color.border_default}" stroke-width="1" rx="{extras.radius.avatar}" ry="{extras.radius.avatar}"/>
  <text x="31" y="327" font-family="{font.body}" font-size="15" font-weight="500" fill="{color.text_primary}" text-anchor="middle">F</text>
  <text x="58" y="318" font-family="{font.body}" font-size="12.5" font-weight="500" fill="{color.text_primary|alpha=0.85}">Fitness Plan</text>
  <text x="266" y="318" font-family="{font.body}" font-size="10" fill="{color.text_primary|alpha=0.30}" text-anchor="end">1d</text>
  <text x="58" y="335" font-family="{font.body}" font-size="11" fill="{color.text_muted}">Your 4-week progressive routine is ready.</text>

  <!-- Code Review -->
  <rect x="14" y="366" width="34" height="34" fill="{color.surface}" stroke="{color.border_default}" stroke-width="1" rx="{extras.radius.avatar}" ry="{extras.radius.avatar}"/>
  <text x="31" y="389" font-family="{font.body}" font-size="15" font-weight="500" fill="{color.text_primary}" text-anchor="middle">C</text>
  <text x="58" y="380" font-family="{font.body}" font-size="12.5" font-weight="500" fill="{color.text_primary|alpha=0.85}">Code Review</text>
  <text x="266" y="380" font-family="{font.body}" font-size="10" fill="{color.text_primary|alpha=0.30}" text-anchor="end">2d</text>
  <text x="58" y="397" font-family="{font.body}" font-size="11" fill="{color.text_muted}">The auth middleware looks solid, but...</text>

  <!-- Account footer -->
  <line x1="0" y1="744" x2="280" y2="744" stroke="{extras.color.divider_subtle}" stroke-width="1"/>
  <rect x="14" y="754" width="28" height="28" fill="{color.surface}" stroke="{color.border_default}" stroke-width="1" rx="{extras.radius.avatar_small}" ry="{extras.radius.avatar_small}"/>
  <text x="28" y="773" font-family="{font.body}" font-size="12" fill="{color.text_primary|alpha=0.6}" text-anchor="middle">◈</text>
  <text x="50" y="773" font-family="{font.body}" font-size="11" fill="{color.text_primary|alpha=0.5}">You · active</text>

  <!-- ════════════ MAIN AREA ════════════ -->

  <!-- Header: glass panel with emoji + title + status -->
  <rect x="312" y="14" width="952" height="56" fill="{color.surface}" stroke="{color.border_default}" stroke-width="1" rx="{radius.default}" ry="{radius.default}"/>
  <text x="328" y="46" font-family="{font.body}" font-size="16" font-weight="700" fill="{color.text_primary}">T</text>
  <text x="354" y="44" font-family="{font.body}" font-size="13.5" font-weight="500" fill="{color.text_primary|alpha=0.9}">Tokyo Trip</text>
  <text x="354" y="60" font-family="{font.body}" font-size="10" fill="{color.text_primary|alpha=0.35}">active session</text>

  <!-- ─── Messages: glass bubbles, asymmetric corners ─── -->

  <!-- Message 01 — USER (right, higher opacity 0.18, tail at bottom-right) -->
  <path d="{extras.radius.message|rrect=788,108,464,44,br:extras.radius.message_tail}"
        fill="{color.surface_inverse}" stroke="{color.border_default}" stroke-width="1"/>
  <text x="800" y="135" font-family="{font.body}" font-size="13" fill="{color.text_primary}">Hey, can you help me plan a trip to Tokyo?</text>

  <!-- Message 02 — AI (left, base opacity 0.08, tail at bottom-left) -->
  <path d="{extras.radius.message|rrect=320,180,632,70,bl:extras.radius.message_tail}"
        fill="{color.surface}" stroke="{color.border_default}" stroke-width="1"/>
  <text x="338" y="208" font-family="{font.body}" font-size="13" fill="{color.text_secondary}">Absolutely! Tokyo is incredible. Are you looking for a culture-focused trip,</text>
  <text x="338" y="232" font-family="{font.body}" font-size="13" fill="{color.text_secondary}">food adventure, or a mix of everything?</text>

  <!-- Message 03 — USER -->
  <path d="{extras.radius.message|rrect=844,278,408,44,br:extras.radius.message_tail}"
        fill="{color.surface_inverse}" stroke="{color.border_default}" stroke-width="1"/>
  <text x="856" y="305" font-family="{font.body}" font-size="13" fill="{color.text_primary}">Definitely a mix — temples in the morning, ramen at night.</text>

  <!-- Message 04 — AI -->
  <path d="{extras.radius.message|rrect=320,350,692,94,bl:extras.radius.message_tail}"
        fill="{color.surface}" stroke="{color.border_default}" stroke-width="1"/>
  <text x="338" y="378" font-family="{font.body}" font-size="13" fill="{color.text_secondary}">Perfect combo. I'd suggest starting in Asakusa for Senso-ji, then heading to</text>
  <text x="338" y="402" font-family="{font.body}" font-size="13" fill="{color.text_secondary}">Shibuya for the evening food scene. Want me to build a day-by-day</text>
  <text x="338" y="426" font-family="{font.body}" font-size="13" fill="{color.text_secondary}">itinerary?</text>

  <!-- Composer: glass panel + icon-only send button -->
  <line x1="312" y1="704" x2="1264" y2="704" stroke="{extras.color.divider_subtle}" stroke-width="1"/>
  <rect x="320" y="724" width="908" height="44" fill="{color.surface}" stroke="{color.border_default}" stroke-width="1" rx="{radius.input}" ry="{radius.input}"/>
  <text x="338" y="751" font-family="{font.body}" font-size="13" fill="{color.text_muted}">Message...</text>
  <rect x="1234" y="730" width="32" height="32" fill="{color.surface}" stroke="{color.border_default}" stroke-width="1" rx="{extras.radius.control}" ry="{extras.radius.control}"/>
  <text x="1250" y="751" font-family="{font.body}" font-size="14" fill="{color.action_foreground}" text-anchor="middle">↑</text>

  <line x1="280" y1="0" x2="280" y2="800" stroke="{extras.color.divider}" stroke-width="1"/>
"""),

}
