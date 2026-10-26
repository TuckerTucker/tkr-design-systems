"""Tests for the showcase JSX ↔ tokens.json drift guard (issue #4).

Run from the project root:
    uv run pytest -q tools/design-system-skill/test_jsx_drift.py

The first test runs the guard on the real showcase pages and allow-list (the
CI gate); the rest exercise the rules on a synthetic one-page repository.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from design_system_skill.jsx_drift import (  # noqa: E402
    AllowlistError,
    check_jsx_drift,
    discover_pages,
    parse_allowlist,
    repo_root,
    scan_source,
)

REPO = repo_root()

TOKENS = {
    "contract_version": "1.0",
    "system": "demo",
    "source": "apps/showcase/src/systems/design-system-demo.jsx",
    "color": {"accent": "#E3000B", "text_primary": "#000000", "surface": "#FFFFFF"},
    "extras": {"color": {"rule_hairline": "#F0F0F0"}},
    "modes": {"axes": [{"id": "ink", "default": "red", "options": {
        "red": {"color.accent": "#E3000B"},
        "green": {"color.accent": "#00A95C"},
    }}]},
}

PAGE = """import tokens from "@systems/demo/tokens.json";
const { color: C } = tokens;
const Tk = ({ n, v }) => <div style={{ color: "#CCC" }}>{n}{v}</div>;
function DemoChat() {
  return <div style={{ background: C.surface, border: `1px solid ${C.accent}` }}>chat</div>;
}
function demoSpec(a) { return {
  color: () => (<div>
    <h2 style={{ color: "#FFF" }}>Color</h2>
  </div>),
};}
"""


def _repo(tmp_path: Path, page: str = PAGE, allow: str | None = None) -> tuple[Path, Path]:
    """Build a one-system repository; return (root, allow-list path)."""
    (tmp_path / "systems" / "demo").mkdir(parents=True)
    (tmp_path / "systems" / "demo" / "tokens.json").write_text(json.dumps(TOKENS))
    jsx = tmp_path / TOKENS["source"]
    jsx.parent.mkdir(parents=True)
    jsx.write_text(page)
    allow_path = tmp_path / "allow.yaml"
    allow_path.write_text(allow if allow is not None else """version: 1
entries:
  - literal: "#CCC"
    reason: Doc text.
  - literal: "#FFF"
    regions: [demoSpec.*]
    context: '<h2 style='
    reason: Doc heading; scoped because white is a token here.
