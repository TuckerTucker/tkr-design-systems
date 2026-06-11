"""Registry of available design systems.

The registry is a YAML file at the systems root
(systems/registry.yaml) with this shape:

    version: 1
    systems:
      - id: swiss
        spec: swiss/spec.yaml
        status: available    # available | draft | deprecated
        library_root: swiss  # optional; defaults to <id>
      - id: wireframe
        spec: wireframe/spec.yaml
        status: available
        library_root: wireframe

`spec` and `library_root` are paths relative to the registry's own
directory.

`Registry` is a thin wrapper over the YAML file. It loads on demand and
exposes lookup + mutation operations. Mutations write back to disk.
"""

from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator
import shutil
import time

import yaml

from .errors import Error, Result
from .paths import project_root, registry_path

import structlog

logger = structlog.get_logger(__name__)


REGISTRY_VERSION = 1
VALID_STATUSES = {"available", "draft", "deprecated"}


@dataclass
class RegistryEntry:
    id: str
    spec: str            # path relative to project root
    status: str          # available | draft | deprecated
    library_root: str    # path relative to project root

    @classmethod
    def from_dict(cls, d: dict, default_library_root: str | None = None) -> "RegistryEntry":
        """Create a RegistryEntry from a dict (e.g. from YAML).

        Args:
            d: Dict with id, spec, status (optional), library_root (optional).
            default_library_root: Fallback if d doesn't specify library_root.

        Returns:
            A RegistryEntry.
        """
        return cls(
            id=d["id"],
            spec=d["spec"],
            status=d.get("status", "available"),
            library_root=d.get("library_root", default_library_root or d["id"]),
        )

    def to_dict(self) -> dict:
        """Serialize to a dict (for YAML output).

        Returns:
            A dict with id, spec, status, library_root.
        """
        return {
            "id": self.id,
            "spec": self.spec,
            "status": self.status,
            "library_root": self.library_root,
        }


class Registry:
    """In-memory mirror of registry.yaml. Reads on construction; writes
    on mutation. Use `Registry.load()` to construct."""

    def __init__(self, entries: list[RegistryEntry], path: Path):
        """Initialize with registry entries and file path.

        Args:
            entries: List of RegistryEntry objects.
            path: Path to registry.yaml on disk.
        """
        self._entries: dict[str, RegistryEntry] = {e.id: e for e in entries}
        self._path = path

    # ─── Construction ────────────────────────────────────────────────

    @classmethod
    def load(cls) -> Result:
        """Load the registry from disk.

        Returns:
            Result with data=Registry if successful, error if file missing/malformed.
        """
        path = registry_path()
        if not path.exists():
            return Result.failure(Error(
                "REGISTRY_FILE_MISSING",
                f"Registry not found at {path}. Run `python -m design_system_skill init` to create one.",
                {"expected_path": str(path)},
            ))
        try:
            data = yaml.safe_load(path.read_text())
        except yaml.YAMLError as e:
            return Result.failure(Error(
                "REGISTRY_PARSE_FAILED",
                f"Could not parse {path}: {e}",
                {"path": str(path)},
            ))
        if not isinstance(data, dict) or "systems" not in data:
            return Result.failure(Error(
                "REGISTRY_PARSE_FAILED",
                f"{path} is missing a top-level 'systems' list.",
                {"path": str(path)},
            ))
        entries = [RegistryEntry.from_dict(d) for d in data.get("systems", [])]
        return Result.success(cls(entries, path))

    @classmethod
    def initialize_at(cls, path: Path, entries: list[RegistryEntry] | None = None) -> "Registry":
        """Create and persist a fresh registry file.

        Args:
            path: Where to write registry.yaml.
            entries: Initial entries (defaults to empty).

        Returns:
            A Registry with entries persisted to disk.
        """
        reg = cls(entries or [], path)
        reg._save()
        return reg

    # ─── Lookup ──────────────────────────────────────────────────────

    def get(self, system_id: str) -> RegistryEntry | None:
        """Look up a system by id.

        Args:
            system_id: The system id.

        Returns:
            The RegistryEntry or None if not found.
        """
        return self._entries.get(system_id)

    def __contains__(self, system_id: str) -> bool:
        return system_id in self._entries

    def __iter__(self) -> Iterator[RegistryEntry]:
        return iter(self._entries.values())

    def __len__(self) -> int:
        return len(self._entries)

    def all(self) -> list[RegistryEntry]:
        """Get all entries in id-sorted order.

        Returns:
            List of RegistryEntry objects sorted by id.
        """
        return sorted(self._entries.values(), key=lambda e: e.id)

    # ─── Mutation ────────────────────────────────────────────────────

    def add(self, entry: RegistryEntry, replace: bool = False) -> Result:
        """Add or update a system in the registry.

        Args:
            entry: The RegistryEntry to add/update.
            replace: If True, overwrite an existing entry; else fail if exists.

        Returns:
            Result with the entry dict if successful.
        """
        if entry.id in self._entries and not replace:
            return Result.failure(Error(
                "ALREADY_REGISTERED",
                f"System '{entry.id}' is already registered. Pass replace=True to overwrite.",
                {"system_id": entry.id, "existing": self._entries[entry.id].to_dict()},
            ))
        if entry.status not in VALID_STATUSES:
            return Result.failure(Error(
                "SCHEMA_VALIDATION_FAILED",
                f"Invalid status '{entry.status}'. Must be one of: {sorted(VALID_STATUSES)}",
                {"status": entry.status},
            ))
        if entry.id in self._entries and replace:
            self._snapshot_for_rollback(entry.id)
        self._entries[entry.id] = entry
        self._save()
        return Result.success(entry.to_dict())

    def remove(self, system_id: str) -> Result:
        """Remove a system from the registry.

        Args:
            system_id: The system id to remove.

        Returns:
            Result with the removed entry dict if successful.
        """
        if system_id not in self._entries:
            return Result.failure(Error(
                "SYSTEM_NOT_FOUND",
                f"System '{system_id}' is not registered.",
                {"system_id": system_id},
            ))
        removed = self._entries.pop(system_id)
        self._save()
        return Result.success(removed.to_dict())

    # ─── Persistence ─────────────────────────────────────────────────

    def _save(self) -> None:
        out = {
            "version": REGISTRY_VERSION,
            "systems": [e.to_dict() for e in self.all()],
        }
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(yaml.safe_dump(out, sort_keys=False))

    def _snapshot_for_rollback(self, system_id: str) -> None:
        """Stash the current registry state so a replace can be undone.
        Snapshots live next to the registry as registry.yaml.bak.<unix-ts>."""
        if not self._path.exists():
            return
        ts = int(time.time())
        backup = self._path.with_suffix(self._path.suffix + f".bak.{ts}.{system_id}")
        shutil.copy2(self._path, backup)


