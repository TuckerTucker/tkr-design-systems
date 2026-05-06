"""load_system — the hot path. Returns a structured spec object with
SVG paths resolved to absolute, cached by file checksum.

The returned object is a plain dict (not a custom class) so non-Python
consumers can serialize it to JSON. Python consumers can treat it as
a TypedDict / structural type.

Cache lifetime: per-process. Survives multiple wireframe generations
within one session; doesn't leak across sessions because Python
processes are short-lived in skill invocation contexts.
"""

from __future__ import annotations
import hashlib
from pathlib import Path
from typing import Any

import yaml

from .errors import Error, Result
from .paths import project_root
from .registry import Registry
from .validation import validate_spec

import structlog

logger = structlog.get_logger(__name__)


# In-process cache: spec_path -> (sha256, normalized_spec_dict)
_CACHE: dict[str, tuple[str, dict]] = {}


def _checksum(path: Path) -> str:
    """Compute SHA256 checksum of a file.

    Args:
        path: File to checksum.

    Returns:
        Hex digest of file contents.
    """
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def load_system(system_id: str, validate: bool = True) -> Result:
    """Load and normalize a system spec by id.

    Returns a Result whose data is a normalized spec dict with:
      - `_meta`: {spec_version, system_version, checksum, spec_path, library_root}
      - `components.*.variants[*].svg_path`: absolute SVG path
      - `layout_templates.*.svg_path`: absolute SVG path

    Caching is per-process; survives multiple invocations but doesn't leak
    across processes.

    Args:
        system_id: The system id (e.g. "swiss").
        validate: If True (default), schema checks are run; if False,
            skipped (used by tests loading incomplete specs).

    Returns:
        Result with data=normalized spec dict if successful.
    """
    reg_result = Registry.load()
    if not reg_result.ok:
        return reg_result
    reg: Registry = reg_result.data

    entry = reg.get(system_id)
    if entry is None:
        available = [e.id for e in reg.all()]
        return Result.failure(Error(
            "SYSTEM_NOT_FOUND",
            f"System '{system_id}' is not in the registry. Available: {available}",
            {"system_id": system_id, "available": available},
        ))

    root = project_root()
    spec_path = (root / entry.spec).resolve()
    if not spec_path.exists():
        return Result.failure(Error(
            "SPEC_FILE_MISSING",
            f"Registered spec for '{system_id}' is missing at {spec_path}",
            {"system_id": system_id, "expected_path": str(spec_path)},
        ))

    # Cache check
    digest = _checksum(spec_path)
    cache_key = str(spec_path)
    cached = _CACHE.get(cache_key)
    if cached is not None and cached[0] == digest:
        return Result.success(cached[1])

    library_root = (root / entry.library_root).resolve()

    # Validate (pass library_root so SVG path warnings are accurate)
    warnings: list[Error] = []
    if validate:
        val_result = validate_spec(spec_path, library_root=library_root)
        if not val_result.ok:
            return val_result
        # Carry validation warnings forward
        if val_result.warnings:
            warnings.extend(val_result.warnings)
        if val_result.data and val_result.data.get("warnings"):
            for w in val_result.data["warnings"]:
                warnings.append(Error(w["code"], w["message"], w.get("detail", {})))

    try:
        spec = yaml.safe_load(spec_path.read_text())
    except yaml.YAMLError as e:
        return Result.failure(Error(
            "SPEC_PARSE_FAILED",
            f"YAML parse error in {spec_path}: {e}",
            {"spec_path": str(spec_path)},
        ))

    spec = _normalize(spec, spec_path, library_root, entry, digest)

    _CACHE[cache_key] = (digest, spec)
    return Result.success(spec, warnings=warnings or None)


def _normalize(
    spec: dict, spec_path: Path, library_root: Path, entry, checksum: str
) -> dict:
    """Resolve SVG paths and add _meta to a spec dict.

    Pure function; doesn't mutate the cached object because yaml.safe_load
    deepcopies on each non-cache-hit.

    Args:
        spec: Raw spec dict from YAML.
        spec_path: Path to spec.yaml file.
        library_root: System library root for SVG resolution.
        entry: RegistryEntry for this system.
        checksum: File checksum for cache validation.

    Returns:
        Normalized spec dict with _meta and resolved SVG paths.
    """
    sys_block = spec.get("system") or {}
    spec["_meta"] = {
        "system_id": entry.id,
        "system_version": sys_block.get("version"),
        "spec_version": spec.get("spec_version"),
        "spec_path": str(spec_path),
        "library_root": str(library_root),
        "checksum": checksum,
        "registry_status": entry.status,
    }

    # Resolve component SVG paths.
    components = spec.get("components") or {}
    for comp_def in components.values():
        if not isinstance(comp_def, dict):
            continue
        for variant in comp_def.get("variants") or []:
            if not isinstance(variant, dict):
                continue
            svg_rel = variant.get("svg")
            if not svg_rel:
                continue
            variant["svg_path"] = _resolve_svg(svg_rel, spec_path.parent, library_root)

    # Resolve layout SVG paths.
    layouts = spec.get("layout_templates") or {}
    for layout_def in layouts.values():
        if not isinstance(layout_def, dict):
            continue
        svg_rel = layout_def.get("svg")
        if not svg_rel:
            continue
        layout_def["svg_path"] = _resolve_svg(svg_rel, spec_path.parent, library_root)

    return spec


def _resolve_svg(svg_rel: str, spec_dir: Path, library_root: Path) -> str:
    """Resolve an SVG reference to an absolute path.

    Resolution order:
        1. Relative to spec file's directory.
        2. Relative to library_root.
        3. Returns whichever exists; if neither, returns library_root candidate
           (validator flags missing files as warnings).

    Args:
        svg_rel: SVG path from spec.
        spec_dir: Directory containing spec file.
        library_root: System library root.

    Returns:
        Absolute path string to SVG.
    """
    rel = Path(svg_rel)
    candidate_a = (spec_dir / rel).resolve()
    if candidate_a.exists():
        return str(candidate_a)
    candidate_b = (library_root / rel).resolve()
    return str(candidate_b)


def clear_cache() -> None:
    """Clear the in-process spec cache.

    Useful for tests that re-author specs on disk between assertions.
    """
    _CACHE.clear()
