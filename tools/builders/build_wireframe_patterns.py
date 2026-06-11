#!/usr/bin/env python3
"""
Build the wireframe library's Pattern SVGs (Tier 3 of LIBRARY-SPEC).

Patterns compose Composites and Primitives into full regions or layouts.
Each is authored individually because they're larger and more opinionated
than Primitives/Composites — composition logic varies by pattern.

Output goes to systems/wireframe/layouts/.

Usage:
    python3 build_wireframe_patterns.py
    python3 build_wireframe_patterns.py --only sidebar-default
"""

import sys
from pathlib import Path

STANDARD_DEFS = """  <defs>
    <style>
      .text-primary { fill: #212121; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .text-secondary { fill: #757575; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .text-disabled { fill: #BDBDBD; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .text-inverse { fill: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .text-danger { fill: #B71C1C; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .text-success { fill: #2E7D32; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .text-warning { fill: #E65100; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .text-info { fill: #1565C0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    </style>
  </defs>"""


def wrap_svg(width: int, height: int, body: str, comment: str = "") -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">
{STANDARD_DEFS}
  {comment}
{body}
</svg>
"""


# ──────────────────────────────────────────────────────────────────────
# PATTERN BODIES
# ──────────────────────────────────────────────────────────────────────

PATTERNS = {

    # ═══════════════════ SIDEBAR (3 variants) ═══════════════════

    "sidebar-default": (280, 800, """
  <rect width="280" height="800" fill="#FFFFFF"/>
  <line x1="279.5" y1="0" x2="279.5" y2="800" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Brand area -->
  <text x="16" y="36" class="text-primary" font-size="16" font-weight="700">Brand</text>
  <line x1="0" y1="64" x2="280" y2="64" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Search -->
  <rect x="16" y="80" width="248" height="36" rx="6" fill="#F5F5F5" stroke="#E0E0E0" stroke-width="1"/>
  <circle cx="32" cy="98" r="5" fill="none" stroke="#757575" stroke-width="1.5"/>
  <line x1="36" y1="102" x2="40" y2="106" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>
  <text x="50" y="103" class="text-disabled" font-size="13">Search</text>

  <!-- Nav items -->
  <rect x="8" y="140" width="264" height="36" rx="4" fill="#F5F5F5"/>
  <rect x="20" y="152" width="14" height="14" rx="2" fill="none" stroke="#424242" stroke-width="1.5"/>
  <text x="44" y="163" class="text-primary" font-size="14" font-weight="500">Dashboard</text>

  <rect x="20" y="194" width="14" height="14" rx="2" fill="none" stroke="#757575" stroke-width="1.5"/>
  <text x="44" y="205" class="text-secondary" font-size="14">Projects</text>

  <rect x="20" y="234" width="14" height="14" rx="2" fill="none" stroke="#757575" stroke-width="1.5"/>
  <text x="44" y="245" class="text-secondary" font-size="14">Reports</text>

  <rect x="20" y="274" width="14" height="14" rx="2" fill="none" stroke="#757575" stroke-width="1.5"/>
  <text x="44" y="285" class="text-secondary" font-size="14">Settings</text>

  <rect x="20" y="314" width="14" height="14" rx="2" fill="none" stroke="#757575" stroke-width="1.5"/>
  <text x="44" y="325" class="text-secondary" font-size="14">Team</text>

  <!-- Footer / account area -->
  <line x1="0" y1="744" x2="280" y2="744" stroke="#E0E0E0" stroke-width="1"/>
  <circle cx="32" cy="772" r="14" fill="#E0E0E0"/>
  <text x="32" y="776" text-anchor="middle" class="text-secondary" font-size="11" font-weight="600">AR</text>
  <text x="56" y="770" class="text-primary" font-size="13" font-weight="500">Alex Rivera</text>
  <text x="56" y="784" class="text-secondary" font-size="11">alex@example.com</text>
"""),

    "sidebar-collapsed": (64, 800, """
  <rect width="64" height="800" fill="#FFFFFF"/>
  <line x1="63.5" y1="0" x2="63.5" y2="800" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Brand mark -->
  <rect x="20" y="20" width="24" height="24" rx="4" fill="#424242"/>
  <line x1="0" y1="64" x2="64" y2="64" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Icon-only nav items -->
  <rect x="12" y="80" width="40" height="40" rx="4" fill="#F5F5F5"/>
  <rect x="24" y="92" width="16" height="16" rx="2" fill="none" stroke="#424242" stroke-width="1.5"/>

  <rect x="24" y="140" width="16" height="16" rx="2" fill="none" stroke="#757575" stroke-width="1.5"/>
  <rect x="24" y="188" width="16" height="16" rx="2" fill="none" stroke="#757575" stroke-width="1.5"/>
  <rect x="24" y="236" width="16" height="16" rx="2" fill="none" stroke="#757575" stroke-width="1.5"/>
  <rect x="24" y="284" width="16" height="16" rx="2" fill="none" stroke="#757575" stroke-width="1.5"/>

  <!-- Footer -->
  <line x1="0" y1="744" x2="64" y2="744" stroke="#E0E0E0" stroke-width="1"/>
  <circle cx="32" cy="772" r="14" fill="#E0E0E0"/>
  <text x="32" y="776" text-anchor="middle" class="text-secondary" font-size="11" font-weight="600">AR</text>
"""),

    "sidebar-with-sections": (280, 800, """
  <rect width="280" height="800" fill="#FFFFFF"/>
  <line x1="279.5" y1="0" x2="279.5" y2="800" stroke="#E0E0E0" stroke-width="1"/>

  <text x="16" y="36" class="text-primary" font-size="16" font-weight="700">Brand</text>
  <line x1="0" y1="64" x2="280" y2="64" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Workspace section -->
  <text x="16" y="98" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">WORKSPACE</text>
  <rect x="8" y="112" width="264" height="32" rx="4" fill="#F5F5F5"/>
  <text x="20" y="132" class="text-primary" font-size="14" font-weight="500">Dashboard</text>
  <text x="20" y="164" class="text-secondary" font-size="14">Projects</text>
  <text x="20" y="196" class="text-secondary" font-size="14">Reports</text>

  <!-- Account section -->
  <text x="16" y="248" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">ACCOUNT</text>
  <text x="20" y="282" class="text-secondary" font-size="14">Profile</text>
  <text x="20" y="314" class="text-secondary" font-size="14">Settings</text>
  <text x="20" y="346" class="text-secondary" font-size="14">Billing</text>

  <!-- Admin section -->
  <text x="16" y="398" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">ADMIN</text>
  <text x="20" y="432" class="text-secondary" font-size="14">Team</text>
  <text x="20" y="464" class="text-secondary" font-size="14">Permissions</text>
  <text x="20" y="496" class="text-secondary" font-size="14">Audit log</text>

  <!-- Footer -->
  <line x1="0" y1="744" x2="280" y2="744" stroke="#E0E0E0" stroke-width="1"/>
  <circle cx="32" cy="772" r="14" fill="#E0E0E0"/>
  <text x="32" y="776" text-anchor="middle" class="text-secondary" font-size="11" font-weight="600">AR</text>
  <text x="56" y="770" class="text-primary" font-size="13" font-weight="500">Alex Rivera</text>
  <text x="56" y="784" class="text-secondary" font-size="11">alex@example.com</text>
"""),

    # ═══════════════════ HEADER (3 variants) ═══════════════════

    "header-default": (1280, 64, """
  <rect width="1280" height="64" fill="#FFFFFF"/>
  <line x1="0" y1="63.5" x2="1280" y2="63.5" stroke="#E0E0E0" stroke-width="1"/>

  <text x="32" y="40" class="text-primary" font-size="16" font-weight="700">Brand</text>

  <!-- Primary nav -->
  <text x="200" y="40" class="text-primary" font-size="14" font-weight="600">Dashboard</text>
  <rect x="200" y="50" width="80" height="2" fill="#424242"/>
  <text x="316" y="40" class="text-secondary" font-size="14">Projects</text>
  <text x="404" y="40" class="text-secondary" font-size="14">Reports</text>
  <text x="488" y="40" class="text-secondary" font-size="14">Team</text>

  <!-- Right area: notifications + avatar -->
  <circle cx="1188" cy="32" r="10" fill="none" stroke="#757575" stroke-width="1.5"/>
  <line x1="1188" y1="22" x2="1188" y2="22" stroke="#757575" stroke-width="2" stroke-linecap="round"/>
  <circle cx="1192" cy="26" r="3" fill="#B71C1C"/>
  <circle cx="1232" cy="32" r="14" fill="#E0E0E0"/>
  <text x="1232" y="36" text-anchor="middle" class="text-secondary" font-size="11" font-weight="600">AR</text>
"""),

    "header-with-search": (1280, 64, """
  <rect width="1280" height="64" fill="#FFFFFF"/>
  <line x1="0" y1="63.5" x2="1280" y2="63.5" stroke="#E0E0E0" stroke-width="1"/>

  <text x="32" y="40" class="text-primary" font-size="16" font-weight="700">Brand</text>

  <!-- Search bar in center -->
  <rect x="320" y="14" width="640" height="36" rx="6" fill="#F5F5F5" stroke="#E0E0E0" stroke-width="1"/>
  <circle cx="338" cy="32" r="6" fill="none" stroke="#757575" stroke-width="1.5"/>
  <line x1="343" y1="37" x2="348" y2="42" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>
  <text x="358" y="37" class="text-disabled" font-size="14">Search projects, tasks, people...</text>

  <!-- Right area -->
  <circle cx="1188" cy="32" r="10" fill="none" stroke="#757575" stroke-width="1.5"/>
  <circle cx="1232" cy="32" r="14" fill="#E0E0E0"/>
  <text x="1232" y="36" text-anchor="middle" class="text-secondary" font-size="11" font-weight="600">AR</text>
"""),

    "header-with-actions": (1280, 64, """
  <rect width="1280" height="64" fill="#FFFFFF"/>
  <line x1="0" y1="63.5" x2="1280" y2="63.5" stroke="#E0E0E0" stroke-width="1"/>

  <text x="32" y="40" class="text-primary" font-size="16" font-weight="700">Brand</text>

  <!-- Primary nav -->
  <text x="200" y="40" class="text-primary" font-size="14" font-weight="600">Projects</text>
  <text x="288" y="40" class="text-secondary" font-size="14">Reports</text>
  <text x="372" y="40" class="text-secondary" font-size="14">Team</text>

  <!-- Action buttons -->
  <rect x="1064" y="14" width="100" height="36" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="1114" y="36" text-anchor="middle" class="text-secondary" font-size="13" font-weight="500">Invite</text>

  <rect x="1172" y="14" width="80" height="36" rx="6" fill="#424242"/>
  <text x="1212" y="36" text-anchor="middle" class="text-inverse" font-size="13" font-weight="500">+ New</text>
"""),

    # ═══════════════════ FORM (4 variants) ═══════════════════

    "form-single-column": (480, 480, """
  <rect width="480" height="480" fill="#FFFFFF"/>

  <!-- Field 1 -->
  <text x="0" y="14" class="text-secondary" font-size="12">Full name</text>
  <rect y="22" width="480" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="16" y="52" class="text-primary" font-size="14">Alex Rivera</text>

  <!-- Field 2 -->
  <text x="0" y="100" class="text-secondary" font-size="12">Email address</text>
  <rect y="108" width="480" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="16" y="138" class="text-primary" font-size="14">alex@example.com</text>

  <!-- Field 3 -->
  <text x="0" y="186" class="text-secondary" font-size="12">Role</text>
  <rect y="194" width="480" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="16" y="224" class="text-primary" font-size="14">Administrator</text>
  <path d="M 450 216 L 458 224 L 466 216" fill="none" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>

  <!-- Field 4 -->
  <text x="0" y="272" class="text-secondary" font-size="12">Bio</text>
  <rect y="280" width="480" height="96" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="16" y="304" class="text-disabled" font-size="14">Tell us about yourself...</text>

  <!-- Action row -->
  <rect x="296" y="408" width="84" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="338" y="438" text-anchor="middle" class="text-secondary" font-size="14" font-weight="500">Cancel</text>
  <rect x="396" y="408" width="84" height="48" rx="6" fill="#424242"/>
  <text x="438" y="438" text-anchor="middle" class="text-inverse" font-size="14" font-weight="500">Save</text>
"""),

    "form-two-column": (960, 320, """
  <rect width="960" height="320" fill="#FFFFFF"/>

  <!-- Row 1: First name | Last name -->
  <text x="0" y="14" class="text-secondary" font-size="12">First name</text>
  <rect y="22" width="464" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="16" y="52" class="text-primary" font-size="14">Alex</text>

  <text x="496" y="14" class="text-secondary" font-size="12">Last name</text>
  <rect x="496" y="22" width="464" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="512" y="52" class="text-primary" font-size="14">Rivera</text>

  <!-- Row 2: Email | Phone -->
  <text x="0" y="100" class="text-secondary" font-size="12">Email</text>
  <rect y="108" width="464" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="16" y="138" class="text-primary" font-size="14">alex@example.com</text>

  <text x="496" y="100" class="text-secondary" font-size="12">Phone</text>
  <rect x="496" y="108" width="464" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="512" y="138" class="text-disabled" font-size="14">+1 (555) 000-0000</text>

  <!-- Row 3: Role | Department -->
  <text x="0" y="186" class="text-secondary" font-size="12">Role</text>
  <rect y="194" width="464" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="16" y="224" class="text-primary" font-size="14">Administrator</text>

  <text x="496" y="186" class="text-secondary" font-size="12">Department</text>
  <rect x="496" y="194" width="464" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="512" y="224" class="text-primary" font-size="14">Engineering</text>

  <!-- Action row -->
  <rect x="776" y="272" width="84" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="818" y="302" text-anchor="middle" class="text-secondary" font-size="14" font-weight="500">Cancel</text>
  <rect x="876" y="272" width="84" height="48" rx="6" fill="#424242"/>
  <text x="918" y="302" text-anchor="middle" class="text-inverse" font-size="14" font-weight="500">Save</text>
"""),

    "form-inline": (960, 64, """
  <rect width="960" height="64" fill="#FFFFFF"/>

  <rect y="8" width="320" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="16" y="38" class="text-disabled" font-size="14">Search by keyword...</text>

  <rect x="336" y="8" width="200" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="352" y="38" class="text-primary" font-size="14">All categories</text>
  <path d="M 506 30 L 514 38 L 522 30" fill="none" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>

  <rect x="552" y="8" width="200" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="568" y="38" class="text-primary" font-size="14">Last 7 days</text>
  <path d="M 722 30 L 730 38 L 738 30" fill="none" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>

  <rect x="856" y="8" width="104" height="48" rx="6" fill="#424242"/>
  <text x="908" y="38" text-anchor="middle" class="text-inverse" font-size="14" font-weight="500">Apply</text>
