"""Smoke tests for the design-system-skill MCP bridge.

Run from the repository root:
    uv run pytest -q tools/design-system-skill/test_design_system_mcp_bridge.py

Each test invokes mcp_bridge.py as a subprocess (the same way tkr-kit's MCP
server does) and asserts the stdout-purity contract: exactly one parseable
JSON object on stdout, exit 0 whenever an envelope was printed.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
BRIDGE = HERE / "mcp_bridge.py"
SYSTEMS = HERE.parents[1] / "systems"

# Hermetic: pin the user-registry overlay to a nonexistent sandbox path so a
# developer's real ~/.claude/design-systems entries can't leak into asserts.
_ENV = {
    **os.environ,
    "DESIGN_SYSTEM_SKILL_USER_REGISTRY": str(
        Path(tempfile.mkdtemp(prefix="dss-bridge-test-")) / "registry.yaml"
    ),
}

PASSED = 0
FAILED = 0


def assert_(condition: bool, label: str, detail: str = "") -> None:
    global PASSED, FAILED
    if condition:
        PASSED += 1
        print(f"  PASS  {label}")
    else:
        FAILED += 1
        print(f"  FAIL  {label}" + (f"\n        {detail}" if detail else ""))
        # Under pytest a counted failure would pass silently; fail the test instead.
        if "pytest" in sys.modules:
            raise AssertionError(f"{label}: {detail}" if detail else label)


def section(name: str) -> None:
    print(f"\n── {name} ──")


def run_bridge(action: str, args_json: str) -> tuple[int, dict | None, str]:
    """Invoke the bridge; return (exit_code, parsed_stdout_or_None, stdout)."""
    proc = subprocess.run(
        [sys.executable, str(BRIDGE), action, args_json],
        capture_output=True, text=True, env=_ENV, timeout=60,
    )
    try:
        parsed = json.loads(proc.stdout)
    except json.JSONDecodeError:
        parsed = None
    return proc.returncode, parsed, proc.stdout


def test_list_is_pure_json() -> None:
    section("list: pure JSON envelope on stdout")
    code, parsed, raw = run_bridge("list", "{}")
    assert_(code == 0, "exit code 0")
    assert_(parsed is not None, "stdout parses as JSON (purity)", raw[:200])
    if parsed is None:
        return
    assert_(parsed["ok"] is True, "ok=True")
    ids = [d["id"] for d in parsed["data"]]
    assert_("swiss" in ids and "wireframe" in ids and "neutral" in ids,
            f"built-in systems listed (got {len(ids)})")


def test_rulebook() -> None:
    section("rulebook: returns scoped entries")
    code, parsed, raw = run_bridge("rulebook", '{"system_id": "swiss"}')
    assert_(code == 0 and parsed is not None and parsed["ok"],
            "rulebook(swiss) ok", raw[:200])
    if parsed and parsed.get("ok"):
        assert_(len(parsed["data"]) > 0, "rulebook has entries")


def test_compliance() -> None:
    section("compliance: checks a vendored artifact")
    artifact = SYSTEMS / "swiss" / "layouts" / "dashboard.svg"
    code, parsed, raw = run_bridge(
        "compliance",
        json.dumps({"system_id": "swiss", "artifact_path": str(artifact)}),
    )
    assert_(code == 0 and parsed is not None and parsed["ok"],
            "compliance(swiss, dashboard.svg) ok", raw[:200])
    if parsed and parsed.get("ok"):
        assert_("passed" in parsed["data"] and "failed" in parsed["data"],
                "result carries passed/failed counts")


def test_validate() -> None:
    section("validate: validates a vendored spec")
    spec = SYSTEMS / "swiss" / "spec.yaml"
    code, parsed, raw = run_bridge(
        "validate", json.dumps({"spec_path": str(spec)}),
    )
    assert_(code == 0 and parsed is not None and parsed["ok"],
            "validate(swiss spec) ok", raw[:200])


def test_error_envelopes() -> None:
    section("error envelopes: unknown action, missing arg, bad argv")
    code, parsed, _ = run_bridge("nope", "{}")
    assert_(code == 0 and parsed is not None and parsed["ok"] is False,
            "unknown action → ok:false envelope, exit 0")
    code, parsed, _ = run_bridge("rulebook", "{}")
    assert_(code == 0 and parsed is not None and parsed["ok"] is False
            and "system_id" in " ".join(parsed["errors"]),
            "missing required arg → ok:false names the arg")
    code, parsed, _ = run_bridge("list", "not-json")
    assert_(code == 2 and parsed is not None and parsed["ok"] is False,
            "unparseable argv → error envelope, exit 2")


def test_file_indirection() -> None:
    section("@file indirection for large payloads")
    with tempfile.NamedTemporaryFile(
        suffix=".json", mode="w", delete=False,
    ) as f:
        f.write('{"system_id": "swiss"}')
        path = f.name
    code, parsed, raw = run_bridge("rulebook", f"@{path}")
    assert_(code == 0 and parsed is not None and parsed["ok"],
            "@file args resolve the same as inline JSON", raw[:200])
    Path(path).unlink(missing_ok=True)


def main() -> int:
    print("design-system-skill mcp_bridge smoke tests\n" + "=" * 50)
    test_list_is_pure_json()
    test_rulebook()
    test_compliance()
    test_validate()
    test_error_envelopes()
    test_file_indirection()
    print(f"\n{'=' * 50}")
    print(f"Total: {PASSED + FAILED}  Passed: {PASSED}  Failed: {FAILED}")
    return 0 if FAILED == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
