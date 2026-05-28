"""Component SVG source reader for reference-based authoring.

Agents use this to read how the system draws specific components — their
stroke weights, fills, radii, and sizing patterns — then draw custom
variants at whatever dimensions they need.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


def read_component(component_id: str, spec: dict) -> dict[str, Any]:
    """Read a component SVG and metadata from the system library.

    Resolves variant IDs: ``"toggle"`` resolves to ``"toggle-default"``,
    ``"button-primary"`` resolves directly.

    Args:
        component_id: Component variant id (e.g. "toggle-default" or
            "toggle" which resolves to "toggle-default").
        spec: Loaded system spec dict.

    Returns:
        Dict with ok, component_id, svg_source, viewBox, rendering_notes,
        anatomy, tier, states, constraints.

    Raises:
        ValueError: If component_id cannot be resolved.
        FileNotFoundError: If SVG file not found after resolution.
    """
    library_root = spec.get("_meta", {}).get("library_root")
    if not library_root:
        raise ValueError("No _meta.library_root in spec")

    library_path = Path(library_root).resolve()
    components_dir = library_path / "components"

    canonical_id, variant_meta, parent_meta = _resolve_component_id(
        component_id, spec, components_dir,
    )

    svg_path = components_dir / f"{canonical_id}.svg"
    if not svg_path.exists():
        raise FileNotFoundError(f"Component SVG not found: {svg_path}")

    svg_source = svg_path.read_text()
    w, h = _extract_viewbox(svg_source)

    result: dict[str, Any] = {
        "ok": True,
        "component_id": canonical_id,
        "svg_source": svg_source,
        "viewBox": {"w": w, "h": h},
        "rendering_notes": None,
        "anatomy": None,
        "tier": "unknown",
        "states": None,
        "constraints": None,
    }

    if parent_meta:
        result["anatomy"] = parent_meta.get("anatomy")
        result["tier"] = parent_meta.get("tier", "unknown")
        result["constraints"] = parent_meta.get("constraints")

    if variant_meta:
        result["rendering_notes"] = variant_meta.get("rendering_notes")
        result["states"] = variant_meta.get("states")

    return result


def read_components_batch(
    component_ids: list[str],
    spec: dict,
) -> list[dict[str, Any]]:
    """Read multiple components, collecting errors per component.

    Args:
        component_ids: List of component variant ids.
        spec: Loaded system spec dict.

    Returns:
        List where each entry is either a successful read dict or
        ``{ok: False, component_id, error}``.
    """
    results = []
    for cid in component_ids:
        try:
            results.append(read_component(cid, spec))
        except (ValueError, FileNotFoundError) as exc:
            results.append({
                "ok": False,
                "component_id": cid,
                "error": str(exc),
            })
    return results


def _resolve_component_id(
    requested_id: str,
    spec: dict,
    components_dir: Path,
) -> tuple[str, dict | None, dict | None]:
    """Resolve a requested ID to canonical variant ID and spec metadata.

    Resolution order:
      1. Direct file match: ``components_dir/{requested_id}.svg``
      2. Base name lookup: search ``spec["components"]`` for a matching
         key, then pick the default variant (or first variant).

    Args:
        requested_id: The ID the caller provided.
        spec: Loaded system spec dict.
        components_dir: Path to the system's components directory.

    Returns:
        Tuple of (canonical_id, variant_meta_dict | None, parent_meta_dict | None).

    Raises:
        ValueError: If the ID cannot be resolved to any component.
    """
    svg_path = components_dir / f"{requested_id}.svg"
    if svg_path.exists():
        variant_meta, parent_meta = _lookup_spec_metadata(requested_id, spec)
        return requested_id, variant_meta, parent_meta

    parent_meta, default_variant = _find_base_component(requested_id, spec)
    if parent_meta and default_variant:
        base_key = requested_id.replace("_", "-")
        variant_id = default_variant.get("id", "default")
        canonical = f"{base_key}-{variant_id}"

        svg_path = components_dir / f"{canonical}.svg"
        if svg_path.exists():
            return canonical, default_variant, parent_meta

    raise ValueError(
        f"Cannot resolve component '{requested_id}': no matching SVG file "
        f"or spec entry found"
    )


def _lookup_spec_metadata(
    canonical_id: str,
    spec: dict,
) -> tuple[dict | None, dict | None]:
    """Look up variant and parent metadata for a fully-qualified variant ID.

    Parses ``canonical_id`` into base name segments to find the parent
    component in the spec, then searches its variants list.

    Args:
        canonical_id: Full variant ID like "toggle-default" or "button-primary".
        spec: Loaded system spec dict.

    Returns:
        Tuple of (variant_meta, parent_meta). Either or both may be None.
    """
    components = spec.get("components", {})
    parts = canonical_id.split("-")

    for split_pos in range(1, len(parts)):
        base_key = "-".join(parts[:split_pos])
        variant_id = "-".join(parts[split_pos:])
        spec_key = base_key.replace("-", "_")

        parent = components.get(spec_key)
        if parent:
            for variant in parent.get("variants", []):
                if variant.get("id") == variant_id:
                    return variant, parent
            return None, parent

    return None, None


def _find_base_component(
    requested_id: str,
    spec: dict,
) -> tuple[dict | None, dict | None]:
    """Find a component by base name and return its default variant.

    Args:
        requested_id: Base name like "toggle", "button", "list-item".
        spec: Loaded system spec dict.

    Returns:
        Tuple of (parent_meta, default_variant_dict). Both None if not found.
    """
    components = spec.get("components", {})
    spec_key = requested_id.replace("-", "_")

    parent = components.get(spec_key)
    if not parent:
        return None, None

    variants = parent.get("variants", [])
    if not variants:
        return parent, None

    for variant in variants:
        if variant.get("id") == "default":
            return parent, variant

    return parent, variants[0]


def _extract_viewbox(svg_text: str) -> tuple[int, int]:
    """Extract viewBox width and height from SVG source.

    Args:
        svg_text: Raw SVG content.

    Returns:
        Tuple of (width, height). Defaults to (100, 100) if not found.
    """
    m = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg_text)
    if m:
        return int(float(m.group(1))), int(float(m.group(2)))
    return 100, 100