# ─── Public API ─────────────────────────────────────────────────────

def list_systems() -> Result:
    """List all systems in the registry with metadata.

    Returns:
        Result with data=list of dicts with {id, name, tagline, grammar_family,
        version, spec_version, status}. Fields are read from each spec's
        system block via cheap parse (no validation/resolution).
    """
    reg_result = Registry.load()
    if not reg_result.ok:
        return reg_result
    reg: Registry = reg_result.data
    root = project_root()
    descriptors = []
    warnings: list[Error] = []
    for entry in reg.all():
        spec_path = root / entry.spec
        if not spec_path.exists():
            warnings.append(Error(
                "SPEC_FILE_MISSING",
                f"Registered spec '{entry.spec}' not found on disk.",
                {"system_id": entry.id, "expected_path": str(spec_path)},
            ))
            descriptors.append({
                "id": entry.id,
                "name": entry.id,
                "tagline": "",
                "grammar_family": None,
                "version": None,
                "spec_version": None,
                "status": "draft",
            })
            continue
        try:
            data = yaml.safe_load(spec_path.read_text()) or {}
        except yaml.YAMLError as e:
            warnings.append(Error(
                "SPEC_PARSE_FAILED",
                f"Could not parse spec for '{entry.id}': {e}",
                {"system_id": entry.id, "path": str(spec_path)},
            ))
            descriptors.append({
                "id": entry.id,
                "name": entry.id,
                "tagline": "",
                "grammar_family": None,
                "version": None,
                "spec_version": None,
                "status": "draft",
            })
            continue
        sys_block = data.get("system") or {}
        descriptors.append({
            "id": entry.id,
            "name": sys_block.get("name", entry.id),
            "tagline": sys_block.get("tagline", ""),
            "grammar_family": sys_block.get("grammar_family"),
            "version": sys_block.get("version"),
            "spec_version": data.get("spec_version"),
            "status": entry.status,
        })
    return Result.success(descriptors, warnings=warnings or None)


def register_system(spec_dir: str | Path, replace: bool = False) -> Result:
    """Register a design system in the registry.

    Validates spec.yaml and creates a registry entry. The library_root
    defaults to <id> (if it exists at the systems root) or the spec
    directory itself. Authors can override by editing registry.yaml.

    Args:
        spec_dir: Directory containing spec.yaml (or path to spec.yaml itself).
        replace: If True, overwrite an existing entry; else fail if exists.

    Returns:
        Result with the registry entry dict if successful.
    """
    from .validation import validate_spec  # local import to avoid cycle

    spec_dir = Path(spec_dir).resolve()
    if spec_dir.is_file():
        spec_path = spec_dir
        spec_dir = spec_path.parent
    else:
        spec_path = spec_dir / "spec.yaml"
        if not spec_path.exists():
            # Allow <id>-spec.yaml at project root as a fallback location.
            candidates = list(spec_dir.glob("*-spec.yaml"))
            if len(candidates) == 1:
                spec_path = candidates[0]
            else:
                return Result.failure(Error(
                    "SPEC_FILE_MISSING",
                    f"No spec.yaml found in {spec_dir}.",
                    {"spec_dir": str(spec_dir)},
                ))

    val = validate_spec(spec_path)
    if not val.ok:
        return val

    data = yaml.safe_load(spec_path.read_text()) or {}
    sys_block = data.get("system") or {}
    system_id = sys_block.get("id")
    if not system_id:
        return Result.failure(Error(
            "SCHEMA_VALIDATION_FAILED",
            f"{spec_path} has no system.id",
            {"spec_path": str(spec_path)},
        ))

    root = project_root()
    try:
        spec_rel = str(spec_path.resolve().relative_to(root))
    except ValueError:
        spec_rel = str(spec_path.resolve())

    library_dir = root / system_id
    library_root = system_id if library_dir.exists() else str(spec_path.parent.relative_to(root) if spec_path.parent.is_relative_to(root) else spec_path.parent)

    reg_result = Registry.load()
    if not reg_result.ok:
        return reg_result
    reg: Registry = reg_result.data
    entry = RegistryEntry(
        id=system_id,
        spec=spec_rel,
        status="available",
        library_root=library_root,
    )
    return reg.add(entry, replace=replace)


def unregister_system(system_id: str) -> Result:
    """Remove a system from the registry.

    Files on disk are not deleted.

    Args:
        system_id: The system id to remove.

    Returns:
        Result with the removed entry dict if successful.
    """
    reg_result = Registry.load()
    if not reg_result.ok:
        return reg_result
    reg: Registry = reg_result.data
    return reg.remove(system_id)
