"""Emit wireframe.svg + wireframe.spec.yaml to the output directory.

The spec.yaml shape matches what's documented in ../SKILL.md's "Step 7"
section, including a `design_system` block that records which system
was applied, which pattern was selected, and a compliance summary.
"""

from __future__ import annotations
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

import structlog

logger = structlog.get_logger(__name__)


def emit_artifact(
    output_dir: Path,
    svg_text: str,
    *,
    brief: str,
    platform: str,
    spec: dict | None,
    selection: Any,
    compliance: dict | None,
    width: int,
    height: int,
    filename_stem: str = "wireframe",
) -> tuple[Path, Path]:
    """Write wireframe SVG and spec.yaml to output directory.

    Args:
        output_dir: Directory to write output files.
        svg_text: SVG content as string.
        brief: Original brief text.
        platform: "mobile" or "desktop".
        spec: Loaded system spec dict or None.
        selection: LayoutSelection object or None.
        compliance: Compliance check result dict or None.
        width: SVG canvas width.
        height: SVG canvas height.
        filename_stem: Filename prefix (default "wireframe").

    Returns:
        Tuple of (svg_path, spec_path) absolute Path objects.
    """
    output_dir = Path(output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    svg_path = output_dir / f"{filename_stem}.svg"
    spec_path = output_dir / f"{filename_stem}.spec.yaml"
    svg_path.write_text(svg_text)

    metadata = _build_spec_yaml(
        brief=brief,
        platform=platform,
        system_spec=spec,
        selection=selection,
        compliance=compliance,
        width=width,
        height=height,
        svg_filename=svg_path.name,
    )
    spec_path.write_text(yaml.safe_dump(metadata, sort_keys=False))
    return svg_path, spec_path


def _build_spec_yaml(
    *,
    brief: str,
    platform: str,
    system_spec: dict | None,
    selection: Any,
    compliance: dict | None,
    width: int,
    height: int,
    svg_filename: str,
) -> dict:
    """Build the spec.yaml metadata dict.

    Schema:
        wireframe:
          brief: <str>
          platform: mobile | desktop
          dimensions: { width, height }
          generated_at: <ISO 8601 UTC>
          generator_version: "3.0-deterministic"
        design_system:
          id: <system_id> | null
          spec_version: <str> | null
          system_version: <str> | null
          layout_template_used: <pattern_id>
          pattern_source_svg: <relative path>
          components_used: []   # populated when LLM placement lands
          rulebook_compliance:
            checked: <int>
            mechanical_passed: <int>
            mechanical_failed: <int>
            advisory_warnings: <int>
            failed_rules: [<rule_id>, ...]
          artifact_treatments_applied: []
        notes:
          - text: <str>
    """
    out: dict = {
        "wireframe": {
            "brief": brief,
            "platform": platform,
            "dimensions": {"width": width, "height": height},
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "generator_version": "3.0-deterministic",
            "svg": svg_filename,
        }
    }

    if system_spec is None:
        out["design_system"] = {
            "id": None,
            "note": "Generated against the built-in neutral templates; no system applied.",
        }
    else:
        meta = system_spec.get("_meta", {})
        ds: dict = {
            "id": meta.get("system_id"),
            "spec_version": meta.get("spec_version"),
            "system_version": meta.get("system_version"),
        }
        if selection is not None:
            ds["layout_template_used"] = selection.pattern_id
            ds["base_pattern"] = selection.base_pattern
            try:
                ds["pattern_source_svg"] = str(selection.svg_path)
            except Exception:
                ds["pattern_source_svg"] = None
            ds["selection_rationale"] = selection.rationale
            if selection.fallback:
                ds["selection_was_fallback"] = True
        ds["components_used"] = []  # LLM seam — populated when placement returns structured plan
        if compliance is not None:
            ds["rulebook_compliance"] = {
                "checked": compliance.get("passed", 0)
                            + compliance.get("failed", 0)
                            + compliance.get("advisory", 0),
                "mechanical_passed": compliance.get("passed", 0),
                "mechanical_failed": compliance.get("failed", 0),
                "advisory_warnings": compliance.get("advisory", 0),
                "failed_rules": [
                    r["rule_id"] for r in compliance.get("results", [])
                    if r.get("status") == "fail"
                ],
                "ruleset": compliance.get("ruleset"),
                "scope": compliance.get("scope"),
            }
        ds["artifact_treatments_applied"] = []  # populated when artifact_treatments support lands
        out["design_system"] = ds

    notes: list[dict] = []
    if system_spec is not None and selection is not None and selection.fallback:
        notes.append({
            "text": (
                f"Brief did not match any pattern keyword; fell back to "
                f"'{selection.pattern_id}'. Consider extending the system's "
                f"layout coverage."
            ),
        })
    if compliance is not None and compliance.get("failed", 0) > 0:
        notes.append({
            "text": (
                f"Rulebook compliance has {compliance['failed']} mechanical "
                f"failure(s). See design_system.rulebook_compliance.failed_rules."
            ),
        })
    if notes:
        out["notes"] = notes

    return out
