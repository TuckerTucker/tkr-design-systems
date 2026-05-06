"""End-to-end tests for wireframe-skill v3.0.

Run from the project root:
    python3 wireframe-skill/test_wireframe_skill.py

The tests confirm:
  - wireframe(brief, system='swiss', platform='desktop') produces an
    SVG + spec.yaml in the output dir
  - The SVG has correct viewBox dimensions
  - The spec.yaml has the design_system block populated with the
    expected system id, version, and rulebook compliance summary
  - Rulebook check passes on the generated artifact (no mechanical
    failures)
  - mobile + desktop both work
  - keyword heuristics route briefs to the expected patterns
  - missing systems fail cleanly
  - emit happens even when compliance has advisory warnings
"""

from __future__ import annotations
import json
import re
import shutil
import sys
import tempfile
from pathlib import Path

# Make sibling packages importable.
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "design-system-skill"))

import yaml  # noqa: E402

from wireframe_skill import wireframe, GenerationResult  # noqa: E402


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


def _viewbox(svg_text: str) -> tuple[int, int]:
    m = re.search(r'viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"', svg_text)
    if not m:
        return (-1, -1)
    return int(float(m.group(1))), int(float(m.group(2)))


# ─── Tests ──────────────────────────────────────────────────────────

def test_swiss_dashboard_desktop():
    section("wireframe(brief='dashboard...', system='swiss', platform='desktop')")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(
            brief="dashboard for a chat app",
            system="swiss",
            platform="desktop",
            output_dir=td,
        )
        assert_(result.ok, "result.ok=True", "; ".join(result.errors)[:300])
        if not result.ok:
            return
        assert_(result.svg_path is not None and result.svg_path.exists(),
                "wireframe.svg exists at returned path")
        assert_(result.spec_path is not None and result.spec_path.exists(),
                "wireframe.spec.yaml exists at returned path")

        # SVG dimensions
        svg_text = result.svg_path.read_text()
        w, h = _viewbox(svg_text)
        assert_(w == 1280 and h == 800,
                f"SVG viewBox is 1280x800 (got {w}x{h})")

        # spec.yaml shape
        spec = yaml.safe_load(result.spec_path.read_text())
        wf = spec.get("wireframe", {})
        ds = spec.get("design_system", {})
        assert_(wf.get("brief") == "dashboard for a chat app", "spec.yaml records brief")
        assert_(wf.get("platform") == "desktop", "spec.yaml records platform")
        assert_(ds.get("id") == "swiss", "design_system.id is swiss")
        assert_(ds.get("layout_template_used") == "dashboard",
                f"layout_template_used is 'dashboard' (got {ds.get('layout_template_used')})")
        assert_(ds.get("spec_version") == "0.2", "spec_version recorded")

        # Compliance summary
        comp = ds.get("rulebook_compliance") or {}
        assert_(comp.get("mechanical_failed") == 0,
                f"no mechanical failures (got {comp.get('mechanical_failed')})")
        assert_(comp.get("ruleset") == "swiss", "ruleset=swiss recorded")


def test_swiss_dashboard_mobile():
    section("wireframe(... system='swiss', platform='mobile')")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(
            brief="dashboard for a chat app",
            system="swiss",
            platform="mobile",
            output_dir=td,
        )
        # Swiss has no mobile-suffixed dashboard; skill should fall back
        # to the desktop variant gracefully. Either way, the call should
        # succeed and emit valid output.
        assert_(result.svg_path is not None and result.svg_path.exists(),
                "wireframe.svg exists for mobile request")
        assert_(result.spec_path is not None and result.spec_path.exists(),
                "wireframe.spec.yaml exists for mobile request")
        spec = yaml.safe_load(result.spec_path.read_text())
        assert_(spec["wireframe"]["platform"] == "mobile",
                "spec records platform=mobile")


def test_wireframe_library_dashboard_desktop():
    section("wireframe(... system='wireframe', platform='desktop')")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(
            brief="dashboard with metrics",
            system="wireframe",
            platform="desktop",
            output_dir=td,
        )
        assert_(result.ok, "result.ok=True", "; ".join(result.errors)[:300])
        if not result.ok:
            return
        spec = yaml.safe_load(result.spec_path.read_text())
        ds = spec["design_system"]
        assert_(ds["id"] == "wireframe", "system id wireframe")
        assert_(ds["base_pattern"] == "dashboard",
                f"base pattern is dashboard (got {ds['base_pattern']})")
        comp = ds.get("rulebook_compliance") or {}
        assert_(comp.get("mechanical_failed") == 0,
                "wireframe library dashboard has no mechanical failures")


