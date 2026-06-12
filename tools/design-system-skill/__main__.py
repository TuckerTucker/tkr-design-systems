"""CLI shim for design-system-skill.

Usage from the project root:

    python3 design-system-skill list
    python3 design-system-skill load --id swiss
    python3 design-system-skill validate --spec swiss-spec.yaml
    python3 design-system-skill rulebook --id swiss
    python3 design-system-skill check --id swiss --artifact systems/swiss/layouts/dashboard.svg
    python3 design-system-skill register --spec /abs/path/to/new-spec.yaml [--replace]
    python3 design-system-skill unregister --id <id>

All commands print a JSON Result to stdout. Exit code 0 if ok, 1 otherwise.
"""

from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path


def _setup_path() -> None:
    """Ensure the package directory is importable. Lets the CLI run from
    anywhere without requiring `pip install -e`."""
    here = Path(__file__).resolve().parent
    if str(here) not in sys.path:
        sys.path.insert(0, str(here))


def _emit(result) -> int:
    """Print Result.to_dict() as JSON and return an exit code."""
    payload = result.to_dict() if hasattr(result, "to_dict") else result
    print(json.dumps(payload, indent=2, default=str))
    return 0 if payload.get("ok", False) else 1


def main(argv: list[str] | None = None) -> int:
    _setup_path()
    from design_system_skill import (  # noqa: E402
        load_system,
        list_systems,
        validate_spec,
        register_system,
        unregister_system,
        get_rulebook,
        check_compliance,
    )

    parser = argparse.ArgumentParser(
        prog="design-system-skill",
        description="Registry, validation, and rulebook checking for tkr-kit design systems.",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_list = sub.add_parser("list", help="List all registered systems.")  # noqa: F841

    p_load = sub.add_parser("load", help="Load and return a system spec.")
    p_load.add_argument("--id", required=True, help="System id (e.g. swiss).")
    p_load.add_argument("--no-validate", action="store_true",
                        help="Skip schema validation (for debugging).")

    p_validate = sub.add_parser("validate", help="Validate a spec.yaml without registering.")
    p_validate.add_argument("--spec", required=True, help="Path to spec.yaml.")

    p_rulebook = sub.add_parser("rulebook", help="Return the flattened rulebook for a system.")
    p_rulebook.add_argument("--id", required=True)

    p_check = sub.add_parser("check", help="Check an SVG artifact against a system's rulebook.")
    p_check.add_argument("--id", required=True)
    p_check.add_argument("--artifact", required=True, help="Path to SVG file.")
    p_check.add_argument("--scope", choices=["component", "artifact", "all"],
                         default=None, help="Override scope auto-detection.")

    p_register = sub.add_parser("register", help="Add a system to the registry.")
    p_register.add_argument("--spec", required=True,
                            help="Path to spec.yaml or its containing directory.")
    p_register.add_argument("--replace", action="store_true",
                            help="Overwrite an existing entry of the same id.")

    p_unregister = sub.add_parser("unregister", help="Remove a system from the registry.")
    p_unregister.add_argument("--id", required=True)

    args = parser.parse_args(argv)

    if args.cmd == "list":
        return _emit(list_systems())
    if args.cmd == "load":
        return _emit(load_system(args.id, validate=not args.no_validate))
    if args.cmd == "validate":
        return _emit(validate_spec(args.spec))
    if args.cmd == "rulebook":
        return _emit(get_rulebook(args.id))
    if args.cmd == "check":
        return _emit(check_compliance(args.id, args.artifact, scope=args.scope))
    if args.cmd == "register":
        return _emit(register_system(args.spec, replace=args.replace))
    if args.cmd == "unregister":
        return _emit(unregister_system(args.id))
    parser.error(f"Unknown command: {args.cmd}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
