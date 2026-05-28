"""Smoke tests for the tkr-design-systems MCP server.

Run from any directory:
    python3 design-system-skill-work-directory/mcp-server/test_mcp_server.py

Tests call the tool functions directly (bypassing MCP transport) to verify
that the server correctly delegates to both skill packages and returns
well-shaped results.
"""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

# Bootstrap the same way server.py does.
HERE = Path(__file__).resolve().parent
WORK_DIR = HERE.parent
sys.path.insert(0, str(HERE))

from server import (  # noqa: E402
    _bootstrap_paths,
    ds_list_systems,
    ds_load_system,
    ds_validate_spec,
    ds_register_system,
    ds_unregister_system,
    ds_get_rulebook,
    ds_check_compliance,
    wf_generate,
    wf_build_substitution_request,
    wf_apply_substitutions,
    wf_assemble_from_blueprint,
    wf_select_layout,
)


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


def section(name: str) -> None:
    print(f"\n── {name} ──")


# ─── Bootstrap idempotency ─────────────────────────────────────────────

def test_bootstrap_idempotent():
    section("_bootstrap_paths idempotency")
    dss_dir = str(WORK_DIR / "design-system-skill")
    wf_dir = str(WORK_DIR / "wireframe-skill")

    count_dss_before = sys.path.count(dss_dir)
    count_wf_before = sys.path.count(wf_dir)

    _bootstrap_paths()
    _bootstrap_paths()

    assert_(
        sys.path.count(dss_dir) == count_dss_before,
        "design-system-skill not duplicated in sys.path",
    )
    assert_(
        sys.path.count(wf_dir) == count_wf_before,
        "wireframe-skill not duplicated in sys.path",
    )


# ─── ds_list_systems ──────────────────────────────────────────────────

def test_ds_list_systems():
    section("ds_list_systems")
    result = ds_list_systems()

    assert_(result["ok"] is True, "ok is True")

    ids = {s["id"] for s in result["data"]}
    expected = {"wireframe", "swiss", "terminal", "editorial", "sketch", "prism", "revolt", "riso"}
    assert_(ids == expected, f"all 8 systems present", f"got {ids}")

    for system in result["data"]:
        assert_(
            all(k in system for k in ("id", "name", "grammar_family", "status")),
            f"system '{system['id']}' has required keys",
        )


# ─── ds_load_system ───────────────────────────────────────────────────

def test_ds_load_system_success():
    section("ds_load_system (success)")
    result = ds_load_system("swiss")

    assert_(result["ok"] is True, "ok is True for swiss")
    assert_(
        result["data"]["_meta"]["system_id"] == "swiss",
        "_meta.system_id == 'swiss'",
    )
    assert_(
        "tokens" in result["data"],
        "spec contains tokens",
    )
    assert_(
        "components" in result["data"],
        "spec contains components",
    )


def test_ds_load_system_not_found():
    section("ds_load_system (not found)")
    result = ds_load_system("nonexistent-system-xyz")

    assert_(result["ok"] is False, "ok is False for nonexistent system")
    assert_(
        len(result.get("errors", [])) > 0,
        "errors list is non-empty",
    )


# ─── ds_validate_spec ─────────────────────────────────────────────────

def test_ds_validate_spec_valid():
    section("ds_validate_spec (valid)")
    spec_path = str(WORK_DIR / "swiss-library" / "spec.yaml")
    library_root = str(WORK_DIR / "swiss-library")
    result = ds_validate_spec(spec_path, library_root=library_root)

    assert_(result["ok"] is True, "ok is True for valid swiss spec")
    assert_(
        result["data"]["valid"] is True,
        "data.valid is True",
    )


def test_ds_validate_spec_missing():
    section("ds_validate_spec (missing file)")
    result = ds_validate_spec("/nonexistent/spec.yaml")

    assert_(result["ok"] is False, "ok is False for missing spec")


# ─── ds_get_rulebook ──────────────────────────────────────────────────

def test_ds_get_rulebook():
    section("ds_get_rulebook")
    result = ds_get_rulebook("wireframe")

    assert_(result["ok"] is True, "ok is True for wireframe rulebook")
    assert_(
        isinstance(result["data"], list) and len(result["data"]) > 0,
        "data is a non-empty list",
    )

    rule = result["data"][0]
    assert_(
        all(k in rule for k in ("id", "rule", "severity")),
        "first rule has required keys (id, rule, severity)",
    )


# ─── ds_check_compliance ─────────────────────────────────────────────

def test_ds_check_compliance():
    section("ds_check_compliance")
    components_dir = WORK_DIR / "swiss-library" / "components"
    svg_files = sorted(components_dir.glob("*.svg"))
    assert_(len(svg_files) > 0, "swiss-library has component SVGs")

    if svg_files:
        result = ds_check_compliance("swiss", str(svg_files[0]), scope="component")
        assert_(result["ok"] is True, "ok is True for swiss component check")
        assert_(
            "passed" in result.get("data", {}),
            "result contains passed count",
        )


