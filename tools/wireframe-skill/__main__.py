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
    """Legacy flat-arg interface (wireframe --brief ... --system ...).

    Args:
        argv: Command-line args (without prog name).

    Returns:
        0 on success, 1 on failure.
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
    parser.add_argument("--no-escalate", action="store_true",
                        help="Disable Layer 1 escalation; preserve legacy dashboard-fallback "
                             "behavior when no keyword pattern matches.")
    parser.add_argument("--layout-id", default=None,
                        help="Explicit layout pattern id (bypasses keyword routing). "
                             "Pair with --request-routing responses.")
    parser.add_argument("--request-routing", action="store_true",
                        help="Skip heuristic routing and emit a routing_request "
                             "inventory (available patterns + components) for the "
                             "calling agent to choose from.")
    parser.add_argument("--compose", action="store_true",
                        help="Skip pattern selection and emit a decomposition_request "
                             "for blueprint-based assembly (see apply-decomposition).")
    args = parser.parse_args(argv)

    result = wireframe(
        brief=args.brief,
        system=args.system,
        platform=args.platform,
        output_dir=args.out,
        spec_version=args.spec_version,
        filename_stem=args.filename,
        escalate=not args.no_escalate,
        layout_id=args.layout_id,
        request_routing=args.request_routing,
        compose=args.compose,
    )

    if result.requires_orchestrator_pass:
        import sys as _sys
        msg = (
            "wireframe-skill: brief requires component decomposition "
            "(no pattern matched and brief nouns are off-catalog).\n"
            f"  reason: {result.escalation_reason}\n"
            "  next step: run `/wireframe-compose` (the L3 orchestrator command) "
            "which handles the two-pass decomposition flow.\n"
            "  to preserve legacy behavior on this brief, re-run with --no-escalate."
        )
        print(msg, file=_sys.stderr)
        print(json.dumps(result.to_dict(), indent=2))
        return 2

    print(json.dumps(result.to_dict(), indent=2))
    return 0 if result.ok else 1


def _main_substitution_prompt(argv: list[str]) -> int:
    """Pass 1: emit substitution request JSON.

    Extracts text nodes from pattern SVG + grammar caveats from spec,
    writes JSON request to --out file for the calling Claude to process.

    Args:
        argv: Subcommand args (without 'substitution-prompt').

    Returns:
        0 on success, 1 on failure.
    """
    from wireframe_skill.substitution import build_substitution_request  # noqa: E402
    from design_system_skill.loader import load_system  # noqa: E402
    from wireframe_skill.placement import (  # noqa: E402
        apply_layout_selection,
        select_layout_pattern,
    )

    parser = argparse.ArgumentParser(
        prog="wireframe-skill substitution-prompt",
        description="Emit a substitution-request JSON for the calling Claude.",
    )
    parser.add_argument("--brief", required=True, help="Brief to process.")
    parser.add_argument("--system", required=True, help="Design system id (e.g. swiss).")
    parser.add_argument("--pattern", default=None,
                        help="Override: explicit pattern SVG path. If omitted, inferred from brief + system.")
    parser.add_argument("--layout-id", default=None,
                        help="Layout pattern id (from --request-routing / wf_select_layout); "
                             "wins over keyword inference.")
    parser.add_argument("--platform", choices=["mobile", "desktop"], default="desktop")
    parser.add_argument("--out", required=True, help="Output JSON file path.")
    args = parser.parse_args(argv)

    try:
        # Load spec.
        result = load_system(args.system)
        if not result.ok:
            print(json.dumps({"ok": False, "errors": [str(e) for e in (result.errors or [])]}))
            return 1
        spec = result.data

        # Determine pattern path.
        if args.pattern:
            pattern_path = Path(args.pattern).resolve()
        elif args.layout_id:
            selection = apply_layout_selection(
                {"selected_pattern_id": args.layout_id, "rationale": "CLI --layout-id"},
                spec, args.platform,
            )
            if selection is None:
                print(json.dumps({
                    "ok": False,
                    "errors": [f"layout_id '{args.layout_id}' not found in system '{args.system}'."],
                }))
                return 1
            pattern_path = selection.svg_path
        else:
            # Substitution needs a pattern to rewrite, so an off-catalog brief
            # falls back to the stock pattern here instead of escalating.
            selection = select_layout_pattern(args.brief, spec, platform=args.platform,
                                              escalate=False)
            if selection is None:
                print(json.dumps({"ok": False, "errors": [f"No pattern found for brief in system {args.system}"]}))
                return 1
            pattern_path = selection.svg_path

        # Build request.
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
        extract_text_nodes,
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

        # Extract text nodes once (carries width budgets for overflow check).
        text_nodes = extract_text_nodes(svg_text)

        # Validate if system provided. Pass text_nodes so overflow warnings
        # surface alongside grammar warnings.
        warnings = []
        if args.system:
            result = load_system(args.system)
            if result.ok:
                warnings = validate_substitutions(subs, result.data, text_nodes)

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
            print(json.dumps({"ok": False, "errors": [str(e) for e in (result.errors or [])]}))
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
            print(json.dumps({"ok": False, "errors": [str(e) for e in (result.errors or [])]}))
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


def _main_solve_layout(argv: list[str]) -> int:
    """Pass 1.5: solve a layout tree into a blueprint.

    Takes the layout TREE authored in pass 1 — containers, components, and
    token-named spacing, with no coordinates — and resolves it into positioned
    regions through `design.solve_layout`. The blueprint it writes is the same
    shape `apply-decomposition` already consumes, so the two compose without
    either knowing about the other.

    Refuses by default when the solved layout does not fit its artboard: a
    blueprint that renders off-canvas is exactly the silent wrongness the
    solver exists to remove. `--allow-overflow` writes it anyway.

    Args:
        argv: Subcommand args (without 'solve-layout').

    Returns:
        0 on success, 1 on failure.
    """
    from wireframe_skill.compose import PLATFORM_DIMENSIONS  # noqa: E402
    from wireframe_skill.solve import (  # noqa: E402
        describe_overflows,
        solve_layout,
        LayoutSolveFailed,
        LayoutSolveUnavailable,
    )

    parser = argparse.ArgumentParser(
        prog="wireframe-skill solve-layout",
        description="Solve a layout tree into an assembler-ready blueprint.",
    )
    parser.add_argument("--tree", required=True, help="JSON file with the layout tree (from pass 1).")
    parser.add_argument("--system", required=True, help="Registered design system id.")
    parser.add_argument("--out", required=True, help="Output blueprint JSON path.")
    parser.add_argument("--platform", default="desktop", choices=sorted(PLATFORM_DIMENSIONS),
                        help="Artboard preset. Overridden by --canvas-width/--canvas-height.")
    parser.add_argument("--canvas-width", type=int, default=None, help="Explicit artboard width.")
    parser.add_argument("--canvas-height", type=int, default=None, help="Explicit artboard height.")
    parser.add_argument("--scope", default=None, help="Token scope carried into the blueprint.")
    parser.add_argument("--project", default=None, help="Project directory the operation resolves against.")
    parser.add_argument("--allow-overflow", action="store_true",
                        help="Write the blueprint even when the layout does not fit.")
    args = parser.parse_args(argv)

    try:
        tree_path = Path(args.tree).resolve()
        if not tree_path.exists():
            print(json.dumps({"ok": False, "errors": [f"Tree not found: {args.tree}"]}))
            return 1
        tree = json.loads(tree_path.read_text())

        # Artboard dimensions live in compose.PLATFORM_DIMENSIONS, which is
        # their one home; the operation takes an explicit canvas so it never
        # restates them.
        width, height = PLATFORM_DIMENSIONS[args.platform]
        canvas = {
            "width": args.canvas_width if args.canvas_width is not None else width,
            "height": args.canvas_height if args.canvas_height is not None else height,
        }

        solution = solve_layout(tree, args.system, canvas, scope=args.scope, cwd=args.project)
        overflows = solution.get("overflows", [])
        if overflows and not args.allow_overflow:
            print(json.dumps({
                "ok": False,
                "errors": describe_overflows(overflows),
                "remedy": "adjust the tree for this artboard, or pass --allow-overflow to write it anyway.",
            }))
            return 1

        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(solution["blueprint"], indent=2))

        result: dict = {
            "ok": True,
            "output_path": str(out_path),
            "canvas": canvas,
            "regions": len(solution["blueprint"].get("regions", [])),
            "spacing": solution.get("spacing", {}),
        }
        if overflows:
            result["warnings"] = describe_overflows(overflows)
        print(json.dumps(result))
        return 0
    except (LayoutSolveUnavailable, LayoutSolveFailed) as e:
        print(json.dumps({"ok": False, "errors": [str(e)]}))
        return 1
    except Exception as e:
        print(json.dumps({"ok": False, "errors": [str(e)]}))
        return 1


def main(argv: list[str] | None = None) -> int:
    """Route to subcommand or legacy interface based on first arg.

    If argv[1] is a subcommand name (substitution-prompt, apply-substitutions,
    decompose-prompt, apply-decomposition, solve-layout), route to that handler.
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
                             "decompose-prompt", "apply-decomposition",
                             "solve-layout"]:
        if argv[0] == "substitution-prompt":
            return _main_substitution_prompt(argv[1:])
        elif argv[0] == "apply-substitutions":
            return _main_apply_substitutions(argv[1:])
        elif argv[0] == "decompose-prompt":
            return _main_decompose_prompt(argv[1:])
        elif argv[0] == "solve-layout":
            return _main_solve_layout(argv[1:])
        else:  # apply-decomposition
            return _main_apply_decomposition(argv[1:])

    # Default to legacy interface.
    return _main_legacy(argv)


def _log_to_stderr() -> None:
    """Route structlog output to stderr.

    stdout carries exactly one JSON document — the contract callers parse
    (tkr-kit's agents and commands read it) — so a log line there would
    corrupt it. structlog's default factory prints to stdout.
    """
    import structlog

    structlog.configure(logger_factory=structlog.PrintLoggerFactory(file=sys.stderr))


if __name__ == "__main__":
    _log_to_stderr()
    raise SystemExit(main())
