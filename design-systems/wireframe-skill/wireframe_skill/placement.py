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

PATTERN_HEURISTICS: list[tuple[str, list[str]]] = [
    # (brief-keyword pattern, ordered list of pattern-ids to try)
    ("dashboard|overview|home|metrics|kpi|analytics", ["dashboard"]),
    ("login|sign in|sign-in|signin|auth|password|create account|sign up|sign-up", ["auth"]),
    ("settings|preferences|profile|account", ["settings-layout", "settings_layout"]),
    ("form|registration|new \\w+|create \\w+|edit", ["form"]),
    ("table|list of \\w+|members|users|directory", ["data-table", "data_table"]),
    ("modal|confirm|dialog|alert", ["modal"]),
    ("drawer|side panel|side-panel|panel", ["drawer"]),
    ("empty|no results|nothing|first use|onboarding", ["empty-state", "empty_state"]),
    ("article|read|story|long-form|long form|post", ["article"]),
    ("sidebar|nav|navigation", ["sidebar"]),
    ("header|top bar|top-bar|toolbar", ["header"]),
    ("command palette|command-palette|cmdk|search overlay", ["command-palette", "command_palette"]),
]

# Default fallback when no keyword matches.
DEFAULT_PATTERN_FALLBACK = ["dashboard", "settings-layout", "auth", "empty-state"]

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
) -> LayoutSelection | None:
    """Select a layout pattern from the system library matching the brief.

    Strategy:
        1. Scan system's library_root/layouts/ for available patterns.
        2. For each keyword rule, match against brief (prefer mobile variant
           when platform=='mobile' and brief mentions mobile).
        3. If no match, fall back to DEFAULT_PATTERN_FALLBACK.
        4. Return None if system has no patterns.

    Args:
        brief: Free-text brief (e.g. "dashboard for a chat app").
        spec: Loaded system spec dict.
        platform: "desktop" or "mobile" (default: "desktop").

    Returns:
        LayoutSelection with chosen pattern, or None if unavailable.
    """
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

    brief_lc = brief.lower()
    for kw_pattern, base_candidates in PATTERN_HEURISTICS:
        if not re.search(kw_pattern, brief_lc):
            continue
        for base in base_candidates:
            chosen = _pick_variant(available, base, prefer_mobile)
            if chosen is not None:
                return LayoutSelection(
                    pattern_id=chosen,
                    base_pattern=base,
                    svg_path=(layouts_dir / f"{chosen}.svg").resolve(),
                    width=0, height=0,  # filled by compose step
                    rationale=f"keyword '{kw_pattern}' matched brief; chose {chosen}",
                    requested_system=spec["_meta"]["system_id"],
                    available_patterns=available,
                )

    # Fallback path
    for base in DEFAULT_PATTERN_FALLBACK:
        chosen = _pick_variant(available, base, prefer_mobile)
        if chosen is not None:
            return LayoutSelection(
                pattern_id=chosen,
                base_pattern=base,
                svg_path=(layouts_dir / f"{chosen}.svg").resolve(),
                width=0, height=0,
                rationale=f"no keyword matched; fell back to {chosen}",
                fallback=True,
                requested_system=spec["_meta"]["system_id"],
                available_patterns=available,
            )

    # Last-ditch: any pattern at all.
    chosen = available[0]
    return LayoutSelection(
        pattern_id=chosen,
        base_pattern=chosen,
        svg_path=(layouts_dir / f"{chosen}.svg").resolve(),
        width=0, height=0,
        rationale=f"system has only ad-hoc patterns; chose first available ({chosen})",
        fallback=True,
        requested_system=spec["_meta"]["system_id"],
        available_patterns=available,
    )


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
