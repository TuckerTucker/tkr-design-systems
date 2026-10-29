"""Smoke tests for design-system-skill.

Run from the project root:
    python3 design-system-skill/test_design_system_skill.py

The tests use the canonical 8 system specs already on disk as fixtures.
They confirm:
  - All 8 registered systems load + validate
  - list_systems returns the expected ids
  - get_rulebook returns scoped rulebook entries
  - check_compliance against the Swiss + wireframe libraries reports
    the same clean counts as `tooling/rulebook_check.py --batch`
  - rulebook exceptions: waivers pass and are reported, reasons are
    required, stale entries fail, out-of-run entries are ignored
  - register/unregister round-trip preserves the registry
  - validate_spec catches obvious schema violations on a synthetic bad spec
"""

from __future__ import annotations
import json
import shutil
import sys
import tempfile
from pathlib import Path

# Make the package importable when running this script directly.
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

# Canonical layout: libraries + registry.yaml live at <repo>/systems.
SYSTEMS_DIR = HERE.parents[1] / "systems"

# Hermetic isolation: pin the user-registry overlay to a path that does not
# exist so the developer's real ~/.claude/design-systems/registry.yaml cannot
# leak entries into these tests (conftest.py does the same under pytest;
# this covers running the file as a script). The overlay tests below
# mutate this sandbox and clean it up.
import os  # noqa: E402
if "pytest" not in sys.modules:
    _USER_REG_SANDBOX = Path(tempfile.mkdtemp(prefix="dss-test-user-reg-")) / "registry.yaml"
    os.environ["DESIGN_SYSTEM_SKILL_USER_REGISTRY"] = str(_USER_REG_SANDBOX)

from design_system_skill import (  # noqa: E402
    load_system,
    list_systems,
    validate_spec,
    register_system,
    unregister_system,
    get_rulebook,
    check_compliance,
)
from design_system_skill.loader import clear_cache  # noqa: E402


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


# ─── test: list_systems ─────────────────────────────────────────────

def test_list_systems():
    section("list_systems")
    res = list_systems()
    assert_(res.ok, "list_systems returns ok=True")
    ids = [d["id"] for d in res.data] if res.ok else []
    # `neutral` is a registry alias of the wireframe library.
    expected = {"wireframe", "swiss", "terminal", "editorial",
                "sketch", "prism", "revolt", "riso", "neutral"}
    assert_(set(ids) == expected,
            f"all 9 expected systems present (got {sorted(ids)})")
    for d in res.data:
        assert_(d["status"] == "available",
                f"system '{d['id']}' has status='available' (got {d['status']})")
        assert_(d["spec_version"] in ("0.1", "0.2", "0.3"),
                f"system '{d['id']}' spec_version is 0.1, 0.2 or 0.3 (got {d['spec_version']})")


# ─── test: load_system ──────────────────────────────────────────────

def test_load_system():
    section("load_system")
    for sys_id in ["wireframe", "swiss", "terminal", "editorial",
                   "sketch", "prism", "revolt", "riso"]:
        res = load_system(sys_id)
        assert_(res.ok, f"load_system('{sys_id}') returns ok=True",
                json.dumps(res.to_dict(), default=str)[:300])
        if not res.ok:
            continue
        spec = res.data
        assert_("_meta" in spec, f"load_system('{sys_id}') spec has _meta block")
        assert_(spec["_meta"]["system_id"] == sys_id,
                f"load_system('{sys_id}') _meta.system_id matches")
        assert_(spec["_meta"]["spec_version"] in ("0.1", "0.2", "0.3"),
                f"load_system('{sys_id}') _meta.spec_version is set")


def test_load_unknown():
    section("load_system unknown id")
    res = load_system("does_not_exist")
    assert_(not res.ok, "load_system on unknown id returns ok=False")
    if not res.ok:
        codes = [e.code for e in res.errors]
        assert_("SYSTEM_NOT_FOUND" in codes,
                f"error code is SYSTEM_NOT_FOUND (got {codes})")


def test_load_resolves_svg_paths():
    section("load_system resolves svg paths")
    res = load_system("swiss")
    assert_(res.ok, "swiss spec loads")
    if not res.ok:
        return
    components = res.data.get("components") or {}
    list_item = components.get("list_item") or {}
    variants = list_item.get("variants") or []
    has_resolved = any(
        "svg_path" in v and Path(v["svg_path"]).exists()
        for v in variants if isinstance(v, dict)
    )
    assert_(has_resolved, "list_item variants have resolved svg_path that exists on disk")


# ─── test: validate_spec ───────────────────────────────────────────

def test_validate_existing_specs():
    section("validate_spec on canonical specs")
    project = SYSTEMS_DIR
    spec_paths = [
        ("swiss", "swiss/spec.yaml"),
        ("wireframe", "wireframe/spec.yaml"),
        ("terminal", "terminal/spec.yaml"),
        ("editorial", "editorial/spec.yaml"),
        ("sketch", "sketch/spec.yaml"),
        ("prism", "prism/spec.yaml"),
        ("revolt", "revolt/spec.yaml"),
        ("riso", "riso/spec.yaml"),
    ]
    for sys_id, spec_rel in spec_paths:
        path = project / spec_rel
        if not path.exists():
            print(f"  SKIP  spec not found: {path}")
            continue
        res = validate_spec(path, library_root=str(path.parent))
        assert_(res.ok, f"validate_spec({sys_id}) returns ok=True",
                "; ".join(e.message for e in res.errors)[:300] if not res.ok else "")


def test_validate_synthetic_bad_spec():
    section("validate_spec catches bad specs")
    with tempfile.NamedTemporaryFile(suffix="-spec.yaml", mode="w", delete=False) as f:
        f.write("""\
spec_version: "0.99"
system:
  id: bad
  grammar_family: unknown_family
tokens: {}
rulebook:
  - id: bad-rule
    severity: catastrophic
    check_method: psychic
    check_scope: orbital
""")
        bad_path = f.name
    res = validate_spec(bad_path)
    assert_(not res.ok, "validate_spec catches multiple violations")
    if not res.ok:
        msgs = " | ".join(e.message for e in res.errors)
        # grammar_family is now advisory (warning), not blocking (error)
        for needle in ["spec_version",
                       "severity", "check_method", "check_scope", "system.name"]:
            assert_(needle in msgs,
                    f"error message mentions '{needle}' (msgs: {msgs[:200]})")
        # grammar_family should be in warnings, not errors
        if res.data and res.data.get("warnings"):
            warn_msgs = " | ".join(w["message"] for w in res.data["warnings"])
            assert_("grammar_family" in warn_msgs,
                    f"grammar_family produces advisory warning (warn_msgs: {warn_msgs[:200]})")
    Path(bad_path).unlink(missing_ok=True)


def test_unknown_grammar_family_is_advisory():
    section("validate_spec: unknown grammar_family is advisory")
    with tempfile.NamedTemporaryFile(suffix="-spec.yaml", mode="w", delete=False) as f:
        f.write("""\
spec_version: "0.2"
system:
  id: future_sys
  name: Future System
  grammar_family: spatial_immersive
tokens: {}
""")
        p = f.name
    res = validate_spec(p)
    Path(p).unlink(missing_ok=True)
    assert_(res.ok, "spec with unknown grammar_family is valid (ok=True)")
    if res.data:
        warn_msgs = " | ".join(w["message"] for w in res.data.get("warnings", []))
        assert_("spatial_immersive" in warn_msgs,
                f"warning mentions the unknown family ({warn_msgs[:200]})")


def test_unknown_elevation_strategy_is_advisory():
    section("validate_spec: unknown elevation.strategy is advisory")
    with tempfile.NamedTemporaryFile(suffix="-spec.yaml", mode="w", delete=False) as f:
        f.write("""\
spec_version: "0.2"
system:
  id: future_sys
  name: Future System
tokens:
  elevation:
    strategy: neon_glow
""")
        p = f.name
    res = validate_spec(p)
    Path(p).unlink(missing_ok=True)
    assert_(res.ok, "spec with unknown elevation.strategy is valid (ok=True)")
    if res.data:
        warn_msgs = " | ".join(w["message"] for w in res.data.get("warnings", []))
        assert_("neon_glow" in warn_msgs,
                f"warning mentions the unknown strategy ({warn_msgs[:200]})")


def test_unknown_selection_signal_is_advisory():
    section("validate_spec: unknown selection_signal is advisory")
    with tempfile.NamedTemporaryFile(suffix="-spec.yaml", mode="w", delete=False) as f:
        f.write("""\
spec_version: "0.2"
system:
  id: future_sys
  name: Future System
tokens: {}
components:
  nav_tab:
    anatomy: []
    variants:
      - id: active
        svg: dummy.svg
        selection_signal: glow_underline
""")
        p = f.name
    res = validate_spec(p)
    Path(p).unlink(missing_ok=True)
    assert_(res.ok, "spec with unknown selection_signal is valid (ok=True)")
    if res.data:
        warn_msgs = " | ".join(w["message"] for w in res.data.get("warnings", []))
        assert_("glow_underline" in warn_msgs,
                f"warning mentions the unknown signal ({warn_msgs[:200]})")


# ─── test: get_rulebook ────────────────────────────────────────────

def test_get_rulebook():
    section("get_rulebook")
    res = get_rulebook("swiss")
    assert_(res.ok, "get_rulebook('swiss') returns ok=True")
    rules = res.data
    assert_(len(rules) == 14, f"swiss has 14 rulebook entries (got {len(rules)})")
    rule_ids = {r["id"] for r in rules}
    assert_("swiss-red-finite-resource" in rule_ids,
            "swiss rulebook includes red-finite-resource")
    for r in rules:
        assert_(r["check_scope"] in (None, "artifact", "component", "both"),
                f"rule {r['id']} check_scope is valid (got {r['check_scope']})")


# ─── test: check_compliance ────────────────────────────────────────

def test_check_compliance_swiss_component():
    section("check_compliance against swiss component")
    project = SYSTEMS_DIR
    artifact = project / "swiss" / "components" / "list-item-default.svg"
    if not artifact.exists():
        print(f"  SKIP  artifact not found: {artifact}")
        return
    res = check_compliance("swiss", artifact)
    assert_(res.ok, "check_compliance returns ok=True")
    if not res.ok:
        return
    assert_(res.data["failed"] == 0,
            f"no failures (got {res.data['failed']}: {[r['rule_id'] for r in res.data['results'] if r['status']=='fail']})")
    assert_(res.data["scope"] == "component",
            f"scope auto-detected as component (got {res.data['scope']})")


_SWISS_STYLE = (
    "<defs><style>.text-primary { fill: #000000; } "
    ".text-accent { fill: #E3000B; }</style></defs>"
)


def _swiss_svg(body: str, banner: str = "") -> str:
    """Build a minimal Swiss SVG fragment with the builder class styles.

    Args:
        body: Inner SVG markup.
        banner: Optional builder banner name (e.g. ``TOAST-ERROR``).

    Returns:
        SVG source text.
    """
    comment = f"<!-- ==================== {banner} ==================== -->" if banner else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 64">'
            f"{_SWISS_STYLE}{comment}{body}</svg>")


def test_swiss_error_prefix_rule():
    section("swiss-error-prefix: error copy reads 'Error: <what failed>.'")
    rb = _rb()
    good = _swiss_svg('<text class="text-primary">Error: send failed.</text>')
    res = rb.check_error_prefix(good)
    assert_(res["rule_id"] == "swiss-error-prefix" and res["passed"],
            f"'Error: send failed.' passes (got {res})")

    for bad in ("ERROR", "error: send failed.", "Error - send failed.",
                "Error: send failed", "Error:send failed.", "Errors: two failed."):
        res = rb.check_error_prefix(_swiss_svg(f'<text class="text-primary">{bad}</text>'))
        if bad == "Errors: two failed.":
            assert_(res["passed"], "'Errors' is not the word 'error' and is not checked")
            continue
        assert_(not res["passed"] and len(res["violations"]) == 1,
                f"{bad!r} fails (got {res['violations']})")

    nested = _swiss_svg('<text class="text-primary"><tspan>Error:</tspan> '
                        "<tspan>save failed.</tspan></text>")
    assert_(rb.check_error_prefix(nested)["passed"], "tspans are flattened before matching")

    plain = _swiss_svg('<text class="text-primary">Sent.</text>')
    res = rb.check_error_prefix(plain)
    assert_(res["passed"] and res["vacuous"], "a fragment with no error copy passes vacuously")

    missing = _swiss_svg('<text class="text-primary">Could not connect.</text>', "TOAST-ERROR")
    res = rb.check_error_prefix(missing)
    assert_(not res["passed"] and res["error_component"]
            and any("missing prefix" in v for v in res["violations"]),
            f"an error component without the prefix fails (got {res})")
    field = _swiss_svg('<text class="text-primary">Error: invalid email address.</text>',
                       "FORM-FIELD-WITH-ERROR")
    assert_(rb.check_error_prefix(field)["passed"], "an error component with the prefix passes")
    other = _swiss_svg('<text class="text-primary">Could not connect.</text>', "TOAST-INFO")
    assert_(rb.check_error_prefix(other)["passed"], "a non-error banner is not an error component")


