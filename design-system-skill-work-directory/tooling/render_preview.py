#!/usr/bin/env python3
"""
Canonical SVG → PNG preview renderer for tkr-kit wireframes.

WHY THIS EXISTS
===============
SVG previews need to look like what real consumers will see when they open
the SVG in Chrome (or any modern browser, or Figma). Different rasterizers
render SVG differently — most notably for letter-spacing, paint order, and
font metrics — so the choice of preview renderer determines what we trust.

We use CairoSVG (Cairo backend) because:
  - It matches Chrome's letter-spacing behavior closely. Verified against
    calibration_v2.svg in May 2026: SVG letter-spacing="1.44" on 9px Inter
    renders the same width visually in CairoSVG and Chrome.
  - It's pure Python with no system dependencies beyond the cairo lib that
    ships in most Linux/macOS environments.
  - It's stable. Cairo's SVG support has been mature for years.

We do NOT use ImageMagick (`convert` / `magick`) because:
  - It renders SVG letter-spacing significantly wider than Chrome at the
    same value. Verified May 2026: a wireframe that looks correct in Chrome
    renders with exaggerated metadata tracking in ImageMagick.
  - Using IM previews led to a "fix" being applied to a non-bug; the SVG
    output was already correct in Chrome. The wrong renderer wasted work.

We do NOT use headless Chrome here because:
  - Heavier dependency (Chromium binary, ~150MB).
  - Slower to invoke per-render.
  - Overkill when CairoSVG already matches the visual target.
  If we ever need pixel-perfect Chrome verification (e.g. for finetune eval
  scoring against Chrome-rendered references), upgrade to playwright then.

USAGE
=====
    python3 render_preview.py SOURCE.svg [DEST.png]

    or import:
    from render_preview import render
    render("dashboard.svg", "dashboard.png")
"""

import sys
from pathlib import Path

import cairosvg
import yaml


def render(src: str | Path, dst: str | Path = None,
           width: int = None, height: int = None,
           spec_path: str | Path = None) -> Path:
    """Render an SVG file to PNG using the canonical tkr-kit renderer.

    Args:
        src: Path to source SVG file.
        dst: Path to output PNG. If omitted, replaces .svg with .png in src.
        width / height: Optional output dimensions. If omitted, uses the
                        SVG's intrinsic dimensions from its viewBox or
                        width/height attributes.
        spec_path: Optional path to wireframe.spec.yaml. If provided, warns
                   if format_fitness.svg is not 'native'.

    Returns:
        The Path to the written PNG file.
    """
    src_path = Path(src)
    if not src_path.exists():
        raise FileNotFoundError(f"SVG not found: {src_path}")

    if dst is None:
        dst_path = src_path.with_suffix(".png")
    else:
        dst_path = Path(dst)

    # Check format_fitness if spec_path is provided.
    if spec_path:
        spec_path = Path(spec_path)
        if spec_path.exists():
            try:
                spec_data = yaml.safe_load(spec_path.read_text())
                system = spec_data.get("design_system", {})
                format_fitness = system.get("format_fitness", {})
                svg_fitness = format_fitness.get("svg")
                if isinstance(svg_fitness, dict):
                    level = svg_fitness.get("level")
                    if level and level != "native":
                        system_id = system.get("id", "unknown")
                        print(
                            f"WARNING: {system_id} declares format_fitness.svg={level}; "
                            f"the PNG preview is approximate — open the SVG in Chrome for "
                            f"accurate filter rendering.",
                            file=sys.stderr
                        )
            except (OSError, yaml.YAMLError):
                pass  # Silently continue if spec parsing fails.

    kwargs = {"url": str(src_path), "write_to": str(dst_path)}
    if width is not None:
        kwargs["output_width"] = width
    if height is not None:
        kwargs["output_height"] = height

    cairosvg.svg2png(**kwargs)
    return dst_path


def render_all(directory: str | Path, pattern: str = "*.svg") -> list[Path]:
    """Render every SVG matching `pattern` in `directory` to a PNG sibling.

    Useful for batch-regenerating previews after a spec or library change.
    """
    dir_path = Path(directory)
    rendered = []
    for svg in sorted(dir_path.glob(pattern)):
        # Skip the calibration files — they're meant to be opened in Chrome,
        # not previewed via raster, because the foreignObject CSS row is the
        # whole point and CairoSVG doesn't render foreignObject either.
        if "calibration" in svg.name:
            continue
        out = render(svg)
        rendered.append(out)
        print(f"  rendered  {svg.name}  ->  {out.name}")
    return rendered


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: render_preview.py SOURCE.svg [DEST.png]")
        print("       render_preview.py --all DIRECTORY")
        sys.exit(1)

    if sys.argv[1] == "--all":
        directory = sys.argv[2] if len(sys.argv) > 2 else "."
        results = render_all(directory)
        print(f"Rendered {len(results)} SVG file(s) in {directory}")
    else:
        src = sys.argv[1]
        dst = sys.argv[2] if len(sys.argv) > 2 else None
        result = render(src, dst)
        print(f"Wrote {result}")