"""),

    "form-wizard": (640, 480, """
  <rect width="640" height="480" fill="#FFFFFF"/>

  <!-- Stepper at top -->
  <circle cx="40" cy="32" r="14" fill="#424242"/>
  <path d="M 34 32 L 38 36 L 46 28" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="40" y="64" text-anchor="middle" class="text-secondary" font-size="12">Account</text>
  <line x1="54" y1="32" x2="306" y2="32" stroke="#424242" stroke-width="2"/>
  <circle cx="320" cy="32" r="14" fill="#424242"/>
  <text x="320" y="37" text-anchor="middle" class="text-inverse" font-size="12" font-weight="700">2</text>
  <text x="320" y="64" text-anchor="middle" class="text-primary" font-size="12" font-weight="600">Profile</text>
  <line x1="334" y1="32" x2="586" y2="32" stroke="#E0E0E0" stroke-width="2"/>
  <circle cx="600" cy="32" r="14" fill="none" stroke="#BDBDBD" stroke-width="1.5"/>
  <text x="600" y="37" text-anchor="middle" class="text-disabled" font-size="12" font-weight="700">3</text>
  <text x="600" y="64" text-anchor="middle" class="text-secondary" font-size="12">Confirm</text>

  <!-- Form fields for current step -->
  <text x="0" y="120" class="text-secondary" font-size="12">Display name</text>
  <rect y="128" width="640" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="16" y="158" class="text-primary" font-size="14">Alex Rivera</text>

  <text x="0" y="206" class="text-secondary" font-size="12">Bio</text>
  <rect y="214" width="640" height="96" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="16" y="238" class="text-disabled" font-size="14">Tell us about yourself...</text>

  <text x="0" y="342" class="text-secondary" font-size="12">Avatar</text>
  <rect y="350" width="640" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5" stroke-dasharray="4,4"/>
  <text x="320" y="380" text-anchor="middle" class="text-secondary" font-size="13">+ Upload an image</text>

  <!-- Action row: Back | Next -->
  <rect y="432" width="80" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="40" y="462" text-anchor="middle" class="text-secondary" font-size="14" font-weight="500">Back</text>

  <rect x="556" y="432" width="84" height="48" rx="6" fill="#424242"/>
  <text x="598" y="462" text-anchor="middle" class="text-inverse" font-size="14" font-weight="500">Next</text>
"""),

    # ═══════════════════ DATA_TABLE (4 variants) ═══════════════════

    "data-table-default": (960, 320, """
  <rect width="960" height="320" fill="#FFFFFF"/>

  <!-- Header row -->
  <text x="16" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">NAME</text>
  <text x="280" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">EMAIL</text>
  <text x="600" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">ROLE</text>
  <text x="800" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">STATUS</text>
  <text x="944" y="26" text-anchor="end" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">JOINED</text>
  <line x1="0" y1="40" x2="960" y2="40" stroke="#757575" stroke-width="1.5"/>

  <!-- Data rows -->
  <text x="16" y="68" class="text-primary" font-size="13">Alex Rivera</text>
  <text x="280" y="68" class="text-primary" font-size="13">alex@northwind.com</text>
  <text x="600" y="68" class="text-secondary" font-size="13">Administrator</text>
  <text x="800" y="68" class="text-success" font-size="13" font-weight="500">Active</text>
  <text x="944" y="68" text-anchor="end" class="text-secondary" font-size="13">Jan 2024</text>
  <line x1="0" y1="80" x2="960" y2="80" stroke="#E0E0E0" stroke-width="1"/>

  <text x="16" y="108" class="text-primary" font-size="13">Jordan Chen</text>
  <text x="280" y="108" class="text-primary" font-size="13">jordan@northwind.com</text>
  <text x="600" y="108" class="text-secondary" font-size="13">Editor</text>
  <text x="800" y="108" class="text-success" font-size="13" font-weight="500">Active</text>
  <text x="944" y="108" text-anchor="end" class="text-secondary" font-size="13">Mar 2024</text>
  <line x1="0" y1="120" x2="960" y2="120" stroke="#E0E0E0" stroke-width="1"/>

  <text x="16" y="148" class="text-primary" font-size="13">Sam Okafor</text>
  <text x="280" y="148" class="text-primary" font-size="13">sam@northwind.com</text>
  <text x="600" y="148" class="text-secondary" font-size="13">Editor</text>
  <text x="800" y="148" class="text-warning" font-size="13" font-weight="500">Pending</text>
  <text x="944" y="148" text-anchor="end" class="text-secondary" font-size="13">Apr 2024</text>
  <line x1="0" y1="160" x2="960" y2="160" stroke="#E0E0E0" stroke-width="1"/>

  <text x="16" y="188" class="text-primary" font-size="13">Taylor Kim</text>
  <text x="280" y="188" class="text-primary" font-size="13">taylor@northwind.com</text>
  <text x="600" y="188" class="text-secondary" font-size="13">Viewer</text>
  <text x="800" y="188" class="text-secondary" font-size="13">Inactive</text>
  <text x="944" y="188" text-anchor="end" class="text-secondary" font-size="13">May 2024</text>
  <line x1="0" y1="200" x2="960" y2="200" stroke="#E0E0E0" stroke-width="1"/>

  <text x="16" y="228" class="text-primary" font-size="13">Robin Patel</text>
  <text x="280" y="228" class="text-primary" font-size="13">robin@northwind.com</text>
  <text x="600" y="228" class="text-secondary" font-size="13">Administrator</text>
  <text x="800" y="228" class="text-success" font-size="13" font-weight="500">Active</text>
  <text x="944" y="228" text-anchor="end" class="text-secondary" font-size="13">Jun 2024</text>
  <line x1="0" y1="240" x2="960" y2="240" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Pagination footer -->
  <text x="0" y="294" class="text-secondary" font-size="12">5 of 247 employees</text>
  <text x="800" y="294" class="text-secondary" font-size="13">‹ Prev</text>
  <text x="880" y="294" text-anchor="middle" class="text-secondary" font-size="13">Page 1 of 50</text>
  <text x="960" y="294" text-anchor="end" class="text-secondary" font-size="13">Next ›</text>
"""),

    "data-table-with-actions": (960, 320, """
  <rect width="960" height="320" fill="#FFFFFF"/>

  <text x="16" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">NAME</text>
  <text x="280" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">EMAIL</text>
  <text x="600" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">ROLE</text>
  <text x="800" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">STATUS</text>
  <line x1="0" y1="40" x2="960" y2="40" stroke="#757575" stroke-width="1.5"/>

  <text x="16" y="68" class="text-primary" font-size="13">Alex Rivera</text>
  <text x="280" y="68" class="text-primary" font-size="13">alex@northwind.com</text>
  <text x="600" y="68" class="text-secondary" font-size="13">Administrator</text>
  <text x="800" y="68" class="text-success" font-size="13" font-weight="500">Active</text>
  <circle cx="932" cy="64" r="2" fill="#757575"/>
  <circle cx="940" cy="64" r="2" fill="#757575"/>
  <circle cx="948" cy="64" r="2" fill="#757575"/>
  <line x1="0" y1="80" x2="960" y2="80" stroke="#E0E0E0" stroke-width="1"/>

  <text x="16" y="108" class="text-primary" font-size="13">Jordan Chen</text>
  <text x="280" y="108" class="text-primary" font-size="13">jordan@northwind.com</text>
  <text x="600" y="108" class="text-secondary" font-size="13">Editor</text>
  <text x="800" y="108" class="text-success" font-size="13" font-weight="500">Active</text>
  <circle cx="932" cy="104" r="2" fill="#757575"/>
  <circle cx="940" cy="104" r="2" fill="#757575"/>
  <circle cx="948" cy="104" r="2" fill="#757575"/>
  <line x1="0" y1="120" x2="960" y2="120" stroke="#E0E0E0" stroke-width="1"/>

  <text x="16" y="148" class="text-primary" font-size="13">Sam Okafor</text>
  <text x="280" y="148" class="text-primary" font-size="13">sam@northwind.com</text>
  <text x="600" y="148" class="text-secondary" font-size="13">Editor</text>
  <text x="800" y="148" class="text-warning" font-size="13" font-weight="500">Pending</text>
  <circle cx="932" cy="144" r="2" fill="#757575"/>
  <circle cx="940" cy="144" r="2" fill="#757575"/>
  <circle cx="948" cy="144" r="2" fill="#757575"/>
  <line x1="0" y1="160" x2="960" y2="160" stroke="#E0E0E0" stroke-width="1"/>

  <text x="16" y="188" class="text-primary" font-size="13">Taylor Kim</text>
  <text x="280" y="188" class="text-primary" font-size="13">taylor@northwind.com</text>
  <text x="600" y="188" class="text-secondary" font-size="13">Viewer</text>
  <text x="800" y="188" class="text-secondary" font-size="13">Inactive</text>
  <circle cx="932" cy="184" r="2" fill="#757575"/>
  <circle cx="940" cy="184" r="2" fill="#757575"/>
  <circle cx="948" cy="184" r="2" fill="#757575"/>
  <line x1="0" y1="200" x2="960" y2="200" stroke="#E0E0E0" stroke-width="1"/>
"""),

    "data-table-with-pagination": (960, 360, """
  <rect width="960" height="360" fill="#FFFFFF"/>

  <text x="16" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">NAME</text>
  <text x="320" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">EMAIL</text>
  <text x="700" y="26" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">ROLE</text>
  <line x1="0" y1="40" x2="960" y2="40" stroke="#757575" stroke-width="1.5"/>

  <text x="16" y="68" class="text-primary" font-size="13">Alex Rivera</text>
  <text x="320" y="68" class="text-primary" font-size="13">alex@northwind.com</text>
  <text x="700" y="68" class="text-secondary" font-size="13">Administrator</text>
  <line x1="0" y1="80" x2="960" y2="80" stroke="#E0E0E0" stroke-width="1"/>

  <text x="16" y="108" class="text-primary" font-size="13">Jordan Chen</text>
  <text x="320" y="108" class="text-primary" font-size="13">jordan@northwind.com</text>
  <text x="700" y="108" class="text-secondary" font-size="13">Editor</text>
  <line x1="0" y1="120" x2="960" y2="120" stroke="#E0E0E0" stroke-width="1"/>

  <text x="16" y="148" class="text-primary" font-size="13">Sam Okafor</text>
  <text x="320" y="148" class="text-primary" font-size="13">sam@northwind.com</text>
  <text x="700" y="148" class="text-secondary" font-size="13">Editor</text>
  <line x1="0" y1="160" x2="960" y2="160" stroke="#E0E0E0" stroke-width="1"/>

  <text x="16" y="188" class="text-primary" font-size="13">Taylor Kim</text>
  <text x="320" y="188" class="text-primary" font-size="13">taylor@northwind.com</text>
  <text x="700" y="188" class="text-secondary" font-size="13">Viewer</text>
  <line x1="0" y1="200" x2="960" y2="200" stroke="#E0E0E0" stroke-width="1"/>

  <text x="16" y="228" class="text-primary" font-size="13">Robin Patel</text>
  <text x="320" y="228" class="text-primary" font-size="13">robin@northwind.com</text>
  <text x="700" y="228" class="text-secondary" font-size="13">Administrator</text>
  <line x1="0" y1="240" x2="960" y2="240" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Prominent pagination at bottom -->
  <line x1="0" y1="288" x2="960" y2="288" stroke="#E0E0E0" stroke-width="1"/>
  <text x="16" y="320" class="text-secondary" font-size="13">Showing 1–5 of 247 employees</text>

  <text x="624" y="320" class="text-secondary" font-size="13">‹ Prev</text>
  <rect x="688" y="304" width="32" height="32" rx="4" fill="#F5F5F5"/>
  <text x="704" y="324" text-anchor="middle" class="text-primary" font-size="13" font-weight="600">1</text>
  <text x="736" y="324" text-anchor="middle" class="text-secondary" font-size="13">2</text>
  <text x="768" y="324" text-anchor="middle" class="text-secondary" font-size="13">3</text>
  <text x="800" y="324" text-anchor="middle" class="text-disabled" font-size="13">…</text>
  <text x="832" y="324" text-anchor="middle" class="text-secondary" font-size="13">50</text>
  <text x="900" y="320" class="text-secondary" font-size="13">Next ›</text>
"""),

    "data-table-with-filters": (960, 400, """
  <rect width="960" height="400" fill="#FFFFFF"/>

  <!-- Filter row above table -->
  <text x="0" y="14" class="text-secondary" font-size="12" font-weight="600" letter-spacing="0.5">FILTERS</text>
  <rect x="0" y="22" width="80" height="28" rx="14" fill="#424242"/>
  <text x="40" y="40" text-anchor="middle" class="text-inverse" font-size="11" font-weight="500">All</text>
  <rect x="88" y="22" width="80" height="28" rx="14" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="128" y="40" text-anchor="middle" class="text-secondary" font-size="11">Active</text>
  <rect x="176" y="22" width="100" height="28" rx="14" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="226" y="40" text-anchor="middle" class="text-secondary" font-size="11">Pending</text>
  <rect x="284" y="22" width="80" height="28" rx="14" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="324" y="40" text-anchor="middle" class="text-secondary" font-size="11">Inactive</text>

  <text x="960" y="40" text-anchor="end" class="text-secondary" font-size="12">247 results</text>

  <!-- Table -->
  <text x="16" y="86" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">NAME</text>
  <text x="280" y="86" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">EMAIL</text>
  <text x="600" y="86" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">ROLE</text>
  <text x="800" y="86" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">STATUS</text>
  <line x1="0" y1="100" x2="960" y2="100" stroke="#757575" stroke-width="1.5"/>

  <text x="16" y="128" class="text-primary" font-size="13">Alex Rivera</text>
  <text x="280" y="128" class="text-primary" font-size="13">alex@northwind.com</text>
  <text x="600" y="128" class="text-secondary" font-size="13">Administrator</text>
  <text x="800" y="128" class="text-success" font-size="13" font-weight="500">Active</text>
  <line x1="0" y1="140" x2="960" y2="140" stroke="#E0E0E0" stroke-width="1"/>

  <text x="16" y="168" class="text-primary" font-size="13">Jordan Chen</text>
  <text x="280" y="168" class="text-primary" font-size="13">jordan@northwind.com</text>
  <text x="600" y="168" class="text-secondary" font-size="13">Editor</text>
  <text x="800" y="168" class="text-success" font-size="13" font-weight="500">Active</text>
  <line x1="0" y1="180" x2="960" y2="180" stroke="#E0E0E0" stroke-width="1"/>

  <text x="16" y="208" class="text-primary" font-size="13">Sam Okafor</text>
  <text x="280" y="208" class="text-primary" font-size="13">sam@northwind.com</text>
  <text x="600" y="208" class="text-secondary" font-size="13">Editor</text>
  <text x="800" y="208" class="text-success" font-size="13" font-weight="500">Active</text>
  <line x1="0" y1="220" x2="960" y2="220" stroke="#E0E0E0" stroke-width="1"/>

  <text x="16" y="248" class="text-primary" font-size="13">Taylor Kim</text>
  <text x="280" y="248" class="text-primary" font-size="13">taylor@northwind.com</text>
  <text x="600" y="248" class="text-secondary" font-size="13">Viewer</text>
  <text x="800" y="248" class="text-success" font-size="13" font-weight="500">Active</text>
  <line x1="0" y1="260" x2="960" y2="260" stroke="#E0E0E0" stroke-width="1"/>
