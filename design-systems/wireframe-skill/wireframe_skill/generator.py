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
import sys
from typing import Any

# Make the sibling design-system-skill package importable. The two skills
# live as siblings under the project root; we add design-system-skill/
# to sys.path so consumers don't need to install either as a wheel.
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
_DSS_DIR = _REPO_ROOT / "design-system-skill"
if str(_DSS_DIR) not in sys.path:
    sys.path.insert(0, str(_DSS_DIR))

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
)

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

    def to_dict(self) -> dict:
        """Serialize to dict for non-Python consumers.

        Returns:
            A dict with ok, svg_path, spec_path, errors, warnings, compliance_summary,
            selection, system_id.
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
        }


def wireframe(
    brief: str,
    *,
    platform: str = "desktop",
    system: str | None = None,
    output_dir: str | Path = ".",
    spec_version: str | None = None,
    filename_stem: str = "wireframe",
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

    # Step 2: brief → layout pattern.
    selection = select_layout_pattern(brief, spec, platform=platform)
    if selection is None:
        return GenerationResult(
            ok=False,
            errors=[
                f"System '{effective_system}' has no patterns in its layouts/ "
                f"directory. Cannot derive a wireframe from the brief."
            ],
            system_id=effective_system,
        )
    if selection.fallback:
        warnings.append(selection.rationale)

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
