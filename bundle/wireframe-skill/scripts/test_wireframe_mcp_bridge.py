"""Smoke tests for the wireframe-skill MCP bridge.

Run from the repository root:
    uv run pytest -q tools/wireframe-skill/test_wireframe_mcp_bridge.py

Each test invokes mcp_bridge.py as a subprocess (the way a host process
calls it) and asserts the stdout-purity contract: exactly one parseable
JSON object on stdout, exit 0 whenever an envelope was printed. The repository's
swiss/wireframe libraries serve as hermetic fixtures.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
BRIDGE = HERE / "mcp_bridge.py"

# Hermetic: pin the user-registry overlay to a nonexistent sandbox path.
_ENV = {
    **os.environ,
    "DESIGN_SYSTEM_SKILL_USER_REGISTRY": str(
        Path(tempfile.mkdtemp(prefix="wf-bridge-test-")) / "registry.yaml"
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


def run_bridge(action: str, args: dict) -> tuple[int, dict | None, str]:
    """Invoke the bridge; return (exit_code, parsed_stdout_or_None, stdout)."""
    proc = subprocess.run(
        [sys.executable, str(BRIDGE), action, json.dumps(args)],
        capture_output=True, text=True, env=_ENV, timeout=120,
    )
    try:
        parsed = json.loads(proc.stdout)
    except json.JSONDecodeError:
        parsed = None
    return proc.returncode, parsed, proc.stdout


def test_select_layout() -> None:
    section("select_layout: inventory with patterns + components")
    code, parsed, raw = run_bridge(
        "select_layout", {"brief": "settings page", "system_id": "swiss"},
    )
    assert_(code == 0, "exit code 0")
    assert_(parsed is not None, "stdout parses as JSON (purity)", raw[:200])
    if parsed is None:
        return
    assert_(parsed["ok"] is True, "ok=True")
    assert_(len(parsed["available_patterns"]) > 0, "patterns listed")
    assert_(len(parsed["available_components"]) > 0, "components listed")


def test_generate_routing_and_layout_id() -> None:
    section("generate: routing request, then explicit layout_id")
    code, parsed, raw = run_bridge("generate", {
        "brief": "a triage queue", "system_id": "swiss",
        "request_routing": True,
    })
    assert_(code == 0 and parsed is not None and parsed["ok"],
            "request_routing returns ok envelope", raw[:200])
    if parsed and parsed.get("ok"):
        assert_(parsed["routing_request"]["action"] == "select_routing",
                "routing_request carries the inventory")
        assert_(parsed["svg_path"] is None, "no files written in routing pass")

    out = Path(tempfile.mkdtemp(prefix="wf-bridge-gen-"))
    try:
        code, parsed, raw = run_bridge("generate", {
            "brief": "ops dashboard", "system_id": "swiss",
            "layout_id": "dashboard", "output_dir": str(out),
        })
        assert_(code == 0 and parsed is not None and parsed["ok"],
                "layout_id generate succeeds", raw[:300])
        if parsed and parsed.get("ok"):
            assert_(Path(parsed["svg_path"]).exists(), "svg emitted to output_dir")
    finally:
        shutil.rmtree(out, ignore_errors=True)


def test_substitution_flow() -> None:
    section("substitution_request → apply_substitutions round trip")
    code, parsed, raw = run_bridge("substitution_request", {
        "brief": "meditation app dashboard", "system_id": "swiss",
        "layout_id": "dashboard",
    })
    assert_(code == 0 and parsed is not None and parsed["ok"],
            "substitution_request with layout_id ok", raw[:300])
    if not (parsed and parsed.get("ok")):
        return
    assert_(len(parsed["text_nodes"]) > 0, "text nodes extracted")
    svg_path = parsed["selected_pattern"]["svg_path"]

    out = Path(tempfile.mkdtemp(prefix="wf-bridge-sub-"))
    try:
        find = parsed["text_nodes"][0]["content"]
        code, applied, raw = run_bridge("apply_substitutions", {
            "svg_path": svg_path, "system_id": "swiss",
            "substitutions": [
                {"find": find, "replace": "BREATHE", "rationale": "brief"},
            ],
            "output_path": str(out / "subbed.svg"),
        })
        assert_(code == 0 and applied is not None and applied["ok"],
                "apply_substitutions ok", raw[:300])
        if applied and applied.get("ok"):
            assert_("svg_text" not in applied,
                    "inline svg_text suppressed when output_path given")
            assert_("BREATHE" in Path(applied["svg_path"]).read_text(),
                    "substitution landed in the written file")
    finally:
        shutil.rmtree(out, ignore_errors=True)

    # Missing layout_id surfaces available_patterns instead of guessing.
    code, parsed, _ = run_bridge("substitution_request", {
        "brief": "anything", "system_id": "swiss",
    })
    assert_(code == 0 and parsed is not None and parsed["ok"] is False
            and len(parsed.get("available_patterns", [])) > 0,
            "missing layout_id → ok:false + available_patterns")


def test_assemble_blueprint() -> None:
    section("assemble_blueprint: library + custom SVG components")
    out = Path(tempfile.mkdtemp(prefix="wf-bridge-bp-"))
    blueprint = {
        "schema_version": "1.0",
        "canvas": {"width": 1280, "height": 800},
        "regions": [{
            "id": "main", "x": 0, "y": 0, "w": 1280, "h": 800,
            "components": [
                {"component_id": "card-default", "x": 20, "y": 20},
                {"type": "custom", "component_id": "my-slider",
                 "x": 20, "y": 300,
                 "svg": "<rect x='0' y='8' width='260' height='4' fill='#E0E0E0'/>"},
            ],
        }],
    }
    try:
        code, parsed, raw = run_bridge("assemble_blueprint", {
            "system_id": "swiss", "blueprint": blueprint,
            "output_dir": str(out),
        })
        assert_(code == 0 and parsed is not None and parsed["ok"],
                "assemble ok", raw[:300])
        if parsed and parsed.get("ok"):
            assert_(Path(parsed["svg_path"]).exists(), "svg written")
            assert_(len(parsed["components_used"]) == 2,
                    "components_used reports both library + custom entries")
            import yaml
            emitted = yaml.safe_load(Path(parsed["spec_path"]).read_text())
            recorded = (emitted.get("design_system") or {}).get("components_used") or []
            assert_(len(recorded) == 2,
                    "emitted spec.yaml records components_used",
                    json.dumps(emitted.get("design_system"), default=str)[:300])
            assert_("svg_text" not in parsed,
                    "inline svg_text suppressed when output_dir given")

        bad = dict(blueprint)
        bad["regions"] = [{
            "id": "main", "x": 0, "y": 0, "w": 100, "h": 100,
            "components": [{"component_id": "not-a-component", "x": 0, "y": 0}],
        }]
        code, parsed, _ = run_bridge("assemble_blueprint", {
            "system_id": "swiss", "blueprint": bad,
        })
        assert_(code == 0 and parsed is not None and parsed["ok"] is False
                and parsed["validation_errors"],
                "validation errors block assembly")
    finally:
        shutil.rmtree(out, ignore_errors=True)


def test_tokens_and_read_component() -> None:
    section("tokens + read_component")
    code, parsed, raw = run_bridge("tokens", {"system_id": "wireframe"})
    assert_(code == 0 and parsed is not None and parsed["ok"]
            and len(parsed["palette"]) > 0,
            "tokens returns authoring vocabulary", raw[:200])

    code, parsed, _ = run_bridge("read_component", {
        "system_id": "wireframe", "component_id": "toggle",
    })
    assert_(code == 0 and parsed is not None and parsed["ok"]
            and parsed["component_id"] == "toggle-default",
            "read_component resolves base id")

    code, parsed, _ = run_bridge("read_component", {
        "system_id": "wireframe",
        "component_ids": ["button-primary", "does-not-exist"],
    })
    assert_(code == 0 and parsed is not None and parsed["ok"]
            and len(parsed["components"]) == 2
            and parsed["components"][1]["ok"] is False,
            "batch read collects per-id errors")

    code, parsed, _ = run_bridge("read_component", {"system_id": "wireframe"})
    assert_(code == 0 and parsed is not None and parsed["ok"] is False,
            "neither id form → ok:false")


def test_error_envelopes() -> None:
    section("error envelopes")
    code, parsed, _ = run_bridge("nope", {})
    assert_(code == 0 and parsed is not None and parsed["ok"] is False,
            "unknown action → ok:false envelope, exit 0")
    code, parsed, _ = run_bridge("tokens", {"system_id": "no-such-system"})
    assert_(code == 0 and parsed is not None and parsed["ok"] is False,
            "unknown system → ok:false envelope")
    proc = subprocess.run(
        [sys.executable, str(BRIDGE), "tokens", "not-json"],
        capture_output=True, text=True, env=_ENV, timeout=30,
    )
    assert_(proc.returncode == 2, "unparseable argv → exit 2")


def main() -> int:
    print("wireframe-skill mcp_bridge smoke tests\n" + "=" * 50)
    test_select_layout()
    test_generate_routing_and_layout_id()
    test_substitution_flow()
    test_assemble_blueprint()
    test_tokens_and_read_component()
    test_error_envelopes()
    print(f"\n{'=' * 50}")
    print(f"Total: {PASSED + FAILED}  Passed: {PASSED}  Failed: {FAILED}")
    return 0 if FAILED == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
