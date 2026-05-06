#!/usr/bin/env python3
"""
Mechanical rulebook check for design system compliance.
Runs against an SVG file and reports per-rule pass/fail.

Two rulesets are supported:
  - swiss: Swiss design system (red discipline, type scale, palette, etc.)
  - wireframe: tkr-kit's neutral wireframe library (palette, type scale,
    no shadows, no double-hyphens, css classes, NO TEXT OVERFLOW)

Usage:
    python3 rulebook_check.py <svg-path>                       # auto-detects ruleset + scope
    python3 rulebook_check.py <svg-path> --ruleset swiss       # explicit ruleset
    python3 rulebook_check.py <svg-path> --scope component     # explicit scope override
    python3 rulebook_check.py --batch <dir> --ruleset swiss    # batch a directory

Scope (per Schema v0.2 Change 12):
    component  — fragment-level checks; artifact-only rules (e.g. red-finite-resource
                 counting per-screen) are skipped. Used by default for files in
                 .../components/ directories.
    artifact   — full-screen checks; all applicable rules run. Used by default for
                 files in .../layouts/ or top-level files.
    all        — runs every rule regardless of scope. Useful for diagnostic mode.

Only the mechanical rules are checkable here; rules requiring judgment
(e.g. swiss-numerical-display semantic correctness) are noted but not
automatically verified.
"""

import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from collections import Counter


def check_xml_well_formed(svg_text: str) -> dict:
    """Universal precheck: SVG must be parseable XML.

    This catches common authoring bugs that all per-ruleset checks miss because
    they operate on regex over the source text:
      - Unescaped angle brackets in text content (e.g. ``[ < prev ]``)
      - Duplicate attributes on a single element (e.g. ``rx="0" rx="10"``)
      - Mismatched or unclosed tags

    Returns a result dict with the standard ``passed`` / ``rule_id`` shape so
    it composes with the existing per-ruleset reporters. On failure the parse
    error and approximate line/column are surfaced.
    """
    try:
        ET.fromstring(svg_text)
        return {"rule_id": "xml-well-formed", "passed": True}
    except ET.ParseError as e:
        return {
            "rule_id": "xml-well-formed",
            "passed": False,
            "parse_error": str(e),
            "hint": "Escape '<' as '&lt;' and '>' as '&gt;' in text content; remove duplicate attributes.",
        }


SWISS_TYPE_SCALE = {9, 11, 13, 14, 22, 32, 40}
SWISS_GRID = {0, 1, 2, 8, 16, 24, 32, 40, 48, 64, 72, 80, 96, 104, 112, 120, 128,
              136, 144, 152, 160, 168, 176, 184, 192, 200, 208, 216, 224, 232,
              240, 248, 256, 264, 272, 280, 288, 296, 304, 312, 320, 328, 336,
              344, 352, 360, 368, 376, 384, 392, 400, 408, 416, 424, 432, 440,
              448, 456, 464, 472, 480, 488, 496, 504, 512, 520, 528, 536, 544,
              552, 560, 568, 576, 584, 592, 600, 608, 616, 624, 632, 640, 648,
              656, 664, 672, 680, 688, 696, 704, 712, 720, 728, 736, 744, 752,
              760, 768, 776, 784, 792, 800, 808, 816, 1000, 1192, 1208, 1280}
# Note: 0/1/2 allowed as base values; 1192/1208 for right-edge alignment of accent dot
# 0.5 offsets (e.g. y=95.5) for 1px crisp lines are a separate concern

SWISS_RED = "#E3000B"
SWISS_INK = "#000000"
SWISS_PAPER = "#FFFFFF"
SWISS_GRAY_SURFACE = "#F5F5F5"
SWISS_GRAY_METADATA = "#666666"
SWISS_RULE_HAIRLINE = "#F0F0F0"
SWISS_RULE_DEFAULT = "#E0E0E0"
SWISS_ALLOWED_COLORS = {SWISS_RED, SWISS_INK, SWISS_PAPER, SWISS_GRAY_SURFACE,
                        SWISS_GRAY_METADATA, SWISS_RULE_HAIRLINE, SWISS_RULE_DEFAULT}


# ──────────────────────────────────────────────────────────────────────
# WIREFRAME LIBRARY CONSTANTS
# Per tkr-kit/.claude/skills/wireframe-skill + wireframe-spec.yaml
# ──────────────────────────────────────────────────────────────────────

WIREFRAME_TYPE_SCALE = {11, 12, 13, 14, 16, 18, 24}

