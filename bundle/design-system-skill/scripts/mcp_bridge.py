"""MCP bridge for design-system-skill.

A stable subprocess entry point for hosts that call the skill from another
language (tkr-kit's TypeScript MCP surface was its first caller):

    python3 mcp_bridge.py <action> <json-args>

where <json-args> is a single JSON object, or `@/abs/path.json` to read the
object from a file (large-payload indirection — argv has an OS size limit).

Contract:
  - Exactly one compact JSON object is printed to stdout. Nothing else.
  - Exit code is 0 whenever a JSON envelope was printed — success/failure is
    carried in the envelope's `ok` field, so the TypeScript caller
    (parseJson: true) always receives the structured body.
  - Exit code 2 only when argv itself is unusable (missing action, bad JSON).

Logging: structlog is configured to write to stderr BEFORE any skill import —
the skills log via structlog, and its unconfigured default PrintLogger writes
to stdout, which would corrupt the JSON contract. This mirrors tkr-kit's
stderr-only logger mode for protocol processes (core/lib/logger.ts).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Callable


def _setup_path() -> None:
    """Ensure the package directory is importable (same as __main__.py)."""
    here = Path(__file__).resolve().parent
    if str(here) not in sys.path:
        sys.path.insert(0, str(here))


def _emit(payload: dict[str, Any]) -> None:
    """Print exactly one compact JSON object to stdout."""
    print(json.dumps(payload, default=str))


def _parse_args_blob(blob: str) -> dict[str, Any]:
    """Parse the JSON args argv element, honoring @file indirection."""
    if blob.startswith("@"):
        blob = Path(blob[1:]).read_text()
    parsed = json.loads(blob)
    if not isinstance(parsed, dict):
        raise ValueError("args JSON must be an object")
    return parsed


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        _emit({"ok": False, "errors": [
            "usage: mcp_bridge.py <action> <json-args>",
        ]})
        return 2
    action = argv[1]
    try:
        args = _parse_args_blob(argv[2]) if len(argv) > 2 else {}
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        _emit({"ok": False, "errors": [f"could not parse json args: {exc}"]})
        return 2

    _setup_path()

    # Route all skill logging to stderr before any skill import.
    try:
        import structlog
        structlog.configure(
            logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
        )
    except ImportError as exc:
        _emit({"ok": False, "errors": [
            f"missing python dependency: {exc.name} — pip install structlog pyyaml",
        ]})
        return 0

    try:
        from design_system_skill import (
            list_systems,
            validate_spec,
            get_rulebook,
            check_compliance,
        )
    except ImportError as exc:
        _emit({"ok": False, "errors": [
            f"missing python dependency: {exc.name} — pip install structlog pyyaml",
        ]})
        return 0

    def _list(_: dict[str, Any]) -> dict[str, Any]:
        return list_systems().to_dict()

    def _validate(a: dict[str, Any]) -> dict[str, Any]:
        return validate_spec(
            a["spec_path"], library_root=a.get("library_root"),
        ).to_dict()

    def _rulebook(a: dict[str, Any]) -> dict[str, Any]:
        return get_rulebook(a["system_id"]).to_dict()

    def _compliance(a: dict[str, Any]) -> dict[str, Any]:
        return check_compliance(
            a["system_id"], a["artifact_path"], scope=a.get("scope"),
        ).to_dict()

    actions: dict[str, Callable[[dict[str, Any]], dict[str, Any]]] = {
        "list": _list,
        "validate": _validate,
        "rulebook": _rulebook,
        "compliance": _compliance,
    }

    handler = actions.get(action)
    if handler is None:
        _emit({"ok": False, "errors": [
            f"unknown action '{action}'. Available: {sorted(actions)}",
        ]})
        return 0

    try:
        _emit(handler(args))
    except KeyError as exc:
        _emit({"ok": False, "errors": [f"missing required arg: {exc}"]})
    except Exception as exc:  # noqa: BLE001 — envelope carries the error
        _emit({"ok": False, "errors": [str(exc)]})
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