"""),

    # ═══════════════════ MODAL (4 variants) ═══════════════════

    "modal-default": (1280, 800, """
  <!-- Page background dimmed -->
  <rect width="1280" height="800" fill="#212121" opacity="0.4"/>

  <!-- Modal container -->
  <rect x="400" y="240" width="480" height="320" rx="8" fill="#FFFFFF"/>

  <!-- Title bar -->
  <text x="424" y="280" class="text-primary" font-size="16" font-weight="700">Modal title</text>
  <text x="856" y="284" text-anchor="end" class="text-secondary" font-size="18">×</text>
  <line x1="424" y1="300" x2="856" y2="300" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Body -->
  <text x="424" y="332" class="text-primary" font-size="14">Body content goes here. Modals are focused overlays</text>
  <text x="424" y="354" class="text-primary" font-size="14">for confirmations, forms, or detail views.</text>

  <text x="424" y="394" class="text-secondary" font-size="13">Lorem ipsum dolor sit amet, consectetur adipiscing</text>
  <text x="424" y="414" class="text-secondary" font-size="13">elit. Sed do eiusmod tempor incididunt ut labore.</text>

  <!-- Action row -->
  <line x1="424" y1="496" x2="856" y2="496" stroke="#E0E0E0" stroke-width="1"/>
  <rect x="672" y="512" width="84" height="40" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="714" y="538" text-anchor="middle" class="text-secondary" font-size="14" font-weight="500">Cancel</text>
  <rect x="772" y="512" width="84" height="40" rx="6" fill="#424242"/>
  <text x="814" y="538" text-anchor="middle" class="text-inverse" font-size="14" font-weight="500">Confirm</text>
"""),

    "modal-confirmation": (1280, 800, """
  <rect width="1280" height="800" fill="#212121" opacity="0.4"/>

  <rect x="460" y="304" width="360" height="200" rx="8" fill="#FFFFFF"/>

  <!-- No title bar; just title + body + actions -->
  <text x="484" y="344" class="text-primary" font-size="16" font-weight="700">Delete this item?</text>

  <text x="484" y="384" class="text-secondary" font-size="13">This action cannot be undone. The item</text>
  <text x="484" y="402" class="text-secondary" font-size="13">will be permanently removed.</text>

  <rect x="612" y="448" width="84" height="40" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="654" y="474" text-anchor="middle" class="text-secondary" font-size="14" font-weight="500">Cancel</text>
  <rect x="712" y="448" width="84" height="40" rx="6" fill="#B71C1C"/>
  <text x="754" y="474" text-anchor="middle" class="text-inverse" font-size="14" font-weight="500">Delete</text>
"""),

    "modal-form": (1280, 800, """
  <rect width="1280" height="800" fill="#212121" opacity="0.4"/>

  <rect x="360" y="160" width="560" height="480" rx="8" fill="#FFFFFF"/>

  <!-- Title bar -->
  <text x="384" y="200" class="text-primary" font-size="16" font-weight="700">Create new project</text>
  <text x="896" y="204" text-anchor="end" class="text-secondary" font-size="18">×</text>
  <line x1="384" y1="220" x2="896" y2="220" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Form body -->
  <text x="384" y="256" class="text-secondary" font-size="12">Project name</text>
  <rect x="384" y="264" width="512" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="400" y="294" class="text-disabled" font-size="14">e.g. Q1 Marketing Campaign</text>

  <text x="384" y="342" class="text-secondary" font-size="12">Description</text>
  <rect x="384" y="350" width="512" height="96" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="400" y="374" class="text-disabled" font-size="14">What's this project about?</text>

  <text x="384" y="476" class="text-secondary" font-size="12">Visibility</text>
  <rect x="384" y="484" width="512" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="400" y="514" class="text-primary" font-size="14">Team only</text>
  <path d="M 866 506 L 874 514 L 882 506" fill="none" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>

  <!-- Action row -->
  <line x1="384" y1="576" x2="896" y2="576" stroke="#E0E0E0" stroke-width="1"/>
  <rect x="712" y="592" width="84" height="40" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="754" y="618" text-anchor="middle" class="text-secondary" font-size="14" font-weight="500">Cancel</text>
  <rect x="812" y="592" width="84" height="40" rx="6" fill="#424242"/>
  <text x="854" y="618" text-anchor="middle" class="text-inverse" font-size="14" font-weight="500">Create</text>
"""),

    "modal-wide": (1280, 800, """
  <rect width="1280" height="800" fill="#212121" opacity="0.4"/>

  <rect x="80" y="80" width="1120" height="640" rx="8" fill="#FFFFFF"/>

  <text x="112" y="120" class="text-primary" font-size="18" font-weight="700">Wide modal — used for table edits, image previews, complex flows</text>
  <text x="1168" y="124" text-anchor="end" class="text-secondary" font-size="18">×</text>
  <line x1="112" y1="140" x2="1168" y2="140" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Body placeholder showing scale -->
  <rect x="112" y="172" width="1056" height="480" rx="6" fill="#F5F5F5" stroke="#E0E0E0" stroke-width="1" stroke-dasharray="4,4"/>
  <text x="640" y="412" text-anchor="middle" class="text-secondary" font-size="14">Wide content area — 1056 × 480px</text>

  <!-- Action row -->
  <line x1="112" y1="676" x2="1168" y2="676" stroke="#E0E0E0" stroke-width="1"/>
  <rect x="984" y="692" width="84" height="40" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="1026" y="718" text-anchor="middle" class="text-secondary" font-size="14" font-weight="500">Cancel</text>
  <rect x="1084" y="692" width="84" height="40" rx="6" fill="#424242"/>
  <text x="1126" y="718" text-anchor="middle" class="text-inverse" font-size="14" font-weight="500">Done</text>
"""),

    # ═══════════════════ DRAWER (3 variants) ═══════════════════

    "drawer-right": (1280, 800, """
  <rect width="1280" height="800" fill="#212121" opacity="0.4"/>

  <rect x="880" y="0" width="400" height="800" fill="#FFFFFF"/>
  <line x1="879.5" y1="0" x2="879.5" y2="800" stroke="#E0E0E0" stroke-width="1"/>

  <text x="904" y="40" class="text-primary" font-size="16" font-weight="700">Drawer panel</text>
  <text x="1256" y="44" text-anchor="end" class="text-secondary" font-size="18">×</text>
  <line x1="880" y1="60" x2="1280" y2="60" stroke="#E0E0E0" stroke-width="1"/>

  <text x="904" y="100" class="text-secondary" font-size="13">Slides in from the right edge.</text>
  <text x="904" y="120" class="text-secondary" font-size="13">Useful for contextual editing,</text>
  <text x="904" y="140" class="text-secondary" font-size="13">filters, or detail panels.</text>

  <!-- Form fields demonstrating content -->
  <text x="904" y="200" class="text-secondary" font-size="12">Status</text>
  <rect x="904" y="208" width="352" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="920" y="238" class="text-primary" font-size="14">Active</text>
  <path d="M 1226 230 L 1234 238 L 1242 230" fill="none" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>

  <text x="904" y="288" class="text-secondary" font-size="12">Assignee</text>
  <rect x="904" y="296" width="352" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <circle cx="924" cy="320" r="10" fill="#E0E0E0"/>
  <text x="924" y="324" text-anchor="middle" class="text-secondary" font-size="11" font-weight="600">AR</text>
  <text x="944" y="326" class="text-primary" font-size="14">Alex Rivera</text>

  <!-- Footer actions -->
  <line x1="880" y1="744" x2="1280" y2="744" stroke="#E0E0E0" stroke-width="1"/>
  <rect x="1072" y="760" width="84" height="32" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="1114" y="780" text-anchor="middle" class="text-secondary" font-size="13" font-weight="500">Cancel</text>
  <rect x="1172" y="760" width="84" height="32" rx="6" fill="#424242"/>
  <text x="1214" y="780" text-anchor="middle" class="text-inverse" font-size="13" font-weight="500">Save</text>
"""),

    "drawer-left": (1280, 800, """
  <rect width="1280" height="800" fill="#212121" opacity="0.4"/>

  <rect x="0" y="0" width="320" height="800" fill="#FFFFFF"/>
  <line x1="320.5" y1="0" x2="320.5" y2="800" stroke="#E0E0E0" stroke-width="1"/>

  <text x="24" y="40" class="text-primary" font-size="16" font-weight="700">Menu</text>
  <text x="296" y="44" text-anchor="end" class="text-secondary" font-size="18">×</text>
  <line x1="0" y1="60" x2="320" y2="60" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Nav items -->
  <text x="24" y="100" class="text-primary" font-size="14" font-weight="500">Dashboard</text>
  <text x="24" y="140" class="text-secondary" font-size="14">Projects</text>
  <text x="24" y="180" class="text-secondary" font-size="14">Reports</text>
  <text x="24" y="220" class="text-secondary" font-size="14">Team</text>
  <text x="24" y="260" class="text-secondary" font-size="14">Settings</text>

  <!-- Footer -->
  <line x1="0" y1="744" x2="320" y2="744" stroke="#E0E0E0" stroke-width="1"/>
  <circle cx="40" cy="772" r="14" fill="#E0E0E0"/>
  <text x="40" y="776" text-anchor="middle" class="text-secondary" font-size="11" font-weight="600">AR</text>
  <text x="64" y="770" class="text-primary" font-size="13" font-weight="500">Alex Rivera</text>
  <text x="64" y="784" class="text-secondary" font-size="11">Sign out</text>
"""),

    "drawer-bottom": (1280, 800, """
  <rect width="1280" height="800" fill="#212121" opacity="0.4"/>

  <rect x="0" y="500" width="1280" height="300" rx="0" fill="#FFFFFF"/>
  <line x1="0" y1="499.5" x2="1280" y2="499.5" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Drag handle -->
  <rect x="612" y="512" width="56" height="4" rx="2" fill="#E0E0E0"/>

  <text x="32" y="552" class="text-primary" font-size="16" font-weight="700">Action sheet</text>
  <text x="1248" y="556" text-anchor="end" class="text-secondary" font-size="18">×</text>
  <line x1="32" y1="572" x2="1248" y2="572" stroke="#E0E0E0" stroke-width="1"/>

  <text x="32" y="612" class="text-primary" font-size="14">Share with team</text>
  <line x1="32" y1="624" x2="1248" y2="624" stroke="#E0E0E0" stroke-width="1"/>
  <text x="32" y="660" class="text-primary" font-size="14">Copy link</text>
  <line x1="32" y1="672" x2="1248" y2="672" stroke="#E0E0E0" stroke-width="1"/>
  <text x="32" y="708" class="text-primary" font-size="14">Download</text>
  <line x1="32" y1="720" x2="1248" y2="720" stroke="#E0E0E0" stroke-width="1"/>
  <text x="32" y="756" class="text-danger" font-size="14">Delete</text>
"""),

    # ═══════════════════ EMPTY_STATE (4 variants) ═══════════════════

    "empty-state-no-data": (640, 400, """
  <rect width="640" height="400" fill="#FFFFFF"/>

  <!-- Illustration placeholder -->
  <rect x="288" y="80" width="64" height="64" rx="8" fill="none" stroke="#BDBDBD" stroke-width="2" stroke-dasharray="4,4"/>
  <line x1="296" y1="100" x2="344" y2="100" stroke="#BDBDBD" stroke-width="1.5"/>
  <line x1="296" y1="116" x2="344" y2="116" stroke="#BDBDBD" stroke-width="1.5"/>
  <line x1="296" y1="132" x2="320" y2="132" stroke="#BDBDBD" stroke-width="1.5"/>

  <text x="320" y="200" text-anchor="middle" class="text-primary" font-size="16" font-weight="700">No projects yet</text>
  <text x="320" y="232" text-anchor="middle" class="text-secondary" font-size="13">Get started by creating your first project.</text>
  <text x="320" y="252" text-anchor="middle" class="text-secondary" font-size="13">It only takes a minute.</text>

  <rect x="252" y="288" width="136" height="48" rx="6" fill="#424242"/>
  <text x="320" y="318" text-anchor="middle" class="text-inverse" font-size="14" font-weight="500">+ Create project</text>
"""),

    "empty-state-no-results": (640, 400, """
  <rect width="640" height="400" fill="#FFFFFF"/>

  <!-- Search-illustration placeholder -->
  <circle cx="320" cy="120" r="28" fill="none" stroke="#BDBDBD" stroke-width="2"/>
  <line x1="340" y1="140" x2="356" y2="156" stroke="#BDBDBD" stroke-width="2" stroke-linecap="round"/>

  <text x="320" y="208" text-anchor="middle" class="text-primary" font-size="16" font-weight="700">No matching results</text>
  <text x="320" y="240" text-anchor="middle" class="text-secondary" font-size="13">Try adjusting your search or filters to find</text>
  <text x="320" y="260" text-anchor="middle" class="text-secondary" font-size="13">what you're looking for.</text>

  <rect x="252" y="288" width="136" height="40" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="320" y="314" text-anchor="middle" class="text-secondary" font-size="13" font-weight="500">Clear filters</text>
