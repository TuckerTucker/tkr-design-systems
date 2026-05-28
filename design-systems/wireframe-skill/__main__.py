"""CLI shim for wireframe-skill v3.0 with two-pass substitution support.

Usage from the project root (legacy flat args — backward compatible):

    python3 wireframe-skill --brief "dashboard for a chat app" --system swiss
    python3 wireframe-skill --brief "settings page" --system swiss --platform mobile --out ./out

Two-pass substitution workflow (new subcommands):

    Pass 1 — emit request:
    python3 wireframe-skill substitution-prompt --brief "..." --system swiss --out /tmp/req.json

    Pass 2 — apply response:
    python3 wireframe-skill apply-substitutions --pattern pattern.svg --substitutions /tmp/resp.json --out result.svg

Prints a JSON result to stdout. Exit code 0 if ok, 1 otherwise.
"""

from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path


def _setup_path() -> None:
    here = Path(__file__).resolve().parent
    if str(here) not in sys.path:
        sys.path.insert(0, str(here))


def _main_legacy(argv: list[str]) -> int:
    """Generate a wireframe SVG, or return a routing inventory.

    Without --layout-id or --compose, prints an inventory of available
    patterns and components (exit code 2). With explicit routing, generates
    the wireframe (exit code 0 on success, 1 on error).

    Args:
        argv: Command-line args (without prog name).

    Returns:
        0 on success, 1 on failure, 2 when routing decision is needed.
    """
    from wireframe_skill import wireframe  # noqa: E402

    parser = argparse.ArgumentParser(
        prog="wireframe-skill",
        description="Generate a wireframe SVG + spec.yaml from a brief.",
    )
    parser.add_argument("--brief", required=True, help="What to wireframe.")
    parser.add_argument("--system", default=None,
                        help="Design system id (e.g. swiss). Omit for the neutral wireframe library.")
    parser.add_argument("--platform", choices=["mobile", "desktop"], default="desktop")
    parser.add_argument("--out", default=".", help="Output directory.")
    parser.add_argument("--filename", default="wireframe",
                        help="Filename stem for outputs (default: wireframe).")
    parser.add_argument("--spec-version", default=None,
                        help="Pin to a specific spec_version (currently informational).")
    parser.add_argument("--layout-id", default=None,
                        help="Explicit layout pattern id (from wf_select_layout).")
    parser.add_argument("--compose", action="store_true",
                        help="Use component decomposition path instead of a pattern.")
    args = parser.parse_args(argv)

    result = wireframe(
        brief=args.brief,
        system=args.system,
        platform=args.platform,
        output_dir=args.out,
        spec_version=args.spec_version,
        filename_stem=args.filename,
        layout_id=args.layout_id,
        compose=args.compose,
    )

    if result.routing_request is not None:
        print(json.dumps({
            "ok": True,
            "routing_required": True,
            "routing_request": result.routing_request,
            "hint": (
                "Rerun with --layout-id <pattern_id> or --compose to proceed. "
                "Available patterns are listed in routing_request.available_patterns."
            ),
        }, indent=2))
        return 2

    print(json.dumps(result.to_dict(), indent=2))
    return 0 if result.ok else 1


