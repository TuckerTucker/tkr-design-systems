"""get_rulebook + check_compliance.

`get_rulebook` returns a flat list of rules from a system's spec.
`check_compliance` runs the matching ruleset against an SVG artifact
by delegating to tools/builders/rulebook_check.py.

The integration with rulebook_check.py is import-based (not shell-out)
so we share check functions without process overhead. We do a lazy
import to avoid loading the full check machinery just to read a
rulebook.
"""

from __future__ import annotations
import importlib
import importlib.util
import sys
from pathlib import Path
from typing import Any, Callable

from .errors import Error, Result
from .loader import load_system
from .paths import project_root

import structlog

logger = structlog.get_logger(__name__)


# Map system_id → ruleset name in tools/builders/rulebook_check.py.
# Every registered system has at least one mechanical check (the project-
# wide no-emoji-imagery rule). Per-system rulesets that carry richer
# checks (palette, type-scale, etc.) live in tools/builders/rulebook_check.py
# alongside the no-emoji check; systems without per-system mechanical
# checks beyond no-emoji still route through their own ruleset name so
# the count is accurate.
_RULESET_BY_SYSTEM = {
    "swiss": "swiss",
    "wireframe": "wireframe",
    "editorial": "editorial",
    "sketch": "sketch",
    "prism": "prism",
    "revolt": "revolt",
    "terminal": "terminal",
    "riso": "riso",
}


def get_rulebook(system_id: str) -> Result:
    """Get the flattened rulebook for a system.

    Args:
        system_id: The system id (e.g. "swiss").

    Returns:
        Result with data=list of rule dicts {id, rule, rationale, severity,
        check_method, check_scope, applies_when, scope}. The `scope` field
        is a convenience: 'global' if check_scope is artifact|both, or
        'component' if check_scope is component.
    """
    sys_result = load_system(system_id)
    if not sys_result.ok:
        return sys_result
    spec = sys_result.data
    rulebook = spec.get("rulebook") or []
    out = []
    for rule in rulebook:
        if not isinstance(rule, dict):
            continue
        check_scope = rule.get("check_scope", "both")
        if check_scope == "component":
            scope = "component"
        else:
            scope = "global"
        out.append({
            "id": rule.get("id"),
            "rule": rule.get("rule"),
            "rationale": rule.get("rationale"),
            "severity": rule.get("severity"),
            "check_method": rule.get("check_method"),
            "check_scope": check_scope,
            "applies_when": rule.get("applies_when"),
            "scope": scope,
            "check_implementation": rule.get("check_implementation"),
        })
    return Result.success(out)


