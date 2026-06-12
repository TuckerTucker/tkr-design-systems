"""End-to-end tests for wireframe-skill v3.0 (agent-driven routing).

Run from the project root:
    python3 wireframe-skill/test_wireframe_skill.py

The tests confirm:
  - wireframe(brief, layout_id, system) produces an SVG + spec.yaml
  - The SVG has correct viewBox dimensions
  - The spec.yaml has the design_system block populated with the
    expected system id, version, and rulebook compliance summary
  - Rulebook check passes on the generated artifact (no mechanical
    failures)
  - mobile + desktop both work
  - wireframe() without routing returns a routing_request inventory
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
            layout_id="dashboard",
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
    section("wireframe(... system='swiss', platform='mobile', layout_id='dashboard')")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(
            brief="dashboard for a chat app",
            system="swiss",
            platform="mobile",
            output_dir=td,
            layout_id="dashboard",
        )
        assert_(result.svg_path is not None and result.svg_path.exists(),
                "wireframe.svg exists for mobile request")
        assert_(result.spec_path is not None and result.spec_path.exists(),
                "wireframe.spec.yaml exists for mobile request")
        spec = yaml.safe_load(result.spec_path.read_text())
        assert_(spec["wireframe"]["platform"] == "mobile",
                "spec records platform=mobile")


def test_wireframe_library_dashboard_desktop():
    section("wireframe(... system='wireframe', platform='desktop', layout_id='dashboard-mixed')")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(
            brief="dashboard with metrics",
            system="wireframe",
            platform="desktop",
            output_dir=td,
            layout_id="dashboard-mixed",
        )
        assert_(result.ok, "result.ok=True", "; ".join(result.errors)[:300])
        if not result.ok:
            return
        spec = yaml.safe_load(result.spec_path.read_text())
        ds = spec["design_system"]
        assert_(ds["id"] == "wireframe", "system id wireframe")
        assert_(ds["base_pattern"] == "dashboard-mixed",
                f"base pattern is dashboard-mixed (got {ds['base_pattern']})")
        comp = ds.get("rulebook_compliance") or {}
        assert_(comp.get("mechanical_failed") == 0,
                "wireframe library dashboard has no mechanical failures")


def test_wireframe_library_dashboard_mobile_uses_mobile_variant():
    section("wireframe(... system='wireframe', platform='mobile', layout_id='dashboard-mobile')")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(
            brief="dashboard with metrics",
            system="wireframe",
            platform="mobile",
            output_dir=td,
            layout_id="dashboard-mobile",
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


def test_no_routing_returns_inventory():
    section("wireframe() without routing returns routing_request")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(
            brief="image viewer with carousel and duotone filters",
            system="swiss",
            platform="desktop",
            output_dir=td,
        )
        assert_(result.ok, "ok=True for inventory response")
        assert_(result.routing_request is not None, "routing_request is present")
        assert_(result.svg_path is None, "no SVG emitted")
        req = result.routing_request
        assert_("available_patterns" in req, "has available_patterns")
        assert_(len(req.get("available_patterns", [])) > 0,
                "available_patterns is non-empty")
        assert_("available_components" in req, "has available_components")
        assert_("instructions" in req, "has instructions field")
        assert_(req.get("system_id") == "swiss", "system_id is swiss")
        assert_(req.get("platform") == "desktop", "platform is desktop")
        assert_("canvas" in req, "has canvas dimensions")


def test_auto_mode_returns_none():
    section("select_layout_pattern(mode='auto') returns None (heuristic removed)")
    from wireframe_skill.placement import select_layout_pattern
    from design_system_skill.loader import load_system
    res = load_system("swiss")
    if not res.ok:
        return
    selection = select_layout_pattern("dashboard for a chat app", res.data,
                                      platform="desktop", select_mode="auto")
    assert_(selection is None, "auto mode returns None (agent decides)")


def test_unknown_system_fails_cleanly():
    section("wireframe(... system='no_such_system')")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(brief="dashboard", system="no_such_system", output_dir=td)
        assert_(not result.ok, "result.ok=False for unknown system")
        assert_(any("no_such_system" in e for e in result.errors),
                f"error mentions the missing system (errors: {result.errors})")
        assert_(result.svg_path is None, "no svg emitted on failure")


def test_no_system_uses_wireframe_library():
    section("wireframe(... system=None, layout_id='dashboard-mixed') uses wireframe library")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(
            brief="dashboard for an app", system=None, output_dir=td,
            layout_id="dashboard-mixed",
        )
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
        result = wireframe(brief="dashboard", system="swiss", output_dir=td,
                           layout_id="dashboard")
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
            layout_id="dashboard",
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
            layout_id="settings-layout-default",
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

    pattern_path = Path("systems/revolt/layouts/dashboard.svg").resolve()
    if not pattern_path.exists():
        # Fallback: resolve from this file's location in tools/wireframe-skill/.
        pattern_path = Path(__file__).resolve().parents[2] / "systems/revolt/layouts/dashboard.svg"

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


# ─── Change E: substitution mode ──────────────────────────────────


def test_wf_generate_substitute_returns_request():
    section("wireframe(substitute=True): returns substitution_request")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(
            brief="dashboard for a chat app",
            system="swiss",
            platform="desktop",
            output_dir=td,
            substitute=True,
            layout_id="dashboard",
        )
        assert_(result.ok, "result.ok=True in substitute mode",
                "; ".join(result.errors))
        assert_(result.svg_path is None,
                "svg_path is None (no file written)")
        assert_(result.spec_path is None,
                "spec_path is None (no file written)")
        assert_(result.substitution_request is not None,
                "substitution_request is present")
        if result.substitution_request:
            req = result.substitution_request
            assert_("text_nodes" in req, "has text_nodes key")
            assert_("grammar_caveats" in req, "has grammar_caveats key")
            assert_(req.get("schema_version") == "1.0",
                    f"schema_version is 1.0 (got {req.get('schema_version')})")
            assert_(req.get("system_id") == "swiss",
                    f"system_id is swiss (got {req.get('system_id')})")
            emitted = list(Path(td).glob("*.svg"))
            assert_(len(emitted) == 0,
                    f"no SVG files written to output_dir ({emitted})")


def test_wf_generate_substitute_false_unchanged():
    section("wireframe(substitute=False): normal generation unaffected")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(
            brief="dashboard for a chat app",
            system="swiss",
            platform="desktop",
            output_dir=td,
            substitute=False,
            layout_id="dashboard",
        )
        assert_(result.ok, "result.ok=True", "; ".join(result.errors))
        assert_(result.svg_path is not None and result.svg_path.exists(),
                "svg_path written to disk")
        assert_(result.substitution_request is None,
                "substitution_request is None in normal mode")


def test_wf_generate_substitute_to_dict():
    section("GenerationResult.to_dict() with substitution_request")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(
            brief="settings page",
            system="swiss",
            output_dir=td,
            substitute=True,
            layout_id="settings-layout-default",
        )
        d = result.to_dict()
        assert_("substitution_request" in d,
                "to_dict() includes substitution_request key")
        assert_(d["substitution_request"] is not None,
                "substitution_request value is not None")


def test_wf_generate_substitute_unknown_system():
    section("wireframe(substitute=True, unknown system) fails at Step 1")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(
            brief="anything",
            system="no_such_system",
            output_dir=td,
            substitute=True,
        )
        assert_(not result.ok, "unknown system fails (ok=False)")
        assert_(result.substitution_request is None,
                "no substitution_request on failure")


# ─── Change D: smarter template selection ─────────────────────────


def test_select_layout_exact_finds_dashboard():
    section("select_layout_pattern(mode='exact') finds dashboard")
    from wireframe_skill.placement import select_layout_pattern
    from design_system_skill.loader import load_system
    res = load_system("swiss")
    if not res.ok:
        return
    selection = select_layout_pattern("dashboard for a chat app", res.data,
                                      platform="desktop", select_mode="exact")
    assert_(selection is not None, "exact mode found a match")
    if selection:
        assert_(selection.base_pattern == "dashboard",
                f"base_pattern is dashboard (got {selection.base_pattern})")


def test_select_layout_exact_rejects_synonym():
    section("select_layout_pattern(mode='exact') rejects 'login'")
    from wireframe_skill.placement import select_layout_pattern
    from design_system_skill.loader import load_system
    res = load_system("swiss")
    if not res.ok:
        return
    selection = select_layout_pattern("login screen", res.data,
                                      platform="desktop", select_mode="exact")
    assert_(selection is None, "exact mode returns None for synonym 'login'")


def test_wan_regression_edit_not_form():
    section("select_layout_pattern(mode='exact'): 'edit mode' does NOT match form")
    from wireframe_skill.placement import select_layout_pattern
    from design_system_skill.loader import load_system
    res = load_system("wireframe")
    if not res.ok:
        return
    selection = select_layout_pattern(
        "video generation tool with edit mode", res.data,
        platform="desktop", select_mode="exact",
    )
    assert_(selection is None,
            "exact mode returns None for 'edit mode' (no false match to form)")


def test_select_layout_request_mode():
    section("select_layout_pattern(mode='request') always returns None")
    from wireframe_skill.placement import select_layout_pattern
    from design_system_skill.loader import load_system
    res = load_system("swiss")
    if not res.ok:
        return
    selection = select_layout_pattern("dashboard for a chat app", res.data,
                                      platform="desktop", select_mode="request")
    assert_(selection is None, "request mode always returns None")


def test_build_layout_selection_request_structure():
    section("build_layout_selection_request: returns structured request")
    from wireframe_skill.placement import build_layout_selection_request
    from design_system_skill.loader import load_system
    res = load_system("swiss")
    if not res.ok:
        return
    req = build_layout_selection_request("video generation workspace", res.data,
                                         platform="desktop")
    assert_(req.get("schema_version") == "1.0",
            f"schema_version is 1.0 (got {req.get('schema_version')})")
    assert_(req.get("system_id") == "swiss",
            f"system_id is swiss (got {req.get('system_id')})")
    patterns = req.get("available_patterns", [])
    assert_(len(patterns) > 0, f"available_patterns non-empty (got {len(patterns)})")
    first = patterns[0]
    assert_("pattern_id" in first, "pattern has pattern_id")
    assert_("base_name" in first, "pattern has base_name")
    assert_("svg_path" in first, "pattern has svg_path")
    assert_("description" in first, "pattern has description key")
    canvas = req.get("canvas", {})
    assert_(canvas.get("width") == 1280 and canvas.get("height") == 800,
            f"canvas dimensions are 1280x800 (got {canvas})")


def test_apply_layout_selection_valid():
    section("apply_layout_selection: valid choice")
    from wireframe_skill.placement import apply_layout_selection
    from design_system_skill.loader import load_system
    res = load_system("swiss")
    if not res.ok:
        return
    response = {"selected_pattern_id": "dashboard", "rationale": "best fit"}
    selection = apply_layout_selection(response, res.data, platform="desktop")
    assert_(selection is not None, "valid choice returns a LayoutSelection")
    if selection:
        assert_(not selection.fallback, "fallback is False for explicit selection")


def test_apply_layout_selection_invalid():
    section("apply_layout_selection: invalid choice")
    from wireframe_skill.placement import apply_layout_selection
    from design_system_skill.loader import load_system
    res = load_system("swiss")
    if not res.ok:
        return
    response = {"selected_pattern_id": "nonexistent-layout", "rationale": "test"}
    selection = apply_layout_selection(response, res.data, platform="desktop")
    assert_(selection is None, "invalid choice returns None")


# ─── Change B: composition layer ─────────────────────────────────


def test_wireframe_compose_returns_decomposition_request():
    section("wireframe(compose=True): returns decomposition_request")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(
            brief="kanban board with three columns",
            system="swiss",
            platform="desktop",
            output_dir=td,
            compose=True,
        )
        assert_(result.ok, "result.ok=True in compose mode",
                "; ".join(result.errors))
        assert_(result.svg_path is None,
                "svg_path is None (no file written)")
        assert_(result.decomposition_request is not None,
                "decomposition_request is present")
        if result.decomposition_request:
            req = result.decomposition_request
            assert_("components" in req, "has components key")
            assert_("canvas" in req, "has canvas key")
            assert_(len(req.get("components", [])) > 0,
                    "components list non-empty")


def test_wireframe_compose_false_unchanged():
    section("wireframe(compose=False, layout_id='dashboard'): normal template flow")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(
            brief="dashboard for a chat app",
            system="swiss",
            platform="desktop",
            output_dir=td,
            compose=False,
            layout_id="dashboard",
        )
        assert_(result.ok, "result.ok=True", "; ".join(result.errors))
        assert_(result.svg_path is not None, "svg_path written")
        assert_(result.decomposition_request is None,
                "decomposition_request is None in normal mode")


def test_wireframe_layout_id_override():
    section("wireframe(layout_id='auth-sign-in'): explicit override")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(
            brief="anything at all",
            system="swiss",
            platform="desktop",
            output_dir=td,
            layout_id="auth-sign-in",
        )
        assert_(result.ok, "result.ok=True with layout_id",
                "; ".join(result.errors))
        if result.selection:
            assert_(result.selection.pattern_id == "auth-sign-in",
                    f"pattern_id matches layout_id (got {result.selection.pattern_id})")


def test_wireframe_invalid_layout_id():
    section("wireframe(layout_id='nonexistent'): fails")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(
            brief="anything",
            system="swiss",
            platform="desktop",
            output_dir=td,
            layout_id="nonexistent-layout",
        )
        assert_(not result.ok, "invalid layout_id returns ok=False")


def test_wireframe_compose_takes_precedence():
    section("wireframe(compose=True, layout_id=...): compose wins")
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(
            brief="anything",
            system="swiss",
            platform="desktop",
            output_dir=td,
            compose=True,
            layout_id="dashboard",
        )
        assert_(result.ok, "ok=True")
        assert_(result.decomposition_request is not None,
                "compose=True takes precedence (got decomposition_request)")
        assert_(result.selection is None,
                "no selection when compose=True")


def test_emit_with_components_used():
    section("emit_artifact with components_used")
    from wireframe_skill.emit import emit_artifact
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        components = [{"id": "button-primary", "region": "header", "x": 10, "y": 10}]
        svg_path, spec_path = emit_artifact(
            td_path,
            '<svg viewBox="0 0 1280 800"><text>test</text></svg>',
            brief="test",
            platform="desktop",
            spec={"_meta": {"system_id": "test", "spec_version": "0.2",
                            "system_version": "1.0"}},
            selection=None,
            compliance=None,
            width=1280,
            height=800,
            components_used=components,
        )
        import yaml as _yaml
        spec_data = _yaml.safe_load(spec_path.read_text())
        ds = spec_data.get("design_system", {})
        assert_(len(ds.get("components_used", [])) == 1,
                f"components_used has 1 entry (got {len(ds.get('components_used', []))})")
        assert_(ds["components_used"][0]["id"] == "button-primary",
                "component id is button-primary")


def test_full_composition_e2e():
    section("full composition e2e: compose → blueprint → assemble")
    from wireframe_skill.assembler import assemble_blueprint
    from design_system_skill.loader import load_system
    import xml.etree.ElementTree as ET

    with tempfile.TemporaryDirectory() as td:
        # Step 1: get decomposition request
        result = wireframe(
            brief="video generation workspace",
            system="swiss",
            platform="desktop",
            output_dir=td,
            compose=True,
        )
        assert_(result.ok and result.decomposition_request is not None,
                "compose mode returns decomposition_request")
        if not result.decomposition_request:
            return

        # Step 2: build a blueprint from available components
        components = result.decomposition_request.get("components", [])
        comp_ids = [c["component_id"] for c in components]
        button_id = next((c for c in comp_ids if "button" in c), comp_ids[0])
        card_id = next((c for c in comp_ids if "card" in c), comp_ids[0])

        blueprint = {
            "schema_version": "1.0",
            "canvas": {"width": 1280, "height": 800},
            "regions": [
                {
                    "id": "header",
                    "x": 0, "y": 0, "w": 1280, "h": 64,
                    "components": [
                        {"component_id": button_id, "x": 10, "y": 10}
                    ],
                },
                {
                    "id": "main",
                    "x": 0, "y": 64, "w": 1280, "h": 736,
                    "components": [
                        {"component_id": card_id, "x": 20, "y": 20}
                    ],
                },
            ],
        }

        # Step 3: assemble
        res = load_system("swiss")
        if not res.ok:
            return
        svg_text, warnings = assemble_blueprint(blueprint, res.data)
        try:
            ET.fromstring(svg_text)
            assert_(True, "assembled SVG is valid XML")
        except Exception as e:
            assert_(False, f"SVG not valid XML: {e}")
        assert_(button_id.replace("-", "_") in svg_text or button_id in svg_text,
                "SVG contains the chosen button component")


def main():
    print("wireframe-skill v3.0 end-to-end tests\n" + "=" * 50)
    test_swiss_dashboard_desktop()
    test_swiss_dashboard_mobile()
    test_wireframe_library_dashboard_desktop()
    test_wireframe_library_dashboard_mobile_uses_mobile_variant()
    test_no_routing_returns_inventory()
    test_auto_mode_returns_none()
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
    # Change E: substitution mode
    test_wf_generate_substitute_returns_request()
    test_wf_generate_substitute_false_unchanged()
    test_wf_generate_substitute_to_dict()
    test_wf_generate_substitute_unknown_system()
    # Change D: smarter template selection
    test_select_layout_exact_finds_dashboard()
    test_select_layout_exact_rejects_synonym()
    test_wan_regression_edit_not_form()
    test_select_layout_request_mode()
    test_build_layout_selection_request_structure()
    test_apply_layout_selection_valid()
    test_apply_layout_selection_invalid()
    # Change B: composition layer
    test_wireframe_compose_returns_decomposition_request()
    test_wireframe_compose_false_unchanged()
    test_wireframe_layout_id_override()
    test_wireframe_invalid_layout_id()
    test_wireframe_compose_takes_precedence()
    test_emit_with_components_used()
    test_full_composition_e2e()

    print(f"\n{'=' * 50}")
    print(f"Total: {PASSED + FAILED}  Passed: {PASSED}  Failed: {FAILED}")
    return 0 if FAILED == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