"""),

    "empty-state-first-use": (640, 400, """
  <rect width="640" height="400" fill="#FFFFFF"/>

  <!-- Welcome-illustration placeholder -->
  <rect x="288" y="64" width="64" height="64" rx="32" fill="none" stroke="#BDBDBD" stroke-width="2"/>
  <text x="320" y="106" text-anchor="middle" class="text-secondary" font-size="24">+</text>

  <text x="320" y="180" text-anchor="middle" class="text-primary" font-size="18" font-weight="700">Welcome aboard</text>
  <text x="320" y="216" text-anchor="middle" class="text-secondary" font-size="13">Your workspace is ready. Let's set things up</text>
  <text x="320" y="236" text-anchor="middle" class="text-secondary" font-size="13">so the team can get to work.</text>

  <rect x="244" y="280" width="152" height="48" rx="6" fill="#424242"/>
  <text x="320" y="310" text-anchor="middle" class="text-inverse" font-size="14" font-weight="500">Get started</text>

  <text x="320" y="356" text-anchor="middle" class="text-secondary" font-size="12">Or take a tour first</text>
"""),

    "empty-state-error": (640, 400, """
  <rect width="640" height="400" fill="#FFFFFF"/>

  <!-- Error-illustration placeholder -->
  <circle cx="320" cy="120" r="28" fill="none" stroke="#B71C1C" stroke-width="2"/>
  <line x1="308" y1="108" x2="332" y2="132" stroke="#B71C1C" stroke-width="2" stroke-linecap="round"/>
  <line x1="332" y1="108" x2="308" y2="132" stroke="#B71C1C" stroke-width="2" stroke-linecap="round"/>

  <text x="320" y="208" text-anchor="middle" class="text-primary" font-size="16" font-weight="700">Something went wrong</text>
  <text x="320" y="240" text-anchor="middle" class="text-secondary" font-size="13">We couldn't load this content. Check your</text>
  <text x="320" y="260" text-anchor="middle" class="text-secondary" font-size="13">connection and try again.</text>

  <rect x="252" y="288" width="136" height="40" rx="6" fill="#424242"/>
  <text x="320" y="314" text-anchor="middle" class="text-inverse" font-size="13" font-weight="500">Retry</text>
"""),

    # ═══════════════════ COMMAND_PALETTE (3 variants) ═══════════════════

    "command-palette-default": (1280, 800, """
  <rect width="1280" height="800" fill="#212121" opacity="0.4"/>

  <rect x="380" y="120" width="520" height="400" rx="8" fill="#FFFFFF"/>

  <!-- Search input at top -->
  <rect x="380" y="120" width="520" height="56" fill="#FFFFFF"/>
  <line x1="380" y1="176" x2="900" y2="176" stroke="#E0E0E0" stroke-width="1"/>
  <circle cx="408" cy="148" r="6" fill="none" stroke="#757575" stroke-width="1.5"/>
  <line x1="413" y1="153" x2="418" y2="158" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>
  <text x="430" y="153" class="text-primary" font-size="14">Type a command or search...</text>

  <!-- Result items -->
  <rect x="396" y="192" width="488" height="40" rx="4" fill="#F5F5F5"/>
  <text x="412" y="216" class="text-primary" font-size="14" font-weight="500">Create new project</text>
  <text x="868" y="216" text-anchor="end" class="text-secondary" font-size="12">⌘N</text>

  <text x="412" y="256" class="text-primary" font-size="14">Open recent file</text>
  <text x="868" y="256" text-anchor="end" class="text-secondary" font-size="12">⌘O</text>

  <text x="412" y="296" class="text-primary" font-size="14">Search documentation</text>
  <text x="868" y="296" text-anchor="end" class="text-secondary" font-size="12">⌘D</text>

  <text x="412" y="336" class="text-primary" font-size="14">Toggle theme</text>
  <text x="868" y="336" text-anchor="end" class="text-secondary" font-size="12">⌘T</text>

  <text x="412" y="376" class="text-primary" font-size="14">Sign out</text>
  <text x="868" y="376" text-anchor="end" class="text-secondary" font-size="12">⌘⇧Q</text>

  <!-- Footer with help text -->
  <line x1="380" y1="488" x2="900" y2="488" stroke="#E0E0E0" stroke-width="1"/>
  <text x="396" y="508" class="text-secondary" font-size="11">↑↓ navigate · ↵ select · esc close</text>
"""),

    "command-palette-with-groups": (1280, 800, """
  <rect width="1280" height="800" fill="#212121" opacity="0.4"/>

  <rect x="380" y="100" width="520" height="480" rx="8" fill="#FFFFFF"/>

  <rect x="380" y="100" width="520" height="56" fill="#FFFFFF"/>
  <line x1="380" y1="156" x2="900" y2="156" stroke="#E0E0E0" stroke-width="1"/>
  <circle cx="408" cy="128" r="6" fill="none" stroke="#757575" stroke-width="1.5"/>
  <line x1="413" y1="133" x2="418" y2="138" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>
  <text x="430" y="133" class="text-primary" font-size="14">create</text>

  <!-- Group: Recent -->
  <text x="396" y="184" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">RECENT</text>
  <rect x="396" y="196" width="488" height="40" rx="4" fill="#F5F5F5"/>
  <text x="412" y="220" class="text-primary" font-size="14" font-weight="500">Create new project</text>

  <text x="412" y="260" class="text-primary" font-size="14">Create new task</text>

  <!-- Group: All -->
  <text x="396" y="296" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">ALL COMMANDS</text>
  <text x="412" y="324" class="text-primary" font-size="14">Create from template</text>
  <text x="412" y="364" class="text-primary" font-size="14">Create folder</text>
  <text x="412" y="404" class="text-primary" font-size="14">Create invite link</text>
  <text x="412" y="444" class="text-primary" font-size="14">Create webhook</text>

  <line x1="380" y1="548" x2="900" y2="548" stroke="#E0E0E0" stroke-width="1"/>
  <text x="396" y="568" class="text-secondary" font-size="11">↑↓ navigate · ↵ select · esc close</text>
"""),

    "command-palette-with-recent": (1280, 800, """
  <rect width="1280" height="800" fill="#212121" opacity="0.4"/>

  <rect x="380" y="120" width="520" height="440" rx="8" fill="#FFFFFF"/>

  <rect x="380" y="120" width="520" height="56" fill="#FFFFFF"/>
  <line x1="380" y1="176" x2="900" y2="176" stroke="#E0E0E0" stroke-width="1"/>
  <circle cx="408" cy="148" r="6" fill="none" stroke="#757575" stroke-width="1.5"/>
  <line x1="413" y1="153" x2="418" y2="158" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>
  <text x="430" y="153" class="text-disabled" font-size="14">Type a command or search...</text>

  <text x="396" y="200" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">RECENT</text>
  <text x="412" y="228" class="text-primary" font-size="14">Create new project</text>
  <text x="412" y="260" class="text-primary" font-size="14">Open project: Northwind</text>
  <text x="412" y="292" class="text-primary" font-size="14">Switch workspace</text>

  <text x="396" y="328" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">SUGGESTED</text>
  <text x="412" y="356" class="text-primary" font-size="14">Invite teammates</text>
  <text x="412" y="388" class="text-primary" font-size="14">Connect integration</text>
  <text x="412" y="420" class="text-primary" font-size="14">Set up notifications</text>

  <line x1="380" y1="496" x2="900" y2="496" stroke="#E0E0E0" stroke-width="1"/>
  <text x="396" y="516" class="text-secondary" font-size="11">↑↓ navigate · ↵ select · esc close · ⌘K close</text>
"""),

    # ═══════════════════ SETTINGS_LAYOUT (2 variants) ═══════════════════

    "settings-layout-default": (1280, 800, """
  <rect width="1280" height="800" fill="#FFFFFF"/>

  <!-- Settings sidebar -->
  <rect width="240" height="800" fill="#FFFFFF"/>
  <line x1="240" y1="0" x2="240" y2="800" stroke="#E0E0E0" stroke-width="1"/>

  <text x="24" y="40" class="text-primary" font-size="16" font-weight="700">Settings</text>
  <line x1="0" y1="64" x2="240" y2="64" stroke="#E0E0E0" stroke-width="1"/>

  <rect x="8" y="80" width="224" height="36" rx="4" fill="#F5F5F5"/>
  <text x="24" y="103" class="text-primary" font-size="14" font-weight="500">Profile</text>

  <text x="24" y="143" class="text-secondary" font-size="14">Account</text>
  <text x="24" y="183" class="text-secondary" font-size="14">Notifications</text>
  <text x="24" y="223" class="text-secondary" font-size="14">Security</text>
  <text x="24" y="263" class="text-secondary" font-size="14">Integrations</text>
  <text x="24" y="303" class="text-secondary" font-size="14">Billing</text>

  <!-- Content panel -->
  <text x="280" y="48" class="text-primary" font-size="18" font-weight="700">Profile settings</text>
  <text x="280" y="76" class="text-secondary" font-size="13">Update your personal information.</text>
  <line x1="280" y1="104" x2="1248" y2="104" stroke="#E0E0E0" stroke-width="1"/>

  <text x="280" y="148" class="text-primary" font-size="14" font-weight="600">Display name</text>
  <text x="280" y="170" class="text-secondary" font-size="13">Shown on your profile and in messages.</text>
  <rect x="280" y="190" width="480" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="296" y="220" class="text-primary" font-size="14">Alex Rivera</text>

  <line x1="280" y1="278" x2="1248" y2="278" stroke="#E0E0E0" stroke-width="1"/>

  <text x="280" y="322" class="text-primary" font-size="14" font-weight="600">Email address</text>
  <text x="280" y="344" class="text-secondary" font-size="13">Used for account access and notifications.</text>
  <rect x="280" y="364" width="480" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="296" y="394" class="text-primary" font-size="14">alex@example.com</text>

  <line x1="280" y1="452" x2="1248" y2="452" stroke="#E0E0E0" stroke-width="1"/>

  <text x="280" y="496" class="text-primary" font-size="14" font-weight="600">Avatar</text>
  <text x="280" y="518" class="text-secondary" font-size="13">A square image works best.</text>
  <circle cx="304" cy="556" r="24" fill="#E0E0E0"/>
  <text x="304" y="562" text-anchor="middle" class="text-secondary" font-size="14" font-weight="600">AR</text>
  <rect x="344" y="540" width="100" height="32" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="394" y="560" text-anchor="middle" class="text-secondary" font-size="13" font-weight="500">Upload</text>

  <line x1="280" y1="608" x2="1248" y2="608" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Save action -->
  <rect x="280" y="640" width="100" height="40" rx="6" fill="#424242"/>
  <text x="330" y="666" text-anchor="middle" class="text-inverse" font-size="13" font-weight="500">Save changes</text>
"""),

    "settings-layout-with-subsections": (1280, 800, """
  <rect width="1280" height="800" fill="#FFFFFF"/>

  <rect width="240" height="800" fill="#FFFFFF"/>
  <line x1="240" y1="0" x2="240" y2="800" stroke="#E0E0E0" stroke-width="1"/>

  <text x="24" y="40" class="text-primary" font-size="16" font-weight="700">Settings</text>
  <line x1="0" y1="64" x2="240" y2="64" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Section: Personal -->
  <text x="24" y="98" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">PERSONAL</text>
  <rect x="8" y="112" width="224" height="32" rx="4" fill="#F5F5F5"/>
  <text x="24" y="132" class="text-primary" font-size="14" font-weight="500">Profile</text>
  <text x="24" y="164" class="text-secondary" font-size="14">Account</text>
  <text x="24" y="196" class="text-secondary" font-size="14">Preferences</text>

  <!-- Section: Workspace -->
  <text x="24" y="248" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">WORKSPACE</text>
  <text x="24" y="282" class="text-secondary" font-size="14">Members</text>
  <text x="24" y="314" class="text-secondary" font-size="14">Roles</text>
  <text x="24" y="346" class="text-secondary" font-size="14">Permissions</text>

  <!-- Section: Billing -->
  <text x="24" y="398" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">BILLING</text>
  <text x="24" y="432" class="text-secondary" font-size="14">Plan</text>
  <text x="24" y="464" class="text-secondary" font-size="14">Invoices</text>
  <text x="24" y="496" class="text-secondary" font-size="14">Payment methods</text>

  <!-- Content panel -->
  <text x="280" y="48" class="text-primary" font-size="18" font-weight="700">Profile</text>
  <text x="280" y="76" class="text-secondary" font-size="13">Manage how you appear across the workspace.</text>
  <line x1="280" y1="104" x2="1248" y2="104" stroke="#E0E0E0" stroke-width="1"/>

  <text x="280" y="148" class="text-primary" font-size="14" font-weight="600">Display name</text>
  <rect x="280" y="170" width="480" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="296" y="200" class="text-primary" font-size="14">Alex Rivera</text>

  <text x="280" y="262" class="text-primary" font-size="14" font-weight="600">Pronouns</text>
  <rect x="280" y="284" width="480" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="296" y="314" class="text-disabled" font-size="14">they/them</text>

  <text x="280" y="376" class="text-primary" font-size="14" font-weight="600">Time zone</text>
  <rect x="280" y="398" width="480" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="296" y="428" class="text-primary" font-size="14">America/Los_Angeles</text>
  <path d="M 730 420 L 738 428 L 746 420" fill="none" stroke="#757575" stroke-width="1.5" stroke-linecap="round"/>

  <rect x="280" y="488" width="100" height="40" rx="6" fill="#424242"/>
  <text x="330" y="514" text-anchor="middle" class="text-inverse" font-size="13" font-weight="500">Save changes</text>
