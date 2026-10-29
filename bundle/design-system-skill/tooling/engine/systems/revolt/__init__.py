"""Revolt: neo-brutalist black borders, hard offset shadows, lime and pink.

Hard shadows are drawn as an offset ``<rect>`` filled with
``extras.color.shadow`` before the element they sit under.
"""

from __future__ import annotations

from engine.templates import TextClass

from .library import COMPONENTS
from .patterns import PATTERNS

TEXT_CLASSES = (
    TextClass("text-primary", "color.text_primary", "font.body"),
    TextClass("text-secondary", "color.text_secondary", "font.body"),
    TextClass("text-muted", "color.text_muted", "font.body"),
    TextClass("text-inverse", "color.text_inverse", "font.body"),
    TextClass("text-on-accent", "color.accent_foreground", "font.body"),
    TextClass("text-on-danger", "color.danger_foreground", "font.body"),
)

BUILDER = {
    "library": {"classes": TEXT_CLASSES, "items": COMPONENTS},
    "patterns": {"classes": TEXT_CLASSES, "items": PATTERNS},
}
