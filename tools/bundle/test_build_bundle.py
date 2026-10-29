"""Tests for the skill bundle builder (tools/bundle/build_bundle.py).

Three claims, each proved against real files and real processes:

1. ``--check`` is exact: it passes on a freshly built bundle and fails on a
   stale, missing or extra file (generated caches excepted).
2. The bundle works where it lands: copied into a temporary
   ``.claude/skills/`` it runs both skills' CLIs, the MCP bridges,
   ``rulebook_check.py`` and the library builder from there.
3. The bundled tests pass from the bundle location.

Plus the builder's own gates: an unmapped source file and a doc naming an
unresolvable path both stop the build.

Run:
    uv run pytest -q tools/bundle/test_build_bundle.py
"""

from __future__ import annotations

import fnmatch
import json
import os
import shutil
import subprocess
import sys
import textwrap
from pathlib import Path

import pytest
import yaml

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import build_bundle as bb  # noqa: E402

REPO = HERE.parents[1]


@pytest.fixture(scope="module")
def sources() -> list[str]:
    """The repository's files, as git sees them."""
    return bb.git_sources(REPO)


@pytest.fixture(scope="module")
def planned(sources: list[str]) -> dict[str, bytes]:
    """The bundle as the builder plans it from the working tree."""
    return bb.plan_bundle(REPO, sources)


@pytest.fixture(scope="module")
def project(tmp_path_factory: pytest.TempPathFactory, planned: dict[str, bytes]) -> Path:
    """A consumer project with the bundle installed at ``.claude/skills/``."""
    root = tmp_path_factory.mktemp("consumer")
    bb.write_bundle(root / ".claude" / "skills", planned)
    return root


def _env(project: Path) -> dict[str, str]:
    """Process env with the user registry overlay pinned to an empty path."""
    return {**os.environ,
            "DESIGN_SYSTEM_SKILL_USER_REGISTRY": str(project / "no-user-registry.yaml")}


def _run(project: Path, *argv: str, isolated: bool = False) -> subprocess.CompletedProcess:
    """Run a bundled script with this interpreter, from the project root."""
    cmd = [sys.executable, *(["-I"] if isolated else []), *argv]
    return subprocess.run(cmd, cwd=project, env=_env(project),
                          capture_output=True, text=True, check=False)


def _json(proc: subprocess.CompletedProcess) -> dict:
    """stdout must be exactly one JSON document (the CLI contract)."""
    return json.loads(proc.stdout)


# ─── 1. --check is exact ──────────────────────────────────────────────

def _main(out: Path, *extra: str) -> int:
    return bb.main(["--out", str(out), *extra])


def test_check_passes_on_a_fresh_build(tmp_path: Path) -> None:
    out = tmp_path / "bundle"
    assert _main(out) == 0
    assert _main(out, "--check") == 0


@pytest.mark.parametrize("damage", ["stale", "missing", "extra"])
def test_check_fails_on_drift(tmp_path: Path, damage: str,
                              capsys: pytest.CaptureFixture[str]) -> None:
    out = tmp_path / "bundle"
    assert _main(out) == 0
    target = out / bb.DSS / "tooling" / "rulebook_check.py"
    if damage == "stale":
        target.write_text(target.read_text() + "\n# local edit\n")
    elif damage == "missing":
        target.unlink()
    else:
        target = out / bb.WF / "scripts" / "stray.py"
        target.write_text("")
    capsys.readouterr()
    assert _main(out, "--check") == 1
    rel = target.relative_to(out).as_posix()
    assert f"{damage} {rel}" in capsys.readouterr().out

    # Rebuilding repairs exactly that file.
    assert _main(out) == 0
    assert _main(out, "--check") == 0


def test_generated_caches_are_not_drift(tmp_path: Path) -> None:
    """Running the bundled code creates gitignored caches; they are not bundle content."""
    out = tmp_path / "bundle"
    assert _main(out) == 0
    scripts = out / bb.DSS / "scripts"
    (scripts / "__pycache__").mkdir()
    (scripts / "__pycache__" / "paths.cpython-312.pyc").write_bytes(b"\0")
    (scripts / ".pytest_cache").mkdir()
    (out / bb.WF / ".DS_Store").write_bytes(b"\0")
    assert _main(out, "--check") == 0


