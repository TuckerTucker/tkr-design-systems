"""Find the systems to build from ``systems/registry.yaml``.

Registry entries that point at a spec and library another entry already
owns are *aliases* (``neutral`` shares ``wireframe``'s files): they are
folded into the owning target rather than built twice.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import yaml
from design_system_skill.registry import RegistryEntry


class RegistryError(ValueError):
    """The registry file is missing or malformed."""


@dataclass(frozen=True)
class SystemTarget:
    """One buildable system.

    Attributes:
        id: Registry id (also the plugin module name).
        spec_path: Absolute path to the system's spec.yaml.
        library_root: Absolute path to the directory holding
            ``components/`` and ``layouts/``.
        aliases: Other registry ids that share this spec and library.
    """

    id: str
    spec_path: Path
    library_root: Path
    aliases: tuple[str, ...] = field(default=())


def discover_systems(registry_path: Path) -> list[SystemTarget]:
    """Read the registry and return one target per distinct library.

    Args:
        registry_path: Path to ``registry.yaml``. Entry paths resolve
            relative to its directory.

    Returns:
        Targets in registry order, aliases folded into their owner.

    Raises:
        RegistryError: If the file cannot be read or has no ``systems`` list.
    """
    try:
        raw = yaml.safe_load(Path(registry_path).read_text()) or {}
    except (OSError, yaml.YAMLError) as exc:
        raise RegistryError(f"cannot read registry {registry_path}: {exc}") from exc
    entries = raw.get("systems")
    if not isinstance(entries, list):
        raise RegistryError(f"registry {registry_path} has no 'systems' list")
    base = Path(registry_path).resolve().parent
    owners: dict[tuple[Path, Path], int] = {}
    targets: list[SystemTarget] = []
    for item in entries:
        try:
            entry = RegistryEntry.from_dict(item)
        except (KeyError, TypeError) as exc:
            raise RegistryError(f"registry {registry_path}: malformed entry {item!r}") from exc
        key = ((base / entry.spec).resolve(), (base / entry.library_root).resolve())
        if key in owners:
            i = owners[key]
            owner = targets[i]
            targets[i] = SystemTarget(owner.id, owner.spec_path, owner.library_root,
                                      owner.aliases + (entry.id,))
            continue
        owners[key] = len(targets)
        targets.append(SystemTarget(entry.id, key[0], key[1]))
    return targets


def select_targets(targets: list[SystemTarget], wanted: list[str] | None) -> list[SystemTarget]:
    """Filter targets by id; an alias selects its owner.

    Args:
        targets: All discovered targets.
        wanted: Requested ids, or ``None``/empty for all.

    Returns:
        The selected targets, in registry order, without duplicates.

    Raises:
        RegistryError: Naming any id that is not in the registry.
    """
    if not wanted:
        return list(targets)
    by_id = {t.id: t for t in targets}
    by_id.update({a: t for t in targets for a in t.aliases})
    unknown = [w for w in wanted if w not in by_id]
    if unknown:
        raise RegistryError(f"unknown system(s) {unknown}; registry has {sorted(by_id)}")
    chosen = {by_id[w].id for w in wanted}
    return [t for t in targets if t.id in chosen]