# ─── ds_register_system / ds_unregister_system ───────────────────────

def test_ds_register_unregister_roundtrip():
    section("ds_register_system / ds_unregister_system (roundtrip)")

    # Use a temp registry to avoid mutating the real one.
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_registry = Path(tmpdir) / "registry.yaml"
        tmp_registry.write_text("version: 1\nsystems: []\n")

        old_env = os.environ.get("DESIGN_SYSTEM_SKILL_REGISTRY")
        os.environ["DESIGN_SYSTEM_SKILL_REGISTRY"] = str(tmp_registry)

        try:
            # Clear cached data so the new registry takes effect.
            from design_system_skill.loader import clear_cache
            clear_cache()

            spec_dir = str(WORK_DIR / "swiss-library")
            reg_result = ds_register_system(spec_dir)
            assert_(reg_result["ok"] is True, "register swiss succeeded")

            if reg_result["ok"]:
                assert_(
                    reg_result["data"]["id"] == "swiss",
                    "registered system id is 'swiss'",
                )

                unreg_result = ds_unregister_system("swiss")
                assert_(unreg_result["ok"] is True, "unregister swiss succeeded")

                list_result = ds_list_systems()
                ids = {s["id"] for s in list_result.get("data", [])}
                assert_("swiss" not in ids, "swiss no longer in registry after unregister")
        finally:
            if old_env is None:
                os.environ.pop("DESIGN_SYSTEM_SKILL_REGISTRY", None)
            else:
                os.environ["DESIGN_SYSTEM_SKILL_REGISTRY"] = old_env
            clear_cache()


# ─── wf_generate ──────────────────────────────────────────────────────

def test_wf_generate_with_system():
    section("wf_generate (with system)")
    with tempfile.TemporaryDirectory() as tmpdir:
        result = wf_generate(
            brief="dashboard for a project tracker",
            system="swiss",
            output_dir=tmpdir,
        )

        assert_(result["ok"] is True, "ok is True", f"errors: {result.get('errors')}")
        assert_(result["system_id"] == "swiss", "system_id == 'swiss'")

        if result["svg_path"]:
            assert_(
                Path(result["svg_path"]).exists(),
                "SVG file exists on disk",
            )
        if result["spec_path"]:
            assert_(
                Path(result["spec_path"]).exists(),
                "spec.yaml file exists on disk",
            )


def test_wf_generate_neutral():
    section("wf_generate (neutral / no system)")
    with tempfile.TemporaryDirectory() as tmpdir:
        result = wf_generate(
            brief="settings page",
            output_dir=tmpdir,
        )

        assert_(result["ok"] is True, "ok is True", f"errors: {result.get('errors')}")
        assert_(
            result["system_id"] == "wireframe",
            "system_id defaults to 'wireframe'",
        )


def test_wf_generate_bad_system():
    section("wf_generate (nonexistent system)")
    result = wf_generate(brief="anything", system="nonexistent-system-xyz")

    assert_(result["ok"] is False, "ok is False for nonexistent system")
    assert_(len(result.get("errors", [])) > 0, "errors list is non-empty")


# ─── wf_build_substitution_request ────────────────────────────────────

def test_wf_build_substitution_request():
    section("wf_build_substitution_request")
    result = wf_build_substitution_request(
        brief="dashboard for a meditation app",
        system_id="swiss",
    )

    assert_(result.get("ok") is True, "ok is True", f"errors: {result.get('errors')}")
    assert_(
        isinstance(result.get("text_nodes"), list),
        "text_nodes is a list",
    )
    assert_(
        isinstance(result.get("grammar_caveats"), dict),
        "grammar_caveats is a dict",
    )
    assert_(
        "selected_pattern" in result,
        "selected_pattern is present (auto-selected)",
    )


def test_wf_build_substitution_request_bad_system():
    section("wf_build_substitution_request (bad system)")
    result = wf_build_substitution_request(
        brief="anything",
        system_id="nonexistent-xyz",
    )

    assert_(result["ok"] is False, "ok is False for nonexistent system")


# ─── wf_apply_substitutions ──────────────────────────────────────────

def test_wf_apply_substitutions():
    section("wf_apply_substitutions")

    # Use a real Swiss component SVG.
    components_dir = WORK_DIR / "swiss-library" / "components"
    svg_files = sorted(components_dir.glob("*.svg"))
    assert_(len(svg_files) > 0, "swiss-library has component SVGs for substitution test")

    if svg_files:
        result = wf_apply_substitutions(
            svg_path=str(svg_files[0]),
            substitutions=[
                {"find": "UNLIKELY_PLACEHOLDER_TEXT_XYZ", "replace": "Replaced"},
            ],
            system_id="swiss",
        )

        assert_(result["ok"] is True, "ok is True")
        assert_(isinstance(result["svg_text"], str), "svg_text is a string")
        assert_(
            "UNLIKELY_PLACEHOLDER_TEXT_XYZ" in result["unapplied_finds"],
            "unapplied_finds includes the non-matching find text",
        )