def test_swiss_error_not_red_rule():
    section("swiss-error-not-red: 'Error:' copy is ink, never the accent red")
    rb = _rb()
    ink = _swiss_svg('<text class="text-primary">Error: send failed.</text>')
    assert_(rb.check_error_not_red(ink)["passed"], "ink error copy passes")
    by_class = _swiss_svg('<text class="text-accent">Error: send failed.</text>')
    res = rb.check_error_not_red(by_class)
    assert_(not res["passed"] and res["rule_id"] == "swiss-error-not-red",
            f"red via CSS class fails (got {res})")
    inline = _swiss_svg('<text fill="#e3000b">Error: send failed.</text>')
    assert_(not rb.check_error_not_red(inline)["passed"], "red via inline fill fails")
    cta = _swiss_svg('<text class="text-accent">Retry →</text>')
    assert_(rb.check_error_not_red(cta)["passed"], "a red CTA label is not error copy")


def test_swiss_library_follows_error_treatment():
    section("swiss library: error components follow the spec's error treatment")
    rb = _rb()
    ids = {fn.__name__ for fn, _ in rb.CHECKS_BY_RULESET["swiss"]}
    assert_({"check_error_prefix", "check_error_not_red"} <= ids,
            "the swiss ruleset runs both error checks")
    rule_ids = {r["id"] for r in get_rulebook("swiss").data}
    assert_({"swiss-error-prefix", "swiss-error-not-red", "swiss-error-typographic"} <= rule_ids,
            "spec.yaml rulebook declares the three error rules")
    for name in ("form-field-with-error", "toast-error"):
        svg = (SYSTEMS_DIR / "swiss" / "components" / f"{name}.svg").read_text()
        prefix = rb.check_error_prefix(svg)
        assert_(prefix["passed"] and prefix["error_component"],
                f"{name} carries 'Error:' copy (got {prefix['violations']})")
        assert_(rb.check_error_not_red(svg)["passed"], f"{name} error copy is not red")


def test_swiss_warning_not_red_rule():
    section("swiss-warning-not-red: warning labels and copy are never red")
    rb = _rb()
    grey = _swiss_svg('<text class="text-primary">ATTENTION</text>'
                      '<text class="text-primary">Your trial ends in 3 days.</text>'
                      '<text class="text-accent">Upgrade →</text>', "BANNER-WARNING")
    res = rb.check_warning_not_red(grey)
    assert_(res["passed"] and res["warning_component"],
            f"ink warning with a red CTA passes (got {res})")
    red_label = _swiss_svg('<text class="text-accent">ATTENTION</text>', "BANNER-WARNING")
    res = rb.check_warning_not_red(red_label)
    assert_(not res["passed"] and res["rule_id"] == "swiss-warning-not-red",
            f"a red ATTENTION label fails (got {res})")
    for word in ("Warning: disk almost full.", "CAUTION", "alert — quota"):
        res = rb.check_warning_not_red(_swiss_svg(f'<text fill="#E3000B">{word}</text>'))
        assert_(not res["passed"], f"a red severity word fails outside warning components: {word!r}")
    red_copy = _swiss_svg('<text class="text-accent">Your trial ends in 3 days.</text>',
                          "BANNER-WARNING")
    assert_(not rb.check_warning_not_red(red_copy)["passed"],
            "red message copy in a warning component fails")
    cta = _swiss_svg('<text class="text-accent">Sign in →</text>', "AUTH-SIGN-IN")
    assert_(rb.check_warning_not_red(cta)["passed"], "a red CTA elsewhere is not a warning")
    ids = {fn.__name__ for fn, _ in rb.CHECKS_BY_RULESET["swiss"]}
    assert_("check_warning_not_red" in ids, "the swiss ruleset runs the warning check")
    rule_ids = {r["id"] for r in get_rulebook("swiss").data}
    assert_("swiss-warning-not-red" in rule_ids, "spec.yaml rulebook declares the warning rule")
    svg = (SYSTEMS_DIR / "swiss" / "components" / "banner-warning.svg").read_text()
    res = rb.check_warning_not_red(svg)
    assert_(res["passed"] and res["warning_component"],
            f"the library banner-warning follows the rule (got {res['violations']})")
    for name in ("dropdown-default", "dropdown-with-groups"):
        svg = (SYSTEMS_DIR / "swiss" / "components" / f"{name}.svg").read_text()
        assert_("Sign out" in svg and 'class="text-accent" font-size="13">Sign out' not in svg,
                f"{name}: Sign out is ink, not red")


_REVOLT_STYLE = (
    "<defs><style>.text-primary { fill: #111111; } "
    ".text-on-danger { fill: #111111; } .text-pink { fill: #FF3366; }</style></defs>"
)
_REVOLT_PILL = ('<rect x="6" y="4" width="50" height="18" fill="#FF3366" stroke="#111111" '
                'stroke-width="2"/><text x="31" y="16" class="text-on-danger" font-size="9" '
                'font-weight="700">ERROR</text>')


def _revolt_svg(body: str, banner: str = "") -> str:
    """Build a minimal Revolt SVG fragment with builder-style class fills.

    Args:
        body: Inner SVG markup.
        banner: Optional builder banner name (e.g. ``TOAST-ERROR``).

    Returns:
        SVG source text.
    """
    comment = f"<!-- ==================== {banner} ==================== -->" if banner else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 44">'
            f"{_REVOLT_STYLE}{comment}{body}</svg>")


def test_revolt_pink_not_text_rule():
    section("revolt-pink-not-text: pink is a fill, never a text colour")
    rb = _rb()
    assert_(rb.REVOLT_PINK == "#FF3366" and rb.REVOLT_DANGER == rb.REVOLT_PINK,
            "danger reuses the accent pink (five-colour palette, ADR-0002)")
    ok = _revolt_svg(_REVOLT_PILL + '<text class="text-primary">Something failed.</text>')
    assert_(rb.check_revolt_pink_not_text(ok)["passed"], "black text on a pink pill passes")
    for bad in ('<text fill="#ff3366">ERROR</text>', '<text class="text-pink">ERROR</text>',
                '<text class="text-primary">LABEL <tspan fill="#FF3366">*</tspan></text>'):
        res = rb.check_revolt_pink_not_text(_revolt_svg(bad))
        assert_(not res["passed"] and res["rule_id"] == "revolt-pink-not-text"
                and len(res["violations"]) == 1, f"pink text fails: {bad} (got {res})")


def test_revolt_error_pill_rule():
    section("revolt-error-status: error components carry the ERROR status pill")
    rb = _rb()
    res = rb.check_revolt_error_pill(_revolt_svg(_REVOLT_PILL, "TOAST-ERROR"))
    assert_(res["passed"] and not res["vacuous"], f"the pill passes (got {res})")
    plain = _revolt_svg('<text class="text-primary">Profile saved.</text>', "TOAST-INFO")
    assert_(rb.check_revolt_error_pill(plain)["vacuous"], "a non-error component is vacuous")
    old = _revolt_svg('<text fill="#FF3366" font-size="8" font-weight="700">ERROR</text>',
                      "BANNER-ERROR")
    res = rb.check_revolt_error_pill(old)
    assert_(not res["passed"] and len(res["violations"]) == 2,
            f"a pink ERROR word without the pill fails (got {res})")
    border_only = _revolt_svg('<rect width="200" height="28" fill="#FFFFFF" stroke="#FF3366" '
                              'stroke-width="2"/><text class="text-primary" font-size="8">'
                              "ERROR // INVALID</text>", "FORM-FIELD-WITH-ERROR")
    assert_(not rb.check_revolt_error_pill(border_only)["passed"],
            "a pink input border alone is not an error treatment")
    rounded = _revolt_svg(_REVOLT_PILL.replace('stroke-width="2"', 'stroke-width="2" rx="4"'),
                          "TOAST-ERROR")
    assert_(not rb.check_revolt_error_pill(rounded)["passed"], "a rounded pill fails")


def test_revolt_library_follows_error_treatment():
    section("revolt library: error components use the pill, no pink text")
    rb = _rb()
    ids = {fn.__name__ for fn, _ in rb.CHECKS_BY_RULESET["revolt"]}
    assert_({"check_revolt_pink_not_text", "check_revolt_error_pill"} <= ids,
            "the revolt ruleset runs both checks")
    rule_ids = {r["id"] for r in get_rulebook("revolt").data}
    assert_({"revolt-error-status", "revolt-pink-not-text"} <= rule_ids,
            "spec.yaml rulebook declares both rules")
    for name in ("banner-error", "toast-error", "form-field-with-error", "label-required",
                 "button-danger"):
        svg = (SYSTEMS_DIR / "revolt" / "components" / f"{name}.svg").read_text()
        assert_(rb.check_revolt_pink_not_text(svg)["passed"], f"{name} has no pink text")
        pill = rb.check_revolt_error_pill(svg)
        assert_(pill["passed"], f"{name} follows revolt-error-status (got {pill['violations']})")
        if name != "label-required" and name != "button-danger":
            assert_(not pill["vacuous"], f"{name} is checked as an error component")


def test_check_compliance_wireframe_pattern():
    section("check_compliance against wireframe pattern")
    project = SYSTEMS_DIR
    artifact = project / "wireframe" / "layouts" / "dashboard-mobile.svg"
    if not artifact.exists():
        print(f"  SKIP  artifact not found: {artifact}")
        return
    res = check_compliance("wireframe", artifact)
    assert_(res.ok, "check_compliance returns ok=True")
    assert_(res.data["failed"] == 0,
            f"no failures (got {res.data['failed']})")
    assert_(res.data["scope"] == "artifact",
            "scope auto-detected as artifact")


def test_check_compliance_ux_clauses():
    """The UX-philosophy clauses are reachable through the package API.

    The clause LOGIC is proved from both sides in
    tools/builders/test_ux_clauses.py. What this case adds is the wiring: a
    caller going through check_compliance() receives the clause verdicts,
    rather than them existing only inside tools/builders/rulebook_check.py.
    """
    section("check_compliance surfaces the UX-philosophy clauses")
    fixtures = HERE.parent / "builders" / "fixtures" / "ux"
    assert_(fixtures.is_dir(), f"ux fixtures exist at {fixtures}")
    if not fixtures.is_dir():
        return

    res = check_compliance("wireframe", fixtures / "toast-placed.svg", scope="artifact")
    assert_(res.ok, "check_compliance returns ok=True")
    if not res.ok:
        return
    by_id = {r["rule_id"]: r for r in res.data["results"]}
    assert_("ux-no-toast-notifications" in by_id,
            "the toast clause reaches the package result",
            f"got {sorted(by_id)}")
    assert_(by_id.get("ux-no-toast-notifications", {}).get("status") == "fail",
            "a placed toast is reported as fail (not advisory, not absent)",
            f"got {by_id.get('ux-no-toast-notifications')}")
    assert_(res.data["failed"] == 1,
            f"exactly one failure, so it is attributable to the toast (got {res.data['failed']})")

    clean = check_compliance("wireframe", fixtures / "toast-absent.svg", scope="artifact")
    assert_(clean.ok and clean.data["failed"] == 0,
            "the clean twin passes through the same path",
            f"got {clean.data if clean.ok else clean}")


def test_check_compliance_unknown_artifact():
    section("check_compliance with missing artifact")
    res = check_compliance("swiss", "/tmp/this_definitely_does_not_exist.svg")
    assert_(not res.ok, "check_compliance returns ok=False on missing artifact")


# ─── test: rulebook exceptions allow-list ──────────────────────────

_CLEAN_SVG = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 40">'
              '<rect x="0" y="0" width="200" height="40" fill="#FFFFFF"/></svg>')
_OFF_PALETTE_SVG = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 40">'
                    '<rect x="0" y="0" width="200" height="40" fill="#7B1FA2"/></svg>')
_TWO_OFF_PALETTE_SVG = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 40">'
                        '<rect x="0" y="0" width="100" height="40" fill="#7B1FA2"/>'
                        '<rect x="100" y="0" width="100" height="40" fill="#00ACC1"/></svg>')