"""),

    # ═══════════════════ ARTICLE (3 variants) ═══════════════════

    "article-default": (720, 800, """
  <rect width="720" height="800" fill="#FFFFFF"/>

  <text x="0" y="40" class="text-primary" font-size="24" font-weight="700">Article title goes here</text>
  <text x="0" y="64" class="text-secondary" font-size="13">By Alex Rivera · 4 min read · April 24, 2026</text>
  <line x1="0" y1="84" x2="720" y2="84" stroke="#E0E0E0" stroke-width="1"/>

  <text x="0" y="124" class="text-primary" font-size="14">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod</text>
  <text x="0" y="146" class="text-primary" font-size="14">tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim</text>
  <text x="0" y="168" class="text-primary" font-size="14">veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea</text>
  <text x="0" y="190" class="text-primary" font-size="14">commodo consequat.</text>

  <text x="0" y="240" class="text-primary" font-size="18" font-weight="600">A subheading</text>

  <text x="0" y="280" class="text-primary" font-size="14">Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore</text>
  <text x="0" y="302" class="text-primary" font-size="14">eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident,</text>
  <text x="0" y="324" class="text-primary" font-size="14">sunt in culpa qui officia deserunt mollit anim id est laborum.</text>

  <!-- Pull quote -->
  <line x1="0" y1="380" x2="3" y2="440" stroke="#424242" stroke-width="3"/>
  <text x="20" y="400" class="text-secondary" font-size="16" font-style="italic">"Quotation pulled out for emphasis — sets the</text>
  <text x="20" y="424" class="text-secondary" font-size="16" font-style="italic">tone for the section that follows."</text>

  <text x="0" y="488" class="text-primary" font-size="14">Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium</text>
  <text x="0" y="510" class="text-primary" font-size="14">doloremque laudantium, totam rem aperiam.</text>

  <text x="0" y="560" class="text-primary" font-size="18" font-weight="600">Another subheading</text>

  <text x="0" y="600" class="text-primary" font-size="14">Eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae</text>
  <text x="0" y="622" class="text-primary" font-size="14">dicta sunt explicabo. Nemo enim ipsam voluptatem.</text>
"""),

    "article-with-toc": (1040, 800, """
  <rect width="1040" height="800" fill="#FFFFFF"/>

  <!-- TOC sidebar -->
  <text x="0" y="40" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">ON THIS PAGE</text>
  <text x="0" y="80" class="text-primary" font-size="13" font-weight="500">Introduction</text>
  <text x="0" y="108" class="text-secondary" font-size="13">A subheading</text>
  <text x="0" y="136" class="text-secondary" font-size="13">Pull quote</text>
  <text x="0" y="164" class="text-secondary" font-size="13">Another subheading</text>
  <text x="0" y="192" class="text-secondary" font-size="13">Conclusion</text>

  <!-- Article body -->
  <line x1="240" y1="0" x2="240" y2="800" stroke="#E0E0E0" stroke-width="1"/>

  <text x="280" y="40" class="text-primary" font-size="24" font-weight="700">Article title goes here</text>
  <text x="280" y="64" class="text-secondary" font-size="13">By Alex Rivera · 4 min read · April 24, 2026</text>
  <line x1="280" y1="84" x2="1000" y2="84" stroke="#E0E0E0" stroke-width="1"/>

  <text x="280" y="124" class="text-primary" font-size="14">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod</text>
  <text x="280" y="146" class="text-primary" font-size="14">tempor incididunt ut labore et dolore magna aliqua.</text>

  <text x="280" y="200" class="text-primary" font-size="18" font-weight="600">A subheading</text>

  <text x="280" y="240" class="text-primary" font-size="14">Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore</text>
  <text x="280" y="262" class="text-primary" font-size="14">eu fugiat nulla pariatur.</text>

  <line x1="280" y1="316" x2="283" y2="376" stroke="#424242" stroke-width="3"/>
  <text x="300" y="336" class="text-secondary" font-size="16" font-style="italic">"Quotation pulled out for emphasis."</text>

  <text x="280" y="424" class="text-primary" font-size="14">Sed ut perspiciatis unde omnis iste natus error sit voluptatem.</text>
"""),

    "article-with-sidebar-meta": (1040, 800, """
  <rect width="1040" height="800" fill="#FFFFFF"/>

  <!-- Article body (left) -->
  <text x="0" y="40" class="text-primary" font-size="24" font-weight="700">Article title goes here</text>
  <text x="0" y="64" class="text-secondary" font-size="13">By Alex Rivera · 4 min read</text>
  <line x1="0" y1="84" x2="720" y2="84" stroke="#E0E0E0" stroke-width="1"/>

  <text x="0" y="124" class="text-primary" font-size="14">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod</text>
  <text x="0" y="146" class="text-primary" font-size="14">tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim</text>
  <text x="0" y="168" class="text-primary" font-size="14">veniam, quis nostrud exercitation.</text>

  <text x="0" y="220" class="text-primary" font-size="18" font-weight="600">A subheading</text>

  <text x="0" y="260" class="text-primary" font-size="14">Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore</text>
  <text x="0" y="282" class="text-primary" font-size="14">eu fugiat nulla pariatur.</text>

  <!-- Sidebar meta (right) -->
  <line x1="760" y1="0" x2="760" y2="800" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Author block -->
  <text x="800" y="40" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">AUTHOR</text>
  <circle cx="816" cy="76" r="20" fill="#E0E0E0"/>
  <text x="816" y="80" text-anchor="middle" class="text-secondary" font-size="11" font-weight="600">AR</text>
  <text x="844" y="72" class="text-primary" font-size="14" font-weight="500">Alex Rivera</text>
  <text x="844" y="88" class="text-secondary" font-size="12">Senior Editor</text>

  <line x1="800" y1="124" x2="1020" y2="124" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Tags -->
  <text x="800" y="160" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">TAGS</text>
  <rect x="800" y="172" width="60" height="22" rx="11" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="830" y="187" text-anchor="middle" class="text-secondary" font-size="11">design</text>
  <rect x="868" y="172" width="80" height="22" rx="11" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="908" y="187" text-anchor="middle" class="text-secondary" font-size="11">wireframes</text>
  <rect x="800" y="204" width="60" height="22" rx="11" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="830" y="219" text-anchor="middle" class="text-secondary" font-size="11">tools</text>

  <line x1="800" y1="252" x2="1020" y2="252" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Related -->
  <text x="800" y="288" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">RELATED ARTICLES</text>
  <text x="800" y="320" class="text-primary" font-size="13" font-weight="500">A guide to design tokens</text>
  <text x="800" y="338" class="text-secondary" font-size="12">3 min read</text>

  <text x="800" y="376" class="text-primary" font-size="13" font-weight="500">Building a component library</text>
  <text x="800" y="394" class="text-secondary" font-size="12">7 min read</text>

  <text x="800" y="432" class="text-primary" font-size="13" font-weight="500">When to use system fonts</text>
  <text x="800" y="450" class="text-secondary" font-size="12">5 min read</text>
"""),

    # ═══════════════════ DASHBOARD (4 variants) ═══════════════════

    "dashboard-metrics-heavy": (1280, 800, """
  <rect width="1280" height="800" fill="#F5F5F5"/>

  <!-- Sidebar -->
  <rect width="240" height="800" fill="#FFFFFF"/>
  <line x1="240" y1="0" x2="240" y2="800" stroke="#E0E0E0" stroke-width="1"/>
  <text x="24" y="40" class="text-primary" font-size="16" font-weight="700">Brand</text>
  <line x1="0" y1="64" x2="240" y2="64" stroke="#E0E0E0" stroke-width="1"/>
  <rect x="8" y="80" width="224" height="36" rx="4" fill="#F5F5F5"/>
  <text x="24" y="103" class="text-primary" font-size="14" font-weight="500">Dashboard</text>
  <text x="24" y="143" class="text-secondary" font-size="14">Reports</text>
  <text x="24" y="183" class="text-secondary" font-size="14">Settings</text>

  <!-- Header -->
  <rect x="240" y="0" width="1040" height="64" fill="#FFFFFF"/>
  <line x1="240" y1="63.5" x2="1280" y2="63.5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="272" y="40" class="text-primary" font-size="18" font-weight="700">Overview</text>

  <!-- Stats row -->
  <rect x="272" y="96" width="232" height="120" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="288" y="124" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">REVENUE</text>
  <text x="288" y="160" class="text-primary" font-size="24" font-weight="700">$24,580</text>
  <text x="288" y="184" class="text-success" font-size="12" font-weight="600">▲ +12%</text>
  <text x="320" y="184" class="text-secondary" font-size="12">vs. last month</text>

  <rect x="520" y="96" width="232" height="120" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="536" y="124" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">SIGNUPS</text>
  <text x="536" y="160" class="text-primary" font-size="24" font-weight="700">1,247</text>
  <text x="536" y="184" class="text-success" font-size="12" font-weight="600">▲ +8%</text>
  <text x="566" y="184" class="text-secondary" font-size="12">vs. last month</text>

  <rect x="768" y="96" width="232" height="120" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="784" y="124" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">ACTIVE USERS</text>
  <text x="784" y="160" class="text-primary" font-size="24" font-weight="700">8,934</text>
  <text x="784" y="184" class="text-danger" font-size="12" font-weight="600">▼ -3%</text>
  <text x="814" y="184" class="text-secondary" font-size="12">vs. last month</text>

  <rect x="1016" y="96" width="232" height="120" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="1032" y="124" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">CONVERSION</text>
  <text x="1032" y="160" class="text-primary" font-size="24" font-weight="700">3.4%</text>
  <text x="1032" y="184" class="text-success" font-size="12" font-weight="600">▲ +0.4%</text>
  <text x="1078" y="184" class="text-secondary" font-size="12">vs. last month</text>

  <!-- Chart placeholder -->
  <rect x="272" y="240" width="640" height="320" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="288" y="268" class="text-primary" font-size="14" font-weight="600">Revenue over time</text>
  <text x="288" y="284" class="text-secondary" font-size="12">Last 30 days</text>
  <line x1="288" y1="296" x2="896" y2="296" stroke="#E0E0E0" stroke-width="1"/>
  <polyline points="288,520 348,500 408,510 468,470 528,480 588,440 648,450 708,400 768,420 828,380 888,360"
            fill="none" stroke="#424242" stroke-width="2"/>

  <!-- Side table -->
  <rect x="928" y="240" width="320" height="320" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="944" y="268" class="text-primary" font-size="14" font-weight="600">Top sources</text>
  <line x1="944" y1="284" x2="1232" y2="284" stroke="#E0E0E0" stroke-width="1"/>
  <text x="944" y="312" class="text-primary" font-size="13">Direct</text>
  <text x="1232" y="312" text-anchor="end" class="text-secondary" font-size="13">42%</text>
  <text x="944" y="344" class="text-primary" font-size="13">Search</text>
  <text x="1232" y="344" text-anchor="end" class="text-secondary" font-size="13">28%</text>
  <text x="944" y="376" class="text-primary" font-size="13">Referral</text>
  <text x="1232" y="376" text-anchor="end" class="text-secondary" font-size="13">18%</text>
  <text x="944" y="408" class="text-primary" font-size="13">Social</text>
  <text x="1232" y="408" text-anchor="end" class="text-secondary" font-size="13">8%</text>
  <text x="944" y="440" class="text-primary" font-size="13">Email</text>
  <text x="1232" y="440" text-anchor="end" class="text-secondary" font-size="13">4%</text>
"""),

    "dashboard-conversation": (1280, 800, """
  <rect width="1280" height="800" fill="#FFFFFF"/>

  <!-- Sidebar with thread list -->
  <rect width="320" height="800" fill="#FFFFFF"/>
  <line x1="320" y1="0" x2="320" y2="800" stroke="#E0E0E0" stroke-width="1"/>

  <text x="24" y="40" class="text-primary" font-size="16" font-weight="700">Messages</text>
  <line x1="0" y1="64" x2="320" y2="64" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Search -->
  <rect x="16" y="80" width="288" height="36" rx="6" fill="#F5F5F5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="32" y="103" class="text-disabled" font-size="13">Search conversations</text>

  <!-- Thread list -->
  <rect x="0" y="132" width="320" height="80" fill="#F5F5F5"/>
  <circle cx="32" cy="172" r="16" fill="#E0E0E0"/>
  <text x="32" y="176" text-anchor="middle" class="text-secondary" font-size="11" font-weight="600">AR</text>
  <text x="60" y="164" class="text-primary" font-size="14" font-weight="600">Alex Rivera</text>
  <text x="60" y="184" class="text-secondary" font-size="12">Latest message preview…</text>
  <text x="304" y="164" text-anchor="end" class="text-secondary" font-size="11">2m</text>
  <line x1="0" y1="211.5" x2="320" y2="211.5" stroke="#E0E0E0" stroke-width="1"/>

  <circle cx="32" cy="252" r="16" fill="#E0E0E0"/>
  <text x="32" y="256" text-anchor="middle" class="text-secondary" font-size="11" font-weight="600">JC</text>
  <text x="60" y="244" class="text-primary" font-size="14" font-weight="500">Jordan Chen</text>
  <text x="60" y="264" class="text-secondary" font-size="12">Sounds good, let's plan it…</text>
  <text x="304" y="244" text-anchor="end" class="text-secondary" font-size="11">1h</text>
  <line x1="0" y1="291.5" x2="320" y2="291.5" stroke="#E0E0E0" stroke-width="1"/>

  <circle cx="32" cy="332" r="16" fill="#E0E0E0"/>
  <text x="32" y="336" text-anchor="middle" class="text-secondary" font-size="11" font-weight="600">SO</text>
  <text x="60" y="324" class="text-primary" font-size="14" font-weight="500">Sam Okafor</text>
  <text x="60" y="344" class="text-secondary" font-size="12">Thanks for the update.</text>
  <text x="304" y="324" text-anchor="end" class="text-secondary" font-size="11">3h</text>
  <line x1="0" y1="371.5" x2="320" y2="371.5" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Conversation header -->
  <rect x="320" y="0" width="960" height="64" fill="#FFFFFF"/>
  <line x1="320" y1="63.5" x2="1280" y2="63.5" stroke="#E0E0E0" stroke-width="1"/>
  <circle cx="356" cy="32" r="14" fill="#E0E0E0"/>
  <text x="356" y="36" text-anchor="middle" class="text-secondary" font-size="11" font-weight="600">AR</text>
  <text x="380" y="28" class="text-primary" font-size="14" font-weight="600">Alex Rivera</text>
  <text x="380" y="46" class="text-secondary" font-size="12">Active now</text>

  <!-- Messages -->
  <rect x="368" y="100" width="320" height="48" rx="6" fill="#F5F5F5"/>
  <text x="384" y="128" class="text-primary" font-size="14">Hey, can we sync on the project today?</text>

  <rect x="900" y="172" width="320" height="48" rx="6" fill="#424242"/>
  <text x="916" y="200" class="text-inverse" font-size="14">Sure! 3pm works great.</text>

  <rect x="368" y="244" width="380" height="80" rx="6" fill="#F5F5F5"/>
  <text x="384" y="272" class="text-primary" font-size="14">Perfect. I'll send the agenda over so we</text>
  <text x="384" y="294" class="text-primary" font-size="14">can hit the ground running.</text>
  <text x="384" y="316" class="text-secondary" font-size="11">2:14 PM</text>

  <rect x="900" y="348" width="320" height="48" rx="6" fill="#424242"/>
  <text x="916" y="376" class="text-inverse" font-size="14">Thanks!</text>

  <!-- Composer -->
  <line x1="320" y1="704" x2="1280" y2="704" stroke="#E0E0E0" stroke-width="1"/>
  <rect x="368" y="724" width="864" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="384" y="754" class="text-disabled" font-size="14">Type a message…</text>
  <rect x="1184" y="730" width="44" height="36" rx="6" fill="#424242"/>
  <text x="1206" y="754" text-anchor="middle" class="text-inverse" font-size="14">→</text>