def _main_substitution_prompt(argv: list[str]) -> int:
    """Pass 1: emit substitution request JSON.

    Extracts text nodes from pattern SVG + grammar caveats from spec,
    writes JSON request to --out file for the calling Claude to process.
    Requires either --pattern (explicit SVG path) or --layout-id.

    Args:
        argv: Subcommand args (without 'substitution-prompt').

    Returns:
        0 on success, 1 on failure.
    """
    from wireframe_skill.substitution import build_substitution_request  # noqa: E402
    from design_system_skill.loader import load_system  # noqa: E402
    from wireframe_skill.placement import apply_layout_selection  # noqa: E402

    parser = argparse.ArgumentParser(
        prog="wireframe-skill substitution-prompt",
        description="Emit a substitution-request JSON for the calling Claude.",
    )
    parser.add_argument("--brief", required=True, help="Brief to process.")
    parser.add_argument("--system", required=True, help="Design system id (e.g. swiss).")
    parser.add_argument("--pattern", default=None,
                        help="Override: explicit pattern SVG path.")
    parser.add_argument("--layout-id", default=None,
                        help="Layout pattern id (use wf_select_layout to browse).")
    parser.add_argument("--out", required=True, help="Output JSON file path.")
    args = parser.parse_args(argv)

    try:
        result = load_system(args.system)
        if not result.ok:
            print(json.dumps({"ok": False, "errors": result.errors}))
            return 1
        spec = result.data

        if args.pattern:
            pattern_path = Path(args.pattern).resolve()
        elif args.layout_id:
            selection = apply_layout_selection(
                {"selected_pattern_id": args.layout_id, "rationale": "CLI --layout-id"},
                spec, "desktop",
            )
            if selection is None:
                print(json.dumps({
                    "ok": False,
                    "errors": [f"layout_id '{args.layout_id}' not found in system '{args.system}'."],
                }))
                return 1
            pattern_path = selection.svg_path
        else:
            print(json.dumps({
                "ok": False,
                "errors": ["Provide --pattern or --layout-id. Use wf_select_layout to browse available patterns."],
            }))
            return 1

        request = build_substitution_request(args.brief, spec, pattern_path)
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(request, indent=2))

        print(json.dumps({"ok": True, "request_path": str(out_path)}))
        return 0
    except Exception as e:
        print(json.dumps({"ok": False, "errors": [str(e)]}))
        return 1


def _main_apply_substitutions(argv: list[str]) -> int:
    """Pass 2: apply substitution response JSON to pattern SVG.

    Reads the response JSON from Pass 1 (with substitutions list),
    validates against grammar rules, applies find/replace edits to the
    SVG, and writes the result.

    Args:
        argv: Subcommand args (without 'apply-substitutions').

    Returns:
        0 on success, 1 on failure.
    """
    from wireframe_skill.substitution import (  # noqa: E402
        apply_substitutions,
        validate_substitutions,
    )
    from design_system_skill.loader import load_system  # noqa: E402

    parser = argparse.ArgumentParser(
        prog="wireframe-skill apply-substitutions",
        description="Apply substitution response JSON to pattern SVG.",
    )
    parser.add_argument("--pattern", required=True, help="Input pattern SVG path.")
    parser.add_argument("--substitutions", required=True,
                        help="JSON file with substitutions list (from Claude pass 1).")
    parser.add_argument("--out", required=True, help="Output SVG file path.")
    parser.add_argument("--system", default=None,
                        help="Design system id. If omitted, no grammar validation.")
    args = parser.parse_args(argv)

    try:
        pattern_path = Path(args.pattern).resolve()
        if not pattern_path.exists():
            print(json.dumps({"ok": False, "errors": [f"Pattern not found: {args.pattern}"]}))
            return 1

        subs_path = Path(args.substitutions).resolve()
        if not subs_path.exists():
            print(json.dumps({"ok": False, "errors": [f"Substitutions not found: {args.substitutions}"]}))
            return 1

        # Load substitutions.
        resp = json.loads(subs_path.read_text())
        subs = resp.get("substitutions", [])

        # Load SVG.
        svg_text = pattern_path.read_text()

        # Validate if system provided.
        warnings = []
        if args.system:
            result = load_system(args.system)
            if result.ok:
                warnings = validate_substitutions(subs, result.data)

        # Apply substitutions.
        modified_svg, unapplied = apply_substitutions(svg_text, subs)

        # Write output.
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(modified_svg)

        result = {
            "ok": True,
            "output_path": str(out_path),
            "substitutions_applied": len(subs) - len(unapplied),
            "total_substitutions": len(subs),
        }
        if unapplied:
            result["unapplied_finds"] = unapplied
        if warnings:
            result["grammar_warnings"] = warnings

        print(json.dumps(result))
        return 0
    except Exception as e:
        print(json.dumps({"ok": False, "errors": [str(e)]}))
        return 1


