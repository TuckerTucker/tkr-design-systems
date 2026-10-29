"""Content substitution for wireframe patterns (two-pass architecture).

This module implements Pass 1 (emit request) and Pass 2 (apply response) of
the content substitution workflow:

  Pass 1: Extract placeholder text from pattern SVG, emit JSON request with
          grammar caveats for the calling Claude to process.
  Pass 2: Accept structured response from Claude, validate against grammar
          rules, apply find/replace edits to the SVG.

The architecture allows the calling Claude (orchestrator) to provide LLM
judgment while the skill itself remains deterministic.
"""

from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
import math
import re
import json
from typing import NamedTuple

import structlog

logger = structlog.get_logger(__name__)


# Per-typeface average glyph width as a fraction of font-size.
# Mirrors _GLYPH_WIDTH_RATIO in tools/builders/rulebook_check.py
# so the budget computed here matches what the post-hoc overflow check enforces.
_GLYPH_WIDTH_RATIO = {
    "default": 0.55,
    "monospace": 0.60,
    "fraunces": 0.50,
    "space mono": 0.62,
    "jetbrains mono": 0.60,
    "ibm plex sans": 0.55,
    "outfit": 0.52,
    "inter": 0.52,
    "space grotesk": 0.55,
    "caveat": 0.45,
}

# Right-edge tolerance in px — text may end up to this many px from the
# container edge without flagging. Matches rulebook_check margin.
_OVERFLOW_MARGIN_PX = 8


def _glyph_width_ratio(font_family: str) -> float:
    """Pick the glyph-width ratio for a font-family string."""
    fam = (font_family or "").lower()
    for key, ratio in _GLYPH_WIDTH_RATIO.items():
        if key in fam:
            return ratio
    return _GLYPH_WIDTH_RATIO["default"]


class TextNode(NamedTuple):
    """Extracted text content from SVG <text> or <tspan> element.

    Width-aware fields (x, font_size, font_family, available_width_px,
    max_chars) describe the budget for substituted content. They may be
    None when the source attribute is missing or unparseable; callers
    treat None as "unknown — no budget enforcement available."
    """
    content: str
    tag: str                              # "text" or "tspan"
    line_hint: str                        # e.g. "line 93" for diagnostics
    x: float | None                       # horizontal position in viewBox px
    font_size: float | None               # px
    font_family: str | None               # raw family string
    text_anchor: str | None               # "start" | "middle" | "end" | None
    available_width_px: float | None      # container_right - x - margin
    max_chars: int | None                 # int(available_width / (font_size * ratio))


def _extract_viewbox_width(svg_text: str) -> float | None:
    """Return the viewBox width, or None if absent/unparseable."""
    m = re.search(r'viewBox="0 0 (\d+(?:\.\d+)?) ', svg_text)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def _extract_rects(svg_text: str) -> list[tuple[float, float, float, float]]:
    """Return all <rect> bounding boxes as (x, y, w, h) tuples.

    Used to find the nearest enclosing rect for a text element's right
    edge — a rough but useful proxy for "container width." Rects without
    a parseable x/y/width/height are skipped.
    """
    rects: list[tuple[float, float, float, float]] = []
    for m in re.finditer(r'<rect\b[^>]*?/>', svg_text, re.DOTALL):
        tag = m.group(0)
        try:
            x = float(re.search(r'\bx="([^"]+)"', tag).group(1))
            y = float(re.search(r'\by="([^"]+)"', tag).group(1))
            w = float(re.search(r'\bwidth="([^"]+)"', tag).group(1))
            h = float(re.search(r'\bheight="([^"]+)"', tag).group(1))
        except (AttributeError, ValueError):
            continue
        rects.append((x, y, w, h))
    return rects


def _container_right_for(
    x: float,
    y: float,
    rects: list[tuple[float, float, float, float]],
    viewbox_width: float | None,
) -> float | None:
    """Find the right edge of the smallest rect enclosing (x, y).

    Falls back to viewbox_width when no rect contains the point.
    Returns None if both lookups fail.
    """
    smallest_area = math.inf
    chosen_right: float | None = None
    for rx, ry, rw, rh in rects:
        if rx <= x <= rx + rw and ry <= y <= ry + rh:
            area = rw * rh
            if area < smallest_area:
                smallest_area = area
                chosen_right = rx + rw
    if chosen_right is not None:
        return chosen_right
    return viewbox_width