"""),

    "dashboard-list-focus": (1280, 800, """
  <rect width="1280" height="800" fill="#F5F5F5"/>

  <!-- Sidebar -->
  <rect width="240" height="800" fill="#FFFFFF"/>
  <line x1="240" y1="0" x2="240" y2="800" stroke="#E0E0E0" stroke-width="1"/>
  <text x="24" y="40" class="text-primary" font-size="16" font-weight="700">Brand</text>
  <line x1="0" y1="64" x2="240" y2="64" stroke="#E0E0E0" stroke-width="1"/>
  <rect x="8" y="80" width="224" height="36" rx="4" fill="#F5F5F5"/>
  <text x="24" y="103" class="text-primary" font-size="14" font-weight="500">Projects</text>
  <text x="24" y="143" class="text-secondary" font-size="14">Tasks</text>
  <text x="24" y="183" class="text-secondary" font-size="14">Team</text>

  <!-- Header -->
  <rect x="240" y="0" width="1040" height="64" fill="#FFFFFF"/>
  <line x1="240" y1="63.5" x2="1280" y2="63.5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="272" y="40" class="text-primary" font-size="18" font-weight="700">Projects</text>
  <rect x="1184" y="14" width="80" height="36" rx="6" fill="#424242"/>
  <text x="1224" y="36" text-anchor="middle" class="text-inverse" font-size="13" font-weight="500">+ New</text>

  <!-- Filter row -->
  <rect x="272" y="96" width="320" height="36" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="288" y="119" class="text-disabled" font-size="13">Search projects</text>
  <rect x="608" y="96" width="100" height="36" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="624" y="119" class="text-primary" font-size="13">Status</text>
  <rect x="724" y="96" width="100" height="36" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="740" y="119" class="text-primary" font-size="13">Owner</text>

  <!-- List of cards -->
  <rect x="272" y="156" width="976" height="80" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="296" y="184" class="text-primary" font-size="14" font-weight="600">Q1 Marketing Campaign</text>
  <text x="296" y="204" class="text-secondary" font-size="12">8 tasks · 4 members · Updated 2h ago</text>
  <text x="1224" y="184" text-anchor="end" class="text-success" font-size="12" font-weight="500">On track</text>

  <rect x="272" y="252" width="976" height="80" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="296" y="280" class="text-primary" font-size="14" font-weight="600">Brand refresh</text>
  <text x="296" y="300" class="text-secondary" font-size="12">12 tasks · 6 members · Updated 1d ago</text>
  <text x="1224" y="280" text-anchor="end" class="text-warning" font-size="12" font-weight="500">At risk</text>

  <rect x="272" y="348" width="976" height="80" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="296" y="376" class="text-primary" font-size="14" font-weight="600">Customer research</text>
  <text x="296" y="396" class="text-secondary" font-size="12">5 tasks · 3 members · Updated 3d ago</text>
  <text x="1224" y="376" text-anchor="end" class="text-success" font-size="12" font-weight="500">On track</text>

  <rect x="272" y="444" width="976" height="80" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="296" y="472" class="text-primary" font-size="14" font-weight="600">Product launch — Q2</text>
  <text x="296" y="492" class="text-secondary" font-size="12">24 tasks · 8 members · Updated 2d ago</text>
  <text x="1224" y="472" text-anchor="end" class="text-success" font-size="12" font-weight="500">On track</text>

  <rect x="272" y="540" width="976" height="80" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="296" y="568" class="text-primary" font-size="14" font-weight="600">Documentation overhaul</text>
  <text x="296" y="588" class="text-secondary" font-size="12">17 tasks · 2 members · Updated 5d ago</text>
  <text x="1224" y="568" text-anchor="end" class="text-secondary" font-size="12" font-weight="500">Paused</text>
"""),

    "dashboard-mixed": (1280, 800, """
  <rect width="1280" height="800" fill="#F5F5F5"/>

  <!-- Sidebar -->
  <rect width="240" height="800" fill="#FFFFFF"/>
  <line x1="240" y1="0" x2="240" y2="800" stroke="#E0E0E0" stroke-width="1"/>
  <text x="24" y="40" class="text-primary" font-size="16" font-weight="700">Brand</text>
  <line x1="0" y1="64" x2="240" y2="64" stroke="#E0E0E0" stroke-width="1"/>
  <rect x="8" y="80" width="224" height="36" rx="4" fill="#F5F5F5"/>
  <text x="24" y="103" class="text-primary" font-size="14" font-weight="500">Overview</text>
  <text x="24" y="143" class="text-secondary" font-size="14">Projects</text>
  <text x="24" y="183" class="text-secondary" font-size="14">Reports</text>

  <!-- Header -->
  <rect x="240" y="0" width="1040" height="64" fill="#FFFFFF"/>
  <line x1="240" y1="63.5" x2="1280" y2="63.5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="272" y="40" class="text-primary" font-size="18" font-weight="700">Good morning, Alex</text>

  <!-- Top stats strip -->
  <rect x="272" y="96" width="232" height="96" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="288" y="120" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">REVENUE</text>
  <text x="288" y="156" class="text-primary" font-size="24" font-weight="700">$24,580</text>
  <text x="288" y="178" class="text-success" font-size="11" font-weight="600">▲ +12%</text>

  <rect x="520" y="96" width="232" height="96" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="536" y="120" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">PROJECTS</text>
  <text x="536" y="156" class="text-primary" font-size="24" font-weight="700">12</text>
  <text x="536" y="178" class="text-success" font-size="11" font-weight="600">▲ +2 this week</text>

  <rect x="768" y="96" width="232" height="96" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="784" y="120" class="text-secondary" font-size="11" font-weight="600" letter-spacing="0.5">TASKS</text>
  <text x="784" y="156" class="text-primary" font-size="24" font-weight="700">47</text>
  <text x="784" y="178" class="text-secondary" font-size="11" font-weight="600">23 due this week</text>

  <!-- Middle: project list (left) + activity (right) -->
  <rect x="272" y="216" width="608" height="544" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="288" y="244" class="text-primary" font-size="14" font-weight="600">Active projects</text>
  <text x="864" y="244" text-anchor="end" class="text-secondary" font-size="12">View all</text>
  <line x1="288" y1="260" x2="864" y2="260" stroke="#E0E0E0" stroke-width="1"/>

  <text x="288" y="288" class="text-primary" font-size="13" font-weight="500">Q1 Marketing Campaign</text>
  <text x="288" y="306" class="text-secondary" font-size="11">8 tasks · Updated 2h ago</text>
  <text x="864" y="294" text-anchor="end" class="text-success" font-size="11" font-weight="500">On track</text>
  <line x1="288" y1="324" x2="864" y2="324" stroke="#E0E0E0" stroke-width="1"/>

  <text x="288" y="352" class="text-primary" font-size="13" font-weight="500">Brand refresh</text>
  <text x="288" y="370" class="text-secondary" font-size="11">12 tasks · Updated 1d ago</text>
  <text x="864" y="358" text-anchor="end" class="text-warning" font-size="11" font-weight="500">At risk</text>
  <line x1="288" y1="388" x2="864" y2="388" stroke="#E0E0E0" stroke-width="1"/>

  <text x="288" y="416" class="text-primary" font-size="13" font-weight="500">Customer research</text>
  <text x="288" y="434" class="text-secondary" font-size="11">5 tasks · Updated 3d ago</text>
  <text x="864" y="422" text-anchor="end" class="text-success" font-size="11" font-weight="500">On track</text>
  <line x1="288" y1="452" x2="864" y2="452" stroke="#E0E0E0" stroke-width="1"/>

  <text x="288" y="480" class="text-primary" font-size="13" font-weight="500">Product launch — Q2</text>
  <text x="288" y="498" class="text-secondary" font-size="11">24 tasks · Updated 2d ago</text>
  <text x="864" y="486" text-anchor="end" class="text-success" font-size="11" font-weight="500">On track</text>

  <!-- Activity feed (right) -->
  <rect x="896" y="216" width="352" height="544" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="912" y="244" class="text-primary" font-size="14" font-weight="600">Recent activity</text>
  <line x1="912" y1="260" x2="1232" y2="260" stroke="#E0E0E0" stroke-width="1"/>

  <circle cx="924" cy="292" r="10" fill="#E0E0E0"/>
  <text x="924" y="296" text-anchor="middle" class="text-secondary" font-size="11" font-weight="600">JC</text>
  <text x="944" y="288" class="text-primary" font-size="12" font-weight="500">Jordan Chen</text>
  <text x="944" y="304" class="text-secondary" font-size="11">Updated brand refresh status</text>
  <text x="944" y="320" class="text-disabled" font-size="11">15 min ago</text>

  <circle cx="924" cy="356" r="10" fill="#E0E0E0"/>
  <text x="924" y="360" text-anchor="middle" class="text-secondary" font-size="11" font-weight="600">SO</text>
  <text x="944" y="352" class="text-primary" font-size="12" font-weight="500">Sam Okafor</text>
  <text x="944" y="368" class="text-secondary" font-size="11">Created task in Q1 Marketing</text>
  <text x="944" y="384" class="text-disabled" font-size="11">1h ago</text>

  <circle cx="924" cy="420" r="10" fill="#E0E0E0"/>
  <text x="924" y="424" text-anchor="middle" class="text-secondary" font-size="11" font-weight="600">TK</text>
  <text x="944" y="416" class="text-primary" font-size="12" font-weight="500">Taylor Kim</text>
  <text x="944" y="432" class="text-secondary" font-size="11">Completed 4 tasks today</text>
  <text x="944" y="448" class="text-disabled" font-size="11">2h ago</text>

  <circle cx="924" cy="484" r="10" fill="#E0E0E0"/>
  <text x="924" y="488" text-anchor="middle" class="text-secondary" font-size="11" font-weight="600">RP</text>
  <text x="944" y="480" class="text-primary" font-size="12" font-weight="500">Robin Patel</text>
  <text x="944" y="496" class="text-secondary" font-size="11">Joined Customer research</text>
  <text x="944" y="512" class="text-disabled" font-size="11">5h ago</text>
"""),

    # ═══════════════════ AUTH (4 variants) ═══════════════════

    "auth-sign-in": (1280, 800, """
  <rect width="1280" height="800" fill="#F5F5F5"/>

  <!-- Centered card -->
  <rect x="440" y="200" width="400" height="424" rx="8" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>

  <text x="640" y="248" text-anchor="middle" class="text-primary" font-size="18" font-weight="700">Sign in to your account</text>
  <text x="640" y="276" text-anchor="middle" class="text-secondary" font-size="13">Welcome back. Enter your details below.</text>

  <text x="472" y="324" class="text-secondary" font-size="12">Email address</text>
  <rect x="472" y="332" width="336" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="488" y="362" class="text-disabled" font-size="14">user@example.com</text>

  <text x="472" y="404" class="text-secondary" font-size="12">Password</text>
  <text x="808" y="404" text-anchor="end" class="text-secondary" font-size="12">Forgot?</text>
  <rect x="472" y="412" width="336" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="488" y="442" class="text-disabled" font-size="14">••••••••</text>

  <rect x="472" y="488" width="336" height="48" rx="6" fill="#424242"/>
  <text x="640" y="518" text-anchor="middle" class="text-inverse" font-size="14" font-weight="500">Sign in</text>

  <line x1="472" y1="568" x2="808" y2="568" stroke="#E0E0E0" stroke-width="1"/>
  <text x="640" y="600" text-anchor="middle" class="text-secondary" font-size="13">Don't have an account? <tspan class="text-primary" font-weight="500">Create one</tspan></text>
"""),

    "auth-sign-up": (1280, 800, """
  <rect width="1280" height="800" fill="#F5F5F5"/>

  <rect x="440" y="120" width="400" height="568" rx="8" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>

  <text x="640" y="168" text-anchor="middle" class="text-primary" font-size="18" font-weight="700">Create your account</text>
  <text x="640" y="196" text-anchor="middle" class="text-secondary" font-size="13">Get started — it only takes a minute.</text>

  <text x="472" y="244" class="text-secondary" font-size="12">Full name</text>
  <rect x="472" y="252" width="336" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="488" y="282" class="text-disabled" font-size="14">Alex Rivera</text>

  <text x="472" y="324" class="text-secondary" font-size="12">Email address</text>
  <rect x="472" y="332" width="336" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="488" y="362" class="text-disabled" font-size="14">user@example.com</text>

  <text x="472" y="404" class="text-secondary" font-size="12">Password</text>
  <rect x="472" y="412" width="336" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="488" y="442" class="text-disabled" font-size="14">8+ characters</text>

  <!-- Terms checkbox -->
  <rect x="472" y="488" width="20" height="20" rx="4" fill="none" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="500" y="503" class="text-secondary" font-size="12">I agree to the <tspan class="text-primary">Terms of Service</tspan></text>

  <rect x="472" y="528" width="336" height="48" rx="6" fill="#424242"/>
  <text x="640" y="558" text-anchor="middle" class="text-inverse" font-size="14" font-weight="500">Create account</text>

  <line x1="472" y1="608" x2="808" y2="608" stroke="#E0E0E0" stroke-width="1"/>
  <text x="640" y="640" text-anchor="middle" class="text-secondary" font-size="13">Already have an account? <tspan class="text-primary" font-weight="500">Sign in</tspan></text>
