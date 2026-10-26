"""Tests for the token-driven SVG library engine (tools/builders/build.py).

Run:
    uv run pytest -q tools/builders/test_build.py
"""

from __future__ import annotations

import copy
import json
import re
import shutil
import sys
from pathlib import Path
from typing import Any

import pytest
import yaml

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import build as build_cli  # noqa: E402
from engine import (  # noqa: E402
    BuilderDataError,
    RegistryError,
    TemplateError,
    build,
    discover_systems,
    load_plugin,
    load_tokens,
    resolve,
    select_targets,
    validate_builder,
)
from engine.plugin import builder_of  # noqa: E402
from engine.text_coverage import check_coverage, scan_builder, scan_template  # noqa: E402

REPO = HERE.parents[1]
REGISTRY = REPO / "systems" / "registry.yaml"
BUILT_SYSTEMS = ["wireframe", "swiss", "terminal", "editorial", "sketch", "prism", "revolt", "riso"]
COLOUR_LITERAL = re.compile(r"#[0-9A-Fa-f]{3,8}\b|rgba?\(")
ELEMENT = re.compile(r"<(?P<tag>[a-zA-Z]+)\b(?P<attrs>[^>]*)>")
RADIUS_ATTR = re.compile(r'\b(?P<name>rx|ry)="(?P<value>[^"]*)"')
RADIUS_TOKEN = re.compile(r"\{(?:extras\.)?radius\.[a-z0-9_]+\}")
FULL_ROUND = re.compile(r"\{full:(?P<side>\d+(?:\.\d+)?)\}")
CSS_RADIUS = re.compile(r"border-radius\s*:\s*(?P<value>[^;\"'}]*)")
PATH_DATA = re.compile(r'\bd="(?P<d>[^"]*)"')


@pytest.fixture(scope="module")
def targets():
    """Targets discovered from the real registry."""
    return discover_systems(REGISTRY)


@pytest.fixture()
def swiss_tree(tmp_path: Path) -> Path:
    """A registry holding only a copy of the Swiss system; returns registry path."""
    shutil.copytree(REPO / "systems" / "swiss", tmp_path / "swiss",
                    ignore=shutil.ignore_patterns("*.png"))
    reg = {"version": 1, "systems": [
        {"id": "swiss", "spec": "swiss/spec.yaml", "status": "available", "library_root": "swiss"},
    ]}
    path = tmp_path / "registry.yaml"
    path.write_text(yaml.safe_dump(reg))
    return path


def _set_token(tokens_path: Path, group: str, key: str, value: Any) -> None:
    doc = json.loads(tokens_path.read_text())
    doc[group][key] = value
    tokens_path.write_text(json.dumps(doc, indent=2) + "\n")


# ─── discovery ─────────────────────────────────────────────────────────

def test_discovers_registry_systems_and_folds_aliases(targets) -> None:
    ids = [t.id for t in targets]
    assert ids == BUILT_SYSTEMS
    wireframe = next(t for t in targets if t.id == "wireframe")
    assert wireframe.aliases == ("neutral",)
    assert wireframe.library_root == (REPO / "systems" / "wireframe").resolve()
    assert wireframe.spec_path == (REPO / "systems" / "wireframe" / "spec.yaml").resolve()


def test_alias_selects_owner_and_unknown_id_is_an_error(targets) -> None:
    assert [t.id for t in select_targets(targets, ["neutral"])] == ["wireframe"]
    assert [t.id for t in select_targets(targets, ["neutral", "wireframe"])] == ["wireframe"]
    with pytest.raises(RegistryError, match="nope"):
        select_targets(targets, ["nope"])


def test_every_system_with_a_library_has_a_builder(targets) -> None:
    result = build(targets)
    assert result.skipped == []
    assert {f.system for f in result.files} == set(BUILT_SYSTEMS)
    assert {f.kind for f in result.files} == {"library", "patterns"}
    assert all(f.path.parent.name in ("components", "layouts") for f in result.files)


# ─── shape validation ──────────────────────────────────────────────────