def test_committed_bundle_is_current(planned: dict[str, bytes]) -> None:
    """The bundle/ directory in this repository matches the sources (the CI gate)."""
    assert bb.compare(planned, bb.observe_bundle(REPO / "bundle")) == []


def test_build_is_deterministic(sources: list[str], planned: dict[str, bytes]) -> None:
    assert bb.plan_bundle(REPO, sources) == planned
    assert list(planned) == sorted(planned)


# ─── the builder's own gates ──────────────────────────────────────────

def test_an_unmapped_scanned_file_stops_the_build(sources: list[str]) -> None:
    with pytest.raises(bb.BundleError) as err:
        bb.plan_bundle(REPO, [*sources, "systems/README.md"])
    assert any("systems/README.md" in p and "neither mapped nor excluded" in p
               for p in err.value.problems)


def test_every_scanned_file_is_mapped_or_excluded_with_a_reason(sources: list[str]) -> None:
    for src in sources:
        if bb.is_scanned(src):
            assert bb.map_source(src) or bb.exclusion_reason(src), src
    for path, reason in bb.EXCLUDED.items():
        assert path in sources, f"exclusion for a file that does not exist: {path}"
        assert reason.strip()
    for pattern, reason in bb.EXCLUDED_PATTERNS.items():
        assert any(fnmatch.fnmatchcase(s, pattern) for s in sources), f"stale pattern {pattern}"
        assert reason.strip()


def test_a_doc_naming_a_missing_path_stops_the_build(sources: list[str]) -> None:
    problems: list[str] = []
    doc = bb.Dest(bb.DSS, "SKILL.md")
    text = "See `systems/nope/spec.yaml` and `tools/builders/no_such_tool.py`.\n"
    bb.rewrite_doc(text, "tools/design-system-skill/SKILL.md", doc, sources, problems)
    assert len(problems) == 2


def test_doc_path_check_catches_an_unresolved_bundle_path(planned: dict[str, bytes]) -> None:
    broken = dict(planned)
    broken[f"{bb.DSS}/SKILL.md"] = (planned[f"{bb.DSS}/SKILL.md"]
                                    + b"\nRun `scripts/not_here.py`.\n")
    findings = bb.doc_path_findings(broken)
    assert findings == [f"{bb.DSS}/SKILL.md: 'scripts/not_here.py' does not resolve "
                        f"inside the bundle"]
    assert bb.doc_path_findings(planned) == []


@pytest.mark.parametrize(("kind", "token", "expected"), [
    (bb.INLINE, "systems/<id>/tokens.json", "libraries/<id>-library/tokens.json"),
    (bb.INLINE, "tools/builders/rulebook_check.py", "tooling/rulebook_check.py"),
    (bb.INLINE, "docs/specs/TOKENS.md", "references/TOKENS.md"),
    (bb.INLINE, "tools/wireframe-skill/wireframe_skill/solve.py",
     "../wireframe-skill/scripts/wireframe_skill/solve.py"),
    (bb.COMMAND, "tools/design-system-skill/__main__.py",
     "${CLAUDE_SKILL_DIR}/scripts/__main__.py"),
    (bb.LINK, "../../docs/specs/TOKENS.md", "references/TOKENS.md"),
    (bb.INLINE, "apps/showcase/jsx-color-allowlist.yaml",
     f"{bb.REPO_URL}/blob/main/apps/showcase/jsx-color-allowlist.yaml"),
])
def test_path_rewrites(sources: list[str], kind: str, token: str, expected: str) -> None:
    problems: list[str] = []
    doc = bb.Dest(bb.DSS, "SKILL.md")
    text = {bb.INLINE: f"`{token}`", bb.COMMAND: f"```\npython3 {token} list\n```",
            bb.LINK: f"[x]({token})"}[kind]
    out = bb.rewrite_doc(text, "tools/design-system-skill/SKILL.md", doc, sources, problems)
    assert problems == []
    assert expected in out, out


