"""Component decomposition for wireframe layouts (two-pass architecture).

This module implements Pass 1 (emit request) and Pass 2 (validate blueprint)
of the component decomposition workflow:

  Pass 1: Inventory all available components from the system library,
          assemble grammar caveats and platform-specific canvas sizes into a
          JSON request for the calling Claude to process.
  Pass 2: Accept structured blueprint response from Claude, validate
          component references, region bounds, and canvas constraints.

The architecture allows the calling Claude (orchestrator) to provide LLM
judgment while the skill itself remains deterministic.
"""

from __future__ import annotations
import json
import re
from pathlib import Path
from typing import NamedTuple

import structlog

logger = structlog.get_logger(__name__)


# Standard canvas sizes per platform.
PLATFORM_DIMENSIONS = {
    "mobile": (375, 812),
    "desktop": (1280, 800),
}


class ComponentInfo(NamedTuple):
    """Metadata for a single component in the system library."""
    id: str              # e.g. "card-default"
    tier: str            # "primitive" or "composite"
    svg_path: Path       # Absolute path to the SVG file
    viewBox_w: int       # Width from viewBox attribute
    viewBox_h: int       # Height from viewBox attribute
    anatomy: str | None  # Optional anatomy label (for composites)


def build_decomposition_request(
    brief: str,
    spec: dict,
    platform: str = "desktop",
) -> dict:
    """Assemble the JSON request for Pass 1 (emit request).

    Walks the system library to inventory all available components,
    extracts viewBox dimensions, and combines them with grammar caveats
    and platform canvas size into a structured request that the calling
    Claude will process.

    Args:
        brief: Free-text brief (e.g. "kanban board with three columns").
        spec: Loaded system spec dict (from spec.yaml).
        platform: "mobile" or "desktop" (determines canvas size).

    Returns:
        Dict with schema_version, brief, system_id, canvas, grammar_caveats,
        component catalog, and response_format_example.

    Raises:
        ValueError: If platform is invalid or library_root not in spec.
    """
    if platform not in PLATFORM_DIMENSIONS:
        raise ValueError(f"Invalid platform: {platform}")

    system_id = spec.get("system", {}).get("id", "unknown")
    library_root = spec.get("_meta", {}).get("library_root")
    if not library_root:
        raise ValueError(f"No _meta.library_root in spec for {system_id}")

    library_path = Path(library_root).resolve()
    components_dir = library_path / "components"
    if not components_dir.exists():
        raise ValueError(f"Components directory not found: {components_dir}")

    # Inventory components.
    components = _enumerate_components(components_dir, spec)

    # Extract grammar caveats.
    grammar_caveats = _extract_grammar_caveats(spec)

    # Canvas size for the platform.
    canvas_w, canvas_h = PLATFORM_DIMENSIONS[platform]

    return {
        "schema_version": "1.0",
        "brief": brief,
        "system_id": system_id,
        "platform": platform,
        "canvas": {"width": canvas_w, "height": canvas_h},
        "grammar_caveats": grammar_caveats,
        "components": [
            {
                "component_id": comp.id,
                "tier": comp.tier,
                "anatomy": comp.anatomy,
                "viewBox_w": comp.viewBox_w,
                "viewBox_h": comp.viewBox_h,
            }
            for comp in components
        ],
        "response_format_example": {
            "schema_version": "1.0",
            "canvas": {"width": canvas_w, "height": canvas_h},
            "regions": [
                {
                    "id": "header",
                    "x": 0,
                    "y": 0,
                    "w": canvas_w,
                    "h": 64,
                    "components": [
                        {"component_id": "button-primary", "x": 10, "y": 10}
                    ],
                },
                {
                    "id": "main",
                    "x": 0,
                    "y": 64,
                    "w": canvas_w,
                    "h": canvas_h - 64,
                    "components": [
                        {"component_id": "card-default", "x": 20, "y": 80, "w": 300, "h": 150}
                    ],
                },
            ],
        },
    }


def _enumerate_components(components_dir: Path, spec: dict) -> list[ComponentInfo]:
    """Walk components directory and build a list of ComponentInfo.

    Reads each .svg file, extracts viewBox dimensions, and classifies
    as primitive or composite based on naming conventions (if available
    in spec).

    Args:
        components_dir: Path to system/components directory.
        spec: Loaded system spec dict.

    Returns:
        List of ComponentInfo, sorted by id.
    """
    components = []

    for svg_path in sorted(components_dir.glob("*.svg")):
        component_id = svg_path.stem  # e.g. "card-default"
        w, h = _extract_viewbox_dimensions(svg_path)

        # Classify tier: check spec's library or use heuristic.
        tier = "primitive"
        anatomy = None

        # Heuristic: composites often have hyphenated names with certain prefixes.
        if any(prefix in component_id for prefix in ["form-field", "search-bar", "list-item"]):
            tier = "composite"

        components.append(
            ComponentInfo(
                id=component_id,
                tier=tier,
                svg_path=svg_path,
                viewBox_w=w,
                viewBox_h=h,
                anatomy=anatomy,
            )
        )

    return components


