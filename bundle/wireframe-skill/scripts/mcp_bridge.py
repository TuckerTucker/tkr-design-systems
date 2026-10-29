"""MCP bridge for wireframe-skill.

A stable subprocess entry point for hosts that call the skill from another
language (tkr-kit's TypeScript MCP surface was its first caller):

    python3 mcp_bridge.py <action> <json-args>

where <json-args> is a single JSON object, or `@/abs/path.json` to read the
object from a file (large-payload indirection — blueprints with inline custom
SVG can exceed the OS argv size limit).

Contract (same as design-system-skill's bridge):
  - Exactly one compact JSON object on stdout. Nothing else.
  - Exit 0 whenever a JSON envelope was printed; success/failure is carried
    in the envelope's `ok` field.
  - Exit 2 only when argv itself is unusable.

The action handlers mirror the tool bodies of tools/mcp-server/server.py.
`generate` keeps the skill's own default (keyword routing with escalation);
pass `request_routing: true` for the inventory the MCP server returns by
default.
"""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path
from typing import Any, Callable


def _setup_paths() -> None:
    """Make wireframe_skill importable.

    The package itself puts the design_system_skill package on sys.path
    (wireframe_skill/_design_system_path.py, honoring
    $DESIGN_SYSTEM_SKILL_DIR).
    """
    here = Path(__file__).resolve().parent
    if str(here) not in sys.path:
        sys.path.insert(0, str(here))


def _emit(payload: dict[str, Any]) -> None:
    """Print exactly one compact JSON object to stdout."""
    print(json.dumps(payload, default=str))


def _parse_args_blob(blob: str) -> dict[str, Any]:
    """Parse the JSON args argv element, honoring @file indirection."""
    if blob.startswith("@"):
        blob = Path(blob[1:]).read_text()
    parsed = json.loads(blob)
    if not isinstance(parsed, dict):
        raise ValueError("args JSON must be an object")
    return parsed


