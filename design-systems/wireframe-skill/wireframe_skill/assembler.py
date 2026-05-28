"""Blueprint assembly into composited SVG (two-pass architecture, Pass 2).

This module takes a validated blueprint (component layout specification)
and assembles it into a single composited SVG by:
  1. Reading each referenced component SVG.
  2. Extracting and deduplicating <defs> blocks (handling ID collisions).
  3. Building the output SVG with proper transform-based positioning.
  4. Applying system-level artifact treatments (grain, backgrounds, etc).

All operations are string-based using regex; no new XML dependencies.
"""

from __future__ import annotations
import re
from pathlib import Path

import structlog

logger = structlog.get_logger(__name__)


def assemble_blueprint(blueprint: dict, spec: dict) -> tuple[str, list[str]]:
    """Assemble a blueprint into a single composited SVG.

    Reads each component referenced in the blueprint, merges their
    <defs>, and positions them using <g transform="translate(x, y)">.
    Applies system-level artifact treatments afterward.

    Args:
        blueprint: Blueprint dict with regions, components, canvas size.
        spec: Loaded system spec dict (for library_root and artifact_treatments).

    Returns:
        Tuple of (svg_text, list_of_warnings). The SVG is string-based and
        valid XML.
    """
    warnings = []

    # Extract canvas size from blueprint.
    canvas = blueprint.get("canvas", {})
    canvas_w = canvas.get("width", 1280)
    canvas_h = canvas.get("height", 800)

    # Initialize output SVG structure.
    defs_blocks = []  # Collect all <defs> content.
    body_elements = []  # Collect all positioned components.

    # Build mapping of component_id → SVG content.
    library_root = spec.get("_meta", {}).get("library_root")
    if not library_root:
        warnings.append("No library_root in spec; cannot load components")
        return _build_empty_svg(canvas_w, canvas_h), warnings

    library_path = Path(library_root).resolve()
    components_dir = library_path / "components"

    # Process each region.
    regions = blueprint.get("regions", [])
    for region in regions:
        region_id = region.get("id", "unnamed")
        region_x = region.get("x", 0)
        region_y = region.get("y", 0)

        # Process each component in this region.
        components = region.get("components", [])
        for comp_idx, comp in enumerate(components):
            comp_id = comp.get("component_id")
            comp_x = comp.get("x", 0)
            comp_y = comp.get("y", 0)

            if not comp_id:
                warnings.append(f"Region '{region_id}': component missing component_id")
                continue

            # Load component SVG.
            comp_path = components_dir / f"{comp_id}.svg"
            if not comp_path.exists():
                warnings.append(f"Component not found: {comp_id} at {comp_path}")
                continue

            try:
                comp_svg = comp_path.read_text()
            except Exception as e:
                warnings.append(f"Failed to read component {comp_id}: {e}")
                continue

            # Extract <defs> block.
            defs_content = _extract_defs_block(comp_svg)
            if defs_content:
                defs_blocks.append((comp_id, defs_content))

            # Extract body content (everything outside <defs> and <svg> tags).
            body_content = _extract_body_content(comp_svg)

            # Build positioned group.
            # Position at (region_x + comp_x, region_y + comp_y).
            abs_x = region_x + comp_x
            abs_y = region_y + comp_y

            # Wrap in group with transform.
            group = f'<g id="{region_id}__{comp_id}_{comp_idx}" transform="translate({abs_x}, {abs_y})">\n'
            group += body_content
            group += '\n</g>\n'

            body_elements.append(group)

    # Merge <defs> blocks, handling ID collisions.
    merged_defs = _merge_defs_blocks(defs_blocks, warnings)

    # Build output SVG.
    svg_parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {canvas_w} {canvas_h}">',
    ]

    if merged_defs:
        svg_parts.append(f'<defs>\n{merged_defs}\n</defs>')

    svg_parts.extend(body_elements)

    svg_parts.append('</svg>')

    result_svg = '\n'.join(svg_parts)

    # Apply artifact treatments (e.g., Riso grain, page background).
    from .compose import apply_artifact_treatments
    result_svg = apply_artifact_treatments(result_svg, spec)

    return result_svg, warnings