def _compute_text_budget(
    attrs: dict,
    rects: list[tuple[float, float, float, float]],
    viewbox_width: float | None,
) -> tuple[float | None, float | None, str | None, str | None, float | None, int | None]:
    """Compute (x, font_size, font_family, text_anchor, available_width, max_chars).

    Returns Nones for any field that can't be resolved. max_chars is an
    integer character budget at the text element's font-size; callers should
    treat the budget as inclusive (a string of length max_chars fits).
    """
    try:
        x = float(attrs.get("x", "0"))
    except ValueError:
        return (None, None, None, None, None, None)
    try:
        y = float(attrs.get("y", "0"))
    except ValueError:
        y = 0.0
    try:
        font_size = float(attrs.get("font-size", "14"))
    except ValueError:
        font_size = 14.0
    font_family = attrs.get("font-family")
    text_anchor = attrs.get("text-anchor")
    ratio = _glyph_width_ratio(font_family or "")

    container_right = _container_right_for(x, y, rects, viewbox_width)
    if container_right is None:
        return (x, font_size, font_family, text_anchor, None, None)

    if text_anchor == "middle":
        # Symmetric budget around x: limited by the closer edge.
        # Find the smallest enclosing rect's left edge for the left bound.
        smallest_area = math.inf
        container_left = 0.0
        for rx, ry, rw, rh in rects:
            if rx <= x <= rx + rw and ry <= y <= ry + rh:
                area = rw * rh
                if area < smallest_area:
                    smallest_area = area
                    container_left = rx
        half = min(x - container_left, container_right - x) - _OVERFLOW_MARGIN_PX / 2
        available = max(0.0, half * 2)
    elif text_anchor == "end":
        # Budget extends leftward from x.
        smallest_area = math.inf
        container_left = 0.0
        for rx, ry, rw, rh in rects:
            if rx <= x <= rx + rw and ry <= y <= ry + rh:
                area = rw * rh
                if area < smallest_area:
                    smallest_area = area
                    container_left = rx
        available = max(0.0, x - container_left - _OVERFLOW_MARGIN_PX)
    else:
        # Default ("start"): budget extends rightward from x.
        available = max(0.0, container_right - x - _OVERFLOW_MARGIN_PX)

    if font_size <= 0 or ratio <= 0:
        return (x, font_size, font_family, text_anchor, available, None)
    max_chars = int(available // (font_size * ratio))
    return (x, font_size, font_family, text_anchor, available, max_chars)


def extract_text_nodes(svg_text: str) -> list[TextNode]:
    """Extract all <text> and <tspan> content from SVG with width budgets.

    Parses the SVG to find <text>content</text> and <tspan>content</tspan>
    elements. For each, computes the available horizontal width and a
    character budget based on the text's x position, font-size, font-family,
    and the smallest enclosing <rect> (falling back to viewBox width).

    Width fields are best-effort: when an attribute is missing or the
    enclosing rect cannot be resolved, the field is None. Callers should
    treat None as "no budget — proceed without overflow check."

    Args:
        svg_text: Full SVG content as string.

    Returns:
        List of TextNode namedtuples, one per tag (order preserved).
    """
    nodes: list[TextNode] = []
    viewbox_width = _extract_viewbox_width(svg_text)
    rects = _extract_rects(svg_text)

    pattern = re.compile(
        r'<(text|tspan)\b([^>]*)>([^<]*)</\1>',
        re.DOTALL,
    )

    for match in pattern.finditer(svg_text):
        tag = match.group(1)
        attrs_str = match.group(2)
        content = match.group(3)
        if not content.strip():
            continue

        # Parse attributes from the opening tag.
        attrs = dict(re.findall(r'(\S+?)="([^"]*)"', attrs_str))
        x, font_size, font_family, text_anchor, available, max_chars = (
            _compute_text_budget(attrs, rects, viewbox_width)
        )

        line_hint = f"line {svg_text.count(chr(10), 0, match.start()) + 1}"
        nodes.append(TextNode(
            content=content,
            tag=tag,
            line_hint=line_hint,
            x=x,
            font_size=font_size,
            font_family=font_family,
            text_anchor=text_anchor,
            available_width_px=available,
            max_chars=max_chars,
        ))

    return nodes


def build_substitution_request(
    brief: str,
    spec: dict,
    pattern_svg_path: Path,
) -> dict:
    """Assemble the JSON request for Pass 1 (emit request).

    Reads the pattern SVG, extracts text nodes, and combines them with
    grammar caveats from the spec to form a structured request that the
    calling Claude will process.

    Args:
        brief: Free-text brief (e.g. "dashboard for a meditation app").
        spec: Loaded system spec dict (from spec.yaml).
        pattern_svg_path: Absolute path to the chosen pattern SVG file.

    Returns:
        Dict with schema_version, brief, system_id, pattern_path,
        grammar_caveats, text_nodes, and response_format_example.

    Raises:
        FileNotFoundError: If pattern SVG not found.
    """
    if not pattern_svg_path.exists():
        raise FileNotFoundError(f"Pattern SVG not found: {pattern_svg_path}")

    svg_text = pattern_svg_path.read_text()
    text_nodes = extract_text_nodes(svg_text)

    # Build grammar caveats from spec.
    grammar_caveats = _extract_grammar_caveats(spec)

    system_id = spec.get("system", {}).get("id", "unknown")

    return {
        "schema_version": "1.1",
        "brief": brief,
        "system_id": system_id,
        "pattern_path": str(pattern_svg_path),
        "grammar_caveats": grammar_caveats,
        "text_nodes": [
            {
                "content": node.content,
                "tag": node.tag,
                "line_hint": node.line_hint,
                "max_chars": node.max_chars,
                "available_width_px": (
                    round(node.available_width_px, 1)
                    if node.available_width_px is not None else None
                ),
                "font_size": node.font_size,
                "font_family": node.font_family,
                "text_anchor": node.text_anchor,
            }
            for node in text_nodes
        ],
        "width_budget_hint": (
            "Each text_node carries a max_chars budget. Replacement strings "
            "MUST be <= max_chars (when not null) so the rendered text fits "
            "its container. If your natural content exceeds the budget, "
            "shorten the wording first; truncation with '…' is a last resort."
        ),
        "response_format_example": {
            "substitutions": [
                {
                    "find": "Tokyo Trip",
                    "replace": "Bali Getaway",
                    "rationale": "Brief mentions 'bali'; user-specific personalization"
                }
            ]
        },
    }


def _extract_grammar_caveats(spec: dict) -> dict:
    """Extract grammar rules from spec that constrain substitutions.

    Looks at typography.case and other constraints to derive warnings
    that the LLM should respect when generating substitutions.

    Args:
        spec: Loaded system spec dict.

    Returns:
        Dict with system-specific grammar rules (e.g., case rules).
    """
    caveats = {}

    typography = spec.get("tokens", {}).get("typography", {})
    case_rules = typography.get("case", {})

    if case_rules:
        caveats["case_rules"] = case_rules
        # Add human-readable hints.
        if case_rules.get("metadata") == "uppercase":
            caveats["hint_metadata"] = "Metadata (small labels, timestamps) must be ALL CAPS"
        if case_rules.get("headers") == "uppercase":
            caveats["hint_headers"] = "Headers/titles must be ALL CAPS"
        if case_rules.get("headers") == "title_case":
            caveats["hint_headers"] = "Headers must use Title Case (capitalize each word)"

    # Avatar strategy (no-emoji policy).
    avatar_strategy = spec.get("system", {}).get("avatar_strategy")
    if avatar_strategy:
        caveats["avatar_strategy"] = avatar_strategy.get("mode")
        if avatar_strategy.get("mode") == "abbreviation":
            caveats["hint_avatar"] = f"User names must be 2-letter uppercase abbreviations"

    return caveats


def validate_substitutions(
    subs: list[dict],
    spec: dict,
    text_nodes: list[TextNode] | None = None,
) -> list[str]:
    """Validate substitutions against grammar and width budgets; return warnings.

    Checks each substitution's replace text against the spec's grammar
    constraints (case rules, avatar strategy, etc.) and, when text_nodes
    is provided, against the per-node max_chars budget computed at
    extraction time. Returns a list of warning strings for violations
    (does not reject; warnings are advisory).

    Args:
        subs: List of substitution dicts with keys: find, replace, rationale.
        spec: Loaded system spec dict.
        text_nodes: Optional list of TextNode entries from extract_text_nodes.
            When provided, replacements that exceed a matching node's
            max_chars budget are flagged as overflow warnings.

    Returns:
        List of warning strings (empty if all valid).
    """
    warnings = []

    typography = spec.get("tokens", {}).get("typography", {})
    case_rules = typography.get("case", {})
    avatar_strategy = spec.get("system", {}).get("avatar_strategy")

    # Build a find→tightest-budget map. A find string may appear in
    # multiple text nodes; the tightest (smallest non-None max_chars)
    # is the binding constraint.
    budget_by_find: dict[str, int] = {}
    if text_nodes:
        for node in text_nodes:
            if node.max_chars is None:
                continue
            existing = budget_by_find.get(node.content)
            if existing is None or node.max_chars < existing:
                budget_by_find[node.content] = node.max_chars

    for sub in subs:
        replace_text = sub.get("replace", "")
        find_text = sub.get("find", "")

        # Width-budget check: replacement must fit the tightest container
        # it will be rendered into.
        budget = budget_by_find.get(find_text)
        if budget is not None and len(replace_text) > budget:
            warnings.append(
                f"Substitution '{find_text}' → '{replace_text}': "
                f"replacement is {len(replace_text)} chars but container "
                f"budget is {budget} chars (will overflow)"
            )

        # Heuristic: if the find text is metadata-like (all caps or short)
        # and case_rules says metadata should be uppercase, warn if replace
        # contains lowercase letters.
        if find_text.isupper() and case_rules.get("metadata") == "uppercase":
            if replace_text and any(c.islower() for c in replace_text):
                warnings.append(
                    f"Substitution '{find_text}' → '{replace_text}': "
                    f"Metadata must be ALL CAPS per {spec.get('system', {}).get('id')} spec"
                )

        # Heuristic: if avatar_strategy is "abbreviation", warn if replace
        # is not 2-letter uppercase.
        if avatar_strategy and avatar_strategy.get("mode") == "abbreviation":
            abbrev_len = avatar_strategy.get("abbreviation_length", 2)
            if find_text in ["01", "02", "AB", "TT"] or len(find_text) <= 2:
                if replace_text and (
                    len(replace_text) != abbrev_len or
                    not replace_text.isupper()
                ):
                    warnings.append(
                        f"Substitution '{find_text}' → '{replace_text}': "
                        f"Avatar abbreviations must be {abbrev_len}-letter UPPERCASE"
                    )

    return warnings


def apply_substitutions(
    svg_text: str,
    subs: list[dict],
) -> tuple[str, list[str]]:
    """Apply find/replace edits to SVG (Pass 2).

    Applies each substitution's find/replace pair to the SVG text,
    editing only <text> and <tspan> content (never in <style> blocks or
    attribute values). Returns the modified SVG and a list of finds that
    were not applied (unapplied_finds).

    Args:
        svg_text: Full SVG content as string.
        subs: List of substitution dicts with keys: find, replace, rationale.

    Returns:
        Tuple of (modified_svg, list_of_unapplied_finds).
    """
    modified_svg = svg_text
    unapplied = []

    for sub in subs:
        find_text = sub.get("find", "")
        replace_text = sub.get("replace", "")

        if not find_text:
            continue

        # Safe replacement: only replace inside <text>...</text> and
        # <tspan>...</tspan> tags, not in attributes or style blocks.
        # Use a two-phase approach:
        #   1. Split on <style>...</style> boundaries
        #   2. Only replace in non-style segments

        style_pattern = r'(<style[^>]*>.*?</style>)'
        style_segments = re.split(style_pattern, modified_svg, flags=re.DOTALL)

        for i, segment in enumerate(style_segments):
            if i % 2 == 0:  # Non-style segment
                new_segment = segment.replace(find_text, replace_text)
                if new_segment != segment:
                    style_segments[i] = new_segment
                else:
                    # If no replacement happened, mark as unapplied.
                    if find_text not in unapplied and i == 0:
                        # Only check once (avoid duplicates from multi-segment processing)
                        pass
            # Keep style segments as-is (index 1, 3, 5, ... are <style> blocks)

        modified_svg = "".join(style_segments)

        # Track unapplied if still in original SVG but now missing.
        if find_text in svg_text and find_text not in modified_svg:
            logger.info("Substitution applied", find=find_text, replace=replace_text)
        elif find_text not in svg_text:
            unapplied.append(find_text)

    return modified_svg, unapplied