# ─── wf_assemble_from_blueprint ──────────────────────────────────────

def test_wf_assemble_from_blueprint_invalid():
    section("wf_assemble_from_blueprint (validation errors)")
    blueprint = {
        "schema_version": "1.0",
        "canvas": {"width": 1280, "height": 800},
        "regions": [
            {
                "id": "main",
                "x": 0,
                "y": 0,
                "w": 1280,
                "h": 800,
                "components": [
                    {"component_id": "nonexistent-component-xyz", "x": 0, "y": 0},
                ],
            }
        ],
    }

    result = wf_assemble_from_blueprint(blueprint, system_id="swiss")

    assert_(result["ok"] is False, "ok is False for invalid blueprint")
    assert_(
        len(result.get("validation_errors", [])) > 0,
        "validation_errors is non-empty",
    )


def test_wf_assemble_from_blueprint_valid():
    section("wf_assemble_from_blueprint (valid)")

    # Pick a real component from the swiss library.
    components_dir = WORK_DIR / "swiss-library" / "components"
    svg_files = sorted(components_dir.glob("*.svg"))
    assert_(len(svg_files) > 0, "swiss-library has components")

    if svg_files:
        comp_id = svg_files[0].stem
        blueprint = {
            "schema_version": "1.0",
            "canvas": {"width": 1280, "height": 800},
            "regions": [
                {
                    "id": "main",
                    "x": 0,
                    "y": 0,
                    "w": 1280,
                    "h": 800,
                    "components": [
                        {"component_id": comp_id, "x": 10, "y": 10},
                    ],
                }
            ],
        }

        result = wf_assemble_from_blueprint(blueprint, system_id="swiss")

        assert_(result["ok"] is True, "ok is True", f"errors: {result.get('validation_errors')}")
        assert_(
            isinstance(result.get("svg_text"), str) and "<svg" in result["svg_text"],
            "svg_text contains valid SVG",
        )


# ─── New tests: Changes A, C, D, E, B ────────────────────────────────


def test_ds_validate_open_enums():
    section("ds_validate_spec: open enums (Change A)")
    import tempfile
    with tempfile.NamedTemporaryFile(suffix="-spec.yaml", mode="w", delete=False) as f:
        f.write("""\
spec_version: "0.2"
system:
  id: future_sys
  name: Future System
  grammar_family: holographic_display
tokens:
  elevation:
    strategy: floating_panels
""")
        spec_path = f.name
    result = ds_validate_spec(spec_path)
    Path(spec_path).unlink(missing_ok=True)
    assert_(result["ok"] is True,
            "unknown grammar_family + elevation.strategy is valid (ok=True)")
    warnings = result.get("data", {}).get("warnings", [])
    warn_text = " ".join(w.get("message", "") for w in warnings)
    assert_("holographic_display" in warn_text,
            "warning mentions unknown grammar_family")
    assert_("floating_panels" in warn_text,
            "warning mentions unknown elevation.strategy")


def test_ds_load_extends():
    section("ds_load_system: extends (Change C)")
    import os
    import shutil
    import tempfile
    from design_system_skill.loader import clear_cache
    real_registry = WORK_DIR / "registry.yaml"
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        temp_registry = td_path / "registry.yaml"
        shutil.copy2(real_registry, temp_registry)
        shutil.copytree(WORK_DIR / "terminal-library", td_path / "terminal-library")
        ext_dir = td_path / "my-ext-library"
        ext_dir.mkdir()
        (ext_dir / "spec.yaml").write_text("""\
spec_version: "0.2"
system:
  id: my_terminal_ext
  name: My Terminal Extension
  grammar_family: character_grid
  extends: terminal
tokens:
  colors:
    accent: "#00FFAA"
""")
        os.environ["DESIGN_SYSTEM_SKILL_REGISTRY"] = str(temp_registry)
        try:
            clear_cache()
            ds_register_system(str(ext_dir))
            clear_cache()
            result = ds_load_system("my_terminal_ext")
            assert_(result["ok"] is True, "extension loads via MCP server")
            if result["ok"]:
                spec = result["data"]
                assert_(spec["tokens"]["colors"]["accent"] == "#00FFAA",
                        "child token overrides parent via server")
                assert_(spec["_meta"].get("extends") == "terminal",
                        "_meta.extends present via server")
        finally:
            del os.environ["DESIGN_SYSTEM_SKILL_REGISTRY"]
            clear_cache()


