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
    python3 rulebook_check.py <svg-path> --exceptions <yaml>   # explicit allow-list

Scope (per Schema v0.2 Change 12):
    component  — fragment-level checks; artifact-only rules (e.g. red-finite-resource
                 counting per-screen) are skipped. Used by default for files in
                 .../components/ directories.
    artifact   — full-screen checks; all applicable rules run. Used by default for
                 files in .../layouts/ or top-level files.
    all        — runs every rule regardless of scope. Useful for diagnostic mode.

Only the mechanical rules are checkable here; rules requiring judgment
(e.g. swiss-numerical-display semantic correctness, or whether Swiss error
copy names what failed and stays free of icons and red, per
swiss-error-typographic) are noted but not automatically verified.

Rule exceptions (allow-list):
    A deliberate, defensible deviation from a rule is recorded as data in
    ``systems/<id>/rulebook-exceptions.yaml``, next to the system's
    spec.yaml. The file is per system because rulesets are per system and
    the exceptions belong with the spec they qualify; it is discovered by
    walking up from the checked SVG (or batch directory) to the nearest
    directory containing ``spec.yaml``. ``--exceptions <file>`` overrides
    discovery. Format::

        version: 1
        exceptions:
          - file: components/chart-legend.svg   # path or glob, relative to
                                                # this file's directory
            rule: wireframe-palette             # rule_id being excepted
            match: "#7B1FA2"                    # optional token
            reason: Why this deviation is deliberate.   # required, non-empty

    ``file`` globs use ``*``/``?`` within one path segment and ``**/`` across
    directories. Without ``match`` an entry covers every violation of its
    rule in matching files; with ``match`` it covers only violations whose
    text contains the token, so a new, different violation still fails.

    Waived violations are reported as WAIVED with their reason and count as
    passing. An entry with no ``reason``, an unknown key, or an unknown rule
    id is a validation error (exit 2). An entry that matched no violation
    although its rule ran on a file it names is *stale* and fails the run
    (reported as ``rulebook-exception-stale``), so the list cannot rot. In
    batch mode an entry whose literal directory is the batch directory but
    whose pattern matches no file there (renamed or deleted) is stale too.
    Entries for files outside the run are never considered.

