"""SVG composition + content substitution.

The deterministic shell composes by reading the chosen pattern SVG and
applying any content substitutions returned by placement. For now,
substitutions are a no-op (see placement.derive_content_substitutions),
so this module is mostly a passthrough — but it owns the place where
size handling and (future) artifact-level treatments will live.
"""

from __future__ import annotations
from pathlib import Path
import re

from .placement import LayoutSelection, ContentSubstitution

import structlog

logger = structlog.get_logger(__name__)


# Standard wireframe-skill canvas sizes per platform.
PLATFORM_DIMENSIONS = {
    "mobile":  (375, 812),
    "desktop": (1280, 800),
}


def compose_svg(
    selection: LayoutSelection,
    substitutions: list[ContentSubstitution],
    platform: str,
) -> tuple[str, int, int]:
    """Read pattern SVG, apply substitutions, return (svg_text, width, height).

    Width/height come from the pattern's viewBox (patterns are authored
    at platform-correct dimensions: mobile 375w, desktop 1280w). Resizing
    logic for future re-canvas workflows (e.g. embed pattern in larger
    canvas) lives here.

    Args:
        selection: LayoutSelection with svg_path.
        substitutions: List of ContentSubstitution objects to apply.
        platform: "mobile" or "desktop" (for reference only).

    Returns:
        Tuple of (svg_text, width, height).

    Raises:
        FileNotFoundError: If pattern SVG not found at selection.svg_path.
    """
    if not selection.svg_path.exists():
        raise FileNotFoundError(f"Pattern SVG not found: {selection.svg_path}")
    svg_text = selection.svg_path.read_text()

    for sub in substitutions:
        svg_text = svg_text.replace(sub.find, sub.replace)

    width, height = _extract_viewbox_dimensions(svg_text)
    return svg_text, width, height


def _extract_viewbox_dimensions(svg_text: str) -> tuple[int, int]:
    """Extract viewBox dimensions from SVG text.

    Args:
        svg_text: SVG content as string.

    Returns:
        Tuple of (width, height). Defaults to desktop canvas if not parseable.
    """
    m = re.search(r'viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"', svg_text)
    if m:
        return int(float(m.group(1))), int(float(m.group(2)))
    return PLATFORM_DIMENSIONS["desktop"]


def apply_artifact_treatments(svg_text: str, spec: dict) -> str:
    """Apply system-level artifact treatments to SVG.

    No-op for systems without artifact_treatments block (Swiss, Editorial,
    Sketch, Prism, Revolt). For Riso-class systems, applies grain overlay +
    paper background by layer:
    - layer=bottom: page background fill (prepended to body)
    - layer=per_component: documented in comment (not applied; optional)
    - layer=top: filter overlay (appended to body)

    Args:
        svg_text: SVG content as string.
        spec: Loaded system spec dict.

    Returns:
        SVG with treatments applied.
    """
    treatments = spec.get("artifact_treatments")
    if not treatments:
        return svg_text

    filter_library = spec.get("filter_library", [])
    tokens = spec.get("tokens", {})

    # Step 1: inject filter library defs.
    svg_text = _inject_filter_defs(svg_text, filter_library)

    # Step 2: apply layer=bottom treatments.
    for treatment in treatments:
        if isinstance(treatment, dict) and treatment.get("layer") == "bottom":
            svg_text = _apply_bottom_treatment(svg_text, treatment, spec)

    # Step 3: document layer=per_component treatments (no mutation for now).
    # Insert the comment immediately AFTER the opening <svg ...> tag so it
    # lives inside the root, not inside the opening tag itself.
    per_component_treatments = [
        t.get("id", "") for t in treatments
        if isinstance(t, dict) and t.get("layer") == "per_component"
    ]
    if per_component_treatments:
        ids_str = ", ".join(per_component_treatments)
        comment = f"\n  <!-- per_component treatments pending: {ids_str} -->"
        svg_open = re.search(r'<svg\s[^>]*>', svg_text)
        if svg_open:
            insert_pos = svg_open.end()
            svg_text = svg_text[:insert_pos] + comment + svg_text[insert_pos:]

    # Step 4: apply layer=top treatments.
    for treatment in treatments:
        if isinstance(treatment, dict) and treatment.get("layer") == "top":
            svg_text = _apply_top_treatment(svg_text, treatment)

    return svg_text


