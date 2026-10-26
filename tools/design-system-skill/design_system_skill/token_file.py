"""Canonical per-system token files (``systems/<id>/tokens.json``, issue #4).

A token file is the single source of truth for a system's token *values*.
It is keyed by the semantic contract in ``contract.py``; see
``docs/specs/TOKENS.md`` for the format and how JSX and builders consume it.

This module owns:
  - locating a spec's token file (``system.tokens_file`` in spec.yaml),
  - parsing and validating a token document against the contract,
  - reading token paths (``color.page_bg``, ``extras.color.rule_hairline``),
  - resolving per-mode overrides (``modes``),
  - resolving ``{group.token}`` aliases inside spec.yaml.

All functions are pure apart from ``load_token_file``; callers inject the
document they loaded, which keeps the loader, validator, drift check and
tests independent of the filesystem layout.
"""

from __future__ import annotations

import copy
import itertools
import json
import re
from pathlib import Path
from typing import Any, Iterator

import structlog
import yaml

from .contract import (
    CONTRACT_GROUPS,
    CONTRACT_TOKENS,
    CONTRACT_VERSION,
    KIND_COLOR,
    KIND_FONT_STACK,
    PAIR_KINDS,
    TOKENS_BY_PATH,
    check_value,
    normalize_color,
    parse_color,
)
from .errors import Error, Result

logger = structlog.get_logger(__name__)


TOKEN_FILE_NAME = "tokens.json"

TOKEN_ROOTS: frozenset[str] = frozenset(CONTRACT_GROUPS) | {"extras"}
"""Top-level keys a token path may start with."""

_RESERVED_KEYS = frozenset({
    "$schema", "contract_version", "system", "source", "description",
    "extras", "modes", "notes", "contrast_pairs",
})

ALIAS_RE = re.compile(
    r"\{((?:" + "|".join(sorted(TOKEN_ROOTS)) + r")(?:\.[a-z0-9_]+)+)\}"
)
"""Matches ``{color.page_bg}``-style aliases embedded in spec strings."""


# ─── Locating + loading ─────────────────────────────────────────────

def token_file_path(spec_path: str | Path, spec_data: dict[str, Any]) -> Path | None:
    """Return the token file a spec declares, resolved against the spec dir.

    Args:
        spec_path: Path to the spec.yaml file.
        spec_data: Parsed spec mapping.

    Returns:
        Absolute path declared by ``system.tokens_file``, or ``None`` when
        the spec does not declare one.
    """
    sys_block = spec_data.get("system") if isinstance(spec_data, dict) else None
    rel = (sys_block or {}).get("tokens_file") if isinstance(sys_block, dict) else None
    if not rel or not isinstance(rel, str):
        return None
    return (Path(spec_path).resolve().parent / rel).resolve()


def load_token_file(path: str | Path) -> Result:
    """Read and parse a token file (no contract validation).

    Args:
        path: Path to a ``tokens.json`` file.

    Returns:
        Result with ``data`` = the parsed mapping.
    """
    p = Path(path)
    if not p.exists():
        return Result.failure(Error(
            "REFERENCED_FILE_MISSING",
            f"Token file not found: {p}",
            {"tokens_path": str(p)},
        ))
    try:
        doc = json.loads(p.read_text())
    except json.JSONDecodeError as exc:
        return Result.failure(Error(
            "SPEC_PARSE_FAILED",
            f"Token file is not valid JSON ({p}): {exc}",
            {"tokens_path": str(p)},
        ))
    if not isinstance(doc, dict):
        return Result.failure(Error(
            "SCHEMA_VALIDATION_FAILED",
            f"Token file top level must be an object: {p}",
            {"tokens_path": str(p)},
        ))
    return Result.success(doc)


# ─── Reading ────────────────────────────────────────────────────────

_MISSING = object()      # "absent" marker callers pass as default and compare against
_NO_DEFAULT = object()   # get_token: raise KeyError when absent


