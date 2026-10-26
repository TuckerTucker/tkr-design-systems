"""Token placeholders and the shared SVG envelope.

Per-system templates never contain colour, font or radius literals.
They reference the system's token file with placeholders:

    {color.text_primary}               -> the token value
    {extras.color.rule_hairline}       -> extras work the same way
    {radius.input}                     -> numbers render without ".0"
    {extras.color.orb_lavender|alpha=0.25}
                                       -> the token's RGB with this alpha,
                                          as ``rgba(r,g,b,0.25)``
    {extras.radius.message|rrect=10,20,300,40,br:extras.radius.message_tail}
                                       -> path data for a rounded rectangle
                                          whose corners take the token radius
                                          (per-corner overrides name tokens)
    {full:24}                          -> 12: fully round on a 24px side

A placeholder is a brace pair around a dotted path of lowercase
identifiers (at least two segments), optionally followed by one
``|filter=arg``. Anything else in braces (CSS rule bodies, prose) is
left alone, so templates can carry inline ``<style>`` blocks.

Corner radii follow one rule: every ``rx``/``ry`` is a radius token,
``0``, or ``{full:N}`` -- half of the element's shorter side ``N``, for
pills, toggle tracks and round knobs whose rounding is geometry rather
than a design decision. Rounded corners in path data come from
``|rrect``. ``tools/builders/test_build.py`` enforces both.

Resolved values are XML-escaped (``&``, ``<``, ``>``, ``"``) because
placeholders sit inside attribute values and ``<style>`` text.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Callable, Iterable, Iterator
from xml.sax.saxutils import escape

from design_system_skill.contract import parse_color
from design_system_skill.token_file import get_token

PLACEHOLDER_RE = re.compile(
    r"\{(?P<path>[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)"
    r"(?:\|(?P<filter>[a-z_]+)=(?P<arg>[^{}|\s]+))?\}"
)

#: ``{full:N}``: half of ``N`` (the shorter side of a fully round shape).
FULL_RE = re.compile(r"\{full:(?P<side>\d+(?:\.\d+)?)\}")

_XML_ENTITIES = {'"': "&quot;"}

#: Signature of a plain filter: (token value, argument text) -> rendered string.
Filter = Callable[[Any, str], str]


class TemplateError(ValueError):
    """A template references a token path or filter that cannot be resolved."""


@dataclass(frozen=True)
class TokenFilter:
    """A filter that reads further tokens named in its argument.

    Attributes:
        render: ``(token value, argument text, token document) -> text``.
        paths: ``argument text -> token paths it references`` (checked by
            ``missing_paths`` like the placeholder's own path).
    """

    render: Callable[[Any, str, Any], str]
    paths: Callable[[str], list[str]]


def _alpha(value: Any, arg: str) -> str:
    """Re-alpha a colour token, keeping the argument's spelling.

    Args:
        value: Colour token (any form ``parse_color`` accepts).
        arg: Alpha as written in the template, e.g. ``0.25``.

    Returns:
        ``rgba(r,g,b,<arg>)``.

    Raises:
        TemplateError: If the token is not a colour or the alpha is not in 0-1.
    """
    rgba = parse_color(value)
    if rgba is None:
        raise TemplateError(f"alpha filter needs a colour token, got {value!r}")
    try:
        a = float(arg)
    except ValueError as exc:
        raise TemplateError(f"alpha filter argument {arg!r} is not a number") from exc
    if not 0.0 <= a <= 1.0:
        raise TemplateError(f"alpha filter argument {arg!r} is outside 0-1")
    r, g, b, _ = rgba
    return f"rgba({r},{g},{b},{arg})"


_CORNERS = ("tl", "tr", "br", "bl")


def _rrect_parts(arg: str) -> tuple[list[float], dict[str, str]]:
    """Split an ``rrect`` argument into geometry and corner overrides.

    Args:
        arg: ``x,y,w,h`` followed by any ``corner:token.path`` overrides,
            e.g. ``10,20,300,40,br:extras.radius.message_tail``.

    Returns:
        ``([x, y, w, h], {corner: token path})``.

    Raises:
        TemplateError: If the geometry or an override is malformed.
    """
    parts = arg.split(",")
    try:
        geometry = [float(v) for v in parts[:4]]
    except ValueError as exc:
        raise TemplateError(f"rrect geometry {arg!r} is not x,y,w,h") from exc
    if len(geometry) != 4:
        raise TemplateError(f"rrect geometry {arg!r} is not x,y,w,h")
    overrides: dict[str, str] = {}
    for part in parts[4:]:
        corner, _, path = part.partition(":")
        if corner not in _CORNERS or not path:
            raise TemplateError(f"rrect override {part!r} is not corner:token.path "
                                f"(corner one of {', '.join(_CORNERS)})")
        overrides[corner] = path
    return geometry, overrides


def _rrect_paths(arg: str) -> list[str]:
    """Token paths an ``rrect`` argument references (empty if malformed)."""
    try:
        return list(_rrect_parts(arg)[1].values())
    except TemplateError:
        return []


def _rrect(value: Any, arg: str, tokens: Any) -> str:
    """Path data for a rectangle with per-corner radii from tokens.

    SVG ``rect`` takes one radius; a chat bubble whose tail corner is
    tighter than the rest needs a path. The placeholder's token is the
    radius of every corner not overridden in ``arg``.

    Args:
        value: Default corner radius (a number token).
        arg: ``x,y,w,h[,corner:token.path...]``.
        tokens: Token document, for the override paths.

    Returns:
        ``M ... Z`` path data drawn clockwise from the top-left corner.

    Raises:
        TemplateError: For malformed arguments, unknown override tokens or
            non-numeric radii.
    """
    (x, y, w, h), overrides = _rrect_parts(arg)
    radii = {}
    for corner in _CORNERS:
        r = value
        if corner in overrides:
            try:
                r = get_token(tokens, overrides[corner])
            except KeyError:
                raise TemplateError(f"unknown token '{overrides[corner]}'") from None
        if isinstance(r, bool) or not isinstance(r, (int, float)):
            raise TemplateError(f"rrect radius {r!r} is not a number")
        radii[corner] = float(r)
    tl, tr, br, bl = (radii[c] for c in _CORNERS)
    n = format_value

    def arc(r: float, ex: float, ey: float) -> str:
        return f"A {n(r)} {n(r)} 0 0 1 {n(ex)} {n(ey)}"

    return (f"M {n(x + tl)} {n(y)} H {n(x + w - tr)} {arc(tr, x + w, y + tr)} "
            f"V {n(y + h - br)} {arc(br, x + w - br, y + h)} "
            f"H {n(x + bl)} {arc(bl, x, y + h - bl)} "
            f"V {n(y + tl)} {arc(tl, x + tl, y)} Z")


#: Filters available to every template. Plugins may pass extra ones.
FILTERS: dict[str, Filter | TokenFilter] = {
    "alpha": _alpha,
    "rrect": TokenFilter(_rrect, _rrect_paths),
}


def format_value(value: Any) -> str:
    """Render a token value as SVG text.

    Args:
        value: Token value (string or number).

    Returns:
        Strings unchanged; integral floats without the trailing ``.0``.

    Raises:
        TemplateError: For values that are not scalars (groups, lists).
    """
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        raise TemplateError(f"token value {value!r} is not a scalar")
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def iter_placeholders(template: str) -> Iterator[re.Match[str]]:
    """Yield every placeholder match in ``template``."""
    return PLACEHOLDER_RE.finditer(template)


def missing_paths(template: str, tokens: dict[str, Any],
                  filters: dict[str, Filter | TokenFilter] | None = None) -> list[str]:
    """List placeholders in ``template`` that cannot be resolved.

    Args:
        template: Template text.
        tokens: Token document.
        filters: Available filters (defaults to ``FILTERS``).

    Returns:
        One entry per unresolvable placeholder, e.g. ``color.nope`` or
        ``color.accent|blur`` (unknown filter), de-duplicated in order.
    """
    filters = FILTERS if filters is None else filters
    out: list[str] = []
    for m in iter_placeholders(template):
        problems = []
        if get_token(tokens, m["path"], None) is None:
            problems.append(m["path"])
        elif m["filter"] and m["filter"] not in filters:
            problems.append(f"{m['path']}|{m['filter']}")
        elif m["filter"] and isinstance(filters[m["filter"]], TokenFilter):
            problems.extend(p for p in filters[m["filter"]].paths(m["arg"])
                            if get_token(tokens, p, None) is None)
        out.extend(p for p in dict.fromkeys(problems) if p not in out)
    return out


def resolve(template: str, tokens: dict[str, Any],
            filters: dict[str, Filter | TokenFilter] | None = None) -> str:
    """Substitute every placeholder in ``template`` from ``tokens``.

    Args:
        template: Template text.
        tokens: Token document (``systems/<id>/tokens.json``).
        filters: Available filters (defaults to ``FILTERS``).

    Returns:
        The rendered text.

    Raises:
        TemplateError: Naming the first unresolvable path or filter.
    """
    filters = FILTERS if filters is None else filters

    def sub(m: re.Match[str]) -> str:
        path = m["path"]
        try:
            value = get_token(tokens, path)
        except KeyError:
            raise TemplateError(f"unknown token '{path}'") from None
        name = m["filter"]
        if name:
            if name not in filters:
                raise TemplateError(f"unknown filter '{name}' on '{path}'")
            fn = filters[name]
            if isinstance(fn, TokenFilter):
                text = fn.render(value, m["arg"], tokens)
            else:
                text = fn(value, m["arg"])
        else:
            text = format_value(value)
        return escape(text, _XML_ENTITIES)

    def full(m: re.Match[str]) -> str:
        return format_value(float(m["side"]) / 2)

    return FULL_RE.sub(full, PLACEHOLDER_RE.sub(sub, template))


# ─── Envelope ─────────────────────────────────────────────────────────

@dataclass(frozen=True)
class TextClass:
    """One rule of the shared ``<defs><style>`` block.

    Attributes:
        name: CSS class name without the dot, e.g. ``text-primary``.
        fill: Token path of the fill colour, e.g. ``color.text_primary``.
        font: Token path of the font stack, e.g. ``font.body``.
    """

    name: str
    fill: str
    font: str


def render_defs(classes: Iterable[TextClass], extra: str = "") -> str:
    """Build the ``<defs>`` template shared by every SVG of one kind.

    Args:
        classes: Text classes, in output order.
        extra: Additional ``<defs>`` children (already indented, ending in a
            newline), e.g. Prism's gradients.

    Returns:
        A template (still containing placeholders).
    """
    rules = "".join(
        f"      .{c.name} {{ fill: {{{c.fill}}}; font-family: {{{c.font}}}; }}\n"
        for c in classes
    )
    return f"  <defs>\n    <style>\n{rules}    </style>\n{extra}  </defs>"


def banner_comment(item_id: str) -> str:
    """Return the standard ``<!-- ===== ITEM-ID ===== -->`` marker."""
    return f"<!-- ==================== {item_id.upper()} ==================== -->"


def default_wrap(width: int, height: int, body: str, item_id: str, defs: str) -> str:
    """Wrap a rendered body in the standard SVG envelope.

    Args:
        width: Viewport width in px.
        height: Viewport height in px.
        body: Rendered body markup.
        item_id: Component or layout id (used for the marker comment).
        defs: Rendered ``<defs>`` block.

    Returns:
        The complete SVG document text.
    """
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'width="{width}" height="{height}">\n'
        f"{defs}\n"
        f"  {banner_comment(item_id)}\n"
        f"{body}\n"
        f"</svg>\n"
    )
