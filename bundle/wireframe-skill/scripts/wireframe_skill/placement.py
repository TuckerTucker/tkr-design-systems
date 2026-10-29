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

@dataclass
class EscalateToDecomposition:
    """Signal that the brief should be handled by the two-pass component
    decomposition flow instead of a pre-authored pattern.

    Returned by `select_layout_pattern` when (a) no keyword rule matched
    AND (b) none of the brief's nouns name one of the system's authored
    layout patterns. This is Layer 1 of the freeform-elements
    architecture: never silently degrade to the dashboard fallback when
    the brief is genuinely off-catalog.

    The (b) test deliberately ignores the component catalog. Components are
    the raw material of every screen, so a brief mentioning "card" or
    "filter" tells you nothing about whether the system has authored that
    *screen*; including them made escalation effectively unreachable.

    Attributes:
        reason: Human-readable why this escalated.
        brief_nouns: The set of brief tokens that were checked.
        catalog_intersection: The (empty) intersection — for logging.
        available_patterns: For diagnostics.
        requested_system: The system the brief targeted.
    """
    reason: str
    brief_nouns: list[str] = field(default_factory=list)
    catalog_intersection: list[str] = field(default_factory=list)
    available_patterns: list[str] = field(default_factory=list)
    requested_system: str = ""


