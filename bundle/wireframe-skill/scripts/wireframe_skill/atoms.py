"""Atom rendering: portable atomic SVG fragments for blueprints.

Layer 2 of the freeform-elements architecture. When a region in a
blueprint declares `atoms: [...]` instead of `components: [...]`,
the assembler hands off to this module.

Every visual value (color, font, size, spacing, stroke, radius) flows
through the design-system-skill token resolver, so the SAME atom
blueprint renders coherently in Swiss, Riso, Editorial, or any other
system that satisfies the common-tokens.v1 contract.

Atom types (v1):

    rect, text, line, circle, image_placeholder, group

The `group` atom supports `repeat: n, gap: <length-token>` for chip
strips, slide indicators, and similar repeated micro-patterns.

Public API:

    render_atom_region(region, spec, scope="portable") -> (body_svg, defs_svg)

The assembler calls this once per region whose dict contains `atoms`.
"""

from __future__ import annotations

from html import escape as _html_escape
from typing import Any

from design_system_skill import (
    resolve_token,
    UnknownTokenError,
    CrossSystemTokenError,
    MalformedTokenRefError,
)


ATOM_TYPES = frozenset({
    "rect", "text", "line", "circle", "image_placeholder", "group",
})


class AtomRenderError(ValueError):
    """A required atom field is missing or has the wrong type."""


# ─── Token resolution ───────────────────────────────────────────────


def _resolve(value: Any, spec: dict, scope: str = "portable") -> Any:
    """Resolve a possibly-token value against the spec.

    If `value` looks like a token reference (`$foo`, `$foo.bar`, or
    `system_id:dotted.path`), resolve via the design-system contract.
    Otherwise return the value as-is.

    Args:
        value: Atom field value (number, string, or token ref).
        spec: Loaded system spec.
        scope: 'portable' or a system id.

    Returns:
        Resolved value (could be a number, string, or dict).

    Raises:
        UnknownTokenError, CrossSystemTokenError, MalformedTokenRefError
        propagate from resolve_token.
    """
    if not isinstance(value, str):
        return value
    if value.startswith("$"):
        return resolve_token(spec, value, scope=scope)
    # `<sys>:<path>` form, but only if NOT a hex color (which also has ':' rarely;
    # actually hex doesn't have ':'). We check for `:` and a colon-prefix that
    # isn't a hex starter.
    if ":" in value and not value.startswith("#"):
        return resolve_token(spec, value, scope=scope)
    return value


def _resolve_color(value: Any, spec: dict, scope: str) -> str:
    """Resolve to a color string. Accepts $tokens or literal hex."""
    v = _resolve(value, spec, scope)
    if not isinstance(v, str):
        raise AtomRenderError(f"expected color string, got {v!r}")
    return v


def _resolve_length(value: Any, spec: dict, scope: str) -> float:
    """Resolve to a numeric length. Accepts $tokens or literal numbers."""
    v = _resolve(value, spec, scope)
    if isinstance(v, (int, float)):
        return float(v)
    raise AtomRenderError(f"expected numeric length, got {v!r}")


def _resolve_text_style(value: Any, spec: dict, scope: str) -> dict:
    """Resolve to a text-style dict. Always via a $type.* token ref."""
    v = _resolve(value, spec, scope)
    if not isinstance(v, dict):
        raise AtomRenderError(f"expected text-style dict, got {v!r}")
    return v


# ─── Per-atom-type renderers ────────────────────────────────────────


def _render_rect(atom: dict, spec: dict, scope: str, dx: float, dy: float) -> str:
    x = _resolve_length(atom["x"], spec, scope) + dx
    y = _resolve_length(atom["y"], spec, scope) + dy
    w = _resolve_length(atom["w"], spec, scope)
    h = _resolve_length(atom["h"], spec, scope)
    fill = _resolve_color(atom.get("fill", "$surface"), spec, scope)
    parts = [
        f'<rect x="{_fmt(x)}" y="{_fmt(y)}" width="{_fmt(w)}" height="{_fmt(h)}"',
        f' fill="{fill}"',
    ]
    if "stroke" in atom:
        stroke = _resolve_color(atom["stroke"], spec, scope)
        sw = _resolve_length(atom.get("stroke_w", "$stroke.regular"), spec, scope)
        parts.append(f' stroke="{stroke}" stroke-width="{_fmt(sw)}"')
    if atom.get("rx") is not None:
        rx = _resolve_length(atom["rx"], spec, scope)
        parts.append(f' rx="{_fmt(rx)}"')
    parts.append(" />")
    return "".join(parts)


