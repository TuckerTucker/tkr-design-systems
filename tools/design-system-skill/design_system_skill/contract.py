"""The fixed semantic token contract (schema v0.3, GitHub issue #6).

Every design system supplies a value for every token declared here, under
the same name, in its canonical token file (``systems/<id>/tokens.json``,
see ``token_file.py``). Systems may declare additional tokens under
``extras``; they may not add keys to a contract group.

This module is pure data plus value-shape predicates. It has no I/O and
no dependency on the loader, so the validator, the drift check, the
wireframe-skill and a future contrast gate can all import it without
cycles.

The human-readable contract table in ``docs/specs/SCHEMA-V0.3.md`` is
rendered from ``CONTRACT_TOKENS`` by ``render_contract_table()``; a test
asserts the document and this module agree, so neither can drift.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Iterable

import structlog

logger = structlog.get_logger(__name__)


CONTRACT_VERSION = "1.0"


# ─── Value kinds ────────────────────────────────────────────────────

KIND_COLOR = "color"              # CSS color: #RGB, #RRGGBB, #RRGGBBAA, rgb(), rgba()
KIND_PX = "px"                    # non-negative number, CSS pixels
KIND_PX_LIST = "px_list"          # non-empty list of non-negative numbers
KIND_FONT_STACK = "font_stack"    # CSS font-family string
KIND_TYPE_ROLE = "type_role"      # mapping, see TYPE_ROLE_FIELDS
KIND_SHADOW = "shadow"            # CSS box-shadow string, or "none"
KIND_BLUR = "blur"                # CSS length string such as "20px", or "none"
KIND_ELEVATION_STRATEGY = "elevation_strategy"  # non-empty identifier string

TYPE_ROLE_FIELDS: tuple[str, ...] = (
    "size", "weight", "line_height", "tracking", "family", "case",
)
"""Required fields of every ``type.*`` role.