def _exceptions_fixture(tmp: Path, entries_yaml: str) -> Path:
    """Build a throwaway system dir: spec.yaml, components/, exceptions file."""
    (tmp / "spec.yaml").write_text("# fixture\n")
    comp = tmp / "components"
    comp.mkdir()
    (comp / "clean.svg").write_text(_CLEAN_SVG)
    (comp / "accent.svg").write_text(_OFF_PALETTE_SVG)
    (comp / "two-accents.svg").write_text(_TWO_OFF_PALETTE_SVG)
    exc = tmp / "rulebook-exceptions.yaml"
    exc.write_text("version: 1\nexceptions:\n" + entries_yaml)
    return exc


def _rb():
    from design_system_skill.rulebook import _import_rulebook_check_module
    return _import_rulebook_check_module()


def test_exception_waives_violation():
    section("rulebook exceptions: waived violation passes, reported as waived")
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        exc = _exceptions_fixture(tmp, (
            "  - file: components/accent.svg\n"
            "    rule: wireframe-palette\n"
            "    match: '#7B1FA2'\n"
            "    reason: Fixture accent kept to exercise the allow-list.\n"
        ))
        res = check_compliance("wireframe", tmp / "components" / "accent.svg",
                               exceptions_path=exc)
        assert_(res.ok, "check_compliance ok with valid exceptions file", str(res.errors))
        data = res.data
        assert_(data["failed"] == 0, f"waived violation does not fail (failed={data['failed']})")
        assert_(data["waived"] == 1, f"one rule reported as waived (got {data['waived']})")
        waived = [r for r in data["results"] if r["status"] == "waived"]
        assert_(len(waived) == 1 and waived[0]["rule_id"] == "wireframe-palette",
                "wireframe-palette carries status=waived")
        reasons = [w["reason"] for w in waived[0]["detail"].get("waivers", [])] if waived else []
        assert_(reasons == ["Fixture accent kept to exercise the allow-list."],
                f"waiver reason reported (got {reasons})")
        assert_(data["exceptions_file"] == str(exc.resolve()),
                "exceptions_file names the file used")


def test_exception_match_does_not_cover_new_violation():
    section("rulebook exceptions: match token only covers matching violations")
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        exc = _exceptions_fixture(tmp, (
            "  - file: components/*.svg\n"
            "    rule: wireframe-palette\n"
            "    match: '#7B1FA2'\n"
            "    reason: Fixture accent kept to exercise the allow-list.\n"
        ))
        res = check_compliance("wireframe", tmp / "components" / "two-accents.svg",
                               exceptions_path=exc)
        assert_(res.ok, "check_compliance ok")
        palette = [r for r in res.data["results"] if r["rule_id"] == "wireframe-palette"]
        assert_(palette and palette[0]["status"] == "fail",
                "uncovered #00ACC1 keeps the rule failing")
        assert_(palette and palette[0]["detail"].get("unwaived") == ["#00ACC1"],
                f"unwaived lists only the new colour (got {palette[0]['detail'].get('unwaived') if palette else None})")


def test_exception_missing_reason_rejected():
    section("rulebook exceptions: entry without a reason is a validation error")
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        exc = _exceptions_fixture(tmp, (
            "  - file: components/accent.svg\n"
            "    rule: wireframe-palette\n"
            "    reason: '   '\n"
            "  - file: components/clean.svg\n"
            "    rule: wireframe-palette\n"
        ))
        res = check_compliance("wireframe", tmp / "components" / "accent.svg",
                               exceptions_path=exc)
        assert_(not res.ok, "check_compliance fails on an invalid exceptions file")
        codes = [e.code for e in res.errors]
        assert_(codes == ["EXCEPTIONS_INVALID"], f"error code is EXCEPTIONS_INVALID (got {codes})")
        errors = res.errors[0].detail.get("errors", []) if res.errors else []
        assert_(len(errors) == 2 and all("reason" in e for e in errors),
                f"both reason problems reported in one pass (got {errors})")

        rb = _rb()
        try:
            rb.parse_exceptions({"exceptions": [{"file": "a.svg", "rule": "no-emoji-imagery",
                                                 "reason": "ok", "extra": 1}]},
                                tmp / "x.yaml", rb.known_rule_ids("wireframe"))
            rejected = False
        except rb.ExceptionsFileError:
            rejected = True
        assert_(rejected, "unknown entry keys are rejected")
        try:
            rb.parse_exceptions({"exceptions": [{"file": "a.svg", "rule": "wireframe-pallete",
                                                 "reason": "typo"}]},
                                tmp / "x.yaml", rb.known_rule_ids("wireframe"))
            rejected = False
        except rb.ExceptionsFileError:
            rejected = True
        assert_(rejected, "unknown rule ids are rejected")


def test_exception_stale_entry_fails():
    section("rulebook exceptions: entry matching no violation fails the run")
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        exc = _exceptions_fixture(tmp, (
            "  - file: components/clean.svg\n"
            "    rule: wireframe-palette\n"
            "    reason: Was off-palette once; since fixed.\n"
        ))
        res = check_compliance("wireframe", tmp / "components" / "clean.svg",
                               exceptions_path=exc)
        assert_(res.ok, "check_compliance ok")
        stale = [r for r in res.data["results"] if r["rule_id"] == "rulebook-exception-stale"]
        assert_(res.data["failed"] == 1 and len(stale) == 1 and stale[0]["status"] == "fail",
                f"stale entry reported as one failure (failed={res.data['failed']})")

        # Batch mode: stale for a clean file and for a file that no longer exists.
        rb = _rb()
        (tmp / "rulebook-exceptions.yaml").write_text(
            "exceptions:\n"
            "  - file: components/clean.svg\n"
            "    rule: wireframe-palette\n"
            "    reason: Was off-palette once; since fixed.\n"
            "  - file: components/renamed-away.svg\n"
            "    rule: wireframe-palette\n"
            "    reason: File was renamed.\n"
            "  - file: components/accent.svg\n"
            "    rule: wireframe-palette\n"
            "    reason: Fixture accent kept to exercise the allow-list.\n"
        )
        summary = rb.run_batch(str(tmp / "components"), "wireframe")
        assert_(summary["stale_exceptions"] == 2,
                f"batch reports 2 stale entries (got {summary['stale_exceptions']})")
        assert_(summary["total_waived"] == 1, f"batch reports 1 waived (got {summary['total_waived']})")
        assert_(rb._exit_code(summary) == 1, "stale entries make the batch exit non-zero")


def test_exception_outside_scope_not_stale():
    section("rulebook exceptions: entries outside the run are not stale")
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        exc = _exceptions_fixture(tmp, (
            "  - file: components/accent.svg\n"
            "    rule: wireframe-palette\n"
            "    reason: Fixture accent kept to exercise the allow-list.\n"
            "  - file: layouts/gone.svg\n"
            "    rule: wireframe-palette\n"
            "    reason: Belongs to another directory.\n"
        ))
        res = check_compliance("wireframe", tmp / "components" / "clean.svg",
                               exceptions_path=exc)
        assert_(res.ok and res.data["failed"] == 0,
                "single-file run ignores entries for other files")

        rb = _rb()
        (tmp / "components" / "two-accents.svg").unlink()
        summary = rb.run_batch(str(tmp / "components"), "wireframe")
        assert_(summary["stale_exceptions"] == 0,
                f"batch over components/ ignores the layouts/ entry (got {summary['stale_exceptions']})")
        assert_(summary["failed_files"] == 0 and rb._exit_code(summary) == 0,
                "batch is clean with the violation waived")


# ─── test: register/unregister round-trip ──────────────────────────

def test_register_unregister_roundtrip():
    section("register/unregister round-trip")
    # We don't want to mutate the real registry; instead, point the env var
    # at a temp registry seeded from the real one.
    import os
    import shutil
    from design_system_skill import paths as paths_mod
    project = SYSTEMS_DIR
    real_registry = project / "registry.yaml"
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        temp_registry = td_path / "registry.yaml"
        shutil.copy2(real_registry, temp_registry)
        # Copy the swiss library (contains spec.yaml + components/ + layouts/)
        src = project / "swiss"
        dst = td_path / "swiss"
        try:
            shutil.copytree(src, dst)
        except Exception:
            pass
        os.environ["DESIGN_SYSTEM_SKILL_REGISTRY"] = str(temp_registry)
        try:
            clear_cache()
            ls = list_systems()
            assert_(ls.ok, "temp registry lists ok")
            unreg = unregister_system("swiss")
            assert_(unreg.ok, "unregister(swiss) on temp registry succeeds")
            ls2 = list_systems()
            assert_(ls2.ok and "swiss" not in [d["id"] for d in ls2.data],
                    "swiss removed from listing after unregister")
            # Re-register from the library directory (contains spec.yaml)
            reg = register_system(td_path / "swiss")
            assert_(reg.ok, "re-register swiss succeeds",
                    json.dumps(reg.to_dict(), default=str)[:300] if not reg.ok else "")
            ls3 = list_systems()
            assert_(ls3.ok and "swiss" in [d["id"] for d in ls3.data],
                    "swiss is back in listing after register")
        finally:
            del os.environ["DESIGN_SYSTEM_SKILL_REGISTRY"]
            clear_cache()


# ─── test: extends (system inheritance) ───────────────────────────

def test_extends_loads_merged_spec():
    section("load_system with extends")
    import os
    import shutil
    project = SYSTEMS_DIR
    real_registry = project / "registry.yaml"
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        temp_registry = td_path / "registry.yaml"
        shutil.copy2(real_registry, temp_registry)
        # Copy terminal library so parent loads.
        shutil.copytree(project / "terminal", td_path / "terminal")
        # Create extension spec.
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
    accent: "#FF0000"
components:
  custom_widget:
    anatomy: []
    variants:
      - id: default
rulebook:
  - id: my-ext-custom-rule
    rule: "Custom extension rule."
    severity: required
    check_method: mechanical
    check_scope: artifact
""")
        os.environ["DESIGN_SYSTEM_SKILL_REGISTRY"] = str(temp_registry)
        try:
            clear_cache()
            reg = register_system(ext_dir)
            assert_(reg.ok, f"extension spec registered ({reg.to_dict() if not reg.ok else 'ok'})")
            clear_cache()
            res = load_system("my_terminal_ext")
            assert_(res.ok, f"load_system extension ok=True")
            if not res.ok:
                return
            spec = res.data
            assert_(spec["tokens"]["colors"]["accent"] == "#FF0000",
                    "child token overrides parent (accent=#FF0000)")
            parent_colors = spec["tokens"].get("colors", {})
            assert_("page_bg" in parent_colors or "page" in parent_colors,
                    "parent token still present after merge")
            assert_("custom_widget" in spec.get("components", {}),
                    "child component custom_widget present")
            assert_(len(spec.get("components", {})) > 1,
                    "parent components merged (more than just custom_widget)")
            rule_ids = [r["id"] for r in (spec.get("rulebook") or [])]
            assert_("my-ext-custom-rule" in rule_ids,
                    "child rulebook entry present")
            assert_(len(rule_ids) > 1,
                    "parent rulebook rules also present")
            assert_(spec["_meta"].get("extends") == "terminal",
                    "_meta.extends == 'terminal'")
            chain = spec["_meta"].get("resolved_chain", [])
            assert_("my_terminal_ext" in chain and "terminal" in chain,
                    f"_meta.resolved_chain includes both ids ({chain})")
        finally:
            del os.environ["DESIGN_SYSTEM_SKILL_REGISTRY"]
            clear_cache()


def test_extends_cycle_detection():
    section("load_system extends cycle detection")
    import os
    import shutil
    project = SYSTEMS_DIR
    real_registry = project / "registry.yaml"
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        temp_registry = td_path / "registry.yaml"
        shutil.copy2(real_registry, temp_registry)
        # Create two specs that cross-extend.
        dir_a = td_path / "sys-a-library"
        dir_a.mkdir()
        (dir_a / "spec.yaml").write_text("""\
spec_version: "0.2"
system:
  id: sys_a
  name: Sys A
  extends: sys_b
tokens: {}
""")
        dir_b = td_path / "sys-b-library"
        dir_b.mkdir()
        (dir_b / "spec.yaml").write_text("""\
spec_version: "0.2"
system:
  id: sys_b
  name: Sys B
  extends: sys_a