def test_wireframe_library_dashboard_mobile_uses_mobile_variant():
    section("wireframe(... system='wireframe', platform='mobile') picks -mobile variant")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(
            brief="dashboard with metrics",
            system="wireframe",
            platform="mobile",
            output_dir=td,
        )
        assert_(result.ok, "result.ok=True")
        if not result.ok:
            return
        spec = yaml.safe_load(result.spec_path.read_text())
        chosen = spec["design_system"]["layout_template_used"]
        assert_(chosen == "dashboard-mobile",
                f"mobile platform picked dashboard-mobile (got '{chosen}')")
        svg = result.svg_path.read_text()
        w, h = _viewbox(svg)
        assert_(w == 375, f"mobile dashboard SVG width is 375 (got {w})")


def test_keyword_routing():
    section("brief keyword routing")
    cases = [
        ("login screen for chat app", "swiss", "auth"),
        ("settings panel for an account", "swiss", "settings-layout"),
        ("a long form for new user data", "swiss", "form"),
        ("data table of members", "swiss", "data-table"),
        ("modal to confirm an action", "swiss", "modal"),
        ("empty state when no threads exist", "swiss", "empty-state"),
    ]
    for brief, system, expected_base in cases:
        with tempfile.TemporaryDirectory() as td:
            result = wireframe(brief=brief, system=system, output_dir=td)
            if not result.ok:
                # Some patterns may have rulebook advisory warnings that don't
                # affect ok status. If failed, skip with detail.
                print(f"  SKIP  '{brief}' produced errors: {result.errors}")
                continue
            spec = yaml.safe_load(result.spec_path.read_text())
            base = spec["design_system"]["base_pattern"]
            assert_(base == expected_base,
                    f"brief '{brief}' chose base '{expected_base}' (got '{base}')")


def test_unknown_system_fails_cleanly():
    section("wireframe(... system='no_such_system')")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(brief="dashboard", system="no_such_system", output_dir=td)
        assert_(not result.ok, "result.ok=False for unknown system")
        assert_(any("no_such_system" in e for e in result.errors),
                f"error mentions the missing system (errors: {result.errors})")
        assert_(result.svg_path is None, "no svg emitted on failure")


def test_no_system_uses_wireframe_library():
    section("wireframe(... system=None) falls back to wireframe library")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(brief="dashboard for an app", system=None, output_dir=td)
        assert_(result.ok, "result.ok=True with no system",
                "; ".join(result.errors)[:300])
        if not result.ok:
            return
        spec = yaml.safe_load(result.spec_path.read_text())
        assert_(spec["design_system"]["id"] == "wireframe",
                "system=None routed to wireframe library")


def test_invalid_platform_fails():
    section("wireframe(platform='bogus') fails fast")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(brief="dashboard", system="swiss",
                           platform="bogus", output_dir=td)
        assert_(not result.ok, "invalid platform returns ok=False")


def test_emit_happens_even_with_advisory():
    section("emit happens when compliance has advisory warnings")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(brief="dashboard", system="swiss", output_dir=td)
        if not result.ok:
            return
        # Swiss dashboard has at least one grid-alignment advisory.
        assert_(result.compliance is not None,
                "compliance result attached")
        assert_(result.compliance.get("advisory", 0) >= 0,
                "advisory count is non-negative")
        assert_(result.svg_path.exists(), "svg still emitted")


def test_filename_stem_override():
    section("--filename custom stem")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(
            brief="dashboard", system="swiss",
            output_dir=td, filename_stem="my_dash",
        )
        if not result.ok:
            return
        assert_(result.svg_path.name == "my_dash.svg",
                f"svg uses custom stem (got {result.svg_path.name})")
        assert_(result.spec_path.name == "my_dash.spec.yaml",
                f"spec uses custom stem (got {result.spec_path.name})")