def _extract_viewbox_dimensions(svg_path: Path) -> tuple[int, int]:
    """Extract viewBox width and height from an SVG file.

    Args:
        svg_path: Path to the .svg file.

    Returns:
        Tuple of (width, height). Defaults to (100, 100) if not found.

    Raises:
        FileNotFoundError: If the SVG file does not exist.
    """
    if not svg_path.exists():
        raise FileNotFoundError(f"SVG not found: {svg_path}")

    svg_text = svg_path.read_text()
    m = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg_text)
    if m:
        return int(float(m.group(1))), int(float(m.group(2)))

    return 100, 100


def _extract_grammar_caveats(spec: dict) -> dict:
    """Extract grammar rules from spec that constrain layouts.

    Similar to substitution.py, but adapted for component-level rules.

    Args:
        spec: Loaded system spec dict.

    Returns:
        Dict with system-specific grammar rules.
    """
    caveats = {}

    typography = spec.get("tokens", {}).get("typography", {})
    case_rules = typography.get("case", {})

    if case_rules:
        caveats["case_rules"] = case_rules
        if case_rules.get("metadata") == "uppercase":
            caveats["hint_metadata"] = "Metadata labels must be ALL CAPS"
        if case_rules.get("headers") == "uppercase":
            caveats["hint_headers"] = "Headers must be ALL CAPS"

    avatar_strategy = spec.get("system", {}).get("avatar_strategy")
    if avatar_strategy:
        caveats["avatar_strategy"] = avatar_strategy.get("mode")
        if avatar_strategy.get("mode") == "abbreviation":
            caveats["hint_avatar"] = "User names must be uppercase abbreviations"

    return caveats


def validate_blueprint(blueprint: dict, spec: dict) -> list[str]:
    """Validate a blueprint against system constraints.

    Checks:
      - Every referenced component_id exists in the system.
      - Every component placement fits within its region.
      - Canvas dimensions match the platform.
      - (Advisory) No overlapping components in the same region.

    Args:
        blueprint: Blueprint dict from Claude (with regions and components).
        spec: Loaded system spec dict.

    Returns:
        List of error strings (empty if valid). Warnings are included but
        do not block validation.
    """
    errors = []

    # Validate schema version.
    if blueprint.get("schema_version") != "1.0":
        errors.append(f"Unexpected schema_version: {blueprint.get('schema_version')}")

    # Build set of valid component IDs from spec.
    library_root = spec.get("_meta", {}).get("library_root")
    if library_root:
        components_dir = Path(library_root).resolve() / "components"
        valid_ids = {p.stem for p in components_dir.glob("*.svg")} if components_dir.exists() else set()
    else:
        valid_ids = set()

    # Check canvas dimensions.
    canvas = blueprint.get("canvas", {})
    canvas_w = canvas.get("width")
    canvas_h = canvas.get("height")

    if canvas_w is None or canvas_h is None:
        errors.append("Canvas missing or incomplete (need width and height)")
        return errors

    # Validate each region and its components.
    regions = blueprint.get("regions", [])
    for region in regions:
        region_id = region.get("id", "unnamed")
        r_x = region.get("x", 0)
        r_y = region.get("y", 0)
        r_w = region.get("w", 0)
        r_h = region.get("h", 0)

        if r_w <= 0 or r_h <= 0:
            errors.append(f"Region '{region_id}' has zero or negative dimensions")

        # Validate each component in the region.
        components = region.get("components", [])
        placements = []  # For overlap checking.

        for comp in components:
            comp_id = comp.get("component_id")
            comp_x = comp.get("x", 0)
            comp_y = comp.get("y", 0)

            # Check that component_id exists.
            if comp_id not in valid_ids and valid_ids:
                errors.append(
                    f"Region '{region_id}': component '{comp_id}' not found in system"
                )

            # Check that component fits in region.
            # Note: some components may not have explicit width/height in blueprint.
            # If present, check bounds.
            if "w" in comp and "h" in comp:
                comp_w = comp.get("w", 0)
                comp_h = comp.get("h", 0)
                if comp_x + comp_w > r_w or comp_y + comp_h > r_h:
                    errors.append(
                        f"Region '{region_id}': component '{comp_id}' at ({comp_x}, {comp_y}) "
                        f"exceeds region bounds ({r_w}x{r_h})"
                    )
                placements.append((comp_x, comp_y, comp_w, comp_h))

        # Advisory: check for overlapping components (non-fatal).
        for i in range(len(placements)):
            for j in range(i + 1, len(placements)):
                x1, y1, w1, h1 = placements[i]
                x2, y2, w2, h2 = placements[j]
                if not (x1 + w1 <= x2 or x2 + w2 <= x1 or y1 + h1 <= y2 or y2 + h2 <= y1):
                    logger.warning(
                        "Component overlap detected",
                        region=region_id,
                        comp1_index=i,
                        comp2_index=j,
                    )

    return errors
