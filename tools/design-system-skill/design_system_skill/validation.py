"""Schema validation for design system specs.

This module is the source of truth for which spec shapes are accepted.
It accepts both v0.1 and v0.2 specs (v0.2 is fully backwards-compatible
with v0.1 per docs/SCHEMA-V0.2.md).

The validator's job:
  - Required top-level fields are present (`spec_version`, `system`, `tokens`).
  - Enum values are within their allowed range (`grammar_family`,
    `severity`, `check_method`, `check_scope`, `selection_signal`).
  - Referenced SVG paths actually exist on disk.
  - No obviously-broken cross-references (a rule referencing a
    non-existent component, an anatomy yields_to entry naming an
    absent sibling part).

Validation produces structured errors (blocking) and warnings (advisory).
The caller decides what to do with warnings.

Implementation note: we do NOT use jsonschema here. Hand-rolled checks
are easier to keep in sync with SCHEMA-V0.2.md (the human-readable
spec) and they produce better error messages targeted at design
system authors.
"""

from __future__ import annotations
from pathlib import Path
from typing import Any

import yaml

from .errors import Error, Result

import structlog

logger = structlog.get_logger(__name__)


# ─── Enum vocabularies ──────────────────────────────────────────────

KNOWN_GRAMMAR_FAMILIES = {
    "wireframe",
    "contemporary_clean",
    "character_grid",
    "print_texture",
}

KNOWN_ELEVATION_STRATEGIES = {
    "typographic",
    "paper_tiers",
    "borders_only",
    "glass_blur",
    "hard_offset",
    "duotone_filter",
    "filter_pipeline",
}

VALID_SEVERITIES = {"required", "recommended", "advisory"}
VALID_CHECK_METHODS = {"mechanical", "semantic", "both"}
VALID_CHECK_SCOPES = {"artifact", "component", "both"}

KNOWN_SELECTION_SIGNALS = {
    "accent_bar",
    "prompt_character",
    "surface_fill",
    "border_treatment",
    "hard_offset",
    "text_treatment",
}

VALID_SPEC_VERSIONS = {"0.1", "0.2"}


# ─── Public entry point ─────────────────────────────────────────────

def validate_spec(spec_path: str | Path, library_root: str | Path | None = None) -> Result:
    """Validate a design system spec.yaml file.

    Checks required top-level fields, enum values, referenced SVG existence,
    and cross-references (anatomy yields_to, etc).

    Args:
        spec_path: Path to spec.yaml file.
        library_root: Optional override for SVG reference resolution.
            Defaults to spec file's directory. The loader passes the
            registry's library_root for accurate path warnings.

    Returns:
        Result with data={valid, system_id, spec_version, errors, warnings}.
    """
    spec_path = Path(spec_path).resolve()
    if not spec_path.exists():
        return Result.failure(Error(
            "SPEC_FILE_MISSING",
            f"Spec file not found: {spec_path}",
            {"path": str(spec_path)},
        ))
    try:
        data = yaml.safe_load(spec_path.read_text())
    except yaml.YAMLError as e:
        return Result.failure(Error(
            "SPEC_PARSE_FAILED",
            f"YAML parse error: {e}",
            {"path": str(spec_path)},
        ))
    if not isinstance(data, dict):
        return Result.failure(Error(
            "SCHEMA_VALIDATION_FAILED",
            "Top-level must be a mapping.",
            {"path": str(spec_path)},
        ))

    errors: list[Error] = []
    warnings: list[Error] = []
    spec_dir = spec_path.parent
    lib_root = Path(library_root).resolve() if library_root else None

    _check_top_level_shape(data, errors)
    _check_spec_version(data, errors)
    _check_system_block(data, errors, warnings)
    _check_tokens(data, errors, warnings)
    _check_components(data, spec_dir, errors, warnings, lib_root)
    _check_layout_templates(data, spec_dir, errors, warnings, lib_root)
    _check_rulebook(data, errors, warnings)
    _check_artifact_treatments(data, errors, warnings)

    sys_id = (data.get("system") or {}).get("id")
    if errors:
        # Fail with all collected errors (not just the first one) so
        # authors see the whole picture in one pass.
        result = Result.failure(errors)
        result.data = {
            "valid": False,
            "system_id": sys_id,
            "spec_version": data.get("spec_version"),
            "errors": [{"code": e.code, "message": e.message, "detail": e.detail} for e in errors],
            "warnings": [{"code": w.code, "message": w.message, "detail": w.detail} for w in warnings],
        }
        return result

    return Result.success(
        data={
            "valid": True,
            "system_id": sys_id,
            "spec_version": data.get("spec_version"),
            "errors": [],
            "warnings": [{"code": w.code, "message": w.message, "detail": w.detail} for w in warnings],
        },
        warnings=warnings or None,
    )


# ─── Per-block checks ───────────────────────────────────────────────

def _check_top_level_shape(data: dict, errors: list[Error]) -> None:
    """Verify required top-level fields are present."""
    for required in ("spec_version", "system", "tokens"):
        if required not in data:
            errors.append(Error(
                "SCHEMA_VALIDATION_FAILED",
                f"Missing required top-level field: '{required}'",
                {"missing": required},
            ))