def _render_text(atom: dict, spec: dict, scope: str, dx: float, dy: float) -> str:
    x = _resolve_length(atom["x"], spec, scope) + dx
    y = _resolve_length(atom["y"], spec, scope) + dy
    value = str(atom.get("value", ""))
    style = _resolve_text_style(atom["style"], spec, scope)
    fill = _resolve_color(atom.get("fill", "$ink"), spec, scope)
    family = str(style["family"])
    size = float(style["size"])
    weight = int(style["weight"])
    case = style.get("case", "mixed")
    tracking = style.get("tracking", 0)

    # Apply case transform — already applied at render time so SVG is canonical.
    if case == "uppercase":
        value = value.upper()
    elif case == "lowercase":
        value = value.lower()

    extras = ""
    if tracking:
        extras = f' letter-spacing="{tracking}em"'

    return (
        f'<text x="{_fmt(x)}" y="{_fmt(y)}" '
        f'font-family="{_html_escape(family)}" font-size="{_fmt(size)}" '
        f'font-weight="{weight}" fill="{fill}"{extras}>'
        f'{_html_escape(value)}</text>'
    )


def _render_line(atom: dict, spec: dict, scope: str, dx: float, dy: float) -> str:
    x1 = _resolve_length(atom["x1"], spec, scope) + dx
    y1 = _resolve_length(atom["y1"], spec, scope) + dy
    x2 = _resolve_length(atom["x2"], spec, scope) + dx
    y2 = _resolve_length(atom["y2"], spec, scope) + dy
    stroke = _resolve_color(atom.get("stroke", "$outline"), spec, scope)
    sw = _resolve_length(atom.get("stroke_w", "$stroke.regular"), spec, scope)
    return (
        f'<line x1="{_fmt(x1)}" y1="{_fmt(y1)}" x2="{_fmt(x2)}" y2="{_fmt(y2)}" '
        f'stroke="{stroke}" stroke-width="{_fmt(sw)}" />'
    )


def _render_circle(atom: dict, spec: dict, scope: str, dx: float, dy: float) -> str:
    cx = _resolve_length(atom["cx"], spec, scope) + dx
    cy = _resolve_length(atom["cy"], spec, scope) + dy
    r = _resolve_length(atom["r"], spec, scope)
    fill = _resolve_color(atom.get("fill", "$ink"), spec, scope)
    parts = [f'<circle cx="{_fmt(cx)}" cy="{_fmt(cy)}" r="{_fmt(r)}" fill="{fill}"']
    if "stroke" in atom:
        stroke = _resolve_color(atom["stroke"], spec, scope)
        sw = _resolve_length(atom.get("stroke_w", "$stroke.regular"), spec, scope)
        parts.append(f' stroke="{stroke}" stroke-width="{_fmt(sw)}"')
    parts.append(" />")
    return "".join(parts)


def _render_image_placeholder(atom: dict, spec: dict, scope: str, dx: float, dy: float) -> str:
    """Image well: filled rect + diagonal cross (the convention for media placeholders)."""
    x = _resolve_length(atom["x"], spec, scope) + dx
    y = _resolve_length(atom["y"], spec, scope) + dy
    w = _resolve_length(atom["w"], spec, scope)
    h = _resolve_length(atom["h"], spec, scope)
    fill = _resolve_color(atom.get("fill", "$image-placeholder"), spec, scope)
    stroke = _resolve_color(atom.get("stroke", "$outline"), spec, scope)
    sw = _resolve_length(atom.get("stroke_w", "$stroke.hairline"), spec, scope)
    return (
        f'<g class="image-placeholder">'
        f'<rect x="{_fmt(x)}" y="{_fmt(y)}" width="{_fmt(w)}" height="{_fmt(h)}" '
        f'fill="{fill}" stroke="{stroke}" stroke-width="{_fmt(sw)}" />'
        f'<line x1="{_fmt(x)}" y1="{_fmt(y)}" x2="{_fmt(x+w)}" y2="{_fmt(y+h)}" '
        f'stroke="{stroke}" stroke-width="{_fmt(sw)}" />'
        f'<line x1="{_fmt(x+w)}" y1="{_fmt(y)}" x2="{_fmt(x)}" y2="{_fmt(y+h)}" '
        f'stroke="{stroke}" stroke-width="{_fmt(sw)}" />'
        f'</g>'
    )


