"""Tests for wireframe_skill.solve and the ``solve-layout`` subcommand.

``design.solve_layout`` is a tkr-kit operation. These tests stand a small
executable in for the tkr-kit CLI — a real process speaking the CLI's
contract (``op <id> --input <json> --json`` → ``{"output": ...}`` on stdout,
an error envelope on stderr with a non-zero exit) — because tkr-kit is a
separate product that cannot be run from this repository. What is under
test is this skill's side of that contract: runner resolution, argv shape,
envelope parsing, overflow refusal and the blueprint it writes.

Run from the repository root:
    uv run pytest -q tools/wireframe-skill/test_solve.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import textwrap
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from wireframe_skill.solve import (  # noqa: E402
    LayoutSolveFailed,
    LayoutSolveUnavailable,
    describe_overflows,
    resolve_runner,
    solve_layout,
)

BLUEPRINT = {"schema_version": "1.0", "canvas": {"width": 1280, "height": 800},
             "regions": [{"id": "root", "x": 0, "y": 0, "w": 1280, "h": 800, "components": []}]}


def _fake_cli(tmp_path: Path, overflows: list | None = None, fail: bool = False) -> Path:
    """Write an executable that answers like `tkr op design.solve_layout`."""
    script = tmp_path / "fake-tkr"
    record = tmp_path / "argv.json"
    script.write_text(textwrap.dedent(f"""\
        #!{sys.executable}
        import json, sys
        json.dump(sys.argv[1:], open({str(record)!r}, "w"))
        if {fail!r}:
            sys.stderr.write(json.dumps({{"error": {{"code": "invalid_input", "message": "unknown system"}}}}))
            sys.exit(3)
        payload = json.loads(sys.argv[sys.argv.index("--input") + 1])
        print(json.dumps({{"output": {{
            "spacing": {{"none": 0, "xs": 8}},
            "boxes": [],
            "blueprint": {json.dumps(BLUEPRINT)},
            "overflows": {json.dumps(overflows or [])},
            "echo": payload,
        }}}}))
        """))
    script.chmod(0o755)
    return script


def test_runner_resolution_order(tmp_path: Path):
    assert resolve_runner({"TKR_CLI": "bun run cli.ts"}, which=lambda _: None) == \
        ["bun", "run", "cli.ts", "op"]
    assert resolve_runner({}, which=lambda name: "/bin/tkr" if name == "tkr" else None) == ["tkr", "op"]
    home = tmp_path / "kit"
    (home / "bin").mkdir(parents=True)
    (home / "bin" / "tkr-cli.ts").write_text("")
    assert resolve_runner({"TKR_KIT_HOME": str(home)},
                          which=lambda name: "/bin/bun" if name == "bun" else None) == \
        ["bun", "run", str(home / "bin" / "tkr-cli.ts")]
    with pytest.raises(LayoutSolveUnavailable):
        resolve_runner({}, which=lambda _: None)


def test_solve_layout_sends_the_operation_payload(tmp_path: Path):
    cli = _fake_cli(tmp_path)
    tree = {"kind": "box", "id": "shell", "children": []}
    solution = solve_layout(tree, "swiss", {"width": 1280, "height": 800}, scope="swiss",
                            runner=[str(cli), "op"])
    argv = json.loads((tmp_path / "argv.json").read_text())
    assert argv[:2] == ["op", "design.solve_layout"]
    assert argv[-1] == "--json"
    assert solution["echo"] == {"systemId": "swiss", "canvas": {"width": 1280, "height": 800},
                                "tree": tree, "scope": "swiss"}
    assert solution["blueprint"] == BLUEPRINT


def test_solve_layout_surfaces_the_error_envelope(tmp_path: Path):
    cli = _fake_cli(tmp_path, fail=True)
    with pytest.raises(LayoutSolveFailed, match="invalid_input: unknown system"):
        solve_layout({}, "nope", {"width": 1, "height": 1}, runner=[str(cli), "op"])


def test_describe_overflows():
    lines = describe_overflows([{"id": "card", "containerId": "main", "against": "container",
                                 "overflowRight": 12}])
    assert lines == ["'card' extends 12px past the right edge of main (container)"]


def _run_cli(tmp_path: Path, cli: Path, *extra: str) -> subprocess.CompletedProcess:
    tree = tmp_path / "tree.json"
    tree.write_text(json.dumps({"kind": "box", "id": "shell", "children": []}))
    env = {**os.environ, "TKR_CLI": str(cli)}
    return subprocess.run(
        [sys.executable, str(HERE / "__main__.py"), "solve-layout", "--tree", str(tree),
         "--system", "swiss", "--out", str(tmp_path / "bp.json"), *extra],
        capture_output=True, text=True, env=env)


def test_cli_writes_the_blueprint(tmp_path: Path):
    proc = _run_cli(tmp_path, _fake_cli(tmp_path), "--platform", "mobile")
    assert proc.returncode == 0, proc.stdout + proc.stderr
    result = json.loads(proc.stdout)
    assert result["canvas"] == {"width": 375, "height": 812}
    assert json.loads((tmp_path / "bp.json").read_text()) == BLUEPRINT


def test_cli_refuses_overflow_unless_allowed(tmp_path: Path):
    overflow = [{"id": "card", "overflowBottom": 40}]
    proc = _run_cli(tmp_path, _fake_cli(tmp_path, overflows=overflow))
    assert proc.returncode == 1
    assert not (tmp_path / "bp.json").exists()
    proc = _run_cli(tmp_path, _fake_cli(tmp_path, overflows=overflow), "--allow-overflow")
    assert proc.returncode == 0
    assert json.loads(proc.stdout)["warnings"] == ["'card' extends 40px past the bottom edge of the canvas (canvas)"]
