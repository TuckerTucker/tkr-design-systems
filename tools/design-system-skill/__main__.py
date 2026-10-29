"""CLI shim for design-system-skill.

Usage from the project root:

    python3 design-system-skill list
    python3 design-system-skill load --id swiss
    python3 design-system-skill validate --spec swiss-spec.yaml
    python3 design-system-skill rulebook --id swiss
    python3 design-system-skill check --id swiss --artifact systems/swiss/layouts/dashboard.svg
    python3 design-system-skill register --spec /abs/path/to/new-spec.yaml [--replace]
    python3 design-system-skill unregister --id <id>
    python3 design-system-skill drift [--all | --id swiss | --spec systems/swiss/spec.yaml]
    python3 design-system-skill contrast [--all | --id swiss | --spec systems/swiss/spec.yaml] [--verbose]
    python3 design-system-skill jsx-drift [--id swiss ...] [--allowlist PATH]
    python3 design-system-skill common-tokens [--check | --write] [--id swiss | --spec PATH]

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
        check_drift,
        check_drift_all,
        check_color_gates_all,
        check_color_gates_for_spec,
        check_jsx_drift,
    )
    from design_system_skill.common_tokens import sync_all, sync_common_tokens  # noqa: E402
    from design_system_skill.registry import Registry  # noqa: E402

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

    p_drift = sub.add_parser(
        "drift",
        help="Check spec.yaml against its canonical tokens.json (default: all registered systems).",
    )
    target = p_drift.add_mutually_exclusive_group()
    target.add_argument("--all", action="store_true", help="Check every registered system (default).")
    target.add_argument("--id", help="Check one registered system.")
    target.add_argument("--spec", help="Check one spec.yaml by path.")

    p_contrast = sub.add_parser(
        "contrast",
        help="WCAG contrast + accent/danger hue gates over every mode "
             "(default: all registered systems).",
    )
    c_target = p_contrast.add_mutually_exclusive_group()
    c_target.add_argument("--all", action="store_true", help="Check every registered system (default).")
    c_target.add_argument("--id", help="Check one registered system.")
    c_target.add_argument("--spec", help="Check one spec.yaml by path.")
    p_contrast.add_argument("--verbose", action="store_true",
                            help="Include every pair in every mode, not just the worst per pair.")
    p_jsx = sub.add_parser(
        "jsx-drift",
        help="Check the showcase JSX for colour literals that bypass tokens.json (default: every page).",
    )
    p_jsx.add_argument("--id", action="append", dest="ids",
                       help="Showcase system id (repeatable), e.g. neutral, swiss.")
    p_jsx.add_argument("--allowlist", help="Allow-list YAML (default: apps/showcase/jsx-color-allowlist.yaml).")

    p_common = sub.add_parser(
        "common-tokens",
        help="Check (default) or rewrite each spec's tokens.common and themes blocks, "
             "derived from its tokens.json (default: every built-in system).",
    )
    mode = p_common.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true",
                      help="Report stale blocks without writing (the default).")
    mode.add_argument("--write", action="store_true", help="Rewrite stale blocks in place.")
    t_common = p_common.add_mutually_exclusive_group()
    t_common.add_argument("--id", help="One registered system.")
    t_common.add_argument("--spec", help="One spec.yaml by path.")

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
    if args.cmd in ("drift", "contrast"):
        if args.cmd == "drift":
            one, every = check_drift, check_drift_all
        else:
            def one(path):
                return check_color_gates_for_spec(path, verbose=args.verbose)

            def every():
                return check_color_gates_all(
                    checker=lambda p: check_color_gates_for_spec(p, verbose=args.verbose))
        if args.spec:
            return _emit(one(args.spec))
        if args.id:
            reg = Registry.load()
            if not reg.ok:
                return _emit(reg)
            entry = reg.data.get(args.id)
            if entry is None:
                print(json.dumps({"ok": False, "errors": [
                    {"code": "SYSTEM_NOT_FOUND", "message": f"System '{args.id}' is not registered"}]},
                    indent=2))
                return 1
            return _emit(one(entry.spec_path()))
        return _emit(every())
    if args.cmd == "common-tokens":
        if args.spec:
            return _emit(sync_common_tokens(args.spec, write=args.write))
        if args.id:
            reg = Registry.load()
            if not reg.ok:
                return _emit(reg)
            entry = reg.data.get(args.id)
            if entry is None:
                print(json.dumps({"ok": False, "errors": [
                    {"code": "SYSTEM_NOT_FOUND", "message": f"System '{args.id}' is not registered"}]},
                    indent=2))
                return 1
            return _emit(sync_common_tokens(entry.spec_path(), write=args.write))
        return _emit(sync_all(write=args.write))
    if args.cmd == "jsx-drift":
        allow = Path(args.allowlist).resolve() if args.allowlist else None
        return _emit(check_jsx_drift(args.ids, allowlist=allow))
    parser.error(f"Unknown command: {args.cmd}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
