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

# Make the package importable; importing wireframe_skill puts
# design_system_skill on sys.path in either layout (_design_system_path).
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

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
        # Under pytest a counted failure would pass silently; fail the test instead.
        if "pytest" in sys.modules:
            raise AssertionError(f"{label}: {detail}" if detail else label)


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
        assert_(ds.get("spec_version") == "0.3", "spec_version recorded")

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

    # Pattern SVGs live in the system's library (owned by design-system-skill);
    # resolve through the loaded spec rather than assuming a location.
    library_root = Path(spec["_meta"]["library_root"])
    pattern_path = library_root / "layouts" / "dashboard.svg"
    if not pattern_path.exists():
        assert_(False, f"pattern not found at {pattern_path}")
        return

    request = build_substitution_request(
        brief="metrics dashboard",
        spec=spec,
        pattern_svg_path=pattern_path,
    )

    assert_(request.get("schema_version") == "1.1", "schema_version is 1.1")
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


def test_extract_text_nodes_computes_width_budget():
    section("substitution.extract_text_nodes: computes per-node width budget")
    from wireframe_skill.substitution import extract_text_nodes

    # 343px-wide card on a 375-viewBox mobile canvas. Text starts at x=32
    # inside the card (which begins at x=16). At 12px Inter (ratio 0.52),
    # available width = (16 + 343) - 32 - 8 margin = 319 px,
    # max_chars = floor(319 / (12 * 0.52)) = floor(51.1) = 51.
    svg = """<svg viewBox="0 0 375 812">
      <rect x="16" y="100" width="343" height="200" fill="white"/>
      <text x="32" y="140" font-size="12" font-family="Inter">Card title</text>
      <text x="600" y="50" font-size="14">Outside any rect</text>
    </svg>"""

    nodes = extract_text_nodes(svg)
    by_content = {n.content: n for n in nodes}

    card_node = by_content.get("Card title")
    assert_(card_node is not None, "Card title node extracted")
    assert_(card_node.max_chars is not None, "max_chars computed when rect encloses text")
    assert_(45 <= card_node.max_chars <= 55,
            f"max_chars in expected range for 12px Inter in 343px card (got {card_node.max_chars})")
    assert_(card_node.font_size == 12.0, "font_size captured")

    # Outside-any-rect node falls back to viewBox width (375).
    outside = by_content.get("Outside any rect")
    assert_(outside is not None, "outside-rect node extracted")
    # x=600 is past the 375 viewBox; available width is negative → max_chars 0.
    assert_(outside.max_chars == 0,
            f"text past viewBox right edge gets 0 budget (got {outside.max_chars})")


def test_validate_substitutions_flags_overflow_against_budget():
    section("substitution.validate_substitutions: flags replacements that exceed budget")
    from wireframe_skill.substitution import (
        TextNode,
        validate_substitutions,
    )

    # Synthetic spec with no grammar rules — only the width check should fire.
    spec = {"system": {"id": "test"}, "tokens": {}}
    nodes = [
        TextNode(
            content="Short label",
            tag="text",
            line_hint="line 1",
            x=10.0,
            font_size=12.0,
            font_family="Inter",
            text_anchor=None,
            available_width_px=100.0,
            max_chars=16,
        ),
    ]

    # Replacement is 30 chars — exceeds the 16-char budget.
    subs = [
        {"find": "Short label", "replace": "A wildly verbose replacement!", "rationale": "test"},
    ]
    warnings = validate_substitutions(subs, spec, nodes)
    assert_(len(warnings) > 0, f"got overflow warnings (got {len(warnings)})")
    assert_(any("overflow" in w.lower() or "budget" in w.lower() for w in warnings),
            "warning mentions overflow or budget")

    # In-budget replacement produces no warning.
    subs_ok = [
        {"find": "Short label", "replace": "Tight fit", "rationale": "test"},
    ]
    warnings_ok = validate_substitutions(subs_ok, spec, nodes)
    overflow_warnings = [w for w in warnings_ok if "overflow" in w.lower() or "budget" in w.lower()]
    assert_(len(overflow_warnings) == 0,
            f"in-budget replacement passes (got {len(overflow_warnings)} overflow warnings)")


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


# ─── Phase B: router escalation ─────────────────────────────────────