WIREFRAME_ALLOWED_COLORS = {
    "#F5F5F5",  # background
    "#FFFFFF",  # surface / inverse
    "#FAFAFA",  # disabled card surface (close to F5F5F5; permitted variant)
    "#E0E0E0",  # border
    "#BDBDBD",  # disabled
    "#757575",  # secondary
    "#424242",  # interactive
    "#212121",  # primary text
    "#2E7D32",  # success
    "#E65100",  # warning
    "#B71C1C",  # danger
    "#1565C0",  # info
    "#000000",  # ink (used in modal overlays)
    "TRANSPARENT",  # explicitly OK
}


# Approximate per-typeface average glyph width as a fraction of font-size.
# Used by check_text_overflow. Empirically tuned for the most common faces;
# proportional fonts vary, so we use a conservative-but-realistic average.
_GLYPH_WIDTH_RATIO = {
    "default": 0.55,         # generic system-stack proportional
    "monospace": 0.60,       # narrower than people expect at small sizes
    "fraunces": 0.50,        # transitional serif
    "space mono": 0.62,      # wide mono
    "jetbrains mono": 0.60,
    "ibm plex sans": 0.55,
    "outfit": 0.52,
    "inter": 0.52,
    "space grotesk": 0.55,
    "caveat": 0.45,          # cursive runs narrower per-character
}


def _glyph_width_ratio(font_family: str) -> float:
    """Pick the width ratio for a font-family string."""
    fam = (font_family or "").lower()
    for key, ratio in _GLYPH_WIDTH_RATIO.items():
        if key in fam:
            return ratio
    return _GLYPH_WIDTH_RATIO["default"]


def extract_attrs(svg_text, tag, attr):
    """Extract all values of `attr` from `tag` elements."""
    pattern = rf'<{tag}\b[^>]*\b{attr}="([^"]+)"'
    return re.findall(pattern, svg_text)


def extract_inline_attrs(svg_text):
    """Extract every attribute of every element. Returns list of (tag, attrs_dict)."""
    elements = []
    for match in re.finditer(r'<(\w+)\b([^>]*)>', svg_text):
        tag = match.group(1)
        attr_str = match.group(2)
        attrs = dict(re.findall(r'(\w[\w-]*)="([^"]*)"', attr_str))
        elements.append((tag, attrs))
    return elements


def check_red_finite_resource(svg_text):
    """Rule: red is bounded above by 4 usages per screen.

       The rulebook prose lists 4 valid contexts for red: (1) primary CTAs,
       (2) selection bars on list items, (3) user/identity tags, (4) status
       dots. A 5th red usage is a violation. Not every screen must have all
       four — a sign-in form may legitimately have only 1 red usage (the
       CTA), and an empty data table may have 0.

       Implementation: count distinct elements (text, rect, circle, line)
       whose effective fill OR stroke resolves to #E3000B. Effective color
       comes from inline fill/stroke attributes OR from a CSS class defined
       in <defs><style> (e.g. class="text-accent" → fill: #E3000B). Pass
       when count <= 4; fail with overflow detail when count > 4.
    """
    elements = extract_inline_attrs(svg_text)
    css_class_fills = _extract_css_class_fills(svg_text)
    red_uses = []
    for tag, attrs in elements:
        if tag not in ("text", "rect", "circle", "line"):
            continue
        inline_fill = attrs.get("fill", "").upper()
        inline_stroke = attrs.get("stroke", "").upper()
        if inline_fill == SWISS_RED or inline_stroke == SWISS_RED:
            red_uses.append((tag, attrs.get("fill") or attrs.get("stroke"), "inline"))
            continue
        cls = attrs.get("class", "").strip()
        if cls and cls in css_class_fills:
            if css_class_fills[cls].upper() == SWISS_RED:
                red_uses.append((tag, css_class_fills[cls], f"class={cls}"))
    return {
        "rule_id": "swiss-red-finite-resource",
        "passed": len(red_uses) <= 4,
        "actual": len(red_uses),
        "max_allowed": 4,
        "detail": [f"{t}({c}, {src})" for t, c, src in red_uses],
    }


def check_zero_radius(svg_text):
    """Rule: every border-radius is 0. SVG equivalent: no rx or ry attributes."""
    rx_values = re.findall(r'\brx="([^"]+)"', svg_text)
    ry_values = re.findall(r'\bry="([^"]+)"', svg_text)
    nonzero = [v for v in rx_values + ry_values if v not in ("0", "0.0", "")]
    return {
        "rule_id": "swiss-zero-radius",
        "passed": len(nonzero) == 0,
        "actual": nonzero,
        "expected": "no rx/ry attributes (or all 0)",
    }


