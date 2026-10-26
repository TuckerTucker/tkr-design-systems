"""Swiss: Inter on white, black rules, one red accent, zero radius."""

from __future__ import annotations

from engine.templates import TextClass

from .library import COMPONENTS
from .patterns import PATTERNS

TEXT_CLASSES = (
    TextClass("text-primary", "color.text_primary", "font.body"),
    TextClass("text-secondary", "color.text_secondary", "font.body"),
    TextClass("text-disabled", "color.text_muted", "font.body"),
    TextClass("text-accent", "color.accent", "font.body"),
    TextClass("text-inverse", "color.text_inverse", "font.body"),
)

BUILDER = {
    "library": {"classes": TEXT_CLASSES, "items": COMPONENTS},
    "patterns": {"classes": TEXT_CLASSES, "items": PATTERNS},
}