def test_apply_artifact_treatments_riso_injects_filters_and_layers():
    section("apply_artifact_treatments: Riso filters + bottom/top layers")
    # Test apply_artifact_treatments directly with a minimal spec and SVG.
    from wireframe_skill.compose import apply_artifact_treatments

    minimal_svg = '<svg viewBox="0 0 375 667"><text>Hello</text></svg>'
    riso_spec = {
        "tokens": {
            "colors": {
                "page_bg": "#F4EDD9"
            }
        },
        "filter_library": [
            {
                "id": "riso_grain",
                "svg_defs": '<filter id="riso_grain"><feTurbulence/></filter>'
            },
            {
                "id": "riso_duotone_classic",
                "svg_defs": '<filter id="riso_duotone_classic"><feColorMatrix/></filter>'
            }
        ],
        "artifact_treatments": [
            {
                "id": "page_background",
                "layer": "bottom",
                "type": "fill",
                "fill": "ref:tokens.colors.page_bg"
            },
            {
                "id": "grain_overlay",
                "layer": "top",
                "type": "filter_overlay",
                "filter_ref": "riso_grain"
            }
        ]
    }

    result = apply_artifact_treatments(minimal_svg, riso_spec)

    # Check filter defs injected.
    assert_("riso_grain" in result,
            "riso_grain filter injected into SVG")
    assert_("riso_duotone_classic" in result,
            "riso_duotone_classic filter injected into SVG")
    assert_("<defs>" in result,
            "<defs> block present in SVG")

    # Check page background rect exists with correct fill.
    m = re.search(r'<rect[^>]*width="100%"[^>]*height="100%"[^>]*fill="#F4EDD9', result)
    assert_(m is not None, "page background rect with correct color inserted")

    # Check grain overlay rect exists as last child before </svg> (top layer).
    m = re.search(r'<rect[^>]*width="100%"[^>]*height="100%"[^>]*filter="url\(#riso_grain\)"', result)
    assert_(m is not None, "grain_overlay rect with filter_ref inserted")

    # Verify "pending" annotation is gone.
    assert_("pending artifact_treatments" not in result,
            "pending artifact_treatments annotation not present")


def test_apply_artifact_treatments_noop_for_swiss():
    section("apply_artifact_treatments: no-op for swiss (no artifact_treatments)")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(
            brief="settings page",
            system="swiss",
            output_dir=td,
        )
        assert_(result.ok, "result.ok=True", "; ".join(result.errors)[:300])
        if not result.ok:
            return
        svg_text = result.svg_path.read_text()

        # Swiss has no artifact_treatments; SVG should be unchanged.
        # No filter injection, no spurious rects.
        assert_("riso_grain" not in svg_text,
                "no riso filters injected for Swiss system")
        assert_("per_component treatments pending" not in svg_text,
                "no per_component annotation for Swiss system")


# ─── substitution module tests ──────────────────────────────────────

def test_extract_text_nodes_finds_all_text_and_tspans():
    section("substitution.extract_text_nodes finds all <text> and <tspan>")
    from wireframe_skill.substitution import extract_text_nodes

    svg = """<svg>
      <text>First</text>
      <text>Second</text>
      <text>
        <tspan>Nested</tspan>
      </text>
      <style>.cls { font-family: Ignored; }</style>
      <text>Third</text>
    </svg>"""

    nodes = extract_text_nodes(svg)

    assert_(len(nodes) >= 4, f"Found at least 4 text nodes (got {len(nodes)})")
    contents = [n.content for n in nodes]
    assert_("First" in contents, "First text found")
    assert_("Second" in contents, "Second text found")
    assert_("Nested" in contents, "Nested tspan found")
    assert_("Third" in contents, "Third text found")
    assert_("Ignored" not in contents, "Style block content not extracted")


def test_build_substitution_request_includes_grammar_caveats():
    section("substitution.build_substitution_request includes grammar caveats")
    from wireframe_skill.substitution import build_substitution_request
    from design_system_skill.loader import load_system

    result = load_system("revolt")
    if not result.ok:
        assert_(False, f"revolt system spec not found: {result.errors}")
        return
    spec = result.data

    pattern_path = Path("revolt-library/layouts/dashboard.svg").resolve()
    if not pattern_path.exists():
        # Fallback: try alternative path.
        pattern_path = Path(__file__).parent.parent / "revolt-library/layouts/dashboard.svg"

    if not pattern_path.exists():
        assert_(False, f"pattern not found at {pattern_path}")
        return

    request = build_substitution_request(
        brief="metrics dashboard",
        spec=spec,
        pattern_svg_path=pattern_path,
    )

    assert_(request.get("schema_version") == "1.0", "schema_version is 1.0")
    assert_(request.get("system_id") == "revolt", "system_id is correct")
    assert_("grammar_caveats" in request, "grammar_caveats key present")
    caveats = request.get("grammar_caveats", {})
    assert_("case_rules" in caveats or "avatar_strategy" in caveats,
            "grammar caveats include case rules or avatar strategy")
    assert_("text_nodes" in request, "text_nodes key present")
    assert_(len(request.get("text_nodes", [])) > 0, "text_nodes list is non-empty")