def get_token(doc: dict[str, Any], path: str, default: Any = _NO_DEFAULT) -> Any:
    """Read a dotted token path from a token document.

    Args:
        doc: Token document.
        path: Dotted path, e.g. ``color.page_bg`` or ``extras.color.ink_1``.
        default: Returned when the path is absent. If omitted, ``KeyError``
            is raised instead.

    Returns:
        The value at ``path``.

    Raises:
        KeyError: When the path is absent and no default was given.
    """
    node: Any = doc
    for part in path.split("."):
        if isinstance(node, dict) and part in node:
            node = node[part]
        else:
            if default is _NO_DEFAULT:
                raise KeyError(path)
            return default
    return node


def has_token(doc: dict[str, Any], path: str) -> bool:
    """Return True if ``path`` resolves in ``doc``."""
    return get_token(doc, path, None) is not None


def iter_leaf_tokens(doc: dict[str, Any]) -> Iterator[tuple[str, Any]]:
    """Yield ``(path, value)`` for every leaf under contract groups and extras.

    ``type`` roles are yielded whole (they are leaves of the contract), as
    are lists such as ``space.steps``.

    Args:
        doc: Token document.

    Yields:
        Dotted path and value pairs.
    """
    def walk(prefix: str, node: Any) -> Iterator[tuple[str, Any]]:
        is_type_role = prefix.startswith(("type.", "extras.type."))
        if isinstance(node, dict) and not is_type_role:
            for key, val in node.items():
                yield from walk(f"{prefix}.{key}", val)
        else:
            yield prefix, node

    for root in (*CONTRACT_GROUPS, "extras"):
        if root in doc:
            yield from walk(root, doc[root])


def color_values(doc: dict[str, Any], include_modes: bool = True) -> set[str]:
    """Return every normalized colour value the document can produce.

    Args:
        doc: Token document.
        include_modes: Also include every mode override value.

    Returns:
        Set of normalized colour strings (see ``normalize_color``).
    """
    out: set[str] = set()
    for _, val in iter_leaf_tokens(doc):
        norm = normalize_color(val)
        if norm:
            out.add(norm)
    if include_modes:
        for axis in (doc.get("modes") or {}).get("axes") or []:
            for overrides in (axis.get("options") or {}).values():
                for val in (overrides or {}).values():
                    norm = normalize_color(val)
                    if norm:
                        out.add(norm)
    return out


def font_values(doc: dict[str, Any]) -> set[str]:
    """Return every font stack declared in ``font`` and ``extras.font``."""
    fonts = dict(doc.get("font") or {})
    fonts.update((doc.get("extras") or {}).get("font") or {})
    return {v for v in fonts.values() if isinstance(v, str)}


# ─── Modes ──────────────────────────────────────────────────────────

def mode_axes(doc: dict[str, Any]) -> list[dict[str, Any]]:
    """Return the document's mode axes (empty list for single-mode systems)."""
    return list((doc.get("modes") or {}).get("axes") or [])


def default_mode_selection(doc: dict[str, Any]) -> dict[str, str]:
    """Return ``{axis_id: default_option}`` for every axis."""
    return {a["id"]: a["default"] for a in mode_axes(doc)}


def iter_mode_selections(doc: dict[str, Any]) -> Iterator[dict[str, str]]:
    """Yield every combination of mode options (cartesian product).

    Single-mode systems yield exactly one empty selection, so a contrast
    gate can always loop ``for sel in iter_mode_selections(doc)``.

    Args:
        doc: Token document.

    Yields:
        ``{axis_id: option_id}`` mappings.
    """
    axes = mode_axes(doc)
    if not axes:
        yield {}
        return
    ids = [a["id"] for a in axes]
    options = [list((a.get("options") or {}).keys()) for a in axes]
    for combo in itertools.product(*options):
        yield dict(zip(ids, combo))