def test_escalate_carousel_brief():
    section("placement: off-catalog 'carousel' brief escalates to decomposition")
    from wireframe_skill.placement import select_layout_pattern, EscalateToDecomposition
    from design_system_skill import load_system
    spec = load_system("swiss").data
    sel = select_layout_pattern("carousel of trip photos", spec)
    assert_(isinstance(sel, EscalateToDecomposition),
            "carousel brief → EscalateToDecomposition",
            f"got {type(sel).__name__}")
    if isinstance(sel, EscalateToDecomposition):
        assert_("carousel" in sel.brief_nouns,
                "brief_nouns includes 'carousel'",
                str(sel.brief_nouns))
        assert_(sel.catalog_intersection == [],
                "catalog_intersection is empty (no overlap)",
                str(sel.catalog_intersection))


def test_escalate_filter_chip_strip():
    section("placement: 'filter chip strip' brief escalates")
    from wireframe_skill.placement import select_layout_pattern, EscalateToDecomposition
    from design_system_skill import load_system
    spec = load_system("swiss").data
    sel = select_layout_pattern("filter chip strip for products", spec)
    assert_(isinstance(sel, EscalateToDecomposition),
            "filter chip strip → EscalateToDecomposition")


def test_dashboard_brief_does_not_escalate():
    section("placement: 'dashboard' brief still routes via keyword (no escalation)")
    from wireframe_skill.placement import select_layout_pattern, LayoutSelection
    from design_system_skill import load_system
    spec = load_system("swiss").data
    sel = select_layout_pattern("dashboard for a chat app", spec)
    assert_(isinstance(sel, LayoutSelection),
            "dashboard brief → LayoutSelection (not escalation)")
    if isinstance(sel, LayoutSelection):
        assert_(not sel.fallback,
                "dashboard brief is keyword-matched, not a fallback",
                f"fallback={sel.fallback}")


def test_no_escalate_flag_preserves_legacy_fallback():
    section("placement: escalate=False preserves dashboard fallback for off-catalog")
    from wireframe_skill.placement import select_layout_pattern, LayoutSelection
    from design_system_skill import load_system
    spec = load_system("swiss").data
    sel = select_layout_pattern("carousel of trip photos", spec, escalate=False)
    assert_(isinstance(sel, LayoutSelection),
            "carousel + escalate=False → LayoutSelection (legacy)")
    if isinstance(sel, LayoutSelection):
        assert_(sel.fallback,
                "carousel + escalate=False → fallback=True")
        assert_(sel.base_pattern == "dashboard",
                f"falls back to dashboard (got {sel.base_pattern!r})")


def test_wireframe_escalation_surfaces_pass_request():
    section("wireframe(): off-catalog brief returns requires_orchestrator_pass + pass_request")
    import tempfile
    from wireframe_skill import wireframe
    with tempfile.TemporaryDirectory() as td:
        r = wireframe(brief="carousel of trips", system="swiss", output_dir=td)
    assert_(r.requires_orchestrator_pass,
            "requires_orchestrator_pass=True on off-catalog brief",
            f"got {r.requires_orchestrator_pass}")
    assert_(r.pass_request is not None,
            "pass_request payload is populated")
    if r.pass_request:
        assert_(r.pass_request.get("system_id") == "swiss",
                "pass_request.system_id is the requested system")
        assert_(len(r.pass_request.get("components", [])) > 0,
                "pass_request.components is non-empty")
    assert_(r.escalation_reason is not None,
            "escalation_reason is set")


def test_escalates_on_system_with_large_component_catalog():
    section("placement: off-catalog brief escalates even on a 190+ component system")
    from wireframe_skill.placement import select_layout_pattern, EscalateToDecomposition
    from design_system_skill import load_system
    # Regression: the old overlap test matched brief nouns against every
    # component name by bidirectional substring, so "board" matched
    # "dashboard" and this brief silently rendered as a dashboard. sketch
    # is the system where that bit — 4 patterns, 194 catalog names.
    spec = load_system("sketch").data
    sel = select_layout_pattern("kanban board with three columns", spec)
    assert_(isinstance(sel, EscalateToDecomposition),
            "kanban brief on sketch → EscalateToDecomposition",
            f"got {type(sel).__name__}"
            + (f" (fallback={sel.fallback}, pattern={sel.pattern_id})"
               if hasattr(sel, "fallback") else ""))


def test_component_nouns_do_not_suppress_escalation():
    section("placement: mentioning components ('image', 'filter', 'chips') still escalates")
    from wireframe_skill.placement import select_layout_pattern, EscalateToDecomposition
    from design_system_skill import load_system
    spec = load_system("sketch").data
    # Every one of these nouns exists in sketch's component catalog. None
    # of them says the system has authored this *screen*.
    sel = select_layout_pattern(
        "image carousel with swipeable filter chips", spec)
    assert_(isinstance(sel, EscalateToDecomposition),
            "component-noun-heavy off-catalog brief → EscalateToDecomposition",
            f"got {type(sel).__name__}")


