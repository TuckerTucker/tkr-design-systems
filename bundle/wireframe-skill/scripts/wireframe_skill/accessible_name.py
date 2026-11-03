"""Accessible name for emitted wireframe SVGs.

Every SVG the skill produces (pattern generation, blueprint assembly,
pattern substitution) is an image of a screen, so its root carries an
accessible name: a ``<title>`` as the root's first child, ``role="img"``,
and ``aria-labelledby`` pointing at the title's id. tkr-kit's design
validator refuses an artifact without a title (``missing_title``), and a
screen reader announces an unnamed SVG as nothing at all.

The name is chosen by the caller from what it knows about the screen (a
blueprint title, the brief, a layout id); ``first_name`` picks the first
usable candidate so every path states its fallback order in one call.
"""

from __future__ import annotations

import re
from html import escape as _escape

import structlog

logger = structlog.get_logger(__name__)

TITLE_ID = "wireframe-title"
"""Base id of the generated ``<title>``; suffixed when the SVG already uses it."""

_ROOT_OPEN = re.compile(r"<svg\b[^>]*>")
_FIRST_TITLE = re.compile(r"\s*<title\b([^>]*)>(.*?)</title>", re.DOTALL)
_ID_ATTR = re.compile(r'\bid="([^"]*)"')


class AccessibleNameError(ValueError):
    """The SVG has no root element to name, or no usable name was given."""


def first_name(*candidates: object) -> str:
    """Return the first candidate that is a non-blank string, stripped.

    Args:
        *candidates: Possible names in priority order (None and non-strings
            are skipped).

    Returns:
        The first usable name.

    Raises:
        AccessibleNameError: If no candidate is a non-blank string.
    """
    for candidate in candidates:
        if isinstance(candidate, str) and candidate.strip():
            return " ".join(candidate.split())
    raise AccessibleNameError("no non-blank accessible name among the candidates")


def add_accessible_title(svg_text: str, title: str) -> str:
    """Name an SVG: ``<title>`` first child, ``role="img"``, ``aria-labelledby``.

    Idempotent: when the root's first child is already a ``<title>``, that
    title is kept (given an id if it has none) and only the root attributes
    are completed. Existing ``role`` / ``aria-labelledby`` attributes on the
    root are replaced, since they must point at this title.

    Args:
        svg_text: SVG document text with an ``<svg ...>`` root.
        title: Accessible name (non-blank).

    Returns:
        The named SVG text.

    Raises:
        AccessibleNameError: If the title is blank or there is no ``<svg>`` root.
    """
    name = first_name(title)
    root = _ROOT_OPEN.search(svg_text)
    if root is None:
        raise AccessibleNameError("SVG has no <svg> root element")
    head, after = svg_text[: root.end()], svg_text[root.end():]

    existing = _FIRST_TITLE.match(after)
    if existing is not None and not existing.group(2).strip():
        # An empty title names nothing: drop it and write the given name.
        after = after[existing.end():]
        existing = None
    if existing is not None:
        attrs = existing.group(1)
        id_match = _ID_ATTR.search(attrs)
        if id_match and id_match.group(1):
            title_id = id_match.group(1)
        else:
            title_id = _unused_id(svg_text)
            after = (after[: existing.start(1)] + f' id="{title_id}"' + attrs
                     + after[existing.end(1):])
        reused = True
    else:
        title_id = _unused_id(svg_text)
        after = f'\n<title id="{title_id}">{_escape(name, quote=False)}</title>' + after
        reused = False

    opening = root.group(0)
    opening = re.sub(r'\s(?:role|aria-labelledby)="[^"]*"', "", opening)
    close = "/>" if opening.endswith("/>") else ">"
    if close == "/>":
        raise AccessibleNameError("SVG root is self-closing; it has no children to name it")
    opening = opening[: -len(close)].rstrip() + f' role="img" aria-labelledby="{title_id}"' + close
    head = head[: root.start()] + opening

    logger.debug("accessible_title_applied", title_id=title_id, reused_title=reused)
    return head + after


def _unused_id(svg_text: str) -> str:
    """Return ``TITLE_ID``, suffixed until no element in the SVG uses it."""
    used = set(_ID_ATTR.findall(svg_text))
    candidate, n = TITLE_ID, 1
    while candidate in used:
        n += 1
        candidate = f"{TITLE_ID}-{n}"
    return candidate