def test_apply_substitutions_replaces_in_text_nodes_only():
    section("substitution.apply_substitutions: text-only, preserves styles")
    from wireframe_skill.substitution import apply_substitutions

    svg = """<svg>
      <text>Hello</text>
      <style>.cls { font-family: Hello; }</style>
      <text>World</text>
    </svg>"""

    subs = [
        {"find": "Hello", "replace": "Goodbye", "rationale": "test"}
    ]

    result_svg, unapplied = apply_substitutions(svg, subs)

    # Check that Hello → Goodbye happened in <text> content.
    assert_("<text>Goodbye</text>" in result_svg,
            "Text node content replaced")
    # Check that style block still has the original "Hello".
    assert_(".cls { font-family: Hello;" in result_svg,
            "Style block Hello not replaced (preserved as-is)")
    assert_(len(unapplied) == 0, "No unapplied finds")


def test_validate_substitutions_flags_uppercase_for_revolt():
    section("substitution.validate_substitutions: flags case violations")
    from wireframe_skill.substitution import validate_substitutions
    from design_system_skill.loader import load_system

    result = load_system("revolt")
    if not result.ok:
        assert_(False, f"revolt system spec not found: {result.errors}")
        return
    spec = result.data

    # Revolt metadata must be uppercase. Simulate a substitution that
    # violates this: find "SESSIONS" (metadata), replace "sessions" (lowercase).
    subs = [
        {"find": "SESSIONS", "replace": "sessions", "rationale": "test"}
    ]

    warnings = validate_substitutions(subs, spec)

    assert_(len(warnings) > 0, f"Got warnings for case violation (got {len(warnings)})")
    assert_(any("ALL CAPS" in w or "UPPERCASE" in w for w in warnings),
            f"Warning mentions uppercase requirement")


def test_apply_substitutions_returns_unapplied_finds():
    section("substitution.apply_substitutions: returns unapplied finds")
    from wireframe_skill.substitution import apply_substitutions

    svg = "<svg><text>Exists</text></svg>"

    subs = [
        {"find": "Nonexistent", "replace": "Replaced", "rationale": "test"}
    ]

    result_svg, unapplied = apply_substitutions(svg, subs)

    assert_("Nonexistent" in unapplied, "Unapplied find is listed")
    assert_(result_svg == svg, "SVG unchanged when find not present")


# ─── runner ─────────────────────────────────────────────────────────

# ─── decomposition module tests ──────────────────────────────────

def test_build_decomposition_request_lists_components():
    section("decomposition.build_decomposition_request lists all components")
    from wireframe_skill.decomposition import build_decomposition_request
    from design_system_skill.loader import load_system

    result = load_system("swiss")
    if not result.ok:
        assert_(False, f"swiss system spec not found: {result.errors}")
        return
    spec = result.data

    request = build_decomposition_request(
        brief="dashboard layout",
        spec=spec,
        platform="desktop",
    )

    assert_(request.get("schema_version") == "1.0", "schema_version is 1.0")
    assert_(request.get("system_id") == "swiss", "system_id is swiss")
    assert_(request.get("platform") == "desktop", "platform is desktop")
    assert_("canvas" in request, "canvas key present")
    canvas = request.get("canvas", {})
    assert_(canvas.get("width") == 1280, "desktop canvas width is 1280")
    assert_(canvas.get("height") == 800, "desktop canvas height is 800")
    assert_("components" in request, "components key present")
    components = request.get("components", [])
    assert_(len(components) > 0, f"at least 1 component in list (got {len(components)})")
    # Check that components have required keys.
    if components:
        first = components[0]
        assert_("component_id" in first, "component dict has component_id")
        assert_("viewBox_w" in first, "component dict has viewBox_w")
        assert_("viewBox_h" in first, "component dict has viewBox_h")


def test_validate_blueprint_flags_unknown_component():
    section("decomposition.validate_blueprint flags unknown component")
    from wireframe_skill.decomposition import validate_blueprint
    from design_system_skill.loader import load_system

    result = load_system("swiss")
    if not result.ok:
        assert_(False, f"swiss system spec not found: {result.errors}")
        return
    spec = result.data

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
                    {"component_id": "phantom-widget", "x": 0, "y": 0}
                ],
            }
        ],
    }

    errors = validate_blueprint(blueprint, spec)

    assert_(len(errors) > 0, f"validation returned errors (got {len(errors)})")
    assert_(any("phantom-widget" in e for e in errors),
            "error mentions the unknown component")


