#!/usr/bin/env python3
"""
Build a contact-sheet SVG showing all components in the wireframe library
grouped by tier and by component type, with labels for each variant.

This is documentation, not production output — it's what a designer
opens to see the entire library at a glance.
"""

from pathlib import Path
import sys

# Same standard wrapper used by build_wireframe_library.py
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
      .label { fill: #757575; font-family: 'SF Mono', 'Monaco', 'Consolas', monospace; font-size: 10px; }
      .section-label { fill: #424242; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
      .tier-label { fill: #212121; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 18px; font-weight: 700; }
    </style>
  </defs>"""


# Layout: each component gets a card showing its variants stacked,
# with the component name at the top and variant labels next to each.

PRIMITIVES = [
    ("button", ["primary", "secondary", "ghost", "disabled", "danger"]),
    ("button", ["small", "large", "full-width"]),
    ("input", ["text", "password", "search", "numeric"]),
    ("textarea", ["default", "auto-grow"]),
    ("select", ["dropdown", "native"]),
    ("checkbox", ["default", "indeterminate"]),
    ("radio", ["default"]),
    ("toggle", ["default"]),
    ("label", ["default", "required", "optional"]),
    ("icon", ["outlined", "filled"]),
    ("avatar", ["monogram", "photo-placeholder", "index", "none"]),
    ("badge", ["count", "status", "tag", "dot"]),
    ("divider", ["hairline", "default", "strong", "dashed", "section"]),
]

COMPOSITES = [
    ("card", ["default", "with-header", "interactive", "selected", "empty", "disabled"]),
    ("list-item", ["default", "selected", "compact", "with-action", "with-metadata"]),
    ("form-field", ["default", "inline", "with-help", "with-error"]),
    ("table-row", ["default", "header", "selected", "expanded"]),
    ("table-header", ["default", "sortable", "with-filter"]),
    ("nav-item", ["top-level", "sub-item", "breadcrumb"]),
    ("tab-item", ["default", "active", "disabled"]),
    ("breadcrumb-trail", ["default", "truncated"]),
    ("pagination", ["numbered", "simple", "infinite-scroll-indicator"]),
    ("toast", ["info", "success", "warning", "error"]),
    ("stat", ["default", "with-trend", "with-sparkline"]),
    ("key-value", ["default", "inline", "tabular"]),
    ("button-group", ["segmented", "attached", "spaced"]),
    ("search-bar", ["default", "with-filters", "with-results-count"]),
    ("banner", ["info", "success", "warning", "error", "promotional"]),
    ("accordion-item", ["collapsed", "expanded"]),
    ("stepper", ["linear", "numbered", "dotted"]),
    ("dropdown-menu", ["default", "with-groups", "with-search"]),
]

# Patterns (Tier 3) — full layouts. Listed as (group_name, [variant_filenames]).
# Each variant filename matches an SVG in wireframe-library/layouts/. Mobile
# variants (Phase 2 Item 5) appear first; desktop variants follow. Patterns
# render at reduced scale because their native sizes (1280×800) don't fit
# the contact-sheet column width.
PATTERNS = [
    ("sidebar",          ["sidebar-mobile", "sidebar-default", "sidebar-collapsed", "sidebar-with-sections"]),
    ("header",           ["header-mobile", "header-default", "header-with-search", "header-with-actions"]),
    ("form",             ["form-mobile", "form-single-column", "form-two-column", "form-inline", "form-wizard"]),
    ("data-table",       ["data-table-mobile", "data-table-default", "data-table-with-actions", "data-table-with-pagination", "data-table-with-filters"]),
    ("modal",            ["modal-mobile", "modal-default", "modal-confirmation", "modal-form", "modal-wide"]),
    ("drawer",           ["drawer-mobile", "drawer-right", "drawer-left", "drawer-bottom"]),
    ("empty-state",      ["empty-state-mobile", "empty-state-no-data", "empty-state-no-results", "empty-state-first-use", "empty-state-error"]),
    ("command-palette",  ["command-palette-mobile", "command-palette-default", "command-palette-with-groups", "command-palette-with-recent"]),
    ("settings-layout",  ["settings-layout-mobile", "settings-layout-default", "settings-layout-with-subsections"]),
    ("article",          ["article-mobile", "article-default", "article-with-toc", "article-with-sidebar-meta"]),
    ("dashboard",        ["dashboard-mobile", "dashboard-metrics-heavy", "dashboard-conversation", "dashboard-list-focus", "dashboard-mixed"]),
    ("auth",             ["auth-mobile", "auth-sign-in", "auth-sign-up", "auth-reset-password", "auth-verify-code"]),
]


def read_component_inner(component_id: str, variant: str, components_dir: Path) -> tuple:
    """Read a component SVG and return (width, height, inner_body)."""
    path = components_dir / f"{component_id}-{variant}.svg"
    text = path.read_text()
    # Extract viewBox
    import re
    vb = re.search(r'viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"', text)
    width, height = float(vb.group(1)), float(vb.group(2))
    # Extract inner body (everything between </defs> and </svg>, skipping the comment)
    after_defs = text.split("</defs>", 1)[1]
    body = after_defs.rsplit("</svg>", 1)[0]
    return width, height, body


def read_pattern_inner(filename: str, layouts_dir: Path) -> tuple:
    """Read a pattern SVG (full filename, no separate variant suffix) and
    return (width, height, inner_body). Patterns live in layouts/ and use
    a single filename like 'sidebar-default.svg'."""
    path = layouts_dir / f"{filename}.svg"
    text = path.read_text()
    import re
    vb = re.search(r'viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"', text)
    width, height = float(vb.group(1)), float(vb.group(2))
    after_defs = text.split("</defs>", 1)[1]
    body = after_defs.rsplit("</svg>", 1)[0]
    return width, height, body


def build_contact_sheet(components_dir: Path, layouts_dir: Path = None) -> str:
    LABEL_WIDTH = 200       # px reserved on the left for the component label
    VARIANT_GAP = 24        # px gap between rows (variants)
    GROUP_GAP = 32          # px gap between component groups
    TIER_GAP = 64           # px gap between tiers
    PAGE_PAD = 48           # px padding around the whole sheet
    CONTENT_WIDTH = 720     # px max width of any rendered component
    SHEET_WIDTH = LABEL_WIDTH + CONTENT_WIDTH + PAGE_PAD * 2

    # Patterns are too big to render at 1:1; downscale so the tallest
    # dimension fits within PATTERN_MAX_DIM. Width-bound is also enforced.
    PATTERN_MAX_DIM = 240
    PATTERN_MAX_WIDTH = CONTENT_WIDTH

    parts = []
    y = PAGE_PAD

    # Title
    pattern_count = sum(len(variants) for _, variants in (PATTERNS or []))
    composite_count = sum(len(variants) for _, variants in COMPOSITES)
    primitive_count = sum(len(variants) for _, variants in PRIMITIVES)
    parts.append(f'  <text x="{PAGE_PAD}" y="{y + 24}" class="tier-label" font-size="28">Wireframe Library — Contact Sheet</text>')
    parts.append(
        f'  <text x="{PAGE_PAD}" y="{y + 52}" class="text-secondary" font-size="14">'
        f'Greyscale neutral library · {primitive_count + composite_count + pattern_count} variants across 42 components · grammar_family: wireframe'
        '</text>'
    )
    y += 96

    # ---- PRIMITIVES + COMPOSITES (component-fragment scale) ----
    for tier_name, tier_components in [("PRIMITIVES (12)", PRIMITIVES), ("COMPOSITES (18)", COMPOSITES)]:
        parts.append(f'  <line x1="{PAGE_PAD}" y1="{y}" x2="{SHEET_WIDTH - PAGE_PAD}" y2="{y}" stroke="#757575" stroke-width="1.5"/>')
        y += 32
        parts.append(f'  <text x="{PAGE_PAD}" y="{y}" class="tier-label">{tier_name}</text>')
        y += 32

        for component_id, variants in tier_components:
            parts.append(f'  <text x="{PAGE_PAD}" y="{y + 14}" class="section-label">{component_id.replace("-", " ").upper()}</text>')

            inner_y = y + 32
            for variant in variants:
                try:
                    w, h, body = read_component_inner(component_id, variant, components_dir)
                except FileNotFoundError:
                    parts.append(f'  <text x="{PAGE_PAD}" y="{inner_y + 14}" class="text-danger" font-size="12">MISSING: {component_id}-{variant}</text>')
                    inner_y += 24
                    continue

                parts.append(f'  <text x="{PAGE_PAD + 16}" y="{inner_y + 14}" class="label">{variant}</text>')
                parts.append(f'  <g transform="translate({PAGE_PAD + LABEL_WIDTH}, {inner_y})">')
                parts.append(body.strip())
                parts.append('  </g>')
                inner_y += int(h) + VARIANT_GAP

            y = inner_y + GROUP_GAP - VARIANT_GAP

        y += TIER_GAP - GROUP_GAP

    # ---- PATTERNS (downscaled to fit) ----
    if layouts_dir is not None and PATTERNS:
        parts.append(f'  <line x1="{PAGE_PAD}" y1="{y}" x2="{SHEET_WIDTH - PAGE_PAD}" y2="{y}" stroke="#757575" stroke-width="1.5"/>')
        y += 32
        parts.append(f'  <text x="{PAGE_PAD}" y="{y}" class="tier-label">PATTERNS (12)</text>')
        y += 8
        parts.append(f'  <text x="{PAGE_PAD}" y="{y + 14}" class="text-secondary" font-size="12">Layouts downscaled to fit; mobile (375px) variants appear first.</text>')
        y += 32

        for component_id, variants in PATTERNS:
            parts.append(f'  <text x="{PAGE_PAD}" y="{y + 14}" class="section-label">{component_id.replace("-", " ").upper()}</text>')
            inner_y = y + 32

            for variant_filename in variants:
                try:
                    w, h, body = read_pattern_inner(variant_filename, layouts_dir)
                except FileNotFoundError:
                    parts.append(f'  <text x="{PAGE_PAD}" y="{inner_y + 14}" class="text-danger" font-size="12">MISSING: {variant_filename}</text>')
                    inner_y += 24
                    continue

                # Compute scale: largest dim ≤ PATTERN_MAX_DIM, also width ≤ PATTERN_MAX_WIDTH
                scale = min(PATTERN_MAX_DIM / max(w, h), PATTERN_MAX_WIDTH / w, 1.0)
                sw, sh = w * scale, h * scale

                # Variant label (left column) — show full filename for patterns
                # since the variant suffix is the meaningful identifier.
                parts.append(f'  <text x="{PAGE_PAD + 16}" y="{inner_y + 14}" class="label">{variant_filename}</text>')
                parts.append(f'  <text x="{PAGE_PAD + 16}" y="{inner_y + 28}" class="text-disabled" font-size="9">{int(w)}×{int(h)} → {scale:.2f}×</text>')

                # Pattern body, scaled. Wrap in a clipping rect frame so
                # adjacent patterns don't visually bleed into each other.
                parts.append(f'  <g transform="translate({PAGE_PAD + LABEL_WIDTH}, {inner_y})">')
                parts.append(f'    <rect x="0" y="0" width="{sw:.1f}" height="{sh:.1f}" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1"/>')
                parts.append(f'    <g transform="scale({scale:.4f})">')
                parts.append(body.strip())
                parts.append('    </g>')
                parts.append('  </g>')

                inner_y += int(sh) + VARIANT_GAP

            y = inner_y + GROUP_GAP - VARIANT_GAP

        y += TIER_GAP - GROUP_GAP

    sheet_height = y + PAGE_PAD

    return f'''<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 {SHEET_WIDTH} {sheet_height}"
     width="{SHEET_WIDTH}" height="{sheet_height}">
{STANDARD_DEFS}
  <rect width="{SHEET_WIDTH}" height="{sheet_height}" fill="#F5F5F5"/>
{chr(10).join(parts)}
</svg>
'''


if __name__ == "__main__":
    # Script lives in tooling/; library lives at the project root one level up.
    project_root = Path(__file__).resolve().parent.parent
    components_dir = project_root / "wireframe-library" / "components"
    layouts_dir = project_root / "wireframe-library" / "layouts"
    sheet = build_contact_sheet(components_dir, layouts_dir)
    out = project_root / "wireframe-library" / "contact-sheet.svg"
    out.write_text(sheet)
    print(f"Wrote {out}")
