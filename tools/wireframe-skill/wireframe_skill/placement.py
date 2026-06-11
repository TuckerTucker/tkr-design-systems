"""Brief → layout-template + brief → component-placement.

This module is the LLM seam for wireframe-skill v3.0. The current
implementation is a deterministic keyword heuristic that maps briefs
to one of the system's authored layout patterns. It gets one screen
genre (dashboard) working out of the box across any system that has a
dashboard pattern in its library, plus reasonable fallbacks for
auth/settings/form/modal/empty briefs.

The LLM extension point is `select_layout_pattern` and (eventually)
`compose_components`. To upgrade, replace the keyword heuristic with
a model call that reads the brief, the system spec's available patterns,
and returns a structured placement plan. The interface below
deliberately accepts the brief as free text and the spec as a dict
to make that swap straightforward.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from pathlib import Path
import re

import structlog

logger = structlog.get_logger(__name__)


# ─── Mapping rules (ordered: first match wins) ──────────────────────
# Keywords are checked against the lowercased brief. The pattern_id
# resolved here must exist in the loaded system spec (we verify before
# committing).

# Mobile keywords trigger a `-mobile` suffix preference if the system
# has a mobile variant authored.
MOBILE_HINT_KEYWORDS = re.compile(
    r"\bmobile\b|\bphone\b|\biphone\b|\bandroid\b|\bsmall screen\b", re.IGNORECASE
)


@dataclass
class LayoutSelection:
    pattern_id: str           # the chosen pattern id (e.g. "dashboard-mobile")
    base_pattern: str         # the base pattern (e.g. "dashboard")
    svg_path: Path            # absolute path to the chosen pattern SVG
    width: int
    height: int
    rationale: str            # human-readable why-this-pattern
    fallback: bool = False    # True if this was a fallback after no keyword matched
    requested_system: str = ""
    available_patterns: list[str] = field(default_factory=list)


def select_layout_pattern(
    brief: str,
    spec: dict,
    platform: str = "desktop",
    select_mode: str = "auto",
) -> LayoutSelection | None:
    """Select a layout pattern from the system library matching the brief.

    Agent-driven routing: ``auto`` and ``request`` modes both return None,
    deferring the routing decision to the calling agent.  Use ``exact``
    when the agent has already identified a pattern name in the brief.

    Args:
        brief: Free-text brief (e.g. "dashboard for a chat app").
        spec: Loaded system spec dict.
        platform: "desktop" or "mobile" (default: "desktop").
        select_mode: Selection strategy:
            "auto"    — returns None (agent decides via inventory)
            "exact"   — match only if brief explicitly names a pattern base
            "request" — returns None (same as auto)

    Returns:
        LayoutSelection with chosen pattern, or None when routing is
        deferred to the agent.
    """
    if select_mode in ("auto", "request"):
        return None

    library_root = Path(spec["_meta"]["library_root"])
    layouts_dir = library_root / "layouts"
    if not layouts_dir.exists():
        return None
    available = sorted(p.stem for p in layouts_dir.glob("*.svg"))
    if not available:
        return None

    prefer_mobile = (
        platform == "mobile" or bool(MOBILE_HINT_KEYWORDS.search(brief))
    )

    base_names = _extract_base_names(available)

    if select_mode == "exact":
        brief_lc = brief.lower()
        for base in base_names:
            if re.search(r'\b' + re.escape(base) + r'\b', brief_lc):
                chosen = _pick_variant(available, base, prefer_mobile)
                if chosen is not None:
                    return LayoutSelection(
                        pattern_id=chosen,
                        base_pattern=base,
                        svg_path=(layouts_dir / f"{chosen}.svg").resolve(),
                        width=0, height=0,
                        rationale=f"exact match: '{base}' found in brief; chose {chosen}",
                        requested_system=spec["_meta"]["system_id"],
                        available_patterns=available,
                    )
        return None

    return None


def _pick_variant(available: list[str], base: str, prefer_mobile: bool) -> str | None:
    """Find a pattern matching the base id, preferring mobile if requested.

    Args:
        available: Sorted list of available pattern ids.
        base: Base pattern id to search for (e.g. "dashboard").
        prefer_mobile: If True, prefer -mobile variant.

    Returns:
        A pattern id or None if no match found.
    """
    candidates_with_base = [a for a in available if a == base or a.startswith(f"{base}-")]
    if not candidates_with_base:
        return None
    if prefer_mobile:
        for c in candidates_with_base:
            if c.endswith("-mobile") or c == f"{base}-mobile":
                return c
    # Otherwise prefer the bare base, then -default, then anything.
    for c in candidates_with_base:
        if c == base:
            return c
    for c in candidates_with_base:
        if c == f"{base}-default":
            return c
    # Skip mobile variants when not preferring mobile.
    non_mobile = [c for c in candidates_with_base if not c.endswith("-mobile")]
    if non_mobile:
        return non_mobile[0]
    return candidates_with_base[0]


# ─── Component-placement seam (LLM extension point) ─────────────────
#
# When a brief says "dashboard for a Tokyo trip planner", the wireframe
# should contain trip-specific labels rather than the placeholder
# "Northwind / Tokyo Trip" baked into the pattern SVG. That requires
# parsing the brief, picking entities, and rewriting placeholder text.
#
# The current deterministic shell does NOT do this — it emits the
# pattern SVG as-is. The function below is the seam where an LLM
# integration would slot in.

@dataclass
class ContentSubstitution:
    """A find/replace edit to apply to the pattern SVG."""
    find: str
    replace: str
    rationale: str = ""


_VARIANT_SUFFIXES = re.compile(
    r'-(mobile|default|no-[\w]+|with-[\w-]+|error|first-use|narrow|conversation)$'
)


def _extract_base_names(available: list[str]) -> list[str]:
    """Extract unique base pattern names from available pattern ids."""
    bases: dict[str, None] = {}
    for pattern_id in available:
        base = _VARIANT_SUFFIXES.sub('', pattern_id)
        bases[base] = None
    return list(bases.keys())


PLATFORM_DIMENSIONS = {
    "mobile": (375, 812),
    "desktop": (1280, 800),
}


def build_layout_selection_request(
    brief: str,
    spec: dict,
    platform: str = "desktop",
) -> dict:
    """Build a structured layout selection request for the calling model.

    Lists all available layout patterns from the system with descriptions
    and canvas dimensions. The caller chooses the best-fitting pattern.

    Args:
        brief: Free-text brief.
        spec: Loaded system spec dict.
        platform: "desktop" or "mobile".

    Returns:
        Dict with schema_version, brief, system_id, platform, canvas,
        available_patterns, grammar_caveats, response_format_example.
    """
    system_id = spec.get("_meta", {}).get("system_id", "unknown")
    library_root = Path(spec["_meta"]["library_root"])
    layouts_dir = library_root / "layouts"

    available_patterns: list[dict] = []
    if layouts_dir.exists():
        layout_specs = spec.get("layout_templates") or {}
        for svg_path in sorted(layouts_dir.glob("*.svg")):
            pattern_id = svg_path.stem
            base_name = _VARIANT_SUFFIXES.sub('', pattern_id)
            # Try to find description from spec
            description = None
            for spec_key, spec_val in layout_specs.items():
                if isinstance(spec_val, dict):
                    norm_key = spec_key.replace("_", "-")
                    if norm_key == base_name or norm_key == pattern_id:
                        description = spec_val.get("description")
                        break
            available_patterns.append({
                "pattern_id": pattern_id,
                "base_name": base_name,
                "svg_path": str(svg_path.resolve()),
                "description": description,
            })

    canvas_w, canvas_h = PLATFORM_DIMENSIONS.get(platform, (1280, 800))

    caveats = _extract_grammar_caveats_for_placement(spec)

    return {
        "schema_version": "1.0",
        "brief": brief,
        "system_id": system_id,
        "platform": platform,
        "canvas": {"width": canvas_w, "height": canvas_h},
        "grammar_caveats": caveats,
        "available_patterns": available_patterns,
        "response_format_example": {
            "selected_pattern_id": "dashboard",
            "rationale": "Main workspace with sidebar controls maps to dashboard layout",
        },
    }


def _extract_grammar_caveats_for_placement(spec: dict) -> dict:
    """Extract grammar rules from spec that constrain layout selection."""
    caveats: dict = {}
    typography = spec.get("tokens", {}).get("typography", {})
    case_rules = typography.get("case", {})
    if case_rules:
        caveats["case_rules"] = case_rules
    avatar_strategy = spec.get("system", {}).get("avatar_strategy")
    if avatar_strategy:
        caveats["avatar_strategy"] = avatar_strategy.get("mode")
    return caveats


def apply_layout_selection(
    selection_response: dict,
    spec: dict,
    platform: str = "desktop",
) -> LayoutSelection | None:
    """Apply a model's layout selection response.

    Args:
        selection_response: Dict with selected_pattern_id and rationale.
        spec: Loaded system spec dict.
        platform: "desktop" or "mobile".

    Returns:
        LayoutSelection if the chosen pattern exists, None otherwise.
    """
    pattern_id = selection_response.get("selected_pattern_id")
    rationale = selection_response.get("rationale", "")
    if not pattern_id:
        return None

    library_root = Path(spec["_meta"]["library_root"])
    layouts_dir = library_root / "layouts"
    if not layouts_dir.exists():
        return None

    svg_path = (layouts_dir / f"{pattern_id}.svg").resolve()
    if not svg_path.exists():
        return None

    base_name = _VARIANT_SUFFIXES.sub('', pattern_id)

    available = sorted(p.stem for p in layouts_dir.glob("*.svg"))

    return LayoutSelection(
        pattern_id=pattern_id,
        base_pattern=base_name,
        svg_path=svg_path,
        width=0, height=0,
        rationale=rationale,
        fallback=False,
        requested_system=spec["_meta"]["system_id"],
        available_patterns=available,
    )


def derive_content_substitutions(
    brief: str,
    spec: dict,
    selection: LayoutSelection,
) -> list[ContentSubstitution]:
    """Derive content substitutions from brief to replace placeholder text.

    This is an LLM integration seam. The current deterministic implementation
    returns an empty list (no-op). Future versions will parse the brief and
    return substitutions to replace generic placeholder content with
    brief-specific values.

    Args:
        brief: Free-text brief.
        spec: Loaded system spec dict.
        selection: LayoutSelection from select_layout_pattern.

    Returns:
        List of ContentSubstitution objects (currently empty).
    """
    return []
