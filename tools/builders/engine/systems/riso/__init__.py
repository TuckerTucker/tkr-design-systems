"""Riso: duotone print on tinted paper, ghost-ink misregistration, grain.

Only the default press (cream paper, classic drums) is rendered; the
token file's base values are that press. Components carry the grain
filter in the shared ``<defs>`` so a standalone preview reads as print.
"""

from __future__ import annotations

from engine.templates import TextClass

from .library import COMPONENTS

TEXT_CLASSES = (
    TextClass("text-primary", "color.text_primary", "font.body"),
    TextClass("text-ink-1", "extras.color.ink_1_text", "font.body"),
    TextClass("text-ink-2", "color.action", "font.body"),
    TextClass("text-label", "extras.color.ink_1_text", "font.label"),
)

GRAIN_DEFS = """\
    <!-- Grain filter: feTurbulence overlay with multiply blend -->
    <filter id="grain" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="42"/>
      <feColorMatrix values="0 0 0 0 0
                             0 0 0 0 0
                             0 0 0 0 0
                             0 0 0 0.12 0"/>
      <feComposite in="SourceGraphic" in2="" operator="over"/>
    </filter>
"""

BUILDER = {
    "library": {"classes": TEXT_CLASSES, "defs_extra": GRAIN_DEFS, "items": COMPONENTS},
}