def test_shape_validation_names_system_and_missing_key() -> None:
    tokens = load_tokens(select_targets(discover_systems(REGISTRY), ["swiss"])[0])
    data = {
        "library": {"items": {"button-x": (10, 10, "<rect/>")}},
        "patterns": {"classes": [], "items": {"bad": (10, "tall", "")}},
        "extra_kind": {},
    }
    errors = validate_builder("swiss", data, tokens)
    assert "swiss: library: missing key 'classes'" in errors
    assert any(e.startswith("swiss: patterns.items['bad']: expected (width") for e in errors)
    assert any(e.startswith("swiss: extra_kind: unknown kind") for e in errors)


def test_shape_validation_names_unknown_token() -> None:
    tokens = load_tokens(select_targets(discover_systems(REGISTRY), ["swiss"])[0])
    data = {"library": {
        "classes": [("text-primary", "color.text_primary", "font.nope")],
        "items": {"card": (10, 10, '<rect fill="{color.not_a_token}"/>')},
    }}
    errors = validate_builder("swiss", data, tokens)
    assert "swiss: library.items['card']: unknown token 'color.not_a_token'" in errors
    assert "swiss: library.classes[0] .text-primary: unknown token 'font.nope'" in errors


def test_build_reports_every_broken_system_before_rendering(targets) -> None:
    class Broken:
        BUILDER = {"library": {"classes": []}}

    def loader(system_id: str):
        return Broken if system_id == "terminal" else load_plugin(system_id)

    with pytest.raises(BuilderDataError) as exc:
        build(select_targets(targets, ["swiss", "terminal"]), plugin_loader=loader)
    assert exc.value.messages == ["terminal: library: missing key 'items'"]


# ─── rendering ─────────────────────────────────────────────────────────

def test_rendering_a_component_uses_the_token_value(targets) -> None:
    swiss = select_targets(targets, ["swiss"])
    tokens = copy.deepcopy(dict(load_tokens(swiss[0])))
    tokens["color"] = {**tokens["color"], "accent": "#123456"}
    tokens["extras"] = {**tokens["extras"],
                        "color": {**tokens["extras"]["color"], "rule_hairline": "#ABCDEF"}}

    result = build(swiss, ["library"], token_loader=lambda _t: tokens)

    by_item = {f.item: f.text for f in result.files}
    assert ".text-accent { fill: #123456; font-family: 'Inter', system-ui, sans-serif; }" \
        in by_item["button-primary"]
    assert '<rect x="0" y="0" width="2" height="96" fill="#123456"/>' in by_item["list-item-selected"]
    assert 'stroke="#ABCDEF"' in by_item["divider-hairline"]
    assert "{" not in by_item["divider-hairline"].split("</defs>", 1)[1]


def test_placeholders_resolve_numbers_and_alpha_and_reject_unknown_paths() -> None:
    tokens = {"color": {"ink": "#102030"}, "radius": {"default": 6.0}}
    assert resolve('rx="{radius.default}"', tokens) == 'rx="6"'
    assert resolve("{color.ink|alpha=0.25}", tokens) == "rgba(16,32,48,0.25)"
    assert resolve(".a { fill: red; }", tokens) == ".a { fill: red; }"
    with pytest.raises(TemplateError, match="color.nope"):
        resolve("{color.nope}", tokens)
    with pytest.raises(TemplateError, match="blur"):
        resolve("{color.ink|blur=2}", tokens)


@pytest.mark.parametrize("system_id", BUILT_SYSTEMS)
def test_templates_hold_no_colour_or_font_literals(system_id: str) -> None:
    data = builder_of(system_id, load_plugin(system_id))
    for kind, kd in data.items():
        texts = [kd.get("defs_extra", "")] + [body for _w, _h, body in kd["items"].values()]
        for text in texts:
            assert not COLOUR_LITERAL.search(text), (system_id, kind, COLOUR_LITERAL.search(text))
            assert not re.search(r'font-family="[^{]', text), (system_id, kind)


def _template_texts(system_id: str) -> list[tuple[str, str, str]]:
    """``(kind, item, text)`` for every template of a system (defs included)."""
    data = builder_of(system_id, load_plugin(system_id))
    out = []
    for kind, kd in data.items():
        out.append((kind, "<defs_extra>", kd.get("defs_extra", "")))
        out.extend((kind, item, body) for item, (_w, _h, body) in kd["items"].items())
    return out