def _main_decompose_prompt(argv: list[str]) -> int:
    """Pass 1: emit decomposition request JSON.

    Inventories all available components from the system library,
    assembles grammar caveats and canvas size, writes JSON request
    to --out file for the calling Claude to process.

    Args:
        argv: Subcommand args (without 'decompose-prompt').

    Returns:
        0 on success, 1 on failure.
    """
    from wireframe_skill.decomposition import build_decomposition_request  # noqa: E402
    from design_system_skill.loader import load_system  # noqa: E402

    parser = argparse.ArgumentParser(
        prog="wireframe-skill decompose-prompt",
        description="Emit a decomposition-request JSON for the calling Claude.",
    )
    parser.add_argument("--brief", required=True, help="Brief to process.")
    parser.add_argument("--system", required=True, help="Design system id (e.g. swiss).")
    parser.add_argument("--platform", choices=["mobile", "desktop"], default="desktop",
                        help="Canvas platform (default: desktop).")
    parser.add_argument("--out", required=True, help="Output JSON file path.")
    args = parser.parse_args(argv)

    try:
        # Load spec.
        result = load_system(args.system)
        if not result.ok:
            print(json.dumps({"ok": False, "errors": result.errors}))
            return 1
        spec = result.data

        # Build request.
        request = build_decomposition_request(args.brief, spec, platform=args.platform)
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(request, indent=2))

        print(json.dumps({"ok": True, "request_path": str(out_path)}))
        return 0
    except Exception as e:
        print(json.dumps({"ok": False, "errors": [str(e)]}))
        return 1


def _main_apply_decomposition(argv: list[str]) -> int:
    """Pass 2: apply decomposition blueprint JSON to assemble SVG.

    Reads the blueprint JSON from Pass 1 (with regions and components),
    validates against system constraints, assembles the SVG from component
    pieces, applies artifact treatments, and writes the result.

    Args:
        argv: Subcommand args (without 'apply-decomposition').

    Returns:
        0 on success, 1 on failure.
    """
    from wireframe_skill.assembler import assemble_blueprint  # noqa: E402
    from wireframe_skill.decomposition import validate_blueprint  # noqa: E402
    from design_system_skill.loader import load_system  # noqa: E402

    parser = argparse.ArgumentParser(
        prog="wireframe-skill apply-decomposition",
        description="Apply decomposition blueprint JSON to assemble SVG.",
    )
    parser.add_argument("--blueprint", required=True,
                        help="JSON file with blueprint (from Claude pass 1).")
    parser.add_argument("--system", required=True, help="Design system id.")
    parser.add_argument("--out", required=True, help="Output SVG file path.")
    args = parser.parse_args(argv)

    try:
        blueprint_path = Path(args.blueprint).resolve()
        if not blueprint_path.exists():
            print(json.dumps({"ok": False, "errors": [f"Blueprint not found: {args.blueprint}"]}))
            return 1

        # Load blueprint.
        blueprint = json.loads(blueprint_path.read_text())

        # Load system spec.
        result = load_system(args.system)
        if not result.ok:
            print(json.dumps({"ok": False, "errors": result.errors}))
            return 1
        spec = result.data

        # Validate blueprint.
        validation_errors = validate_blueprint(blueprint, spec)
        if validation_errors:
            print(json.dumps({
                "ok": False,
                "errors": validation_errors,
            }))
            return 1

        # Assemble SVG.
        svg_text, warnings = assemble_blueprint(blueprint, spec)

        # Write output.
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(svg_text)

        result = {
            "ok": True,
            "output_path": str(out_path),
        }
        if warnings:
            result["warnings"] = warnings

        print(json.dumps(result))
        return 0
    except Exception as e:
        print(json.dumps({"ok": False, "errors": [str(e)]}))
        return 1


def main(argv: list[str] | None = None) -> int:
    """Route to subcommand or legacy interface based on first arg.

    If argv[1] is a subcommand name (substitution-prompt, apply-substitutions,
    decompose-prompt, apply-decomposition), route to that handler.
    Otherwise, assume legacy flat-arg format and route to _main_legacy.

    Args:
        argv: Command-line args (without prog name). If None, uses sys.argv[1:].

    Returns:
        0 on success, 1 on failure.
    """
    _setup_path()

    if argv is None:
        argv = sys.argv[1:]

    # Check for subcommand.
    if argv and argv[0] in ["substitution-prompt", "apply-substitutions",
                             "decompose-prompt", "apply-decomposition"]:
        if argv[0] == "substitution-prompt":
            return _main_substitution_prompt(argv[1:])
        elif argv[0] == "apply-substitutions":
            return _main_apply_substitutions(argv[1:])
        elif argv[0] == "decompose-prompt":
            return _main_decompose_prompt(argv[1:])
        else:  # apply-decomposition
            return _main_apply_decomposition(argv[1:])

    # Default to legacy interface.
    return _main_legacy(argv)


if __name__ == "__main__":
    raise SystemExit(main())