``size`` px, ``weight`` 100-900, ``line_height`` unitless multiplier,
``tracking`` em (may be negative), ``family`` a key of the ``font`` group,
``case`` one of ``VALID_TYPE_CASES``.
"""

VALID_TYPE_CASES = frozenset({"none", "uppercase", "lowercase", "sentence"})


@dataclass(frozen=True)
class ContractToken:
    """One required semantic token.

    Attributes:
        group: Top-level group in the token file (``color``, ``radius`` ...).
        name: Token name within the group.
        kind: One of the ``KIND_*`` constants; drives value validation.
        meaning: What the token is for, in one sentence.
        used_by: Which consumers / pairings rely on it.
    """

    group: str
    name: str
    kind: str
    meaning: str
    used_by: str

    @property
    def path(self) -> str:
        """Dotted path of the token, e.g. ``color.page_bg``."""
        return f"{self.group}.{self.name}"


def _c(name: str, meaning: str, used_by: str) -> ContractToken:
    return ContractToken("color", name, KIND_COLOR, meaning, used_by)


CONTRACT_TOKENS: tuple[ContractToken, ...] = (
    # Surfaces
    _c("page_bg", "Page canvas behind every container.",
       "app shell; bg of text_primary pair; spec tokens.colors.page_bg"),
    _c("surface", "Default container fill (cards, panels, sidebars, AI messages).",
       "bg of text/border_input/focus_ring pairs; tokens.colors.surface"),
    _c("surface_elevated", "Raised container fill one tier above surface.",
       "menus, popovers, inputs on surface; tokens.colors.surface_elevated"),
    _c("surface_selected", "Fill of the selected / active row or item.",
       "list_item.selected, nav active; bg of text_primary pair"),
    _c("surface_inverse", "Inverted, high-emphasis fill (e.g. user message bubble).",
       "bg of text_inverse pair"),
    # Text
    _c("text_primary", "Body copy and headings.",
       "fg on page_bg/surface/surface_elevated/surface_selected"),
    _c("text_secondary", "Supporting copy: previews, descriptions, labels.",
       "fg on surface"),
    _c("text_muted", "De-emphasised metadata: timestamps, counters, captions.",
       "fg on surface (large/advisory threshold)"),
    _c("text_placeholder", "Input placeholder text.",
       "input placeholder; advisory pair on surface"),
    _c("text_inverse", "Text on surface_inverse.",
       "fg on surface_inverse"),
    # Action / accent
    _c("accent", "The system's signal hue (brand mark, unread, selection bar).",
       "accent marks; tokens.colors.accent; bg of accent_foreground"),
    _c("accent_foreground", "Content drawn on an accent fill.",
       "fg on accent"),
    _c("action", "Fill (or text colour, for text-only buttons) of the primary action.",
       "button.primary, send; bg of action_foreground"),
    _c("action_foreground", "Content drawn on an action fill.",
       "fg on action"),
    # Status
    _c("danger", "Error / destructive status.", "status badges, errors; bg of danger_foreground"),
    _c("danger_foreground", "Content on a danger fill.", "fg on danger"),
    _c("success", "Positive / complete status.", "status badges; bg of success_foreground"),
    _c("success_foreground", "Content on a success fill.", "fg on success"),
    _c("warning", "Caution status.", "status badges; bg of warning_foreground"),
    _c("warning_foreground", "Content on a warning fill.", "fg on warning"),
    _c("info", "Neutral informational status.", "status badges; bg of info_foreground"),
    _c("info_foreground", "Content on an info fill.", "fg on info"),
    # Borders / rules / focus
    _c("border_default", "Default rule / container boundary.",
       "dividers, card strokes"),
    _c("border_strong", "Emphatic rule (section separators, strong frames).",
       "section rules, hover strokes"),
    _c("border_input", "Boundary of an editable control.",
       "input/search strokes; ui pair on surface"),
    _c("focus_ring", "Keyboard focus indicator.",
       "focus outline; ui pair on surface and page_bg"),
    # Radius
    ContractToken("radius", "default", KIND_PX, "Default corner radius for containers.",
                  "cards, list items; tokens.borders.radius_default"),
    ContractToken("radius", "input", KIND_PX, "Corner radius of inputs and controls.",
                  "inputs, buttons; tokens.borders.radius_inputs"),
    ContractToken("radius", "chrome", KIND_PX, "Corner radius of the app shell / outer chrome.",
                  "app shell, modals; tokens.borders.radius_chrome"),
    # Border widths
    ContractToken("border_width", "default", KIND_PX, "Stroke width of border_default.",
                  "dividers, card strokes"),
    ContractToken("border_width", "strong", KIND_PX, "Stroke width of border_strong.",
                  "section rules"),
    ContractToken("border_width", "focus", KIND_PX, "Stroke width of focus_ring.",
                  "focus outline"),
    # Spacing
    ContractToken("space", "unit", KIND_PX, "Base grid unit.", "tokens.spacing.grid_unit"),
    ContractToken("space", "steps", KIND_PX_LIST, "Every permitted spacing value, ascending.",
                  "tokens.spacing.allowed_steps; layout lint"),
    ContractToken("space", "xs", KIND_PX, "Tightest gap (icon-label, inline).", "components"),
    ContractToken("space", "sm", KIND_PX, "Small gap (stacked text, control padding).", "components"),
    ContractToken("space", "md", KIND_PX, "Default container padding.", "cards, rows"),
    ContractToken("space", "lg", KIND_PX, "Gap between groups.", "sections"),
    ContractToken("space", "xl", KIND_PX, "Major block break.", "page layout"),
    # Fonts
    ContractToken("font", "body", KIND_FONT_STACK, "Family for content and headings.",
                  "type roles; tokens.typography.families"),
    ContractToken("font", "label", KIND_FONT_STACK, "Family for metadata / labels (may equal body).",
                  "type.label; tokens.typography.families"),
    ContractToken("font", "mono", KIND_FONT_STACK, "Family for code / tabular figures (may equal body).",
                  "code excerpts"),
    # Type roles
    ContractToken("type", "display", KIND_TYPE_ROLE, "Largest display text (brand, hero numbers).",
                  "mastheads, stat values"),
    ContractToken("type", "title", KIND_TYPE_ROLE, "Screen / section titles.", "headers"),
    ContractToken("type", "body", KIND_TYPE_ROLE, "Primary reading text.", "messages, paragraphs"),
    ContractToken("type", "small", KIND_TYPE_ROLE, "Secondary text (previews, captions).",
                  "list previews"),
    ContractToken("type", "label", KIND_TYPE_ROLE, "Metadata / label text.", "timestamps, tags"),
    # Elevation
    ContractToken("elevation", "strategy", KIND_ELEVATION_STRATEGY,
                  "How depth is expressed (see KNOWN_ELEVATION_STRATEGIES).",
                  "tokens.elevation.strategy"),
    ContractToken("elevation", "raised", KIND_SHADOW, "box-shadow of a raised element, or none.",
                  "cards, message bubbles"),
    ContractToken("elevation", "overlay", KIND_SHADOW, "box-shadow of overlays (modal, menu), or none.",
                  "modals, dropdowns"),
    ContractToken("elevation", "backdrop_blur", KIND_BLUR, "backdrop-filter blur radius, or none.",
                  "glass surfaces"),
)

CONTRACT_GROUPS: tuple[str, ...] = tuple(dict.fromkeys(t.group for t in CONTRACT_TOKENS))
"""Contract groups in declaration order."""

TOKENS_BY_PATH: dict[str, ContractToken] = {t.path: t for t in CONTRACT_TOKENS}


# ─── Required contrast pairs ────────────────────────────────────────

PAIR_TEXT = "text"              # body-size text
PAIR_LARGE_TEXT = "large_text"  # >= 18.66px bold / 24px regular, or metadata the system sizes up
PAIR_UI = "ui"                  # non-text UI: strokes, focus rings, icons
PAIR_ADVISORY = "advisory"      # reported, never blocking (placeholders)

PAIR_KINDS = frozenset({PAIR_TEXT, PAIR_LARGE_TEXT, PAIR_UI, PAIR_ADVISORY})


@dataclass(frozen=True)
class ContrastPair:
    """A foreground/background pairing every system must make legible.

    The contract only declares *which* pairs exist and their kind. The
    contrast gate (a later change) owns the ratio thresholds per kind.

    Attributes:
        fg: Token path of the foreground colour.
        bg: Token path of the background colour.
        kind: One of ``PAIR_KINDS``.
    """

    fg: str
    bg: str
    kind: str


CONTRAST_PAIRS: tuple[ContrastPair, ...] = (
    ContrastPair("color.text_primary", "color.page_bg", PAIR_TEXT),
    ContrastPair("color.text_primary", "color.surface", PAIR_TEXT),
    ContrastPair("color.text_primary", "color.surface_elevated", PAIR_TEXT),
    ContrastPair("color.text_primary", "color.surface_selected", PAIR_TEXT),
    ContrastPair("color.text_secondary", "color.surface", PAIR_TEXT),
    ContrastPair("color.text_muted", "color.surface", PAIR_LARGE_TEXT),
    ContrastPair("color.text_placeholder", "color.surface", PAIR_ADVISORY),
    ContrastPair("color.text_inverse", "color.surface_inverse", PAIR_TEXT),
    ContrastPair("color.accent_foreground", "color.accent", PAIR_TEXT),
    ContrastPair("color.action_foreground", "color.action", PAIR_TEXT),
    ContrastPair("color.danger_foreground", "color.danger", PAIR_TEXT),
    ContrastPair("color.success_foreground", "color.success", PAIR_TEXT),
    ContrastPair("color.warning_foreground", "color.warning", PAIR_TEXT),
    ContrastPair("color.info_foreground", "color.info", PAIR_TEXT),
    ContrastPair("color.accent", "color.surface", PAIR_UI),
    ContrastPair("color.border_input", "color.surface", PAIR_UI),
    ContrastPair("color.focus_ring", "color.surface", PAIR_UI),
    ContrastPair("color.focus_ring", "color.page_bg", PAIR_UI),
)
"""Pairs every system must satisfy in every mode combination.