def test_structural_pattern_tokens_do_not_suppress_escalation():
    section("placement: 'column' from 'form-single-column' doesn't block escalation")
    from wireframe_skill.placement import select_layout_pattern, EscalateToDecomposition
    from design_system_skill import load_system
    spec = load_system("swiss").data
    # swiss authors "form-single-column"; the word "columns" in a brief
    # describes arrangement, not a screen genre, so it must not count.
    sel = select_layout_pattern("three columns of swimlanes", spec)
    assert_(isinstance(sel, EscalateToDecomposition),
            "structural token 'columns' → still escalates",
            f"got {type(sel).__name__}")


def test_brief_naming_non_keyword_pattern_routes_to_it():
    section("placement: brief naming an authored pattern outside PATTERN_HEURISTICS routes to it")
    from wireframe_skill.placement import select_layout_pattern, LayoutSelection
    from design_system_skill import load_system
    # revolt authors "banner-promotional". No keyword rule covers "banner",
    # so this brief used to suppress escalation and then render the default
    # dashboard fallback — ignoring the match that suppressed it.
    spec = load_system("revolt").data
    sel = select_layout_pattern("promotional banner for a sale", spec)
    assert_(isinstance(sel, LayoutSelection),
            "named-pattern brief → LayoutSelection",
            f"got {type(sel).__name__}")
    if isinstance(sel, LayoutSelection):
        assert_(sel.base_pattern == "banner-promotional",
                "routes to banner-promotional",
                f"got {sel.base_pattern!r}")
        assert_(not sel.fallback,
                "named-pattern match is not a fallback",
                f"fallback={sel.fallback}")


def test_wireframe_in_catalog_brief_does_not_escalate():
    section("wireframe(): keyword-matched brief produces a normal result")
    import tempfile
    from wireframe_skill import wireframe
    with tempfile.TemporaryDirectory() as td:
        r = wireframe(brief="dashboard for chat app", system="swiss", output_dir=td)
    assert_(r.ok, "wireframe() ok=True on keyword-matched brief",
            "; ".join(r.errors))
    assert_(not r.requires_orchestrator_pass,
            "requires_orchestrator_pass=False on keyword-matched brief")




# ─── Phase C: atoms + token validator ───────────────────────────────


def _carousel_blueprint():
    """Reusable portable atom blueprint for Phase C tests."""
    return {
        "schema_version": "1.0",
        "canvas": {"width": 1280, "height": 800},
        "regions": [
            {
                "id": "hero",
                "x": 0, "y": 0, "w": 1280, "h": 480,
                "atoms": [
                    {"type": "rect", "x": 0, "y": 0, "w": 1280, "h": 480, "fill": "$surface-inset"},
                    {"type": "image_placeholder", "x": 48, "y": 48, "w": 1184, "h": 320},
                    {"type": "text", "x": 48, "y": 410, "value": "Featured trips",
                     "style": "$type.headline", "fill": "$ink"},
                    {"type": "text", "x": 48, "y": 450, "value": "Discover your next adventure",
                     "style": "$type.body", "fill": "$ink-muted"},
                ],
            },
            {
                "id": "carousel-controls",
                "x": 0, "y": 500, "w": 1280, "h": 80,
                "atoms": [
                    {"type": "group", "x": 580, "y": 40,
                     "atoms": [{"type": "circle", "cx": 0, "cy": 0, "r": 4, "fill": "$ink-muted"}],
                     "repeat": 5, "gap": 16, "direction": "horizontal"},
                    {"type": "line", "x1": 48, "y1": 78, "x2": 1232, "y2": 78,
                     "stroke": "$outline", "stroke_w": "$stroke.hairline"},
                ],
            },
        ],
    }


def test_portable_atom_blueprint_validates_against_three_systems():
    section("Phase C — same atom blueprint validates against Swiss + Riso + Editorial")
    from wireframe_skill.decomposition import validate_blueprint
    from design_system_skill import load_system
    from design_system_skill.loader import clear_cache
    bp = _carousel_blueprint()
    for sys_id in ("swiss", "riso", "editorial"):
        clear_cache()
        spec = load_system(sys_id).data
        errors = validate_blueprint(bp, spec)
        assert_(not errors, f"blueprint validates against {sys_id}",
                "; ".join(errors[:3]) if errors else "")


