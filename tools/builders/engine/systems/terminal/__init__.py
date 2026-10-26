"""Terminal: phosphor green on black, monospace, box-drawing borders.

Box-drawing glyphs (┌─┐│└┘) and the █ cursor are plain text in the
templates; JetBrains Mono (``font.body``) is what makes them line up.
"""

from __future__ import annotations

from engine.templates import TextClass

from .library import COMPONENTS
from .patterns import PATTERNS

_BASE = (
    TextClass("text-primary", "color.text_primary", "font.body"),
    TextClass("text-secondary", "color.text_secondary", "font.body"),
    TextClass("text-muted", "color.text_muted", "font.body"),
    TextClass("text-accent", "color.accent", "font.body"),
)
_ERROR = TextClass("text-error", "color.danger", "font.body")
_AMBER = TextClass("text-amber", "color.warning", "font.body")

LIBRARY_CLASSES = _BASE + (_ERROR, _AMBER)
PATTERN_CLASSES = _BASE + (_AMBER,)

BUILDER = {
    "library": {"classes": LIBRARY_CLASSES, "items": COMPONENTS},
    "patterns": {"classes": PATTERN_CLASSES, "items": PATTERNS},
}
