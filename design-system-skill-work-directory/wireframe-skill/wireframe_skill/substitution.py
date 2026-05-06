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
import re
import json
from typing import NamedTuple

import structlog

logger = structlog.get_logger(__name__)


class TextNode(NamedTuple):
    """Extracted text content from SVG <text> or <tspan> element."""
    content: str
    tag: str              # "text" or "tspan"
    line_hint: str       # e.g. "line 93" for diagnostics


def extract_text_nodes(svg_text: str) -> list[TextNode]:
    """Extract all <text> and <tspan> content from SVG.

    Parses the SVG using regex to find <text>content</text> and
    <tspan>content</tspan> elements, returning each node with its
    tag type and source line hint for diagnostics.

    Args:
        svg_text: Full SVG content as string.

    Returns:
        List of TextNode namedtuples, one per tag (order preserved).
    """
    nodes: list[TextNode] = []

    # Match <text ...>content</text> or <tspan ...>content</tspan> across
    # any number of lines. The opening tag may have attributes wrapped on
    # multiple lines (common in this codebase). Content is everything up
    # to the next < character so we don't accidentally cross into nested
    # elements.
    pattern = re.compile(
        r'<(text|tspan)\b[^>]*>([^<]*)</\1>',
        re.DOTALL,
    )

    for match in pattern.finditer(svg_text):
        tag = match.group(1)
        content = match.group(2)
        if not content.strip():
            continue
        # Best-effort line hint: count newlines up to the match start.
        line_hint = f"line {svg_text.count(chr(10), 0, match.start()) + 1}"
        nodes.append(TextNode(content=content, tag=tag, line_hint=line_hint))

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
        "schema_version": "1.0",
        "brief": brief,
        "system_id": system_id,
        "pattern_path": str(pattern_svg_path),
        "grammar_caveats": grammar_caveats,
        "text_nodes": [
            {"content": node.content, "tag": node.tag, "line_hint": node.line_hint}
            for node in text_nodes
        ],
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


def validate_substitutions(subs: list[dict], spec: dict) -> list[str]:
    """Validate substitutions against grammar rules; return warnings.

    Checks each substitution's replace text against the spec's grammar
    constraints (case rules, avatar strategy, etc.). Returns a list of
    warning strings for violations (does not reject; warnings are advisory).

    Args:
        subs: List of substitution dicts with keys: find, replace, rationale.
        spec: Loaded system spec dict.

    Returns:
        List of warning strings (empty if all valid).
    """
    warnings = []

    typography = spec.get("tokens", {}).get("typography", {})
    case_rules = typography.get("case", {})
    avatar_strategy = spec.get("system", {}).get("avatar_strategy")

    for sub in subs:
        replace_text = sub.get("replace", "")
        find_text = sub.get("find", "")

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
