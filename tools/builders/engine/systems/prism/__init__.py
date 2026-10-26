"""Prism: translucent glass panels over a four-stop gradient.

Glass needs a backdrop to read, so this system overrides the envelope:
every component is drawn over a two-stop slice of the page gradient
(``prism-bg-strip``), and layouts carry the full gradient plus the two
ambient orbs in ``<defs>``. SVG cannot composite CSS ``rgba()`` over a
gradient the way a browser does, so glass tiers stay as white-with-alpha
fills (the token values) painted on that backdrop.
"""

from __future__ import annotations

from engine.templates import TextClass

from .library import COMPONENTS
from .patterns import PATTERNS

TEXT_CLASSES = (
    TextClass("text-primary", "color.text_primary", "font.body"),
    TextClass("text-secondary", "color.text_secondary", "font.body"),
    TextClass("text-muted", "color.text_muted", "font.body"),
    TextClass("text-accent", "color.accent", "font.body"),
)

STRIP_DEFS = """\
    <linearGradient id="prism-bg-strip" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="{extras.color.gradient_stop_2}"/>
      <stop offset="1" stop-color="{extras.color.gradient_stop_3}"/>
    </linearGradient>
"""

PAGE_DEFS = """\
    <linearGradient id="prism-bg" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(0)">
      <stop offset="0" stop-color="{extras.color.gradient_stop_1}"/>
      <stop offset="0.40" stop-color="{extras.color.gradient_stop_2}"/>
      <stop offset="0.70" stop-color="{extras.color.gradient_stop_3}"/>
      <stop offset="1.00" stop-color="{extras.color.gradient_stop_4}"/>
    </linearGradient>
    <radialGradient id="orb-lavender" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="{extras.color.orb_lavender|alpha=0.25}"/>
      <stop offset="0.7" stop-color="{extras.color.orb_lavender|alpha=0}"/>
    </radialGradient>
    <radialGradient id="orb-teal" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="{extras.color.orb_mint|alpha=0.20}"/>
      <stop offset="0.7" stop-color="{extras.color.orb_mint|alpha=0}"/>
    </radialGradient>
"""


def _open(width: int, height: int, defs: str, item_id: str) -> str:
    """Start a Prism SVG: root element, defs and the plain id comment."""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'width="{width}" height="{height}">\n'
        f"{defs}\n"
        f"  <!-- {item_id.upper()} -->\n"
    )


def wrap_component(width: int, height: int, body: str, item_id: str, defs: str) -> str:
    """Envelope for components: a gradient strip behind the glass.

    Args:
        width: Viewport width.
        height: Viewport height.
        body: Rendered body.
        item_id: Component id.
        defs: Rendered ``<defs>``.

    Returns:
        The SVG document.
    """
    strip = (f'  <rect x="0" y="0" width="{width}" height="{height}" '
             f'fill="url(#prism-bg-strip)"/>\n')
    return f"{_open(width, height, defs, item_id)}{strip}{body}\n</svg>\n"


def wrap_layout(width: int, height: int, body: str, item_id: str, defs: str) -> str:
    """Envelope for layouts: the body paints its own full gradient.

    Args:
        width: Viewport width.
        height: Viewport height.
        body: Rendered body.
        item_id: Layout id.
        defs: Rendered ``<defs>``.

    Returns:
        The SVG document.
    """
    return f"{_open(width, height, defs, item_id)}{body}\n</svg>\n"


BUILDER = {
    "library": {
        "classes": TEXT_CLASSES,
        "defs_extra": STRIP_DEFS,
        "wrap": wrap_component,
        "items": COMPONENTS,
    },
    "patterns": {
        "classes": TEXT_CLASSES,
        "defs_extra": PAGE_DEFS,
        "wrap": wrap_layout,
        "items": PATTERNS,
    },
}