def check_no_shadows(svg_text):
    """Rule: no box-shadow. SVG equivalent: no <filter> elements with feDropShadow,
       no filter= references."""
    has_filter_def = "<filter" in svg_text
    has_filter_ref = re.search(r'\bfilter="(?!none)[^"]+"', svg_text) is not None
    has_drop_shadow = "feDropShadow" in svg_text
    return {
        "rule_id": "swiss-no-shadows",
        "passed": not (has_filter_def or has_filter_ref or has_drop_shadow),
        "actual": {"filter_def": has_filter_def, "filter_ref": has_filter_ref,
                   "drop_shadow": has_drop_shadow},
        "expected": "no filter elements or shadow references",
    }


def check_fixed_type_scale(svg_text):
    """Rule: only 7 type sizes permitted: 9, 11, 13, 14, 22, 32, 40."""
    sizes = extract_attrs(svg_text, "text", "font-size")
    sizes_int = [int(float(s)) for s in sizes]
    used = set(sizes_int)
    violations = used - SWISS_TYPE_SCALE
    counts = Counter(sizes_int)
    return {
        "rule_id": "swiss-fixed-type-scale",
        "passed": len(violations) == 0,
        "actual": dict(counts),
        "violations": sorted(violations),
        "expected": sorted(SWISS_TYPE_SCALE),
    }


def check_single_typeface(svg_text):
    """Rule: only Inter permitted (or system-ui fallback)."""
    families = extract_attrs(svg_text, "text", "font-family")
    unique_families = set(families)
    # The only permitted stack is the Inter+system-ui fallback
    permitted = {"Inter, system-ui, sans-serif"}
    violations = unique_families - permitted
    return {
        "rule_id": "swiss-single-typeface",
        "passed": len(violations) == 0,
        "actual": sorted(unique_families),
        "violations": sorted(violations),
    }


def _resolve_text_fill(attrs, css_class_fills):
    """Get the effective fill for a text element, considering inline fill or
    a class-based fill defined in <defs><style>. Returns uppercase hex or "" if
    neither is set / class is unknown."""
    inline = attrs.get("fill", "").strip()
    if inline:
        return inline.upper()
    cls = attrs.get("class", "").strip()
    if cls and cls in css_class_fills:
        return css_class_fills[cls].upper()
    return ""


def _extract_css_class_fills(svg_text):
    """Parse simple .classname { fill: #hex; ... } rules from <defs><style>.
    Returns {classname: hex_color}. Handles the convention used across the
    swiss/wireframe libraries; doesn't aim to be a full CSS parser."""
    style_blocks = re.findall(r'<style[^>]*>(.*?)</style>', svg_text, re.DOTALL)
    out = {}
    for block in style_blocks:
        for m in re.finditer(r'\.([\w-]+)\s*\{([^}]*)\}', block):
            cls = m.group(1)
            body = m.group(2)
            fm = re.search(r'fill\s*:\s*(#[0-9A-Fa-f]{3,6}|none|transparent)', body)
            if fm:
                out[cls] = fm.group(1)
    return out


def check_metadata_uppercase(svg_text):
    """Rule: 9px text must be uppercase, tracked >= 1.44em (0.16em * 9px ≈ 1.44px),
       color #666 (or #E3000B / #000000 in permitted contexts).

       Vacuous-pass: if no 9px <text> element exists in the fragment, the rule
       passes (component-scoped, applies_when font-size==9).
    """
    elements = extract_inline_attrs(svg_text)
    css_class_fills = _extract_css_class_fills(svg_text)
    failures = []
    nine_px_count = 0
    for tag, attrs in elements:
        if tag != "text":
            continue
        size = attrs.get("font-size", "")
        if size != "9":
            continue
        nine_px_count += 1
        spacing = float(attrs.get("letter-spacing", "0"))
        color = _resolve_text_fill(attrs, css_class_fills)
        if spacing < 1.4:
            failures.append(f"9px text with letter-spacing={spacing} (expected >= 1.44)")
        if color and color not in (SWISS_GRAY_METADATA, SWISS_RED, SWISS_INK):
            failures.append(f"9px text with fill={color} (expected #666666 / #E3000B / #000000)")
        if not color:
            failures.append("9px text with no resolvable fill (no inline fill or known class)")
    return {
        "rule_id": "swiss-metadata-uppercase",
        "passed": len(failures) == 0,
        "actual_failures": failures,
        "vacuous": nine_px_count == 0,
        "note": "Uppercase text content not checked here; verify visually.",
    }