def radius_problems(text: str) -> list[str]:
    """Corner radii in a template that are neither tokens, 0 nor documented geometry.

    Allowed: ``rx``/``ry`` of ``0``, ``{radius.*}`` or ``{extras.radius.*}``,
    or ``{full:N}`` where ``N`` is the element's shorter side (fully round
    pills, tracks and knobs); ``border-radius`` only as ``0`` or a token;
    curved path corners only from the ``|rrect`` filter.
    """
    problems = []
    for el in ELEMENT.finditer(text):
        attrs = el["attrs"]
        for m in RADIUS_ATTR.finditer(attrs):
            value = m["value"]
            if value == "0" or RADIUS_TOKEN.fullmatch(value):
                continue
            full = FULL_ROUND.fullmatch(value)
            if full:
                w = re.search(r'\bwidth="([0-9.]+)"', attrs)
                h = re.search(r'\bheight="([0-9.]+)"', attrs)
                if w and h and float(full["side"]) == min(float(w[1]), float(h[1])):
                    continue
                problems.append(f'<{el["tag"]}> {m["name"]}="{value}" is not its shorter side')
                continue
            problems.append(f'<{el["tag"]}> {m["name"]}="{value}"')
        d = PATH_DATA.search(attrs)
        if (el["tag"] == "path" and d and not d["d"].startswith("{")
                and re.search(r"[AaQqCcSsTt]", d["d"])):
            problems.append(f"<path> curved corners in literal path data: {d['d'][:40]}")
    for m in CSS_RADIUS.finditer(text):
        value = m["value"].strip()
        if value != "0" and not RADIUS_TOKEN.fullmatch(value):
            problems.append(f"border-radius: {value}")
    return problems


@pytest.mark.parametrize("system_id", BUILT_SYSTEMS)
def test_templates_hold_no_radius_literals(system_id: str) -> None:
    bad = [(kind, item, p) for kind, item, text in _template_texts(system_id)
           for p in radius_problems(text)]
    assert not bad, bad


def test_radius_rule_rejects_literals_and_wrong_full_sides() -> None:
    assert radius_problems('<rect width="40" height="20" rx="{radius.input}" ry="0"/>') == []
    assert radius_problems('<rect width="40" height="20" rx="{full:20}"/>') == []
    assert radius_problems('<rect width="40" height="20" rx="10"/>') == ['<rect> rx="10"']
    assert radius_problems('<rect width="40" height="20" rx="{full:40}"/>') \
        == ['<rect> rx="{full:40}" is not its shorter side']
    assert radius_problems('<path d="M 0 0 Q 4 0 4 4"/>')
    assert radius_problems('<path d="M 0 0 L 4 4"/>') == []
    assert radius_problems('<path d="{extras.radius.message|rrect=0,0,40,20}"/>') == []
    assert radius_problems("<div style='border-radius: 6px'/>") == ["border-radius: 6px"]


# ─── text-colour coverage (#7) ─────────────────────────────────────────

_COVERAGE_TOKENS: dict[str, Any] = {
    "system": "t",
    "color": {"page_bg": "#FFFFFF", "surface": "#FFFFFF", "text_primary": "#000000",
              "text_muted": "#777777", "text_placeholder": "#AAAAAA"},
    "extras": {"color": {"note": "#CCCCCC", "disabled_fill": "#EEEEEE"}},
    "contrast_pairs": [],
}
_CLASSES = {"text-primary": "{color.text_primary}"}


def _coverage(body: str, pairs: list[dict[str, str]] | None = None):
    tokens = {**copy.deepcopy(_COVERAGE_TOKENS), "contrast_pairs": pairs or []}
    usages = scan_template(body, _CLASSES, system="t", kind="library", item="x")
    return usages, check_coverage("t", usages, tokens)


def test_scan_finds_fill_class_background_and_size_class() -> None:
    body = """
  <rect x="0" y="0" width="100" height="40" fill="{color.surface}"/>
  <text x="10" y="25" class="text-primary" font-size="13">Body</text>
  <g fill="{extras.color.note}"><text x="200" y="25" font-size="24">Big</text></g>
  <text x="10" y="80" font-size="19" font-weight="700" fill="{color.text_muted}">Bold</text>
"""
    usages, _ = _coverage(body)
    got = [(u.fg, u.bg, u.klass, u.bg_from_shape) for u in usages]
    assert got == [
        ("color.text_primary", "color.surface", "text", True),
        ("extras.color.note", "color.page_bg", "large_text", False),
        ("color.text_muted", "color.page_bg", "large_text", False),
    ]