""")
    return tmp_path, allow_path


def _kinds(result) -> list[str]:
    return sorted(e.detail["kind"] for e in result.errors)


def test_showcase_pages_read_their_colours_from_tokens():
    """The CI gate: every page is clean against the committed allow-list."""
    result = check_jsx_drift()
    assert result.ok, "\n".join(e.message for e in result.errors)
    assert len(result.data["pages"]) == 8
    assert result.data["literals"] == result.data["allowed"]


def test_every_page_is_discovered_with_its_token_file():
    pages = {p.system: p.token_system for p in discover_pages(REPO)}
    assert pages == {
        "editorial": "editorial", "neutral": "wireframe", "prism": "prism", "revolt": "revolt",
        "riso": "riso", "sketch": "sketch", "swiss": "swiss", "terminal": "terminal",
    }


def test_scan_finds_literals_and_regions():
    src = (
        'const Tk = () => <i style={{ color: "#ccc", background: "rgba(0, 0, 0, 0.5)" }} />;\n'
        "function demoSpec(a) { return {\n"
        "  color: () => (<b style={{ color: \"hsl(10, 50%, 50%)\", border: `1px solid ${C.accent}` }} />),\n"
        "};}\n"
        "export default function App() { return <p>Thread #12 · #E3000B</p>; }\n"
    )
    found = [(lit.text, lit.value, lit.region) for lit in scan_source(src, "demo", "x.jsx")]
    assert found == [
        ("#ccc", "#CCCCCC", "Tk"),
        ("rgba(0, 0, 0, 0.5)", "rgba(0,0,0,0.5)", "Tk"),
        ("hsl(10, 50%, 50%)", "hsl(10,50%,50%)", "demoSpec.color"),
        ("#E3000B", "#E3000B", "App"),
    ]


def test_clean_synthetic_page_passes(tmp_path: Path):
    root, allow = _repo(tmp_path)
    result = check_jsx_drift(root=root, allowlist=allow)
    assert result.ok, [e.message for e in result.errors]
    assert result.data["allowed"] == 2


def test_token_literal_fails_even_in_another_spelling(tmp_path: Path):
    page = PAGE.replace("background: C.surface", 'background: "#fff"')
    root, allow = _repo(tmp_path, page)
    result = check_jsx_drift(root=root, allowlist=allow)
    assert _kinds(result) == ["token_literal"]
    assert list(result.errors[0].detail["tokens"]) == ["color.surface"]


def test_mode_values_count_as_token_values(tmp_path: Path):
    page = PAGE.replace("${C.accent}", "#00A95C")
    root, allow = _repo(tmp_path, page)
    result = check_jsx_drift(root=root, allowlist=allow)
    assert _kinds(result) == ["token_literal"]
    assert list(result.errors[0].detail["tokens"]) == ["color.accent@ink=green"]


def test_unlisted_literal_fails(tmp_path: Path):
    page = PAGE.replace("background: C.surface", 'background: "#ABCDEF"')
    root, allow = _repo(tmp_path, page)
    assert _kinds(check_jsx_drift(root=root, allowlist=allow)) == ["unlisted"]


def test_scoped_entry_does_not_cover_other_places(tmp_path: Path):
    page = PAGE.replace("background: C.surface", 'background: "#FFF"')
    root, allow = _repo(tmp_path, page)
    result = check_jsx_drift(root=root, allowlist=allow)
    assert _kinds(result) == ["token_literal"]
    assert result.errors[0].detail["line"] == 5  # DemoChat, outside the scoped region


def test_unscoped_entry_for_a_token_value_is_rejected(tmp_path: Path):
    root, allow = _repo(tmp_path, allow="""version: 1
entries:
  - literal: "#CCC"
    reason: Doc text.
  - literal: "#FFFFFF"
    reason: Too broad.
""")
    assert "allowlist_unscoped" in _kinds(check_jsx_drift(root=root, allowlist=allow))


def test_stale_entry_fails(tmp_path: Path):
    root, allow = _repo(tmp_path, allow="""version: 1
entries:
  - literal: "#CCC"
    reason: Doc text.
  - literal: "#FFF"
    regions: [demoSpec.*]
    reason: Doc heading.
  - literal: "#123456"
    reason: Nothing uses this any more.
""")
    result = check_jsx_drift(root=root, allowlist=allow)
    assert _kinds(result) == ["allowlist_stale"]


def test_entries_for_pages_outside_the_scan_are_not_stale(tmp_path: Path):
    root, allow = _repo(tmp_path, allow="""version: 1
entries:
  - literal: "#CCC"
    reason: Doc text.
  - literal: "#FFF"
    regions: [demoSpec.*]
    reason: Doc heading.
  - literal: "#123456"
    systems: [other]
    reason: Belongs to a page not scanned here.
""")
    assert check_jsx_drift(root=root, allowlist=allow).ok


@pytest.mark.parametrize("entry, message", [
    ({"literal": "#CCC"}, "'reason' is required"),
    ({"literal": "#CCC", "reason": "x", "colour": "y"}, "unknown key"),
    ({"literal": "grey", "reason": "x"}, "must be a colour literal"),
    ({"literal": "#CCC", "reason": "x", "context": "("}, "not a valid regex"),
])
def test_invalid_allowlist_entries_are_reported(entry: dict, message: str):
    with pytest.raises(AllowlistError) as exc:
        parse_allowlist({"version": 1, "entries": [entry]}, Path("allow.yaml"))
    assert message in str(exc.value)


def test_invalid_allowlist_fails_the_check(tmp_path: Path):
    root, allow = _repo(tmp_path, allow="version: 1\nentries:\n  - literal: '#CCC'\n")
    result = check_jsx_drift(root=root, allowlist=allow)
    assert not result.ok and result.errors[0].code == "EXCEPTIONS_INVALID"