def check_color_palette(svg_text):
    """All colors used must be in the Swiss palette."""
    fills = re.findall(r'\bfill="(#[0-9A-Fa-f]{3,6})"', svg_text)
    strokes = re.findall(r'\bstroke="(#[0-9A-Fa-f]{3,6})"', svg_text)
    used = set(c.upper() for c in fills + strokes)
    violations = used - SWISS_ALLOWED_COLORS
    return {
        "rule_id": "swiss-color-palette",
        "passed": len(violations) == 0,
        "actual": sorted(used),
        "violations": sorted(violations),
    }


def check_grid_alignment(svg_text):
    """Rule: spacing values are multiples of 8.
       Checking x, y, width, height attributes against permitted values.
       Note: this is a lenient check — coordinates that happen to be off-grid
       because of legitimate sub-grid positioning (accent bar at 2px, hairline
       at y=95.5) are flagged but not necessarily violations.
    """
    elements = extract_inline_attrs(svg_text)
    off_grid = []
    for tag, attrs in elements:
        for attr in ("x", "y", "width", "height", "x1", "y1", "x2", "y2", "cx", "cy"):
            val_str = attrs.get(attr, "")
            if not val_str:
                continue
            try:
                val = float(val_str)
            except ValueError:
                continue
            # Allow integer values that are multiples of 8, plus the small set 0/1/2/4
            if val == int(val) and int(val) in SWISS_GRID:
                continue
            # 0.5 offsets are crisp-pixel adjustments for 1px lines — permitted
            if val - int(val) == 0.5:
                continue
            # Sub-grid values for text baselines often need adjustment
            # (28, 46, 80 etc. for text baselines aren't on the 8-grid)
            off_grid.append(f"{tag}.{attr}={val}")
    return {
        "rule_id": "swiss-grid-alignment",
        "passed": len(off_grid) == 0,
        "off_grid_count": len(off_grid),
        "off_grid_values": off_grid[:20],  # truncate for readability
        "note": "Text baselines and inner positioning often need sub-grid values; investigate violations rather than treating as automatic failures.",
    }


# ──────────────────────────────────────────────────────────────────────
# WIREFRAME LIBRARY CHECKS
# ──────────────────────────────────────────────────────────────────────

def check_wireframe_text_overflow(svg_text):
    """Rule: text elements must end before the artifact's right edge.

    Promoted from a one-off detector after card components were found
    to overflow their viewBox width. Encodes Finding 11.5 (anatomy
    spatial-yield constraints) at the verification layer.

    Approximation: for each <text> element with an explicit x position
    (excluding text-anchor='middle' or 'end' which position differently),
    estimate the rendered end-x using length(content) * font-size *
    glyph_width_ratio(font-family). Flag if end-x exceeds viewBox width
    minus a small right-margin tolerance.

    Approximation has known limits:
      - Doesn't account for kerning, ligatures, or font-specific advance widths
      - Uses an average glyph width per typeface (not per-character)
      - May produce false positives for short strings with unusual characters
    For wireframe-fitness purposes this is good enough — the goal is to
    catch obvious overflows, not to lay out type perfectly.
    """
    # Get viewBox width
    vb_match = re.search(r'viewBox="0 0 (\d+(?:\.\d+)?) ', svg_text)
    if not vb_match:
        return {
            "rule_id": "wireframe-text-overflow",
            "passed": True,
            "note": "No viewBox found; check skipped",
        }
    width = float(vb_match.group(1))
    margin = 8  # px tolerance: text may end up to 8px from edge

    elements = extract_inline_attrs(svg_text)
    overflows = []
    for tag, attrs in elements:
        if tag != "text":
            continue
        # Skip text with text-anchor (positioning is from the anchor)
        if attrs.get("text-anchor") in ("middle", "end"):
            continue
        x_str = attrs.get("x", "0")
        try:
            x = float(x_str)
        except ValueError:
            continue
        size_str = attrs.get("font-size", "14")
        try:
            size = float(size_str)
        except ValueError:
            continue
        family = attrs.get("font-family", "")
        ratio = _glyph_width_ratio(family)

        # We need the text content. Rebuild the regex for this specific element.
        # Find this <text> tag's content in the original svg_text. Use the
        # x and size as a fingerprint, find the matching <text>...</text>.
        pattern = rf'<text\s+x="{re.escape(x_str)}"[^>]*?font-size="{re.escape(size_str)}"[^>]*?>([^<]+)</text>'
        m = re.search(pattern, svg_text)
        if not m:
            continue
        content = m.group(1)

        # Strip out <tspan>...</tspan> if present — only count visible text length
        # Currently the regex above won't match tspan-containing text, so this
        # is a future-proofing note rather than active handling.
        text_width = len(content) * size * ratio
        end_x = x + text_width
        if end_x > width - margin:
            overflows.append({
                "x": x,
                "size": size,
                "family": (family.split(",")[0].strip("'\" ") or "default"),
                "content_preview": content[:50] + ("…" if len(content) > 50 else ""),
                "estimated_end_x": round(end_x, 1),
                "viewbox_width": width,
                "overflow_px": round(end_x - width, 1),
            })

    return {
        "rule_id": "wireframe-text-overflow",
        "passed": len(overflows) == 0,
        "overflow_count": len(overflows),
        "overflows": overflows,
        "viewbox_width": width,
        "margin_tolerance_px": margin,
    }