def resolve_mode(doc: dict[str, Any], selection: dict[str, str] | None = None) -> dict[str, Any]:
    """Return a copy of ``doc`` with mode overrides applied.

    Axes apply in declaration order; a later axis wins on conflict.
    Unselected axes fall back to their default option. The returned
    document keeps ``modes`` but its contract values reflect the
    selection.

    Args:
        doc: Token document.
        selection: ``{axis_id: option_id}``; missing axes use defaults.

    Returns:
        A deep copy with overrides applied.

    Raises:
        KeyError: When the selection names an unknown axis or option.
    """
    selection = dict(selection or {})
    resolved = copy.deepcopy(doc)
    axes = mode_axes(doc)
    known = {a["id"] for a in axes}
    unknown = set(selection) - known
    if unknown:
        raise KeyError(f"unknown mode axes {sorted(unknown)}; known {sorted(known)}")
    for axis in axes:
        option = selection.get(axis["id"], axis["default"])
        overrides = (axis.get("options") or {}).get(option)
        if overrides is None:
            raise KeyError(f"mode axis {axis['id']!r} has no option {option!r}")
        for path, value in overrides.items():
            _set_path(resolved, path, copy.deepcopy(value))
    return resolved


def _set_path(doc: dict[str, Any], path: str, value: Any) -> None:
    node = doc
    parts = path.split(".")
    for part in parts[:-1]:
        node = node.setdefault(part, {})
    node[parts[-1]] = value


# ─── Validation ─────────────────────────────────────────────────────

def validate_token_document(doc: dict[str, Any], source: str = "") -> tuple[list[Error], list[Error]]:
    """Validate a token document against the contract.

    Errors (blocking):
      - ``contract_version`` missing or unsupported; ``system`` missing.
      - a contract token missing, or its value of the wrong shape.
      - an unknown key inside a contract group (extras belong in ``extras``).
      - malformed ``modes`` (unknown default, override of an unknown path,
        override value of the wrong kind, default option disagreeing with
        the base value).
      - ``notes`` / ``contrast_pairs`` referencing unknown token paths.

    Args:
        doc: Parsed token document.
        source: Path or label used in error details.

    Returns:
        ``(errors, warnings)``.
    """
    errors: list[Error] = []
    warnings: list[Error] = []

    def err(msg: str, **detail: Any) -> None:
        errors.append(Error("SCHEMA_VALIDATION_FAILED", msg, {"tokens_path": source, **detail}))

    version = doc.get("contract_version")
    if version != CONTRACT_VERSION:
        err(f"tokens: contract_version must be {CONTRACT_VERSION!r}, got {version!r}",
            contract_version=version)
    if not isinstance(doc.get("system"), str) or not doc.get("system"):
        err("tokens: 'system' (the system id) is required")

    unknown_top = set(doc) - set(CONTRACT_GROUPS) - _RESERVED_KEYS
    for key in sorted(unknown_top):
        err(f"tokens: unknown top-level key '{key}' (put system-specific tokens under 'extras')",
            key=key)

    font_keys = list((doc.get("font") or {}).keys())
    for token in CONTRACT_TOKENS:
        value = get_token(doc, token.path, _MISSING)
        if value is _MISSING:
            err(f"tokens: missing contract token '{token.path}'", token=token.path)
            continue
        reason = check_value(token.kind, value, font_keys)
        if reason:
            err(f"tokens: '{token.path}' {reason}", token=token.path)

    for group in CONTRACT_GROUPS:
        node = doc.get(group)
        if node is None:
            continue
        if not isinstance(node, dict):
            err(f"tokens: group '{group}' must be an object", group=group)
            continue
        for key in node:
            if f"{group}.{key}" not in TOKENS_BY_PATH:
                err(f"tokens: '{group}.{key}' is not a contract token; move it to 'extras.{group}'",
                    token=f"{group}.{key}")

    extras = doc.get("extras", {})
    if not isinstance(extras, dict):
        err("tokens: 'extras' must be an object")

    _validate_modes(doc, err)
    _validate_notes(doc, err)
    _validate_pairs(doc, err)
    return errors, warnings


