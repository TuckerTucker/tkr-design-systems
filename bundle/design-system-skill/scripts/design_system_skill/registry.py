"""Registry of available design systems.

A registry file is YAML with this shape:

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

`spec` and `library_root` are paths relative to the directory holding
that registry file (absolute paths are also accepted).

Two registry files combine at load time:

- The **built-in registry** ships with the skill (next to the system
  libraries). It defines the canonical systems and is treated as
  read-only data here — it changes when the skill changes.
- The **user registry** (``~/.claude/design-systems/registry.yaml``)
  holds per-user registrations. Its entries overlay the built-ins
  (same id wins), and all mutations write to it — never to the skill's
  own files. This keeps the skill directory safe to install as a
  read-only symlink.

When ``$DESIGN_SYSTEM_SKILL_REGISTRY`` is set, that single file is the
entire registry — no overlay, fully mutable. Tests use this for
hermetic isolation.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator
import shutil
import time

import yaml

from .errors import Error, Result
from .paths import (
    builtin_registry_path,
    override_registry_path,
    user_registry_path,
)

import structlog

logger = structlog.get_logger(__name__)


REGISTRY_VERSION = 1
VALID_STATUSES = {"available", "draft", "deprecated"}


@dataclass
class RegistryEntry:
    id: str
    spec: str            # path relative to the entry's registry dir (or absolute)
    status: str          # available | draft | deprecated
    library_root: str    # path relative to the entry's registry dir (or absolute)
    base: Path = field(default_factory=Path, compare=False)  # resolution base dir

    @classmethod
    def from_dict(cls, d: dict, base: Path | None = None,
                  default_library_root: str | None = None) -> "RegistryEntry":
        """Create a RegistryEntry from a dict (e.g. from YAML).

        Args:
            d: Dict with id, spec, status (optional), library_root (optional).
            base: Directory relative paths in this entry resolve against
                (the directory of the registry file the entry came from).
                Omitted by callers that resolve paths themselves; defaults
                to the current directory.
            default_library_root: Fallback if d doesn't specify library_root.

        Returns:
            A RegistryEntry.
        """
        return cls(
            id=d["id"],
            spec=d["spec"],
            status=d.get("status", "available"),
            library_root=d.get("library_root", default_library_root or d["id"]),
            base=base if base is not None else Path(),
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

    def spec_path(self) -> Path:
        """Resolve the spec path against this entry's registry directory.

        Returns:
            Absolute Path to the spec file.
        """
        return (self.base / self.spec).resolve()

    def library_path(self) -> Path:
        """Resolve the library root against this entry's registry directory.

        Returns:
            Absolute Path to the library root directory.
        """
        return (self.base / self.library_root).resolve()


class Registry:
    """In-memory mirror of the layered registry. Reads on construction;
    writes (to the mutable layer only) on mutation. Use `Registry.load()`
    to construct."""

    def __init__(self, builtin: list[RegistryEntry], user: list[RegistryEntry],
                 user_path: Path, single_file: bool = False):
        """Initialize with layered registry entries.

        Args:
            builtin: Read-only entries from the skill's own registry.
            user: Mutable entries from the user registry (overlay built-ins).
            user_path: File mutations persist to.
            single_file: True when one file is the whole registry
                (``$DESIGN_SYSTEM_SKILL_REGISTRY`` or ``initialize_at``);
                its entries are then also the built-in set the repository
                gates check.
        """
        self._builtin: dict[str, RegistryEntry] = {e.id: e for e in builtin}
        self._user: dict[str, RegistryEntry] = {e.id: e for e in user}
        self._user_path = user_path
        self._single_file = single_file

    # ─── Construction ────────────────────────────────────────────────

    @classmethod
    def load(cls) -> Result:
        """Load the registry from disk.

        In override mode (``$DESIGN_SYSTEM_SKILL_REGISTRY`` set) the
        override file is the entire, fully-mutable registry. Otherwise
        the built-in registry is required and the user registry, when
        present, overlays it.

        Returns:
            Result with data=Registry if successful, error if a required
            file is missing/malformed.
        """
        override = override_registry_path()
        if override is not None:
            entries_result = cls._read_file(override, required=True)
            if not entries_result.ok:
                return entries_result
            return Result.success(cls([], entries_result.data, override, single_file=True))

        builtin_path = builtin_registry_path()
        builtin_result = cls._read_file(builtin_path, required=True)
        if not builtin_result.ok:
            return builtin_result

        user_path = user_registry_path()
        user_entries: list[RegistryEntry] = []
        if user_path.exists():
            user_result = cls._read_file(user_path, required=False)
            if not user_result.ok:
                return user_result
            user_entries = user_result.data

        return Result.success(cls(builtin_result.data, user_entries, user_path))

    @classmethod
    def _read_file(cls, path: Path, required: bool) -> Result:
        """Parse one registry file into entries.

        Args:
            path: The registry.yaml to read.
            required: Whether a missing file is an error.

        Returns:
            Result with data=list[RegistryEntry] if successful.
        """
        if not path.exists():
            if required:
                return Result.failure(Error(
                    "REGISTRY_FILE_MISSING",
                    f"Registry not found at {path}. Run `python -m design_system_skill init` to create one.",
                    {"expected_path": str(path)},
                ))
            return Result.success([])
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
        base = path.parent
        entries = [RegistryEntry.from_dict(d, base) for d in data.get("systems", [])]
        return Result.success(entries)

    @classmethod
    def initialize_at(cls, path: Path, entries: list[RegistryEntry] | None = None) -> "Registry":
        """Create and persist a fresh single-file registry.

        Args:
            path: Where to write registry.yaml.
            entries: Initial entries (defaults to empty).

        Returns:
            A Registry with entries persisted to disk.
        """
        reg = cls([], entries or [], path, single_file=True)
        reg._save()
        return reg

    # ─── Lookup ──────────────────────────────────────────────────────

    def _merged(self) -> dict[str, RegistryEntry]:
        return {**self._builtin, **self._user}

    def get(self, system_id: str) -> RegistryEntry | None:
        """Look up a system by id (user entries shadow built-ins).

        Args:
            system_id: The system id.

        Returns:
            The RegistryEntry or None if not found.
        """
        return self._user.get(system_id) or self._builtin.get(system_id)

    def __contains__(self, system_id: str) -> bool:
        return system_id in self._user or system_id in self._builtin

    def __iter__(self) -> Iterator[RegistryEntry]:
        return iter(self._merged().values())

    def __len__(self) -> int:
        return len(self._merged())

    def all(self) -> list[RegistryEntry]:
        """Get all entries in id-sorted order (user entries shadow built-ins).

        Returns:
            List of RegistryEntry objects sorted by id.
        """
        return sorted(self._merged().values(), key=lambda e: e.id)

    def builtin_entries(self) -> list[RegistryEntry]:
        """Get the built-in layer's entries only, id-sorted.

        The repository gates (``drift --all``, ``contrast --all``) check
        the systems that ship here; a user-overlay system belongs to
        another project, whose own gates own it. In override mode the
        override file is the whole registry, so its entries are returned.

        Returns:
            List of RegistryEntry objects sorted by id.
        """
        layer = self._user if self._single_file else self._builtin
        return sorted(layer.values(), key=lambda e: e.id)

    @property
    def mutation_base(self) -> Path:
        """Directory that relative paths in newly written entries resolve
        against — the mutable registry file's directory.

        Returns:
            The directory of the file mutations persist to.
        """
        return self._user_path.parent

    # ─── Mutation ────────────────────────────────────────────────────

    def add(self, entry: RegistryEntry, replace: bool = False) -> Result:
        """Add or update a system in the mutable (user) layer.

        A replace of a built-in id writes a user-layer entry that shadows
        the built-in; the skill's own registry file is never modified.

        Args:
            entry: The RegistryEntry to add/update.
            replace: If True, overwrite an existing entry; else fail if exists.

        Returns:
            Result with the entry dict if successful.
        """
        if entry.id in self and not replace:
            return Result.failure(Error(
                "ALREADY_REGISTERED",
                f"System '{entry.id}' is already registered. Pass replace=True to overwrite.",
                {"system_id": entry.id, "existing": self.get(entry.id).to_dict()},
            ))
        if entry.status not in VALID_STATUSES:
            return Result.failure(Error(
                "SCHEMA_VALIDATION_FAILED",
                f"Invalid status '{entry.status}'. Must be one of: {sorted(VALID_STATUSES)}",
                {"status": entry.status},
            ))
        if entry.id in self._user and replace:
            self._snapshot_for_rollback(entry.id)
        entry.base = self.mutation_base
        self._user[entry.id] = entry
        self._save()
        return Result.success(entry.to_dict())

    def remove(self, system_id: str) -> Result:
        """Remove a system from the mutable (user) layer.

        Removing a user entry that shadowed a built-in reveals the
        built-in again. Built-in entries cannot be removed here — they
        are skill data, changed by editing the skill's own registry.

        Args:
            system_id: The system id to remove.

        Returns:
            Result with the removed entry dict if successful.
        """
        if system_id in self._user:
            removed = self._user.pop(system_id)
            self._save()
            return Result.success(removed.to_dict())
        if system_id in self._builtin:
            return Result.failure(Error(
                "BUILTIN_SYSTEM_IMMUTABLE",
                f"System '{system_id}' is built into the skill and cannot be "
                f"unregistered from the user registry. Edit the skill's own "
                f"registry at {builtin_registry_path()} to change built-ins.",
                {"system_id": system_id, "builtin_registry": str(builtin_registry_path())},
            ))
        return Result.failure(Error(
            "SYSTEM_NOT_FOUND",
            f"System '{system_id}' is not registered.",
            {"system_id": system_id},
        ))

    # ─── Persistence ─────────────────────────────────────────────────

    def _save(self) -> None:
        out = {
            "version": REGISTRY_VERSION,
            "systems": [e.to_dict() for e in sorted(self._user.values(), key=lambda e: e.id)],
        }
        self._user_path.parent.mkdir(parents=True, exist_ok=True)
        self._user_path.write_text(yaml.safe_dump(out, sort_keys=False))

    def _snapshot_for_rollback(self, system_id: str) -> None:
        """Stash the current mutable registry state so a replace can be
        undone. Snapshots live next to the registry as
        registry.yaml.bak.<unix-ts>."""
        if not self._user_path.exists():
            return
        ts = int(time.time())
        backup = self._user_path.with_suffix(self._user_path.suffix + f".bak.{ts}.{system_id}")
        shutil.copy2(self._user_path, backup)


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
    descriptors = []
    warnings: list[Error] = []
    for entry in reg.all():
        spec_path = entry.spec_path()
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
    """Register a design system in the registry's mutable layer.

    Validates spec.yaml and creates a registry entry. Paths are stored
    relative to the mutable registry's directory when possible, absolute
    otherwise (the normal case for systems living in other projects).
    The library_root defaults to <id> (if it exists next to the
    mutable registry) or the spec directory itself. Authors can override
    by editing the registry file.

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

    reg_result = Registry.load()
    if not reg_result.ok:
        return reg_result
    reg: Registry = reg_result.data

    base = reg.mutation_base
    try:
        spec_rel = str(spec_path.resolve().relative_to(base))
    except ValueError:
        spec_rel = str(spec_path.resolve())

    library_dir = base / system_id
    library_root = system_id if library_dir.exists() else str(spec_path.parent.relative_to(base) if spec_path.parent.is_relative_to(base) else spec_path.parent)

    entry = RegistryEntry(
        id=system_id,
        spec=spec_rel,
        status="available",
        library_root=library_root,
        base=base,
    )
    return reg.add(entry, replace=replace)


def unregister_system(system_id: str) -> Result:
    """Remove a system from the registry's mutable layer.

    Files on disk are not deleted. Built-in systems cannot be removed.

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