def check_wireframe_palette(svg_text):
    """Rule: every fill/stroke value is one of the wireframe library palette colors."""
    fills = re.findall(r'\bfill="(#[0-9A-Fa-f]{3,6}|none|transparent)"', svg_text, re.IGNORECASE)
    strokes = re.findall(r'\bstroke="(#[0-9A-Fa-f]{3,6}|none|transparent)"', svg_text, re.IGNORECASE)
    used = set()
    for v in fills + strokes:
        v_norm = v.upper()
        if v_norm in ("NONE", "TRANSPARENT"):
            v_norm = "TRANSPARENT"
        used.add(v_norm)
    violations = used - WIREFRAME_ALLOWED_COLORS
    # rgba() colors are used by Riso/Prism; for wireframe library they shouldn't appear
    rgba_uses = re.findall(r'(?:fill|stroke)="(rgba?\([^)]+\))"', svg_text)
    if rgba_uses:
        violations |= set(rgba_uses)
    return {
        "rule_id": "wireframe-palette",
        "passed": len(violations) == 0,
        "actual": sorted(used),
        "violations": sorted(violations),
    }


def check_wireframe_type_scale(svg_text):
    """Rule: every font-size is one of the 7 wireframe library scale values."""
    sizes = extract_attrs(svg_text, "text", "font-size")
    sizes_int = [int(float(s)) for s in sizes]
    used = set(sizes_int)
    violations = used - WIREFRAME_TYPE_SCALE
    return {
        "rule_id": "wireframe-type-scale",
        "passed": len(violations) == 0,
        "actual": sorted(used),
        "violations": sorted(violations),
        "expected": sorted(WIREFRAME_TYPE_SCALE),
    }


def check_wireframe_no_shadows(svg_text):
    """Rule: no shadows. SVG: no <filter> / no feDropShadow / no filter= refs."""
    has_filter_def = "<filter " in svg_text or "<filter\n" in svg_text
    has_filter_ref = re.search(r'\bfilter="(?!none)[^"]+"', svg_text) is not None
    has_drop_shadow = "feDropShadow" in svg_text
    return {
        "rule_id": "wireframe-no-shadows",
        "passed": not (has_filter_def or has_filter_ref or has_drop_shadow),
        "actual": {"filter_def": has_filter_def, "filter_ref": has_filter_ref, "drop_shadow": has_drop_shadow},
    }


def check_wireframe_no_double_hyphens(svg_text):
    """Rule: SVG comments must not contain '--' inside the body.
    XML forbids '--' inside comments (only the '<!--' opener and '-->' closer are allowed).
    """
    violations = []
    for m in re.finditer(r'<!--(.*?)-->', svg_text, re.DOTALL):
        body = m.group(1)
        if "--" in body:
            violations.append(body[:60].strip())
    return {
        "rule_id": "wireframe-no-double-hyphens-in-comments",
        "passed": len(violations) == 0,
        "violations": violations,
    }


