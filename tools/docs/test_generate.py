"""Tests for the docs region generator (tools/docs/generate.py, issue #14).

The real-repo test is the CI gate in test form: every generated region in
the committed docs is current. The fixture tests render a scratch document
inside a temporary root whose sources are symlinks to the real ones, so they
exercise the real registry, specs, server and LIBRARY-SPEC without writing
to the repository.

Run:
    uv run pytest -q tools/docs/test_generate.py
"""

from __future__ import annotations

import copy
import re
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import generate  # noqa: E402
from generate import (  # noqa: E402
    REPO_ROOT, RenderContext, SourceError, Sources, parse_component_ref,
    parse_library_vocabulary, parse_mcp_tools, render_document, run,
)

DOC = Path("notes/doc.md")


@pytest.fixture()
def root(tmp_path: Path) -> Path:
    """A scratch repository root whose sources link to the real ones."""
    for name in ("systems", "apps", "docs", "tools", "claude.md"):
        (tmp_path / name).symlink_to(REPO_ROOT / name)
    (tmp_path / DOC.parent).mkdir()
    return tmp_path


def _write(root: Path, text: str) -> Path:
    path = root / DOC
    path.write_text(text)
    return path


def _ctx(sources: Sources | None = None) -> RenderContext:
    return RenderContext(sources or Sources(REPO_ROOT), DOC)


# ─── The committed docs ───────────────────────────────────────────────

def test_repo_regions_are_current(capsys: pytest.CaptureFixture[str]) -> None:
    assert run(REPO_ROOT, check=True) == 0, capsys.readouterr().err


def test_mcp_tools_match_decorators() -> None:
    server = REPO_ROOT / generate.SERVER_PATH
    decorated = re.findall(r"^@mcp\.tool\(\)\s*\ndef (\w+)", server.read_text(), re.M)
    tools = parse_mcp_tools(server)
    assert [t.name for t in tools] == decorated
    assert all(t.summary for t in tools)


def test_every_registered_system_appears() -> None:
    sources = Sources(REPO_ROOT)
    table = generate.render_which_system(_ctx(sources))
    for system in sources.systems:
        assert f"`{system.id}`" in table
    neutral = sources.system("neutral")
    assert neutral is not None and neutral.alias_of == "wireframe"


# ─── Regenerating ─────────────────────────────────────────────────────

def test_regions_regenerate_and_are_idempotent(root: Path) -> None:
    path = _write(root, (
        "Tools: <!-- generated:mcp-tool-count -->0<!-- /generated:mcp-tool-count -->.\n\n"
        "<!-- generated:which-component -->\nstale\n<!-- /generated:which-component -->\n"
    ))
    targets = {DOC.as_posix(): frozenset({"mcp-tool-count", "which-component"})}

    assert run(root, targets=targets, schema_tables=False) == 0
    text = path.read_text()
    count = len(parse_mcp_tools(REPO_ROOT / generate.SERVER_PATH))
    assert f"generated:mcp-tool-count -->{count}<!--" in text
    assert "stale" not in text
    assert "| `banner` | `toast` |" in text
    assert "<!-- generated:which-component -->\n| Job |" in text

    assert run(root, check=True, targets=targets, schema_tables=False) == 0
    assert run(root, targets=targets, schema_tables=False) == 0
    assert path.read_text() == text


def test_stale_region_fails_check_and_writes_nothing(
        root: Path, capsys: pytest.CaptureFixture[str]) -> None:
    original = "<!-- generated:library-vocabulary-count -->7<!-- /generated:library-vocabulary-count -->\n"
    path = _write(root, original)
    targets = {DOC.as_posix(): frozenset({"library-vocabulary-count"})}

    assert run(root, check=True, targets=targets, schema_tables=False) == 1
    assert "library-vocabulary-count" in capsys.readouterr().err
    assert path.read_text() == original


# ─── Checked references ──────────────────────────────────────────────

def _guidance_with(**changes: object) -> dict:
    guidance = copy.deepcopy(dict(Sources(REPO_ROOT).guidance))
    guidance.update(changes)
    return guidance