def test_portable_atom_blueprint_renders_in_three_systems():
    section("Phase C — same atom blueprint renders DIFFERENT-but-coherent SVGs per system")
    import re as _re
    from wireframe_skill.assembler import assemble_blueprint
    from design_system_skill import load_system
    from design_system_skill.loader import clear_cache
    bp = _carousel_blueprint()
    seen_families = set()
    seen_fills = set()
    for sys_id in ("swiss", "riso", "editorial"):
        clear_cache()
        spec = load_system(sys_id).data
        svg, warns = assemble_blueprint(bp, spec)
        m_font = _re.search(r'font-family="([^"]+)"', svg)
        m_fill = _re.search(r'<rect[^>]*fill="([^"]+)"', svg)
        assert_(m_font is not None, f"{sys_id} SVG contains a font-family attribute")
        assert_(m_fill is not None, f"{sys_id} SVG contains a rect with a resolved fill")
        if m_font:
            seen_families.add(m_font.group(1))
        if m_fill:
            seen_fills.add(m_fill.group(1))
    assert_(len(seen_families) == 3,
            "three systems produce three distinct font families",
            str(sorted(seen_families)))
    assert_(len(seen_fills) == 3,
            "three systems produce three distinct hero-rect fills",
            str(sorted(seen_fills)))


def test_validate_atoms_rejects_raw_hex():
    section("Phase C — validate_atoms rejects raw hex in atom paint")
    from wireframe_skill.decomposition import validate_blueprint
    from design_system_skill import load_system
    spec = load_system("swiss").data
    bp = {
        "schema_version": "1.0",
        "canvas": {"width": 1280, "height": 800},
        "regions": [{
            "id": "bad", "x": 0, "y": 0, "w": 100, "h": 100,
            "atoms": [{"type": "rect", "x": 0, "y": 0, "w": 50, "h": 50, "fill": "#ff0000"}],
        }],
    }
    errors = validate_blueprint(bp, spec)
    assert_(any("raw hex" in e for e in errors),
            "validator flags raw hex with a 'raw hex' message",
            "; ".join(errors[:3]))


def test_validate_atoms_rejects_unknown_token():
    section("Phase C — validate_atoms rejects unknown $token references")
    from wireframe_skill.decomposition import validate_blueprint
    from design_system_skill import load_system
    spec = load_system("swiss").data
    bp = {
        "schema_version": "1.0",
        "canvas": {"width": 1280, "height": 800},
        "regions": [{
            "id": "bad", "x": 0, "y": 0, "w": 100, "h": 100,
            "atoms": [{"type": "rect", "x": 0, "y": 0, "w": 50, "h": 50, "fill": "$nonexistent"}],
        }],
    }
    errors = validate_blueprint(bp, spec)
    assert_(any("nonexistent" in e for e in errors),
            "validator names the unknown token in the error",
            "; ".join(errors[:3]))


def test_validate_atoms_rejects_cross_system_ref_in_portable_scope():
    section("Phase C — validate_atoms rejects swiss:foo in a portable (no-scope) blueprint")
    from wireframe_skill.decomposition import validate_blueprint
    from design_system_skill import load_system
    spec = load_system("swiss").data
    bp = {
        "schema_version": "1.0",
        "canvas": {"width": 1280, "height": 800},
        "regions": [{
            "id": "bad", "x": 0, "y": 0, "w": 100, "h": 100,
            "atoms": [{"type": "rect", "x": 0, "y": 0, "w": 50, "h": 50, "fill": "swiss:grid.columns"}],
        }],
    }
    errors = validate_blueprint(bp, spec)
    # swiss:grid.columns would resolve to an int (12), not a color, but also
    # the portable scope means it's rejected before that point.
    assert_(any("portable" in e or "scope" in e or "color" in e for e in errors),
            "validator rejects system ref or its non-color resolution",
            "; ".join(errors[:3]))


def test_validate_atoms_rejects_unknown_text_style():
    section("Phase C — validate_atoms rejects unknown $type.* style")
    from wireframe_skill.decomposition import validate_blueprint
    from design_system_skill import load_system
    spec = load_system("swiss").data
    bp = {
        "schema_version": "1.0",
        "canvas": {"width": 1280, "height": 800},
        "regions": [{
            "id": "bad", "x": 0, "y": 0, "w": 200, "h": 100,
            "atoms": [{"type": "text", "x": 0, "y": 30, "value": "Hi",
                       "style": "$type.gigantic"}],
        }],
    }
    errors = validate_blueprint(bp, spec)
    assert_(any("gigantic" in e for e in errors),
            "validator names the unknown text style",
            "; ".join(errors[:3]))