"""),

    "auth-reset-password": (1280, 800, """
  <rect width="1280" height="800" fill="#F5F5F5"/>

  <rect x="440" y="240" width="400" height="320" rx="8" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>

  <text x="640" y="288" text-anchor="middle" class="text-primary" font-size="18" font-weight="700">Reset your password</text>
  <text x="640" y="316" text-anchor="middle" class="text-secondary" font-size="13">Enter your email and we'll send a reset link.</text>
  <text x="640" y="334" text-anchor="middle" class="text-secondary" font-size="13"></text>

  <text x="472" y="368" class="text-secondary" font-size="12">Email address</text>
  <rect x="472" y="376" width="336" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="488" y="406" class="text-disabled" font-size="14">user@example.com</text>

  <rect x="472" y="448" width="336" height="48" rx="6" fill="#424242"/>
  <text x="640" y="478" text-anchor="middle" class="text-inverse" font-size="14" font-weight="500">Send reset link</text>

  <text x="640" y="528" text-anchor="middle" class="text-secondary" font-size="13"><tspan class="text-primary" font-weight="500">← Back to sign in</tspan></text>
"""),

    "auth-verify-code": (1280, 800, """
  <rect width="1280" height="800" fill="#F5F5F5"/>

  <rect x="440" y="200" width="400" height="400" rx="8" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>

  <text x="640" y="248" text-anchor="middle" class="text-primary" font-size="18" font-weight="700">Check your email</text>
  <text x="640" y="284" text-anchor="middle" class="text-secondary" font-size="13">We sent a 6-digit code to</text>
  <text x="640" y="302" text-anchor="middle" class="text-primary" font-size="13" font-weight="500">user@example.com</text>

  <!-- 6 digit boxes -->
  <rect x="472" y="356" width="48" height="56" rx="6" fill="#FFFFFF" stroke="#424242" stroke-width="2"/>
  <text x="496" y="392" text-anchor="middle" class="text-primary" font-size="18" font-weight="600">4</text>

  <rect x="528" y="356" width="48" height="56" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="552" y="392" text-anchor="middle" class="text-primary" font-size="18" font-weight="600">2</text>

  <rect x="584" y="356" width="48" height="56" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="608" y="392" text-anchor="middle" class="text-primary" font-size="18" font-weight="600">9</text>

  <rect x="648" y="356" width="48" height="56" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="672" y="392" text-anchor="middle" class="text-disabled" font-size="18" font-weight="600">_</text>

  <rect x="704" y="356" width="48" height="56" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="728" y="392" text-anchor="middle" class="text-disabled" font-size="18" font-weight="600">_</text>

  <rect x="760" y="356" width="48" height="56" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="784" y="392" text-anchor="middle" class="text-disabled" font-size="18" font-weight="600">_</text>

  <rect x="472" y="448" width="336" height="48" rx="6" fill="#424242"/>
  <text x="640" y="478" text-anchor="middle" class="text-inverse" font-size="14" font-weight="500">Verify</text>

  <text x="640" y="540" text-anchor="middle" class="text-secondary" font-size="13">Didn't receive it? <tspan class="text-primary" font-weight="500">Resend</tspan></text>
"""),

    # ═════════════════════════════════════════════════════════════════════
    # MOBILE VARIANTS (375px) — added in Phase 2 (Item 5)
    # ─────────────────────────────────────────────────────────────────────
    # One mobile variant per base pattern. Methodology per the
    # wireframe-skill: mobile is the canonical layout; desktop is its
    # expansion. These are drafted from the canonical mobile vocabulary
    # (vertical stacking, top nav strip with hamburger, list rows, bottom
    # sheets, full-bleed modals).
    # ═════════════════════════════════════════════════════════════════════

    # Sidebar (mobile) — collapses to a vertical nav-list strip with
    # brand at the top, search beneath, then nav items as full-width rows
    # with hairline dividers. Width = 375.
    "sidebar-mobile": (375, 720, """
  <rect width="375" height="720" fill="#FFFFFF"/>

  <!-- Brand bar -->
  <rect width="375" height="56" fill="#FFFFFF"/>
  <text x="16" y="34" class="text-primary" font-size="16" font-weight="700">Northwind</text>
  <text x="343" y="34" text-anchor="end" class="text-primary" font-size="18">×</text>
  <line x1="0" y1="55.5" x2="375" y2="55.5" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Search -->
  <rect x="16" y="72" width="343" height="40" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="32" y="98" class="text-disabled" font-size="13">Search</text>

  <!-- Nav items -->
  <text x="16" y="148" class="text-secondary" font-size="11" font-weight="600">WORKSPACE</text>
  <text x="16" y="184" class="text-primary" font-size="14" font-weight="500">Dashboard</text>
  <line x1="16" y1="207.5" x2="359" y2="207.5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="16" y="232" class="text-primary" font-size="14">Threads</text>
  <text x="343" y="232" text-anchor="end" class="text-secondary" font-size="13">12</text>
  <line x1="16" y1="255.5" x2="359" y2="255.5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="16" y="280" class="text-primary" font-size="14">Drafts</text>
  <line x1="16" y1="303.5" x2="359" y2="303.5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="16" y="328" class="text-primary" font-size="14">Archive</text>

  <text x="16" y="380" class="text-secondary" font-size="11" font-weight="600">ACCOUNT</text>
  <text x="16" y="416" class="text-primary" font-size="14">Settings</text>
  <line x1="16" y1="439.5" x2="359" y2="439.5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="16" y="464" class="text-primary" font-size="14">Help</text>

  <!-- Footer with user -->
  <line x1="0" y1="664.5" x2="375" y2="664.5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="16" y="694" class="text-primary" font-size="13" font-weight="500">Alex Rivera</text>
  <text x="16" y="710" class="text-secondary" font-size="11">alex@example.com</text>
"""),

    # Header (mobile) — 56-tall top bar with hamburger left, brand center,
    # action right.
    "header-mobile": (375, 56, """
  <rect width="375" height="56" fill="#FFFFFF"/>
  <line x1="0" y1="55.5" x2="375" y2="55.5" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Hamburger -->
  <line x1="20" y1="22" x2="36" y2="22" stroke="#212121" stroke-width="1.5"/>
  <line x1="20" y1="28" x2="36" y2="28" stroke="#212121" stroke-width="1.5"/>
  <line x1="20" y1="34" x2="36" y2="34" stroke="#212121" stroke-width="1.5"/>

  <!-- Centered brand -->
  <text x="187.5" y="34" text-anchor="middle" class="text-primary" font-size="16" font-weight="600">Northwind</text>

  <!-- Right action -->
  <circle cx="347" cy="28" r="14" fill="#F5F5F5"/>
  <text x="347" y="32" text-anchor="middle" class="text-primary" font-size="11" font-weight="600">AR</text>
"""),

    # Form (mobile) — single column. Field labels above inputs, full-bleed
    # primary button at bottom.
    "form-mobile": (375, 600, """
  <rect width="375" height="600" fill="#FFFFFF"/>

  <text x="16" y="40" class="text-primary" font-size="18" font-weight="700">Create profile</text>
  <text x="16" y="60" class="text-secondary" font-size="13">Tell us a bit about yourself.</text>

  <!-- Field 1 -->
  <text x="16" y="104" class="text-secondary" font-size="12">Display name</text>
  <rect x="16" y="112" width="343" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="32" y="142" class="text-disabled" font-size="14">Your name</text>

  <!-- Field 2 -->
  <text x="16" y="184" class="text-secondary" font-size="12">Email</text>
  <rect x="16" y="192" width="343" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="32" y="222" class="text-disabled" font-size="14">you@example.com</text>

  <!-- Field 3 -->
  <text x="16" y="264" class="text-secondary" font-size="12">Role</text>
  <rect x="16" y="272" width="343" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="32" y="302" class="text-primary" font-size="14">Designer</text>
  <text x="343" y="302" text-anchor="end" class="text-secondary" font-size="13">▾</text>

  <!-- Field 4 — textarea -->
  <text x="16" y="344" class="text-secondary" font-size="12">About</text>
  <rect x="16" y="352" width="343" height="120" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="32" y="382" class="text-disabled" font-size="14">A few sentences…</text>

  <!-- Sticky CTA -->
  <line x1="0" y1="519.5" x2="375" y2="519.5" stroke="#E0E0E0" stroke-width="1"/>
  <rect x="16" y="536" width="343" height="48" rx="6" fill="#424242"/>
  <text x="187.5" y="566" text-anchor="middle" class="text-inverse" font-size="14" font-weight="500">Continue</text>
"""),

    # Data table (mobile) — table cells become row cards stacked vertically.
    # Each card is one record with key/value pairs.
    "data-table-mobile": (375, 720, """
  <rect width="375" height="720" fill="#FFFFFF"/>

  <text x="16" y="40" class="text-primary" font-size="18" font-weight="700">Members</text>
  <text x="16" y="60" class="text-secondary" font-size="13">5 of 247</text>

  <!-- Filter strip -->
  <rect x="16" y="80" width="343" height="40" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="32" y="106" class="text-disabled" font-size="13">Search members</text>

  <!-- Row cards -->
  <rect x="16" y="136" width="343" height="96" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="32" y="164" class="text-primary" font-size="14" font-weight="600">Alex Rivera</text>
  <text x="32" y="184" class="text-secondary" font-size="12">alex@example.com</text>
  <text x="32" y="212" class="text-secondary" font-size="12">Administrator · Jan 2024</text>
  <text x="343" y="164" text-anchor="end" class="text-success" font-size="11" font-weight="600">ACTIVE</text>

  <rect x="16" y="248" width="343" height="96" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="32" y="276" class="text-primary" font-size="14" font-weight="600">Jordan Chen</text>
  <text x="32" y="296" class="text-secondary" font-size="12">jordan@example.com</text>
  <text x="32" y="324" class="text-secondary" font-size="12">Editor · Mar 2024</text>
  <text x="343" y="276" text-anchor="end" class="text-success" font-size="11" font-weight="600">ACTIVE</text>

  <rect x="16" y="360" width="343" height="96" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="32" y="388" class="text-primary" font-size="14" font-weight="600">Sam Okafor</text>
  <text x="32" y="408" class="text-secondary" font-size="12">sam@example.com</text>
  <text x="32" y="436" class="text-secondary" font-size="12">Editor · Apr 2024</text>
  <text x="343" y="388" text-anchor="end" class="text-warning" font-size="11" font-weight="600">PENDING</text>

  <rect x="16" y="472" width="343" height="96" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="32" y="500" class="text-primary" font-size="14" font-weight="600">Taylor Kim</text>
  <text x="32" y="520" class="text-secondary" font-size="12">taylor@example.com</text>
  <text x="32" y="548" class="text-secondary" font-size="12">Viewer · May 2024</text>
  <text x="343" y="500" text-anchor="end" class="text-disabled" font-size="11" font-weight="600">INACTIVE</text>

  <!-- Load more -->
  <rect x="16" y="600" width="343" height="48" rx="6" fill="#F5F5F5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="187.5" y="630" text-anchor="middle" class="text-secondary" font-size="13" font-weight="500">Load more</text>

  <text x="187.5" y="688" text-anchor="middle" class="text-disabled" font-size="11">5 of 247</text>
"""),

    # Modal (mobile) — full-bleed bottom sheet. Page dimmed, sheet anchored
    # to bottom with rounded top corners and a drag handle.
    "modal-mobile": (375, 720, """
  <rect width="375" height="720" fill="#F5F5F5"/>

  <!-- Sheet -->
  <rect x="0" y="320" width="375" height="400" rx="16" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Drag handle -->
  <rect x="171.5" y="336" width="32" height="4" rx="2" fill="#BDBDBD"/>

  <text x="16" y="384" class="text-primary" font-size="18" font-weight="700">Delete this thread?</text>
  <text x="16" y="412" class="text-secondary" font-size="13">Tokyo Trip will be moved to your archive.</text>
  <text x="16" y="430" class="text-secondary" font-size="13">You can restore it within 30 days.</text>

  <!-- Stacked actions -->
  <rect x="16" y="608" width="343" height="48" rx="6" fill="#B71C1C"/>
  <text x="187.5" y="638" text-anchor="middle" class="text-inverse" font-size="14" font-weight="500">Delete</text>

  <rect x="16" y="664" width="343" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="187.5" y="694" text-anchor="middle" class="text-primary" font-size="14" font-weight="500">Cancel</text>
"""),

    # Drawer (mobile) — bottom drawer, similar shape to modal-mobile but
    # holds form-style content rather than a confirmation.
    "drawer-mobile": (375, 720, """
  <rect width="375" height="720" fill="#F5F5F5"/>

  <!-- Drawer sheet -->
  <rect x="0" y="160" width="375" height="560" rx="16" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <rect x="171.5" y="176" width="32" height="4" rx="2" fill="#BDBDBD"/>

  <!-- Header -->
  <text x="16" y="216" class="text-primary" font-size="18" font-weight="700">Filter threads</text>
  <text x="343" y="216" text-anchor="end" class="text-secondary" font-size="14">×</text>

  <!-- Filter sections -->
  <text x="16" y="264" class="text-secondary" font-size="11" font-weight="600">STATUS</text>
  <rect x="16" y="276" width="80" height="32" rx="16" fill="#212121"/>
  <text x="56" y="296" text-anchor="middle" class="text-inverse" font-size="12" font-weight="500">Active</text>
  <rect x="104" y="276" width="80" height="32" rx="16" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="144" y="296" text-anchor="middle" class="text-primary" font-size="12">Archived</text>
  <rect x="192" y="276" width="80" height="32" rx="16" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="232" y="296" text-anchor="middle" class="text-primary" font-size="12">Drafts</text>

  <text x="16" y="356" class="text-secondary" font-size="11" font-weight="600">DATE RANGE</text>
  <rect x="16" y="368" width="343" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="32" y="398" class="text-primary" font-size="14">Last 30 days</text>
  <text x="343" y="398" text-anchor="end" class="text-secondary" font-size="13">▾</text>

  <text x="16" y="448" class="text-secondary" font-size="11" font-weight="600">PARTICIPANTS</text>
  <rect x="16" y="460" width="343" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="32" y="490" class="text-disabled" font-size="14">Anyone</text>

  <!-- Sticky CTA -->
  <line x1="0" y1="639.5" x2="375" y2="639.5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="32" y="688" class="text-secondary" font-size="13" font-weight="500">Reset</text>
  <rect x="159" y="664" width="200" height="40" rx="6" fill="#424242"/>
  <text x="259" y="690" text-anchor="middle" class="text-inverse" font-size="13" font-weight="500">Apply filters</text>
