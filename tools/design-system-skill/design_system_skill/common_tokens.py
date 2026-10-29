"""Derive each spec's ``tokens.common`` block (and ``themes``) from tokens.json.

``tokens.common`` is the portable token layer the wireframe skill's atoms
resolve (``$ink``, ``$type.headline``, ``$space.md`` ...), validated
against ``schemas/common-tokens.v1.yaml``. It must not become a second,
hand-kept home for values ``systems/<id>/tokens.json`` already owns, so
this module renders it from the token file and the CLI keeps it current::

    python3 tools/design-system-skill common-tokens --check   # CI gate
    python3 tools/design-system-skill common-tokens --write   # regenerate

The block lives in spec.yaml between marker comments::

    tokens:
      # generated:common-tokens ...
      common:
        ...
      # /generated:common-tokens

It is written into the file (not projected at load time) because callers
read spec.yaml directly — tkr-kit's layout solver and demo theme parse
the raw YAML — and those callers need the values that are on disk.

A token file with a mode axis whose id is ``theme`` (``light`` / ``dark``)
also yields a top-level ``themes:`` block, one portable colour set per
option, between ``# generated:themes`` markers. Other axes (Riso's paper
and ink presses) are print variants, not themes, and produce nothing.

Derivation rules live in ``COLOR_SOURCES``, ``TYPOGRAPHY_SOURCES``,
``SPACING_SOURCES``, ``STROKE_RULES`` and ``RADIUS_RULES``. The only values
that do not come from the token file are the ones it has no equivalent
for, each declared in ``AUTHORED_VALUES`` with its reason.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

import structlog
import yaml

from .contract import parse_color
from .errors import Error, Result
from .token_file import (
    get_token,
    load_token_file,
    mode_axes,
    resolve_mode,
    token_file_path,
)
from .tokens import load_contract

logger = structlog.get_logger(__name__)


CONTRACT_VERSION = "1.0"
"""The common-tokens contract version the generated block satisfies."""

THEME_AXIS = "theme"
"""The mode axis id whose options become the spec's ``themes:`` block."""

COMMON_REGION = "common-tokens"
THEMES_REGION = "themes"

_MISSING = object()


# ─── Derivation rules ───────────────────────────────────────────────

COLOR_SOURCES: dict[str, str] = {
    "ink": "color.text_primary",
    "ink-muted": "color.text_muted",
    "surface": "color.surface",
    "surface-inset": "color.surface_elevated",
    "accent": "color.accent",
    "accent-on": "color.accent_foreground",
    "outline": "color.border_default",
    "outline-strong": "color.border_strong",
    "success": "color.success",
    "warning": "color.warning",
    "danger": "color.danger",
}
"""Contract colour role -> token path. Role descriptions match one-to-one."""

IMAGE_PLACEHOLDER_CANDIDATES: tuple[str, ...] = (
    "color.surface_elevated",
    "color.page_bg",
    "color.border_default",
)
"""``image-placeholder`` takes the first of these that differs from
``color.surface``: a placeholder painted in the surface colour it sits on
would be invisible. The token file has no image-well token of its own."""

TYPOGRAPHY_SOURCES: dict[str, str] = {
    "display": "type.display",
    "headline": "type.title",
    "title": "type.title",
    "body": "type.body",
    "caption": "type.label",
}
"""Contract text role -> token path. ``caption`` (metadata, labels under
fields) is the token file's ``label`` style. The token file declares no
tier between ``display`` and ``title``, so ``headline`` uses ``title``
unless ``HEADLINE_OVERRIDES`` names the system's own section-header style."""

HEADLINE_OVERRIDES: dict[str, str] = {
    # Swiss sets section headers at 32px (rulebook's display_medium), a
    # distinct tier between display (40) and title (22) that tokens.json
    # keeps under extras.
    "swiss": "extras.type.display_medium",
}

SPACING_SOURCES: dict[str, str] = {k: f"space.{k}" for k in ("xs", "sm", "md", "lg", "xl")}
"""The token file names the same five steps."""

STROKE_RULES: dict[str, Callable[[dict[str, Any]], Any]] = {
    # Minimum visible stroke: the thinnest width the system uses at all.
    "hairline": lambda doc: min(
        v for v in (doc.get("border_width") or {}).values() if isinstance(v, (int, float))),
    "regular": lambda doc: get_token(doc, "border_width.default"),
    # Focus rings and selected-state borders.
    "bold": lambda doc: get_token(doc, "border_width.focus"),
}

