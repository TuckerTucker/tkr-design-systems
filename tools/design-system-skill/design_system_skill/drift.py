"""Drift check between a spec.yaml and its canonical token file (issue #4).

``tokens.json`` is the source of truth for token values. A spec.yaml may
still carry token-looking values — legacy literals, palette entries,
elevation colours, font stacks, preset tables — and every one of them is
an opportunity for the two files to disagree (commit 313adc5 is the
cautionary tale: the Riso spec disagreed with the implementation on every
colour). This module finds those disagreements.

Checks, per spec:
  1. ``value_mismatch`` — a literal at a ``LEGACY_PROJECTION`` location
     (``tokens.colors.page_bg`` ...) differs from its contract token.
  2. ``unresolved_alias`` — a ``{group.token}`` alias or a palette
     ``token:`` reference names a token the file does not define.
  3. ``palette_mismatch`` — a palette entry has both ``token`` and
     ``value`` and they differ.
  4. ``unknown_literal`` — a colour literal inside the scanned spec
     blocks (``DRIFT_SCAN_ROOTS``) is not produced by the token file in
     any mode, or a typography family stack is not one of its fonts.

Prose fields (``PROSE_KEYS``) are not scanned: they quote colours in
sentences such as "never above #0F140F" and are reviewed by humans.

``tokens.common`` is not scanned either: it is generated from the token
file (``common_tokens``), and ``common-tokens --check`` compares it with a
fresh derivation exactly. Scanning it here would only re-read the
derivation lossily (``rgba()`` alpha rounds to an 8-bit hex channel).
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Callable, Iterator

import structlog
import yaml

from .contract import normalize_color
from .errors import Error, Result
from .token_file import (
    LEGACY_PROJECTION,
    color_values,
    find_aliases,
    font_values,
    get_spec_path,
    get_token,
    load_token_file,
    token_file_path,
)

logger = structlog.get_logger(__name__)


DRIFT_SCAN_ROOTS: tuple[str, ...] = ("tokens", "press_presets")
"""Top-level spec blocks whose colour literals must come from the token file."""

GENERATED_LOCATIONS: tuple[str, ...] = ("tokens.common",)
"""Locations under the scan roots that ``common-tokens --check`` owns."""

PROSE_KEYS = frozenset({
    "role", "usage_constraint", "note", "description", "character", "detail",
    "premise", "mixing_rule", "rendering_notes", "reason", "label",
})

_COLOR_IN_TEXT_RE = re.compile(r"#[0-9A-Fa-f]{8}\b|#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b|rgba?\([^)]*\)")

_MISSING = object()


@dataclass(frozen=True)
class DriftItem:
    """One disagreement between spec.yaml and the token file.

    Attributes:
        kind: ``value_mismatch`` | ``unresolved_alias`` | ``palette_mismatch``
            | ``unknown_literal``.
        location: Dotted location inside spec.yaml.
        spec_value: The value found in spec.yaml.
        token_path: The token path involved, when there is one.
        token_value: The token file's value, when there is one.
        message: Human-readable explanation.
    """

    kind: str
    location: str
    spec_value: Any
    token_path: str | None
    token_value: Any
    message: str


def find_drift(spec: dict[str, Any], doc: dict[str, Any]) -> list[DriftItem]:
    """Compare a raw (unresolved) spec mapping against a token document.

    Args:
        spec: Spec mapping exactly as parsed from spec.yaml.
        doc: Token document for the same system.

    Returns:
        Every disagreement found; empty when the files agree.
    """
    items: list[DriftItem] = []
    items.extend(_check_legacy_literals(spec, doc))
    items.extend(_check_aliases(spec, doc))
    items.extend(_check_palette(spec, doc))
    items.extend(_check_literals(spec, doc))
    return items


def _same(a: Any, b: Any) -> bool:
    na, nb = normalize_color(a), normalize_color(b)
    if na is not None and nb is not None:
        return na == nb
    return a == b


def _is_alias_string(value: Any) -> bool:
    return isinstance(value, str) and "{" in value


def _check_legacy_literals(spec: dict[str, Any], doc: dict[str, Any]) -> Iterator[DriftItem]:
    for keys, token_path in LEGACY_PROJECTION:
        spec_value = get_spec_path(spec, keys, _MISSING)
        if spec_value is _MISSING or _is_alias_string(spec_value):
            continue
        token_value = get_token(doc, token_path, _MISSING)
        if token_value is _MISSING:
            continue  # contract validation reports the missing token
        if not _same(spec_value, token_value):
            loc = ".".join(keys)
            yield DriftItem(
                "value_mismatch", loc, spec_value, token_path, token_value,
                f"{loc} is {spec_value!r} but {token_path} is {token_value!r} "
                f"(the token file wins; delete the literal from spec.yaml)",
            )


def _check_aliases(spec: dict[str, Any], doc: dict[str, Any]) -> Iterator[DriftItem]:
    for location, alias in find_aliases(spec):
        if get_token(doc, alias, _MISSING) is _MISSING:
            yield DriftItem(
                "unresolved_alias", location, "{" + alias + "}", alias, None,
                f"{location} references {{{alias}}}, which the token file does not define",
            )


def _check_palette(spec: dict[str, Any], doc: dict[str, Any]) -> Iterator[DriftItem]:
    palette = get_spec_path(spec, ("tokens", "colors", "palette")) or []
    for i, entry in enumerate(palette):
        if not isinstance(entry, dict) or "token" not in entry:
            continue
        loc = f"tokens.colors.palette[{i}]"
        token_value = get_token(doc, str(entry["token"]), _MISSING)
        if token_value is _MISSING:
            yield DriftItem(
                "unresolved_alias", f"{loc}.token", entry["token"], str(entry["token"]), None,
                f"{loc} ({entry.get('name')}) references token {entry['token']!r}, "
                f"which the token file does not define",
            )
        elif "value" in entry and not _same(entry["value"], token_value):
            yield DriftItem(
                "palette_mismatch", f"{loc}.value", entry["value"], str(entry["token"]), token_value,
                f"{loc} ({entry.get('name')}) has value {entry['value']!r} but token "
                f"{entry['token']} is {token_value!r}",
            )


def _walk_strings(node: Any, loc: str) -> Iterator[tuple[str, str, str | None]]:
    """Yield ``(location, string, parent_key)`` for scannable strings."""
    if isinstance(node, dict):
        for k, v in node.items():
            if k in PROSE_KEYS:
                continue
            child = f"{loc}.{k}"
            if isinstance(v, str):
                yield child, v, str(k)
            else:
                yield from _walk_strings(v, child)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            child = f"{loc}[{i}]"
            if isinstance(v, str):
                yield child, v, None
            else:
                yield from _walk_strings(v, child)


def _check_literals(spec: dict[str, Any], doc: dict[str, Any]) -> Iterator[DriftItem]:
    known_colors = color_values(doc)
    known_fonts = font_values(doc)
    # Locations already covered (with a more precise message) by
    # _check_legacy_literals and _check_palette.
    covered = {".".join(keys) for keys, _ in LEGACY_PROJECTION}
    palette = get_spec_path(spec, ("tokens", "colors", "palette")) or []
    covered |= {
        f"tokens.colors.palette[{i}].value"
        for i, entry in enumerate(palette)
        if isinstance(entry, dict) and "token" in entry
    }
    for root in DRIFT_SCAN_ROOTS:
        if root not in spec:
            continue
        for loc, text, key in _walk_strings(spec[root], root):
            if loc in covered or any(
                    loc == g or loc.startswith(g + ".") for g in GENERATED_LOCATIONS):
                continue
            if key == "stack" and "{" not in text:
                if text not in known_fonts:
                    yield DriftItem(
                        "unknown_literal", loc, text, None, None,
                        f"{loc} font stack {text!r} is not a font in the token file "
                        f"(use an alias such as {{font.body}})",
                    )
                continue
            for m in _COLOR_IN_TEXT_RE.finditer(_strip_aliases(text)):
                norm = normalize_color(m.group(0))
                if norm is None:
                    continue
                if norm not in known_colors:
                    yield DriftItem(
                        "unknown_literal", loc, m.group(0), None, None,
                        f"{loc} uses colour {m.group(0)} which the token file does not "
                        f"produce in any mode (add it to the token file or use an alias)",
                    )


def _strip_aliases(text: str) -> str:
    """Strip alias expressions so their contents are not scanned as literals."""
    return re.sub(r"\{[^}]*\}", "", text)


# ─── File-level API ─────────────────────────────────────────────────

def check_drift(spec_path: str | Path, tokens_path: str | Path | None = None) -> Result:
    """Check one spec.yaml against its token file.

    Args:
        spec_path: Path to spec.yaml.
        tokens_path: Override for the token file; defaults to the spec's
            ``system.tokens_file``.

    Returns:
        Result. ``ok`` is False when drift is found or a file is missing;
        ``data`` always carries ``{system_id, spec_path, tokens_path,
        drift: [DriftItem as dict]}`` when both files could be read.
    """
    spec_path = Path(spec_path).resolve()
    try:
        spec = yaml.safe_load(spec_path.read_text()) or {}
    except FileNotFoundError:
        return Result.failure(Error("SPEC_FILE_MISSING", f"Spec file not found: {spec_path}",
                                    {"path": str(spec_path)}))
    except yaml.YAMLError as exc:
        return Result.failure(Error("SPEC_PARSE_FAILED", f"YAML parse error: {exc}",
                                    {"path": str(spec_path)}))

    tok_path = Path(tokens_path).resolve() if tokens_path else token_file_path(spec_path, spec)
    sys_id = (spec.get("system") or {}).get("id")
    if tok_path is None:
        return Result.failure(Error(
            "SCHEMA_VALIDATION_FAILED",
            f"{spec_path} declares no system.tokens_file; nothing to check drift against",
            {"spec_path": str(spec_path), "system_id": sys_id},
        ))
    loaded = load_token_file(tok_path)
    if not loaded.ok:
        return loaded

    items = find_drift(spec, loaded.data)
    data = {
        "system_id": sys_id,
        "spec_path": str(spec_path),
        "tokens_path": str(tok_path),
        "drift": [asdict(i) for i in items],
    }
    logger.info("drift_checked", system_id=sys_id, drift_count=len(items))
    if items:
        result = Result.failure([
            Error("TOKEN_DRIFT", i.message, {"kind": i.kind, "location": i.location})
            for i in items
        ])
        result.data = data
        return result
    return Result.success(data)


def check_drift_all(
    entries: list[tuple[str, Path]] | None = None,
    checker: Callable[[Path], Result] = check_drift,
) -> Result:
    """Check every registered system (deduplicated by spec path).

    Args:
        entries: Optional ``(system_id, spec_path)`` pairs; defaults to the
            built-in registry layer (a user-overlay system belongs to another
            project, whose own gate owns it). Injected by tests.
        checker: Per-spec check; injectable for tests.

    Returns:
        Result with ``data = {"systems": {id: per-system data}}``; fails
        if any system drifts.
    """
    if entries is None:
        from .registry import Registry
        reg = Registry.load()
        if not reg.ok:
            return reg
        entries = [(e.id, e.spec_path()) for e in reg.data.builtin_entries()]

    systems: dict[str, Any] = {}
    errors: list[Error] = []
    seen: dict[Path, str] = {}
    # Check each spec once, under the id that owns its directory
    # (`wireframe`, not its registry alias `neutral`).
    ordered = sorted(entries, key=lambda e: Path(e[1]).parent.name != e[0])
    for sys_id, spec_path in ordered:
        if spec_path in seen:
            systems[sys_id] = {"alias_of": seen[spec_path]}
            continue
        seen[spec_path] = sys_id
        res = checker(spec_path)
        systems[sys_id] = res.data if res.data is not None else {
            "errors": [e.message for e in res.errors]}
        if not res.ok:
            errors.extend(
                Error(e.code, f"[{sys_id}] {e.message}", {**e.detail, "system_id": sys_id})
                for e in res.errors
            )
    if errors:
        result = Result.failure(errors)
        result.data = {"systems": systems}
        return result
    return Result.success({"systems": systems})