tokens: {}
""")
        os.environ["DESIGN_SYSTEM_SKILL_REGISTRY"] = str(temp_registry)
        try:
            clear_cache()
            register_system(dir_a)
            register_system(dir_b)
            clear_cache()
            result = load_system("sys_a")
            assert_(not result.ok, "circular extends fails to load (ok=False)")
            if not result.ok:
                msgs = " ".join(e.message for e in result.errors)
                assert_("ircular" in msgs or "cycle" in msgs.lower(),
                        f"error mentions circular dependency ({msgs[:200]})")
        finally:
            del os.environ["DESIGN_SYSTEM_SKILL_REGISTRY"]
            clear_cache()


def test_extends_parent_not_found():
    section("load_system extends parent not found")
    import os
    import shutil
    project = SYSTEMS_DIR
    real_registry = project / "registry.yaml"
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        temp_registry = td_path / "registry.yaml"
        shutil.copy2(real_registry, temp_registry)
        ext_dir = td_path / "orphan-library"
        ext_dir.mkdir()
        (ext_dir / "spec.yaml").write_text("""\
spec_version: "0.2"
system:
  id: orphan_sys
  name: Orphan System
  extends: nonexistent_parent
tokens: {}
""")
        os.environ["DESIGN_SYSTEM_SKILL_REGISTRY"] = str(temp_registry)
        try:
            clear_cache()
            register_system(ext_dir)
            clear_cache()
            result = load_system("orphan_sys")
            assert_(not result.ok, "extends nonexistent parent fails (ok=False)")
            if not result.ok:
                msgs = " ".join(e.message for e in result.errors)
                assert_("nonexistent_parent" in msgs,
                        f"error mentions the missing parent ({msgs[:200]})")
        finally:
            del os.environ["DESIGN_SYSTEM_SKILL_REGISTRY"]
            clear_cache()


def test_extends_multi_level():
    section("load_system multi-level extends (A → B → terminal)")
    import os
    import shutil
    project = SYSTEMS_DIR
    real_registry = project / "registry.yaml"
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        temp_registry = td_path / "registry.yaml"
        shutil.copy2(real_registry, temp_registry)
        shutil.copytree(project / "terminal", td_path / "terminal")
        # B extends terminal
        dir_b = td_path / "mid-library"
        dir_b.mkdir()
        (dir_b / "spec.yaml").write_text("""\
spec_version: "0.2"
system:
  id: mid_sys
  name: Mid System
  grammar_family: character_grid
  extends: terminal
tokens:
  colors:
    mid_color: "#AABBCC"
""")
        # A extends B
        dir_a = td_path / "top-library"
        dir_a.mkdir()
        (dir_a / "spec.yaml").write_text("""\
spec_version: "0.2"
system:
  id: top_sys
  name: Top System
  grammar_family: character_grid
  extends: mid_sys
tokens:
  colors:
    top_color: "#112233"
