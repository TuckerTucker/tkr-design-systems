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
import copy
import hashlib
from pathlib import Path
from typing import Any

import yaml

from .errors import Error, Result
from .registry import Registry
from .contrast import GATES
from .token_file import apply_tokens_to_spec, load_token_file, token_file_path
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


def load_system(
    system_id: str,
    validate: bool = True,
    _chain: list[str] | None = None,
) -> Result:
    """Load and normalize a system spec by id.

    Returns a Result whose data is a normalized spec dict with:
      - `_meta`: {spec_version, system_version, checksum, spec_path, library_root,
        and, when the spec declares a token file, tokens_path, tokens_checksum,
        contract_version, and (validated loads) color_gates = {contrast,
        hue_gate} per-pair reports, see contrast.GateReport.summary}
      - `tokens.contract`: the system's canonical token document
        (systems/<id>/tokens.json), when declared
      - legacy token locations (`tokens.colors.page_bg`, `tokens.borders.radius_*`,
        `tokens.spacing.grid_unit` ...) filled from the token file, and
        `{group.token}` aliases resolved (see token_file.apply_tokens_to_spec)
      - `components.*.variants[*].svg_path`: absolute SVG path
      - `layout_templates.*.svg_path`: absolute SVG path

    When `system.extends` is set, the parent spec is loaded recursively
    and merged (child wins on conflict). Parent lookup goes through the
    layered registry, so a user-overlay system can extend a built-in one
    (each side's SVG paths are resolved against its own library before
    the merge). See `_merge_specs` for merge semantics.

    Caching is per-process; survives multiple invocations but doesn't leak
    across processes.

    Args:
        system_id: The system id (e.g. "swiss").
        validate: If True (default), schema checks are run; if False,
            skipped (used by tests loading incomplete specs).
        _chain: Internal — tracks the extends chain for cycle detection.

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

    spec_path = entry.spec_path()
    if not spec_path.exists():
        return Result.failure(Error(
            "SPEC_FILE_MISSING",
            f"Registered spec for '{system_id}' is missing at {spec_path}",
            {"system_id": system_id, "expected_path": str(spec_path)},
        ))

    spec_digest = _checksum(spec_path)
    digest = spec_digest

    # Build compound cache key when extends is present so the cache
    # invalidates when either child or parent spec changes.
    cache_key = str(spec_path)
    tokens_path: Path | None = None
    try:
        _raw = yaml.safe_load(spec_path.read_text()) or {}
        # The canonical token file is part of the cache identity: editing
        # tokens.json must invalidate the cached spec just like spec.yaml.
        tokens_path = token_file_path(spec_path, _raw)
        if tokens_path is not None and tokens_path.exists():
            digest = f"{spec_digest}:tokens:{_checksum(tokens_path)}"
        _extends_peek = (_raw.get("system") or {}).get("extends")
        if _extends_peek:
            parent_entry = reg.get(_extends_peek)
            if parent_entry is not None:
                parent_spec_path = parent_entry.spec_path()
                if parent_spec_path.exists():
                    cache_key = f"{spec_path}:extends:{_checksum(parent_spec_path)}"
    except yaml.YAMLError:
        pass
    cached = _CACHE.get(cache_key)
    if cached is not None and cached[0] == digest:
        return Result.success(cached[1])

    library_root = entry.library_path()

    # Validate (pass library_root so SVG path warnings are accurate)
    warnings: list[Error] = []
    color_gates: dict | None = None
    if validate:
        val_result = validate_spec(spec_path, library_root=library_root)
        if not val_result.ok:
            return val_result
        if val_result.data:
            color_gates = {key: val_result.data[key] for key, _ in GATES
                           if key in val_result.data} or None
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

    spec = _normalize(spec, spec_path, library_root, entry, spec_digest)

    if tokens_path is not None:
        tok_result = _apply_token_file(spec, tokens_path, validate, warnings)
        if not tok_result.ok:
            return tok_result
        spec = tok_result.data
    if color_gates is not None:
        spec["_meta"]["color_gates"] = color_gates

    # Handle extends (inheritance).
    extends_id = (spec.get("system") or {}).get("extends")
    if extends_id:
        chain = _chain or []
        if extends_id in chain or extends_id == system_id:
            cycle_path = " → ".join(chain + [system_id, extends_id])
            return Result.failure(Error(
                "SCHEMA_VALIDATION_FAILED",
                f"Circular extends detected: {cycle_path}",
                {"chain": chain, "system_id": system_id, "extends": extends_id},
            ))

        parent_result = load_system(
            extends_id,
            validate=validate,
            _chain=chain + [system_id],
        )
        if not parent_result.ok:
            return Result.failure(Error(
                "SCHEMA_VALIDATION_FAILED",
                f"System '{system_id}' extends '{extends_id}' which failed to load: "
                + "; ".join(e.message for e in parent_result.errors),
                {"system_id": system_id, "extends": extends_id},
            ))

        parent_spec = parent_result.data
        if parent_result.warnings:
            warnings.extend(parent_result.warnings)

        parent_chain = parent_spec.get("_meta", {}).get("resolved_chain", [extends_id])
        spec["_meta"]["extends"] = extends_id
        spec["_meta"]["resolved_chain"] = [system_id] + parent_chain

        spec = _merge_specs(spec, parent_spec)

    _CACHE[cache_key] = (digest, spec)
    return Result.success(spec, warnings=warnings or None)


def _apply_token_file(
    spec: dict, tokens_path: Path, validate: bool, warnings: list[Error]
) -> Result:
    """Apply the system's canonical token file to a normalized spec.

    Token values come from ``tokens.json`` (the source of truth); see
    ``token_file.apply_tokens_to_spec`` for the projection into the legacy
    spec shape that pre-v0.3 consumers read.

    Args:
        spec: Normalized spec dict (has ``_meta``).
        tokens_path: Absolute path of the declared token file.
        validate: When True a missing/unparseable file fails the load;
            when False it degrades to a warning and the spec is returned
            without token values.
        warnings: Accumulator for non-fatal problems.

    Returns:
        Result with ``data`` = the spec with tokens applied.
    """
    loaded = load_token_file(tokens_path)
    if not loaded.ok:
        if validate:
            return loaded
        warnings.extend(loaded.errors)
        return Result.success(spec)

    resolved, unresolved = apply_tokens_to_spec(spec, loaded.data)
    for alias in unresolved:
        warnings.append(Error(
            "TOKEN_DRIFT",
            f"spec references token '{alias}' which {tokens_path.name} does not define",
            {"token": alias, "tokens_path": str(tokens_path)},
        ))
    resolved["_meta"]["tokens_path"] = str(tokens_path)
    resolved["_meta"]["tokens_checksum"] = _checksum(tokens_path)
    resolved["_meta"]["contract_version"] = loaded.data.get("contract_version")
    logger.debug("tokens_applied", system_id=resolved["_meta"].get("system_id"),
                 tokens_path=str(tokens_path), unresolved=len(unresolved))
    return Result.success(resolved)


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


def _merge_specs(child: dict, parent: dict) -> dict:
    """Deep-merge parent spec into child spec (child wins on conflict).

    Merge semantics per section:
      tokens:            shallow merge at each sub-key level
      components:        merge by component key; child adds/overrides
      layout_templates:  merge by template key; child adds/overrides
      rulebook:          concatenate (parent first, child appended)
      grammar_extensions: recursive dict merge (child keys override)
      system/spec_version/artifact_treatments: child wins entirely
      _meta:             preserve child's _meta (includes lineage)

    Both specs are already normalized, so inherited component/layout
    entries keep their absolute svg_path resolved against the parent's
    own library — cross-layer inheritance needs no path fixups here.

    Args:
        child: Normalized child spec dict (already has _meta).
        parent: Normalized parent spec dict (already has _meta).

    Returns:
        New merged spec dict. Does not mutate child or parent.
    """
    merged = copy.deepcopy(parent)

    # tokens: shallow merge at each sub-section
    child_tokens = child.get("tokens") or {}
    merged_tokens = merged.get("tokens") or {}
    for section_key, child_section in child_tokens.items():
        if isinstance(child_section, dict) and isinstance(merged_tokens.get(section_key), dict):
            merged_tokens[section_key] = {**merged_tokens[section_key], **child_section}
        else:
            merged_tokens[section_key] = copy.deepcopy(child_section)
    merged["tokens"] = merged_tokens

    # components: merge by key
    child_comps = child.get("components") or {}
    merged_comps = merged.get("components") or {}
    for comp_key, comp_val in child_comps.items():
        merged_comps[comp_key] = copy.deepcopy(comp_val)
    merged["components"] = merged_comps

    # layout_templates: merge by key
    child_layouts = child.get("layout_templates") or {}
    merged_layouts = merged.get("layout_templates") or {}
    for layout_key, layout_val in child_layouts.items():
        merged_layouts[layout_key] = copy.deepcopy(layout_val)
    merged["layout_templates"] = merged_layouts

    # rulebook: concatenate (parent first)
    parent_rules = parent.get("rulebook") or []
    child_rules = child.get("rulebook") or []
    merged["rulebook"] = copy.deepcopy(parent_rules) + copy.deepcopy(child_rules)

    # grammar_extensions: recursive dict merge
    parent_gx = parent.get("grammar_extensions") or {}
    child_gx = child.get("grammar_extensions") or {}
    merged["grammar_extensions"] = _deep_merge_dicts(parent_gx, child_gx)

    # system block, spec_version, artifact_treatments: child wins entirely
    merged["system"] = copy.deepcopy(child.get("system") or merged.get("system"))
    merged["spec_version"] = child.get("spec_version") or merged.get("spec_version")
    if "artifact_treatments" in child:
        merged["artifact_treatments"] = copy.deepcopy(child["artifact_treatments"])

    # _meta: preserve child's (includes extends + resolved_chain)
    merged["_meta"] = copy.deepcopy(child["_meta"])

    return merged


def _deep_merge_dicts(base: dict, override: dict) -> dict:
    """Recursively merge two dicts. Override wins on conflict at leaf level.

    Args:
        base: Base dict.
        override: Override dict (wins on conflict).

    Returns:
        New merged dict.
    """
    result = copy.deepcopy(base)
    for key, val in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(val, dict):
            result[key] = _deep_merge_dicts(result[key], val)
        else:
            result[key] = copy.deepcopy(val)
    return result


def clear_cache() -> None:
    """Clear the in-process spec cache.

    Useful for tests that re-author specs on disk between assertions.
    """
    _CACHE.clear()