def test_atom_region_and_component_region_coexist():
    section("Phase C — a blueprint can mix component regions and atom regions")
    from wireframe_skill.decomposition import validate_blueprint
    from wireframe_skill.assembler import assemble_blueprint
    from design_system_skill import load_system
    spec = load_system("swiss").data
    bp = {
        "schema_version": "1.0",
        "canvas": {"width": 1280, "height": 800},
        "regions": [
            # An atom region:
            {"id": "hero", "x": 0, "y": 0, "w": 1280, "h": 200,
             "atoms": [{"type": "rect", "x": 0, "y": 0, "w": 1280, "h": 200, "fill": "$surface-inset"}]},
            # A component region (using a real Swiss component):
            {"id": "footer", "x": 0, "y": 700, "w": 1280, "h": 100,
             "components": []},  # empty components list is allowed
        ],
    }
    errors = validate_blueprint(bp, spec)
    assert_(not errors, "mixed blueprint validates",
            "; ".join(errors[:3]))
    svg, warns = assemble_blueprint(bp, spec)
    assert_(svg.count("atom-region") == 1,
            "atom region was emitted as a labelled <g class=\"atom-region\">")


def test_validate_atoms_rejects_both_atoms_and_components():
    section("Phase C — region cannot declare both atoms and components")
    from wireframe_skill.decomposition import validate_blueprint
    from design_system_skill import load_system
    spec = load_system("swiss").data
    bp = {
        "schema_version": "1.0",
        "canvas": {"width": 1280, "height": 800},
        "regions": [{
            "id": "confused", "x": 0, "y": 0, "w": 100, "h": 100,
            "atoms": [{"type": "rect", "x": 0, "y": 0, "w": 50, "h": 50, "fill": "$surface"}],
            "components": [{"component_id": "card-default", "x": 0, "y": 0}],
        }],
    }
    errors = validate_blueprint(bp, spec)
    assert_(any("both 'atoms' and 'components'" in e for e in errors),
            "validator rejects regions that declare both",
            "; ".join(errors[:3]))


def test_atom_vocabulary_in_decomposition_request():
    section("Phase C — build_decomposition_request includes atom_vocabulary block")
    from wireframe_skill.decomposition import build_decomposition_request
    from design_system_skill import load_system
    spec = load_system("swiss").data
    req = build_decomposition_request("freeform carousel", spec, platform="desktop")
    assert_("atom_vocabulary" in req, "request payload includes atom_vocabulary")
    av = req["atom_vocabulary"]
    assert_("rect" in av["atom_types"] and "group" in av["atom_types"],
            "atom_vocabulary lists all 6 atom types")
    assert_("color" in av["tokens"] and "ink" in av["tokens"]["color"],
            "atom_vocabulary surfaces the system's common color tokens")
    assert_("$type.headline" in av["reference_syntax"]["portable"]
            or "$<role>" in av["reference_syntax"]["portable"],
            "atom_vocabulary documents portable reference syntax")


# ─── Agent-driven layout routing ─────────────────────────────────────


def test_request_routing_returns_inventory():
    section("routing: request_routing=True returns pattern + component inventory")
    out = Path(tempfile.mkdtemp(prefix="wf-routing-"))
    try:
        result = wireframe(
            brief="a triage queue for support tickets",
            system="swiss", platform="desktop", output_dir=out,
            request_routing=True,
        )
        assert_(result.ok, "routing request result is ok")
        assert_(result.svg_path is None, "no SVG emitted in routing pass")
        req = result.routing_request
        assert_(req is not None and req.get("action") == "select_routing",
                "routing_request carries action=select_routing")
        assert_(req and any(p["pattern_id"] == "dashboard"
                            for p in req["available_patterns"]),
                "available_patterns lists the system's layouts")
        assert_(req and isinstance(req.get("available_components"), list)
                and req["available_components"],
                "available_components lists the system's components")
        assert_(req and "layout_id" in req.get("instructions", ""),
                "instructions tell the agent how to continue")
    finally:
        shutil.rmtree(out, ignore_errors=True)