""")
        os.environ["DESIGN_SYSTEM_SKILL_REGISTRY"] = str(temp_registry)
        try:
            clear_cache()
            register_system(dir_b)
            register_system(dir_a)
            clear_cache()
            result = load_system("top_sys")
            assert_(result.ok, f"multi-level extends loads ok=True")
            if not result.ok:
                return
            spec = result.data
            colors = spec.get("tokens", {}).get("colors", {})
            assert_("top_color" in colors, "top-level child token present")
            assert_("mid_color" in colors, "mid-level parent token present")
            chain = spec["_meta"].get("resolved_chain", [])
            assert_(len(chain) == 3,
                    f"resolved_chain has 3 entries ({chain})")
            assert_(chain[0] == "top_sys" and chain[-1] == "terminal",
                    f"chain order is top→mid→terminal ({chain})")
        finally:
            del os.environ["DESIGN_SYSTEM_SKILL_REGISTRY"]
            clear_cache()


# ─── test: semantic token contract (schema v0.3, issue #6) ────────

# Colours for the synthetic document: white surfaces, near-black text,
# dark fills with white content. Every contract pair passes the contrast
# gate (issue #7) and accent/action sit far from danger in hue (issue #8).
_MINIMAL_COLORS = {
    "page_bg": "#FFFFFF", "surface": "#FFFFFF", "surface_elevated": "#FFFFFF",
    "surface_selected": "#F0F0F0", "surface_inverse": "#111111",
    "text_primary": "#111111", "text_secondary": "#555555", "text_muted": "#767676",
    "text_placeholder": "#999999", "text_inverse": "#FFFFFF",
    "accent": "#1F4FA0", "accent_foreground": "#FFFFFF",
    "action": "#1F4FA0", "action_foreground": "#FFFFFF",
    "danger": "#B00020", "danger_foreground": "#FFFFFF",
    "success": "#1B5E20", "success_foreground": "#FFFFFF",
    "warning": "#7A4F00", "warning_foreground": "#FFFFFF",
    "info": "#0D47A1", "info_foreground": "#FFFFFF",
    "border_default": "#E0E0E0", "border_strong": "#111111",
    "border_input": "#767676", "focus_ring": "#1F4FA0",
}


def _minimal_token_doc(system_id: str = "synthetic") -> dict:
    """Build a token document supplying every contract token with a
    plausible value of the right kind (no file I/O). Its colours pass the
    contrast and hue gates."""
    from design_system_skill import contract as c
    defaults = {
        c.KIND_COLOR: "#808080",
        c.KIND_PX: 4,
        c.KIND_PX_LIST: [4, 8, 16],
        c.KIND_FONT_STACK: "system-ui, sans-serif",
        c.KIND_SHADOW: "none",
        c.KIND_BLUR: "none",
        c.KIND_ELEVATION_STRATEGY: "borders_only",
        c.KIND_MOTION_TIER: {"enter_ms": 160, "exit_ms": 120,
                             "easing": "cubic-bezier(0.2, 0, 0, 1)"},
        c.KIND_REDUCED_MOTION: "fade",
    }
    doc: dict = {"contract_version": c.CONTRACT_VERSION, "system": system_id}
    for token in c.CONTRACT_TOKENS:
        if token.kind == c.KIND_TYPE_ROLE:
            value = {"size": 14, "weight": 400, "line_height": 1.5,
                     "tracking": 0, "family": "body", "case": "none"}
        elif token.kind == c.KIND_COLOR:
            value = _MINIMAL_COLORS[token.name]
        else:
            value = json.loads(json.dumps(defaults[token.kind]))  # no shared mappings
        doc.setdefault(token.group, {})[token.name] = value
    return doc


def _write_v03_spec(dir_path: Path, doc: dict | None, system_id: str = "synthetic") -> Path:
    """Write a minimal v0.3 spec (and optionally its tokens.json) into dir_path."""
    spec_path = dir_path / "spec.yaml"
    tokens_line = "  tokens_file: tokens.json\n" if doc is not None else ""
    spec_path.write_text(
        'spec_version: "0.3"\n'
        "system:\n"
        f"  id: {system_id}\n"
        "  name: Synthetic\n"
        f"{tokens_line}"
        "tokens: {}\n"
    )
    if doc is not None:
        (dir_path / "tokens.json").write_text(json.dumps(doc))
    return spec_path


def test_contract_doc_matches_module():
    section("contract: SCHEMA-V0.3.md tables match contract.py")
    from design_system_skill.contract import (
        render_contract_table, render_motion_table, render_pairs_table,
    )
    doc = (HERE.parents[1] / "docs" / "specs" / "SCHEMA-V0.3.md").read_text()
    assert_(render_contract_table() in doc,
            "contract table in SCHEMA-V0.3.md equals render_contract_table()")
    assert_(render_pairs_table() in doc,
            "pairs table in SCHEMA-V0.3.md equals render_pairs_table()")
    assert_(render_motion_table() in doc,
            "motion tier table in SCHEMA-V0.3.md equals render_motion_table()")


def test_contract_pairs_reference_contract_tokens():
    section("contract: every required pair names contract colour tokens")
    from design_system_skill.contract import CONTRAST_PAIRS, TOKENS_BY_PATH, KIND_COLOR
    for pair in CONTRAST_PAIRS:
        for side in (pair.fg, pair.bg):
            token = TOKENS_BY_PATH.get(side)
            assert_(token is not None and token.kind == KIND_COLOR,
                    f"pair side {side} is a contract colour token")


def test_minimal_token_doc_validates():
    section("contract: a complete token document validates")
    from design_system_skill.token_file import validate_token_document
    errors, _ = validate_token_document(_minimal_token_doc())
    assert_(errors == [], "complete synthetic token doc has no errors",
            "; ".join(e.message for e in errors)[:300])


def test_missing_contract_token_fails():
    section("contract: a token document missing a contract token fails")
    from design_system_skill.token_file import validate_token_document
    doc = _minimal_token_doc()
    del doc["color"]["danger_foreground"]
    del doc["type"]["label"]
    errors, _ = validate_token_document(doc)
    msgs = " | ".join(e.message for e in errors)
    assert_("color.danger_foreground" in msgs, f"error names color.danger_foreground ({msgs[:200]})")
    assert_("type.label" in msgs, f"error names type.label ({msgs[:200]})")


def test_bad_token_values_fail():
    section("contract: wrong-shaped values and stray keys fail")
    from design_system_skill.token_file import validate_token_document
    doc = _minimal_token_doc()
    doc["color"]["accent"] = "red-ish"
    doc["type"]["body"]["family"] = "serif_display"   # not a key of `font`
    doc["space"]["steps"] = [16, 8]                    # not ascending
    doc["color"]["brand_teal"] = "#00FFFF"             # extras belong in `extras`
    errors, _ = validate_token_document(doc)
    msgs = " | ".join(e.message for e in errors)
    for needle in ("color.accent", "type.body", "space.steps", "color.brand_teal"):
        assert_(needle in msgs, f"error mentions {needle} ({msgs[:300]})")


def test_modes_validation():
    section("contract: modes — default must equal base, overrides must be known tokens")
    from design_system_skill.token_file import (
        validate_token_document, resolve_mode, iter_mode_selections,
    )
    doc = _minimal_token_doc()
    doc["color"]["page_bg"] = "#FFFFFF"
    doc["modes"] = {"axes": [{
        "id": "scheme", "default": "light",
        "options": {"light": {"color.page_bg": "#FFFFFF"},
                    "dark": {"color.page_bg": "#111111", "color.text_primary": "#EEEEEE"}},
    }]}
    errors, _ = validate_token_document(doc)
    assert_(errors == [], "well-formed light/dark modes validate",
            "; ".join(e.message for e in errors)[:300])
    sels = list(iter_mode_selections(doc))
    assert_(sels == [{"scheme": "light"}, {"scheme": "dark"}],
            f"iter_mode_selections yields both options ({sels})")
    dark = resolve_mode(doc, {"scheme": "dark"})
    assert_(dark["color"]["page_bg"] == "#111111" and doc["color"]["page_bg"] == "#FFFFFF",
            "resolve_mode applies overrides to a copy")

    doc["modes"]["axes"][0]["options"]["light"]["color.page_bg"] = "#FAFAFA"
    doc["modes"]["axes"][0]["options"]["dark"]["color.nonexistent"] = "#000000"
    errors, _ = validate_token_document(doc)
    msgs = " | ".join(e.message for e in errors)
    assert_("default" in msgs and "color.page_bg" in msgs,
            f"default option disagreeing with base value fails ({msgs[:200]})")
    assert_("color.nonexistent" in msgs, f"override of unknown token fails ({msgs[:200]})")


def test_v03_spec_requires_token_file():
    section("validate_spec: v0.3 requires system.tokens_file with every contract token")
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        res = validate_spec(_write_v03_spec(td_path, None))
        assert_(not res.ok, "v0.3 spec without tokens_file fails")
        assert_(any("tokens_file" in e.message for e in res.errors),
                "error mentions tokens_file")

        doc = _minimal_token_doc()
        res = validate_spec(_write_v03_spec(td_path, doc))
        assert_(res.ok, "v0.3 spec with a complete token file validates",
                "; ".join(e.message for e in res.errors)[:300])

        del doc["color"]["focus_ring"]
        res = validate_spec(_write_v03_spec(td_path, doc))
        assert_(not res.ok, "v0.3 spec whose token file lacks focus_ring fails")
        assert_(any("color.focus_ring" in e.message for e in res.errors),
                "error names the missing token")

        doc = _minimal_token_doc(system_id="someone_else")
        res = validate_spec(_write_v03_spec(td_path, doc))
        assert_(not res.ok and any("does not match" in e.message for e in res.errors),
                "token file naming a different system fails")


def test_v02_spec_without_token_file_still_valid():
    section("validate_spec: v0.2 specs need no token file (backwards compatible)")
    with tempfile.NamedTemporaryFile(suffix="-spec.yaml", mode="w", delete=False) as f:
        f.write('spec_version: "0.2"\nsystem:\n  id: legacy\n  name: Legacy\ntokens: {}\n')
        p = f.name
    res = validate_spec(p)
    Path(p).unlink(missing_ok=True)
    assert_(res.ok, "v0.2 spec without tokens_file is valid")


# ─── test: canonical token files (issue #4) ───────────────────────

ALL_REGISTERED = ["wireframe", "neutral", "swiss", "terminal", "editorial",
                  "sketch", "prism", "revolt", "riso"]


def _strings(node):
    if isinstance(node, dict):
        for v in node.values():
            yield from _strings(v)
    elif isinstance(node, list):
        for v in node:
            yield from _strings(v)
    elif isinstance(node, str):
        yield node


def test_every_system_loads_tokens_from_token_file():
    section("load_system: every registered system reads tokens from tokens.json")
    from design_system_skill.token_file import ALIAS_RE, LEGACY_PROJECTION, get_spec_path, get_token
    clear_cache()
    for sys_id in ALL_REGISTERED:
        res = load_system(sys_id)
        assert_(res.ok, f"load_system('{sys_id}') ok",
                "; ".join(e.message for e in res.errors)[:300] if not res.ok else "")
        if not res.ok:
            continue
        spec = res.data
        contract = spec["tokens"].get("contract")
        assert_(isinstance(contract, dict) and contract.get("contract_version") == "1.0",
                f"{sys_id}: tokens.contract attached")
        assert_(spec["_meta"].get("tokens_path", "").endswith("tokens.json"),
                f"{sys_id}: _meta.tokens_path points at tokens.json")
        for keys, token_path in LEGACY_PROJECTION:
            assert_(get_spec_path(spec, keys) == get_token(contract, token_path),
                    f"{sys_id}: {'.'.join(keys)} projected from {token_path}")
        palette = spec["tokens"]["colors"].get("palette") or []
        assert_(all("value" in p for p in palette),
                f"{sys_id}: every palette entry has a resolved value")
        leftovers = [s for s in _strings({k: v for k, v in spec["tokens"].items() if k != "contract"})
                     if ALIAS_RE.search(s)]
        assert_(not leftovers, f"{sys_id}: no unresolved aliases in tokens ({leftovers[:3]})")


def test_neutral_alias_shares_wireframe_tokens():
    section("load_system: 'neutral' registry alias shares wireframe's token file")
    clear_cache()
    wf, nt = load_system("wireframe"), load_system("neutral")
    assert_(wf.ok and nt.ok, "both ids load")
    if wf.ok and nt.ok:
        assert_(wf.data["_meta"]["tokens_path"] == nt.data["_meta"]["tokens_path"],
                "same tokens_path")
        assert_(nt.data["tokens"]["contract"]["system"] == "wireframe",
                "token file system id is the canonical 'wireframe'")
    from design_system_skill.token_file import load_tokens_for_system
    builder_view = load_tokens_for_system("neutral")
    assert_(builder_view.ok and builder_view.data["color"]["page_bg"] == "#F5F5F5",
            "load_tokens_for_system('neutral') returns the wireframe token document")
    assert_(not load_tokens_for_system("does_not_exist").ok,
            "load_tokens_for_system fails cleanly for unknown ids")


def test_riso_modes_cover_every_press():
    section("riso tokens: paper x ink modes resolve every press combination")
    from design_system_skill.token_file import iter_mode_selections, resolve_mode
    doc = json.loads((SYSTEMS_DIR / "riso" / "tokens.json").read_text())
    selections = list(iter_mode_selections(doc))
    assert_(len(selections) == 30, f"5 papers x 6 inks = 30 selections (got {len(selections)})")
    kraft_sunset = resolve_mode(doc, {"paper": "kraft", "ink": "sunset"})
    assert_(kraft_sunset["color"]["page_bg"] == "#D4BE94", "kraft paper sets page_bg")
    assert_(kraft_sunset["color"]["text_primary"] == "#2A1F12", "kraft paper sets text ink")
    assert_(kraft_sunset["extras"]["color"]["ink_2"] == "#E8C700", "sunset sets the ink-2 drum")
    assert_(kraft_sunset["color"]["accent"] == "#5A4C00",
            "sunset sets accent to the legible shade of its ink-2 drum (issue #7)")
    default = resolve_mode(doc)
    assert_(default["color"] == doc["color"], "default selection equals base values")


def test_token_file_edit_invalidates_cache():
    section("load_system: editing tokens.json invalidates the spec cache")
    import os
    import shutil
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        temp_registry = td_path / "registry.yaml"
        shutil.copy2(SYSTEMS_DIR / "registry.yaml", temp_registry)
        shutil.copytree(SYSTEMS_DIR / "swiss", td_path / "swiss")
        os.environ["DESIGN_SYSTEM_SKILL_REGISTRY"] = str(temp_registry)
        try:
            clear_cache()
            first = load_system("swiss")
            assert_(first.ok and first.data["tokens"]["colors"]["accent"] == "#E3000B",
                    "swiss accent loads from tokens.json")
            tok = td_path / "swiss" / "tokens.json"
            doc = json.loads(tok.read_text())
            doc["color"]["accent"] = "#D0000A"   # still red: the hue waiver keeps matching
            tok.write_text(json.dumps(doc))
            second = load_system("swiss")
            assert_(second.ok and second.data["tokens"]["colors"]["accent"] == "#D0000A",
                    "edited accent is picked up without clear_cache()")
        finally:
            del os.environ["DESIGN_SYSTEM_SKILL_REGISTRY"]
            clear_cache()


# ─── test: drift check (issue #4) ─────────────────────────────────

def test_find_drift_kinds():
    section("find_drift: detects each kind of disagreement")
    from design_system_skill.drift import find_drift
    doc = _minimal_token_doc()
    doc["color"]["accent"] = "#E3000B"
    doc["extras"] = {"color": {"rule_hairline": "#F0F0F0"}}
    spec = {
        "tokens": {
            "colors": {
                "accent": "#e3000b",          # same colour, different spelling: not drift
                "page_bg": "#FAFAFA",         # token says #FFFFFF
                "palette": [
                    {"name": "red", "token": "color.accent"},
                    {"name": "hair", "token": "extras.color.rule_hairline", "value": "#EEEEEE"},
                    {"name": "ghost", "token": "extras.color.nope"},
                ],
            },
            "elevation": {"config": {
                "rule": {"color": "{color.border_default}"},
                "bar": {"color": "#123456"},                     # not in the token file
                "broken": {"color": "{color.not_a_token}"},
            }},
            "typography": {"families": [{"id": "structural", "stack": "Comic Sans MS"}]},
        },
    }
    items = find_drift(spec, doc)
    kinds = {(i.kind, i.location) for i in items}
    assert_(("value_mismatch", "tokens.colors.page_bg") in kinds, f"page_bg mismatch found ({kinds})")
    assert_(not any(loc == "tokens.colors.accent" for _, loc in kinds),
            "case-only difference is not drift")
    assert_(("palette_mismatch", "tokens.colors.palette[1].value") in kinds, "palette value mismatch found")
    assert_(("unresolved_alias", "tokens.colors.palette[2].token") in kinds, "unknown palette token found")
    assert_(("unresolved_alias", "tokens.elevation.config.broken.color") in kinds, "unknown alias found")
    assert_(("unknown_literal", "tokens.elevation.config.bar.color") in kinds, "unknown colour literal found")
    assert_(("unknown_literal", "tokens.typography.families[0].stack") in kinds, "unknown font stack found")
    assert_(len(items) == 6, f"exactly 6 drift items ({len(items)}: {sorted(kinds)})")


def test_drift_clean_for_all_registered_systems():
    section("check_drift_all: every registered spec agrees with its tokens.json")
    from design_system_skill import check_drift_all
    res = check_drift_all()
    assert_(res.ok, "no drift in any registered system",
            "; ".join(e.message for e in res.errors)[:400])
    systems = (res.data or {}).get("systems", {})
    assert_(systems.get("neutral") == {"alias_of": "wireframe"},
            f"neutral is reported as an alias of wireframe ({systems.get('neutral')})")


def _copy_swiss(td_path: Path) -> Path:
    import shutil
    dst = td_path / "swiss"
    shutil.copytree(SYSTEMS_DIR / "swiss", dst)
    return dst / "spec.yaml"


def test_drift_fails_validation_and_cli():
    section("drift: a drifting spec fails validate_spec and the CLI")
    import contextlib
    import importlib.util
    import io
    from design_system_skill import check_drift
    spec_mod = importlib.util.spec_from_file_location("dss_cli", HERE / "__main__.py")
    cli = importlib.util.module_from_spec(spec_mod)
    spec_mod.loader.exec_module(cli)

    with tempfile.TemporaryDirectory() as td:
        spec_path = _copy_swiss(Path(td))
        with contextlib.redirect_stdout(io.StringIO()):
            clean_exit = cli.main(["drift", "--spec", str(spec_path)])
        assert_(clean_exit == 0, f"CLI exits 0 on a clean spec (got {clean_exit})")

        text = spec_path.read_text().replace(
            "    palette:\n", '    text_muted: "#666666"   # the pre-v0.3 value\n\n    palette:\n', 1)
        spec_path.write_text(text)

        res = check_drift(spec_path)
        assert_(not res.ok, "check_drift reports the stale literal")
        drift = (res.data or {}).get("drift", [])
        muted = json.loads((spec_path.parent / "tokens.json").read_text())["color"]["text_muted"]
        assert_(any(d["location"] == "tokens.colors.text_muted" and d["token_value"] == muted
                    for d in drift), f"drift names text_muted vs {muted} ({drift})")

        val = validate_spec(spec_path, library_root=str(spec_path.parent))
        assert_(not val.ok and any(e.code == "TOKEN_DRIFT" for e in val.errors),
                "validate_spec fails with TOKEN_DRIFT")

        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            drift_exit = cli.main(["drift", "--spec", str(spec_path)])
        assert_(drift_exit == 1, f"CLI exits 1 on drift (got {drift_exit})")
        assert_("text_muted" in out.getvalue(), "CLI output names the drifting key")


# ─── test: motion (issue #10) ─────────────────────────────────────

def _motion_errors(doc: dict) -> str:
    from design_system_skill.token_file import validate_token_document
    errors, _ = validate_token_document(doc)
    return " | ".join(e.message for e in errors)


def test_motion_tokens_valid_with_spring():
    section("motion: complete tiers (with an optional spring) validate")
    doc = _minimal_token_doc()
    doc["motion"] = {
        "fast": {"enter_ms": 80, "exit_ms": 60, "easing": "cubic-bezier(0.2, 0, 0, 1)"},
        "moderate": {"enter_ms": 160, "exit_ms": 120, "easing": "cubic-bezier(0.2, 0, 0, 1)"},
        "slow": {"enter_ms": 240, "exit_ms": 160, "easing": "cubic-bezier(0.2, 0, 0, 1)",
                 "spring": {"duration_ms": 240, "bounce": 0.12}},
        "expressive": {"enter_ms": 420, "exit_ms": 240, "easing": "cubic-bezier(.34,1.56,.64,1)",
                       "spring": {"duration_ms": 420, "bounce": 0.28}},
        "reduced_motion": "fade",
    }
    msgs = _motion_errors(doc)
    assert_(msgs == "", "fine-design prior-art tiers validate", msgs[:300])


def test_motion_tokens_missing_fail():
    section("motion: a missing tier or policy fails")
    doc = _minimal_token_doc()
    del doc["motion"]["slow"]
    del doc["motion"]["reduced_motion"]
    msgs = _motion_errors(doc)
    assert_("motion.slow" in msgs, f"error names motion.slow ({msgs[:200]})")
    assert_("motion.reduced_motion" in msgs, f"error names motion.reduced_motion ({msgs[:200]})")
    doc = _minimal_token_doc()
    del doc["motion"]
    msgs = _motion_errors(doc)
    assert_("motion.fast" in msgs and "motion.expressive" in msgs,
            f"a token file without a motion group fails ({msgs[:200]})")


def test_motion_tokens_malformed_fail():
    section("motion: malformed tiers, policy and ordering fail")
    cases = {
        "exit slower than enter": ("fast", {"enter_ms": 80, "exit_ms": 120,
                                            "easing": "cubic-bezier(0.2, 0, 0, 1)"}, "exit_ms"),
        "keyword easing": ("fast", {"enter_ms": 80, "exit_ms": 60, "easing": "ease-out"}, "easing"),
        "x out of range": ("fast", {"enter_ms": 80, "exit_ms": 60,
                                    "easing": "cubic-bezier(1.5, 0, 0, 1)"}, "easing"),
        "negative duration": ("fast", {"enter_ms": -1, "exit_ms": -2,
                                       "easing": "cubic-bezier(0, 0, 1, 1)"}, "enter_ms"),
        "missing field": ("fast", {"enter_ms": 80, "easing": "cubic-bezier(0, 0, 1, 1)"}, "exit_ms"),
        "unknown field": ("fast", {"enter_ms": 80, "exit_ms": 60, "delay_ms": 10,
                                   "easing": "cubic-bezier(0, 0, 1, 1)"}, "delay_ms"),
        "bounce >= 1": ("expressive", {"enter_ms": 420, "exit_ms": 240,
                                       "easing": "cubic-bezier(0, 0, 1, 1)",
                                       "spring": {"duration_ms": 420, "bounce": 1.2}}, "bounce"),
        "not a mapping": ("slow", "240ms", "motion.slow"),
        "bad policy": ("reduced_motion", "reduce", "reduced_motion"),
    }
    for label, (name, value, needle) in cases.items():
        doc = _minimal_token_doc()
        doc["motion"]["fast"]["enter_ms"] = 0   # keep the order check out of the way
        doc["motion"][name] = value
        msgs = _motion_errors(doc)
        assert_(needle in msgs, f"{label}: error mentions {needle} ({msgs[:200]})")

    doc = _minimal_token_doc()
    doc["motion"]["slow"] = {"enter_ms": 100, "exit_ms": 80, "easing": "cubic-bezier(0, 0, 1, 1)"}
    msgs = _motion_errors(doc)
    assert_("motion.slow.enter_ms" in msgs and "shorter" in msgs,
            f"slow faster than moderate fails (bigger thing, slower tier) ({msgs[:200]})")


_MOTION_SPEC = '''spec_version: "0.3"
system:
  id: synthetic
  name: Synthetic
  tokens_file: tokens.json
tokens: {}
components:
  list_item:
    motion:
      - trigger: enter
        tier: moderate
        properties: [opacity, transform]
        reduced: fade
        stagger_ms: 40
      - trigger: select
        tier: fast
        properties: [background-color]
        reduced: keep
motion:
  elements:
    cursor:
      - trigger: loop
        tier: fast
        properties: [opacity]
        reduced: none
        timing: { duration_ms: 1000, easing: step-end }
'''


def _validate_motion_spec(spec_text: str, doc: dict | None = None):
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        (td_path / "spec.yaml").write_text(spec_text)
        (td_path / "tokens.json").write_text(json.dumps(doc or _minimal_token_doc()))
        res = validate_spec(td_path / "spec.yaml")
    return res, " | ".join(e.message for e in (res.errors or []))


def test_motion_declarations_valid():
    section("motion: component + element declarations validate against the tiers")
    res, msgs = _validate_motion_spec(_MOTION_SPEC)
    assert_(res.ok, "well-formed motion declarations validate", msgs[:300])


def test_motion_declarations_invalid():
    section("motion: unknown tier and illegal reduced-motion behaviour fail")
    cases = {
        "unknown tier": (("tier: moderate", "tier: medium"), "medium"),
        "unknown trigger": (("trigger: select", "trigger: wiggle"), "wiggle"),
        "keep on travel": (("reduced: fade\n        stagger_ms", "reduced: keep\n        stagger_ms"),
                           "keep"),
        "loop kept": (("reduced: none\n        timing", "reduced: keep\n        timing"), "loop"),
        "bad timing easing": (("easing: step-end", "easing: wobble"), "timing.easing"),
        "bad stagger": (("stagger_ms: 40", "stagger_ms: -5"), "stagger_ms"),
        "missing reduced": (("        reduced: keep\n", ""), "missing"),
        "unknown key": (("stagger_ms: 40", "stagger_ms: 40\n        delay: 3"), "unknown keys"),
        "element shadows component": (("    cursor:", "    list_item:"), "is a component"),
        "empty motion list": (("  list_item:\n    motion:\n", "  list_item:\n    motion: []\n    old:\n"),
                              "non-empty list"),
    }
    for label, ((old, new), needle) in cases.items():
        assert_(old in _MOTION_SPEC, f"{label}: fixture contains the text to replace")
        res, msgs = _validate_motion_spec(_MOTION_SPEC.replace(old, new, 1))
        assert_(not res.ok and needle in msgs, f"{label}: fails mentioning {needle!r} ({msgs[:200]})")

    doc = _minimal_token_doc()
    doc["motion"]["reduced_motion"] = "none"
    res, msgs = _validate_motion_spec(_MOTION_SPEC, doc)
    assert_(not res.ok and "conflicts with the system policy" in msgs,
            f"policy 'none' rejects fade/keep declarations ({msgs[:200]})")


def test_every_system_declares_motion():
    section("motion: every registered system loads tiers, notes and declarations")
    from design_system_skill.contract import MOTION_TIER_NAMES
    from design_system_skill.token_file import iter_motion_declarations
    clear_cache()
    for sys_id in ALL_REGISTERED:
        res = load_system(sys_id)
        assert_(res.ok, f"load_system('{sys_id}') ok")
        if not res.ok:
            continue
        motion = res.data["tokens"]["contract"].get("motion") or {}
        assert_(all(isinstance(motion.get(t), dict) for t in MOTION_TIER_NAMES),
                f"{sys_id}: tokens.contract.motion has every tier")
        assert_(motion.get("reduced_motion") in ("fade", "none"),
                f"{sys_id}: reduced_motion policy is fade|none ({motion.get('reduced_motion')})")
        notes = res.data["tokens"]["contract"].get("notes") or {}
        unnoted = [f"motion.{t}" for t in (*MOTION_TIER_NAMES, "reduced_motion")
                   if f"motion.{t}" not in notes]
        assert_(not unnoted, f"{sys_id}: every motion token has a note ({unnoted})")
        decls = [d for _, ds in iter_motion_declarations(res.data) for d in ds]
        assert_(len(decls) >= 2, f"{sys_id}: declares motion for its animated elements ({len(decls)})")
        assert_(all(d["tier"] in MOTION_TIER_NAMES for d in decls),
                f"{sys_id}: every declaration names a contract tier")
    revolt = load_system("revolt").data
    rot = revolt["grammar_extensions"]["per_system_signature"]["rotation_interaction"]
    assert_(rot["transition_ms"] == revolt["tokens"]["contract"]["motion"]["fast"]["enter_ms"] == 120,
            "revolt rotation_interaction.transition_ms aliases motion.fast.enter_ms")


# ─── test: contrast gate (issue #7) ───────────────────────────────

def _gate_errors(report) -> str:
    return " | ".join(f"{e.code}: {e.message}" for e in report.errors)


def test_contrast_ratio_matches_wcag():
    section("contrast: WCAG 2.x ratio math")
    from design_system_skill.contrast import contrast_ratio, relative_luminance
    from design_system_skill.contract import parse_color

    def ratio(a, b):
        return contrast_ratio(parse_color(a)[:3], parse_color(b)[:3])

    assert_(round(ratio("#777", "#FFF"), 2) == 4.48, f"#777 on #FFF is 4.48:1 ({ratio('#777', '#FFF'):.4f})")
    assert_(ratio("#777", "#FFF") < 4.5, "#777 on #FFF fails 4.5 (ratios are never rounded up)")
    assert_(round(ratio("#000", "#FFF"), 2) == 21.0, "black on white is 21:1")
    assert_(ratio("#FFF", "#FFF") == 1.0, "identical colours are 1:1")
    assert_(ratio("#767676", "#FFFFFF") >= 4.5, "#767676 on white passes 4.5 (4.54:1)")
    assert_(ratio("#E3000B", "#FFF") == ratio("#FFF", "#E3000B"), "ratio is order-independent")
    assert_(abs(relative_luminance((255, 255, 255)) - 1.0) < 1e-12, "white has luminance 1")


def test_contrast_alpha_compositing():
    section("contrast: translucent colours composite over their real backdrop")
    from design_system_skill.contrast import check_contrast, composite
    mid = composite((0, 0, 0, 0.5), (255, 255, 255))
    assert_(all(abs(c - 127.5) < 1e-9 for c in mid), f"50% black over white is mid grey ({mid})")

    doc = _minimal_token_doc()
    doc["color"]["page_bg"] = "#000000"
    doc["color"]["surface"] = "rgba(255,255,255,0.1)"        # glass on black
    doc["color"]["text_primary"] = "rgba(255,255,255,0.9)"
    rep = check_contrast(doc)
    row = next(r for r in rep.results if r["pair"] == "color.text_primary on color.surface")
    # surface -> (25.5,)*3 over black; text -> 0.9*255 + 0.1*25.5 = 232.05
    assert_(row["passes"] and row["ratio"] > 10, f"glass text composites over glass over page ({row['ratio']})")

    doc["extras"] = {"color": {"stop": "#C0C0C0"}}
    doc["contrast_backdrops"] = ["extras.color.stop"]
    rep = check_contrast(doc)
    rows = [r for r in rep.results if r["pair"] == "color.text_primary on color.surface"]
    assert_({r["backdrop"] for r in rows} == {"color.page_bg", "extras.color.stop"},
            "every pair is evaluated over page_bg and each contrast_backdrops entry")
    assert_(any(not r["passes"] for r in rows if r["backdrop"] == "extras.color.stop"),
            "white glass text fails over a light backdrop stop")
    assert_(any("extras.color.stop" in e.message for e in rep.errors if e.code == "CONTRAST_FAIL"),
            f"failure names the backdrop ({_gate_errors(rep)[:300]})")

    doc["contrast_backdrops"] = ["color.surface"]          # translucent: not a backdrop
    assert_(any(e.code == "CONTRAST_INVALID" for e in check_contrast(doc).errors),
            "a translucent backdrop is rejected")


def test_contrast_oklch_and_gamut():
    section("contrast: OKLCH conversion, gamut clamp, lightness fix")
    from design_system_skill.contrast import (
        in_srgb_gamut, oklch_to_rgb, rgb_to_oklch, suggest_lightness_fix, to_hex,
    )
    from design_system_skill.contract import parse_color
    white = rgb_to_oklch((255, 255, 255))
    assert_(abs(white[0] - 1.0) < 1e-4 and white[1] < 1e-4, f"white is L=1, C=0 ({white})")
    red = rgb_to_oklch((255, 0, 0))
    assert_(abs(red[0] - 0.628) < 1e-3 and abs(red[1] - 0.2577) < 1e-3 and abs(red[2] - 29.23) < 0.05,
            f"#FF0000 is oklch(0.628 0.258 29.2) ({red})")
    for hexv in ("#E3000B", "#7DDFBE", "#3255A4", "#F4EFE4", "#111111"):
        rgb, _ = oklch_to_rgb(*rgb_to_oklch(parse_color(hexv)[:3]))
        assert_(to_hex(rgb) == hexv, f"{hexv} round-trips through OKLCH ({to_hex(rgb)})")
    assert_(not in_srgb_gamut(0.7, 0.4, 150), "oklch(0.7 0.4 150) is outside sRGB")
    rgb, chroma = oklch_to_rgb(0.7, 0.4, 150)
    assert_(chroma < 0.4 and in_srgb_gamut(0.7, chroma, 150) and all(0 <= c <= 255 for c in rgb),
            f"out-of-gamut colour is clamped by reducing chroma ({chroma:.3f})")

    fix = suggest_lightness_fix("#B8A9C8", [("#F0EDE8", "#FAFAF8")], 3.0, move="fg")
    before, after = rgb_to_oklch(parse_color("#B8A9C8")[:3]), rgb_to_oklch(parse_color(fix.new)[:3])
    assert_(fix.ratio_before < 3.0 <= fix.ratio_after, f"fix passes ({fix})")
    assert_(abs(before[2] - after[2]) < 2 and abs(before[1] - after[1]) < 0.003,
            f"hue and chroma are kept ({before} -> {after})")
    assert_(fix.delta_l < 0, "lavender darkens to pass on a light surface")
    glass = suggest_lightness_fix("rgba(255,255,255,0.4)", [("rgba(255,255,255,0.08)", "#5A5562")],
                                  3.0, move="fg")
    assert_(glass is not None and glass.delta_alpha > 0 and glass.new.startswith("rgba(255,255,255,"),
            f"white glass text (already L=1) gains opacity instead ({glass})")


def test_contrast_every_mode_combination():
    section("contrast: every mode combination is checked")
    from design_system_skill.contrast import check_contrast
    doc = _minimal_token_doc()
    doc["modes"] = {"axes": [
        {"id": "scheme", "default": "light",
         "options": {"light": {}, "dark": {"color.page_bg": "#121212", "color.surface": "#121212"}}},
        {"id": "density", "default": "regular", "options": {"regular": {}, "compact": {}}},
    ]}
    rep = check_contrast(doc)
    assert_(rep.modes == 4, f"2 x 2 axes = 4 combinations ({rep.modes})")
    fails = [e for e in rep.errors if e.code == "CONTRAST_FAIL"]
    assert_(fails and all(e.detail["mode"]["scheme"] == "dark" for e in fails),
            f"dark text on the dark scheme fails, named by mode ({_gate_errors(rep)[:300]})")
    assert_(any(e.detail["failures"] == 2 for e in fails), "failure count spans both densities")
    passing = [r for r in rep.results if r["mode"]["scheme"] == "light"]
    assert_(passing and all(r["passes"] for r in passing), "light scheme passes")


def test_contrast_waivers():
    section("contrast: waivers need a reason, only cover ui pairs, and go stale")
    from design_system_skill.contrast import check_contrast
    doc = _minimal_token_doc()
    doc["color"]["accent"] = "#9DB8E8"           # light blue mark on white: ui 1.9:1
    doc["color"]["accent_foreground"] = "#111111"
    rep = check_contrast(doc)
    assert_(any(e.code == "CONTRAST_FAIL" and e.detail["pair"] == "color.accent on color.surface"
                for e in rep.errors), "unwaived ui failure fails")

    doc["contrast_waivers"] = [{"pair": "color.accent on color.surface",
                                "reason": "Decorative brand flourish; selection is carried by weight."}]
    rep = check_contrast(doc)
    assert_(rep.ok, f"a reasoned waiver covers the ui failure ({_gate_errors(rep)[:300]})")
    row = next(r for r in rep.results if r["pair"] == "color.accent on color.surface")
    assert_(row["waived"] and "Decorative" in row["waiver_reason"], "waived result carries the reason")
    assert_(rep.summary()["waived"] == 1, "summary counts the waiver")

    doc["contrast_waivers"] = [{"pair": "color.accent on color.surface", "reason": "  "}]
    rep = check_contrast(doc)
    assert_(any(e.code == "CONTRAST_INVALID" and "reason" in e.message for e in rep.errors),
            "a waiver without a reason is invalid")

    doc["contrast_waivers"] = [{"pair": "color.accent_foreground on color.accent", "reason": "x"}]
    rep = check_contrast(doc)
    assert_(any(e.code == "CONTRAST_INVALID" and "only" in e.message for e in rep.errors),
            "text pairs cannot be waived")

    doc["color"]["accent"] = "#1F4FA0"            # fixed: the waiver no longer matches
    doc["color"]["accent_foreground"] = "#FFFFFF"
    doc["contrast_waivers"] = [{"pair": "color.accent on color.surface", "reason": "was decorative"}]
    rep = check_contrast(doc)
    assert_(any(e.code == "CONTRAST_FAIL" and e.detail.get("stale") for e in rep.errors),
            "a waiver that matches no failure is stale and fails")

    doc["contrast_waivers"] = [{"pair": "color.nope on color.surface", "reason": "x"}]
    assert_(any(e.code == "CONTRAST_INVALID" for e in check_contrast(doc).errors),
            "a waiver naming an unknown pair is invalid")


def test_contrast_waiver_modes_and_stale_patterns():
    section("contrast: mode-scoped waivers match partial selections; unused patterns are stale")
    from design_system_skill.contrast import check_contrast
    doc = _minimal_token_doc()
    doc["modes"] = {"axes": [{"id": "ink", "default": "blue", "options": {
        "blue": {}, "pale": {"color.focus_ring": "#C8D6F0"}}}]}
    waiver = {"pair": "color.focus_ring on color.surface", "modes": [{"ink": "pale"}],
              "reason": "test"}
    doc["contrast_waivers"] = [waiver, {**waiver, "pair": "color.focus_ring on color.page_bg"}]
    rep = check_contrast(doc)
    assert_(rep.ok, f"mode-scoped waivers cover the pale ink only ({_gate_errors(rep)[:300]})")
    waiver2 = {**waiver, "modes": [{"ink": "pale"}, {"ink": "blue"}]}
    doc["contrast_waivers"] = [waiver2, {**waiver, "pair": "color.focus_ring on color.page_bg"}]
    rep = check_contrast(doc)
    assert_(any(e.detail.get("stale") and "{'ink': 'blue'}" in e.message for e in rep.errors),
            f"a mode pattern that matches nothing is stale ({_gate_errors(rep)[:300]})")
    doc["contrast_waivers"] = [{**waiver, "modes": [{"ink": "neon"}]}]
    assert_(any(e.code == "CONTRAST_INVALID" for e in check_contrast(doc).errors),
            "a waiver naming an unknown mode option is invalid")


def test_contrast_pair_replacement():
    section("contrast: border_input pair can be re-expressed, with a note")
    from design_system_skill.contrast import check_contrast
    doc = _minimal_token_doc()
    doc["color"]["border_input"] = "#EEEEEE"
    assert_(not check_contrast(doc).ok, "a faint input stroke fails ui 3:1")
    doc["contrast_pairs"] = [{"fg": "color.accent", "bg": "color.surface", "kind": "text",
                              "replaces": "color.border_input on color.surface",
                              "note": "Inputs are identified by a prompt glyph in accent."}]
    rep = check_contrast(doc)
    assert_(rep.ok, f"the identifying pair replaces the stroke pair ({_gate_errors(rep)[:200]})")
    assert_(not any(r["pair"] == "color.border_input on color.surface" for r in rep.results),
            "the replaced pair is not evaluated")
    doc["contrast_pairs"][0]["note"] = ""
    assert_(any(e.code == "CONTRAST_INVALID" for e in check_contrast(doc).errors),
            "a replacement needs a note")
    doc["contrast_pairs"][0].update(note="x", replaces="color.text_primary on color.surface")
    assert_(any(e.code == "CONTRAST_INVALID" for e in check_contrast(doc).errors),
            "only border_input on surface is replaceable")


def test_contrast_exempt_pairs():
    section("contrast: advisory/disabled file pairs never fail but need a note and a role")
    from design_system_skill.contrast import check_contrast
    doc = _minimal_token_doc()
    doc.setdefault("extras", {})["color"] = {"ghost": "#F0F0F0", "disabled_fill": "#EEEEEE"}
    doc["contrast_pairs"] = [
        {"fg": "extras.color.ghost", "bg": "color.page_bg", "kind": "advisory",
         "note": "Decorative duplicate of the type above it."},
        {"fg": "extras.color.ghost", "bg": "extras.color.disabled_fill", "kind": "disabled",
         "note": "Inactive button label."},
    ]
    rep = check_contrast(doc)
    assert_(rep.ok, f"low-contrast exempt pairs with notes pass ({_gate_errors(rep)[:200]})")
    assert_(any(r["kind"] == "disabled" and r["minimum"] is None for r in rep.results),
            "disabled pairs are reported with no minimum")
    doc["contrast_pairs"][0]["note"] = " "
    assert_(any("needs a 'note'" in e.message for e in check_contrast(doc).errors),
            "an advisory file pair needs a note")
    doc["contrast_pairs"][0]["note"] = "x"
    doc["contrast_pairs"][1]["bg"] = "color.surface"
    errs = check_contrast(doc).errors
    assert_(any("disabled-role" in e.message for e in errs),
            "a disabled pair must name a disabled-role token")


def test_contrast_gate_in_validate_and_cli():
    section("contrast: validate_spec, load_system and the CLI expose the gate")
    import contextlib
    import importlib.util
    import io
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        doc = _minimal_token_doc()
        spec_path = _write_v03_spec(td_path, doc)
        res = validate_spec(spec_path)
        assert_(res.ok and "contrast" in res.data, "valid spec returns the contrast report")
        worst = res.data["contrast"]["worst"]
        assert_(all({"pair", "ratio", "minimum", "passes", "mode", "kind"} <= set(r) for r in worst),
                "per-pair report has ratio, minimum, pass and mode")

        doc["color"]["text_secondary"] = "#AAAAAA"
        spec_path = _write_v03_spec(td_path, doc)
        res = validate_spec(spec_path)
        assert_(not res.ok and any(e.code == "CONTRAST_FAIL" for e in res.errors),
                "a failing pair fails validate_spec with CONTRAST_FAIL")
        assert_(res.data and res.data["contrast"]["failed"] >= 1,
                "the failing report is still attached to the result data")

        spec_mod = importlib.util.spec_from_file_location("dss_cli_c", HERE / "__main__.py")
        cli = importlib.util.module_from_spec(spec_mod)
        spec_mod.loader.exec_module(cli)
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = cli.main(["contrast", "--spec", str(spec_path)])
        assert_(code == 1 and "text_secondary" in out.getvalue(), f"CLI exits 1 and names the pair ({code})")
        doc["color"]["text_secondary"] = "#555555"
        spec_path = _write_v03_spec(td_path, doc)
        with contextlib.redirect_stdout(io.StringIO()):
            code = cli.main(["contrast", "--spec", str(spec_path)])
        assert_(code == 0, f"CLI exits 0 when every pair passes ({code})")
    clear_cache()
    loaded = load_system("swiss")
    assert_(loaded.ok and "contrast" in loaded.data["_meta"].get("color_gates", {}),
            "load_system attaches the gate reports under _meta.color_gates")


def test_every_system_passes_color_gates():
    section("contrast: every registered system passes in every mode")
    from design_system_skill import check_color_gates_all
    res = check_color_gates_all()
    assert_(res.ok, "every registered system passes", "; ".join(e.message for e in res.errors)[:500])
    systems = (res.data or {}).get("systems", {})
    assert_(systems.get("riso", {}).get("contrast", {}).get("modes") == 30,
            "riso is checked in all 30 paper x ink combinations")
    assert_(len(systems.get("prism", {}).get("contrast", {}).get("backdrops", [])) == 5,
            "prism is checked over page_bg and its four gradient stops")
    for sys_id, data in systems.items():
        if "alias_of" in data:
            continue
        assert_(data["contrast"]["failed"] == 0, f"{sys_id}: no failing contrast pair")


def test_contrast_docs_match_module():
    section("contrast: SCHEMA-V0.3.md thresholds table matches contrast.py")
    from design_system_skill.contrast import render_thresholds_table
    doc = (HERE.parents[1] / "docs" / "specs" / "SCHEMA-V0.3.md").read_text()
    assert_(render_thresholds_table() in doc, "thresholds table equals render_thresholds_table()")


# ─── test: accent / danger hue gate (issue #8) ────────────────────

def test_hue_gate_gap_floor_and_waiver():
    section("hue gate: 40° OKLCH gap, chroma floor, waivers")
    from design_system_skill.contrast import check_hue_gate
    doc = _minimal_token_doc()
    rep = check_hue_gate(doc)
    gaps = {r["token"]: r["gap"] for r in rep.results}
    assert_(rep.ok and all(g is not None and g >= 40 for g in gaps.values()),
            f"blue accent vs red danger clears 40° ({gaps})")

    doc["color"]["accent"] = "#C0182A"        # a red accent
    rep = check_hue_gate(doc)
    fail = [e for e in rep.errors if e.code == "HUE_GATE_FAIL"]
    assert_(fail and fail[0].detail["pair"] == "color.accent vs color.danger" and fail[0].detail["gap"] < 40,
            f"red accent within 40° of danger fails and reports the gap ({_gate_errors(rep)[:200]})")
    assert_(not any(e.detail.get("pair") == "color.action vs color.danger" for e in fail),
            "action (still blue) passes")

    doc["color"]["accent"] = "#7A6E70"        # warm grey: chroma below the floor
    rep = check_hue_gate(doc)
    row = next(r for r in rep.results if r["token"] == "color.accent")
    assert_(rep.ok and row["exempt"] and row["gap"] is None and row["chroma"] < 0.04,
            f"a grey accent is exempt ({row['chroma']})")

    doc["color"]["accent"] = "#C0182A"
    doc["hue_waivers"] = [{"pair": "color.accent vs color.danger", "reason": "Danger carried by a label."}]
    rep = check_hue_gate(doc)
    assert_(rep.ok and next(r for r in rep.results if r["token"] == "color.accent")["waived"],
            "a reasoned hue waiver covers the failure")
    doc["hue_waivers"] = [{"pair": "color.accent vs color.danger"}]
    assert_(any(e.code == "HUE_GATE_INVALID" for e in check_hue_gate(doc).errors),
            "a hue waiver without a reason is invalid")
    doc["color"]["accent"] = "#1F4FA0"
    doc["hue_waivers"] = [{"pair": "color.accent vs color.danger", "reason": "was red"}]
    assert_(any(e.code == "HUE_GATE_FAIL" and e.detail.get("stale") for e in check_hue_gate(doc).errors),
            "a hue waiver that matches no failure is stale")


def test_hue_gate_registered_systems():
    section("hue gate: registered systems (ADR-0002)")
    from design_system_skill.contrast import check_hue_gate
    for sys_id, waived in (("swiss", 2), ("revolt", 1), ("editorial", 0), ("terminal", 0)):
        doc = json.loads((SYSTEMS_DIR / sys_id / "tokens.json").read_text())
        rep = check_hue_gate(doc)
        n = sum(1 for r in rep.results if r["waived"])
        assert_(rep.ok and n == waived, f"{sys_id}: passes with {waived} waived result(s) ({n})")
    riso = json.loads((SYSTEMS_DIR / "riso" / "tokens.json").read_text())
    rep = check_hue_gate(riso)
    assert_(rep.modes == 30 and all(r["exempt"] for r in rep.results),
            "riso's danger is the paper's text ink (grey): exempt in all 30 modes")



# ─── test: user-registry overlay ────────────────────────────────────

def test_user_registry_overlay():
    section("user-registry overlay")
    import os
    # The preamble already points DESIGN_SYSTEM_SKILL_USER_REGISTRY at a
    # sandbox path that does not exist yet. Mutations in merged mode must
    # create it and never touch the built-in registry.
    from design_system_skill.paths import builtin_registry_path, user_registry_path
    builtin_reg = builtin_registry_path()
    user_reg = user_registry_path()
    builtin_before = builtin_reg.read_text()

    clear_cache()
    assert_(not user_reg.exists(), "user registry absent before mutations")

    # Built-ins cannot be unregistered in merged mode.
    res = unregister_system("swiss")
    assert_(not res.ok and "BUILTIN_SYSTEM_IMMUTABLE" in [e.code for e in res.errors],
            "unregister(builtin) fails with BUILTIN_SYSTEM_IMMUTABLE")

    # replace=True shadows the built-in via a user-layer entry.
    swiss_spec = builtin_reg.parent / "swiss" / "spec.yaml"
    assert_(swiss_spec.exists(), "swiss spec found for overlay test")
    if not swiss_spec.exists():
        return
    reg = register_system(swiss_spec, replace=True)
    assert_(reg.ok, "register(swiss, replace=True) writes a user override",
            json.dumps(reg.to_dict(), default=str)[:300] if not reg.ok else "")
    assert_(user_reg.exists(), "user registry file created by mutation")
    assert_(builtin_reg.read_text() == builtin_before,
            "built-in registry untouched by user-layer mutation")
    ls = list_systems()
    ids = [d["id"] for d in ls.data] if ls.ok else []
    assert_(ls.ok and ids.count("swiss") == 1,
            "overlay shadows built-in (swiss listed exactly once)")
    loaded = load_system("swiss")
    assert_(loaded.ok, "load_system resolves through the user override",
            json.dumps(loaded.to_dict(), default=str)[:300] if not loaded.ok else "")

    # The repository gates check the built-in layer only: a user-layer
    # system belongs to another project.
    from design_system_skill.registry import Registry
    reg_all = Registry.load().data
    builtin_ids = [e.id for e in reg_all.builtin_entries()]
    assert_(sorted(builtin_ids) == sorted(e.id for e in reg_all.all()),
            "a shadowing user entry does not add ids to the built-in layer")

    # Removing the override reveals the built-in again.
    unreg = unregister_system("swiss")
    assert_(unreg.ok, "unregister removes the user override")
    clear_cache()
    ls2 = list_systems()
    assert_(ls2.ok and "swiss" in [d["id"] for d in ls2.data],
            "built-in swiss visible again after override removal")

    # Cleanup: leave the sandbox registry empty for any later tests.
    if user_reg.exists():
        user_reg.unlink()
    clear_cache()



def test_repository_gates_skip_user_layer_systems():
    section("drift/contrast --all check the built-in layer only")
    from design_system_skill.paths import user_registry_path
    from design_system_skill.drift import check_drift_all
    from design_system_skill.contrast import check_color_gates_all
    user_reg = user_registry_path()
    foreign = Path(tempfile.mkdtemp(prefix="dss-foreign-"))
    try:
        # A user-layer system with no tokens.json: drift/contrast on it
        # would fail, so a green --all proves it was not checked.
        spec = foreign / "spec.yaml"
        spec.write_text('''spec_version: "0.2"
system:
  id: foreign-sys
  name: Foreign
tokens: {}
''')
        reg = register_system(spec)
        assert_(reg.ok, "foreign system registers into the user layer")
        ids = [d["id"] for d in list_systems().data]
        assert_("foreign-sys" in ids, "list_systems shows the user-layer system")
        seen: list[str] = []

        def record(path, _seen=seen):
            _seen.append(str(path))
            from design_system_skill.errors import Result
            return Result.success({})
        check_drift_all(checker=record)
        assert_(seen and not any(str(foreign) in p for p in seen),
                f"drift --all never visits the user-layer spec ({len(seen)} specs checked)")
        seen.clear()
        check_color_gates_all(checker=record)
        assert_(seen and not any(str(foreign) in p for p in seen),
                "contrast --all never visits the user-layer spec")
    finally:
        unregister_system("foreign-sys")
        shutil.rmtree(foreign, ignore_errors=True)
        if user_reg.exists():
            user_reg.unlink()
        clear_cache()


def _write_child_spec(dir_path: Path, system_id: str, extends: str,
                      extra: str = "") -> Path:
    """Author a minimal child spec that extends another system."""
    spec_path = dir_path / "spec.yaml"
    spec_path.write_text(f"""\
