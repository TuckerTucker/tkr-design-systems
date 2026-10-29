"""Locate the skill root, the built-in registry, and the user registry.

Three distinct roots, kept separate:

- **Skill root** — the directory holding the skill's own assets
  (``schemas/``). Resolved by walking up from this module's location;
  never affected by env overrides.
- **Built-in registry** — the ``registry.yaml`` that ships with the
  systems. Found by walking up from this module in one of three layouts:

  - Repository layout: ``<repo>/systems/registry.yaml`` (this repo).
  - Skill-bundle layout: ``<skill>/libraries/registry.yaml`` (the
    Claude Code skill convention — the registry sits next to the system
    libraries, both inside the skill folder).
  - Flat layout: ``<dir>/registry.yaml`` directly in an ancestor.

- **User registry** — ``~/.claude/design-systems/registry.yaml``. Holds
  per-user registrations (systems living outside this tree, e.g. another
  project's library). Overlaid on the built-in registry at load time;
  mutations write here so the built-in registry stays read-only and the
  skill directory can be installed as a symlink.

``$DESIGN_SYSTEM_SKILL_REGISTRY`` is a *full* override: when set, that
single file is the entire registry (no overlay, fully mutable). Tests use
it for hermetic isolation.

``$DESIGN_SYSTEM_SKILL_USER_REGISTRY`` relocates the user registry (tests
point it at a temp path so a developer's own overlay cannot leak in).
"""

from __future__ import annotations
import os
from pathlib import Path

import structlog

logger = structlog.get_logger(__name__)


_ENV_OVERRIDE = "DESIGN_SYSTEM_SKILL_REGISTRY"
_ENV_USER_REGISTRY = "DESIGN_SYSTEM_SKILL_USER_REGISTRY"

_DEFAULT_USER_REGISTRY = Path("~/.claude/design-systems/registry.yaml")

# Where the built-in registry may sit relative to an ancestor directory,
# in the order they are tried at each level of the walk.
_REGISTRY_LAYOUTS: tuple[tuple[str, ...], ...] = (
    ("registry.yaml",),
    ("systems", "registry.yaml"),
    ("libraries", "registry.yaml"),
)


def skill_root() -> Path:
    """Return the skill's own root directory.

    The nearest ancestor of this module that holds a ``schemas/``
    directory: ``tools/design-system-skill`` in this repository,
    ``<skill>`` in the skill-bundle layout (where the package sits under
    ``<skill>/scripts/``). Env overrides do not affect it.

    Returns:
        The skill root directory.
    """
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "schemas").is_dir():
            return parent
    # Bootstrap fallback: the directory that contains the package.
    return here.parents[1]


def builtin_registry_path() -> Path:
    """Return the path to the built-in registry.

    Walks up from this module and returns the first match among
    ``_REGISTRY_LAYOUTS``. Falls back to ``<repo>/systems/registry.yaml``
    (whether or not it exists yet — the initial bootstrap case).

    Returns:
        The Path to the built-in registry.yaml.
    """
    here = Path(__file__).resolve()
    for parent in here.parents:
        for layout in _REGISTRY_LAYOUTS:
            candidate = parent.joinpath(*layout)
            if candidate.exists():
                return candidate
    # here.parents = [design_system_skill, design-system-skill, tools, <repo>, ...]
    return here.parents[3] / "systems" / "registry.yaml"


def user_registry_path() -> Path:
    """Return the path to the user-level registry overlay.

    Resolution: ``$DESIGN_SYSTEM_SKILL_USER_REGISTRY`` if set, else
    ``~/.claude/design-systems/registry.yaml``.

    Returns:
        The Path to the user registry.yaml (whether or not it exists).
    """
    env = os.environ.get(_ENV_USER_REGISTRY)
    if env:
        return Path(env).expanduser().resolve()
    return _DEFAULT_USER_REGISTRY.expanduser()


