"""Tests for the end-to-end consumer check (tools/e2e/check_systems.py).

The real-path tests drive the actual MCP tool functions and renderer for a
full-library system (terminal) and the partial one (riso, which exercises
the neutral fallback). The fake-tool tests cover the failure reporting and
exit codes without touching the libraries.

Run:
    uv run pytest -q tools/e2e/test_check_systems.py
"""

from __future__ import annotations

import json
import sys
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))

import check_systems  # noqa: E402
from check_systems import ConsumerTools, main  # noqa: E402


@pytest.fixture(scope="module")
def real_tools() -> ConsumerTools:
    """The real MCP tool functions and preview renderer."""
    return check_systems.default_tools()


def _report(out: Path) -> dict[str, Any]:
    return json.loads((out / "report.json").read_text())


def test_real_run_terminal_passes(tmp_path: Path, real_tools: ConsumerTools,
                                  capsys: pytest.CaptureFixture[str]) -> None:
    code = main(["--system", "terminal", "--out", str(tmp_path)], tools=real_tools)

    assert code == 0
    report = _report(tmp_path)
    assert report["ok"] is True
    assert [s["system_id"] for s in report["systems"]] == ["terminal"]
    system = report["systems"][0]
    assert [p["platform"] for p in system["platforms"]] == ["mobile", "desktop"]
    for p in system["platforms"]:
        assert p["ok"] is True
        for stage in ("generate", "rulebook", "render"):
            assert p[stage]["ok"] is True, p[stage]
        assert p["fallbacks"] == []
        assert p["compliance"]["ruleset"] == "terminal"
        assert p["compliance"]["failed"] == 0
        assert Path(p["svg_path"]).is_file()
        spec = yaml.safe_load(Path(p["svg_path"]).with_suffix(".spec.yaml").read_text())
        assert spec["wireframe"]["platform"] == p["platform"]
        png = Path(p["png_path"])
        assert png.parent == tmp_path / "terminal"
        assert png.read_bytes().startswith(b"\x89PNG\r\n\x1a\n")
    table = capsys.readouterr().out
    rows = [line for line in table.splitlines() if line.startswith("| terminal ")]
    assert len(rows) == 2 and all(r.rstrip().endswith("| PASS   |") for r in rows), rows
    assert "1/1 systems passed." in table


def test_real_run_riso_records_neutral_fallbacks(tmp_path: Path,
                                                 real_tools: ConsumerTools) -> None:
    code = main(["--system", "riso", "--platform", "mobile", "--out", str(tmp_path)],
                tools=real_tools)

    assert code == 0
    (platform,) = _report(tmp_path)["systems"][0]["platforms"]
    assert platform["ok"] is True
    # Riso authors only list items; everything else comes from neutral.
    assert "button-primary" in platform["fallbacks"]
    assert "list-item-default" not in platform["fallbacks"]


def test_neutral_alias_is_checked_with_wireframe_ruleset(real_tools: ConsumerTools) -> None:
    svg = (Path(check_systems.REPO_ROOT) / "systems" / "wireframe" / "layouts"
           / "dashboard-mobile.svg")
    checked = real_tools.check_compliance("neutral", str(svg), scope="artifact")

    assert checked["ok"] is True
    assert checked["data"]["ruleset"] == "wireframe"
    assert checked["data"]["passed"] > 1


# ─── Fake tools: failure reporting ────────────────────────────────────

_COMPONENTS = [
    {"component_id": cid, "viewBox_w": 100, "viewBox_h": 20}
    for cid in ("tab-item-active", "tab-item-default", "input-search", "stat-default",
                "card-default", "list-item-default", "list-item-selected",
                "form-field-default", "button-primary", "button-secondary")
]