Semi-transparent colours composite over their pair's ``bg``, and a
semi-transparent ``bg`` composites over ``color.page_bg`` (which must be
opaque). Systems add their own pairs in the token file's
``contrast_pairs`` list.
"""


# ─── Value predicates ───────────────────────────────────────────────

_HEX_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
_RGB_RE = re.compile(
    r"^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([01]?(?:\.\d+)?)\s*)?\)$"
)
_BLUR_RE = re.compile(r"^\d+(?:\.\d+)?px$")
_IDENT_RE = re.compile(r"^[a-z][a-z0-9_]*$")


def parse_color(value: Any) -> tuple[int, int, int, float] | None:
    """Parse a CSS colour string into an RGBA tuple.

    Args:
        value: Candidate colour (``#RGB``, ``#RRGGBB``, ``#RRGGBBAA``,
            ``rgb(r,g,b)`` or ``rgba(r,g,b,a)``).

    Returns:
        ``(r, g, b, a)`` with channels 0-255 and alpha 0-1, or ``None``
        when the value is not a colour this contract accepts.
    """
    if not isinstance(value, str):
        return None
    v = value.strip()
    if _HEX_RE.match(v):
        h = v[1:]
        if len(h) == 3:
            h = "".join(ch * 2 for ch in h)
        r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
        return r, g, b, a
    m = _RGB_RE.match(v)
    if m:
        r, g, b = (int(m.group(i)) for i in (1, 2, 3))
        if max(r, g, b) > 255:
            return None
        a = float(m.group(4)) if m.group(4) not in (None, "") else 1.0
        if not 0.0 <= a <= 1.0:
            return None
        return r, g, b, a
    return None


def normalize_color(value: Any) -> str | None:
    """Return a canonical spelling of a colour for equality comparison.

    Opaque colours become upper-case ``#RRGGBB``; translucent colours
    become ``rgba(r,g,b,a)`` with ``a`` in shortest decimal form.

    Args:
        value: Candidate colour string.

    Returns:
        Canonical string, or ``None`` if ``value`` is not a colour.
    """
    rgba = parse_color(value)
    if rgba is None:
        return None
    r, g, b, a = rgba
    if a >= 1.0:
        return f"#{r:02X}{g:02X}{b:02X}"
    return f"rgba({r},{g},{b},{round(a, 3):g})"


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def check_value(kind: str, value: Any, font_keys: Iterable[str] = ()) -> str | None:
    """Validate a token value against its kind.

    Args:
        kind: One of the ``KIND_*`` constants.
        value: The value from the token file.
        font_keys: Keys of the document's ``font`` group; ``type`` roles'
            ``family`` must name one of them.

    Returns:
        ``None`` when valid, otherwise a short human-readable reason.
    """
    if kind == KIND_COLOR:
        return None if parse_color(value) else f"expected a CSS colour, got {value!r}"
    if kind == KIND_PX:
        return None if _is_number(value) and value >= 0 else f"expected a non-negative number, got {value!r}"
    if kind == KIND_PX_LIST:
        if isinstance(value, list) and value and all(_is_number(v) and v >= 0 for v in value):
            return None if value == sorted(value) else "steps must be ascending"
        return f"expected a non-empty list of non-negative numbers, got {value!r}"
    if kind == KIND_FONT_STACK:
        return None if isinstance(value, str) and value.strip() else f"expected a font-family string, got {value!r}"
    if kind == KIND_SHADOW:
        return None if isinstance(value, str) and value.strip() else f"expected a box-shadow string or 'none', got {value!r}"
    if kind == KIND_BLUR:
        return None if value == "none" or (isinstance(value, str) and _BLUR_RE.match(value)) else (
            f"expected 'none' or a px length such as '20px', got {value!r}")
    if kind == KIND_ELEVATION_STRATEGY:
        return None if isinstance(value, str) and _IDENT_RE.match(value) else f"expected an identifier, got {value!r}"
    if kind == KIND_TYPE_ROLE:
        return _check_type_role(value, set(font_keys))
    return f"unknown kind {kind!r}"


def _check_type_role(value: Any, font_keys: set[str]) -> str | None:
    if not isinstance(value, dict):
        return f"expected a mapping with {list(TYPE_ROLE_FIELDS)}, got {value!r}"
    missing = [f for f in TYPE_ROLE_FIELDS if f not in value]
    if missing:
        return f"missing fields {missing}"
    if not (_is_number(value["size"]) and value["size"] > 0):
        return f"size must be a positive number, got {value['size']!r}"
    if not (_is_number(value["weight"]) and 100 <= value["weight"] <= 900):
        return f"weight must be 100-900, got {value['weight']!r}"
    if not (_is_number(value["line_height"]) and value["line_height"] > 0):
        return f"line_height must be a positive number, got {value['line_height']!r}"
    if not _is_number(value["tracking"]):
        return f"tracking must be a number (em), got {value['tracking']!r}"
    if value["family"] not in font_keys:
        return f"family {value['family']!r} is not a key of the font group {sorted(font_keys)}"
    if value["case"] not in VALID_TYPE_CASES:
        return f"case {value['case']!r} not in {sorted(VALID_TYPE_CASES)}"
    return None


# ─── Documentation rendering ────────────────────────────────────────

def render_contract_table() -> str:
    """Render the contract as the Markdown table used in SCHEMA-V0.3.md.

    Returns:
        A Markdown table (group | token | kind | meaning | used by).
    """
    lines = [
        "| Group | Token | Kind | Meaning | Used by |",
        "|-------|-------|------|---------|---------|",
    ]
    for t in CONTRACT_TOKENS:
        lines.append(f"| {t.group} | `{t.name}` | {t.kind} | {t.meaning} | {t.used_by} |")
    return "\n".join(lines)


def render_pairs_table() -> str:
    """Render the required contrast pairs as a Markdown table.

    Returns:
        A Markdown table (foreground | background | kind).
    """
    lines = ["| Foreground | Background | Kind |", "|------------|------------|------|"]
    for p in CONTRAST_PAIRS:
        lines.append(f"| `{p.fg}` | `{p.bg}` | {p.kind} |")
    return "\n".join(lines)