RADIUS_RULES: dict[str, Callable[[dict[str, Any]], Any]] = {
    "sm": lambda doc: get_token(doc, "radius.input"),
    "md": lambda doc: get_token(doc, "radius.default"),
}

AUTHORED_VALUES: dict[str, tuple[Any, str]] = {
    "radius.none": (0, "the contract fixes `none` at 0 (common-tokens.v1.yaml)"),
    "radius.full": (9999, "a sentinel meaning fully rounded (pills, circles); the token "
                          "file models no pill radius and the value is size-independent"),
}
"""Common tokens with no token-file equivalent, and why."""

CASE_MAP: dict[str, str] = {"none": "mixed", "uppercase": "uppercase", "lowercase": "lowercase"}
"""Token-file ``case`` -> contract ``case``."""

MONOSPACE_GENERIC = "monospace"
"""``code`` is emitted only when ``font.mono`` is a monospace stack (its
generic family is ``monospace``); several systems alias ``mono`` to their
proportional face, and the contract's ``code`` role is monospace text."""


class DerivationError(ValueError):
    """The token file lacks a value a derivation rule needs."""


# ─── Pure derivation ────────────────────────────────────────────────

def to_hex(value: Any, path: str) -> str:
    """Convert any token-file colour spelling to the contract's hex form.

    Args:
        value: Colour from the token file (hex or ``rgba()``).
        path: Token path, for the error message.

    Returns:
        ``#RRGGBB`` for opaque colours, ``#RRGGBBAA`` for translucent ones.

    Raises:
        DerivationError: If ``value`` is not a colour.
    """
    rgba = parse_color(value)
    if rgba is None:
        raise DerivationError(f"{path} is {value!r}, not a colour")
    r, g, b, a = rgba
    if a >= 1.0:
        return f"#{r:02X}{g:02X}{b:02X}"
    return f"#{r:02X}{g:02X}{b:02X}{round(a * 255):02X}"


def _require(doc: dict[str, Any], path: str) -> Any:
    value = get_token(doc, path, _MISSING)
    if value is _MISSING:
        raise DerivationError(f"token file defines no {path}")
    return value


def font_family(doc: dict[str, Any], key: str) -> str:
    """Return a font key's stack as a plain family list (quotes removed).

    ``'Inter', system-ui, sans-serif`` becomes ``Inter, system-ui,
    sans-serif``: still a valid CSS/SVG ``font-family`` list, and a plain
    string for consumers that refuse quoting.

    Args:
        doc: Token document.
        key: Font key (``body``, ``label``, ``mono`` or an ``extras.font`` key).

    Returns:
        The unquoted family list.
    """
    stack = get_token(doc, f"font.{key}", _MISSING)
    if stack is _MISSING:
        stack = _require(doc, f"extras.font.{key}")
    return ", ".join(part.strip().strip("'\"") for part in str(stack).split(","))


def text_style(doc: dict[str, Any], path: str) -> dict[str, Any]:
    """Convert a token-file type style to a contract text-style.

    Args:
        doc: Token document.
        path: Path of the style (``type.body`` ...).

    Returns:
        ``{family, size, weight, leading, case, tracking}``.
    """
    style = _require(doc, path)
    case = CASE_MAP.get(str(style.get("case", "none")))
    if case is None:
        raise DerivationError(f"{path}.case {style.get('case')!r} has no contract equivalent")
    return {
        "family": font_family(doc, str(style["family"])),
        "size": style["size"],
        "weight": style["weight"],
        "leading": style["line_height"],
        "case": case,
        "tracking": style.get("tracking", 0),
    }


def derive_colors(doc: dict[str, Any]) -> dict[str, str]:
    """Derive the contract's colour roles from a (mode-resolved) token document.

    Args:
        doc: Token document, already resolved to one mode selection.

    Returns:
        Ordered mapping of colour role -> hex.
    """
    out: dict[str, str] = {}
    for role, path in COLOR_SOURCES.items():
        if role in ("success", "warning", "danger"):
            continue
        out[role] = to_hex(_require(doc, path), path)
    surface = out["surface"]
    for path in IMAGE_PLACEHOLDER_CANDIDATES:
        candidate = to_hex(_require(doc, path), path)
        if candidate != surface:
            out["image-placeholder"] = candidate
            break
    else:
        raise DerivationError(
            f"no image-placeholder candidate {list(IMAGE_PLACEHOLDER_CANDIDATES)} "
            f"differs from color.surface {surface}")
    for role in ("success", "warning", "danger"):
        value = get_token(doc, COLOR_SOURCES[role], _MISSING)
        if value is not _MISSING:
            out[role] = to_hex(value, COLOR_SOURCES[role])
    return out