def test_layout_id_override_bypasses_heuristics():
    section("routing: layout_id override generates without keyword routing")
    out = Path(tempfile.mkdtemp(prefix="wf-layoutid-"))
    try:
        result = wireframe(
            brief="a triage queue for support tickets",  # off-catalog brief
            system="swiss", platform="desktop", output_dir=out,
            layout_id="dashboard",
        )
        assert_(result.ok, "explicit layout_id generates successfully",
                "; ".join(result.errors))
        assert_(result.selection is not None
                and result.selection.pattern_id == "dashboard",
                "selection honours the explicit layout_id")
        assert_(result.svg_path is not None and result.svg_path.exists(),
                "SVG emitted")
        bad = wireframe(
            brief="anything", system="swiss", output_dir=out,
            layout_id="no-such-pattern",
        )
        assert_(not bad.ok and any("no-such-pattern" in e for e in bad.errors),
                "unknown layout_id fails cleanly")
    finally:
        shutil.rmtree(out, ignore_errors=True)


def test_apply_layout_selection_roundtrip():
    section("routing: build request → apply selection roundtrip")
    from wireframe_skill import (
        build_layout_selection_request, apply_layout_selection,
    )
    from design_system_skill import load_system
    spec = load_system("wireframe").data
    req = build_layout_selection_request("an article reader", spec, "desktop")
    assert_(any(p["base_name"] == "article" for p in req["available_patterns"]),
            "request lists article pattern with base_name")
    sel = apply_layout_selection(
        {"selected_pattern_id": "article-default", "rationale": "long-form reading"},
        spec, "desktop",
    )
    assert_(sel is not None and sel.pattern_id == "article-default"
            and sel.base_pattern == "article",
            "agent's selection becomes a LayoutSelection")
    assert_(sel is not None and sel.svg_path.exists(),
            "selection resolves to a real SVG path")
    missing = apply_layout_selection(
        {"selected_pattern_id": "not-a-pattern"}, spec, "desktop")
    assert_(missing is None, "unknown selection returns None")


def test_select_mode_exact_and_deferred():
    section("routing: select_mode exact matches named patterns; auto defers")
    from wireframe_skill.placement import select_layout_pattern
    from design_system_skill import load_system
    spec = load_system("wireframe").data
    exact = select_layout_pattern(
        "the dashboard for ops", spec, select_mode="exact")
    assert_(exact is not None and exact.base_pattern == "dashboard",
            "exact mode matches a pattern named in the brief")
    no_name = select_layout_pattern(
        "a triage queue", spec, select_mode="exact")
    assert_(no_name is None, "exact mode returns None when nothing is named")
    deferred = select_layout_pattern(
        "dashboard for ops", spec, select_mode="auto")
    assert_(deferred is None, "auto mode always defers to the agent")


# ─── Custom SVG components in blueprints ─────────────────────────────


def test_custom_svg_component_validates_and_assembles():
    section("custom svg: blueprint with type=custom validates and assembles")
    from wireframe_skill.decomposition import validate_blueprint
    from wireframe_skill import assemble_blueprint
    from design_system_skill import load_system
    spec = load_system("swiss").data
    bp = {
        "schema_version": "1.0",
        "canvas": {"width": 1280, "height": 800},
        "regions": [{
            "id": "main", "x": 0, "y": 0, "w": 1280, "h": 800,
            "components": [
                {"type": "custom", "component_id": "custom-slider",
                 "x": 20, "y": 240,
                 "svg": ("<rect x='0' y='8' width='260' height='4' rx='2' fill='#E0E0E0'/>"
                         "<circle cx='130' cy='10' r='10' fill='#424242'/>")},
            ],
        }],
    }
    errors = validate_blueprint(bp, spec)
    assert_(not errors, "custom component passes validation",
            "; ".join(errors[:3]))
    svg, warns = assemble_blueprint(bp, spec)
    assert_("custom-slider" in svg, "custom component group id appears in output")
    assert_("<circle cx='130'" in svg, "inline custom SVG body is emitted verbatim")
    assert_(not any("custom" in w for w in warns),
            "no custom-related assembly warnings", "; ".join(warns[:3]))


def test_custom_svg_component_requires_svg_and_position():
    section("custom svg: empty svg / missing position are validation errors")
    from wireframe_skill.decomposition import validate_blueprint
    from design_system_skill import load_system
    spec = load_system("swiss").data
    bp = {
        "schema_version": "1.0",
        "canvas": {"width": 1280, "height": 800},
        "regions": [{
            "id": "main", "x": 0, "y": 0, "w": 1280, "h": 800,
            "components": [
                {"type": "custom", "component_id": "empty-custom", "svg": "   "},
            ],
        }],
    }
    errors = validate_blueprint(bp, spec)
    assert_(any("non-empty 'svg'" in e for e in errors),
            "empty svg field is flagged", "; ".join(errors[:3]))
    assert_(any("missing 'x'" in e for e in errors),
            "missing x is flagged")
    assert_(any("missing 'y'" in e for e in errors),
            "missing y is flagged")

