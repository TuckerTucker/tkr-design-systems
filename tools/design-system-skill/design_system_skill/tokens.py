"""Common token contract: validation and reference resolution.

The portable token layer for tkr-kit's design systems. Every system
that wants to be a target for atomic component synthesis (see
wireframe-skill's decomposition flow) must declare `tokens.common.*`
in its spec.yaml satisfying the contract at
`design-system-skill/schemas/common-tokens.v<N>.yaml`.

This module provides:

  - load_contract(version)         — read the versioned schema file
  - validate_common_tokens(spec)   — check a spec's tokens.common
                                     subtree against the contract;
                                     returns a list of Error objects
  - resolve_token(spec, ref, scope='portable')
                                   — resolve `$ink`, `$type.headline`,
                                     `$space.md`, or `<sys>:<dotted.path>`
                                     to its concrete value

Reference syntax:

  $ink                 → tokens.common.color.ink            (portable)
  $color.ink           → tokens.common.color.ink            (portable, explicit)
  $type.headline       → tokens.common.typography.headline  (portable)
  $space.md            → tokens.common.spacing.md           (portable)
  $stroke.regular      → tokens.common.stroke.regular       (portable)
  $radius.full         → tokens.common.radius.full          (portable)
  swiss:grid.columns   → tokens.system.grid.columns         (system-locked, only when scope=='swiss')

Anything else raises UnknownTokenError or CrossSystemTokenError.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from .errors import Error
from .paths import skill_root


# ─── Errors ─────────────────────────────────────────────────────────


class UnknownTokenError(ValueError):
    """Token reference cannot be resolved against the spec."""


class CrossSystemTokenError(ValueError):
    """Token reference targets a system other than the current scope."""


class MalformedTokenRefError(ValueError):
    """Token reference doesn't parse as a valid form."""


# ─── Contract loading ───────────────────────────────────────────────


# Where contract files live, relative to the skill root. Anchored to
# the skill's own location so registry overrides can't relocate it.
def _schemas_dir() -> Path:
    return skill_root() / "schemas"


@dataclass(frozen=True)
class Contract:
    """Parsed common-tokens.v<N>.yaml."""

    version: str
    required: dict[str, dict[str, dict]]   # category → token_name → meta
    optional: dict[str, dict[str, dict]]   # category → token_name → meta

    def all_token_names(self, category: str) -> set[str]:
        """All token names (required + optional) for a category."""
        return set(self.required.get(category, {}).keys()) | set(
            self.optional.get(category, {}).keys()
        )

    def is_required(self, category: str, name: str) -> bool:
        return name in self.required.get(category, {})

    def category_meta(self, category: str, name: str) -> dict | None:
        """Return the contract metadata for a single token (required or optional)."""
        if name in self.required.get(category, {}):
            return self.required[category][name]
        if name in self.optional.get(category, {}):
            return self.optional[category][name]
        return None


def load_contract(version: str = "1.0") -> Contract:
    """Load and parse the common-tokens contract for a given version.

    Args:
        version: Contract version string (e.g. "1.0"). Maps to
            `design-system-skill/schemas/common-tokens.v<major>.yaml`.

    Returns:
        Parsed Contract object.

    Raises:
        FileNotFoundError: If the contract file does not exist.
        ValueError: If the contract YAML is malformed or version mismatched.
    """
    major = version.split(".")[0]
    contract_path = _schemas_dir() / f"common-tokens.v{major}.yaml"
    if not contract_path.exists():
        raise FileNotFoundError(
            f"common-tokens contract not found at {contract_path}"
        )

    raw = yaml.safe_load(contract_path.read_text())
    declared_version = str(raw.get("version", ""))
    if not declared_version.startswith(major):
        raise ValueError(
            f"Contract version mismatch: requested {version}, file declares {declared_version}"
        )

    return Contract(
        version=declared_version,
        required=raw.get("required") or {},
        optional=raw.get("optional") or {},
    )


# ─── Validation ─────────────────────────────────────────────────────


_HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{3,8}$")
_VALID_CASES = {"lowercase", "uppercase", "mixed"}


