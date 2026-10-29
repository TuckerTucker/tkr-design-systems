"""Editorial: Fraunces body on warm paper, Inter metadata, burgundy accent."""

from __future__ import annotations

from engine.templates import TextClass

from .library import COMPONENTS
from .patterns import PATTERNS

TEXT_CLASSES = (
    TextClass("text-primary", "color.text_primary", "font.body"),
    TextClass("text-secondary", "color.text_secondary", "font.body"),
    TextClass("text-metadata", "color.text_muted", "font.label"),
    TextClass("text-metadata-accent", "color.accent", "font.label"),
    TextClass("text-accent", "color.accent", "font.body"),
    TextClass("text-muted", "color.text_muted", "font.label"),
    TextClass("text-display", "color.text_primary", "font.body"),
)

BUILDER = {
    "library": {"classes": TEXT_CLASSES, "items": COMPONENTS},
    "patterns": {"classes": TEXT_CLASSES, "items": PATTERNS},
}
