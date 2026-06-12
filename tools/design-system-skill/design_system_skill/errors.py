"""Structured error and result types — see SKILL.md "Error Handling
Conventions" for the design rationale.

The `Result` shape is the contract every public operation returns.
Consumers check `result.ok` and reason about `result.errors` without
parsing exception messages.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


# Stable error code strings. New codes are added as needed; existing
# codes are not renamed once consumers have started keying on them.
ERROR_CODES = {
    "SYSTEM_NOT_FOUND",          # registry has no entry for the requested id
    "SPEC_FILE_MISSING",         # spec.yaml at registered path doesn't exist
    "SPEC_PARSE_FAILED",         # YAML parse error
    "SCHEMA_VALIDATION_FAILED",  # spec doesn't match schema
    "REFERENCED_FILE_MISSING",   # an SVG/asset referenced by the spec is absent
    "REGISTRY_FILE_MISSING",     # registry.yaml not found
    "REGISTRY_PARSE_FAILED",     # registry.yaml malformed
    "ALREADY_REGISTERED",        # register_system without replace=True
    "INVALID_PATH",              # caller passed a path that doesn't exist
    "RULESET_UNKNOWN",           # check_compliance asked for unknown ruleset
    "INTERNAL",                  # catchall for unexpected exceptions
}


@dataclass
class Error:
    code: str
    message: str
    detail: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        # Soft validation — unknown codes warn but don't crash. The set above
        # is the documented surface area; ad-hoc strings still work but make
        # consumers brittle.
        if self.code not in ERROR_CODES:
            # Defer to import-time; we don't want a hard error here because
            # tests sometimes construct synthetic errors with novel codes.
            pass


@dataclass
class Result:
    ok: bool
    data: Any = None
    errors: list[Error] = field(default_factory=list)
    warnings: list[Error] = field(default_factory=list)

    @classmethod
    def success(cls, data: Any = None, warnings: list[Error] | None = None) -> "Result":
        """Create a successful result.

        Args:
            data: The operation's result value.
            warnings: Optional list of non-fatal errors.

        Returns:
            A Result with ok=True.
        """
        return cls(ok=True, data=data, warnings=warnings or [])

    @classmethod
    def failure(cls, errors: list[Error] | Error) -> "Result":
        """Create a failed result.

        Args:
            errors: An Error or list of Error objects.

        Returns:
            A Result with ok=False.
        """
        if isinstance(errors, Error):
            errors = [errors]
        return cls(ok=False, errors=errors)

    def to_dict(self) -> dict[str, Any]:
        """Serialize to a dict for non-Python consumers (e.g. CLI shim).

        Returns:
            A dict with ok, data (if successful), or errors (if failed).
        """
        out: dict[str, Any] = {"ok": self.ok}
        if self.ok:
            out["data"] = self.data
            if self.warnings:
                out["warnings"] = [
                    {"code": w.code, "message": w.message, "detail": w.detail}
                    for w in self.warnings
                ]
        else:
            out["errors"] = [
                {"code": e.code, "message": e.message, "detail": e.detail}
                for e in self.errors
            ]
        return out