def _check_spec_version(data: dict, errors: list[Error]) -> None:
    """Verify spec_version is valid."""
    sv = data.get("spec_version")
    if sv is None:
        return
    if not isinstance(sv, str):
        errors.append(Error(
            "SCHEMA_VALIDATION_FAILED",
            f"spec_version must be a string, got {type(sv).__name__}",
        ))
        return
    if sv not in VALID_SPEC_VERSIONS:
        errors.append(Error(
            "SCHEMA_VALIDATION_FAILED",
            f"Unknown spec_version '{sv}'. Supported: {sorted(VALID_SPEC_VERSIONS)}",
            {"spec_version": sv},
        ))


def _check_system_block(data: dict, errors: list[Error], warnings: list[Error]) -> None:
    """Verify system block has required fields and valid grammar_family."""
    sys_block = data.get("system")
    if not isinstance(sys_block, dict):
        return
    for required in ("id", "name"):
        if required not in sys_block:
            errors.append(Error(
                "SCHEMA_VALIDATION_FAILED",
                f"system.{required} is required",
                {"missing": f"system.{required}"},
            ))
    gf = sys_block.get("grammar_family")
    if gf is not None and gf not in KNOWN_GRAMMAR_FAMILIES:
        warnings.append(Error(
            "SCHEMA_VALIDATION_FAILED",
            f"grammar_family '{gf}' is not a known convention. "
            f"Known values: {sorted(KNOWN_GRAMMAR_FAMILIES)}",
            {"system_id": sys_block.get("id"), "grammar_family": gf},
        ))

    extends_id = sys_block.get("extends")
    if extends_id is not None:
        if not isinstance(extends_id, str) or not extends_id.strip():
            errors.append(Error(
                "SCHEMA_VALIDATION_FAILED",
                "system.extends must be a non-empty string (a system id)",
                {"extends": extends_id},
            ))
        else:
            try:
                from .registry import Registry
                reg_result = Registry.load()
                if reg_result.ok and extends_id not in reg_result.data:
                    warnings.append(Error(
                        "SCHEMA_VALIDATION_FAILED",
                        f"system.extends '{extends_id}' is not in the registry. "
                        f"Register it first, or this system will fail to load.",
                        {"extends": extends_id,
                         "available": [e.id for e in reg_result.data.all()]},
                    ))
            except Exception:
                pass


def _check_tokens(data: dict, errors: list[Error], warnings: list[Error]) -> None:
    """Verify elevation strategy is valid."""
    tokens = data.get("tokens")
    if not isinstance(tokens, dict):
        return
    elev = tokens.get("elevation")
    if isinstance(elev, dict):
        strategy = elev.get("strategy")
        if strategy is not None and strategy not in KNOWN_ELEVATION_STRATEGIES:
            warnings.append(Error(
                "SCHEMA_VALIDATION_FAILED",
                f"elevation.strategy '{strategy}' is not a known convention. "
                f"Known values: {sorted(KNOWN_ELEVATION_STRATEGIES)}",
                {"strategy": strategy},
            ))


def _resolve_svg_for_check(svg_rel: str, spec_dir: Path, library_root: Path | None) -> Path:
    """Resolve an SVG reference path (mirrors loader._resolve_svg).

    Args:
        svg_rel: Relative SVG path from spec.
        spec_dir: Directory containing the spec file.
        library_root: System library root for fallback resolution.

    Returns:
        The resolved SVG path (caller checks existence).
    """
    rel = Path(svg_rel)
    candidate = (spec_dir / rel).resolve()
    if candidate.exists():
        return candidate
    if library_root is not None:
        return (library_root / rel).resolve()
    return candidate


def _check_components(
    data: dict, spec_dir: Path, errors: list[Error], warnings: list[Error],
    library_root: Path | None = None,
) -> None:
    """Validate component definitions, anatomy, variants, and SVG paths."""
    components = data.get("components")
    if not isinstance(components, dict):
        return
    for comp_id, comp_def in components.items():
        if not isinstance(comp_def, dict):
            continue
        # Anatomy may be either flat strings (v0.1) or structured dicts (v0.2).
        # When structured, validate yields_to references resolve.
        anatomy = comp_def.get("anatomy") or []
        if anatomy and isinstance(anatomy[0], dict):
            part_ids = {p.get("id") for p in anatomy if isinstance(p, dict)}
            for part in anatomy:
                if not isinstance(part, dict):
                    continue
                yields = part.get("yields_to") or []
                for target in yields:
                    if target not in part_ids:
                        errors.append(Error(
                            "SCHEMA_VALIDATION_FAILED",
                            f"components.{comp_id}.anatomy: '{part.get('id')}.yields_to' references unknown sibling '{target}'",
                            {"component": comp_id, "yielding_part": part.get("id"), "missing_target": target},
                        ))

        for variant in comp_def.get("variants") or []:
            if not isinstance(variant, dict):
                continue
            svg_rel = variant.get("svg")
            if not svg_rel:
                # Some component variants legitimately have no SVG (e.g. badge in
                # Swiss is an empty placeholder). Warn rather than fail.
                warnings.append(Error(
                    "SCHEMA_VALIDATION_FAILED",
                    f"components.{comp_id}.variants[{variant.get('id')}] has no svg path",
                    {"component": comp_id, "variant_id": variant.get("id")},
                ))
                continue
            svg_path = _resolve_svg_for_check(svg_rel, spec_dir, library_root)
            if not svg_path.exists():
                warnings.append(Error(
                    "REFERENCED_FILE_MISSING",
                    f"components.{comp_id}.variants[{variant.get('id')}].svg not found at {svg_path}",
                    {"component": comp_id, "variant_id": variant.get("id"), "svg_path": str(svg_path)},
                ))

            sig = variant.get("selection_signal")
            if sig is not None and sig not in KNOWN_SELECTION_SIGNALS:
                warnings.append(Error(
                    "SCHEMA_VALIDATION_FAILED",
                    f"components.{comp_id}.variants[{variant.get('id')}].selection_signal "
                    f"'{sig}' is not a known convention. "
                    f"Known values: {sorted(KNOWN_SELECTION_SIGNALS)}",
                    {"component": comp_id, "variant_id": variant.get("id"), "selection_signal": sig},
                ))


