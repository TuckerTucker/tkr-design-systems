"""Wireframe (also the ``neutral`` alias): grey, low-fidelity reference library.

Text classes follow the shared class -> token mapping
(``wireframe_skill/tokens.py::_CLASS_TOKENS``) so these SVGs, the
wireframe-skill output and ``wf_get_tokens`` agree.
"""

from __future__ import annotations

from engine.templates import TextClass

from .library import COMPONENTS
from .patterns import PATTERNS

TEXT_CLASSES = (
    TextClass("text-primary", "color.text_primary", "font.body"),
    TextClass("text-secondary", "color.text_secondary", "font.body"),
    TextClass("text-disabled", "color.text_muted", "font.body"),
    TextClass("text-inverse", "color.text_inverse", "font.body"),
    TextClass("text-danger", "color.danger", "font.body"),
    TextClass("text-success", "color.success", "font.body"),
    TextClass("text-warning", "color.warning", "font.body"),
    TextClass("text-info", "color.info", "font.body"),
)

BUILDER = {
    "library": {"classes": TEXT_CLASSES, "items": COMPONENTS},
    "patterns": {"classes": TEXT_CLASSES, "items": PATTERNS},
}