def validate_common_tokens(spec: dict, contract: Contract | None = None) -> list[Error]:
    """Validate a spec's tokens.common subtree against the contract.

    The contract is intentionally additive: specs without `tokens.common`
    are not flagged here (they predate the contract). Once a spec declares
    `tokens.common`, however, it must satisfy the contract fully.

    Args:
        spec: Loaded spec dict (post-normalization is fine; pre-normalization
            also works because we don't read `_meta`).
        contract: Pre-loaded Contract, or None to auto-load v1.0.

    Returns:
        List of Error objects (empty if valid or if spec has no tokens.common).
    """
    if contract is None:
        contract = load_contract("1.0")

    errors: list[Error] = []

    tokens = spec.get("tokens") or {}
    common = tokens.get("common")

    if common is None:
        # No common subtree declared — legacy spec, not an error.
        return errors

    # Each contract category must be present and well-formed.
    for category, required_tokens in contract.required.items():
        cat_block = common.get(category)
        if cat_block is None:
            errors.append(Error(
                "COMMON_TOKENS_MISSING_CATEGORY",
                f"tokens.common.{category} is required by the v{contract.version} contract",
                {"category": category, "required_names": sorted(required_tokens.keys())},
            ))
            continue
        if not isinstance(cat_block, dict):
            errors.append(Error(
                "COMMON_TOKENS_MALFORMED_CATEGORY",
                f"tokens.common.{category} must be a mapping, got {type(cat_block).__name__}",
                {"category": category},
            ))
            continue

        # Every required token in this category must be present.
        for token_name, token_meta in required_tokens.items():
            if token_name not in cat_block:
                errors.append(Error(
                    "COMMON_TOKENS_MISSING_TOKEN",
                    f"tokens.common.{category}.{token_name} is required "
                    f"(role: {token_meta.get('role', '')})",
                    {"category": category, "token_name": token_name},
                ))
                continue
            errors.extend(
                _validate_value(category, token_name, cat_block[token_name], token_meta)
            )

        # Optional tokens, when present, must still validate.
        for token_name, token_meta in (contract.optional.get(category) or {}).items():
            if token_name in cat_block:
                errors.extend(
                    _validate_value(category, token_name, cat_block[token_name], token_meta)
                )

        # Surface declared tokens that aren't in the contract at all
        # (typo guard — prevents `$ink-mute` from silently shadowing `$ink-muted`).
        contract_names = contract.all_token_names(category)
        for declared_name in cat_block.keys():
            if declared_name not in contract_names:
                errors.append(Error(
                    "COMMON_TOKENS_UNKNOWN_TOKEN",
                    f"tokens.common.{category}.{declared_name} is not in the v{contract.version} contract",
                    {"category": category, "token_name": declared_name},
                ))

    return errors


def _validate_value(
    category: str, token_name: str, value: Any, meta: dict
) -> list[Error]:
    """Validate a single token value against its declared contract type."""
    errors: list[Error] = []
    declared_type = meta.get("type")

    if declared_type == "color":
        if not isinstance(value, str) or not _HEX_COLOR_RE.match(value):
            errors.append(Error(
                "COMMON_TOKENS_BAD_COLOR",
                f"tokens.common.{category}.{token_name} must be a hex color string, got {value!r}",
                {"category": category, "token_name": token_name, "value": value},
            ))

    elif declared_type == "length":
        if not isinstance(value, (int, float)) or value < 0:
            errors.append(Error(
                "COMMON_TOKENS_BAD_LENGTH",
                f"tokens.common.{category}.{token_name} must be a non-negative number, got {value!r}",
                {"category": category, "token_name": token_name, "value": value},
            ))

    elif declared_type == "text-style":
        if not isinstance(value, dict):
            errors.append(Error(
                "COMMON_TOKENS_BAD_TEXT_STYLE",
                f"tokens.common.{category}.{token_name} must be a mapping, got {type(value).__name__}",
                {"category": category, "token_name": token_name},
            ))
            return errors
        for required_field in ("family", "size", "weight"):
            if required_field not in value:
                errors.append(Error(
                    "COMMON_TOKENS_TEXT_STYLE_MISSING_FIELD",
                    f"tokens.common.{category}.{token_name} missing required field '{required_field}'",
                    {"category": category, "token_name": token_name, "field": required_field},
                ))
        if "weight" in value:
            w = value["weight"]
            if not isinstance(w, int) or w < 100 or w > 900:
                errors.append(Error(
                    "COMMON_TOKENS_TEXT_STYLE_BAD_WEIGHT",
                    f"tokens.common.{category}.{token_name} weight must be 100..900, got {w!r}",
                    {"category": category, "token_name": token_name, "weight": w},
                ))
        if "case" in value and value["case"] not in _VALID_CASES:
            errors.append(Error(
                "COMMON_TOKENS_TEXT_STYLE_BAD_CASE",
                f"tokens.common.{category}.{token_name} case must be one of {sorted(_VALID_CASES)}, got {value['case']!r}",
                {"category": category, "token_name": token_name, "case": value["case"]},
            ))

    return errors


