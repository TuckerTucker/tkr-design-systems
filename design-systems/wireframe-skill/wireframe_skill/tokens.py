"""Design token export for SVG authoring.

Transforms the raw spec token structure into an SVG-authoring-ready
vocabulary. Agents use these tokens to draw freehand SVG that stays
on-brand without being constrained to the component library.
"""

from __future__ import annotations

from typing import Any

import structlog

from .decomposition import PLATFORM_DIMENSIONS

logger = structlog.get_logger(__name__)


def export_tokens_for_authoring(spec: dict) -> dict[str, Any]:
    """Transform spec tokens into SVG-authoring-ready vocabulary.

    Args:
        spec: Loaded system spec dict (from load_system).

    Returns:
        Dict with system_id, palette, drawing_rules, typography, and
        layout sections — each formatted for direct use in SVG attributes.
    """
    tokens = spec.get("tokens", {})
    system_id = spec.get("system", {}).get("id", "unknown")
    grammar_ext = spec.get("grammar_extensions", {})

    return {
        "system_id": system_id,
        "palette": _build_palette(tokens.get("colors", {})),
        "drawing_rules": _build_drawing_rules(tokens),
        "typography": _build_typography_section(tokens.get("typography", {})),
        "layout": _build_layout_section(tokens.get("spacing", {}), grammar_ext),
    }


def _build_palette(colors: dict) -> list[dict[str, str]]:
    """Flatten the palette list from spec colors.

    Args:
        colors: The tokens.colors dict from spec.

    Returns:
        List of {name, value, role, usage_constraint} dicts.
    """
    palette = colors.get("palette", [])
    return [
        {
            "name": entry.get("name", ""),
            "value": entry.get("value", ""),
            "role": entry.get("role", ""),
            "usage_constraint": entry.get("usage_constraint", ""),
        }
        for entry in palette
    ]


def _build_drawing_rules(tokens: dict) -> dict[str, Any]:
    """Derive concrete SVG attribute strings from abstract tokens.

    Translates elevation strategy, border config, and color tokens into
    copy-pasteable SVG attribute fragments.

    Args:
        tokens: The full tokens dict from spec.

    Returns:
        Dict of drawing rule keys to SVG-ready values.
    """
    colors = tokens.get("colors", {})
    borders = tokens.get("borders", {})
    elevation = tokens.get("elevation", {})
    strategy = elevation.get("strategy", "borders_only")
    config = elevation.get("config", {})

    rules: dict[str, Any] = {
        "fill_page_bg": colors.get("page_bg", "#F5F5F5"),
        "fill_surface": colors.get("surface", "#FFFFFF"),
        "fill_surface_elevated": colors.get("surface_elevated", "#FFFFFF"),
        "fill_interactive": colors.get("accent", "#424242"),
        "text_primary": colors.get("text_primary", "#212121"),
        "text_secondary": colors.get("text_secondary", "#757575"),
        "text_disabled": colors.get("text_muted", "#BDBDBD"),
        "text_inverse": "#FFFFFF",
        "radius_default": borders.get("radius_default", 6),
        "radius_inputs": borders.get("radius_inputs", 6),
        "radius_chrome": borders.get("radius_chrome", 8),
    }

    if strategy == "borders_only":
        border_light = config.get("border_light", {})
        border_strong = config.get("border_strong", {})

        light_color = border_light.get("color", "#E0E0E0")
        light_width = border_light.get("width", 1)
        strong_color = border_strong.get("color", "#E0E0E0")
        strong_width = border_strong.get("width", 1.5)

        rules["stroke_border"] = (
            f"stroke='{light_color}' stroke-width='{light_width}'"
        )
        rules["stroke_border_strong"] = (
            f"stroke='{strong_color}' stroke-width='{strong_width}'"
        )
        rules["no_shadow"] = config.get("no_shadow", True)
        rules["elevation_note"] = "borders only — no box-shadow or drop-shadow"
    else:
        rules["elevation_note"] = (
            f"elevation strategy is '{strategy}' — check artifact_treatments "
            f"in the spec for filter/overlay details"
        )

    return rules


def _build_typography_section(typography: dict) -> dict[str, Any]:
    """Build typography section with font stacks, scale, and CSS classes.

    Args:
        typography: The tokens.typography dict from spec.

    Returns:
        Dict with font stacks, type scale, case rules, and a ready-to-use
        CSS class block for <defs><style>.
    """
    families = typography.get("families", [])
    structural_stack = ""
    mono_stack = ""
    for family in families:
        if family.get("id") == "structural":
            structural_stack = family.get("stack", "")
        elif family.get("id") == "mono":
            mono_stack = family.get("stack", "")

    scale = [
        {"px": entry.get("size"), "role": entry.get("role")}
        for entry in typography.get("scale", [])
    ]

    case_rules = typography.get("case", {})
    tracking = typography.get("tracking", {})

    css_block = _build_css_class_block(structural_stack)

    return {
        "font_stack_structural": structural_stack,
        "font_stack_mono": mono_stack,
        "scale": scale,
        "case_rules": case_rules,
        "tracking": tracking,
        "css_class_block": css_block,
    }


def _build_css_class_block(font_stack: str) -> str:
    """Build the CSS class block for text elements.

    Args:
        font_stack: The structural font stack string.

    Returns:
        A complete <style> block ready to paste into <defs>.
    """
    font = font_stack or "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    return (
        "<style>\n"
        f"  .text-primary {{ fill: #212121; font-family: {font}; }}\n"
        f"  .text-secondary {{ fill: #757575; font-family: {font}; }}\n"
        f"  .text-disabled {{ fill: #BDBDBD; font-family: {font}; }}\n"
        f"  .text-inverse {{ fill: #FFFFFF; font-family: {font}; }}\n"
        f"  .text-danger {{ fill: #B71C1C; font-family: {font}; }}\n"
        f"  .text-success {{ fill: #2E7D32; font-family: {font}; }}\n"
        f"  .text-warning {{ fill: #E65100; font-family: {font}; }}\n"
        f"  .text-info {{ fill: #1565C0; font-family: {font}; }}\n"
        "</style>"
    )


def _build_layout_section(
    spacing: dict,
    grammar_extensions: dict,
) -> dict[str, Any]:
    """Build layout constants for spatial composition.

    Args:
        spacing: The tokens.spacing dict from spec.
        grammar_extensions: The grammar_extensions dict from spec.

    Returns:
        Dict with grid, margins, gaps, canvas sizes, and comment format.
    """
    section_structure = grammar_extensions.get(
        "per_system_signature", {}
    ).get("section_structure", {})

    comment_format = section_structure.get(
        "banner_format",
        "<!-- ==================== SECTION ==================== -->",
    )

    canvas = {}
    for platform, (w, h) in PLATFORM_DIMENSIONS.items():
        canvas[platform] = {"w": w, "h": h}

    return {
        "grid_unit": spacing.get("grid_unit", 4),
        "allowed_steps": spacing.get("allowed_steps", []),
        "page_margin_mobile": spacing.get("page_margin", {}).get("mobile", 12),
        "page_margin_desktop": spacing.get("page_margin", {}).get("desktop", 32),
        "component_gap": spacing.get("component_gap", 12),
        "section_gap": spacing.get("section_gap", 32),
        "canvas": canvas,
        "section_comment_format": comment_format,
    }
