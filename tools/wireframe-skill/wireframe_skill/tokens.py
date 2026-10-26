"""Design token export for SVG authoring.

Transforms the raw spec token structure into an SVG-authoring-ready
vocabulary. Agents use these tokens to draw freehand SVG that stays
on-brand without being constrained to the component library.

Specs on schema v0.3 carry their canonical token document (the system's
``tokens.json``) at ``tokens.contract`` after ``load_system``; values from
it take precedence. Specs without one fall back to the legacy
``tokens.colors`` keys and the wireframe defaults below.
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
        layout sections — each formatted for direct use in SVG attributes —
        plus ``contract`` (the token document) and ``motion`` (tiers,
        reduced-motion policy, per-component declarations) when the spec
        carries a token contract.
    """
    tokens = spec.get("tokens", {})
    system_id = spec.get("system", {}).get("id", "unknown")
    grammar_ext = spec.get("grammar_extensions", {})
    contract = tokens.get("contract") or {}

    result: dict[str, Any] = {
        "system_id": system_id,
        "palette": _build_palette(tokens.get("colors", {})),
        "drawing_rules": _build_drawing_rules(tokens),
        "typography": _build_typography_section(
            tokens.get("typography", {}), contract.get("color") or {}
        ),
        "layout": _build_layout_section(tokens.get("spacing", {}), grammar_ext),
    }
    if contract:
        # The full semantic contract (docs/specs/SCHEMA-V0.3.md): fixed token
        # names, so an agent can author against color.danger, type.label ...
        # without knowing the system's private vocabulary.
        result["contract"] = contract
    if isinstance(contract.get("motion"), dict):
        result["motion"] = _build_motion_section(spec, contract["motion"])
    return result


_MOTION_TIER_ORDER = ("fast", "moderate", "slow", "expressive")


def _build_motion_section(spec: dict, motion: dict) -> dict[str, Any]:
    """Collect motion tiers and per-component declarations (issue #10).

    Static SVG does not animate, but agents producing prototypes or
    annotated wireframes need the system's motion vocabulary: which tier
    each component runs at and what it does under reduced motion.

    Args:
        spec: Loaded system spec dict (from load_system).
        motion: The token contract's ``motion`` group.

    Returns:
        Dict with ``tiers`` (contract values plus a CSS ``transition``
        shorthand per tier), ``reduced_motion`` (the system policy),
        ``declarations`` (``{component_or_element_id: [declaration, ...]}``)
        and ``css_custom_properties`` (a ``:root`` block with a
        ``prefers-reduced-motion`` override).
    """
    tiers: dict[str, Any] = {}
    for name in _MOTION_TIER_ORDER:
        tier = motion.get(name)
        if not isinstance(tier, dict):
            continue
        tiers[name] = {
            **tier,
            "css_enter": f"{tier.get('enter_ms', 0)}ms {tier.get('easing', 'ease')}",
            "css_exit": f"{tier.get('exit_ms', 0)}ms {tier.get('easing', 'ease')}",
        }
    policy = motion.get("reduced_motion", "fade")

    declarations: dict[str, list[Any]] = {}
    for comp_id, comp_def in (spec.get("components") or {}).items():
        if isinstance(comp_def, dict) and isinstance(comp_def.get("motion"), list):
            declarations[comp_id] = comp_def["motion"]
    elements = (spec.get("motion") or {}).get("elements") if isinstance(spec.get("motion"), dict) else None
    for el_id, decls in (elements or {}).items():
        if isinstance(decls, list):
            declarations[el_id] = decls

    root = [f"  --motion-{n}-enter: {t['enter_ms']}ms;\n"
            f"  --motion-{n}-exit: {t['exit_ms']}ms;\n"
            f"  --motion-{n}-easing: {t['easing']};" for n, t in tiers.items()]
    reduced = [f"    --motion-{n}-enter: 0ms;\n    --motion-{n}-exit: 0ms;" for n in tiers]
    css = ":root {\n" + "\n".join(root) + "\n}"
    if policy == "none" and reduced:
        css += ("\n@media (prefers-reduced-motion: reduce) {\n  :root {\n"
                + "\n".join(reduced) + "\n  }\n}")
    logger.debug("motion_exported", system_id=spec.get("system", {}).get("id"),
                 tiers=len(tiers), declarations=sum(len(d) for d in declarations.values()))
    return {
        "tiers": tiers,
        "reduced_motion": policy,
        "declarations": declarations,
        "css_custom_properties": css,
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
    contract_colors = (tokens.get("contract") or {}).get("color") or {}
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
        "text_inverse": contract_colors.get("text_inverse", "#FFFFFF"),
        "radius_default": borders.get("radius_default", 6),
        "radius_inputs": borders.get("radius_inputs", 6),
        "radius_chrome": borders.get("radius_chrome", 8),
    }
    if contract_colors:
        rules.update({
            "fill_surface_selected": contract_colors["surface_selected"],
            "fill_surface_inverse": contract_colors["surface_inverse"],
            "fill_action": contract_colors["action"],
            "text_on_action": contract_colors["action_foreground"],
            "text_on_accent": contract_colors["accent_foreground"],
            "text_placeholder": contract_colors["text_placeholder"],
            "stroke_input": contract_colors["border_input"],
            "focus_ring": contract_colors["focus_ring"],
        })

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


def _build_typography_section(
    typography: dict, contract_colors: dict | None = None
) -> dict[str, Any]:
    """Build typography section with font stacks, scale, and CSS classes.

    Args:
        typography: The tokens.typography dict from spec.
        contract_colors: The ``color`` group of the system's token contract,
            when the spec has one; drives the CSS class fills.

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

    css_block = _build_css_class_block(structural_stack, contract_colors or {})

    return {
        "font_stack_structural": structural_stack,
        "font_stack_mono": mono_stack,
        "scale": scale,
        "case_rules": case_rules,
        "tracking": tracking,
        "css_class_block": css_block,
    }


# Wireframe values, used when a spec carries no token contract.
_DEFAULT_CLASS_FILLS: dict[str, str] = {
    "text_primary": "#212121",
    "text_secondary": "#757575",
    "text_muted": "#BDBDBD",
    "text_inverse": "#FFFFFF",
    "danger": "#B71C1C",
    "success": "#2E7D32",
    "warning": "#E65100",
    "info": "#1565C0",
}

# CSS class -> contract colour token.
_CLASS_TOKENS: tuple[tuple[str, str], ...] = (
    ("text-primary", "text_primary"),
    ("text-secondary", "text_secondary"),
    ("text-disabled", "text_muted"),
    ("text-inverse", "text_inverse"),
    ("text-danger", "danger"),
    ("text-success", "success"),
    ("text-warning", "warning"),
    ("text-info", "info"),
)


def _build_css_class_block(font_stack: str, contract_colors: dict | None = None) -> str:
    """Build the CSS class block for text elements.

    Before v0.3 these fills were the wireframe's greys for every system;
    they now come from the system's token contract.

    Args:
        font_stack: The structural font stack string.
        contract_colors: The token contract's ``color`` group; any missing
            token falls back to the wireframe default.

    Returns:
        A complete <style> block ready to paste into <defs>.
    """
    font = font_stack or "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fills = {**_DEFAULT_CLASS_FILLS, **(contract_colors or {})}
    rows = "".join(
        f"  .{cls} {{ fill: {fills[token]}; font-family: {font}; }}\n"
        for cls, token in _CLASS_TOKENS
    )
    return "<style>\n" + rows + "</style>"


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