def derive_common_tokens(doc: dict[str, Any], system_id: str) -> dict[str, Any]:
    """Derive the full ``tokens.common`` block for a system.

    Args:
        doc: Token document (base values = default mode).
        system_id: The system's id (selects ``HEADLINE_OVERRIDES``).

    Returns:
        The block as a mapping, in contract order.

    Raises:
        DerivationError: When the token file lacks a value a rule needs.
    """
    typography: dict[str, Any] = {}
    for role, path in TYPOGRAPHY_SOURCES.items():
        if role == "headline":
            path = HEADLINE_OVERRIDES.get(system_id, path)
        typography[role] = text_style(doc, path)
    mono = str(_require(doc, "font.mono"))
    if mono.split(",")[-1].strip().strip("'\"") == MONOSPACE_GENERIC:
        typography["code"] = {**text_style(doc, "type.body"), "family": font_family(doc, "mono")}

    spacing = {step: _require(doc, path) for step, path in SPACING_SOURCES.items()}
    stroke = {name: rule(doc) for name, rule in STROKE_RULES.items()}
    radius = {
        "none": AUTHORED_VALUES["radius.none"][0],
        **{name: rule(doc) for name, rule in RADIUS_RULES.items()},
        "full": AUTHORED_VALUES["radius.full"][0],
    }
    for category, block in (("stroke", stroke), ("radius", radius)):
        for name, value in block.items():
            if value is None or value is _MISSING:
                raise DerivationError(f"no token-file value for {category}.{name}")
    return {
        "color": derive_colors(doc),
        "typography": typography,
        "spacing": spacing,
        "stroke": stroke,
        "radius": radius,
    }


def derive_themes(doc: dict[str, Any]) -> dict[str, Any] | None:
    """Derive the ``themes:`` block from the token file's ``theme`` axis.

    Args:
        doc: Token document.

    Returns:
        ``{default, <option>: {common: {...colour roles...}}, ...}``, or
        ``None`` when the file has no ``theme`` axis.
    """
    axis = next((a for a in mode_axes(doc) if a.get("id") == THEME_AXIS), None)
    if axis is None:
        return None
    out: dict[str, Any] = {"default": axis["default"]}
    for option in axis.get("options") or {}:
        resolved = resolve_mode(doc, {THEME_AXIS: option})
        out[option] = {"common": derive_colors(resolved)}
    return out


# ─── Rendering ──────────────────────────────────────────────────────