def test_unknown_component_id_fails(root: Path, capsys: pytest.CaptureFixture[str]) -> None:
    guidance = _guidance_with(which_component=[
        {"job": "Notify", "use": ["snackbar"], "not": ["toast"], "why": "x"}])
    _write(root, "<!-- generated:which-component -->\n<!-- /generated:which-component -->\n")
    targets = {DOC.as_posix(): frozenset({"which-component"})}

    code = run(root, check=False, targets=targets, schema_tables=False,
               sources=Sources(root, guidance_override=guidance))

    assert code == 1
    assert "unknown component id 'snackbar'" in capsys.readouterr().err
    assert "| Job |" not in (root / DOC).read_text()


def test_component_refs_are_checked_against_library_spec() -> None:
    vocabulary = Sources(REPO_ROOT).library_vocabulary
    assert parse_component_ref("modal.form_modal", vocabulary) == ("modal", "form_modal")
    assert parse_component_ref("banner", vocabulary) == ("banner", None)
    with pytest.raises(SourceError, match="no variant 'pill'"):
        parse_component_ref("button.pill", vocabulary)
    with pytest.raises(SourceError, match="unknown component id"):
        parse_component_ref("tooltip", vocabulary)


def test_bad_rule_reference_fails() -> None:
    guidance = _guidance_with(rules_agents_get_wrong=[
        {"wrong": "x", "why": "y", "refs": ["rule:swiss/swiss-no-such-rule"]}])
    result = render_document(
        "<!-- generated:rules-agents-get-wrong -->\n<!-- /generated:rules-agents-get-wrong -->\n",
        _ctx(Sources(REPO_ROOT, guidance_override=guidance)))
    assert any("swiss-no-such-rule" in e for e in result.errors)


def test_suits_must_cover_every_system() -> None:
    guidance = _guidance_with(which_system={"suits": {"swiss": "x"}})
    result = render_document(
        "<!-- generated:which-system -->\n<!-- /generated:which-system -->\n",
        _ctx(Sources(REPO_ROOT, guidance_override=guidance)))
    assert any("missing" in e and "wireframe" in e for e in result.errors)


# ─── Markers ──────────────────────────────────────────────────────────

def test_missing_expected_marker_is_an_error(
        root: Path, capsys: pytest.CaptureFixture[str]) -> None:
    _write(root, "No markers here.\n")
    targets = {DOC.as_posix(): frozenset({"system-count"})}

    assert run(root, check=True, targets=targets, schema_tables=False) == 1
    assert "missing region 'system-count'" in capsys.readouterr().err


def test_unclosed_unknown_and_orphan_markers_are_errors() -> None:
    unclosed = render_document("<!-- generated:system-count -->9\n", _ctx())
    assert any("no closing" in e for e in unclosed.errors)

    unknown = render_document("<!-- generated:nope -->x<!-- /generated:nope -->", _ctx())
    assert any("unknown region 'nope'" in e for e in unknown.errors)

    orphan = render_document("x <!-- /generated:system-count -->", _ctx())
    assert any("has no opening" in e for e in orphan.errors)


def test_missing_target_file_is_an_error(root: Path) -> None:
    targets = {"notes/absent.md": frozenset({"system-count"})}
    assert run(root, check=True, targets=targets, schema_tables=False) == 1


# ─── Sources ──────────────────────────────────────────────────────────

def test_library_spec_heading_counts_are_enforced(tmp_path: Path) -> None:
    spec = tmp_path / "LIBRARY-SPEC.md"
    spec.write_text(
        "### Primitives (2)\n\n"
        "1. **button** — action\n   - variants: `primary`, `ghost`\n"
        "## Next\n")
    with pytest.raises(SourceError, match=r"Primitives \(2\).*lists 1"):
        parse_library_vocabulary(spec)

    spec.write_text("### Primitives (1)\n\n1. **button** — action\n   - variants: `primary`\n")
    assert parse_library_vocabulary(spec) == {"button": ("primary",)}


def test_schema_tables_are_checked() -> None:
    assert generate.check_schema_tables(REPO_ROOT) == []


@pytest.mark.parametrize("skill", ["design-system-skill", "wireframe-skill"])
def test_skills_carry_the_decision_guide_and_output_contract(skill: str) -> None:
    text = (REPO_ROOT / "tools" / skill / "SKILL.md").read_text()
    assert "## Output Contract" in text
    for region in ("which-component", "which-system", "rules-agents-get-wrong", "system-rules"):
        assert f"<!-- generated:{region} -->" in text
    assert text.index("## Decision Guide") < text.index("## Output Contract")
