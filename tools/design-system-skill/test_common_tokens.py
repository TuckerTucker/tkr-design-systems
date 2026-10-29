"""Tests for the tokens.common generator (design_system_skill.common_tokens).

The generator derives each spec's portable ``tokens.common`` block, and a
``themes:`` block for systems with a ``theme`` mode axis, from the
system's ``tokens.json``. These tests drive the pure derivation with small
token documents, the file-level sync against copies of real systems in
temp directories, and the CLI as CI runs it.

Run from the repository root:
    uv run pytest -q tools/design-system-skill/test_common_tokens.py
"""

from __future__ import annotations

import copy
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

# A system's directory comes from the built-in registry, so these tests run
# in the repository layout (systems/<id>) and the skill bundle
# (libraries/<id>-library) alike.
from design_system_skill.paths import builtin_library_dir as _lib  # noqa: E402

from design_system_skill.common_tokens import (  # noqa: E402
    DerivationError,
    apply_regions,
    contract_role_coverage,
    derive_common_tokens,
    derive_themes,
    render_common_region,
    render_themes_region,
    sync_all,
    sync_common_tokens,
    to_hex,
)
from design_system_skill.contrast import check_color_gates_for_spec  # noqa: E402
from design_system_skill.tokens import validate_common_tokens  # noqa: E402
from design_system_skill.validation import validate_spec  # noqa: E402

SYSTEM_IDS = ["editorial", "prism", "revolt", "riso", "sketch", "swiss", "terminal", "wireframe"]


def _doc() -> dict:
    """A minimal token document carrying every value a rule reads."""
    style = {"size": 14, "weight": 400, "line_height": 1.5, "tracking": 0,
             "family": "body", "case": "none"}
    return {
        "color": {
            "page_bg": "#F5F5F5", "surface": "#FFFFFF", "surface_elevated": "#FFFFFF",
            "text_primary": "#111111", "text_muted": "rgba(17,17,17,0.6)",
            "accent": "#3355FF", "accent_foreground": "#FFFFFF",
            "border_default": "#DDDDDD", "border_strong": "#999999",
            "success": "#00AA00", "warning": "#AA6600", "danger": "#CC0000",
        },
        "border_width": {"default": 1, "strong": 1.5, "focus": 2},
        "radius": {"default": 6, "input": 4, "chrome": 8},
        "space": {"xs": 4, "sm": 8, "md": 16, "lg": 24, "xl": 32},
        "font": {"body": "'Inter', system-ui, sans-serif", "label": "'Inter', sans-serif",
                 "mono": "'JetBrains Mono', monospace"},
        "type": {
            "display": {**style, "size": 32, "weight": 700},
            "title": {**style, "size": 20, "weight": 600},
            "body": style,
            "small": {**style, "size": 12},
            "label": {**style, "size": 10, "case": "uppercase", "tracking": 0.1, "family": "label"},
        },
        "extras": {"type": {"section": {**style, "size": 26, "weight": 700}}},
    }


# ─── pure derivation ────────────────────────────────────────────────

def test_every_contract_role_has_a_rule():
    assert contract_role_coverage() == {}


def test_colours_follow_their_token_paths():
    common = derive_common_tokens(_doc(), "demo")
    color = common["color"]
    assert color["ink"] == "#111111"
    assert color["accent-on"] == "#FFFFFF"
    assert color["outline-strong"] == "#999999"
    # rgba() becomes the contract's 8-digit hex: 0.6 * 255 = 153 = 0x99.
    assert color["ink-muted"] == "#11111199"
    assert color["danger"] == "#CC0000"


def test_image_placeholder_is_the_first_fill_that_differs_from_the_surface():
    doc = _doc()
    # surface_elevated equals surface, so page_bg is next.
    assert derive_common_tokens(doc, "demo")["color"]["image-placeholder"] == "#F5F5F5"
    doc["color"]["surface_elevated"] = "#EEEEEE"
    assert derive_common_tokens(doc, "demo")["color"]["image-placeholder"] == "#EEEEEE"
    doc["color"]["surface_elevated"] = doc["color"]["page_bg"] = "#FFFFFF"
    assert derive_common_tokens(doc, "demo")["color"]["image-placeholder"] == "#DDDDDD"


def test_text_styles_map_case_family_and_leading():
    typo = derive_common_tokens(_doc(), "demo")["typography"]
    assert typo["body"] == {"family": "Inter, system-ui, sans-serif", "size": 14, "weight": 400,
                            "leading": 1.5, "case": "mixed", "tracking": 0}
    assert typo["caption"]["case"] == "uppercase"
    assert typo["caption"]["family"] == "Inter, sans-serif"
    assert typo["headline"] == typo["title"]
    assert typo["code"]["family"] == "JetBrains Mono, monospace"


def test_code_style_needs_a_monospace_stack():
    doc = _doc()
    doc["font"]["mono"] = "'Inter', system-ui, sans-serif"
    assert "code" not in derive_common_tokens(doc, "demo")["typography"]