def _kind_of(path: str, doc: dict[str, Any]) -> str | None:
    token = TOKENS_BY_PATH.get(path)
    if token:
        return token.kind
    if path.startswith("extras.color."):
        return KIND_COLOR
    if path.startswith("extras.font."):
        return KIND_FONT_STACK
    return None


def _validate_modes(doc: dict[str, Any], err) -> None:
    modes = doc.get("modes")
    if modes is None:
        return
    axes = modes.get("axes") if isinstance(modes, dict) else None
    if not isinstance(axes, list) or not axes:
        err("tokens: 'modes.axes' must be a non-empty list")
        return
    font_keys = list((doc.get("font") or {}).keys())
    seen: set[str] = set()
    for axis in axes:
        if not isinstance(axis, dict) or not axis.get("id"):
            err("tokens: every mode axis needs an 'id'")
            continue
        aid = axis["id"]
        if aid in seen:
            err(f"tokens: duplicate mode axis '{aid}'", axis=aid)
        seen.add(aid)
        options = axis.get("options")
        if not isinstance(options, dict) or not options:
            err(f"tokens: modes axis '{aid}' needs a non-empty 'options' object", axis=aid)
            continue
        default = axis.get("default")
        if default not in options:
            err(f"tokens: modes axis '{aid}' default {default!r} is not one of its options",
                axis=aid)
        for opt_id, overrides in options.items():
            if not isinstance(overrides, dict):
                err(f"tokens: modes.{aid}.{opt_id} must be an object of path: value overrides",
                    axis=aid, option=opt_id)
                continue
            for path, value in overrides.items():
                base = get_token(doc, path, _MISSING)
                if base is _MISSING:
                    err(f"tokens: modes.{aid}.{opt_id} overrides unknown token '{path}'",
                        axis=aid, option=opt_id, token=path)
                    continue
                kind = _kind_of(path, doc)
                if kind:
                    reason = check_value(kind, value, font_keys)
                    if reason:
                        err(f"tokens: modes.{aid}.{opt_id} '{path}' {reason}",
                            axis=aid, option=opt_id, token=path)
                if opt_id == default and not _values_equal(base, value):
                    err(f"tokens: base value of '{path}' ({base!r}) must equal the default "
                        f"option '{aid}.{opt_id}' ({value!r}) — base values are the default "
                        f"resolved state", axis=aid, option=opt_id, token=path)


def _values_equal(a: Any, b: Any) -> bool:
    na, nb = normalize_color(a), normalize_color(b)
    if na is not None and nb is not None:
        return na == nb
    return a == b


def _validate_notes(doc: dict[str, Any], err) -> None:
    notes = doc.get("notes")
    if notes is None:
        return
    if not isinstance(notes, dict):
        err("tokens: 'notes' must be an object keyed by token path")
        return
    for path, note in notes.items():
        if get_token(doc, path, _MISSING) is _MISSING:
            err(f"tokens: notes reference unknown token '{path}'", token=path)
        if not isinstance(note, dict) or not isinstance(note.get("note"), str):
            err(f"tokens: notes['{path}'] must be an object with a 'note' string", token=path)
        elif "derived" in note and not isinstance(note["derived"], bool):
            err(f"tokens: notes['{path}'].derived must be a boolean", token=path)