def test_cli_heads_become_the_bundled_entry_point(sources: list[str]) -> None:
    doc = bb.Dest(bb.WF, "SKILL.md")
    out = bb.rewrite_doc("`uv run python tools/design-system-skill drift --all`\n",
                         "tools/wireframe-skill/SKILL.md", doc, sources, [])
    assert out == "`python3 ${CLAUDE_SKILL_DIR}/../design-system-skill/scripts/__main__.py drift --all`\n"


def test_registry_points_at_bundled_libraries(planned: dict[str, bytes]) -> None:
    registry = yaml.safe_load(planned[f"{bb.DSS}/libraries/registry.yaml"])
    ids = [e["id"] for e in registry["systems"]]
    assert "neutral" in ids and len(ids) == 9
    for entry in registry["systems"]:
        assert f"{bb.DSS}/libraries/{entry['spec']}" in planned, entry
        assert entry["library_root"].endswith("-library")


# ─── 2. the bundle works where it lands ───────────────────────────────

def _skill(project: Path, skill: str) -> Path:
    return project / ".claude" / "skills" / skill


def test_design_system_cli_lists_loads_validates_and_checks(project: Path) -> None:
    dss = _skill(project, bb.DSS)
    listed = _run(project, str(dss / "scripts"), "list")
    assert listed.returncode == 0, listed.stderr[-2000:]
    ids = sorted(s["id"] for s in _json(listed)["data"])
    assert ids == sorted(["wireframe", "swiss", "terminal", "editorial", "sketch",
                          "prism", "revolt", "riso", "neutral"])

    loaded = _run(project, str(dss / "scripts" / "__main__.py"), "load", "--id", "swiss")
    assert loaded.returncode == 0, loaded.stderr[-2000:]
    meta = _json(loaded)["data"]["_meta"]
    assert Path(meta["spec_path"]).resolve() == (dss / "libraries/swiss-library/spec.yaml").resolve()
    assert Path(meta["tokens_path"]).resolve() == (dss / "libraries/swiss-library/tokens.json").resolve()

    spec = dss / "libraries" / "swiss-library" / "spec.yaml"
    validated = _run(project, str(dss / "scripts"), "validate", "--spec", str(spec))
    assert validated.returncode == 0 and _json(validated)["ok"], validated.stdout[-2000:]

    artifact = dss / "libraries" / "swiss-library" / "layouts" / "dashboard.svg"
    checked = _run(project, str(dss / "scripts"), "check", "--id", "swiss",
                   "--artifact", str(artifact))
    result = _json(checked)
    assert checked.returncode == 0 and result["ok"], checked.stdout[-2000:]
    assert result["data"]["failed"] == 0 and result["data"]["passed"] > 0


def test_design_system_mcp_bridge_lists(project: Path) -> None:
    proc = _run(project, str(_skill(project, bb.DSS) / "scripts" / "mcp_bridge.py"), "list", "{}")
    assert proc.returncode == 0, proc.stderr[-2000:]
    assert len(_json(proc)["data"]) == 9


def test_wireframe_cli_generates_in_a_system(project: Path, tmp_path: Path) -> None:
    out = tmp_path / "wf"
    proc = _run(project, str(_skill(project, bb.WF) / "scripts"), "--brief",
                "dashboard for a chat app", "--system", "swiss", "--out", str(out))
    assert proc.returncode == 0, proc.stdout[-2000:] + proc.stderr[-2000:]
    result = _json(proc)
    assert result["ok"] and Path(result["svg_path"]).is_file()


def test_wireframe_mcp_bridge_generates(project: Path, tmp_path: Path) -> None:
    args = json.dumps({"brief": "sign in screen", "system": "swiss",
                       "output_dir": str(tmp_path / "bridge")})
    proc = _run(project, str(_skill(project, bb.WF) / "scripts" / "mcp_bridge.py"),
                "generate", args)
    assert proc.returncode == 0, proc.stderr[-2000:]
    assert _json(proc)["ok"], proc.stdout[-2000:]


