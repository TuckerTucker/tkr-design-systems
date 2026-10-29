"""The 7-step generation flow per ../SKILL.md.

This module orchestrates load → layout-select → component-place →
compose → artifact-treatments → rulebook-check → emit. The
deterministic shell of v3.0 implements the plumbing; LLM-judgment steps
(brief→component decomposition, semantic rulebook reasoning) are
stubbed with deterministic fallbacks and clear seams.

A consumer calls:

    from wireframe_skill import wireframe
    result = wireframe(brief="settings page for a chat app", system="swiss")
"""

from __future__ import annotations
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# The sibling design-system-skill package is put on sys.path by
# wireframe_skill/__init__.py (see _design_system_path.py).

from design_system_skill import (  # noqa: E402
    load_system,
    check_compliance,
)

from .compose import (  # noqa: E402
    compose_svg,
    apply_artifact_treatments,
    PLATFORM_DIMENSIONS,
)
from .emit import emit_artifact  # noqa: E402
from .placement import (  # noqa: E402
    select_layout_pattern,
    derive_content_substitutions,
    LayoutSelection,
    EscalateToDecomposition,
)
from .decomposition import build_decomposition_request  # noqa: E402

import structlog

logger = structlog.get_logger(__name__)


@dataclass
class GenerationResult:
    """Result of a wireframe() call.

    Populated even on partial failure so consumers can introspect errors.

    Attributes:
        ok: True if generation succeeded.
        svg_path: Path to emitted wireframe.svg (None on failure).
        spec_path: Path to emitted wireframe.spec.yaml (None on failure).
        errors: List of error messages.
        warnings: List of warning messages.
        compliance: Compliance check result dict or None.
        selection: LayoutSelection used or None.
        system_id: The system id ("wireframe" if no system specified).
    """
    ok: bool
    svg_path: Path | None = None
    spec_path: Path | None = None
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    compliance: dict | None = None
    selection: LayoutSelection | None = None
    system_id: str | None = None
    # Layer 1 — escalation to the two-pass decomposition flow.
    # When True, the skill could not select a pre-authored pattern AND the
    # brief's nouns don't overlap the system's catalog. The orchestrator
    # (e.g. /wireframe-compose) should run the decomposition pass using
    # `pass_request` as the payload for Claude.
    requires_orchestrator_pass: bool = False
    pass_request: dict | None = None
    escalation_reason: str | None = None
    # Agent-driven routing — populated when the caller requested the routing
    # inventory (request_routing=True) instead of heuristic selection. The
    # agent reviews available patterns/components and calls again with
    # layout_id=<pattern_id> or via the decomposition flow.
    routing_request: dict | None = None
    # Two-turn flows: substitute=True returns the substitution request for
    # the selected pattern; compose=True returns the decomposition request.
    substitution_request: dict | None = None
    decomposition_request: dict | None = None

    def to_dict(self) -> dict:
        """Serialize to dict for non-Python consumers.

        Returns:
            A dict with ok, svg_path, spec_path, errors, warnings, compliance_summary,
            selection, system_id, escalation fields and the optional
            request dicts (routing, substitution, decomposition).
        """
        return {
            "ok": self.ok,
            "svg_path": str(self.svg_path) if self.svg_path else None,
            "spec_path": str(self.spec_path) if self.spec_path else None,
            "errors": self.errors,
            "warnings": self.warnings,
            "compliance_summary": (
                None if self.compliance is None
                else {
                    "passed": self.compliance.get("passed"),
                    "failed": self.compliance.get("failed"),
                    "advisory": self.compliance.get("advisory"),
                }
            ),
            "selection": (
                None if self.selection is None
                else {
                    "pattern_id": self.selection.pattern_id,
                    "base_pattern": self.selection.base_pattern,
                    "fallback": self.selection.fallback,
                    "rationale": self.selection.rationale,
                }
            ),
            "system_id": self.system_id,
            "requires_orchestrator_pass": self.requires_orchestrator_pass,
            "pass_request": self.pass_request,
            "escalation_reason": self.escalation_reason,
            "routing_request": self.routing_request,
            "substitution_request": self.substitution_request,
            "decomposition_request": self.decomposition_request,
        }