_DEFAULT_OUTPUT_DIR = Path(tempfile.gettempdir()) / "tkr-wireframes"


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        _emit({"ok": False, "errors": [
            "usage: mcp_bridge.py <action> <json-args>",
        ]})
        return 2
    action = argv[1]
    try:
        args = _parse_args_blob(argv[2]) if len(argv) > 2 else {}
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        _emit({"ok": False, "errors": [f"could not parse json args: {exc}"]})
        return 2

    _setup_paths()

    # Route all skill logging to stderr before any skill import — the skills
    # log via structlog, whose unconfigured default writes to stdout.
    try:
        import structlog
        structlog.configure(
            logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
        )
    except ImportError as exc:
        _emit({"ok": False, "errors": [
            f"missing python dependency: {exc.name} — pip install structlog pyyaml",
        ]})
        return 0

    try:
        # wireframe_skill first: importing it puts design_system_skill on sys.path.
        from wireframe_skill import (
            wireframe,
            build_substitution_request,
            validate_substitutions,
            apply_substitutions,
            validate_blueprint,
            assemble_blueprint,
            export_tokens_for_authoring,
            read_component,
            read_components_batch,
            build_layout_selection_request,
            apply_layout_selection,
        )
        from design_system_skill import load_system
        from wireframe_skill.substitution import extract_text_nodes
        from wireframe_skill.decomposition import build_decomposition_request
        from wireframe_skill.emit import emit_artifact
    except ImportError as exc:
        _emit({"ok": False, "errors": [
            f"missing python dependency or skill package: {exc} — "
            f"pip install structlog pyyaml; check DESIGN_SYSTEM_SKILL_DIR",
        ]})
        return 0

    def _load_spec(system_id: str) -> tuple[dict | None, dict | None]:
        """Load a system spec; return (spec, error_envelope)."""
        sys_result = load_system(system_id)
        if not sys_result.ok:
            return None, {
                "ok": False,
                "errors": [e.message for e in sys_result.errors],
            }
        return sys_result.data, None

    def _generate(a: dict[str, Any]) -> dict[str, Any]:
        target_dir = Path(a["output_dir"]) if a.get("output_dir") else _DEFAULT_OUTPUT_DIR
        target_dir.mkdir(parents=True, exist_ok=True)
        result = wireframe(
            a["brief"],
            platform=a.get("platform", "desktop"),
            system=a.get("system_id"),
            output_dir=target_dir,
            filename_stem=a.get("filename_stem", "wireframe"),
            layout_id=a.get("layout_id"),
            request_routing=bool(a.get("request_routing", False)),
            substitute=bool(a.get("substitute", False)),
            compose=bool(a.get("compose", False)),
        )
        return result.to_dict()

    def _select_layout(a: dict[str, Any]) -> dict[str, Any]:
        spec, err = _load_spec(a["system_id"])
        if err:
            return err
        platform = a.get("platform", "desktop")
        request = build_layout_selection_request(a["brief"], spec, platform)
        request["ok"] = True
        library_root = Path(spec["_meta"]["library_root"])
        if (library_root / "components").exists():
            try:
                decomp = build_decomposition_request(a["brief"], spec, platform=platform)
                request["available_components"] = decomp["components"]
            except (ValueError, ImportError):
                request["available_components"] = []
        else:
            request["available_components"] = []
        return request

    def _substitution_request(a: dict[str, Any]) -> dict[str, Any]:
        spec, err = _load_spec(a["system_id"])
        if err:
            return err
        platform = a.get("platform", "desktop")
        layout_id = a.get("layout_id")
        if not layout_id:
            layout_req = build_layout_selection_request(a["brief"], spec, platform)
            return {
                "ok": False,
                "errors": [
                    "layout_id is required. Use the select_layout action to "
                    "browse available patterns, then pass layout_id.",
                ],
                "available_patterns": layout_req.get("available_patterns", []),
            }
        selection = apply_layout_selection(
            {"selected_pattern_id": layout_id, "rationale": "explicit layout_id"},
            spec, platform,
        )
        if selection is None:
            return {
                "ok": False,
                "errors": [
                    f"layout_id '{layout_id}' not found in system "
                    f"'{a['system_id']}'.",
                ],
            }
        request = build_substitution_request(a["brief"], spec, selection.svg_path)
        request["ok"] = True
        request["selected_pattern"] = {
            "pattern_id": selection.pattern_id,
            "svg_path": str(selection.svg_path),
            "rationale": selection.rationale,
        }
        return request

    def _apply_substitutions(a: dict[str, Any]) -> dict[str, Any]:
        svg_text = Path(a["svg_path"]).read_text()
        subs = a["substitutions"]

        grammar_warnings: list[str] = []
        if a.get("system_id"):
            spec, err = _load_spec(a["system_id"])
            if spec is not None:
                # Pass text_nodes so width-budget warnings are included.
                grammar_warnings = validate_substitutions(
                    subs, spec, extract_text_nodes(svg_text),
                )

        modified_svg, unapplied = apply_substitutions(svg_text, subs)

        result: dict[str, Any] = {
            "ok": True,
            "unapplied_finds": unapplied,
            "grammar_warnings": grammar_warnings,
        }
        output_path = a.get("output_path")
        if output_path:
            out = Path(output_path)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(modified_svg)
            result["svg_path"] = str(out)
        else:
            result["svg_text"] = modified_svg
        return result

    def _assemble_blueprint(a: dict[str, Any]) -> dict[str, Any]:
        spec, err = _load_spec(a["system_id"])
        if err:
            return {
                "ok": False,
                "svg_text": None,
                "validation_errors": err["errors"],
                "warnings": [],
            }
        blueprint = a["blueprint"]

        validation_errors = validate_blueprint(blueprint, spec)
        if validation_errors:
            return {
                "ok": False,
                "svg_text": None,
                "validation_errors": validation_errors,
                "warnings": [],
            }

        svg_text, warnings = assemble_blueprint(blueprint, spec)
        result: dict[str, Any] = {
            "ok": True,
            "validation_errors": [],
            "warnings": warnings,
        }

        output_dir = a.get("output_dir")
        if output_dir:
            components_used = []
            for region in blueprint.get("regions", []):
                for comp in region.get("components", []):
                    comp_id = comp.get("component_id")
                    comp_type = comp.get("type", "library")
                    if comp_id or comp_type == "custom":
                        entry: dict[str, Any] = {
                            "id": comp_id or "custom",
                            "region": region.get("id", "unknown"),
                            "x": comp.get("x", 0),
                            "y": comp.get("y", 0),
                            "type": comp_type,
                        }
                        if comp_type == "custom":
                            entry["svg_length"] = len(comp.get("svg", ""))
                        components_used.append(entry)
            canvas = blueprint.get("canvas", {})
            svg_path, spec_path = emit_artifact(
                Path(output_dir),
                svg_text,
                brief=a.get("brief", "assembled from blueprint"),
                platform=a.get("platform", "desktop"),
                spec=spec,
                selection=None,
                compliance=None,
                width=canvas.get("width", 1280),
                height=canvas.get("height", 800),
                filename_stem=a.get("filename_stem", "wireframe"),
                components_used=components_used,
            )
            result["svg_path"] = str(svg_path)
            result["spec_path"] = str(spec_path)
            result["components_used"] = components_used
        else:
            result["svg_text"] = svg_text
        return result

    def _tokens(a: dict[str, Any]) -> dict[str, Any]:
        spec, err = _load_spec(a["system_id"])
        if err:
            return err
        tokens = export_tokens_for_authoring(spec)
        tokens["ok"] = True
        return tokens

    def _read_component(a: dict[str, Any]) -> dict[str, Any]:
        spec, err = _load_spec(a["system_id"])
        if err:
            return err
        if a.get("component_ids"):
            return {
                "ok": True,
                "components": read_components_batch(a["component_ids"], spec),
            }
        if a.get("component_id"):
            return read_component(a["component_id"], spec)
        return {
            "ok": False,
            "errors": ["Provide component_id (single) or component_ids (list)."],
        }

    actions: dict[str, Callable[[dict[str, Any]], dict[str, Any]]] = {
        "generate": _generate,
        "select_layout": _select_layout,
        "substitution_request": _substitution_request,
        "apply_substitutions": _apply_substitutions,
        "assemble_blueprint": _assemble_blueprint,
        "tokens": _tokens,
        "read_component": _read_component,
    }

    handler = actions.get(action)
    if handler is None:
        _emit({"ok": False, "errors": [
            f"unknown action '{action}'. Available: {sorted(actions)}",
        ]})
        return 0

    try:
        _emit(handler(args))
    except KeyError as exc:
        _emit({"ok": False, "errors": [f"missing required arg: {exc}"]})
    except (ValueError, FileNotFoundError) as exc:
        _emit({"ok": False, "errors": [str(exc)]})
    except Exception as exc:  # noqa: BLE001 — envelope carries the error
        _emit({"ok": False, "errors": [str(exc)]})
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
