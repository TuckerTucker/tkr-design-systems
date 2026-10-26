#!/usr/bin/env python3
"""Build every design system's SVG component library and layout patterns.

Systems come from ``systems/registry.yaml`` (aliases such as ``neutral``
build their owner once); each system's templates live in
``tools/builders/engine/systems/<id>/`` and take every colour, font and
radius from ``systems/<id>/tokens.json``. After changing a token file,
re-run this script to regenerate the libraries.

Usage:
    uv run python tools/builders/build.py                    # build everything
    uv run python tools/builders/build.py --system swiss     # one system (repeatable)
    uv run python tools/builders/build.py --kind patterns    # layouts only
    uv run python tools/builders/build.py --check            # CI: exit 1 if stale
    uv run python tools/builders/build.py --png              # also refresh PNG previews

``--check`` renders in memory and writes nothing; it fails when any
committed SVG differs from a fresh render (or is missing). ``--png``
re-renders the PNG preview next to each SVG that changed, for SVGs that
already have one (previews are documentation, never checked).

Exit status: 0 on success, 1 when ``--check`` finds stale files, 2 on
invalid builder data, registry or arguments.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from engine import (  # noqa: E402
    BuilderDataError,
    RegistryError,
    build,
    discover_systems,
    load_plugin,
    load_tokens,
    select_targets,
    stale_files,
    write_files,
)
from engine.plugin import KIND_OUT_DIRS  # noqa: E402
from engine.runner import PluginLoader, TokenLoader  # noqa: E402

DEFAULT_REGISTRY = HERE.parents[1] / "systems" / "registry.yaml"


def refresh_previews(svg_paths: list[Path]) -> list[Path]:
    """Re-render existing PNG previews for the given SVGs.

    Args:
        svg_paths: SVGs that changed.

    Returns:
        The PNGs that were re-rendered.
    """
    from render_preview import render  # cairosvg is only needed here

    done = []
    for svg in svg_paths:
        png = svg.with_suffix(".png")
        if png.exists():
            render(svg, png)
            done.append(png)
    return done


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    """Parse command-line arguments."""
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    p.add_argument("--system", action="append", metavar="ID",
                   help="system id to build (repeatable; default: all)")
    p.add_argument("--kind", choices=sorted(KIND_OUT_DIRS),
                   help="build only component libraries or only layout patterns")
    p.add_argument("--check", action="store_true",
                   help="render in memory and exit 1 if a committed SVG is stale")
    p.add_argument("--png", action="store_true",
                   help="re-render existing PNG previews of changed SVGs")
    p.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY,
                   help="registry.yaml to read (default: systems/registry.yaml)")
    p.add_argument("-q", "--quiet", action="store_true", help="only print problems")
    return p.parse_args(argv)


def main(argv: list[str] | None = None, *, plugin_loader: PluginLoader = load_plugin,
         token_loader: TokenLoader = load_tokens) -> int:
    """Run the CLI.

    Args:
        argv: Arguments (default: ``sys.argv[1:]``).
        plugin_loader: ``system id -> builder module`` (injectable for tests).
        token_loader: ``target -> token document`` (injectable for tests).

    Returns:
        Process exit status.
    """
    args = parse_args(argv)
    if args.check and args.png:
        print("--check writes nothing; drop --png", file=sys.stderr)
        return 2
    try:
        targets = select_targets(discover_systems(args.registry), args.system)
        result = build(targets, [args.kind] if args.kind else None,
                       plugin_loader=plugin_loader, token_loader=token_loader)
    except (RegistryError, BuilderDataError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    say = (lambda *_: None) if args.quiet else print
    for system_id, reason in result.skipped:
        say(f"skip  {system_id}: {reason}")

    if args.check:
        stale = stale_files(result.files)
        for f, why in stale:
            print(f"stale {f.path} ({why})")
        if stale:
            print(f"{len(stale)} of {len(result.files)} SVGs are stale; "
                  f"run: uv run python tools/builders/build.py", file=sys.stderr)
            return 1
        say(f"ok    {len(result.files)} SVGs up to date")
        return 0

    changed = write_files(result.files)
    for f in changed:
        say(f"wrote {f.path}")
    say(f"{len(changed)} of {len(result.files)} SVGs changed")
    if args.png and changed:
        for png in refresh_previews([f.path for f in changed]):
            say(f"png   {png}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