spec_version: "0.2"
system:
  id: {system_id}
  name: {system_id.title()} (extends {extends})
  extends: {extends}
tokens:
  colors:
    accent: "#FF00AA"
rulebook:
  - id: child-only-rule
    severity: required
    statement: child systems keep their own rules
    check_method: semantic
    check_scope: artifact
{extra}""")
    return spec_path




def test_extends_cross_layer_inheritance():
    section("system.extends — user-layer child inherits built-in parent")
    import os
    from design_system_skill.paths import user_registry_path
    user_reg = user_registry_path()

    child_dir = Path(tempfile.mkdtemp(prefix="dss-extends-child-"))
    try:
        spec_path = _write_child_spec(child_dir, "swiss-child", "swiss")
        reg = register_system(spec_path)
        assert_(reg.ok, "child registers into the user layer",
                json.dumps(reg.to_dict(), default=str)[:300] if not reg.ok else "")
        clear_cache()

        res = load_system("swiss-child")
        assert_(res.ok, "load_system('swiss-child') resolves",
                json.dumps(res.to_dict(), default=str)[:300] if not res.ok else "")
        if not res.ok:
            return
        spec = res.data
        assert_(spec["_meta"]["extends"] == "swiss",
                "_meta.extends records the parent")
        assert_(spec["_meta"]["resolved_chain"] == ["swiss-child", "swiss"],
                f"_meta.resolved_chain is child→parent "
                f"(got {spec['_meta']['resolved_chain']})")
        assert_(spec["system"]["id"] == "swiss-child",
                "system block is the child's (child wins entirely)")

        # tokens: child override wins, parent siblings inherited.
        assert_(spec["tokens"]["colors"]["accent"] == "#FF00AA",
                "child token override wins")
        assert_("common" in spec["tokens"],
                "parent's tokens.common block is inherited")

        # components: inherited from parent, svg paths resolved against the
        # parent's own library (cross-layer path correctness).
        comps = spec.get("components") or {}
        assert_(len(comps) > 0, "parent components are inherited")
        some_variant = next(
            (v for c in comps.values() if isinstance(c, dict)
             for v in (c.get("variants") or []) if v.get("svg_path")),
            None,
        )
        assert_(some_variant is not None
                and "/swiss/" in some_variant["svg_path"]
                and Path(some_variant["svg_path"]).exists(),
                "inherited variant svg_path resolves into the parent library")

        # rulebook: concatenated, parent first.
        rule_ids = [r.get("id") for r in spec.get("rulebook") or []]
        assert_(rule_ids and rule_ids[-1] == "child-only-rule"
                and len(rule_ids) > 1,
                f"rulebook concatenates parent rules + child rule "
                f"(got {len(rule_ids)} rules)")
    finally:
        unregister_system("swiss-child")
        shutil.rmtree(child_dir, ignore_errors=True)
        if user_reg.exists():
            user_reg.unlink()
        clear_cache()




def test_extends_validation_warnings():
    section("system.extends — validation flags bad extends values")
    with tempfile.NamedTemporaryFile(suffix="-spec.yaml", mode="w", delete=False) as f:
        f.write("""\
