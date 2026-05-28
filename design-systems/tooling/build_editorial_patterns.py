#!/usr/bin/env python3
"""
Build Editorial patterns (Tier 3 layout-level components).

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

Output goes to ./editorial-library/layouts/.
"""

import sys
from pathlib import Path

STANDARD_DEFS = """  <defs>
    <style>
      .text-primary { fill: #1A1614; font-family: Fraunces, Georgia, serif; }
      .text-secondary { fill: #5C4F44; font-family: Fraunces, Georgia, serif; }
      .text-metadata { fill: #8B7D6F; font-family: Inter, system-ui, sans-serif; }
      .text-metadata-accent { fill: #8B1E2D; font-family: Inter, system-ui, sans-serif; }
      .text-accent { fill: #8B1E2D; font-family: Fraunces, Georgia, serif; }
      .text-muted { fill: #8B7D6F; font-family: Inter, system-ui, sans-serif; }
      .text-display { fill: #1A1614; font-family: Fraunces, Georgia, serif; }
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

    # ═══════════════════ ARTICLE ═══════════════════
    # Editorial's pattern of pride: long-form content layout
    # 1040×800: masthead title + byline metadata + body text with drop cap
    # on first paragraph + footnote rule at bottom

    "article-default": (1040, 800, """
  <rect width="1040" height="800" fill="#F8F4EC"/>

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

  <line x1="48" y1="108" x2="992" y2="108" stroke="#1A1614" stroke-width="1"/>

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
  <line x1="48" y1="290" x2="992" y2="290" stroke="#D8CEB9" stroke-width="1"/>

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
  <line x1="48" y1="720" x2="992" y2="720" stroke="#1A1614" stroke-width="1"/>

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
  <rect width="640" height="800" fill="#F8F4EC"/>

  <!-- Form header -->
  <text x="32" y="52"
        class="text-display"
        font-size="24"
        font-weight="700"
        letter-spacing="-0.48">Create Your Dispatch</text>

  <text x="32" y="80"
        class="text-secondary"
        font-size="13">Share a thought, idea, or question with the editorial voice.</text>

  <line x1="32" y1="100" x2="608" y2="100" stroke="#D8CEB9" stroke-width="1"/>

  <!-- Field 1: Title -->
  <text x="32" y="132"
        class="text-metadata"
        font-size="9"
        font-weight="600"
        letter-spacing="1.44">TITLE</text>

  <line x1="32" y1="138" x2="608" y2="138" stroke="#D8CEB9" stroke-width="1"/>

  <text x="32" y="160"
        class="text-primary"
        font-size="14">Tokyo Trip Planning</text>

  <line x1="32" y1="190" x2="608" y2="190" stroke="#E8DFCA" stroke-width="1"/>

  <!-- Field 2: Category -->
  <text x="32" y="222"
        class="text-metadata"
        font-size="9"
        font-weight="600"
        letter-spacing="1.44">CATEGORY</text>

  <line x1="32" y1="228" x2="608" y2="228" stroke="#D8CEB9" stroke-width="1"/>

  <text x="32" y="250"
        class="text-primary"
        font-size="14">Travel</text>

  <line x1="32" y1="280" x2="608" y2="280" stroke="#E8DFCA" stroke-width="1"/>

  <!-- Field 3: Body (textarea) -->
  <text x="32" y="312"
        class="text-metadata"
        font-size="9"
        font-weight="600"
        letter-spacing="1.44">BODY TEXT</text>

  <line x1="32" y1="318" x2="608" y2="318" stroke="#D8CEB9" stroke-width="1"/>

  <text x="32" y="342"
        class="text-primary"
        font-size="13">A handsome serif system with warm cream paper and no emoji. Perfect</text>

  <text x="32" y="362"
        class="text-primary"
        font-size="13">for long-form content and editorial voice.</text>

  <line x1="32" y1="448" x2="608" y2="448" stroke="#D8CEB9" stroke-width="1"/>

  <!-- Field 4: Tags -->
  <text x="32" y="480"
        class="text-metadata"
        font-size="9"
        font-weight="600"
        letter-spacing="1.44">TAGS (OPTIONAL)</text>

  <line x1="32" y1="486" x2="608" y2="486" stroke="#D8CEB9" stroke-width="1"/>

  <text x="32" y="508"
        class="text-secondary"
        font-size="13" font-style="italic">add tags…</text>

  <line x1="32" y1="538" x2="608" y2="538" stroke="#E8DFCA" stroke-width="1"/>

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
  <rect width="1280" height="800" fill="#F8F4EC"/>

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
  <line x1="520" y1="220" x2="760" y2="220" stroke="#8B1E2D" stroke-width="1"/>
  <line x1="520" y1="224" x2="760" y2="224" stroke="#8B1E2D" stroke-width="1"/>

  <!-- Email field -->
  <text x="480" y="270"
        class="text-metadata"
        font-size="9"
        font-weight="600"
        letter-spacing="1.44">EMAIL ADDRESS</text>

  <line x1="480" y1="276" x2="800" y2="276" stroke="#D8CEB9" stroke-width="1"/>

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

  <line x1="480" y1="346" x2="800" y2="346" stroke="#D8CEB9" stroke-width="1"/>

  <text x="480" y="368"
        class="text-primary"
        font-size="14"
        letter-spacing="2">••••••••</text>

  <!-- Sign in button (burgundy CTA) -->
  <line x1="480" y1="420" x2="800" y2="420" stroke="#D8CEB9" stroke-width="1"/>

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
    # The Editorial dashboard.svg already exists and is the canonical example.
    # We preserve it as-is rather than regenerate it. But let's create a variant
    # (dashboard-narrow) for completeness — 1024×600 mobile-oriented version.

    "dashboard-narrow": (1024, 600, """
  <rect x="0" y="0" width="1024" height="600" fill="#F8F4EC"/>

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
  <line x1="16" y1="72" x2="224" y2="72" stroke="#8B1E2D" stroke-width="1"/>
  <line x1="16" y1="76" x2="224" y2="76" stroke="#8B1E2D" stroke-width="1"/>

  <!-- Search -->
  <text x="16" y="100"
        class="text-muted"
        font-size="11"
        font-style="italic">Search…</text>
  <line x1="16" y1="108" x2="224" y2="108" stroke="#D8CEB9" stroke-width="1"/>

  <!-- Recent Dispatches -->
  <text x="16" y="132"
        class="text-metadata"
        font-size="9"
        font-weight="600"
        letter-spacing="1.62">RECENT</text>

  <line x1="0" y1="144" x2="240" y2="144" stroke="#1A1614" stroke-width="1"/>

  <!-- Dispatch 01: Selected -->
  <rect x="0" y="144" width="240" height="72" fill="#F1ECDF"/>
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
  <line x1="0" y1="215" x2="240" y2="215" stroke="#E8DFCA" stroke-width="1"/>

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
  <line x1="0" y1="291" x2="240" y2="291" stroke="#E8DFCA" stroke-width="1"/>

  <!-- Byline footer -->
  <line x1="0" y1="552" x2="240" y2="552" stroke="#1A1614" stroke-width="1"/>
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
  <line x1="240" y1="0" x2="240" y2="600" stroke="#D8CEB9" stroke-width="1"/>

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

  <line x1="272" y1="82" x2="1000" y2="82" stroke="#1A1614" stroke-width="1"/>

  <!-- Message 01: User (right-aligned) -->
  <text x="272" y="116"
        class="text-metadata"
        font-size="9"
        font-weight="600"
        letter-spacing="1.44">YOU · 14:23</text>

  <line x1="480" y1="126" x2="480" y2="152" stroke="#8B1E2D" stroke-width="2"/>

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
  <line x1="272" y1="552" x2="1000" y2="552" stroke="#D8CEB9" stroke-width="1"/>

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

}


def main():
    only = None
    if len(sys.argv) > 2 and sys.argv[1] == "--only":
        only = sys.argv[2]

    # Script lives in tooling/; output goes up one level into the project root.
    out_dir = Path(__file__).resolve().parent.parent / "editorial-library" / "layouts"
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

    print(f"Wrote {len(written)} Editorial pattern SVGs to {out_dir}")


if __name__ == "__main__":
    main()