"""),

    # Empty state (mobile) — centered, smaller. One headline, one body
    # line, one CTA. Same vertical center but smaller proportions.
    "empty-state-mobile": (375, 600, """
  <rect width="375" height="600" fill="#FFFFFF"/>

  <!-- Illustration placeholder -->
  <rect x="151.5" y="184" width="72" height="72" rx="8" fill="#F5F5F5" stroke="#E0E0E0" stroke-width="1"/>
  <line x1="167.5" y1="220" x2="207.5" y2="220" stroke="#BDBDBD" stroke-width="1.5"/>
  <line x1="187.5" y1="200" x2="187.5" y2="240" stroke="#BDBDBD" stroke-width="1.5"/>

  <text x="187.5" y="296" text-anchor="middle" class="text-primary" font-size="18" font-weight="700">Nothing here yet</text>
  <text x="187.5" y="320" text-anchor="middle" class="text-secondary" font-size="13">Start a conversation to populate this list.</text>

  <rect x="103.5" y="356" width="168" height="44" rx="6" fill="#424242"/>
  <text x="187.5" y="384" text-anchor="middle" class="text-inverse" font-size="13" font-weight="500">New thread</text>
"""),

    # Command palette (mobile) — full-bleed search overlay; results below
    # the search input fill the available height. The keyboard shortcut
    # column doesn't apply on mobile (no kbd shortcuts in touch context).
    "command-palette-mobile": (375, 720, """
  <rect width="375" height="720" fill="#FFFFFF"/>

  <!-- Search input strip -->
  <rect x="0" y="0" width="375" height="64" fill="#FFFFFF"/>
  <text x="16" y="40" class="text-secondary" font-size="14">Cancel</text>
  <rect x="80" y="16" width="279" height="32" rx="6" fill="#F5F5F5"/>
  <text x="96" y="36" class="text-primary" font-size="13">archive</text>
  <text x="343" y="36" text-anchor="end" class="text-secondary" font-size="13">×</text>
  <line x1="0" y1="63.5" x2="375" y2="63.5" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Section: matching commands -->
  <text x="16" y="92" class="text-secondary" font-size="11" font-weight="600">COMMANDS</text>
  <text x="16" y="124" class="text-primary" font-size="14" font-weight="500">Archive thread</text>
  <text x="16" y="142" class="text-secondary" font-size="12">Move current thread to archive</text>
  <line x1="16" y1="167.5" x2="359" y2="167.5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="16" y="192" class="text-primary" font-size="14" font-weight="500">Archive all completed</text>
  <text x="16" y="210" class="text-secondary" font-size="12">Bulk archive of resolved threads</text>
  <line x1="16" y1="235.5" x2="359" y2="235.5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="16" y="260" class="text-primary" font-size="14" font-weight="500">Restore from archive</text>
  <text x="16" y="278" class="text-secondary" font-size="12">Open the archive view</text>
  <line x1="16" y1="303.5" x2="359" y2="303.5" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Section: recent matches -->
  <text x="16" y="340" class="text-secondary" font-size="11" font-weight="600">RECENT</text>
  <text x="16" y="372" class="text-primary" font-size="14">Tokyo Trip</text>
  <text x="343" y="372" text-anchor="end" class="text-secondary" font-size="12">Thread</text>
  <line x1="16" y1="395.5" x2="359" y2="395.5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="16" y="420" class="text-primary" font-size="14">Recipe ideas</text>
  <text x="343" y="420" text-anchor="end" class="text-secondary" font-size="12">Thread</text>
"""),

    # Settings layout (mobile) — sidebar collapses to top tab strip; one
    # section's content fills the rest of the screen.
    "settings-layout-mobile": (375, 720, """
  <rect width="375" height="720" fill="#FFFFFF"/>

  <!-- Header bar -->
  <rect width="375" height="56" fill="#FFFFFF"/>
  <text x="16" y="34" class="text-secondary" font-size="13">‹ Back</text>
  <text x="187.5" y="34" text-anchor="middle" class="text-primary" font-size="16" font-weight="600">Settings</text>
  <line x1="0" y1="55.5" x2="375" y2="55.5" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Section tab strip -->
  <text x="32" y="92" class="text-primary" font-size="13" font-weight="600">Profile</text>
  <line x1="16" y1="103" x2="80" y2="103" stroke="#212121" stroke-width="2"/>
  <text x="120" y="92" class="text-secondary" font-size="13">Account</text>
  <text x="200" y="92" class="text-secondary" font-size="13">Notifications</text>
  <text x="320" y="92" class="text-secondary" font-size="13">More</text>
  <line x1="0" y1="111.5" x2="375" y2="111.5" stroke="#E0E0E0" stroke-width="1"/>

  <text x="16" y="148" class="text-primary" font-size="18" font-weight="700">Profile</text>
  <text x="16" y="170" class="text-secondary" font-size="13">Update your personal information.</text>

  <!-- Field 1 -->
  <text x="16" y="216" class="text-secondary" font-size="12">Display name</text>
  <rect x="16" y="224" width="343" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="32" y="254" class="text-primary" font-size="14">Alex Rivera</text>

  <!-- Field 2 -->
  <text x="16" y="296" class="text-secondary" font-size="12">Email address</text>
  <rect x="16" y="304" width="343" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="32" y="334" class="text-primary" font-size="14">alex@example.com</text>

  <!-- Field 3 -->
  <text x="16" y="376" class="text-secondary" font-size="12">Time zone</text>
  <rect x="16" y="384" width="343" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="32" y="414" class="text-primary" font-size="14">America/Los_Angeles</text>
  <text x="343" y="414" text-anchor="end" class="text-secondary" font-size="13">▾</text>

  <!-- Sticky CTA -->
  <line x1="0" y1="655.5" x2="375" y2="655.5" stroke="#E0E0E0" stroke-width="1"/>
  <rect x="16" y="672" width="343" height="40" rx="6" fill="#424242"/>
  <text x="187.5" y="698" text-anchor="middle" class="text-inverse" font-size="13" font-weight="500">Save changes</text>
"""),

    # Article (mobile) — single column body with metadata band at top.
    # Narrower line length appropriate for mobile reading.
    "article-mobile": (375, 720, """
  <rect width="375" height="720" fill="#FFFFFF"/>

  <!-- Top nav -->
  <rect width="375" height="56" fill="#FFFFFF"/>
  <text x="16" y="34" class="text-secondary" font-size="13">‹ Back</text>
  <text x="343" y="34" text-anchor="end" class="text-secondary" font-size="13">Share</text>
  <line x1="0" y1="55.5" x2="375" y2="55.5" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Metadata -->
  <text x="16" y="100" class="text-secondary" font-size="11" font-weight="600">DISPATCH · MAY 2026</text>

  <!-- Title -->
  <text x="16" y="148" class="text-primary" font-size="24" font-weight="700">Designing for the</text>
  <text x="16" y="180" class="text-primary" font-size="24" font-weight="700">smaller surface</text>

  <!-- Byline -->
  <text x="16" y="216" class="text-secondary" font-size="12">By Alex Rivera · 6 min read</text>
  <line x1="16" y1="240.5" x2="359" y2="240.5" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Body paragraphs -->
  <text x="16" y="280" class="text-primary" font-size="14">Mobile is the most constrained context;</text>
  <text x="16" y="302" class="text-primary" font-size="14">what works on mobile usually works on</text>
  <text x="16" y="324" class="text-primary" font-size="14">desktop with breathing room. The reverse</text>
  <text x="16" y="346" class="text-primary" font-size="14">is not always true.</text>

  <text x="16" y="392" class="text-primary" font-size="14">When information has to stack, the order</text>
  <text x="16" y="414" class="text-primary" font-size="14">becomes the design — what comes first is</text>
  <text x="16" y="436" class="text-primary" font-size="14">what the reader sees, and there are no</text>
  <text x="16" y="458" class="text-primary" font-size="14">columns to hide secondary content in.</text>

  <text x="16" y="504" class="text-primary" font-size="14">This piece argues that mobile-first is less</text>
  <text x="16" y="526" class="text-primary" font-size="14">about responsive technique and more about</text>
  <text x="16" y="548" class="text-primary" font-size="14">an editorial discipline: deciding, before</text>
  <text x="16" y="570" class="text-primary" font-size="14">layout, what readers actually need.</text>

  <line x1="16" y1="616.5" x2="359" y2="616.5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="16" y="660" class="text-secondary" font-size="11" font-weight="600">CONTINUE READING</text>
  <text x="16" y="688" class="text-primary" font-size="14" font-weight="500">The eight-grid as method →</text>
"""),

    # Dashboard (mobile) — vertical stack of stat cards then a list pane.
    "dashboard-mobile": (375, 800, """
  <rect width="375" height="800" fill="#F5F5F5"/>

  <!-- Header strip -->
  <rect width="375" height="56" fill="#FFFFFF"/>
  <line x1="20" y1="22" x2="36" y2="22" stroke="#212121" stroke-width="1.5"/>
  <line x1="20" y1="28" x2="36" y2="28" stroke="#212121" stroke-width="1.5"/>
  <line x1="20" y1="34" x2="36" y2="34" stroke="#212121" stroke-width="1.5"/>
  <text x="187.5" y="34" text-anchor="middle" class="text-primary" font-size="16" font-weight="600">Dashboard</text>
  <circle cx="347" cy="28" r="14" fill="#F5F5F5"/>
  <text x="347" y="32" text-anchor="middle" class="text-primary" font-size="11" font-weight="600">AR</text>
  <line x1="0" y1="55.5" x2="375" y2="55.5" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Stat row 1 -->
  <rect x="16" y="80" width="343" height="88" rx="8" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="32" y="108" class="text-secondary" font-size="11" font-weight="600">REVENUE</text>
  <text x="32" y="148" class="text-primary" font-size="24" font-weight="700">$24,580</text>
  <text x="343" y="148" text-anchor="end" class="text-success" font-size="12" font-weight="600">+8%</text>

  <rect x="16" y="184" width="343" height="88" rx="8" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <text x="32" y="212" class="text-secondary" font-size="11" font-weight="600">ACTIVE SESSIONS</text>
  <text x="32" y="252" class="text-primary" font-size="24" font-weight="700">1,247</text>
  <text x="343" y="252" text-anchor="end" class="text-success" font-size="12" font-weight="600">+12%</text>

  <!-- Section header -->
  <text x="16" y="304" class="text-secondary" font-size="11" font-weight="600">RECENT THREADS</text>
  <text x="343" y="304" text-anchor="end" class="text-secondary" font-size="12">View all</text>

  <!-- List rows -->
  <rect x="16" y="320" width="343" height="72" rx="8" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <circle cx="48" cy="356" r="16" fill="#F5F5F5"/>
  <text x="48" y="361" text-anchor="middle" class="text-primary" font-size="12" font-weight="600">TR</text>
  <text x="80" y="348" class="text-primary" font-size="14" font-weight="600">Tokyo Trip</text>
  <text x="80" y="370" class="text-secondary" font-size="12">Build day-by-day…</text>
  <text x="343" y="348" text-anchor="end" class="text-secondary" font-size="11">2m</text>

  <rect x="16" y="408" width="343" height="72" rx="8" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <circle cx="48" cy="444" r="16" fill="#F5F5F5"/>
  <text x="48" y="449" text-anchor="middle" class="text-primary" font-size="12" font-weight="600">RC</text>
  <text x="80" y="436" class="text-primary" font-size="14" font-weight="600">Recipe ideas</text>
  <text x="80" y="458" class="text-secondary" font-size="12">Ramen variations…</text>
  <text x="343" y="436" text-anchor="end" class="text-secondary" font-size="11">14m</text>

  <rect x="16" y="496" width="343" height="72" rx="8" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>
  <circle cx="48" cy="532" r="16" fill="#F5F5F5"/>
  <text x="48" y="537" text-anchor="middle" class="text-primary" font-size="12" font-weight="600">BC</text>
  <text x="80" y="524" class="text-primary" font-size="14" font-weight="600">Book club</text>
  <text x="80" y="546" class="text-secondary" font-size="12">Pages 132 – 196…</text>
  <text x="343" y="524" text-anchor="end" class="text-secondary" font-size="11">1h</text>

  <!-- Bottom tab bar -->
  <rect x="0" y="744" width="375" height="56" fill="#FFFFFF"/>
  <line x1="0" y1="744.5" x2="375" y2="744.5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="62.5" y="780" text-anchor="middle" class="text-primary" font-size="11" font-weight="600">Home</text>
  <text x="187.5" y="780" text-anchor="middle" class="text-secondary" font-size="11">Threads</text>
  <text x="312.5" y="780" text-anchor="middle" class="text-secondary" font-size="11">Profile</text>
"""),

    # Auth (mobile) — vertical centered form, fields stretch full width
    # minus 16px margin.
    "auth-mobile": (375, 720, """
  <rect width="375" height="720" fill="#F5F5F5"/>

  <!-- Header (just brand) -->
  <text x="187.5" y="120" text-anchor="middle" class="text-primary" font-size="18" font-weight="700">Northwind</text>

  <!-- Title -->
  <text x="187.5" y="200" text-anchor="middle" class="text-primary" font-size="24" font-weight="700">Welcome back</text>
  <text x="187.5" y="228" text-anchor="middle" class="text-secondary" font-size="13">Enter your details below</text>

  <!-- Email -->
  <text x="16" y="288" class="text-secondary" font-size="12">Email address</text>
  <rect x="16" y="296" width="343" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="32" y="326" class="text-disabled" font-size="14">user@example.com</text>

  <!-- Password -->
  <text x="16" y="368" class="text-secondary" font-size="12">Password</text>
  <text x="343" y="368" text-anchor="end" class="text-secondary" font-size="12">Forgot?</text>
  <rect x="16" y="376" width="343" height="48" rx="6" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1.5"/>
  <text x="32" y="406" class="text-disabled" font-size="14">••••••••</text>

  <!-- Submit -->
  <rect x="16" y="456" width="343" height="48" rx="6" fill="#424242"/>
  <text x="187.5" y="486" text-anchor="middle" class="text-inverse" font-size="14" font-weight="500">Sign in</text>

  <!-- Divider + alternate -->
  <line x1="16" y1="552.5" x2="359" y2="552.5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="187.5" y="592" text-anchor="middle" class="text-secondary" font-size="13">Don't have an account? <tspan class="text-primary" font-weight="500">Create one</tspan></text>
"""),

}


def main():
    only = None
    if len(sys.argv) > 2 and sys.argv[1] == "--only":
        only = sys.argv[2]

    # Script lives in tooling/; output goes up one level into the project root.
    out_dir = Path(__file__).resolve().parents[2] / "systems" / "wireframe" / "layouts"
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

    print(f"Wrote {len(written)} pattern SVGs to {out_dir}")
    if not only:
        for p in written:
            print(f"  {p.name}")


if __name__ == "__main__":
    main()