def check_wireframe_css_classes(svg_text):
    """Rule: text elements use CSS classes (text-primary, etc.) for fill,
    not inline fill attributes."""
    # Find text elements with inline fill (i.e. not using class-based styling).
    # OK exceptions: text-disabled with fill="..." for semantic colors when class exists.
    inline_fills = []
    for m in re.finditer(r'<text\s+[^>]*?>', svg_text):
        tag = m.group(0)
        if 'fill="' not in tag:
            continue
        if 'class="' in tag:
            # class is present — this is OK only if the inline fill is a semantic
            # color override, but for the wireframe library convention
            # we want classes to fully drive color. Flag inline fill regardless.
            fill_match = re.search(r'fill="([^"]+)"', tag)
            inline_fills.append((tag[:80] + "...", fill_match.group(1) if fill_match else ""))
        else:
            fill_match = re.search(r'fill="([^"]+)"', tag)
            inline_fills.append((tag[:80] + "...", fill_match.group(1) if fill_match else ""))
    return {
        "rule_id": "wireframe-css-classes-not-inline-fills",
        "passed": len(inline_fills) == 0,
        "inline_fill_count": len(inline_fills),
        "samples": inline_fills[:5],
    }


# Each entry: (check_function, check_scope)
#   check_scope: 'artifact' | 'component' | 'both'
#     artifact  — meaningful only on a composed wireframe; skipped in
#                 component-fragment batch checks (e.g. red-finite-resource
#                 counts X per screen).
#     component — applies wherever the target element appears; the check
#                 itself should pass-vacuous when its predicate doesn't
#                 match any element in the fragment.
#     both      — applies at every level (e.g. zero-radius — no rounded
#                 corners anywhere, ever).
# Mirrors the YAML rulebook's check_scope field (Schema v0.2 Change 12).

# ──────────────────────────────────────────────────────────────────────
# PROJECT-WIDE NO-EMOJI POLICY
# ──────────────────────────────────────────────────────────────────────
# Per the tkr-kit no-emoji policy, NO system should contain emoji
# codepoints in its SVGs. Each system's spec.yaml declares an
# `avatar_strategy` (monogram, abbreviation, numeric_index, none) and
# CairoSVG no longer needs to substitute glyphs at render time.
#
# This check scans for codepoints in the standard Unicode emoji blocks
# plus the dingbats/misc-symbols blocks that contain decorative glyphs
# (✦, ✎, etc. — also emoji-tier per the policy).

_EMOJI_PATTERN = re.compile(
    r"[\U0001F300-\U0001F5FF"   # Misc Symbols and Pictographs
    r"\U0001F600-\U0001F64F"     # Emoticons
    r"\U0001F680-\U0001F6FF"     # Transport and Map Symbols
    r"\U0001F900-\U0001F9FF"     # Supplemental Symbols and Pictographs
    r"\U0001FA70-\U0001FAFF"     # Symbols and Pictographs Extended-A
    r"☀-⛿"             # Misc Symbols (☀-⛿)
    r"✀-➿"             # Dingbats (✀-➿)
    r"]"
)


def check_no_emoji(svg_text):
    """Rule: no emoji glyphs anywhere in the SVG.

    Scans for codepoints in the standard Unicode emoji blocks. Returns
    distinct emoji found (deduplicated, sorted) plus a count. Pass when
    zero matches.
    """
    found = sorted(set(_EMOJI_PATTERN.findall(svg_text)))
    return {
        "rule_id": "no-emoji-imagery",
        "passed": len(found) == 0,
        "actual_emoji": found,
        "count": len(found),
    }


WIREFRAME_CHECKS = [
    (check_wireframe_palette,           "both"),
    (check_wireframe_type_scale,        "both"),
    (check_wireframe_no_shadows,        "both"),
    (check_wireframe_no_double_hyphens, "both"),
    (check_wireframe_css_classes,       "both"),
    (check_wireframe_text_overflow,     "both"),
    (check_no_emoji,                    "both"),
]


SWISS_CHECKS = [
    (check_red_finite_resource,  "artifact"),   # X per screen — vacuous on fragments
    (check_zero_radius,          "both"),
    (check_no_shadows,           "both"),
    (check_fixed_type_scale,     "both"),
    (check_single_typeface,      "both"),
    (check_color_palette,        "both"),
    (check_metadata_uppercase,   "component"),  # vacuous when no 9px text present
    (check_grid_alignment,       "both"),
    (check_no_emoji,             "both"),
]


# Per-system rulesets for systems with no other mechanical checks
# implemented yet. The no-emoji rule applies universally and is the
# only mechanical check for these systems today; richer per-system
# checks (e.g. burgundy-discipline, glass-elevation) live in their
# spec.yaml as semantic rules until mechanical implementations land.
EDITORIAL_CHECKS = [
    (check_no_emoji, "both"),
]

SKETCH_CHECKS = [
    (check_no_emoji, "both"),
]