def test_coverage_requires_a_pair_for_every_rendered_text_colour() -> None:
    body = '<text x="0" y="20" font-size="13" fill="{extras.color.note}">your chats</text>'
    _, report = _coverage(body)
    assert len(report.problems) == 1 and "extras.color.note on color.page_bg" in report.problems[0]
    _, report = _coverage(body, [{"fg": "extras.color.note", "bg": "color.page_bg",
                                  "kind": "large_text"}])
    assert "declared large_text but rendered as text" in report.problems[0]
    _, report = _coverage(body, [{"fg": "extras.color.note", "bg": "color.page_bg",
                                  "kind": "text"}])
    assert report.ok


def test_coverage_caps_at_the_contract_role_and_rejects_template_alpha() -> None:
    muted = '<text x="0" y="20" font-size="11" fill="{color.text_muted}">2m</text>'
    _, report = _coverage(muted, [{"fg": "color.text_muted", "bg": "color.page_bg",
                                   "kind": "large_text"}])
    assert report.ok and report.capped == ["color.text_muted on color.page_bg"]
    alpha = '<text x="0" y="20" font-size="11" fill="{color.text_primary|alpha=0.3}">2m</text>'
    _, report = _coverage(alpha)
    assert "change the fill's alpha" in report.problems[0]
    ghost = '<g opacity="0.6"><text x="0" y="20" font-size="11" fill="{extras.color.note}">01</text></g>'
    _, report = _coverage(ghost, [{"fg": "extras.color.note", "bg": "color.page_bg",
                                   "kind": "advisory", "note": "ghost"}])
    assert report.ok
    unfilled = '<text x="0" y="20" font-size="11">R</text>'
    _, report = _coverage(unfilled)
    assert "no token fill" in report.problems[0]


@pytest.mark.parametrize("system_id", BUILT_SYSTEMS)
def test_every_template_text_colour_is_a_checked_contrast_pair(targets, system_id: str) -> None:
    """A colour a template paints text in must be a contract pair or a contrast_pairs entry."""
    target = next(t for t in targets if t.id == system_id)
    usages = scan_builder(system_id, load_plugin(system_id))
    report = check_coverage(system_id, usages, load_tokens(target))
    assert usages, system_id
    assert report.ok, "\n".join(report.problems)


def test_full_round_and_rrect_placeholders() -> None:
    tokens = {"radius": {"default": 8}, "extras": {"radius": {"tail": 2}}}
    assert resolve('rx="{full:24}" ry="{full:7}"', tokens) == 'rx="12" ry="3.5"'
    assert resolve('d="{radius.default|rrect=0,0,40,20,br:extras.radius.tail}"', tokens) == (
        'd="M 8 0 H 32 A 8 8 0 0 1 40 8 V 18 A 2 2 0 0 1 38 20 '
        'H 8 A 8 8 0 0 1 0 12 V 8 A 8 8 0 0 1 8 0 Z"')
    with pytest.raises(TemplateError, match="extras.radius.nope"):
        resolve("{radius.default|rrect=0,0,40,20,tl:extras.radius.nope}", tokens)
    with pytest.raises(TemplateError, match="x,y,w,h"):
        resolve("{radius.default|rrect=0,0,40}", tokens)


def test_validation_names_unknown_rrect_override_token() -> None:
    tokens = load_tokens(select_targets(discover_systems(REGISTRY), ["prism"])[0])
    body = '<path d="{extras.radius.message|rrect=0,0,9,9,br:extras.radius.nope}"/>'
    data = {"library": {"classes": [], "items": {"bubble": (10, 10, body)}}}
    assert validate_builder("prism", data, tokens) == [
        "prism: library.items['bubble']: unknown token 'extras.radius.nope'"]


@pytest.mark.parametrize("system_id", BUILT_SYSTEMS)
def test_extra_radii_used_by_templates_are_documented(system_id: str) -> None:
    """Every ``extras.radius.*`` a template uses has a ``notes`` entry citing its source."""
    tokens = load_tokens(select_targets(discover_systems(REGISTRY), [system_id])[0])
    notes = tokens.get("notes") or {}
    used = {m for _k, _i, text in _template_texts(system_id)
            for m in re.findall(r"extras\.radius\.[a-z0-9_]+", text)}
    assert not [u for u in sorted(used) if u not in notes], (system_id, sorted(used))