Exit status: 0 when nothing fails, 1 on rule failures or stale exceptions,
2 when the exceptions file is invalid.
"""

import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional


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

SWISS_TOKENS_PATH = Path(__file__).resolve().parents[2] / "systems" / "swiss" / "tokens.json"


def _load_tokens(path: Path) -> dict:
    """Parse a token file; empty when it is missing or invalid."""
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return {}


def _swiss_color(tokens: dict, path: str, fallback: str) -> str:
    """Read a colour from the Swiss token document, upper-cased.

    Args:
        tokens: Parsed ``systems/swiss/tokens.json`` (may be empty).
        path: Dotted token path, e.g. ``color.accent``.
        fallback: Value used when the file or token is unavailable.

    Returns:
        The colour as upper-case hex.
    """
    node: Any = tokens
    for part in path.split("."):
        node = node.get(part) if isinstance(node, dict) else None
    return (node if isinstance(node, str) else fallback).upper()


def _load_swiss_tokens() -> dict:
    """Parse the Swiss token file; empty when it is missing or invalid."""
    return _load_tokens(SWISS_TOKENS_PATH)


# The Swiss palette comes from the canonical token file (issue #4), so the
# rulebook and the generated library agree when a token value changes.
_SWISS_TOKENS = _load_swiss_tokens()
SWISS_RED = _swiss_color(_SWISS_TOKENS, "color.accent", "#E3000B")
SWISS_INK = _swiss_color(_SWISS_TOKENS, "color.text_primary", "#000000")
SWISS_PAPER = _swiss_color(_SWISS_TOKENS, "color.surface", "#FFFFFF")
SWISS_GRAY_SURFACE = _swiss_color(_SWISS_TOKENS, "color.surface_elevated", "#F5F5F5")
SWISS_GRAY_METADATA = _swiss_color(_SWISS_TOKENS, "color.text_secondary", "#5A5A5A")
SWISS_GRAY_TERTIARY = _swiss_color(_SWISS_TOKENS, "color.text_muted", "#949494")
SWISS_RULE_HAIRLINE = _swiss_color(_SWISS_TOKENS, "extras.color.rule_hairline", "#F0F0F0")
SWISS_RULE_DEFAULT = _swiss_color(_SWISS_TOKENS, "color.border_default", "#E0E0E0")
SWISS_ALLOWED_COLORS = {SWISS_RED, SWISS_INK, SWISS_PAPER, SWISS_GRAY_SURFACE,
                        SWISS_GRAY_METADATA, SWISS_GRAY_TERTIARY, SWISS_RULE_HAIRLINE,
                        SWISS_RULE_DEFAULT}
# Colours a 9px metadata label may use: the two greys, red, ink.
SWISS_METADATA_COLORS = (SWISS_GRAY_METADATA, SWISS_GRAY_TERTIARY, SWISS_RED, SWISS_INK)


# ──────────────────────────────────────────────────────────────────────
# WIREFRAME LIBRARY CONSTANTS
# Per tkr-kit/.claude/skills/wireframe-skill + wireframe-spec.yaml
# ──────────────────────────────────────────────────────────────────────

WIREFRAME_TYPE_SCALE = {11, 12, 13, 14, 16, 18, 24}

WIREFRAME_TOKENS_PATH = SWISS_TOKENS_PATH.parents[1] / "wireframe" / "tokens.json"


def _token_palette(tokens: dict, groups: tuple[str, ...]) -> set[str]:
    """Collect the opaque hex colours under the given token groups.

    Args:
        tokens: Parsed token document (may be empty).
        groups: Dotted paths of colour groups, e.g. ``("color", "extras.color")``.

    Returns:
        Upper-case ``#RRGGBB`` values; an 8-digit hex contributes its RGB part.
    """
    palette: set[str] = set()
    for path in groups:
        node: Any = tokens
        for part in path.split("."):
            node = node.get(part) if isinstance(node, dict) else None
        for value in (node or {}).values() if isinstance(node, dict) else ():
            if isinstance(value, str) and re.fullmatch(r"#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?", value):
                palette.add(value[:7].upper())
    return palette


# The wireframe palette comes from the canonical token file (issue #4), so a
# token change (e.g. a contrast fix) reaches the rulebook and the library together.
_WIREFRAME_PALETTE = _token_palette(_load_tokens(WIREFRAME_TOKENS_PATH), ("color", "extras.color"))
# No hard-coded fallback: a missing token file leaves only the two entries
# below, so every coloured artifact fails loudly instead of passing stale values.
WIREFRAME_ALLOWED_COLORS = _WIREFRAME_PALETTE | {
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
       color secondary/tertiary grey (or red / ink in permitted contexts),
       all read from systems/swiss/tokens.json.

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
        if color and color not in SWISS_METADATA_COLORS:
            failures.append(f"9px text with fill={color} "
                            f"(expected {' / '.join(SWISS_METADATA_COLORS)})")
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


# Swiss error copy (spec rulebook swiss-error-prefix / swiss-error-not-red,
# grounded in the JSX voice table: Error -> "Error: send failed.").
SWISS_ERROR_PREFIX = "Error:"
_ERROR_WORD = re.compile(r"error\b", re.IGNORECASE)
_SWISS_ERROR_FORM = re.compile(r"Error: \S.*\.\Z", re.DOTALL)
_TEXT_ELEMENT = re.compile(r"<text\b([^>]*)>(.*?)</text>", re.DOTALL)
_BANNER_COMMENT = re.compile(r"<!--\s*=+\s*([A-Z0-9][A-Z0-9 _-]*?)\s*=+\s*-->")
_ENTITIES = {"&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'"}


def _text_elements(svg_text: str) -> list[tuple[dict[str, str], str]]:
    """Return every ``<text>`` element as (attributes, plain content).

    Args:
        svg_text: SVG source.

    Returns:
        One (attrs, content) pair per ``<text>``; nested tags such as
        ``<tspan>`` are flattened, entities decoded, whitespace trimmed.
    """
    out = []
    for m in _TEXT_ELEMENT.finditer(svg_text):
        attrs = dict(re.findall(r'(\w[\w-]*)="([^"]*)"', m.group(1)))
        content = re.sub(r"<[^>]+>", "", m.group(2))
        for entity, char in _ENTITIES.items():
            content = content.replace(entity, char)
        out.append((attrs, " ".join(content.split())))
    return out


def _is_error_component(svg_text: str) -> bool:
    """True when the builder banner comment names an error component.

    The builders stamp each SVG with ``<!-- ===== NAME ===== -->`` (for
    example ``TOAST-ERROR``); hand-authored SVGs without the banner are
    never treated as error components.
    """
    return any("ERROR" in re.split(r"[-_ ]+", name)
               for name in _BANNER_COMMENT.findall(svg_text))


def check_error_prefix(svg_text: str) -> dict:
    """Rule swiss-error-prefix: error copy reads ``Error: <what failed>.``

    The JSX voice table prescribes ``Error: send failed.`` (prefix with a
    capital E and a colon, the failure, a closing period). Two mechanical
    checks follow from it:

    1. Every ``<text>`` whose content starts with the word "error" (any
       case) has exactly that form, so ``ERROR``, ``error: x``,
       ``Error - x`` and ``Error: x`` (no period) fail.
    2. A component whose builder banner names it an error component
       (``*-ERROR``, ``*-WITH-ERROR``) carries at least one such text.

    Whether the message after the prefix is lowercase and names what failed
    is judgment (proper nouns), left to swiss-error-typographic.

    Args:
        svg_text: SVG source.

    Returns:
        Result dict; ``violations`` lists each offending text, plus a
        ``missing prefix`` item for an error component without one.
    """
    texts = [content for _, content in _text_elements(svg_text)]
    error_texts = [t for t in texts if _ERROR_WORD.match(t)]
    violations = [f"{t!r} (expected 'Error: <what failed>.')"
                  for t in error_texts if not _SWISS_ERROR_FORM.match(t)]
    is_error_component = _is_error_component(svg_text)
    if is_error_component and not any(_SWISS_ERROR_FORM.match(t) for t in error_texts):
        violations.append("error component has no 'Error: <what failed>.' text "
                          "(missing prefix)")
    return {
        "rule_id": "swiss-error-prefix",
        "passed": not violations,
        "violations": violations,
        "error_component": is_error_component,
        "vacuous": not error_texts and not is_error_component,
    }


def check_error_not_red(svg_text: str) -> dict:
    """Rule swiss-error-not-red: ``Error:`` copy is never set in red.

    Red's four contexts (swiss-red-finite-resource: CTAs, selection bars,
    user tags, status dots) do not include error messages, and the JSX
    lists red warning messages as a Don't. A text starting with
    ``Error:`` whose fill (inline or via a CSS class) resolves to the
    accent red fails.

    Args:
        svg_text: SVG source.

    Returns:
        Result dict; ``violations`` lists each red error text.
    """
    css_class_fills = _extract_css_class_fills(svg_text)
    violations = [
        repr(content)
        for attrs, content in _text_elements(svg_text)
        if content.startswith(SWISS_ERROR_PREFIX)
        and _resolve_text_fill(attrs, css_class_fills) == SWISS_RED
    ]
    return {
        "rule_id": "swiss-error-not-red",
        "passed": not violations,
        "violations": violations,
        "expected": f"error copy in ink, not {SWISS_RED}",
    }


# ──────────────────────────────────────────────────────────────────────
# REVOLT CHECKS (spec rulebook revolt-pink-not-text / revolt-error-status)
# ──────────────────────────────────────────────────────────────────────

REVOLT_TOKENS_PATH = SWISS_TOKENS_PATH.parents[1] / "revolt" / "tokens.json"
_REVOLT_TOKENS = _load_tokens(REVOLT_TOKENS_PATH)
REVOLT_PINK = _swiss_color(_REVOLT_TOKENS, "color.accent", "#FF3366")
REVOLT_DANGER = _swiss_color(_REVOLT_TOKENS, "color.danger", "#FF3366")
REVOLT_INK = _swiss_color(_REVOLT_TOKENS, "color.text_primary", "#111111")
REVOLT_DANGER_FOREGROUND = _swiss_color(_REVOLT_TOKENS, "color.danger_foreground", "#111111")


def check_revolt_pink_not_text(svg_text: str) -> dict:
    """Rule revolt-pink-not-text: pink is a fill, never a text colour.

    Revolt's backgrounds are cream, white, lime and pink (the JSX colour
    roles: black is never a background), and the pink (``color.accent``,
    reused as ``color.danger``) measures under 4.5:1 as text on every one
    of them (about 3.5:1 on cream and white). Errors are carried by the
    ERROR status pill, not by pink type. A ``<text>`` or ``<tspan>`` whose
    fill (inline, or via a ``<defs><style>`` class) resolves to the pink
    fails.

    Args:
        svg_text: SVG source.

    Returns:
        Result dict; ``violations`` lists each pink text element.
    """
    css_class_fills = _extract_css_class_fills(svg_text)
    pinks = {REVOLT_PINK, REVOLT_DANGER}
    violations = []
    for tag, attrs in extract_inline_attrs(svg_text):
        if tag not in ("text", "tspan"):
            continue
        fill = _resolve_text_fill(attrs, css_class_fills)
        if fill in pinks:
            violations.append(f"{tag}(fill={fill}, x={attrs.get('x', '?')}, "
                              f"y={attrs.get('y', '?')})")
    return {
        "rule_id": "revolt-pink-not-text",
        "passed": not violations,
        "violations": violations,
        "expected": (f"text in ink, or {REVOLT_DANGER_FOREGROUND} on a pink fill; "
                     f"never {REVOLT_PINK} type"),
    }


def check_revolt_error_pill(svg_text: str) -> dict:
    """Rule revolt-error-status (mechanical part): error components carry the ERROR pill.

    A component whose builder banner names it an error component
    (``*-ERROR``, ``*-WITH-ERROR``) must contain the status-pill grammar of
    the spec's ``error_status`` block: a ``<rect>`` filled with
    ``color.danger``, stroked in ink at 2px with no corner radius, and a
    ``<text>`` reading ``ERROR`` at 9px / weight 700 in
    ``color.danger_foreground``. Fragments without the banner pass
    vacuously; whether the rest of the copy is code-like
    (``ERROR // INVALID``) is judgment.

    Args:
        svg_text: SVG source.

    Returns:
        Result dict; ``violations`` names each missing part.
    """
    if not _is_error_component(svg_text):
        return {"rule_id": "revolt-error-status", "passed": True, "violations": [],
                "vacuous": True}
    css_class_fills = _extract_css_class_fills(svg_text)
    pill = any(
        tag == "rect"
        and attrs.get("fill", "").upper() == REVOLT_DANGER
        and attrs.get("stroke", "").upper() == REVOLT_INK
        and attrs.get("stroke-width") == "2"
        and attrs.get("rx", "0") == "0"
        for tag, attrs in extract_inline_attrs(svg_text))
    label = any(
        content == "ERROR"
        and attrs.get("font-size") == "9"
        and attrs.get("font-weight") == "700"
        and _resolve_text_fill(attrs, css_class_fills) == REVOLT_DANGER_FOREGROUND
        for attrs, content in _text_elements(svg_text))
    violations = []
    if not pill:
        violations.append(f"no pill rect (fill {REVOLT_DANGER}, 2px {REVOLT_INK} stroke, radius 0)")
    if not label:
        violations.append(f"no 'ERROR' label at 9px/700 in {REVOLT_DANGER_FOREGROUND}")
    return {"rule_id": "revolt-error-status", "passed": not violations,
            "violations": violations, "vacuous": False}


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
    (check_error_prefix,         "both"),
    (check_error_not_red,        "both"),
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
    (check_revolt_pink_not_text, "both"),
    (check_revolt_error_pill,    "both"),
    (check_no_emoji,             "both"),
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
# RULE EXCEPTIONS (ALLOW-LIST)
# ──────────────────────────────────────────────────────────────────────
# Deliberate, documented deviations from a rule live as data in
# ``systems/<id>/rulebook-exceptions.yaml`` (the directory holding the
# system's spec.yaml). See the module docstring for the file format.
#
# Matching works on *violation items*: each failing result is reduced to
# a list of strings (one per offending colour, size, overflowing text,
# ...). An entry without ``match`` covers every item of its rule in its
# file; an entry with ``match`` covers only items containing that token.
# A result counts as waived only when every one of its items is covered,
# so a new violation of an already-excepted rule still fails.

EXCEPTIONS_FILENAME = "rulebook-exceptions.yaml"
STALE_RULE_ID = "rulebook-exception-stale"
XML_RULE_ID = "xml-well-formed"

_ENTRY_KEYS = {"file", "rule", "match", "reason"}
_TOP_LEVEL_KEYS = {"version", "exceptions"}
_GLOB_CHARS = set("*?[")

# rule_id -> (detail key holding the violations, optional key holding the
# untruncated count). Rules not listed fall back to a single item: the
# whole result detail rendered as text.
_VIOLATION_ITEM_KEYS = {
    XML_RULE_ID: ("parse_error", None),
    "swiss-zero-radius": ("actual", None),
    "swiss-no-shadows": ("actual", None),
    "swiss-fixed-type-scale": ("violations", None),
    "swiss-single-typeface": ("violations", None),
    "swiss-color-palette": ("violations", None),
    "swiss-metadata-uppercase": ("actual_failures", None),
    "swiss-grid-alignment": ("off_grid_values", "off_grid_count"),
    "swiss-error-prefix": ("violations", None),
    "swiss-error-not-red": ("violations", None),
    "wireframe-text-overflow": ("overflows", None),
    "wireframe-palette": ("violations", None),
    "wireframe-type-scale": ("violations", None),
    "wireframe-no-shadows": ("actual", None),
    "wireframe-no-double-hyphens-in-comments": ("violations", None),
    "wireframe-css-classes-not-inline-fills": ("samples", "inline_fill_count"),
    "no-emoji-imagery": ("actual_emoji", None),
}


class ExceptionsFileError(ValueError):
    """Raised when a rulebook-exceptions file is unreadable or invalid.

    Attributes:
        path: The offending file.
        errors: Every validation problem found, collected in one pass.
    """

    def __init__(self, path: Path, errors: list[str]) -> None:
        self.path = Path(path)
        self.errors = list(errors)
        super().__init__(f"{self.path}: " + "; ".join(self.errors))


@dataclass(frozen=True)
class RuleException:
    """One allow-list entry.

    Attributes:
        file: Path or glob relative to the exceptions file's directory.
        rule: The rule_id being excepted.
        reason: Why the deviation is deliberate. Always non-empty.
        match: Optional token; restricts the entry to violation items
            containing it.
        index: Position in the ``exceptions`` list (for messages).
    """

    file: str
    rule: str
    reason: str
    match: Optional[str] = None
    index: int = 0

    def describe(self) -> str:
        """Return a one-line human description of the entry."""
        token = f" match={self.match!r}" if self.match is not None else ""
        return f"#{self.index} {self.file} [{self.rule}]{token}"

    def to_dict(self) -> dict[str, Any]:
        """Return the entry as a plain dict (for JSON output)."""
        return {"file": self.file, "rule": self.rule, "match": self.match,
                "reason": self.reason, "index": self.index}


def _glob_to_regex(pattern: str) -> "re.Pattern[str]":
    """Compile a path glob into a regex.

    ``*`` and ``?`` stay within one path segment, ``**/`` spans zero or
    more directories, ``[...]`` is a character class (``[!...]`` negates).

    Args:
        pattern: The glob, using ``/`` separators.

    Returns:
        A compiled regex to be used with ``fullmatch``.
    """
    out = []
    i = 0
    while i < len(pattern):
        if pattern.startswith("**/", i):
            out.append(r"(?:[^/]+/)*")
            i += 3
        elif pattern.startswith("**", i):
            out.append(r".*")
            i += 2
        elif pattern[i] == "*":
            out.append(r"[^/]*")
            i += 1
        elif pattern[i] == "?":
            out.append(r"[^/]")
            i += 1
        elif pattern[i] == "[" and pattern.find("]", i + 1) != -1:
            end = pattern.find("]", i + 1)
            body = pattern[i + 1:end]
            if body.startswith("!"):
                body = "^" + body[1:]
            out.append(f"[{body}]")
            i = end + 1
        else:
            out.append(re.escape(pattern[i]))
            i += 1
    return re.compile("".join(out))


def _literal_dir(pattern: str) -> Optional[str]:
    """Return the directory part of a pattern, or None if it contains globs.

    Args:
        pattern: Entry file pattern.

    Returns:
        The posix directory ("." for the base directory), or None when a
        directory segment is itself a glob.
    """
    parts = pattern.split("/")[:-1]
    if any(_GLOB_CHARS & set(part) for part in parts):
        return None
    return "/".join(parts) or "."


def parse_exceptions(
    data: Any,
    source: Path,
    known_rule_ids: Optional[set[str]] = None,
) -> list[RuleException]:
    """Validate a parsed exceptions document and build its entries.

    Args:
        data: The YAML document (``None`` for an empty file).
        source: Path of the file, used in error messages.
        known_rule_ids: If given, entries naming any other rule are rejected.

    Returns:
        List of RuleException.

    Raises:
        ExceptionsFileError: Listing every problem found.
    """
    if data is None:
        return []
    if not isinstance(data, dict):
        raise ExceptionsFileError(source, ["top level must be a mapping with an 'exceptions' list"])
    errors = []
    unknown_top = set(data) - _TOP_LEVEL_KEYS
    if unknown_top:
        errors.append(f"unknown top-level key(s): {sorted(unknown_top)}")
    raw_entries = data.get("exceptions") or []
    if not isinstance(raw_entries, list):
        raise ExceptionsFileError(source, errors + ["'exceptions' must be a list"])

    entries = []
    seen: dict[tuple, int] = {}
    for i, raw in enumerate(raw_entries):
        where = f"exceptions[{i}]"
        if not isinstance(raw, dict):
            errors.append(f"{where}: must be a mapping")
            continue
        unknown = set(raw) - _ENTRY_KEYS
        if unknown:
            errors.append(f"{where}: unknown key(s) {sorted(unknown)}")
        file_ = raw.get("file")
        rule = raw.get("rule")
        reason = raw.get("reason")
        match = raw.get("match")
        entry_ok = True
        if not isinstance(file_, str) or not file_.strip():
            errors.append(f"{where}: 'file' is required (path or glob relative to {source.parent})")
            entry_ok = False
        else:
            file_ = file_.strip().replace("\\", "/")
            if file_.startswith("/") or ".." in file_.split("/"):
                errors.append(f"{where}: 'file' must be relative and stay inside "
                              f"{source.parent} (got {file_!r})")
                entry_ok = False
        if not isinstance(rule, str) or not rule.strip():
            errors.append(f"{where}: 'rule' is required")
            entry_ok = False
        else:
            rule = rule.strip()
            if known_rule_ids is not None and rule not in known_rule_ids:
                errors.append(f"{where}: unknown rule {rule!r}; known: {sorted(known_rule_ids)}")
                entry_ok = False
        if not isinstance(reason, str) or not reason.strip():
            errors.append(f"{where}: 'reason' is required and must be non-empty")
            entry_ok = False
        if match is not None and (not isinstance(match, str) or not match):
            errors.append(f"{where}: 'match' must be a non-empty string when present")
            entry_ok = False
        if not entry_ok:
            continue
        key = (file_, rule, match)
        if key in seen:
            errors.append(f"{where}: duplicates exceptions[{seen[key]}]")
            continue
        seen[key] = i
        entries.append(RuleException(file=file_, rule=rule, reason=reason.strip(),
                                     match=match, index=i))
    if errors:
        raise ExceptionsFileError(source, errors)
    return entries


def find_exceptions_file(target: "str | Path") -> Optional[Path]:
    """Locate the exceptions file governing ``target``.

    Walks up from ``target`` (an SVG or a directory) to the nearest
    ancestor holding a ``spec.yaml`` (the system directory) and returns
    its ``rulebook-exceptions.yaml`` if present.

    Args:
        target: SVG file or directory being checked.

    Returns:
        Path to the exceptions file, or None.
    """
    start = Path(target).resolve()
    candidates = ([start] if start.is_dir() else []) + list(start.parents)
    for d in candidates:
        if (d / "spec.yaml").exists():
            f = d / EXCEPTIONS_FILENAME
            return f if f.exists() else None
    return None


_RULE_ID_CACHE: dict[Callable, str] = {}
_PROBE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"></svg>'


def rule_id_of(check_fn: Callable[[str], dict]) -> str:
    """Return the rule_id a check function reports (probed once, cached).

    Args:
        check_fn: A check from one of the CHECKS lists.

    Returns:
        The rule_id string.
    """
    if check_fn not in _RULE_ID_CACHE:
        _RULE_ID_CACHE[check_fn] = check_fn(_PROBE_SVG)["rule_id"]
    return _RULE_ID_CACHE[check_fn]


def known_rule_ids(ruleset: Optional[str] = None) -> set[str]:
    """Rule ids an exception may name: the ruleset's checks plus xml-well-formed.

    Args:
        ruleset: A CHECKS_BY_RULESET key, or None for every ruleset.

    Returns:
        Set of rule ids.
    """
    groups = CHECKS_BY_RULESET.values() if ruleset is None else [CHECKS_BY_RULESET.get(ruleset, [])]
    ids = {XML_RULE_ID}
    for checks in groups:
        ids.update(rule_id_of(fn) for fn, _ in checks)
    return ids


def load_exceptions(
    path: "str | Path",
    known_rule_ids: Optional[set[str]] = None,
) -> "ExceptionSet":
    """Load and validate an exceptions file.

    Args:
        path: Path to a rulebook-exceptions.yaml.
        known_rule_ids: Rule ids valid for the ruleset in use (optional).

    Returns:
        An ExceptionSet whose entries resolve relative to the file's directory.

    Raises:
        ExceptionsFileError: If the file can't be read, parsed, or validated.
    """
    path = Path(path).resolve()
    try:
        import yaml  # lazy: only needed when an exceptions file exists
    except ImportError as e:  # pragma: no cover - environment issue
        raise ExceptionsFileError(path, [f"PyYAML is required to read exceptions: {e}"])
    try:
        data = yaml.safe_load(path.read_text())
    except OSError as e:
        raise ExceptionsFileError(path, [f"cannot read: {e}"])
    except yaml.YAMLError as e:
        raise ExceptionsFileError(path, [f"YAML parse error: {e}"])
    entries = parse_exceptions(data, path, known_rule_ids)
    return ExceptionSet(base_dir=path.parent, entries=entries, source=path)


def resolve_exceptions(
    target: "str | Path",
    ruleset: str,
    exceptions_path: "str | Path | None" = None,
) -> "ExceptionSet":
    """Load the exceptions governing ``target``, or an explicit file.

    Args:
        target: SVG or directory being checked.
        ruleset: Ruleset in use (validates rule ids).
        exceptions_path: Explicit file; overrides discovery.

    Returns:
        An ExceptionSet (empty when no file applies).

    Raises:
        ExceptionsFileError: If the file is missing (when explicit) or invalid.
    """
    path = Path(exceptions_path) if exceptions_path else find_exceptions_file(target)
    if path is None:
        base = Path(target).resolve()
        return ExceptionSet(base_dir=base if base.is_dir() else base.parent)
    if not path.exists():
        raise ExceptionsFileError(path, ["file not found"])
    return load_exceptions(path, known_rule_ids(ruleset))


def violation_items(result: dict) -> list[str]:
    """Reduce a failing result to its individual violations.

    Args:
        result: A check result dict.

    Returns:
        List of strings, one per violation. A truncated listing gets a
        trailing placeholder item so a ``match`` entry can't cover
        violations it never saw.
    """
    key, count_key = _VIOLATION_ITEM_KEYS.get(result.get("rule_id"), (None, None))
    value = result.get(key) if key else None
    if value is None:
        detail = {k: v for k, v in result.items() if k not in ("rule_id", "passed")}
        return [str(detail)]
    if isinstance(value, dict):
        items = [str(k) for k, v in value.items() if v]
    elif isinstance(value, (list, tuple, set)):
        items = [str(v) for v in value]
    else:
        items = [str(value)]
    count = result.get(count_key) if count_key else None
    if isinstance(count, int) and count > len(items):
        items.append(f"<{count - len(items)} more not listed>")
    return items or [str(value)]


@dataclass
class ExceptionSet:
    """A loaded allow-list plus the bookkeeping for one run.

    Use one instance per run: pass every check result through
    :meth:`apply`, then call :meth:`stale` once all files are checked.

    Attributes:
        base_dir: Directory entry paths resolve against.
        entries: The validated entries.
        source: The file they came from (None when no file applies).
    """

    base_dir: Path
    entries: list[RuleException] = field(default_factory=list)
    source: Optional[Path] = None
    _used: set[int] = field(default_factory=set, repr=False)
    _evaluated: set[tuple[str, str]] = field(default_factory=set, repr=False)
    _regex: dict[str, "re.Pattern[str]"] = field(default_factory=dict, repr=False)

    def relpath(self, path: "str | Path") -> Optional[str]:
        """Return ``path`` relative to base_dir (posix), or None if outside."""
        try:
            return Path(path).resolve().relative_to(self.base_dir.resolve()).as_posix()
        except ValueError:
            return None

    def matches_file(self, entry: RuleException, rel: Optional[str]) -> bool:
        """True if the entry's file pattern matches a base-relative path."""
        if rel is None:
            return False
        rx = self._regex.get(entry.file)
        if rx is None:
            rx = self._regex[entry.file] = _glob_to_regex(entry.file)
        return rx.fullmatch(rel) is not None

    def apply(self, svg_path: "str | Path", result: dict) -> dict:
        """Record that ``result``'s rule ran on ``svg_path`` and apply waivers.

        Args:
            svg_path: The checked file.
            result: The check's result dict (not mutated).

        Returns:
            ``result`` itself when no entry applies; otherwise a copy with
            ``waivers`` (the entries used, with reasons) and either
            ``waived: True`` (every violation covered) or ``unwaived`` (the
            violations still failing).
        """
        rel = self.relpath(svg_path)
        rule_id = result.get("rule_id")
        if rel is not None:
            self._evaluated.add((rel, rule_id))
        if result.get("passed") or rel is None:
            return result
        candidates = [e for e in self.entries
                      if e.rule == rule_id and self.matches_file(e, rel)]
        if not candidates:
            return result
        used: list[RuleException] = []
        uncovered = []
        for item in violation_items(result):
            entry = next((e for e in candidates
                          if e.match is None or e.match in item), None)
            if entry is None:
                uncovered.append(item)
            elif entry not in used:
                used.append(entry)
        if not used:
            return result
        self._used.update(e.index for e in used)
        out = dict(result)
        out["waivers"] = [{"file": e.file, "match": e.match, "reason": e.reason}
                          for e in used]
        if uncovered:
            out["unwaived"] = uncovered
        else:
            out["waived"] = True
        return out

    def stale(
        self,
        batch_dir: "str | Path | None" = None,
        rule_ids: "set[str] | None" = None,
    ) -> list[RuleException]:
        """Return entries that applied to this run but matched no violation.

        An entry is in scope when its rule ran on a file its pattern
        matches. In batch mode it is also in scope when its rule was
        selected for the run, its literal directory is ``batch_dir``, and
        its pattern matched no file there (the file was renamed or
        removed). Entries outside the run are never reported.

        Args:
            batch_dir: Directory of a batch run, or None for single-file.
            rule_ids: Rule ids selected for the batch run.

        Returns:
            List of stale entries.
        """
        rule_ids = rule_ids or set()
        batch_rel = self.relpath(batch_dir) if batch_dir is not None else None
        stale = []
        for e in self.entries:
            if e.index in self._used:
                continue
            if any(rid == e.rule and self.matches_file(e, rel)
                   for rel, rid in self._evaluated):
                stale.append(e)
                continue
            if batch_rel is None or e.rule not in rule_ids:
                continue
            if (_literal_dir(e.file) == batch_rel
                    and not any(self.matches_file(e, rel) for rel, _ in self._evaluated)):
                stale.append(e)
        return stale


def classify(result: dict, advisory_rules: set[str]) -> str:
    """Map a (possibly waived) result to pass | waived | advisory | fail.

    Args:
        result: A check result, after :meth:`ExceptionSet.apply`.
        advisory_rules: Rule ids whose failures are advisory.

    Returns:
        The status string.
    """
    if result.get("passed"):
        return "pass"
    if result.get("waived"):
        return "waived"
    if result.get("rule_id") in advisory_rules:
        return "advisory"
    return "fail"


def stale_detail(entry: RuleException) -> dict[str, Any]:
    """Detail dict reported for a stale exception (shared by CLI and skill)."""
    return {
        "exception": entry.to_dict(),
        "hint": "This exception matched no violation; the file is now compliant "
                "or was renamed. Remove or update the entry.",
    }


# ──────────────────────────────────────────────────────────────────────
# RUNNER
# ──────────────────────────────────────────────────────────────────────

def detect_ruleset(svg_path: str) -> str:
    """Heuristic: pick a ruleset based on the SVG path."""
    p = str(svg_path).lower()
    if "/wireframe/" in p:
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


def _print_result(status: str, result: dict) -> None:
    """Print one rule result block (single-file mode)."""
    print(f"\n[{status.upper()}] {result['rule_id']}")
    for waiver in result.get("waivers", []):
        token = f" (match {waiver['match']!r})" if waiver["match"] is not None else ""
        print(f"  waived{token}: {waiver['reason']}")
    for k, v in result.items():
        if k in ("rule_id", "passed", "waived", "waivers"):
            continue
        if isinstance(v, list) and len(v) > 10:
            print(f"  {k}: {v[:10]} ... ({len(v)} total)")
        else:
            print(f"  {k}: {v}")


def _print_stale(stale: list[RuleException], source: Optional[Path]) -> None:
    """Print stale exception entries."""
    if not stale:
        return
    print(f"\n[FAIL] {STALE_RULE_ID}: {len(stale)} exception(s) in {source} matched no violation")
    for e in stale:
        print(f"  - {e.describe()}: {e.reason}")
    print("  Remove or update these entries; the files they name are compliant or were renamed.")


def run_all_checks(svg_path, ruleset: str = None, scope: str = None,
                   exceptions_path=None) -> dict:
    """Run every applicable rule against one SVG and print a report.

    Args:
        svg_path: SVG to check.
        ruleset: Ruleset name; auto-detected from the path when None.
        scope: component | artifact | all; auto-detected when None.
        exceptions_path: Explicit allow-list file; discovered when None.

    Returns:
        Summary dict {passed, failed, advisory, waived, stale}; failed
        includes stale exceptions. On an invalid exceptions file the dict
        carries ``exceptions_error`` and no rules are run.
    """
    svg_text = Path(svg_path).read_text()
    if ruleset is None:
        ruleset = detect_ruleset(svg_path)
    if scope is None:
        scope = detect_scope(svg_path)

    all_checks = CHECKS_BY_RULESET.get(ruleset)
    if all_checks is None:
        print(f"Unknown ruleset: {ruleset!r}. Choices: {sorted(CHECKS_BY_RULESET)}.")
        sys.exit(1)
    try:
        exceptions = resolve_exceptions(svg_path, ruleset, exceptions_path)
    except ExceptionsFileError as e:
        print(f"\nInvalid rulebook exceptions file {e.path}:")
        for err in e.errors:
            print(f"  - {err}")
        return {"passed": 0, "failed": 0, "advisory": 0, "waived": 0, "stale": 0,
                "exceptions_error": e.errors}
    advisory_rules = ADVISORY_BY_RULESET.get(ruleset, set())
    checks = _select_checks(all_checks, scope)
    skipped = [fn.__name__ for fn, s in all_checks if (fn, s) not in checks]

    print(f"\nRulebook compliance check ({ruleset}, scope={scope}): {svg_path}\n" + "=" * 70)
    if skipped:
        print(f"  Skipped (out-of-scope): {len(skipped)} rule(s)")
    if exceptions.source:
        print(f"  Exceptions: {exceptions.source} ({len(exceptions.entries)} entr"
              f"{'y' if len(exceptions.entries) == 1 else 'ies'})")
    counts = {"pass": 0, "fail": 0, "advisory": 0, "waived": 0}

    # Universal precheck: XML must parse before any per-ruleset rule runs.
    xml_result = exceptions.apply(svg_path, check_xml_well_formed(svg_text))
    xml_status = classify(xml_result, set())
    counts[xml_status] += 1
    _print_result(xml_status, xml_result)
    if xml_status == "fail":
        stale = exceptions.stale()
        _print_stale(stale, exceptions.source)
        print(f"\n{'=' * 70}\nSummary ({ruleset}, scope={scope}): aborted on xml-well-formed; per-ruleset checks skipped.")
        return {"passed": 0, "failed": 1 + len(stale), "advisory": 0, "waived": 0,
                "stale": len(stale)}

    for check_fn, _ in checks:
        result = exceptions.apply(svg_path, check_fn(svg_text))
        status = classify(result, advisory_rules)
        counts[status] += 1
        _print_result(status, result)

    stale = exceptions.stale()
    _print_stale(stale, exceptions.source)
    failed = counts["fail"] + len(stale)
    stale_note = f" ({len(stale)} stale exception(s))" if stale else ""
    print(f"\n{'=' * 70}\nSummary ({ruleset}, scope={scope}): {counts['pass']} passed, "
          f"{failed} failed{stale_note}, {counts['advisory']} advisory, {counts['waived']} waived")
    return {"passed": counts["pass"], "failed": failed, "advisory": counts["advisory"],
            "waived": counts["waived"], "stale": len(stale)}


def run_batch(directory: str, ruleset: str = "wireframe", scope: str = None,
              exceptions_path=None) -> dict:
    """Run checks against every SVG in a directory. Useful for the
    wireframe library's components/ and layouts/ folders.

    Scope defaults from the directory path: components/ -> 'component',
    layouts/ -> 'artifact'. Override with the scope argument.

    Args:
        directory: Directory whose ``*.svg`` files are checked.
        ruleset: Ruleset name.
        scope: component | artifact | all; auto-detected when None.
        exceptions_path: Explicit allow-list file; discovered when None.

    Returns:
        Summary dict {files, passed_files, failed_files, total_failures,
        total_advisory, total_waived, stale_exceptions, xml_broken}.
        Stale exceptions are counted separately (they belong to the list,
        not a file) and fail the run. On an invalid exceptions file the
        dict carries ``exceptions_error`` instead.
    """
    if scope is None:
        scope = detect_scope(directory)
    files = sorted(Path(directory).glob("*.svg"))
    all_checks = CHECKS_BY_RULESET.get(ruleset)
    if all_checks is None:
        print(f"Unknown ruleset: {ruleset!r}. Choices: {sorted(CHECKS_BY_RULESET)}.")
        sys.exit(1)
    try:
        exceptions = resolve_exceptions(directory, ruleset, exceptions_path)
    except ExceptionsFileError as e:
        print(f"\nInvalid rulebook exceptions file {e.path}:")
        for err in e.errors:
            print(f"  - {err}")
        return {"files": 0, "exceptions_error": e.errors}
    advisory_rules = ADVISORY_BY_RULESET.get(ruleset, set())
    checks = _select_checks(all_checks, scope)
    skipped_count = sum(1 for c in all_checks if c not in checks)

    print(f"\nBatch check ({ruleset}, scope={scope}): {len(files)} SVGs in {directory}\n" + "=" * 70)
    if skipped_count:
        print(f"  Skipped {skipped_count} out-of-scope rule(s) per check_scope")
    if exceptions.source:
        print(f"  Exceptions: {exceptions.source} ({len(exceptions.entries)} entr"
              f"{'y' if len(exceptions.entries) == 1 else 'ies'})")
    summary = {"files": 0, "passed_files": 0, "failed_files": 0,
               "total_failures": 0, "total_advisory": 0, "total_waived": 0,
               "stale_exceptions": 0, "xml_broken": 0}
    failed_files = []
    waived_files = []
    for f in files:
        svg_text = f.read_text()
        file_failures = []
        file_advisory = []
        file_waived = []

        # Universal precheck: if XML doesn't parse, record the file as broken
        # and skip the per-ruleset checks (their regexes would amplify the
        # noise without adding signal).
        xml_result = exceptions.apply(f, check_xml_well_formed(svg_text))
        xml_status = classify(xml_result, set())
        if xml_status == "fail":
            file_failures.append(
                f"{xml_result['rule_id']}: {xml_result.get('parse_error', 'unparseable')}"
            )
            summary["xml_broken"] += 1
        else:
            if xml_status == "waived":
                file_waived.append(xml_result)
            for check_fn, _ in checks:
                result = exceptions.apply(f, check_fn(svg_text))
                status = classify(result, advisory_rules)
                if status == "advisory":
                    file_advisory.append(result["rule_id"])
                elif status == "fail":
                    file_failures.append(result["rule_id"])
                elif status == "waived":
                    file_waived.append(result)
        summary["files"] += 1
        summary["total_advisory"] += len(file_advisory)
        summary["total_waived"] += len(file_waived)
        if file_waived:
            waived_files.append((f.name, file_waived))
        if file_failures:
            summary["failed_files"] += 1
            summary["total_failures"] += len(file_failures)
            failed_files.append((f.name, file_failures))
        else:
            summary["passed_files"] += 1

    selected_ids = {rule_id_of(fn) for fn, _ in checks} | {XML_RULE_ID}
    stale = exceptions.stale(batch_dir=directory, rule_ids=selected_ids)
    summary["stale_exceptions"] = len(stale)

    if failed_files:
        print(f"\n{summary['failed_files']} of {summary['files']} files have failures:\n")
        for fname, fails in failed_files:
            print(f"  {fname}:")
            for rule in fails:
                print(f"    - {rule}")
    if waived_files:
        print(f"\nWaived by {exceptions.source}:\n")
        for fname, results in waived_files:
            print(f"  {fname}:")
            for result in results:
                reasons = "; ".join(w["reason"] for w in result["waivers"])
                print(f"    - {result['rule_id']}: {reasons}")
    _print_stale(stale, exceptions.source)
    xml_note = f", {summary['xml_broken']} unparseable" if summary["xml_broken"] else ""
    stale_note = f", {len(stale)} stale exception(s)" if stale else ""
    print(f"\n{'=' * 70}\nBatch summary: {summary['passed_files']}/{summary['files']} files clean, "
          f"{summary['total_failures']} rule failures, {summary['total_advisory']} advisory, "
          f"{summary['total_waived']} waived{stale_note}{xml_note}")
    return summary


def _exit_code(summary: dict) -> int:
    """Map a run summary to the process exit status (see module docstring)."""
    if "exceptions_error" in summary:
        return 2
    failures = summary.get("failed", 0) + summary.get("total_failures", 0)
    return 1 if failures or summary.get("stale_exceptions", 0) else 0


if __name__ == "__main__":
    args = sys.argv[1:]
    ruleset = None
    scope = None
    exceptions_path = None
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
    if "--exceptions" in args:
        i = args.index("--exceptions")
        exceptions_path = args[i + 1]
        args = args[:i] + args[i + 2:]
    if "--batch" in args:
        i = args.index("--batch")
        directory = args[i + 1]
        summary = run_batch(directory, ruleset or "wireframe", scope, exceptions_path)
    else:
        target = args[0] if args else "dashboard.svg"
        summary = run_all_checks(target, ruleset, scope, exceptions_path)
    sys.exit(_exit_code(summary))