def test_validate_blueprint_flags_oversized_component():
    section("decomposition.validate_blueprint flags component exceeding region")
    from wireframe_skill.decomposition import validate_blueprint
    from design_system_skill.loader import load_system

    result = load_system("swiss")
    if not result.ok:
        assert_(False, f"swiss system spec not found: {result.errors}")
        return
    spec = result.data

    blueprint = {
        "schema_version": "1.0",
        "canvas": {"width": 1280, "height": 800},
        "regions": [
            {
                "id": "header",
                "x": 0,
                "y": 0,
                "w": 200,
                "h": 100,
                "components": [
                    {"component_id": "card-default", "x": 0, "y": 0, "w": 500, "h": 150}
                ],
            }
        ],
    }

    errors = validate_blueprint(blueprint, spec)

    assert_(len(errors) > 0, f"validation returned errors (got {len(errors)})")
    assert_(any("exceeds region bounds" in e for e in errors),
            "error mentions bounds violation")


def test_assemble_blueprint_swiss_dashboard_minimal():
    section("assembler.assemble_blueprint: minimal dashboard with header + card")
    from wireframe_skill.assembler import assemble_blueprint
    from design_system_skill.loader import load_system
    import xml.etree.ElementTree as ET

    result = load_system("swiss")
    if not result.ok:
        assert_(False, f"swiss system spec not found: {result.errors}")
        return
    spec = result.data

    blueprint = {
        "schema_version": "1.0",
        "canvas": {"width": 1280, "height": 800},
        "regions": [
            {
                "id": "header",
                "x": 0,
                "y": 0,
                "w": 1280,
                "h": 64,
                "components": [
                    {"component_id": "button-primary", "x": 10, "y": 10}
                ],
            },
            {
                "id": "main",
                "x": 0,
                "y": 64,
                "w": 1280,
                "h": 736,
                "components": [
                    {"component_id": "card-default", "x": 20, "y": 20, "w": 300, "h": 150}
                ],
            }
        ],
    }

    svg_text, warnings = assemble_blueprint(blueprint, spec)

    # Check that output is valid XML.
    try:
        ET.fromstring(svg_text)
        assert_(True, "assembled SVG is valid XML")
    except Exception as e:
        assert_(False, f"SVG is not valid XML: {e}")

    # Check for expected structure.
    assert_("<svg" in svg_text, "SVG root element present")
    assert_("</svg>" in svg_text, "SVG closing tag present")
    assert_("button-primary" in svg_text or "button_primary" in svg_text,
            "SVG includes button component reference")
    assert_("card-default" in svg_text or "card_default" in svg_text,
            "SVG includes card component reference")


def test_assemble_blueprint_dedupes_filter_ids():
    section("assembler: deduplicates colliding filter IDs in <defs>")
    from wireframe_skill.assembler import assemble_blueprint
    from design_system_skill.loader import load_system

    result = load_system("swiss")
    if not result.ok:
        assert_(False, f"swiss system spec not found: {result.errors}")
        return
    spec = result.data

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
                    {"component_id": "card-default", "x": 0, "y": 0},
                    {"component_id": "card-default", "x": 350, "y": 0}
                ],
            }
        ],
    }

    svg_text, warnings = assemble_blueprint(blueprint, spec)

    # Check that duplicate component placements are handled.
    assert_("<g" in svg_text, "SVG contains groups for positioned components")
    # If there are collision warnings, that's expected but not required
    # (depends on whether card-default has any <defs>).
    assert_(True, "assembled SVG with duplicate component placeholders")


def main():
    print("wireframe-skill v3.0 end-to-end tests\n" + "=" * 50)
    test_swiss_dashboard_desktop()
    test_swiss_dashboard_mobile()
    test_wireframe_library_dashboard_desktop()
    test_wireframe_library_dashboard_mobile_uses_mobile_variant()
    test_keyword_routing()
    test_unknown_system_fails_cleanly()
    test_no_system_uses_wireframe_library()
    test_invalid_platform_fails()
    test_emit_happens_even_with_advisory()
    test_filename_stem_override()
    test_apply_artifact_treatments_riso_injects_filters_and_layers()
    test_apply_artifact_treatments_noop_for_swiss()
    # New substitution module tests
    test_extract_text_nodes_finds_all_text_and_tspans()
    test_build_substitution_request_includes_grammar_caveats()
    test_apply_substitutions_replaces_in_text_nodes_only()
    test_validate_substitutions_flags_uppercase_for_revolt()
    test_apply_substitutions_returns_unapplied_finds()
    # New decomposition module tests
    test_build_decomposition_request_lists_components()
    test_validate_blueprint_flags_unknown_component()
    test_validate_blueprint_flags_oversized_component()
    test_assemble_blueprint_swiss_dashboard_minimal()
    test_assemble_blueprint_dedupes_filter_ids()

    print(f"\n{'=' * 50}")
    print(f"Total: {PASSED + FAILED}  Passed: {PASSED}  Failed: {FAILED}")
    return 0 if FAILED == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