def test_headline_override_is_per_system():
    doc = _doc()
    doc["extras"]["type"]["display_medium"] = {**doc["type"]["title"], "size": 30}
    assert derive_common_tokens(doc, "swiss")["typography"]["headline"]["size"] == 30
    assert derive_common_tokens(doc, "other")["typography"]["headline"]["size"] == 20


def test_stroke_radius_and_spacing():
    common = derive_common_tokens(_doc(), "demo")
    assert common["stroke"] == {"hairline": 1, "regular": 1, "bold": 2}
    assert common["radius"] == {"none": 0, "sm": 4, "md": 6, "full": 9999}
    assert common["spacing"] == {"xs": 4, "sm": 8, "md": 16, "lg": 24, "xl": 32}


def test_missing_source_token_is_reported():
    doc = _doc()
    del doc["color"]["accent_foreground"]
    with pytest.raises(DerivationError, match="color.accent_foreground"):
        derive_common_tokens(doc, "demo")


def test_unknown_case_is_reported():
    doc = _doc()
    doc["type"]["body"]["case"] = "capitalize"
    with pytest.raises(DerivationError, match="case"):
        derive_common_tokens(doc, "demo")


def test_to_hex_rejects_non_colours():
    with pytest.raises(DerivationError):
        to_hex("ink", "color.text_primary")


def test_derived_block_satisfies_the_contract():
    spec = {"tokens": {"common": derive_common_tokens(_doc(), "demo")}}
    assert validate_common_tokens(spec) == []


def test_themes_come_from_the_theme_axis_only():
    doc = _doc()
    assert derive_themes(doc) is None
    doc["modes"] = {"axes": [{"id": "paper", "default": "a",
                              "options": {"a": {"color.surface": "#FFFFFF"}}}]}
    assert derive_themes(doc) is None
    doc["modes"]["axes"].append({"id": "theme", "default": "light", "options": {
        "light": {"color.surface": "#FFFFFF"}, "dark": {"color.surface": "#000000"}}})
    themes = derive_themes(doc)
    assert themes["default"] == "light"
    assert themes["light"]["common"]["surface"] == "#FFFFFF"
    assert themes["dark"]["common"]["surface"] == "#000000"


# ─── spec regions ───────────────────────────────────────────────────

_SPEC = """spec_version: "0.3"

system:
  id: demo

tokens:
  colors:
    palette: []

components:
  card: {}
"""


def test_regions_insert_replace_and_remove():
    common = render_common_region(derive_common_tokens(_doc(), "demo"))
    themes_doc = _doc()
    themes_doc["modes"] = {"axes": [{"id": "theme", "default": "light", "options": {
        "light": {"color.surface": "#FFFFFF"}, "dark": {"color.surface": "#000000"}}}]}
    themes = render_themes_region(derive_themes(themes_doc))

    inserted = apply_regions(_SPEC, common, themes)
    parsed = yaml.safe_load(inserted)
    assert parsed["common_tokens_version"] == "1.0"
    assert parsed["tokens"]["common"]["color"]["ink"] == "#111111"
    assert parsed["tokens"]["colors"] == {"palette": []}
    assert parsed["themes"]["dark"]["common"]["surface"] == "#000000"
    assert list(parsed)[-1] == "components"

    # Idempotent.
    assert apply_regions(inserted, common, themes) == inserted

    # Replacement keeps the rest of the file byte-identical.
    stale = inserted.replace('ink: "#111111"', 'ink: "#222222"')
    assert apply_regions(stale, common, themes) == inserted

    # A spec whose token file loses its theme axis loses the region.
    removed = apply_regions(inserted, common, None)
    assert "themes" not in yaml.safe_load(removed)
    assert "# generated:themes" not in removed


def test_hand_authored_common_block_is_refused():
    text = _SPEC.replace("tokens:\n", "tokens:\n  common:\n    color: {}\n")
    with pytest.raises(DerivationError, match="outside the generated markers"):
        apply_regions(text, render_common_region(derive_common_tokens(_doc(), "demo")), None)


# ─── file-level sync against copies of real systems ─────────────────

@pytest.fixture
def wireframe_copy(tmp_path: Path) -> Path:
    """A copy of the wireframe system's spec + tokens in a temp dir."""
    dst = tmp_path / "wireframe"
    dst.mkdir()
    for name in ("spec.yaml", "tokens.json"):
        shutil.copy2(_lib("wireframe") / name, dst / name)
    return dst


def test_committed_specs_are_current():
    result = sync_all()
    assert result.ok, [e.message for e in result.errors]
    assert set(result.data["systems"]) >= set(SYSTEM_IDS)


