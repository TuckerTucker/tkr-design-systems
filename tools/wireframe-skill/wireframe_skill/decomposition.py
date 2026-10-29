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

# Phase C — atom-aware validation pulls in the design-system contract
# (importable via wireframe_skill/__init__.py).
from design_system_skill import (  # noqa: E402
    resolve_token,
    UnknownTokenError,
    CrossSystemTokenError,
    MalformedTokenRefError,
)
from .atoms import ATOM_TYPES  # noqa: E402

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
        "atom_vocabulary": _build_atom_vocabulary(spec),
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
                        {"component_id": "card-default", "x": 20, "y": 80, "w": 300, "h": 150},
                        {
                            # Custom component — inline SVG for an element the
                            # library doesn't provide. Read reference components
                            # first (read_component) to stay on-grammar.
                            "type": "custom",
                            "component_id": "custom-slider",
                            "x": 20, "y": 240,
                            "svg": (
                                "<rect x='0' y='8' width='260' height='4' "
                                "rx='2' fill='#E0E0E0'/>"
                                "<circle cx='130' cy='10' r='10' fill='#424242'/>"
                            ),
                        },
                    ],
                },
                {
                    # Atom region — used when the system catalog doesn't contain
                    # a composite for the requested element. All paint, type,
                    # spacing, and stroke values must reference tokens from
                    # `atom_vocabulary.tokens` below.
                    "id": "carousel",
                    "x": 0,
                    "y": canvas_h - 200,
                    "w": canvas_w,
                    "h": 180,
                    "atoms": [
                        {"type": "rect", "x": 0, "y": 0, "w": canvas_w, "h": 180, "fill": "$surface-inset"},
                        {"type": "text", "x": 48, "y": 48, "value": "Featured",
                         "style": "$type.headline", "fill": "$ink"},
                        {"type": "group", "x": 48, "y": 160, "atoms": [
                            {"type": "circle", "cx": 0, "cy": 0, "r": 3, "fill": "$ink-muted"},
                        ], "repeat": 5, "gap": 12, "direction": "horizontal"},
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

        # Atom regions are validated separately. A region may have EITHER
        # components OR atoms — not both. If it has neither, that's fine.
        if "atoms" in region:
            if "components" in region:
                errors.append(
                    f"Region '{region_id}' declares both 'atoms' and 'components'; "
                    f"pick one"
                )
            errors.extend(validate_atoms(region, spec, blueprint))
            continue

        # Validate each component in the region.
        components = region.get("components", [])
        placements = []  # For overlap checking.

        for comp in components:
            comp_id = comp.get("component_id")
            comp_type = comp.get("type")
            comp_x = comp.get("x", 0)
            comp_y = comp.get("y", 0)

            if comp_type == "custom":
                # Custom components carry inline SVG instead of a library id;
                # they require non-empty svg + explicit position, and skip
                # the catalog lookup.
                if not comp.get("svg", "").strip():
                    errors.append(
                        f"Region '{region_id}': custom component "
                        f"missing non-empty 'svg' field"
                    )
                if "x" not in comp:
                    errors.append(
                        f"Region '{region_id}': custom component missing 'x'"
                    )
                if "y" not in comp:
                    errors.append(
                        f"Region '{region_id}': custom component missing 'y'"
                    )
            elif comp_id not in valid_ids and valid_ids:
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



# ─── Phase C — atom vocabulary + validation ─────────────────────────


# Atom field schema: which fields each atom type requires and which are optional.
# Type tells the validator what kind of resolution to expect.
_ATOM_FIELDS = {
    "rect":              {"required": {"x": "length", "y": "length", "w": "length", "h": "length"},
                          "optional": {"fill": "color", "stroke": "color", "stroke_w": "length", "rx": "length"}},
    "text":              {"required": {"x": "length", "y": "length", "value": "string", "style": "text-style"},
                          "optional": {"fill": "color"}},
    "line":              {"required": {"x1": "length", "y1": "length", "x2": "length", "y2": "length"},
                          "optional": {"stroke": "color", "stroke_w": "length"}},
    "circle":            {"required": {"cx": "length", "cy": "length", "r": "length"},
                          "optional": {"fill": "color", "stroke": "color", "stroke_w": "length"}},
    "image_placeholder": {"required": {"x": "length", "y": "length", "w": "length", "h": "length"},
                          "optional": {"fill": "color", "stroke": "color", "stroke_w": "length"}},
    "group":             {"required": {"x": "length", "y": "length", "atoms": "list"},
                          "optional": {"repeat": "int", "gap": "length", "direction": "enum"}},
}


def _build_atom_vocabulary(spec: dict) -> dict:
    """Compose the atom_vocabulary section of a decomposition request.

    The vocabulary surfaced to the LLM lists: the six atom types with
    their field schemas, and the system's full common-token surface
    (with LLM-facing role descriptions) so the orchestrator can pick
    `$ink-muted` vs `$ink` correctly.
    """
    common = (spec.get("tokens") or {}).get("common") or {}
    # Build the token surface with role descriptions, where available.
    tokens_for_llm: dict = {}
    for category, names in common.items():
        if not isinstance(names, dict):
            continue
        cat_tokens = {}
        for name, value in names.items():
            if isinstance(value, dict):
                # text-style — surface size/family for orientation, no role descs here
                cat_tokens[name] = {"shape": "text-style", "preview": {
                    "family": value.get("family"),
                    "size": value.get("size"),
                    "weight": value.get("weight"),
                    "case": value.get("case", "mixed"),
                }}
            else:
                cat_tokens[name] = {"shape": "scalar", "value": value}
        tokens_for_llm[category] = cat_tokens
    return {
        "atom_types": list(sorted(ATOM_TYPES)),
        "fields": _ATOM_FIELDS,
        "tokens": tokens_for_llm,
        "reference_syntax": {
            "portable": "$<role> or $<namespace>.<role> — e.g. $ink, $type.headline, $space.md",
            "system":   "<system_id>:<dotted.path> — e.g. swiss:grid.columns. Only valid when blueprint scope matches.",
        },
        "rules": [
            "Atoms may only reference tokens via the syntax above; raw hex / px literals for paint+type are not portable.",
            "Numeric x/y/w/h may be raw numbers OR $space.* tokens.",
            "A region may have EITHER atoms OR components, not both.",
            "Atoms in portable blueprints may not use <system_id>:<...> refs unless scope matches.",
        ],
    }


def validate_atoms(region: dict, spec: dict, blueprint: dict) -> list[str]:
    """Validate the atoms in one region against the contract.

    Checks:
      - atom type is in the whitelist
      - all required fields are present
      - all token references resolve (raw hex / unknown tokens rejected)
      - text atoms use a style from tokens.common.typography (or system)
      - cross-system refs are rejected unless the blueprint declares
        `scope: <system_id>` matching the target

    Args:
        region: One region dict from the blueprint (with `atoms` key).
        spec: Loaded system spec.
        blueprint: Full blueprint (for scope lookup).

    Returns:
        List of error strings.
    """
    errors: list[str] = []
    region_id = region.get("id", "unnamed")
    scope = blueprint.get("scope", "portable")
    atoms = region.get("atoms")
    if not isinstance(atoms, list):
        errors.append(f"Region '{region_id}': atoms must be a list, got {type(atoms).__name__}")
        return errors

    for i, atom in enumerate(atoms):
        prefix = f"Region '{region_id}' atom #{i}"
        if not isinstance(atom, dict):
            errors.append(f"{prefix}: must be a dict")
            continue
        errors.extend(_validate_one_atom(atom, prefix, spec, scope))

    return errors


def _validate_one_atom(atom: dict, prefix: str, spec: dict, scope: str) -> list[str]:
    errors: list[str] = []
    atom_type = atom.get("type")
    if atom_type not in ATOM_TYPES:
        errors.append(
            f"{prefix}: unknown type {atom_type!r}, expected one of {sorted(ATOM_TYPES)}"
        )
        return errors

    schema = _ATOM_FIELDS[atom_type]
    for field, kind in schema["required"].items():
        if field not in atom:
            errors.append(f"{prefix}: required field '{field}' missing")
            continue
        errors.extend(_validate_field_value(atom[field], kind, prefix, field, spec, scope))
    for field, kind in schema["optional"].items():
        if field in atom:
            errors.extend(_validate_field_value(atom[field], kind, prefix, field, spec, scope))

    # Recurse into group children.
    if atom_type == "group" and isinstance(atom.get("atoms"), list):
        for j, child in enumerate(atom["atoms"]):
            errors.extend(_validate_one_atom(child, f"{prefix}.children[{j}]", spec, scope))

    return errors


def _validate_field_value(
    value, kind: str, prefix: str, field: str, spec: dict, scope: str
) -> list[str]:
    """Validate one field value against its declared kind."""
    errors: list[str] = []
    if kind == "length":
        if isinstance(value, (int, float)):
            return errors
        if isinstance(value, str):
            errors.extend(_check_token_resolves(value, spec, scope, prefix, field))
            return errors
        errors.append(f"{prefix}.{field}: must be a number or token ref, got {value!r}")
    elif kind == "color":
        if not isinstance(value, str):
            errors.append(f"{prefix}.{field}: must be a string (token ref or hex), got {value!r}")
            return errors
        if value.startswith("#"):
            errors.append(
                f"{prefix}.{field}: raw hex {value!r} not allowed in atoms; "
                f"use a $token reference instead"
            )
            return errors
        errors.extend(_check_token_resolves(value, spec, scope, prefix, field, expect="color"))
    elif kind == "text-style":
        if not isinstance(value, str):
            errors.append(f"{prefix}.{field}: must be a token ref string, got {value!r}")
            return errors
        if not (value.startswith("$type.") or (":" in value and ".typography." in value)):
            errors.append(
                f"{prefix}.{field}: text style must reference $type.* or "
                f"<sys>:typography.* (got {value!r})"
            )
            return errors
        errors.extend(_check_token_resolves(value, spec, scope, prefix, field, expect="text-style"))
    elif kind == "string":
        if not isinstance(value, str):
            errors.append(f"{prefix}.{field}: must be a string, got {value!r}")
    elif kind == "int":
        if not isinstance(value, int):
            errors.append(f"{prefix}.{field}: must be an integer, got {value!r}")
    elif kind == "list":
        if not isinstance(value, list):
            errors.append(f"{prefix}.{field}: must be a list, got {type(value).__name__}")
    elif kind == "enum":
        if not isinstance(value, str):
            errors.append(f"{prefix}.{field}: enum must be a string, got {value!r}")
    return errors


def _check_token_resolves(
    ref: str, spec: dict, scope: str, prefix: str, field: str, expect: str | None = None
) -> list[str]:
    """Verify a token reference resolves, with the expected shape."""
    try:
        resolved = resolve_token(spec, ref, scope=scope)
    except UnknownTokenError as e:
        return [f"{prefix}.{field}: {e}"]
    except CrossSystemTokenError as e:
        return [f"{prefix}.{field}: {e}"]
    except MalformedTokenRefError as e:
        return [f"{prefix}.{field}: {e}"]
    if expect == "color" and not (isinstance(resolved, str) and resolved.startswith("#")):
        return [f"{prefix}.{field}: token {ref!r} did not resolve to a color (got {resolved!r})"]
    if expect == "text-style" and not isinstance(resolved, dict):
        return [f"{prefix}.{field}: token {ref!r} did not resolve to a text-style dict (got {type(resolved).__name__})"]
    return []