def check_compliance(
    system_id: str,
    artifact_path: str | Path,
    scope: str | None = None,
    exceptions_path: str | Path | None = None,
) -> Result:
    """Run the system's mechanical rulebook against an SVG artifact.

    Violations allow-listed in the system's ``rulebook-exceptions.yaml``
    (next to its spec.yaml; format in tools/builders/rulebook_check.py)
    are reported with status "waived" and their reasons under
    ``detail.waivers``; they count as passing. An entry naming this
    artifact that matched no violation is reported as a failing
    ``rulebook-exception-stale`` result.

    Args:
        system_id: The system id.
        artifact_path: Path to SVG artifact to check.
        scope: "component", "artifact", or None (auto-detect).
        exceptions_path: Allow-list file to use instead of the system's
            own; mainly for tests and tooling.

    Returns:
        Result with data={system_id, artifact_path, scope, passed, failed,
        advisory, waived, results=[{rule_id, status, detail}, ...],
        ruleset, mechanical_only, exceptions_file}. status is one of
        pass | fail | advisory | waived. Fails with EXCEPTIONS_INVALID when
        the exceptions file doesn't validate (e.g. an entry has no reason).
    """
    artifact_path = Path(artifact_path).resolve()
    if not artifact_path.exists():
        return Result.failure(Error(
            "INVALID_PATH",
            f"Artifact not found: {artifact_path}",
            {"path": str(artifact_path)},
        ))

    # Confirm system is loadable (also catches SYSTEM_NOT_FOUND early).
    sys_result = load_system(system_id)
    if not sys_result.ok:
        return sys_result

    ruleset = _RULESET_BY_SYSTEM.get(system_id)
    if ruleset is None:
        return Result.success({
            "system_id": system_id,
            "artifact_path": str(artifact_path),
            "scope": scope or "all",
            "passed": 0,
            "failed": 0,
            "advisory": 0,
            "waived": 0,
            "results": [],
            "ruleset": None,
            "mechanical_only": True,
            "exceptions_file": None,
            "note": (
                f"No mechanical ruleset implemented for '{system_id}' yet. "
                f"get_rulebook returns the declarative rulebook for human or "
                f"semantic-LLM review."
            ),
        })

    rb_module = _import_rulebook_check_module()
    if rb_module is None:
        return Result.failure(Error(
            "INTERNAL",
            "Could not import tools/builders/rulebook_check.py. Ensure the repository layout is intact.",
            {"project_root": str(project_root())},
        ))

    if scope is None:
        scope = rb_module.detect_scope(str(artifact_path))

    all_checks = rb_module.CHECKS_BY_RULESET.get(ruleset)
    if all_checks is None:
        return Result.failure(Error(
            "RULESET_UNKNOWN",
            f"No mechanical ruleset registered for '{ruleset}'.",
            {"ruleset": ruleset, "available": sorted(rb_module.CHECKS_BY_RULESET)},
        ))
    advisory_rules = rb_module.ADVISORY_BY_RULESET.get(ruleset, set())
    selected = rb_module._select_checks(all_checks, scope)

    if exceptions_path is None:
        exceptions_path = (
            Path(sys_result.data["_meta"]["spec_path"]).parent / rb_module.EXCEPTIONS_FILENAME
        )
    exceptions_path = Path(exceptions_path)
    try:
        if exceptions_path.exists():
            exceptions = rb_module.load_exceptions(
                exceptions_path, rb_module.known_rule_ids(ruleset))
        else:
            exceptions = rb_module.ExceptionSet(base_dir=exceptions_path.parent.resolve())
    except rb_module.ExceptionsFileError as exc:
        logger.warning("rulebook_exceptions_invalid", path=str(exc.path), errors=exc.errors)
        return Result.failure(Error(
            "EXCEPTIONS_INVALID",
            f"Invalid rulebook exceptions file {exc.path}: {'; '.join(exc.errors)}",
            {"path": str(exc.path), "errors": exc.errors},
        ))

    svg_text = artifact_path.read_text()
    counts = {"pass": 0, "fail": 0, "advisory": 0, "waived": 0}
    results = []
    for check_fn, _scope in selected:
        result = exceptions.apply(artifact_path, check_fn(svg_text))
        status = rb_module.classify(result, advisory_rules)
        counts[status] += 1
        results.append({
            "rule_id": result.get("rule_id"),
            "status": status,
            "detail": {k: v for k, v in result.items()
                       if k not in ("rule_id", "passed", "waived")},
        })

    # Stale entries for this artifact fail the check so the list can't rot.
    stale = exceptions.stale()
    for entry in stale:
        counts["fail"] += 1
        results.append({
            "rule_id": rb_module.STALE_RULE_ID,
            "status": "fail",
            "detail": rb_module.stale_detail(entry),
        })
    if stale:
        logger.info("rulebook_exceptions_stale", artifact=str(artifact_path),
                    entries=[e.describe() for e in stale])

    return Result.success({
        "system_id": system_id,
        "artifact_path": str(artifact_path),
        "scope": scope,
        "passed": counts["pass"],
        "failed": counts["fail"],
        "advisory": counts["advisory"],
        "waived": counts["waived"],
        "results": results,
        "ruleset": ruleset,
        "mechanical_only": True,
        "exceptions_file": str(exceptions.source) if exceptions.source else None,
    })


# ─── Internal: import tools/builders/rulebook_check.py ──────────────

_RB_MODULE_CACHE: Any = None


def _import_rulebook_check_module():
    """Import tools/builders/rulebook_check.py as a module.

    Returns:
        The imported module or None if not found.
    """
    global _RB_MODULE_CACHE
    if _RB_MODULE_CACHE is not None:
        return _RB_MODULE_CACHE
    # Resolve relative to this file so the env-override registry location
    # cannot break builder discovery.
    # parents = [design_system_skill, design-system-skill, tools, ...]
    rb_path = Path(__file__).resolve().parents[2] / "builders" / "rulebook_check.py"
    if not rb_path.exists():
        return None
    spec = importlib.util.spec_from_file_location("rulebook_check_internal", rb_path)
    if spec is None or spec.loader is None:
        return None
    module = importlib.util.module_from_spec(spec)
    sys.modules["rulebook_check_internal"] = module
    spec.loader.exec_module(module)
    _RB_MODULE_CACHE = module
    return module
