"""Render, write and check SVG libraries.

``build`` turns discovered targets into in-memory files; ``write_files``
puts them on disk and ``stale_files`` compares them with what is
committed. Token and plugin loading are injectable so tests (and other
callers) can render against a different token document or plugin set.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass, field
from pathlib import Path
from types import ModuleType
from typing import Any

import yaml
from design_system_skill.token_file import read_spec_with_tokens

from .discovery import SystemTarget
from .plugin import (
    KIND_OUT_DIRS,
    BuilderDataError,
    builder_of,
    kind_filters,
    load_plugin,
    text_classes,
    validate_builder,
)
from .templates import TemplateError, default_wrap, render_defs, resolve

TokenLoader = Callable[[SystemTarget], Mapping[str, Any]]
PluginLoader = Callable[[str], "ModuleType | None"]


@dataclass(frozen=True)
class RenderedFile:
    """One SVG produced by the engine.

    Attributes:
        system: System id.
        kind: ``library`` or ``patterns``.
        item: Component or layout id.
        path: Destination path.
        text: Full SVG text.
    """

    system: str
    kind: str
    item: str
    path: Path
    text: str


@dataclass
class BuildResult:
    """Outcome of ``build``.

    Attributes:
        files: Rendered files, in system/kind/item order.
        skipped: ``(system id, reason)`` for targets with no builder module.
    """

    files: list[RenderedFile] = field(default_factory=list)
    skipped: list[tuple[str, str]] = field(default_factory=list)


def load_tokens(target: SystemTarget) -> Mapping[str, Any]:
    """Default token loader: the spec's token file via design_system_skill.

    Args:
        target: System to load.

    Returns:
        The token document (``systems/<id>/tokens.json``) as attached by
        ``read_spec_with_tokens`` at ``tokens.contract``.

    Raises:
        BuilderDataError: If the spec or its token file cannot be read.
    """
    loaded = read_spec_with_tokens(target.spec_path)
    if not loaded.ok:
        raise BuilderDataError([f"{target.id}: {e.message}" for e in loaded.errors])
    contract = ((loaded.data or {}).get("tokens") or {}).get("contract")
    if not isinstance(contract, Mapping):
        raise BuilderDataError([f"{target.id}: spec {target.spec_path} declares no token file"])
    return contract


def render_kind(target: SystemTarget, kind: str, kind_data: Mapping[str, Any],
                tokens: Mapping[str, Any]) -> list[RenderedFile]:
    """Render every item of one kind. Assumes ``validate_builder`` passed.

    Args:
        target: System being rendered.
        kind: ``library`` or ``patterns``.
        kind_data: That kind's builder data.
        tokens: The system's token document.

    Returns:
        Rendered files for the kind.

    Raises:
        BuilderDataError: If a template fails to resolve.
    """
    filters = kind_filters(kind_data)
    wrap = kind_data.get("wrap") or default_wrap
    out_dir = target.library_root / kind_data.get("out_dir", KIND_OUT_DIRS[kind])
    where = f"{target.id}: {kind}"
    try:
        defs = resolve(render_defs(text_classes(kind_data["classes"]),
                                   kind_data.get("defs_extra", "")), tokens, filters)
    except TemplateError as exc:
        raise BuilderDataError([f"{where}.defs: {exc}"]) from exc
    files = []
    for item_id, (width, height, body) in kind_data["items"].items():
        try:
            rendered = resolve(body, tokens, filters)
        except TemplateError as exc:
            raise BuilderDataError([f"{where}.items['{item_id}']: {exc}"]) from exc
        files.append(RenderedFile(target.id, kind, item_id, out_dir / f"{item_id}.svg",
                                  wrap(width, height, rendered, item_id, defs)))
    return files


def build(targets: Iterable[SystemTarget], kinds: Iterable[str] | None = None, *,
          plugin_loader: PluginLoader = load_plugin,
          token_loader: TokenLoader = load_tokens) -> BuildResult:
    """Render the libraries of ``targets`` in memory.

    Every target is validated before anything is rendered, so a broken
    system reports all of its problems at once.

    Args:
        targets: Systems to render.
        kinds: Restrict to these kinds (default: every kind a system has).
        plugin_loader: ``system id -> module`` (``None`` = no builder).
        token_loader: ``target -> token document``.

    Returns:
        The rendered files and the skipped targets.

    Raises:
        BuilderDataError: With every validation problem across targets.
    """
    wanted = set(kinds) if kinds else None
    result = BuildResult()
    plans: list[tuple[SystemTarget, Mapping[str, Any], Mapping[str, Any]]] = []
    errors: list[str] = []
    for target in targets:
        module = plugin_loader(target.id)
        if module is None:
            result.skipped.append((target.id, "no builder module"))
            continue
        try:
            data = builder_of(target.id, module)
            tokens = token_loader(target)
        except BuilderDataError as exc:
            errors.extend(exc.messages)
            continue
        problems = validate_builder(target.id, data, tokens)
        if problems:
            errors.extend(problems)
            continue
        plans.append((target, data, tokens))
    if errors:
        raise BuilderDataError(errors)
    for target, data, tokens in plans:
        for kind, kind_data in data.items():
            if wanted is None or kind in wanted:
                result.files.extend(render_kind(target, kind, kind_data, tokens))
    return result


def stale_files(files: Iterable[RenderedFile]) -> list[tuple[RenderedFile, str]]:
    """Compare rendered files with the files on disk.

    Args:
        files: Rendered files.

    Returns:
        ``(file, "missing" | "differs")`` for each file whose committed copy
        is absent or not byte-identical.
    """
    out = []
    for f in files:
        if not f.path.exists():
            out.append((f, "missing"))
        elif f.path.read_text(encoding="utf-8") != f.text:
            out.append((f, "differs"))
    return out


class AllowListError(ValueError):
    """The orphan allow-list file is missing or malformed."""


def load_orphan_allowlist(path: Path, base: Path) -> dict[Path, str]:
    """Read the orphan allow-list.

    The file is YAML: ``allow: [{path: <relative to base>, reason: <text>}]``.
    A missing file means an empty list.

    Args:
        path: Allow-list file.
        base: Directory entry paths are relative to (the registry's).

    Returns:
        ``{absolute path: reason}``.

    Raises:
        AllowListError: If the file is malformed or an entry has no reason.
    """
    if not Path(path).exists():
        return {}
    try:
        raw = yaml.safe_load(Path(path).read_text()) or {}
    except (OSError, yaml.YAMLError) as exc:
        raise AllowListError(f"cannot read orphan allow-list {path}: {exc}") from exc
    entries = raw.get("allow") if isinstance(raw, Mapping) else None
    if not isinstance(entries, list):
        raise AllowListError(f"orphan allow-list {path}: expected 'allow: [...]'")
    out: dict[Path, str] = {}
    for entry in entries:
        if not (isinstance(entry, Mapping) and isinstance(entry.get("path"), str)
                and isinstance(entry.get("reason"), str) and entry["reason"].strip()):
            raise AllowListError(f"orphan allow-list {path}: entry {entry!r} needs "
                                 f"a 'path' and a non-empty 'reason'")
        out[(Path(base) / entry["path"]).resolve()] = entry["reason"]
    return out


def orphan_files(targets: Iterable[SystemTarget], files: Iterable[RenderedFile],
                 kinds: Iterable[str] | None = None,
                 allow: Mapping[Path, str] | None = None) -> tuple[list[Path], list[Path]]:
    """Find library SVGs no template produces, and stale allow-list entries.

    A hand-authored SVG in ``components/`` or ``layouts/`` escapes
    ``--check`` (nothing re-renders it from tokens), so every such file
    must either come from a template or be allow-listed with a reason.

    Args:
        targets: Systems in scope (with or without a builder module).
        files: Files the engine rendered for those systems.
        kinds: Kinds in scope (default: all), selecting the directories.
        allow: ``{absolute path: reason}`` of tolerated orphans.

    Returns:
        ``(orphans, stale)``: unlisted SVGs no template produces, and
        allow-list entries in scope that are missing or now produced.
    """
    allow = allow or {}
    produced = {f.path.resolve() for f in files}
    dirs = [KIND_OUT_DIRS[k] for k in (kinds or KIND_OUT_DIRS)]
    orphans: list[Path] = []
    stale: list[Path] = []
    for target in targets:
        for d in dirs:
            root = (target.library_root / d).resolve()
            for svg in sorted(root.glob("*.svg")):
                svg = svg.resolve()
                if svg not in produced and svg not in allow:
                    orphans.append(svg)
            stale.extend(p for p in allow
                         if p.parent == root and (not p.exists() or p in produced))
    return orphans, sorted(set(stale))


def write_files(files: Iterable[RenderedFile]) -> list[RenderedFile]:
    """Write rendered files, skipping ones whose content is unchanged.

    Args:
        files: Rendered files.

    Returns:
        The files that were created or changed.
    """
    changed = []
    for f, _ in stale_files(files):
        f.path.parent.mkdir(parents=True, exist_ok=True)
        f.path.write_text(f.text, encoding="utf-8")
        changed.append(f)
    return changed
