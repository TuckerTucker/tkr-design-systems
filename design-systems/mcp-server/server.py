"""tkr-design-systems MCP server.

Wraps design-system-skill and wireframe-skill as MCP tools over stdio
transport. Designed for use with Claude Code and Claude Desktop.

Run directly:
    python3 server.py

Register with Claude Code (automatic via .mcp.json at repo root, or manual):
    claude mcp add tkr-design-systems python3 -- /path/to/server.py
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


# ─── Path bootstrap ────────────────────────────────────────────────────

def _bootstrap_paths() -> None:
    """Add both skill package directories to sys.path.

    Idempotent: guards against double-insertion. Must run before any
    import of design_system_skill or wireframe_skill.
    """
    here = Path(__file__).resolve().parent
    work_dir = here.parent
    dss_dir = str(work_dir / "design-system-skill")
    wf_dir = str(work_dir / "wireframe-skill")
    for path in (dss_dir, wf_dir):
        if path not in sys.path:
            sys.path.insert(0, path)


_bootstrap_paths()

from design_system_skill import (  # noqa: E402
    load_system,
    list_systems,
    validate_spec,
    register_system,
    unregister_system,
    get_rulebook,
    check_compliance,
)
from wireframe_skill import (  # noqa: E402
    wireframe,
    build_substitution_request,
    validate_substitutions,
    apply_substitutions,
    validate_blueprint,
    assemble_blueprint,
)
from mcp.server.fastmcp import FastMCP  # noqa: E402

_DEFAULT_OUTPUT_DIR = Path(tempfile.gettempdir()) / "tkr-wireframes"

mcp = FastMCP(
    "tkr-design-systems",
    instructions=(
        "Registry, validation, and wireframe generation for tkr-kit design "
        "systems. Start with ds_list_systems to see available systems, then "
        "ds_load_system to inspect a spec, and wf_generate to produce a "
        "wireframe SVG."
    ),
)


# ─── Helpers ───────────────────────────────────────────────────────────

def _error_result(exc: Exception) -> dict[str, Any]:
    """Wrap an unexpected exception into a standard error dict."""
    return {"ok": False, "errors": [str(exc)]}


# ─── design-system-skill tools (7) ────────────────────────────────────


@mcp.tool()
def ds_list_systems() -> dict[str, Any]:
    """List all design systems registered in the tkr-kit registry.

    Returns id, name, tagline, grammar_family, version, spec_version, and
    status for each system. Use this to discover which systems are available
    before calling other tools.
    """
    try:
        return list_systems().to_dict()
    except Exception as exc:
        return _error_result(exc)


@mcp.tool()
def ds_load_system(system_id: str, validate: bool = True) -> dict[str, Any]:
    """Load and validate a design system spec by id.

    Returns the full normalized spec: tokens, components (with absolute SVG
    paths), layout templates, rulebook, grammar extensions, and _meta block.
    """
    try:
        return load_system(system_id, validate=validate).to_dict()
    except Exception as exc:
        return _error_result(exc)


@mcp.tool()
def ds_validate_spec(
    spec_path: str,
    library_root: str | None = None,
) -> dict[str, Any]:
    """Validate a spec.yaml against the schema without modifying the registry.

    Returns {valid, system_id, spec_version, errors, warnings}. Use when
    authoring a new design system spec before registering it.
    """
    try:
        return validate_spec(spec_path, library_root=library_root).to_dict()
    except Exception as exc:
        return _error_result(exc)


@mcp.tool()
def ds_register_system(
    spec_dir: str,
    replace: bool = False,
) -> dict[str, Any]:
    """Register a new design system in the registry.

    Validates spec.yaml, then adds an entry to registry.yaml. Pass the
    directory containing spec.yaml (or the path to spec.yaml itself).
    Set replace=True to overwrite an existing entry with the same id.
    """
    try:
        return register_system(spec_dir, replace=replace).to_dict()
    except Exception as exc:
        return _error_result(exc)


@mcp.tool()
def ds_unregister_system(system_id: str) -> dict[str, Any]:
    """Remove a design system from the registry.

    Files on disk are not deleted. The system becomes unavailable until
    re-registered via ds_register_system.
    """
    try:
        return unregister_system(system_id).to_dict()
    except Exception as exc:
        return _error_result(exc)


@mcp.tool()
def ds_get_rulebook(system_id: str) -> dict[str, Any]:
    """Get the flattened rulebook for a design system.

    Returns an array of rule entries with id, rule, rationale, severity,
    check_method, check_scope, applies_when, and scope. Use this to
    understand a system's constraints before generating artifacts.
    """
    try:
        return get_rulebook(system_id).to_dict()
    except Exception as exc:
        return _error_result(exc)


@mcp.tool()
def ds_check_compliance(
    system_id: str,
    artifact_path: str,
    scope: str | None = None,
) -> dict[str, Any]:
    """Check an SVG artifact against a design system's mechanical rulebook.

    Returns {passed, failed, advisory, results} where results is a list of
    {rule_id, status, detail}. Scope auto-detects from the artifact path
    (component vs artifact); pass scope explicitly to override.
    """
    try:
        return check_compliance(system_id, artifact_path, scope=scope).to_dict()
    except Exception as exc:
        return _error_result(exc)


# ─── wireframe-skill tools (4) ────────────────────────────────────────


@mcp.tool()
def wf_generate(
    brief: str,
    platform: str = "desktop",
    system: str | None = None,
    output_dir: str | None = None,
    filename_stem: str = "wireframe",
    substitute: bool = False,
    compose: bool = False,
    layout_id: str | None = None,
) -> dict[str, Any]:
    """Generate a wireframe SVG from a free-text brief.

    When neither layout_id nor compose is set, returns a routing_request
    listing available patterns and components for the agent to choose from.
    Call again with layout_id=<pattern_id> or compose=True.

    When layout_id is set, selects the named layout directly and runs the
    full 7-step flow: load system spec, compose SVG, apply artifact
    treatments, run compliance check, emit files.

    When substitute=True (requires layout_id), returns early with a
    substitution_request (text_nodes and grammar_caveats) but no svg_path.
    Call wf_apply_substitutions with the filled substitutions.

    When compose=True, skips template selection and returns a
    decomposition_request for blueprint-based assembly. Call
    wf_assemble_from_blueprint with the filled blueprint.

    With system=None, uses the neutral wireframe library.
    Output files are written to output_dir (defaults to a temp directory).
    """
    try:
        target_dir = Path(output_dir) if output_dir else _DEFAULT_OUTPUT_DIR
        target_dir.mkdir(parents=True, exist_ok=True)

        result = wireframe(
            brief,
            platform=platform,
            system=system,
            output_dir=target_dir,
            filename_stem=filename_stem,
            substitute=substitute,
            compose=compose,
            layout_id=layout_id,
        )
        return result.to_dict()
    except Exception as exc:
        return _error_result(exc)


@mcp.tool()
def wf_build_substitution_request(
    brief: str,
    system_id: str,
    platform: str = "desktop",
    layout_id: str | None = None,
) -> dict[str, Any]:
    """Build a content substitution request for a wireframe pattern.

    Pass 1 of the two-pass substitution workflow. Requires layout_id to
    identify which pattern to extract text nodes from. Use wf_select_layout
    first to browse available patterns.

    You (the calling model) process this request to produce a list of
    {find, replace, rationale} substitutions, then pass them to
    wf_apply_substitutions.

    Returns {schema_version, brief, system_id, pattern_path,
    grammar_caveats, text_nodes, response_format_example}.
    """
    try:
        sys_result = load_system(system_id)
        if not sys_result.ok:
            return {
                "ok": False,
                "errors": [e.message for e in sys_result.errors],
            }
        spec = sys_result.data

        if layout_id is not None:
            from wireframe_skill.placement import apply_layout_selection
            selection = apply_layout_selection(
                {"selected_pattern_id": layout_id, "rationale": "explicit layout_id"},
                spec, platform,
            )
            if selection is None:
                return {
                    "ok": False,
                    "errors": [
                        f"layout_id '{layout_id}' not found in system '{system_id}'."
                    ],
                }
        else:
            from wireframe_skill.placement import build_layout_selection_request
            layout_req = build_layout_selection_request(brief, spec, platform)
            return {
                "ok": False,
                "errors": [
                    "layout_id is required. Use wf_select_layout to browse "
                    "available patterns, then pass layout_id."
                ],
                "available_patterns": layout_req.get("available_patterns", []),
            }

        request = build_substitution_request(brief, spec, selection.svg_path)
        request["ok"] = True
        request["selected_pattern"] = {
            "pattern_id": selection.pattern_id,
            "svg_path": str(selection.svg_path),
            "rationale": selection.rationale,
        }
        return request
    except Exception as exc:
        return _error_result(exc)


@mcp.tool()
def wf_apply_substitutions(
    svg_path: str,
    substitutions: list[dict[str, str]],
    system_id: str | None = None,
) -> dict[str, Any]:
    """Apply content substitutions to a wireframe SVG.

    Pass 2 of the two-pass substitution workflow. Applies {find, replace}
    edits to text content only (never style blocks or attributes). Optionally
    validates against grammar rules when system_id is provided.

    Returns {ok, svg_text, unapplied_finds, grammar_warnings}.
    """
    try:
        svg_text = Path(svg_path).read_text()

        grammar_warnings: list[str] = []
        if system_id:
            sys_result = load_system(system_id)
            if sys_result.ok:
                grammar_warnings = validate_substitutions(
                    substitutions, sys_result.data,
                )

        modified_svg, unapplied = apply_substitutions(svg_text, substitutions)

        return {
            "ok": True,
            "svg_text": modified_svg,
            "unapplied_finds": unapplied,
            "grammar_warnings": grammar_warnings,
        }
    except Exception as exc:
        return _error_result(exc)


@mcp.tool()
def wf_select_layout(
    brief: str,
    system_id: str,
    platform: str = "desktop",
) -> dict[str, Any]:
    """Browse a system's library of layout patterns and components.

    Returns available layout patterns (with descriptions and canvas
    dimensions) and available components. Use this to decide the best
    routing path, then call wf_generate with layout_id=<pattern_id> to
    use a pattern, or compose=True to assemble from components.

    Returns {ok, schema_version, brief, system_id, platform, canvas,
    available_patterns, available_components, grammar_caveats,
    response_format_example}.
    """
    try:
        sys_result = load_system(system_id)
        if not sys_result.ok:
            return {
                "ok": False,
                "errors": [e.message for e in sys_result.errors],
            }
        spec = sys_result.data

        from wireframe_skill.placement import build_layout_selection_request
        request = build_layout_selection_request(brief, spec, platform)
        request["ok"] = True

        from pathlib import Path as _Path
        library_root = _Path(spec["_meta"]["library_root"])
        components_dir = library_root / "components"
        if components_dir.exists():
            try:
                from wireframe_skill.decomposition import build_decomposition_request
                decomp_req = build_decomposition_request(brief, spec, platform)
                request["available_components"] = decomp_req["components"]
            except (ValueError, ImportError):
                request["available_components"] = []
        else:
            request["available_components"] = []

        return request
    except Exception as exc:
        return _error_result(exc)


@mcp.tool()
def wf_assemble_from_blueprint(
    blueprint: dict[str, Any],
    system_id: str,
    output_dir: str | None = None,
    filename_stem: str = "wireframe",
) -> dict[str, Any]:
    """Validate and assemble a component layout blueprint into a composited SVG.

    The blueprint specifies canvas size, regions, and component placements.
    This tool loads each component SVG from the system library, merges defs
    (renaming collisions), positions components via transform, and applies
    artifact treatments.

    When output_dir is provided, writes SVG + spec.yaml with components_used
    extracted from the blueprint. Returns svg_path and spec_path in addition
    to svg_text.

    Validation runs first: unknown component_ids and out-of-bounds placements
    block assembly. Returns {ok, svg_text, validation_errors, warnings}.
    """
    try:
        sys_result = load_system(system_id)
        if not sys_result.ok:
            return {
                "ok": False,
                "svg_text": None,
                "validation_errors": [e.message for e in sys_result.errors],
                "warnings": [],
            }
        spec = sys_result.data

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
            "svg_text": svg_text,
            "validation_errors": [],
            "warnings": warnings,
        }

        if output_dir:
            from wireframe_skill.emit import emit_artifact
            components_used = []
            for region in blueprint.get("regions", []):
                for comp in region.get("components", []):
                    comp_id = comp.get("component_id")
                    if comp_id:
                        components_used.append({
                            "id": comp_id,
                            "region": region.get("id", "unknown"),
                            "x": comp.get("x", 0),
                            "y": comp.get("y", 0),
                        })
            canvas = blueprint.get("canvas", {})
            svg_path, spec_path = emit_artifact(
                Path(output_dir),
                svg_text,
                brief="assembled from blueprint",
                platform="desktop",
                spec=spec,
                selection=None,
                compliance=None,
                width=canvas.get("width", 1280),
                height=canvas.get("height", 800),
                filename_stem=filename_stem,
                components_used=components_used,
            )
            result["svg_path"] = str(svg_path)
            result["spec_path"] = str(spec_path)
            result["components_used"] = components_used

        return result
    except Exception as exc:
        return _error_result(exc)


# ─── Entry point ───────────────────────────────────────────────────────

if __name__ == "__main__":
    mcp.run()