def _validate_pairs(doc: dict[str, Any], err) -> None:
    pairs = doc.get("contrast_pairs")
    if pairs is None:
        return
    if not isinstance(pairs, list):
        err("tokens: 'contrast_pairs' must be a list")
        return
    for i, pair in enumerate(pairs):
        if not isinstance(pair, dict):
            err(f"tokens: contrast_pairs[{i}] must be an object")
            continue
        for side in ("fg", "bg"):
            path = pair.get(side)
            if not isinstance(path, str) or parse_color(get_token(doc, path, None)) is None:
                err(f"tokens: contrast_pairs[{i}].{side} {path!r} is not a colour token path",
                    index=i)
        if pair.get("kind") not in PAIR_KINDS:
            err(f"tokens: contrast_pairs[{i}].kind {pair.get('kind')!r} not in {sorted(PAIR_KINDS)}",
                index=i)


# ─── Projection into the legacy spec shape ──────────────────────────

LEGACY_PROJECTION: tuple[tuple[tuple[str, ...], str], ...] = (
    (("tokens", "colors", "page_bg"), "color.page_bg"),
    (("tokens", "colors", "surface"), "color.surface"),
    (("tokens", "colors", "surface_elevated"), "color.surface_elevated"),
    (("tokens", "colors", "text_primary"), "color.text_primary"),
    (("tokens", "colors", "text_secondary"), "color.text_secondary"),
    (("tokens", "colors", "text_muted"), "color.text_muted"),
    (("tokens", "colors", "accent"), "color.accent"),
    (("tokens", "borders", "radius_default"), "radius.default"),
    (("tokens", "borders", "radius_inputs"), "radius.input"),
    (("tokens", "borders", "radius_chrome"), "radius.chrome"),
    (("tokens", "spacing", "grid_unit"), "space.unit"),
    (("tokens", "spacing", "allowed_steps"), "space.steps"),
    (("tokens", "elevation", "strategy"), "elevation.strategy"),
)
"""Where pre-v0.3 consumers read token values in a loaded spec.

The loader writes each token value to its legacy location so consumers
written against v0.2 (wireframe-skill ``tokens.py``, MCP ``wf_get_tokens``,
``ref:tokens.colors.page_bg`` treatments) keep working unchanged. v0.3
spec.yaml files omit these keys; a literal left in place must equal the
token value (enforced by the drift check).
"""


def get_spec_path(spec: dict[str, Any], keys: tuple[str, ...], default: Any = None) -> Any:
    """Read a nested key path from a spec mapping."""
    node: Any = spec
    for k in keys:
        if not isinstance(node, dict) or k not in node:
            return default
        node = node[k]
    return node