def _extract_defs_block(svg_text: str) -> str:
    """Extract the content inside <defs>...</defs>.

    Returns the content (without the <defs> tags) or empty string if not found.

    Args:
        svg_text: SVG content as string.

    Returns:
        Content between <defs> and </defs>, or empty string.
    """
    m = re.search(r'<defs>(.*?)</defs>', svg_text, re.DOTALL)
    if m:
        return m.group(1)
    return ""


def _extract_body_content(svg_text: str) -> str:
    """Extract SVG body content (everything except <svg> and <defs> tags).

    Removes outer <svg> wrapper and <defs> blocks, returning the
    middle content (shapes, groups, etc).

    Args:
        svg_text: Full SVG content as string.

    Returns:
        SVG body content as string.
    """
    # Remove <defs>...</defs> blocks.
    body = re.sub(r'<defs>.*?</defs>', '', svg_text, flags=re.DOTALL)

    # Remove <svg ...> opening tag.
    body = re.sub(r'<svg[^>]*>', '', body)

    # Remove </svg> closing tag.
    body = re.sub(r'</svg>', '', body)

    return body.strip()


def _merge_defs_blocks(defs_blocks: list[tuple[str, str]], warnings: list[str]) -> str:
    """Merge multiple <defs> content blocks, renaming ID collisions.

    When two components define the same filter/style/gradient ID, renames
    the second (and subsequent) occurrences by appending -1, -2, etc.
    Also updates references (url(#id), filter="..." attributes) to match.

    Args:
        defs_blocks: List of (component_id, defs_content) tuples.
        warnings: List to append collision warnings to.

    Returns:
        Merged defs content as string (without <defs> tags).
    """
    if not defs_blocks:
        return ""

    # Collect all defs content in order, with rename tracking.
    merged_content = []
    id_renames = {}  # Maps (original_comp_id, original_id) -> new_id

    for comp_id, defs_content in defs_blocks:
        # Extract all IDs from this defs block.
        id_pattern = re.compile(r'\bid="([^"]+)"')
        local_ids = {m.group(1) for m in id_pattern.finditer(defs_content)}

        # Check for collisions with previously collected IDs.
        content_to_add = defs_content
        for original_id in local_ids:
            # Check if this ID already exists in merged content.
            if re.search(rf'\bid="{re.escape(original_id)}"', '\n'.join(merged_content)):
                # Collision detected: rename this ID.
                counter = 1
                new_id = f"{original_id}-{counter}"
                while re.search(rf'\bid="{re.escape(new_id)}"', '\n'.join(merged_content)):
                    counter += 1
                    new_id = f"{original_id}-{counter}"

                # Rename in content.
                content_to_add = re.sub(
                    rf'\bid="{re.escape(original_id)}"',
                    f'id="{new_id}"',
                    content_to_add,
                )

                # Update url() references.
                content_to_add = re.sub(
                    rf'url\(#{re.escape(original_id)}\)',
                    f'url(#{new_id})',
                    content_to_add,
                )

                # Update filter="..." references.
                content_to_add = re.sub(
                    rf'filter="#{re.escape(original_id)}"',
                    f'filter="#{new_id}"',
                    content_to_add,
                )

                id_renames[(comp_id, original_id)] = new_id
                warnings.append(
                    f"ID collision: component '{comp_id}' ID '{original_id}' renamed to '{new_id}'"
                )

        merged_content.append(content_to_add)

    return '\n'.join(merged_content)


def _build_empty_svg(width: int, height: int) -> str:
    """Build a minimal empty SVG (fallback).

    Args:
        width: Canvas width.
        height: Canvas height.

    Returns:
        SVG string with just a root element and viewBox.
    """
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}"></svg>'