PRISM_CHECKS = [
    (check_no_emoji, "both"),
]

REVOLT_CHECKS = [
    (check_no_emoji, "both"),
]

TERMINAL_CHECKS = [
    (check_no_emoji, "both"),
]

RISO_CHECKS = [
    (check_no_emoji, "both"),
]


def _select_checks(checks, scope):
    """Return the subset of (check_fn, check_scope) tuples that apply at the
    given evaluation scope. scope='artifact' includes both 'artifact' and
    'both'; scope='component' includes both 'component' and 'both'."""
    if scope == "artifact":
        return [(fn, s) for fn, s in checks if s in ("artifact", "both")]
    if scope == "component":
        return [(fn, s) for fn, s in checks if s in ("component", "both")]
    # 'all' — backward compat for single-file mode that doesn't know the scope
    return list(checks)


# ──────────────────────────────────────────────────────────────────────
# RUNNER
# ──────────────────────────────────────────────────────────────────────

def detect_ruleset(svg_path: str) -> str:
    """Heuristic: pick a ruleset based on the SVG path."""
    p = str(svg_path).lower()
    if "wireframe-library" in p or "/wireframe/" in p:
        return "wireframe"
    if "swiss" in p:
        return "swiss"
    return "wireframe"  # default for the new world


def detect_scope(svg_path: str) -> str:
    """Heuristic: pick a scope based on the SVG path.
    Files inside components/ are component-scope; files inside layouts/ or
    at top level are artifact-scope. Used when --scope isn't explicit.
    Matches the literal path component "components" or "layouts" anywhere
    in the path (works for both file paths and directory paths).
    """
    parts = str(svg_path).lower().replace("\\", "/").rstrip("/").split("/")
    if "components" in parts:
        return "component"
    if "layouts" in parts:
        return "artifact"
    return "artifact"


# Per-ruleset advisory rules — failures here render as ADVISORY, not FAIL.
# Used by both single-file and batch runners.
ADVISORY_BY_RULESET = {
    "swiss": {"swiss-grid-alignment"},
    "wireframe": set(),
    "editorial": set(),
    "sketch": set(),
    "prism": set(),
    "revolt": set(),
    "terminal": set(),
    "riso": set(),
}

# Mapping from ruleset name to the list of (check_fn, scope) tuples.
# Adding a new ruleset = registering its CHECKS list here.
CHECKS_BY_RULESET = {
    "swiss": SWISS_CHECKS,
    "wireframe": WIREFRAME_CHECKS,
    "editorial": EDITORIAL_CHECKS,
    "sketch": SKETCH_CHECKS,
    "prism": PRISM_CHECKS,
    "revolt": REVOLT_CHECKS,
    "terminal": TERMINAL_CHECKS,
    "riso": RISO_CHECKS,
}


def run_all_checks(svg_path, ruleset: str = None, scope: str = None):
    svg_text = Path(svg_path).read_text()
    if ruleset is None:
        ruleset = detect_ruleset(svg_path)
    if scope is None:
        scope = detect_scope(svg_path)

    all_checks = CHECKS_BY_RULESET.get(ruleset)
    if all_checks is None:
        print(f"Unknown ruleset: {ruleset!r}. Choices: {sorted(CHECKS_BY_RULESET)}.")
        sys.exit(1)
    advisory_rules = ADVISORY_BY_RULESET.get(ruleset, set())
    checks = _select_checks(all_checks, scope)
    skipped = [fn.__name__ for fn, s in all_checks if (fn, s) not in checks]

    print(f"\nRulebook compliance check ({ruleset}, scope={scope}): {svg_path}\n" + "=" * 70)
    if skipped:
        print(f"  Skipped (out-of-scope): {len(skipped)} rule(s)")
    passed = 0
    failed = 0
    advisory = 0

    # Universal precheck: XML must parse before any per-ruleset rule runs.
    xml_result = check_xml_well_formed(svg_text)
    if not xml_result["passed"]:
        print(f"\n[FAIL] {xml_result['rule_id']}")
        for k, v in xml_result.items():
            if k in ("rule_id", "passed"):
                continue
            print(f"  {k}: {v}")
        print(f"\n{'=' * 70}\nSummary ({ruleset}, scope={scope}): aborted on xml-well-formed; per-ruleset checks skipped.")
        return {"passed": 0, "failed": 1, "advisory": 0}
    print(f"\n[PASS] {xml_result['rule_id']}")
    passed += 1

    for check_fn, _ in checks:
        result = check_fn(svg_text)
        status = "PASS" if result["passed"] else "FAIL"
        if result["passed"]:
            passed += 1
        else:
            if result["rule_id"] in advisory_rules:
                status = "ADVISORY"
                advisory += 1
            else:
                failed += 1
        print(f"\n[{status}] {result['rule_id']}")
        for k, v in result.items():
            if k in ("rule_id", "passed"):
                continue
            if isinstance(v, list) and len(v) > 10:
                print(f"  {k}: {v[:10]} ... ({len(v)} total)")
            else:
                print(f"  {k}: {v}")
    print(f"\n{'=' * 70}\nSummary ({ruleset}, scope={scope}): {passed} passed, {failed} failed, {advisory} advisory")
    return {"passed": passed, "failed": failed, "advisory": advisory}