def _check_layout_templates(
    data: dict, spec_dir: Path, errors: list[Error], warnings: list[Error],
    library_root: Path | None = None,
) -> None:
    """Validate layout template definitions and SVG paths."""
    layouts = data.get("layout_templates")
    if not isinstance(layouts, dict):
        return
    for layout_id, layout_def in layouts.items():
        if not isinstance(layout_def, dict):
            continue
        svg_rel = layout_def.get("svg")
        if svg_rel:
            svg_path = _resolve_svg_for_check(svg_rel, spec_dir, library_root)
            if not svg_path.exists():
                warnings.append(Error(
                    "REFERENCED_FILE_MISSING",
                    f"layout_templates.{layout_id}.svg not found at {svg_path}",
                    {"layout_id": layout_id, "svg_path": str(svg_path)},
                ))


def _check_rulebook(data: dict, errors: list[Error], warnings: list[Error]) -> None:
    """Validate rulebook entries for required fields and valid enums."""
    rulebook = data.get("rulebook") or []
    if not isinstance(rulebook, list):
        return
    seen_ids: set[str] = set()
    has_required = False
    for rule in rulebook:
        if not isinstance(rule, dict):
            continue
        rid = rule.get("id")
        if not rid:
            errors.append(Error(
                "SCHEMA_VALIDATION_FAILED",
                "rulebook entry missing 'id'",
                {"rule": rule},
            ))
            continue
        if rid in seen_ids:
            errors.append(Error(
                "SCHEMA_VALIDATION_FAILED",
                f"Duplicate rulebook id '{rid}'",
                {"rule_id": rid},
            ))
            continue
        seen_ids.add(rid)

        sev = rule.get("severity")
        if sev is not None and sev not in VALID_SEVERITIES:
            errors.append(Error(
                "SCHEMA_VALIDATION_FAILED",
                f"rulebook[{rid}].severity '{sev}' not in {sorted(VALID_SEVERITIES)}",
                {"rule_id": rid, "severity": sev},
            ))
        if sev == "required":
            has_required = True

        method = rule.get("check_method")
        if method is not None and method not in VALID_CHECK_METHODS:
            errors.append(Error(
                "SCHEMA_VALIDATION_FAILED",
                f"rulebook[{rid}].check_method '{method}' not in {sorted(VALID_CHECK_METHODS)}",
                {"rule_id": rid, "check_method": method},
            ))

        scope = rule.get("check_scope")
        if scope is not None and scope not in VALID_CHECK_SCOPES:
            errors.append(Error(
                "SCHEMA_VALIDATION_FAILED",
                f"rulebook[{rid}].check_scope '{scope}' not in {sorted(VALID_CHECK_SCOPES)}",
                {"rule_id": rid, "check_scope": scope},
            ))

    if rulebook and not has_required:
        warnings.append(Error(
            "SCHEMA_VALIDATION_FAILED",
            "Rulebook has no entries with severity: required. The system may not enforce its own constraints.",
            {},
        ))


def _check_artifact_treatments(
    data: dict, errors: list[Error], warnings: list[Error]
) -> None:
    """Validate artifact_treatments layer values."""
    treatments = data.get("artifact_treatments")
    if treatments is None:
        return
    if not isinstance(treatments, list):
        errors.append(Error(
            "SCHEMA_VALIDATION_FAILED",
            "artifact_treatments must be a list",
            {"got_type": type(treatments).__name__},
        ))
        return
    valid_layers = {"bottom", "per_component", "top"}
    for t in treatments:
        if not isinstance(t, dict):
            continue
        layer = t.get("layer")
        if layer is not None and layer not in valid_layers:
            errors.append(Error(
                "SCHEMA_VALIDATION_FAILED",
                f"artifact_treatments.layer '{layer}' not in {sorted(valid_layers)}",
                {"treatment_id": t.get("id"), "layer": layer},
            ))
