"""Token placeholders and the shared SVG envelope.

Per-system templates never contain colour, font or radius literals.
They reference the system's token file with placeholders:

    {color.text_primary}               -> the token value
    {extras.color.rule_hairline}       -> extras work the same way
    {radius.input}                     -> numbers render without ".0"
    {extras.color.orb_lavender|alpha=0.25}
                                       -> the token's RGB with this alpha,
                                          as ``rgba(r,g,b,0.25)``

A placeholder is a brace pair around a dotted path of lowercase
identifiers (at least two segments), optionally followed by one
``|filter=arg``. Anything else in braces (CSS rule bodies, prose) is
left alone, so templates can carry inline ``<style>`` blocks.

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

_XML_ENTITIES = {'"': "&quot;"}

#: Signature of a filter: (token value, argument text) -> rendered string.
Filter = Callable[[Any, str], str]


class TemplateError(ValueError):
    """A template references a token path or filter that cannot be resolved."""


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


#: Filters available to every template. Plugins may pass extra ones.
FILTERS: dict[str, Filter] = {"alpha": _alpha}


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
                  filters: dict[str, Filter] | None = None) -> list[str]:
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
        problem = None
        if get_token(tokens, m["path"], None) is None:
            problem = m["path"]
        elif m["filter"] and m["filter"] not in filters:
            problem = f"{m['path']}|{m['filter']}"
        if problem and problem not in out:
            out.append(problem)
    return out


def resolve(template: str, tokens: dict[str, Any],
            filters: dict[str, Filter] | None = None) -> str:
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
            text = filters[name](value, m["arg"])
        else:
            text = format_value(value)
        return escape(text, _XML_ENTITIES)

    return PLACEHOLDER_RE.sub(sub, template)


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