def select_layout_pattern(
    brief: str,
    spec: dict,
    platform: str = "desktop",
    escalate: bool = True,
    select_mode: str = "heuristic",
) -> "LayoutSelection | EscalateToDecomposition | None":
    """Select a layout pattern from the system library matching the brief.

    Strategy (select_mode="heuristic", the default):
        1. Scan system's library_root/layouts/ for available patterns.
        2. For each keyword rule, match against brief (prefer mobile variant
           when platform=='mobile' and brief mentions mobile).
        3. If no match, escalate to decomposition (or fall back to
           DEFAULT_PATTERN_FALLBACK when escalate=False).
        4. Return None if system has no patterns.

    Agent-driven routing (upstream-aligned modes):
        "auto" / "request" — return None, deferring the routing decision to
            the calling agent. Pair with `build_layout_selection_request`
            (inventory for the agent) and `apply_layout_selection`
            (turn the agent's choice into a LayoutSelection).
        "exact" — match only when the brief explicitly names a pattern base
            (e.g. "dashboard" in the brief, "dashboard" in layouts/).
            Returns None when nothing is named.

    Args:
        brief: Free-text brief (e.g. "dashboard for a chat app").
        spec: Loaded system spec dict.
        platform: "desktop" or "mobile" (default: "desktop").
        escalate: In heuristic mode, return EscalateToDecomposition instead
            of the dashboard fallback when the brief is off-catalog.
        select_mode: "heuristic" (default), "auto", "request", or "exact".

    Returns:
        LayoutSelection with chosen pattern, EscalateToDecomposition when
        the brief is off-catalog (heuristic mode), or None when routing is
        deferred to the agent / no patterns are available.
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

    if select_mode == "exact":
        brief_lc = brief.lower()
        for base in _extract_base_names(available):
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

    # No keyword matched. Decide between escalation and last-ditch fallback.
    if escalate:
        brief_nouns = _extract_brief_nouns(brief)
        pattern_tokens = _enumerate_pattern_tokens(available)
        intersection = sorted(
            n for n in brief_nouns
            if _normalize_token(n) in pattern_tokens
        )
        if not intersection:
            return EscalateToDecomposition(
                reason=(
                    f"no keyword pattern matched and brief nouns "
                    f"{brief_nouns[:6]} do not name any of the "
                    f"{len(pattern_tokens)} authored layout-pattern terms in "
                    f"system '{spec['_meta']['system_id']}'"
                ),
                brief_nouns=brief_nouns,
                catalog_intersection=intersection,
                available_patterns=available,
                requested_system=spec["_meta"]["system_id"],
            )

        # The brief names an authored pattern that no keyword rule covers
        # (e.g. revolt's "banner-promotional"). Suppressing escalation and
        # then rendering the *default* fallback would silently ignore the
        # very match that suppressed it — route to the named pattern.
        named = _match_named_pattern(brief_nouns, available, prefer_mobile)
        if named is not None:
            base, chosen = named
            return LayoutSelection(
                pattern_id=chosen,
                base_pattern=base,
                svg_path=(layouts_dir / f"{chosen}.svg").resolve(),
                width=0, height=0,
                rationale=(
                    f"no keyword rule matched, but the brief names the "
                    f"authored pattern '{base}' (via {intersection}); "
                    f"chose {chosen}"
                ),
                requested_system=spec["_meta"]["system_id"],
                available_patterns=available,
            )

    # Fallback path (reached either when escalation is disabled, or when
    # brief nouns do partially overlap the catalog).
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



# ─── Agent-driven routing (upstream-aligned) ─────────────────────────
#
# The complement to select_mode="auto"/"request": the skill emits a
# structured inventory of available patterns, the calling agent chooses,
# and the choice is applied deterministically. Routing judgment lives in
# the agent layer; this module only enumerates and applies.


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
    from .compose import PLATFORM_DIMENSIONS

    system_id = spec.get("_meta", {}).get("system_id", "unknown")
    library_root = Path(spec["_meta"]["library_root"])
    layouts_dir = library_root / "layouts"

    available_patterns: list[dict] = []
    if layouts_dir.exists():
        layout_specs = spec.get("layout_templates") or {}
        for svg_path in sorted(layouts_dir.glob("*.svg")):
            pattern_id = svg_path.stem
            base_name = _VARIANT_SUFFIXES.sub('', pattern_id)
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

    return {
        "schema_version": "1.0",
        "brief": brief,
        "system_id": system_id,
        "platform": platform,
        "canvas": {"width": canvas_w, "height": canvas_h},
        "grammar_caveats": _extract_grammar_caveats_for_placement(spec),
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


# ─── Escalation helpers (Layer 1 — Phase B) ─────────────────────────


# Light stopword list. Goal: drop words that are universal across briefs
# and therefore not informative for catalog matching. We intentionally
# keep this small so domain words ("trip", "kanban", "carousel") stay.
_STOPWORDS = frozenset({
    "a", "an", "the", "this", "that", "these", "those", "my", "our", "your",
    "for", "with", "of", "to", "in", "on", "at", "by", "from", "as", "into",
    "and", "or", "but", "if", "is", "are", "be", "page", "screen", "view",
    "app", "ui", "interface", "section", "layout", "main", "user", "users",
    "show", "display", "shows", "displays", "showing", "displaying",
})

# Generic structural words that appear inside authored pattern ids
# ("form-single-column", "dashboard-narrow") but describe arrangement
# rather than naming a screen genre. A brief mentioning "three columns"
# says nothing about whether the system authored that screen, so these
# must not suppress escalation.
_STRUCTURAL_TOKENS = frozenset({
    "single", "double", "column", "columns", "row", "rows", "grid",
    "left", "right", "top", "bottom", "wide", "narrow", "compact",
    "default", "alt", "variant", "state", "mobile", "desktop",
    "large", "small", "medium",
})

# Tokens shorter than this aren't worth checking.
_MIN_TOKEN_LEN = 3

# Token splitter — alphanumeric runs, no punctuation.
_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _extract_brief_nouns(brief: str) -> list[str]:
    """Tokenize brief, lowercase, drop stopwords, return distinct nouns.

    Args:
        brief: Free-text brief.

    Returns:
        Sorted list of distinct content tokens.
    """
    tokens = _TOKEN_RE.findall(brief.lower())
    return sorted({
        t for t in tokens
        if len(t) >= _MIN_TOKEN_LEN and t not in _STOPWORDS
    })


def _normalize_token(token: str) -> str:
    """Fold a token to a comparison form (naive singularization).

    Lets "columns" in a brief match a "column" pattern term without
    resorting to substring matching, which is what made the old overlap
    test fire on unrelated words.

    Args:
        token: A lowercased token.

    Returns:
        The token with a trailing plural "s" removed when that is safe.
    """
    if len(token) > 3 and token.endswith("s") and not token.endswith("ss"):
        return token[:-1]
    return token


def _pattern_base_tokens(base: str) -> set[str]:
    """Return the distinctive normalized tokens of one base pattern name.

    Args:
        base: A base pattern name, variant suffix already stripped.

    Returns:
        Set of normalized tokens, structural and stopwords removed.
    """
    return {
        _normalize_token(part)
        for part in re.split(r"[-_]+", base.lower())
        if len(part) >= _MIN_TOKEN_LEN
        and part not in _STOPWORDS
        and part not in _STRUCTURAL_TOKENS
    }


def _match_named_pattern(
    brief_nouns: list[str],
    available_patterns: list[str],
    prefer_mobile: bool,
) -> tuple[str, str] | None:
    """Find the authored pattern whose name the brief actually mentions.

    Reached only when no keyword rule matched but the brief did name a
    pattern term — which happens for system-specific patterns outside
    PATTERN_HEURISTICS (revolt's "banner-promotional"). Picks the base
    with the most matching tokens; ties break on the earlier base.

    Args:
        brief_nouns: Distinct content tokens from the brief.
        available_patterns: Pattern IDs enumerated from the layouts dir.
        prefer_mobile: Whether to prefer a -mobile variant.

    Returns:
        A (base_pattern, pattern_id) pair, or None when nothing matched.
    """
    normalized = {_normalize_token(n) for n in brief_nouns}
    best: tuple[int, str, str] | None = None
    for base in _extract_base_names(available_patterns):
        overlap = len(_pattern_base_tokens(base) & normalized)
        if overlap == 0:
            continue
        chosen = _pick_variant(available_patterns, base, prefer_mobile)
        if chosen is None:
            continue
        if best is None or overlap > best[0]:
            best = (overlap, base, chosen)
    return None if best is None else (best[1], best[2])


def _enumerate_pattern_tokens(available_patterns: list[str]) -> set[str]:
    """Return the distinctive terms naming the system's authored layouts.

    Only *layout pattern* names are considered — deliberately not the
    component catalog. Every real UI brief mentions components ("card",
    "button", "filter", "image"), so intersecting against components made
    the escalation test unable to discriminate: with a 194-name catalog and
    bidirectional substring matching, "board" matched "dashboard" and
    virtually no brief could ever escalate.

    Variant suffixes are stripped and generic structural words are dropped,
    so what remains is the set of terms that actually name a screen genre
    the system has authored (e.g. "banner", "promotional").

    Args:
        available_patterns: Pattern IDs enumerated from the layouts dir.

    Returns:
        Set of normalized tokens to test brief nouns against.
    """
    tokens: set[str] = set()
    for base in _extract_base_names(available_patterns):
        tokens |= _pattern_base_tokens(base)
    return tokens