def apply_tokens_to_spec(spec: dict[str, Any], doc: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    """Return a copy of ``spec`` with its token file applied.

    Steps, in order:
      1. Resolve ``{group.token}`` aliases anywhere in the spec.
      2. Fill ``value`` on ``tokens.colors.palette`` entries that carry a
         ``token:`` reference.
      3. Project contract values to their legacy locations
         (``LEGACY_PROJECTION``); the token file wins over any literal.
      4. Attach the whole token document at ``tokens.contract``.

    Args:
        spec: Parsed spec mapping (not mutated).
        doc: Token document for the spec's system.

    Returns:
        ``(resolved_spec, unresolved_alias_paths)``.
    """
    resolved, unresolved = resolve_aliases(spec, doc)
    tokens = resolved.setdefault("tokens", {})
    if not isinstance(tokens, dict):
        return resolved, unresolved

    palette = get_spec_path(resolved, ("tokens", "colors", "palette")) or []
    for entry in palette:
        if isinstance(entry, dict) and isinstance(entry.get("token"), str):
            value = get_token(doc, entry["token"], _MISSING)
            if value is _MISSING:
                unresolved.append(entry["token"])
            else:
                entry["value"] = value

    for keys, token_path in LEGACY_PROJECTION:
        value = get_token(doc, token_path, _MISSING)
        if value is _MISSING:
            continue
        node = resolved
        for k in keys[:-1]:
            nxt = node.get(k)
            if not isinstance(nxt, dict):
                nxt = {}
                node[k] = nxt
            node = nxt
        node[keys[-1]] = copy.deepcopy(value)

    tokens["contract"] = copy.deepcopy(doc)
    return resolved, unresolved


def read_spec_with_tokens(spec_path: str | Path) -> Result:
    """Parse a spec.yaml file and apply its token file, without the registry.

    For tools that work on a spec file directly (builders, exporters)
    rather than through ``load_system``. No schema validation is run; use
    ``validate_spec`` / the drift check for that.

    Args:
        spec_path: Path to spec.yaml.

    Returns:
        Result with ``data`` = the spec mapping with tokens applied (see
        ``apply_tokens_to_spec``). Specs that declare no token file are
        returned as parsed.
    """
    path = Path(spec_path).resolve()
    try:
        spec = yaml.safe_load(path.read_text()) or {}
    except FileNotFoundError:
        return Result.failure(Error("SPEC_FILE_MISSING", f"Spec file not found: {path}",
                                    {"path": str(path)}))
    except yaml.YAMLError as exc:
        return Result.failure(Error("SPEC_PARSE_FAILED", f"YAML parse error: {exc}",
                                    {"path": str(path)}))
    tok_path = token_file_path(path, spec)
    if tok_path is None:
        return Result.success(spec)
    loaded = load_token_file(tok_path)
    if not loaded.ok:
        return loaded
    resolved, unresolved = apply_tokens_to_spec(spec, loaded.data)
    warnings = [
        Error("TOKEN_DRIFT", f"spec references token '{a}' which {tok_path.name} does not define",
              {"token": a, "tokens_path": str(tok_path)})
        for a in unresolved
    ]
    return Result.success(resolved, warnings=warnings or None)


# ─── Alias resolution inside spec.yaml ──────────────────────────────

def find_aliases(obj: Any) -> Iterator[tuple[str, str]]:
    """Yield ``(location, alias_path)`` for every alias inside ``obj``.

    Args:
        obj: Any YAML-shaped value (dict / list / scalar).

    Yields:
        Dotted location inside ``obj`` and the alias token path.
    """
    def walk(loc: str, node: Any) -> Iterator[tuple[str, str]]:
        if isinstance(node, dict):
            for k, v in node.items():
                yield from walk(f"{loc}.{k}" if loc else str(k), v)
        elif isinstance(node, list):
            for i, v in enumerate(node):
                yield from walk(f"{loc}[{i}]", v)
        elif isinstance(node, str):
            for m in ALIAS_RE.finditer(node):
                yield loc, m.group(1)

    yield from walk("", obj)


def resolve_aliases(obj: Any, doc: dict[str, Any]) -> tuple[Any, list[str]]:
    """Replace ``{group.token}`` aliases in ``obj`` with token values.

    A string that is exactly one alias takes the token's value with its
    native type (so ``"{radius.default}"`` becomes the number 0). An alias
    embedded in a longer string is interpolated as text
    (``"1px solid {color.border_default}"``). Unresolvable aliases are
    left untouched and reported.

    Args:
        obj: YAML-shaped value; not mutated.
        doc: Token document supplying values.

    Returns:
        ``(resolved_copy, unresolved_alias_paths)``.
    """
    unresolved: list[str] = []

    def sub(node: Any) -> Any:
        if isinstance(node, dict):
            return {k: sub(v) for k, v in node.items()}
        if isinstance(node, list):
            return [sub(v) for v in node]
        if isinstance(node, str) and "{" in node:
            whole = ALIAS_RE.fullmatch(node)
            if whole:
                value = get_token(doc, whole.group(1), _MISSING)
                if value is _MISSING:
                    unresolved.append(whole.group(1))
                    return node
                return copy.deepcopy(value)

            def repl(m: re.Match[str]) -> str:
                value = get_token(doc, m.group(1), _MISSING)
                if value is _MISSING or isinstance(value, (dict, list)):
                    unresolved.append(m.group(1))
                    return m.group(0)
                return str(value)

            return ALIAS_RE.sub(repl, node)
        return node

    return sub(obj), unresolved
