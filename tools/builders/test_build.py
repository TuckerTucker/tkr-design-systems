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

REPO = HERE.parents[1]
REGISTRY = REPO / "systems" / "registry.yaml"
BUILT_SYSTEMS = ["wireframe", "swiss", "terminal", "editorial", "sketch", "prism", "revolt"]
COLOUR_LITERAL = re.compile(r"#[0-9A-Fa-f]{3,8}\b|rgba?\(")


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
    assert ids == BUILT_SYSTEMS + ["riso"]
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
    assert result.skipped == [("riso", "no builder module")]
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


def test_cli_rejects_invalid_builder_data(swiss_tree: Path,
                                          capsys: pytest.CaptureFixture[str]) -> None:
    class Broken:
        BUILDER = {"library": {"classes": [], "items": {"x": (1, 1, "{color.nope}")}}}

    code = build_cli.main(["--registry", str(swiss_tree), "--check"],
                          plugin_loader=lambda _sid: Broken)
    assert code == 2
    assert "swiss: library.items['x']: unknown token 'color.nope'" in capsys.readouterr().err