# ─── Resolution ─────────────────────────────────────────────────────


# Recognized portable namespaces and their dotted paths under tokens.common
_PORTABLE_NAMESPACES = {
    "color":  "color",
    "type":   "typography",
    "space":  "spacing",
    "stroke": "stroke",
    "radius": "radius",
}


def resolve_token(spec: dict, ref: str, scope: str = "portable") -> Any:
    """Resolve a token reference against a loaded spec.

    Forms:
      `$ink`               → tokens.common.color.ink            (portable)
      `$color.ink`         → tokens.common.color.ink            (portable, explicit)
      `$type.headline`     → tokens.common.typography.headline  (portable)
      `$space.md`          → tokens.common.spacing.md           (portable)
      `$stroke.regular`    → tokens.common.stroke.regular       (portable)
      `$radius.full`       → tokens.common.radius.full          (portable)
      `<sys>:<dotted.path>` → tokens.system.<dotted.path>       (system-locked)

    Args:
        spec: Loaded spec dict.
        ref: Reference string.
        scope: 'portable' rejects system: refs; '<system_id>' allows refs
            targeting that system only.

    Returns:
        The resolved value (str, int, float, or dict for text-style).

    Raises:
        MalformedTokenRefError: ref doesn't parse as either form.
        CrossSystemTokenError: system: ref targets a different system than scope.
        UnknownTokenError: ref parses but doesn't resolve in this spec.
    """
    if not isinstance(ref, str) or not ref:
        raise MalformedTokenRefError(f"token reference must be a non-empty string, got {ref!r}")

    # Form 2: system-locked reference  `<sys>:<dotted.path>`
    if ":" in ref and not ref.startswith("$"):
        sys_id, _, path = ref.partition(":")
        if not sys_id or not path:
            raise MalformedTokenRefError(f"malformed system ref: {ref!r}")
        if scope == "portable":
            raise CrossSystemTokenError(
                f"system token {ref!r} not allowed in portable scope"
            )
        if scope != sys_id:
            raise CrossSystemTokenError(
                f"system token {ref!r} targets system '{sys_id}' but scope is '{scope}'"
            )
        return _walk_path(spec.get("tokens", {}).get("system", {}), path, ref)

    # Form 1: portable reference, must start with $
    if not ref.startswith("$"):
        raise MalformedTokenRefError(f"portable token ref must begin with '$', got {ref!r}")

    body = ref[1:]
    if not body:
        raise MalformedTokenRefError(f"empty token ref: {ref!r}")

    common = spec.get("tokens", {}).get("common", {})

    if "." in body:
        namespace, _, name = body.partition(".")
        category = _PORTABLE_NAMESPACES.get(namespace)
        if category is None:
            raise MalformedTokenRefError(
                f"unknown portable namespace {namespace!r} in {ref!r} "
                f"(expected one of {sorted(_PORTABLE_NAMESPACES.keys())})"
            )
        cat_block = common.get(category) or {}
        if name not in cat_block:
            raise UnknownTokenError(f"token {ref!r} not declared in tokens.common.{category}")
        return cat_block[name]

    # Bare form like `$ink` — always a color shortcut.
    color_block = common.get("color") or {}
    if body not in color_block:
        raise UnknownTokenError(
            f"token {ref!r} not declared in tokens.common.color "
            f"(bare $name form is a color shortcut)"
        )
    return color_block[body]


def _walk_path(root: dict, dotted: str, ref: str) -> Any:
    """Walk a dotted path through nested dicts."""
    node: Any = root
    for segment in dotted.split("."):
        if not isinstance(node, dict) or segment not in node:
            raise UnknownTokenError(f"token {ref!r} not found at .{segment}")
        node = node[segment]
    return node