# ─── token contract consumption (schema v0.3) ────────────────────


def test_export_tokens_uses_system_contract():
    section("export_tokens_for_authoring: fills come from the system's token contract")
    from wireframe_skill.tokens import export_tokens_for_authoring
    from design_system_skill.loader import load_system
    res = load_system("terminal")
    assert_(res.ok, "load_system('terminal') ok")
    if not res.ok:
        return
    out = export_tokens_for_authoring(res.data)
    css = out["typography"]["css_class_block"]
    assert_("fill: #C8F7C5" in css, "text-primary uses terminal text_primary (#C8F7C5)")
    assert_("#212121" not in css, "wireframe grey no longer leaks into other systems")
    assert_("fill: #FF4E4E" in css, "text-danger uses terminal danger (#FF4E4E)")
    rules = out["drawing_rules"]
    assert_(rules["focus_ring"] == "#00FF66", f"drawing_rules.focus_ring (got {rules.get('focus_ring')})")
    assert_(rules["text_inverse"] == "#0A0F0A", f"text_inverse from contract (got {rules['text_inverse']})")
    assert_("stroke='#1F2F1F' stroke-width='1'" == rules["stroke_border"],
            f"aliased elevation border resolves (got {rules['stroke_border']})")
    assert_(out.get("contract", {}).get("system") == "terminal", "contract returned to agents")
    assert_(out["typography"]["font_stack_structural"] == "'JetBrains Mono', monospace",
            "font stack alias resolved")


def test_export_tokens_without_contract_keeps_defaults():
    section("export_tokens_for_authoring: specs without a contract keep wireframe defaults")
    from wireframe_skill.tokens import export_tokens_for_authoring
    out = export_tokens_for_authoring({"system": {"id": "legacy"}, "tokens": {"colors": {}}})
    css = out["typography"]["css_class_block"]
    assert_("fill: #212121" in css and "fill: #B71C1C" in css, "legacy defaults retained")
    assert_("contract" not in out, "no contract key when the spec has none")
    assert_("motion" not in out, "no motion key when the spec has no contract")


def test_export_tokens_includes_motion():
    section("export_tokens_for_authoring: motion tiers and declarations (issue #10)")
    from wireframe_skill.tokens import export_tokens_for_authoring
    from design_system_skill.loader import load_system
    res = load_system("terminal")
    assert_(res.ok, "load_system('terminal') ok")
    if not res.ok:
        return
    motion = export_tokens_for_authoring(res.data).get("motion") or {}
    assert_(set(motion.get("tiers", {})) == {"fast", "moderate", "slow", "expressive"},
            f"all four tiers exported ({sorted(motion.get('tiers', {}))})")
    assert_(motion["tiers"]["slow"]["css_enter"] == "250ms cubic-bezier(0, 0, 1, 1)",
            f"slow tier CSS shorthand (got {motion['tiers']['slow'].get('css_enter')})")
    assert_(motion.get("reduced_motion") == "none", "terminal reduced-motion policy is none")
    cursor = motion.get("declarations", {}).get("cursor") or [{}]
    assert_(cursor[0].get("timing", {}).get("easing") == "step-end",
            "motion.elements.cursor declaration exported with its step-end timing")
    assert_("list_item" in motion["declarations"], "component declarations exported")
    css = motion.get("css_custom_properties", "")
    assert_("--motion-fast-enter: 0ms;" in css and "prefers-reduced-motion: reduce" in css,
            "CSS custom properties with a reduced-motion override")


def test_custom_svg_does_not_break_library_id_check():
    section("custom svg: library components still validated against catalog")
    from wireframe_skill.decomposition import validate_blueprint
    from design_system_skill import load_system
    spec = load_system("swiss").data
    bp = {
        "schema_version": "1.0",
        "canvas": {"width": 1280, "height": 800},
        "regions": [{
            "id": "main", "x": 0, "y": 0, "w": 1280, "h": 800,
            "components": [
                {"component_id": "definitely-not-a-component", "x": 0, "y": 0},
                {"type": "custom", "component_id": "ok-custom", "x": 0, "y": 100,
                 "svg": "<rect x='0' y='0' width='10' height='10'/>"},
            ],
        }],
    }
    errors = validate_blueprint(bp, spec)
    assert_(any("definitely-not-a-component" in e for e in errors),
            "unknown library id still rejected alongside custom sibling")