def _fake_tools(**overrides: Any) -> ConsumerTools:
    def generate(**kwargs: Any) -> dict[str, Any]:
        canvas = {"width": 375, "height": 812} if kwargs["platform"] == "mobile" \
            else {"width": 1280, "height": 800}
        return {"ok": True, "decomposition_request": {"components": _COMPONENTS,
                                                      "canvas": canvas}}

    def assemble(blueprint: dict[str, Any], system_id: str, output_dir: str,
                 filename_stem: str, brief: str, platform: str) -> dict[str, Any]:
        path = Path(output_dir) / f"{filename_stem}.svg"
        path.write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"/>')
        return {"ok": True, "svg_path": str(path), "warnings": []}

    def check_compliance(system_id: str, artifact_path: str, scope: str) -> dict[str, Any]:
        return {"ok": True, "data": {"ruleset": "fake", "passed": 1, "failed": 0,
                                     "advisory": 0, "waived": 0, "results": []}}

    def render(src: Path, dst: Path) -> Path:
        Path(dst).write_bytes(b"\x89PNG\r\n\x1a\n" + b"\0" * 8)
        return Path(dst)

    tools = ConsumerTools(
        list_systems=lambda: {"ok": True, "data": [{"id": "alpha"}, {"id": "beta"}]},
        generate=generate,
        read_component=lambda *a, **k: {"ok": False, "errors": ["not used"]},
        assemble=assemble,
        check_compliance=check_compliance,
        render=render,
    )
    return replace(tools, **overrides)


def test_all_pass_with_fakes_exits_zero(tmp_path: Path) -> None:
    assert main(["--out", str(tmp_path)], tools=_fake_tools()) == 0
    assert [s["system_id"] for s in _report(tmp_path)["systems"]] == ["alpha", "beta"]


def test_rulebook_failure_exits_nonzero(tmp_path: Path,
                                        capsys: pytest.CaptureFixture[str]) -> None:
    def failing(system_id: str, artifact_path: str, scope: str) -> dict[str, Any]:
        failed = system_id == "beta"
        return {"ok": True, "data": {
            "ruleset": "fake", "passed": 0 if failed else 1, "failed": int(failed),
            "advisory": 0, "waived": 0,
            "results": [{"rule_id": "fake-rule", "status": "fail", "detail": {}}]
            if failed else []}}

    code = main(["--out", str(tmp_path)], tools=_fake_tools(check_compliance=failing))

    assert code == 1
    systems = {s["system_id"]: s for s in _report(tmp_path)["systems"]}
    assert systems["alpha"]["ok"] is True
    assert systems["beta"]["ok"] is False
    assert systems["beta"]["platforms"][0]["compliance"]["failed_rules"] == ["fake-rule"]
    out = capsys.readouterr().out
    assert "1/2 systems passed." in out
    assert "beta/mobile rulebook: fake-rule" in out


def test_missing_ruleset_fails(tmp_path: Path) -> None:
    def no_ruleset(system_id: str, artifact_path: str, scope: str) -> dict[str, Any]:
        return {"ok": True, "data": {"ruleset": None, "passed": 0, "failed": 0,
                                     "advisory": 0, "waived": 0, "results": []}}

    code = main(["--system", "alpha", "--out", str(tmp_path)],
                tools=_fake_tools(check_compliance=no_ruleset))

    assert code == 1


def test_render_and_missing_component_failures(tmp_path: Path) -> None:
    def broken_render(src: Path, dst: Path) -> Path:
        raise ValueError("cairo exploded")

    def partial_generate(**kwargs: Any) -> dict[str, Any]:
        return {"ok": True, "decomposition_request": {
            "components": _COMPONENTS[:-1], "canvas": {"width": 1280, "height": 800}}}

    assert main(["--system", "alpha", "--platform", "desktop", "--out", str(tmp_path / "r")],
                tools=_fake_tools(render=broken_render)) == 1
    (p,) = _report(tmp_path / "r")["systems"][0]["platforms"]
    assert p["render"]["errors"] == ["ValueError: cairo exploded"]

    # button-secondary missing and the neutral read fails → generation fails.
    assert main(["--system", "alpha", "--platform", "desktop", "--out", str(tmp_path / "g")],
                tools=_fake_tools(generate=partial_generate)) == 1
    (p,) = _report(tmp_path / "g")["systems"][0]["platforms"]
    assert p["generate"]["ok"] is False
    assert p["rulebook"]["ok"] is None


def test_unknown_system_is_usage_error(tmp_path: Path) -> None:
    assert main(["--system", "nope", "--out", str(tmp_path)], tools=_fake_tools()) == 2