def _render_group(atom: dict, spec: dict, scope: str, dx: float, dy: float) -> str:
    """Group: nested atoms with optional repeat + gap layout.

    repeat: n times along `direction` ('horizontal' or 'vertical'),
    with stride `gap` (resolved length token).
    """
    base_x = _resolve_length(atom["x"], spec, scope) + dx
    base_y = _resolve_length(atom["y"], spec, scope) + dy
    inner = atom.get("atoms", [])
    if not isinstance(inner, list):
        raise AtomRenderError(f"group.atoms must be a list, got {type(inner).__name__}")
    repeat = int(atom.get("repeat", 1))
    if repeat < 1:
        raise AtomRenderError(f"group.repeat must be >= 1, got {repeat}")
    gap = _resolve_length(atom.get("gap", 0), spec, scope) if repeat > 1 else 0
    direction = atom.get("direction", "horizontal")
    if direction not in {"horizontal", "vertical"}:
        raise AtomRenderError(f"group.direction must be horizontal or vertical, got {direction!r}")

    out: list[str] = []
    for i in range(repeat):
        stride = i * gap
        gdx = stride if direction == "horizontal" else 0
        gdy = stride if direction == "vertical" else 0
        for child in inner:
            out.append(_render_atom(child, spec, scope, base_x + gdx, base_y + gdy))
    return "\n".join(out)


_RENDERERS = {
    "rect": _render_rect,
    "text": _render_text,
    "line": _render_line,
    "circle": _render_circle,
    "image_placeholder": _render_image_placeholder,
    "group": _render_group,
}


def _render_atom(atom: dict, spec: dict, scope: str, dx: float, dy: float) -> str:
    """Dispatch to the correct per-type renderer."""
    if not isinstance(atom, dict):
        raise AtomRenderError(f"atom must be a dict, got {type(atom).__name__}")
    atom_type = atom.get("type")
    if atom_type not in _RENDERERS:
        raise AtomRenderError(
            f"unknown atom type {atom_type!r}; "
            f"expected one of {sorted(ATOM_TYPES)}"
        )
    return _RENDERERS[atom_type](atom, spec, scope, dx, dy)


# ─── Public API ─────────────────────────────────────────────────────


def render_atom_region(
    region: dict,
    spec: dict,
    scope: str = "portable",
) -> tuple[str, str]:
    """Render a region whose contents are `atoms` (not `components`).

    Atoms are positioned in absolute canvas coordinates: a region's
    `x/y/w/h` define the region's bounding box; atom `x/y` are RELATIVE
    to the region origin. This module composes the absolute coordinates
    so the assembler doesn't need a translate wrapper.

    Args:
        region: Blueprint region dict with keys `id, x, y, w, h, atoms`.
        spec: Loaded system spec.
        scope: 'portable' (default) or a system id.

    Returns:
        (body_svg, defs_svg). defs_svg is currently always "" — v1 atoms
        don't declare reusable defs. Reserved for future extensions.
    """
    region_x = float(region.get("x", 0))
    region_y = float(region.get("y", 0))
    atoms = region.get("atoms") or []
    if not isinstance(atoms, list):
        raise AtomRenderError(f"region.atoms must be a list, got {type(atoms).__name__}")

    parts = [_render_atom(a, spec, scope, region_x, region_y) for a in atoms]
    region_id = region.get("id", "atom-region")
    body = f'<g class="atom-region" data-region="{_html_escape(region_id)}">\n' + "\n".join(parts) + "\n</g>"
    return body, ""


# ─── Helpers ────────────────────────────────────────────────────────


def _fmt(n: float) -> str:
    """Compact numeric formatting for SVG attributes — int when whole, else 2dp."""
    if n == int(n):
        return str(int(n))
    return f"{n:.2f}"