def test_token_edit_makes_spec_stale_until_written(wireframe_copy: Path):
    spec = wireframe_copy / "spec.yaml"
    tokens = wireframe_copy / "tokens.json"
    assert sync_common_tokens(spec).ok

    doc = json.loads(tokens.read_text())
    doc["color"]["text_primary"] = "#101010"
    for axis in doc["modes"]["axes"]:
        axis["options"]["light"]["color.text_primary"] = "#101010"
    tokens.write_text(json.dumps(doc, indent=2))

    stale = sync_common_tokens(spec)
    assert not stale.ok
    assert stale.errors[0].code == "COMMON_TOKENS_STALE"
    assert stale.data["status"] == "stale"

    before = spec.read_text()
    written = sync_common_tokens(spec, write=True)
    assert written.ok and written.data["status"] == "written"
    after = spec.read_text()
    assert yaml.safe_load(after)["tokens"]["common"]["color"]["ink"] == "#101010"
    assert yaml.safe_load(after)["themes"]["light"]["common"]["ink"] == "#101010"
    # Only the generated regions moved.
    strip = re.compile(r"# generated:.*?# /generated:[a-z-]+\n", re.S)
    assert strip.sub("", before) == strip.sub("", after)
    assert sync_common_tokens(spec).data["status"] == "current"


def test_underivable_token_file_fails(wireframe_copy: Path):
    tokens = wireframe_copy / "tokens.json"
    doc = json.loads(tokens.read_text())
    del doc["space"]["xl"]
    tokens.write_text(json.dumps(doc, indent=2))
    result = sync_common_tokens(wireframe_copy / "spec.yaml")
    assert not result.ok
    assert result.errors[0].code == "COMMON_TOKENS_UNDERIVABLE"


def test_cli_check_and_write(wireframe_copy: Path):
    main = HERE / "__main__.py"
    ok = subprocess.run([sys.executable, str(main), "common-tokens", "--check"],
                        capture_output=True, text=True, cwd=HERE)
    assert ok.returncode == 0, ok.stdout[-2000:]

    spec = wireframe_copy / "spec.yaml"
    spec.write_text(spec.read_text().replace('ink: "#212121"', 'ink: "#000000"', 1))
    stale = subprocess.run([sys.executable, str(main), "common-tokens", "--spec", str(spec)],
                           capture_output=True, text=True, cwd=HERE)
    assert stale.returncode == 1
    fixed = subprocess.run([sys.executable, str(main), "common-tokens", "--write", "--spec", str(spec)],
                           capture_output=True, text=True, cwd=HERE)
    assert fixed.returncode == 0
    assert 'ink: "#212121"' in spec.read_text()


# ─── the committed systems ──────────────────────────────────────────

@pytest.mark.parametrize("system_id", SYSTEM_IDS)
def test_committed_block_validates_and_serves_raw_readers(system_id: str):
    """Raw-YAML readers (tkr-kit's layout solver and demo theme) get usable values."""
    spec = yaml.safe_load((_lib(system_id) / "spec.yaml").read_text())
    assert validate_common_tokens(spec) == []
    common = spec["tokens"]["common"]
    for step in ("xs", "sm", "md", "lg", "xl"):
        value = common["spacing"][step]
        assert isinstance(value, int) and value > 0, (step, value)
    assert re.fullmatch(r"[A-Za-z0-9 _,-]{1,80}", common["typography"]["body"]["family"])
    assert spec["common_tokens_version"] == "1.0"


def test_malformed_common_block_fails_validation(tmp_path: Path):
    src = _lib("swiss")
    dst = tmp_path / "swiss"
    shutil.copytree(src, dst)
    spec = dst / "spec.yaml"
    spec.write_text(spec.read_text().replace('ink: "#000000"', 'ink: "black"', 1))
    result = validate_spec(spec, library_root=dst)
    assert not result.ok
    assert "COMMON_TOKENS_BAD_COLOR" in [e.code for e in result.errors]


@pytest.mark.parametrize("system_id", ["wireframe", "sketch"])
def test_dark_theme_is_a_checked_mode(system_id: str):
    spec = yaml.safe_load((_lib(system_id) / "spec.yaml").read_text())
    assert spec["themes"]["default"] == "light"
    assert spec["themes"]["light"]["common"] == spec["tokens"]["common"]["color"]
    assert spec["themes"]["dark"]["common"]["surface"] != spec["tokens"]["common"]["color"]["surface"]
    report = check_color_gates_for_spec(_lib(system_id) / "spec.yaml")
    assert report.ok, [e.message for e in report.errors]
    assert report.data["contrast"]["modes"] == 2


def test_dark_theme_contrast_failure_is_caught(tmp_path: Path):
    """A dark value that misses its minimum fails the gate (the mode is really checked)."""
    dst = tmp_path / "sketch"
    shutil.copytree(_lib("sketch"), dst, ignore=shutil.ignore_patterns("components", "layouts"))
    tokens = dst / "tokens.json"
    doc = json.loads(tokens.read_text())
    original = copy.deepcopy(doc)
    axis = next(a for a in doc["modes"]["axes"] if a["id"] == "theme")
    axis["options"]["dark"]["color.text_muted"] = "#959088"   # the pre-fix value: 4.32:1
    tokens.write_text(json.dumps(doc, indent=2))
    report = check_color_gates_for_spec(dst / "spec.yaml")
    assert not report.ok
    assert any("text_muted" in e.message and "theme=dark" in e.message for e in report.errors)
    assert original != doc