def test_wf_generate_substitute():
    section("wf_generate(substitute=True) (Change E)")
    result = wf_generate(brief="dashboard for a chat app", system="swiss",
                         substitute=True)
    assert_(result["ok"] is True, "ok=True with substitute")
    assert_(result.get("svg_path") is None, "no svg_path in substitute mode")
    assert_(result.get("substitution_request") is not None,
            "substitution_request present")
    if result.get("substitution_request"):
        req = result["substitution_request"]
        assert_("text_nodes" in req, "has text_nodes")
        assert_(req.get("system_id") == "swiss", "system_id is swiss")


def test_wf_generate_compose():
    section("wf_generate(compose=True) (Change B)")
    result = wf_generate(brief="kanban board", system="swiss", compose=True)
    assert_(result["ok"] is True, "ok=True with compose")
    assert_(result.get("svg_path") is None, "no svg_path in compose mode")
    assert_(result.get("decomposition_request") is not None,
            "decomposition_request present")
    if result.get("decomposition_request"):
        req = result["decomposition_request"]
        assert_("components" in req, "has components")
        assert_(len(req["components"]) > 0, "components non-empty")


def test_wf_generate_layout_id():
    section("wf_generate(layout_id=...) (Change D/B)")
    result = wf_generate(brief="anything", system="swiss",
                         layout_id="dashboard")
    assert_(result["ok"] is True, "ok=True with layout_id override")
    if result.get("selection"):
        assert_(result["selection"]["pattern_id"] == "dashboard",
                f"pattern_id matches layout_id (got {result['selection']['pattern_id']})")


def test_wf_select_layout():
    section("wf_select_layout (Change D)")
    result = wf_select_layout(brief="video generation workspace",
                               system_id="swiss")
    assert_(result.get("ok") is True, "ok=True")
    patterns = result.get("available_patterns", [])
    assert_(len(patterns) > 0, f"available_patterns non-empty (got {len(patterns)})")
    first = patterns[0]
    assert_("pattern_id" in first, "pattern has pattern_id")
    assert_("base_name" in first, "pattern has base_name")
    assert_(result.get("canvas", {}).get("width") == 1280,
            "canvas width is 1280")


def test_wf_assemble_with_output_dir():
    section("wf_assemble_from_blueprint with output_dir (Change B)")
    import tempfile
    components_dir = WORK_DIR / "swiss-library" / "components"
    svg_files = sorted(components_dir.glob("*.svg"))
    if not svg_files:
        print("  SKIP  no swiss components found")
        return
    comp_id = svg_files[0].stem
    blueprint = {
        "schema_version": "1.0",
        "canvas": {"width": 1280, "height": 800},
        "regions": [
            {
                "id": "main",
                "x": 0, "y": 0, "w": 1280, "h": 800,
                "components": [
                    {"component_id": comp_id, "x": 10, "y": 10},
                ],
            }
        ],
    }
    with tempfile.TemporaryDirectory() as td:
        result = wf_assemble_from_blueprint(blueprint, system_id="swiss",
                                             output_dir=td)
        assert_(result["ok"] is True, "ok=True with output_dir")
        assert_(result.get("svg_path") is not None, "svg_path returned")
        assert_(result.get("spec_path") is not None, "spec_path returned")
        if result.get("spec_path"):
            import yaml
            spec_data = yaml.safe_load(Path(result["spec_path"]).read_text())
            ds = spec_data.get("design_system", {})
            assert_(len(ds.get("components_used", [])) > 0,
                    "components_used populated in spec.yaml")


# ─── Run all tests ────────────────────────────────────────────────────

if __name__ == "__main__":
    test_bootstrap_idempotent()
    test_ds_list_systems()
    test_ds_load_system_success()
    test_ds_load_system_not_found()
    test_ds_validate_spec_valid()
    test_ds_validate_spec_missing()
    test_ds_get_rulebook()
    test_ds_check_compliance()
    test_ds_register_unregister_roundtrip()
    test_wf_generate_with_system()
    test_wf_generate_neutral()
    test_wf_generate_bad_system()
    test_wf_build_substitution_request()
    test_wf_build_substitution_request_bad_system()
    test_wf_apply_substitutions()
    test_wf_assemble_from_blueprint_invalid()
    test_wf_assemble_from_blueprint_valid()
    # New tests for Changes A, C, D, E, B
    test_ds_validate_open_enums()
    test_ds_load_extends()
    test_wf_generate_substitute()
    test_wf_generate_compose()
    test_wf_generate_layout_id()
    test_wf_select_layout()
    test_wf_assemble_with_output_dir()

    print(f"\n{'='*50}")
    print(f"  {PASSED} passed, {FAILED} failed")
    print(f"{'='*50}")
    sys.exit(1 if FAILED else 0)