spec_version: "0.2"
system:
  id: orphan
  name: Orphan
  extends: not-a-registered-system
tokens: {}
""")
        orphan_path = f.name
    res = validate_spec(orphan_path)
    assert_(res.ok, "spec with unregistered parent still validates (advisory)")
    warn_msgs = " | ".join(w["message"] for w in (res.data or {}).get("warnings", []))
    assert_("not-a-registered-system" in warn_msgs,
            f"warning names the missing parent (got: {warn_msgs[:160]})")
    Path(orphan_path).unlink(missing_ok=True)

    with tempfile.NamedTemporaryFile(suffix="-spec.yaml", mode="w", delete=False) as f:
        f.write("""\
spec_version: "0.2"
system:
  id: bad-extends
  name: Bad Extends
  extends: ""
tokens: {}
""")
        bad_path = f.name
    res2 = validate_spec(bad_path)
    assert_(not res2.ok and any("system.extends" in e.message for e in res2.errors),
            "empty extends string is a blocking error")
    Path(bad_path).unlink(missing_ok=True)



# ─── runner ─────────────────────────────────────────────────────────

def main():
    print("design-system-skill smoke tests\n" + "=" * 50)
    test_list_systems()
    test_load_system()
    test_load_unknown()
    test_load_resolves_svg_paths()
    test_validate_existing_specs()
    test_validate_synthetic_bad_spec()
    test_unknown_grammar_family_is_advisory()
    test_unknown_elevation_strategy_is_advisory()
    test_unknown_selection_signal_is_advisory()
    test_get_rulebook()
    test_check_compliance_swiss_component()
    test_check_compliance_wireframe_pattern()
    test_check_compliance_ux_clauses()
    test_check_compliance_unknown_artifact()
    test_exception_waives_violation()
    test_exception_match_does_not_cover_new_violation()
    test_exception_missing_reason_rejected()
    test_exception_stale_entry_fails()
    test_swiss_error_prefix_rule()
    test_swiss_error_not_red_rule()
    test_swiss_library_follows_error_treatment()
    test_exception_outside_scope_not_stale()
    test_register_unregister_roundtrip()
    test_user_registry_overlay()
    test_repository_gates_skip_user_layer_systems()
    test_extends_cross_layer_inheritance()
    test_extends_validation_warnings()
    test_extends_loads_merged_spec()
    test_extends_cycle_detection()
    test_extends_parent_not_found()
    test_extends_multi_level()
    test_contract_doc_matches_module()
    test_contract_pairs_reference_contract_tokens()
    test_minimal_token_doc_validates()
    test_missing_contract_token_fails()
    test_bad_token_values_fail()
    test_modes_validation()
    test_v03_spec_requires_token_file()
    test_v02_spec_without_token_file_still_valid()
    test_every_system_loads_tokens_from_token_file()
    test_neutral_alias_shares_wireframe_tokens()
    test_riso_modes_cover_every_press()
    test_token_file_edit_invalidates_cache()
    test_find_drift_kinds()
    test_drift_clean_for_all_registered_systems()
    test_drift_fails_validation_and_cli()
    test_motion_tokens_valid_with_spring()
    test_motion_tokens_missing_fail()
    test_motion_tokens_malformed_fail()
    test_motion_declarations_valid()
    test_motion_declarations_invalid()
    test_every_system_declares_motion()
    test_contrast_ratio_matches_wcag()
    test_contrast_alpha_compositing()
    test_contrast_oklch_and_gamut()
    test_contrast_every_mode_combination()
    test_contrast_waivers()
    test_contrast_waiver_modes_and_stale_patterns()
    test_contrast_pair_replacement()
    test_contrast_exempt_pairs()
    test_contrast_gate_in_validate_and_cli()
    test_every_system_passes_color_gates()
    test_contrast_docs_match_module()
    test_hue_gate_gap_floor_and_waiver()
    test_hue_gate_registered_systems()

    print(f"\n{'=' * 50}")
    print(f"Total: {PASSED + FAILED}  Passed: {PASSED}  Failed: {FAILED}")
    return 0 if FAILED == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