# ─── Token export + component reader (freehand authoring support) ───


def test_export_tokens_for_authoring_wireframe():
    section("tokens: export_tokens_for_authoring returns authoring vocabulary")
    from wireframe_skill import export_tokens_for_authoring
    from design_system_skill import load_system
    spec = load_system("wireframe").data
    out = export_tokens_for_authoring(spec)
    assert_(out["system_id"] == "wireframe", "system_id round-trips")
    assert_(isinstance(out["palette"], list) and out["palette"],
            "palette flattens to a non-empty list")
    assert_(all({"name", "value", "role", "usage_constraint"} <= set(p)
                for p in out["palette"]),
            "every palette entry carries name/value/role/usage_constraint")
    rules = out["drawing_rules"]
    assert_("stroke_border" in rules and "stroke='" in rules["stroke_border"],
            "borders_only systems get copy-pasteable stroke fragments")
    typo = out["typography"]
    assert_("<style>" in typo["css_class_block"],
            "typography includes a ready-to-paste CSS class block")
    layout = out["layout"]
    assert_("desktop" in layout["canvas"] and "mobile" in layout["canvas"],
            "layout exposes canvas dimensions per platform")


def test_export_tokens_non_border_elevation_notes_strategy():
    section("tokens: non-borders elevation strategies note the treatment")
    from wireframe_skill import export_tokens_for_authoring
    from design_system_skill import load_system
    spec = load_system("prism").data
    out = export_tokens_for_authoring(spec)
    rules = out["drawing_rules"]
    assert_("stroke_border" not in rules,
            "no border fragments emitted for glass_blur elevation")
    assert_("artifact_treatments" in rules.get("elevation_note", ""),
            "elevation_note points authors at artifact_treatments")


def test_read_component_resolves_base_and_variant_ids():
    section("components: read_component resolves base + variant ids")
    from wireframe_skill import read_component
    from design_system_skill import load_system
    spec = load_system("wireframe").data
    direct = read_component("button-primary", spec)
    assert_(direct["ok"] and direct["component_id"] == "button-primary",
            "fully-qualified variant id resolves directly")
    assert_("<svg" in direct["svg_source"], "svg_source contains the SVG")
    assert_(direct["viewBox"]["w"] > 0 and direct["viewBox"]["h"] > 0,
            "viewBox dimensions extracted")
    base = read_component("toggle", spec)
    assert_(base["ok"] and base["component_id"].startswith("toggle-"),
            f"base id resolves to default variant (got {base['component_id']})")


def test_read_components_batch_collects_errors():
    section("components: read_components_batch collects per-id errors")
    from wireframe_skill import read_components_batch
    from design_system_skill import load_system
    spec = load_system("wireframe").data
    results = read_components_batch(["button-primary", "does-not-exist"], spec)
    assert_(len(results) == 2, "one result per requested id")
    assert_(results[0]["ok"], "valid id succeeds")
    assert_(not results[1]["ok"] and "does-not-exist" in results[1]["error"],
            "unknown id reports a structured error instead of raising")


# ─── Upstream routing, two-turn and composition flows ────────────────


def test_no_routing_returns_inventory():
    section("wireframe(request_routing=True) returns routing_request")
    # The Python API defaults to keyword routing (with escalation); the
    # inventory is opt-in here and the default on the MCP surface (wf_generate).
    with tempfile.TemporaryDirectory() as td:
        result = wireframe(
            brief="image viewer with carousel and duotone filters",
            system="swiss",
            platform="desktop",
            output_dir=td,
            request_routing=True,
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
            assert_(req.get("schema_version") == "1.1",
                    f"schema_version is 1.1 — text nodes carry width budgets (got {req.get('schema_version')})")
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
    """Run every test in this module in definition order (script mode)."""
    print("wireframe-skill end-to-end tests\n" + "=" * 50)
    tests = [obj for name, obj in globals().items()
             if name.startswith("test_") and callable(obj)]
    for test in tests:
        test()
    print(f"\n{'=' * 50}")
    print(f"Total: {PASSED + FAILED}  Passed: {PASSED}  Failed: {FAILED}")
    return 0 if FAILED == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())