def test_wireframe_solve_layout_from_the_bundle(project: Path, tmp_path: Path) -> None:
    """``solve-layout`` asks tkr-kit's ``design.solve_layout`` operation for a blueprint.

    tkr-kit is a separate product this repository cannot run, so a small
    executable speaking its CLI contract (``op <id> --input <json> --json``
    → ``{"output": ...}``) stands in for it, as in test_solve.py. Under
    test is the bundled skill's side: it runs from the bundle, resolves the
    runner, parses the envelope and writes the blueprint.
    """
    blueprint = {"schema_version": "1.0", "canvas": {"width": 1280, "height": 800},
                 "regions": [{"id": "root", "x": 0, "y": 0, "w": 1280, "h": 800,
                              "components": []}]}
    cli = tmp_path / "tkr-stand-in"
    cli.write_text(textwrap.dedent(f"""\
        #!{sys.executable}
        import json
        print(json.dumps({{"output": {{"spacing": {{}}, "boxes": [], "overflows": [],
                                       "blueprint": {json.dumps(blueprint)}}}}}))
        """))
    cli.chmod(0o755)
    tree = tmp_path / "tree.json"
    tree.write_text(json.dumps({"kind": "box", "id": "shell", "children": []}))
    out = tmp_path / "blueprint.json"
    proc = subprocess.run(
        [sys.executable, str(_skill(project, bb.WF) / "scripts" / "__main__.py"),
         "solve-layout", "--tree", str(tree), "--system", "swiss", "--out", str(out)],
        cwd=project, env={**_env(project), "TKR_CLI": str(cli)},
        capture_output=True, text=True, check=False)
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert json.loads(out.read_text()) == blueprint


@pytest.mark.parametrize(("fixture", "code", "line"), [
    ("toast-placed.svg", 1, "[FAIL] ux-no-toast-notifications"),
    ("toast-absent.svg", 0, "[PASS] ux-no-toast-notifications"),
])
def test_rulebook_check_cli_isolated(project: Path, fixture: str, code: int, line: str) -> None:
    """tkr-kit runs rulebook_check.py under ``python3 -I`` (no script dir, no site path)."""
    tooling = _skill(project, bb.DSS) / "tooling"
    proc = _run(project, str(tooling / "rulebook_check.py"),
                str(tooling / "fixtures" / "ux" / fixture),
                "--ruleset", "wireframe", "--scope", "artifact", isolated=True)
    assert proc.returncode == code, proc.stdout[-1500:] + proc.stderr[-1500:]
    assert line in proc.stdout


def test_rulebook_check_reads_the_bundled_token_files(project: Path) -> None:
    """The palette comes from the bundle's tokens.json, not a hard-coded fallback."""
    tooling = _skill(project, bb.DSS) / "tooling"
    probe = ("import sys; sys.path.insert(0, sys.argv[1]); import rulebook_check as rc; "
             "print(rc.SWISS_TOKENS_PATH, rc.WIREFRAME_TOKENS_PATH, rc.REVOLT_TOKENS_PATH)")
    proc = _run(project, "-c", probe, str(tooling), isolated=True)
    assert proc.returncode == 0, proc.stderr
    libraries = (_skill(project, bb.DSS) / "libraries").resolve()
    for path in proc.stdout.split():
        assert Path(path).is_file() and Path(path).resolve().is_relative_to(libraries), path


def test_library_builder_check_runs_in_the_bundle(project: Path) -> None:
    """The bundled engine renders the bundled libraries from the bundled tokens."""
    proc = _run(project, str(_skill(project, bb.DSS) / "tooling" / "build.py"), "--check")
    assert proc.returncode == 0, proc.stdout[-2000:] + proc.stderr[-2000:]
    assert "SVGs up to date, no orphans" in proc.stdout


# ─── 3. the bundled tests pass from the bundle ────────────────────────

def test_bundled_tests_pass_from_the_bundle(project: Path) -> None:
    tests = sorted(str(p) for skill in bb.SKILLS
                   for p in (_skill(project, skill) / "scripts").glob("test_*.py"))
    # Every upstream test of the two skills, less the declared exclusions:
    # 5 design-system (incl. test_ux_clauses.py) + 4 wireframe.
    assert len(tests) == 9, tests
    proc = subprocess.run(
        [sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", *tests],
        cwd=project, env=_env(project), capture_output=True, text=True, check=False)
    assert proc.returncode == 0, proc.stdout[-4000:] + proc.stderr[-2000:]
    shutil.rmtree(project / ".pytest_cache", ignore_errors=True)