def _scalar(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return repr(value)
    return json.dumps(value)


def _flow(mapping: dict[str, Any]) -> str:
    return "{ " + ", ".join(f"{k}: {_scalar(v)}" for k, v in mapping.items()) + " }"


def _render_mapping(mapping: dict[str, Any], indent: int) -> list[str]:
    pad = " " * indent
    lines: list[str] = []
    for key, value in mapping.items():
        if isinstance(value, dict) and value and all(not isinstance(v, dict) for v in value.values()) \
                and "family" in value:
            lines.append(f"{pad}{key}: {_flow(value)}")
        elif isinstance(value, dict):
            lines.append(f"{pad}{key}:")
            lines.extend(_render_mapping(value, indent + 2))
        else:
            lines.append(f"{pad}{key}: {_scalar(value)}")
    return lines


def render_common_region(common: dict[str, Any]) -> str:
    """Render the ``tokens.common`` region, markers included (2-space indent).

    Args:
        common: Output of ``derive_common_tokens``.

    Returns:
        The region text, ending with a newline.
    """
    lines = [
        f"  # generated:{COMMON_REGION} — derived from tokens.json by "
        f"`design-system-skill common-tokens --write`; do not edit by hand",
        "  common:",
        *_render_mapping(common, 4),
        f"  # /generated:{COMMON_REGION}",
    ]
    return "\n".join(lines) + "\n"


def render_themes_region(themes: dict[str, Any]) -> str:
    """Render the top-level ``themes:`` region, markers included.

    Args:
        themes: Output of ``derive_themes``.

    Returns:
        The region text, ending with a newline.
    """
    lines = [
        f"# generated:{THEMES_REGION} — derived from tokens.json modes.{THEME_AXIS} by "
        f"`design-system-skill common-tokens --write`; do not edit by hand",
        "themes:",
        *_render_mapping(themes, 2),
        f"# /generated:{THEMES_REGION}",
    ]
    return "\n".join(lines) + "\n"


# ─── Spec file regions ──────────────────────────────────────────────

def _region_re(name: str, indent: str) -> re.Pattern[str]:
    return re.compile(
        rf"^{indent}# generated:{re.escape(name)}\b.*?^{indent}# /generated:{re.escape(name)}\n",
        re.M | re.S,
    )


_TOKENS_LINE = re.compile(r"^tokens:[ \t]*(?:#.*)?\n", re.M)
_COMPONENTS_LINE = re.compile(r"^components:[ \t]*(?:#.*)?\n", re.M)
_VERSION_LINE = re.compile(r"^common_tokens_version:.*\n", re.M)
_SPEC_VERSION_LINE = re.compile(r"^spec_version:.*\n", re.M)


def apply_regions(text: str, common_region: str, themes_region: str | None) -> str:
    """Return spec text with the generated regions set to the given content.

    Existing regions are replaced in place. A missing ``tokens.common``
    region is inserted directly under ``tokens:``; a missing ``themes``
    region is inserted before ``components:`` (or appended). A ``themes``
    region the token file no longer supports is removed. The top-level
    ``common_tokens_version`` line is set to ``CONTRACT_VERSION``.

    Args:
        text: Current spec.yaml text.
        common_region: Output of ``render_common_region``.
        themes_region: Output of ``render_themes_region`` or ``None``.

    Returns:
        The updated text.

    Raises:
        DerivationError: When the spec has no top-level ``tokens:`` key, or
            ``tokens.common`` exists outside the generated markers.
    """
    version_line = f'common_tokens_version: "{CONTRACT_VERSION}"\n'
    if _VERSION_LINE.search(text):
        text = _VERSION_LINE.sub(version_line, text, count=1)
    else:
        m = _SPEC_VERSION_LINE.search(text)
        at = m.end() if m else 0
        text = text[:at] + version_line + text[at:]

    common_re = _region_re(COMMON_REGION, "  ")
    if common_re.search(text):
        text = common_re.sub(lambda _m: common_region, text, count=1)
    else:
        if re.search(r"^  common:", text, re.M):
            raise DerivationError(
                "tokens.common exists outside the generated markers; delete it "
                "and run common-tokens --write")
        m = _TOKENS_LINE.search(text)
        if m is None:
            raise DerivationError("spec has no top-level 'tokens:' key")
        text = text[:m.end()] + common_region + text[m.end():]

    themes_re = _region_re(THEMES_REGION, "")
    if themes_region is None:
        text = themes_re.sub("", text, count=1)
    elif themes_re.search(text):
        text = themes_re.sub(lambda _m: themes_region, text, count=1)
    else:
        if re.search(r"^themes:", text, re.M):
            raise DerivationError(
                "a top-level 'themes:' block exists outside the generated markers; "
                "delete it and run common-tokens --write")
        m = _COMPONENTS_LINE.search(text)
        insert = themes_region + "\n"
        if m is None:
            text = text.rstrip("\n") + "\n\n" + themes_region
        else:
            text = text[:m.start()] + insert + text[m.start():]
    return text


# ─── File-level API ─────────────────────────────────────────────────

@dataclass(frozen=True)
class SyncOutcome:
    """What ``sync_common_tokens`` found (and did) for one spec.

    Attributes:
        system_id: The spec's system id.
        spec_path: Absolute spec path.
        status: ``current`` | ``stale`` | ``written``.
    """

    system_id: str
    spec_path: str
    status: str


def sync_common_tokens(spec_path: str | Path, write: bool = False) -> Result:
    """Check (or rewrite) one spec's generated regions against its tokens.json.

    Args:
        spec_path: Path to spec.yaml.
        write: Rewrite the file when stale (otherwise only report).

    Returns:
        Result with ``data`` = ``SyncOutcome`` as a dict. Fails with
        ``COMMON_TOKENS_STALE`` when stale and not writing, or when the
        token file cannot supply a derivation.
    """
    path = Path(spec_path).resolve()
    try:
        text = path.read_text()
        spec = yaml.safe_load(text) or {}
    except FileNotFoundError:
        return Result.failure(Error("SPEC_FILE_MISSING", f"Spec file not found: {path}",
                                    {"path": str(path)}))
    except yaml.YAMLError as exc:
        return Result.failure(Error("SPEC_PARSE_FAILED", f"YAML parse error: {exc}",
                                    {"path": str(path)}))
    system_id = str((spec.get("system") or {}).get("id") or path.parent.name)
    tok_path = token_file_path(path, spec)
    if tok_path is None:
        return Result.failure(Error(
            "SCHEMA_VALIDATION_FAILED",
            f"{path} declares no system.tokens_file; tokens.common has nothing to derive from",
            {"spec_path": str(path), "system_id": system_id}))
    loaded = load_token_file(tok_path)
    if not loaded.ok:
        return loaded
    doc = loaded.data
    try:
        common = derive_common_tokens(doc, system_id)
        themes = derive_themes(doc)
        updated = apply_regions(text, render_common_region(common),
                                render_themes_region(themes) if themes else None)
    except DerivationError as exc:
        return Result.failure(Error(
            "COMMON_TOKENS_UNDERIVABLE", f"[{system_id}] {exc}",
            {"spec_path": str(path), "tokens_path": str(tok_path)}))

    status = "current"
    if updated != text:
        if write:
            path.write_text(updated)
            status = "written"
            logger.info("common_tokens_written", system_id=system_id, spec_path=str(path))
        else:
            status = "stale"
    outcome = SyncOutcome(system_id, str(path), status)
    data = outcome.__dict__.copy()
    if status == "stale":
        result = Result.failure(Error(
            "COMMON_TOKENS_STALE",
            f"[{system_id}] tokens.common / themes in {path.name} do not match {tok_path.name}; "
            f"run `design-system-skill common-tokens --write`",
            {"spec_path": str(path), "tokens_path": str(tok_path)}))
        result.data = data
        return result
    return Result.success(data)


def sync_all(
    entries: list[tuple[str, Path]] | None = None,
    write: bool = False,
    syncer: Callable[[Path, bool], Result] = sync_common_tokens,
) -> Result:
    """Check (or rewrite) every built-in system's spec, each spec once.

    Args:
        entries: ``(system_id, spec_path)`` pairs; defaults to the built-in
            registry layer (a user-overlay system belongs to another
            project, whose own gate owns it).
        write: Rewrite stale specs.
        syncer: Per-spec operation; injectable for tests.

    Returns:
        Result with ``data = {"systems": {id: outcome}}``; fails if any
        spec is stale (when not writing) or underivable.
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
    ordered = sorted(entries, key=lambda e: Path(e[1]).parent.name != e[0])
    for sys_id, spec_path in ordered:
        spec_path = Path(spec_path).resolve()
        if spec_path in seen:
            systems[sys_id] = {"alias_of": seen[spec_path]}
            continue
        seen[spec_path] = sys_id
        res = syncer(spec_path, write)
        systems[sys_id] = res.data if res.data is not None else {
            "errors": [e.message for e in res.errors]}
        errors.extend(res.errors)
    if errors:
        result = Result.failure(errors)
        result.data = {"systems": systems}
        return result
    return Result.success({"systems": systems})


def contract_role_coverage() -> dict[str, list[str]]:
    """Report contract roles this module cannot derive (should be empty).

    Used by the tests to fail when the contract grows a role nobody maps.

    Returns:
        ``{category: [unmapped role, ...]}`` for categories with gaps.
    """
    contract = load_contract(CONTRACT_VERSION)
    mapped = {
        "color": set(COLOR_SOURCES) | {"image-placeholder"},
        "typography": set(TYPOGRAPHY_SOURCES) | {"code"},
        "spacing": set(SPACING_SOURCES),
        "stroke": set(STROKE_RULES),
        "radius": set(RADIUS_RULES) | {k.split(".", 1)[1] for k in AUTHORED_VALUES
                                       if k.startswith("radius.")},
    }
    gaps: dict[str, list[str]] = {}
    for category in set(contract.required) | set(contract.optional):
        missing = sorted(contract.all_token_names(category) - mapped.get(category, set()))
        if missing:
            gaps[category] = missing
    return gaps