def run_batch(directory: str, ruleset: str = "wireframe", scope: str = None):
    """Run checks against every SVG in a directory. Useful for the
    wireframe library's components/ and layouts/ folders.

    Scope defaults from the directory path: components/ -> 'component',
    layouts/ -> 'artifact'. Override with the scope argument.
    """
    if scope is None:
        scope = detect_scope(directory)
    files = sorted(Path(directory).glob("*.svg"))
    all_checks = CHECKS_BY_RULESET.get(ruleset)
    if all_checks is None:
        print(f"Unknown ruleset: {ruleset!r}. Choices: {sorted(CHECKS_BY_RULESET)}.")
        sys.exit(1)
    advisory_rules = ADVISORY_BY_RULESET.get(ruleset, set())
    checks = _select_checks(all_checks, scope)
    skipped_count = sum(1 for c in all_checks if c not in checks)

    print(f"\nBatch check ({ruleset}, scope={scope}): {len(files)} SVGs in {directory}\n" + "=" * 70)
    if skipped_count:
        print(f"  Skipped {skipped_count} out-of-scope rule(s) per check_scope")
    summary = {"files": 0, "passed_files": 0, "failed_files": 0,
               "total_failures": 0, "total_advisory": 0, "xml_broken": 0}
    failed_files = []
    for f in files:
        svg_text = f.read_text()
        file_failures = []
        file_advisory = []

        # Universal precheck: if XML doesn't parse, record the file as broken
        # and skip the per-ruleset checks (their regexes would amplify the
        # noise without adding signal).
        xml_result = check_xml_well_formed(svg_text)
        if not xml_result["passed"]:
            file_failures.append(
                f"{xml_result['rule_id']}: {xml_result.get('parse_error', 'unparseable')}"
            )
            summary["xml_broken"] += 1
        else:
            for check_fn, _ in checks:
                result = check_fn(svg_text)
                if not result["passed"]:
                    if result["rule_id"] in advisory_rules:
                        file_advisory.append(result["rule_id"])
                    else:
                        file_failures.append(result["rule_id"])
        summary["files"] += 1
        summary["total_advisory"] += len(file_advisory)
        if file_failures:
            summary["failed_files"] += 1
            summary["total_failures"] += len(file_failures)
            failed_files.append((f.name, file_failures))
        else:
            summary["passed_files"] += 1

    if failed_files:
        print(f"\n{summary['failed_files']} of {summary['files']} files have failures:\n")
        for fname, fails in failed_files:
            print(f"  {fname}:")
            for rule in fails:
                print(f"    - {rule}")
    xml_note = f", {summary['xml_broken']} unparseable" if summary["xml_broken"] else ""
    print(f"\n{'=' * 70}\nBatch summary: {summary['passed_files']}/{summary['files']} files clean, "
          f"{summary['total_failures']} rule failures, {summary['total_advisory']} advisory{xml_note}")
    return summary


if __name__ == "__main__":
    args = sys.argv[1:]
    ruleset = None
    scope = None
    if "--ruleset" in args:
        i = args.index("--ruleset")
        ruleset = args[i + 1]
        args = args[:i] + args[i + 2:]
    if "--scope" in args:
        i = args.index("--scope")
        scope = args[i + 1]
        if scope not in ("component", "artifact", "all"):
            print(f"Unknown --scope {scope!r}. Choices: component, artifact, all.")
            sys.exit(1)
        args = args[:i] + args[i + 2:]
    if "--batch" in args:
        i = args.index("--batch")
        directory = args[i + 1]
        run_batch(directory, ruleset or "wireframe", scope)
    else:
        target = args[0] if args else "dashboard.svg"
        run_all_checks(target, ruleset, scope)
