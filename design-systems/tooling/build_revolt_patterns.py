#!/usr/bin/env python3
"""
Build Revolt patterns (Tier 3 layout-level components).

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
"""

import sys
from pathlib import Path

STANDARD_DEFS = """  <defs>
    <style>
      .text-primary { fill: #111111; font-family: 'Space Mono', ui-monospace, monospace; }
      .text-secondary { fill: #666666; font-family: 'Space Mono', ui-monospace, monospace; }
      .text-muted { fill: #999999; font-family: 'Space Mono', ui-monospace, monospace; }
      .text-inverse { fill: #FFFFFF; font-family: 'Space Mono', ui-monospace, monospace; }
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

    # ═══════════════════ AUTH (SIGN-IN) ═══════════════════
    # Revolt auth: centered narrowform on white, pink brand at top, bordered
    # input fields, Space Mono uppercase labels, lime Send button with hard shadow

    "auth-sign-in": (1280, 800, """
  <rect x="0" y="0" width="1280" height="800" fill="#FFFEF5"/>

  <!-- Centered form card: 360px wide, white with 2px border and 4px hard shadow -->
  <rect x="464" y="82" width="352" height="556" fill="#111111"/>
  <rect x="460" y="78" width="352" height="556" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>

  <!-- Pink brand section at top of form -->
  <rect x="460" y="78" width="352" height="60" fill="#FF3366"/>
  <text x="636" y="117" text-anchor="middle" class="text-inverse" font-size="14" font-weight="700" letter-spacing="1.12">REVOLT.chat</text>

  <!-- Divider below brand -->
  <line x1="460" y1="138" x2="812" y2="138" stroke="#111111" stroke-width="2"/>

  <!-- Email field -->
  <text x="480" y="170" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.8">EMAIL ADDRESS</text>
  <rect x="480" y="176" width="312" height="32" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="490" y="198" class="text-muted" font-size="10">your@email.com</text>

  <!-- Divider -->
  <line x1="480" y1="226" x2="792" y2="226" stroke="#999999" stroke-width="1"/>

  <!-- Password field -->
  <text x="480" y="254" class="text-secondary" font-size="8" font-weight="700" letter-spacing="0.8">PASSWORD</text>
  <rect x="480" y="260" width="312" height="32" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>
  <text x="490" y="282" class="text-primary" font-size="10" letter-spacing="1.5">••••••••</text>

  <!-- Divider -->
  <line x1="480" y1="310" x2="792" y2="310" stroke="#999999" stroke-width="1"/>

  <!-- Sign in button — lime with 4px hard shadow -->
  <rect x="484" y="342" width="304" height="48" fill="#111111"/>
  <rect x="480" y="338" width="304" height="48" fill="#C8FF00" stroke="#111111" stroke-width="2"/>
  <text x="632" y="368" text-anchor="middle" class="text-primary" font-size="11" font-weight="700" letter-spacing="0.44">SIGN IN</text>

  <!-- Footer link: "Create account" -->
  <text x="636" y="520" text-anchor="middle" class="text-secondary" font-size="9">No account? <tspan fill="#111111" font-weight="700">Create one</tspan></text>
"""),

    # ═══════════════════ BANNER (PROMOTIONAL) ═══════════════════
    # Full-width 1280×400. Promotional banner with lime/pink split layout,
    # centered content card with hard shadow, oversized headline, secondary text, lime CTA

    "banner-promotional": (1280, 400, """
  <rect x="0" y="0" width="1280" height="400" fill="#FFFEF5"/>

  <!-- Left half: pink background -->
  <rect x="0" y="0" width="640" height="400" fill="#FF3366"/>

  <!-- Right half: lime background -->
  <rect x="640" y="0" width="640" height="400" fill="#C8FF00"/>

  <!-- Centered content card with hard shadow -->
  <rect x="242" y="82" width="796" height="236" fill="#111111"/>
  <rect x="240" y="80" width="796" height="236" fill="#FFFFFF" stroke="#111111" stroke-width="2"/>

  <!-- Headline (26px, generous tracking, uppercase) -->
  <text x="260" y="130" class="text-primary" font-size="20" font-weight="700" letter-spacing="0.8">Y2K VIBES</text>
  <text x="260" y="156" class="text-primary" font-size="20" font-weight="700" letter-spacing="0.8">UNLEASHED</text>

  <!-- Secondary text (11px, grey) -->
  <text x="260" y="188" class="text-secondary" font-size="10">Meet Revolt, the neobrutalist chat interface</text>
  <text x="260" y="206" class="text-secondary" font-size="10">built for the modern internet.</text>

  <!-- CTA button — lime with 4px shadow on right -->
  <rect x="762" y="224" width="104" height="44" fill="#111111"/>
  <rect x="760" y="222" width="104" height="44" fill="#C8FF00" stroke="#111111" stroke-width="2"/>
  <text x="812" y="250" text-anchor="middle" class="text-primary" font-size="10" font-weight="700" letter-spacing="0.4">EXPLORE ></text>
"""),

}


def main():
    only = None
    if len(sys.argv) > 2 and sys.argv[1] == "--only":
        only = sys.argv[2]

    # Script lives in tooling/; output goes up one level into the project root.
    out_dir = Path(__file__).resolve().parent.parent / "revolt-library" / "layouts"
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

    print(f"Wrote {len(written)} Revolt pattern SVGs to {out_dir}")


if __name__ == "__main__":
    main()