def wireframe(
    brief: str,
    *,
    platform: str = "desktop",
    system: str | None = None,
    output_dir: str | Path = ".",
    spec_version: str | None = None,
    filename_stem: str = "wireframe",
    escalate: bool = True,
    layout_id: str | None = None,
    request_routing: bool = False,
    substitute: bool = False,
    compose: bool = False,
) -> GenerationResult:
    """Generate a wireframe SVG and metadata spec.

    Executes 7-step generation flow: load spec → select pattern → place components
    (no-op) → compose SVG → apply treatments (no-op) → check compliance → emit.

    With `system=None`, uses the wireframe library (neutral patterns) as the
    implicit system.

    Args:
        brief: Free-text brief (e.g. "dashboard for a chat app").
        platform: "mobile" or "desktop" (default: "desktop").
        system: System id (e.g. "swiss") or None for wireframe library.
        output_dir: Directory for output files (default: ".").
        spec_version: Expected spec version or None to allow any.
        filename_stem: Filename prefix (default: "wireframe").
        escalate: Escalate off-catalog briefs to decomposition instead of
            falling back to the dashboard pattern.
        layout_id: Explicit layout pattern override (bypasses the keyword
            heuristic). Used with routing_request responses.
        request_routing: If True, skip heuristic selection and return a
            routing_request inventory (available patterns + components) for
            the calling agent to choose from. The agent calls again with
            layout_id=<pattern_id>, or runs the decomposition flow.
        substitute: If True, return early after pattern selection with a
            substitution_request for that pattern. The caller fills it and
            applies it with apply_substitutions.
        compose: If True, skip pattern selection and return a
            decomposition_request for blueprint-based assembly.

    Returns:
        GenerationResult with ok, svg_path, spec_path, errors, warnings.
    """
    if platform not in PLATFORM_DIMENSIONS:
        return GenerationResult(
            ok=False,
            errors=[f"Unknown platform '{platform}'. Choose 'mobile' or 'desktop'."],
        )

    # Step 1: load the system spec. None → wireframe (the neutral library).
    effective_system = system or "wireframe"
    sys_result = load_system(effective_system)
    if not sys_result.ok:
        return GenerationResult(
            ok=False,
            errors=[f"Could not load system '{effective_system}': "
                    + "; ".join(e.message for e in sys_result.errors)],
            system_id=effective_system,
        )
    spec = sys_result.data
    warnings: list[str] = []
    if sys_result.warnings:
        warnings.extend(w.message for w in sys_result.warnings)

    if spec_version is not None and spec["_meta"]["spec_version"] != spec_version:
        warnings.append(
            f"Requested spec_version='{spec_version}' but loaded "
            f"'{spec['_meta']['spec_version']}'. Using loaded version."
        )

    # Composition mode: return the decomposition request (two-turn flow).
    if compose:
        try:
            decomp_request = build_decomposition_request(brief, spec, platform=platform)
        except ValueError as e:
            return GenerationResult(ok=False, errors=[str(e)], system_id=effective_system)
        return GenerationResult(
            ok=True,
            decomposition_request=decomp_request,
            system_id=effective_system,
            warnings=warnings,
        )

    # Step 2 (agent-driven variant): the caller wants the routing inventory
    # instead of heuristic selection. Return the available patterns and
    # components so the agent can choose; it calls again with layout_id or
    # runs the decomposition flow.
    if request_routing and layout_id is None:
        from .placement import build_layout_selection_request

        library_root = Path(spec["_meta"]["library_root"])
        layouts_dir = library_root / "layouts"
        components_dir = library_root / "components"

        inventory: dict = {
            "schema_version": "1.0",
            "action": "select_routing",
            "brief": brief,
            "system_id": effective_system,
            "platform": platform,
        }
        if layouts_dir.exists():
            layout_req = build_layout_selection_request(brief, spec, platform)
            inventory["available_patterns"] = layout_req["available_patterns"]
            inventory["canvas"] = layout_req["canvas"]
            inventory["grammar_caveats"] = layout_req.get("grammar_caveats", {})
            inventory["response_format_example"] = layout_req.get(
                "response_format_example", {}
            )
        else:
            canvas_w, canvas_h = PLATFORM_DIMENSIONS[platform]
            inventory["available_patterns"] = []
            inventory["canvas"] = {"width": canvas_w, "height": canvas_h}
            inventory["grammar_caveats"] = {}

        if components_dir.exists():
            try:
                decomp_req = build_decomposition_request(brief, spec, platform=platform)
                inventory["available_components"] = decomp_req["components"]
            except ValueError:
                inventory["available_components"] = []
        else:
            inventory["available_components"] = []

        inventory["instructions"] = (
            "No layout was auto-selected. Review the available patterns and "
            "components, then choose one of: "
            "(a) call again with layout_id=<pattern_id> to use a pattern, "
            "(b) run the decomposition flow to assemble from components, "
            "(c) author SVG directly for truly novel layouts."
        )

        return GenerationResult(
            ok=True,
            routing_request=inventory,
            system_id=effective_system,
            warnings=warnings,
        )

    # Step 2 (explicit override): the agent already chose a pattern.
    if layout_id is not None:
        from .placement import apply_layout_selection

        selection = apply_layout_selection(
            {"selected_pattern_id": layout_id,
             "rationale": "explicit layout_id override"},
            spec, platform,
        )
        if selection is None:
            return GenerationResult(
                ok=False,
                errors=[f"layout_id '{layout_id}' not found in system "
                        f"'{effective_system}'"],
                system_id=effective_system,
            )
    else:
        # Step 2 (default): brief → layout pattern (or escalation sentinel).
        selection = select_layout_pattern(
            brief, spec, platform=platform, escalate=escalate,
        )
    if selection is None:
        return GenerationResult(
            ok=False,
            errors=[
                f"System '{effective_system}' has no patterns in its layouts/ "
                f"directory. Cannot derive a wireframe from the brief."
            ],
            system_id=effective_system,
        )
    if isinstance(selection, EscalateToDecomposition):
        # Brief is off-catalog. Build the decomposition request for the
        # orchestrator and return early. The skill stays deterministic.
        try:
            request = build_decomposition_request(brief, spec, platform=platform)
        except Exception as e:
            return GenerationResult(
                ok=False,
                errors=[
                    f"escalation triggered but decomposition request failed: {e}"
                ],
                system_id=effective_system,
                requires_orchestrator_pass=True,
                escalation_reason=selection.reason,
            )
        return GenerationResult(
            ok=False,
            errors=[],
            warnings=warnings + [selection.reason],
            system_id=effective_system,
            requires_orchestrator_pass=True,
            pass_request=request,
            escalation_reason=selection.reason,
        )
    if selection.fallback:
        warnings.append(selection.rationale)

    # Substitution mode: return the substitution request (two-turn flow).
    if substitute:
        from .substitution import build_substitution_request
        try:
            sub_request = build_substitution_request(brief, spec, selection.svg_path)
        except FileNotFoundError as e:
            return GenerationResult(
                ok=False, errors=[str(e)], system_id=effective_system, selection=selection,
            )
        return GenerationResult(
            ok=True,
            substitution_request=sub_request,
            selection=selection,
            system_id=effective_system,
            warnings=warnings,
        )

    # Step 3: brief → component placements. LLM seam; currently no-op.
    substitutions = derive_content_substitutions(brief, spec, selection)

    # Step 4: compose (read pattern + apply substitutions + extract dims).
    try:
        svg_text, width, height = compose_svg(selection, substitutions, platform)
    except FileNotFoundError as e:
        return GenerationResult(
            ok=False,
            errors=[str(e)],
            system_id=effective_system,
            selection=selection,
        )

    # Step 5: artifact-level treatments (Riso grain etc. — no-op for most).
    svg_text = apply_artifact_treatments(svg_text, spec)

    # Step 6: pre-emit rulebook check. We write the SVG to a temp scratch
    # path so the existing check_compliance file-based API works without
    # modification, then keep the validated text for the real emit.
    output_dir = Path(output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    scratch_path = output_dir / f".{filename_stem}.precheck.svg"
    scratch_path.write_text(svg_text)
    try:
        # Pattern SVGs are artifact-scoped; force the scope so we don't
        # rely on path detection (the temp path may not contain
        # "/layouts/").
        comp_result = check_compliance(
            effective_system,
            scratch_path,
            scope="artifact",
        )
        compliance = comp_result.data if comp_result.ok else None
        if not comp_result.ok:
            warnings.extend(
                f"compliance check failed: {e.message}"
                for e in comp_result.errors
            )
    finally:
        try:
            scratch_path.unlink()
        except OSError:
            pass

    # Step 7: emit SVG + spec.yaml.
    svg_path, spec_path = emit_artifact(
        output_dir=output_dir,
        svg_text=svg_text,
        brief=brief,
        platform=platform,
        spec=spec,
        selection=selection,
        compliance=compliance,
        width=width,
        height=height,
        filename_stem=filename_stem,
    )

    # If any required-severity rule failed mechanically, the emit still
    # happens but the result reports ok=False so consumers can decide
    # whether to ship.
    failed_required = (
        compliance is not None
        and compliance.get("failed", 0) > 0
    )

    return GenerationResult(
        ok=not failed_required,
        svg_path=svg_path,
        spec_path=spec_path,
        errors=(
            [
                f"{compliance['failed']} required-severity rule(s) failed mechanically: "
                f"{[r['rule_id'] for r in compliance['results'] if r['status']=='fail']}"
            ]
            if failed_required else []
        ),
        warnings=warnings,
        compliance=compliance,
        selection=selection,
        system_id=effective_system,
    )