# ─── CLI: build and --check ────────────────────────────────────────────

def test_check_passes_on_a_clean_tree_and_fails_after_a_token_change(
        swiss_tree: Path, capsys: pytest.CaptureFixture[str]) -> None:
    args = ["--registry", str(swiss_tree), "-q"]
    assert build_cli.main(args) == 0                   # regenerate the copy
    assert build_cli.main(args + ["--check"]) == 0     # clean tree passes

    _set_token(swiss_tree.parent / "swiss" / "tokens.json", "color", "text_secondary", "#4A4A4A")
    capsys.readouterr()
    assert build_cli.main(args + ["--check"]) == 1
    out = capsys.readouterr().out
    assert "stale" in out and "button-text.svg (differs)" in out

    assert build_cli.main(args) == 0                   # regenerating fixes it
    assert build_cli.main(args + ["--check"]) == 0
    assert "fill: #4A4A4A;" in (swiss_tree.parent / "swiss/components/button-text.svg").read_text()


def test_check_reports_missing_files_and_writes_nothing(swiss_tree: Path) -> None:
    target = swiss_tree.parent / "swiss" / "components" / "button-primary.svg"
    target.unlink()
    assert build_cli.main(["--registry", str(swiss_tree), "--check", "--kind", "library"]) == 1
    assert not target.exists()


def test_check_fails_on_orphan_svgs_unless_allow_listed(
        swiss_tree: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    allow = tmp_path / "allow.yaml"
    args = ["--registry", str(swiss_tree), "--orphan-allowlist", str(allow), "-q"]
    assert build_cli.main(args) == 0                   # regenerate the copy
    assert build_cli.main(args + ["--check"]) == 0
    orphan = swiss_tree.parent / "swiss" / "layouts" / "hand-made.svg"
    orphan.write_text("<svg/>")
    capsys.readouterr()
    assert build_cli.main(args + ["--check"]) == 1
    assert f"orphan {orphan.resolve()}" in capsys.readouterr().out
    assert build_cli.main(args + ["--check", "--kind", "library"]) == 0   # layouts out of scope

    allow.write_text(yaml.safe_dump({"allow": [
        {"path": "swiss/layouts/hand-made.svg", "reason": "pending a template"}]}))
    assert build_cli.main(args + ["--check"]) == 0

    orphan.unlink()                                    # the entry is now stale
    capsys.readouterr()
    assert build_cli.main(args + ["--check"]) == 1
    assert "stale-allow" in capsys.readouterr().out


def test_allow_list_entries_need_a_reason_and_must_not_name_produced_files(
        swiss_tree: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    allow = tmp_path / "allow.yaml"
    args = ["--registry", str(swiss_tree), "--orphan-allowlist", str(allow), "--check", "-q"]
    assert build_cli.main(args[:-2] + ["-q"]) == 0     # regenerate the copy
    allow.write_text(yaml.safe_dump({"allow": [{"path": "swiss/layouts/x.svg"}]}))
    assert build_cli.main(args) == 2
    assert "non-empty 'reason'" in capsys.readouterr().err
    allow.write_text(yaml.safe_dump({"allow": [
        {"path": "swiss/components/button-primary.svg", "reason": "was hand-made"}]}))
    assert build_cli.main(args) == 1
    assert "stale-allow" in capsys.readouterr().out


def test_repository_allow_list_is_well_formed() -> None:
    doc = yaml.safe_load(build_cli.DEFAULT_ALLOWLIST.read_text())
    assert isinstance(doc.get("allow"), list)
    assert all(e.get("reason") for e in doc["allow"])


def test_cli_rejects_invalid_builder_data(swiss_tree: Path,
                                          capsys: pytest.CaptureFixture[str]) -> None:
    class Broken:
        BUILDER = {"library": {"classes": [], "items": {"x": (1, 1, "{color.nope}")}}}

    code = build_cli.main(["--registry", str(swiss_tree), "--check"],
                          plugin_loader=lambda _sid: Broken)
    assert code == 2
    assert "swiss: library.items['x']: unknown token 'color.nope'" in capsys.readouterr().err