def override_registry_path() -> Path | None:
    """Return the full-override registry path, if the env var is set.

    Returns:
        The Path from ``$DESIGN_SYSTEM_SKILL_REGISTRY``, or None.
    """
    env = os.environ.get(_ENV_OVERRIDE)
    if env:
        return Path(env).expanduser().resolve()
    return None


def project_root() -> Path:
    """Return the directory holding the primary registry.yaml.

    Relative ``spec`` / ``library_root`` paths in that registry resolve
    against this directory (``<repo>/systems`` in the repository layout).
    Entries from the user overlay resolve against their own file's
    directory instead — use ``RegistryEntry.spec_path()`` /
    ``library_path()`` rather than joining onto this.

    Resolution order:
        1. If $DESIGN_SYSTEM_SKILL_REGISTRY is set, the directory of that file.
        2. The built-in registry's directory.

    Returns:
        The systems root Path.
    """
    override = override_registry_path()
    if override is not None:
        return override.parent
    return builtin_registry_path().parent


def registry_path() -> Path:
    """Return the absolute path to the primary registry.yaml.

    The override file when ``$DESIGN_SYSTEM_SKILL_REGISTRY`` is set, else
    the built-in registry.

    Returns:
        The Path to registry.yaml (whether or not it exists).
    """
    override = override_registry_path()
    if override is not None:
        return override
    return builtin_registry_path()


def tooling_dir() -> Path:
    """Return the directory holding ``rulebook_check.py`` and the builders.

    Repository layout: ``tools/builders`` (a sibling of this skill).
    Skill-bundle layout: ``<skill>/tooling``.

    Returns:
        The first candidate holding ``rulebook_check.py``, else the
        bundle-layout path (whether or not it exists).
    """
    root = skill_root()
    candidates = (root / "tooling", root.parent / "builders")
    for candidate in candidates:
        if (candidate / "rulebook_check.py").is_file():
            return candidate
    return candidates[0]


def reference_doc_path(name: str) -> Path:
    """Return the path of a schema/specification document by file name.

    Repository layout: ``<repo>/docs/specs/<name>``.
    Skill-bundle layout: ``<skill>/references/<name>``.

    Args:
        name: Document file name, e.g. ``SCHEMA-V0.3.md``.

    Returns:
        The first candidate that exists, else the bundle-layout path.
    """
    root = skill_root()
    candidates = (root / "references" / name, root.parent.parent / "docs" / "specs" / name)
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return candidates[0]


def builtin_library_dir(system_id: str) -> Path:
    """Return a built-in system's library directory (spec, tokens, SVGs).

    Read from the built-in registry only — never the user overlay or the
    ``$DESIGN_SYSTEM_SKILL_REGISTRY`` override — so it names the files that
    ship with this skill: ``systems/<id>`` in the repository layout,
    ``libraries/<id>-library`` in the skill-bundle layout.

    Args:
        system_id: Built-in system id, e.g. ``swiss``.

    Returns:
        The absolute library directory.

    Raises:
        KeyError: If the built-in registry has no such id.
    """
    import yaml  # local: keeps this module importable without PyYAML

    registry = builtin_registry_path()
    data = yaml.safe_load(registry.read_text()) or {}
    for entry in data.get("systems") or []:
        if entry.get("id") == system_id:
            root = entry.get("library_root") or system_id
            return (registry.parent / root).resolve()
    raise KeyError(f"{system_id!r} is not in the built-in registry {registry}")


def is_library_of(system_id: str, spec_path: Path) -> bool:
    """Whether a spec's directory is named for ``system_id``.

    The directory is ``<id>`` in the repository layout and ``<id>-library``
    in the skill bundle. Registry aliases (``neutral`` → the wireframe spec)
    share another id's directory; the gates check a shared spec once, under
    the id that owns the directory.

    Args:
        system_id: A registry id.
        spec_path: The spec.yaml that id is registered with.

    Returns:
        True when the spec's directory belongs to that id.
    """
    return Path(spec_path).parent.name in (system_id, f"{system_id}-library")