def _resolve_ref(value: str | dict | list, spec: dict) -> str:
    """Resolve ref:tokens.colors.page_bg style references.

    Args:
        value: A value that may be a ref string (e.g. "ref:tokens.colors.page_bg")
               or a direct value (e.g. "#F4EDD9").
        spec: Loaded system spec dict for token resolution.

    Returns:
        Resolved string value, or the input unchanged if not a ref.
    """
    if not isinstance(value, str) or not value.startswith("ref:"):
        return value

    path = value[4:]  # strip "ref:" prefix
    parts = path.split(".")
    current = spec
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return value  # path invalid; return original
    return str(current) if current is not None else value


def _inject_filter_defs(svg_text: str, filter_library: list) -> str:
    """Inject filter library defs into SVG <defs> block.

    If no <defs> block exists, creates one as the first child of root <svg>.
    Deduplicates by filter id.

    Args:
        svg_text: SVG content as string.
        filter_library: List of filter dicts with id and svg_defs.

    Returns:
        SVG with filter defs injected.
    """
    if not filter_library:
        return svg_text

    # Extract existing filter ids to avoid duplicates.
    existing_ids = set(re.findall(r'<filter\s+id="([^"]+)"', svg_text))

    # Collect new filter defs that aren't already present.
    new_defs = []
    for filt in filter_library:
        if isinstance(filt, dict):
            filt_id = filt.get("id", "")
            svg_defs = filt.get("svg_defs", "").strip()
            if filt_id and svg_defs and filt_id not in existing_ids:
                new_defs.append(svg_defs)

    if not new_defs:
        return svg_text

    defs_content = "\n    ".join(new_defs)

    # Check if <defs> block exists.
    if "<defs>" in svg_text:
        # Inject before </defs>.
        return svg_text.replace("</defs>", f"    {defs_content}\n  </defs>", 1)
    else:
        # Create <defs> as first child of <svg>, before any other content.
        # Insert after the opening <svg ...> tag.
        svg_open = re.search(r'<svg\s[^>]*>', svg_text)
        if svg_open:
            insert_pos = svg_open.end()
            defs_block = f"\n  <defs>\n    {defs_content}\n  </defs>"
            return svg_text[:insert_pos] + defs_block + svg_text[insert_pos:]
    return svg_text


def _apply_bottom_treatment(svg_text: str, treatment: dict, spec: dict) -> str:
    """Apply a layer=bottom treatment (e.g. page background fill).

    Args:
        svg_text: SVG content as string.
        treatment: Treatment dict with type, fill, etc.
        spec: Full spec dict for ref resolution.

    Returns:
        SVG with bottom treatment prepended to body.
    """
    if treatment.get("type") != "fill":
        return svg_text

    fill_value = _resolve_ref(treatment.get("fill", ""), spec)
    if not fill_value:
        return svg_text

    # Create a rect that covers the entire viewBox.
    rect = f'  <rect width="100%" height="100%" fill="{fill_value}"/>\n'

    # Insert as first non-defs child after <svg> and any <defs>.
    # Find the first element after <defs> (if it exists).
    defs_close = svg_text.find("</defs>")
    if defs_close != -1:
        insert_pos = defs_close + len("</defs>")
        # Skip whitespace/newlines.
        while insert_pos < len(svg_text) and svg_text[insert_pos] in "\n\r\t ":
            insert_pos += 1
    else:
        # No <defs>; find the first element after <svg ...>.
        svg_close = re.search(r'<svg\s[^>]*>', svg_text)
        if svg_close:
            insert_pos = svg_close.end()
        else:
            return svg_text

    return svg_text[:insert_pos] + rect + svg_text[insert_pos:]


def _apply_top_treatment(svg_text: str, treatment: dict) -> str:
    """Apply a layer=top treatment (e.g. filter overlay).

    Args:
        svg_text: SVG content as string.
        treatment: Treatment dict with type, filter_ref, etc.

    Returns:
        SVG with top treatment appended before </svg>.
    """
    if treatment.get("type") != "filter_overlay":
        return svg_text

    filter_ref = treatment.get("filter_ref", "")
    opacity = treatment.get("opacity", 1.0)
    if not filter_ref:
        return svg_text

    rect = f'  <rect width="100%" height="100%" filter="url(#{filter_ref})" opacity="{opacity}"/>\n'
    return svg_text.replace("</svg>", f"{rect}</svg>", 1)
