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
import sys
import tempfile
from pathlib import Path

# Make the package importable when running this script directly.
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

# Canonical layout: libraries + registry.yaml live at <repo>/systems.
SYSTEMS_DIR = HERE.parents[1] / "systems"

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
        assert_(d["spec_version"] in ("0.1", "0.2"),
                f"system '{d['id']}' spec_version is 0.1 or 0.2 (got {d['spec_version']})")


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
        assert_(spec["_meta"]["spec_version"] in ("0.1", "0.2"),
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
    assert_(len(rules) == 10, f"swiss has 10 rulebook entries (got {len(rules)})")
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
    test_check_compliance_unknown_artifact()
    test_exception_waives_violation()
    test_exception_match_does_not_cover_new_violation()
    test_exception_missing_reason_rejected()
    test_exception_stale_entry_fails()
    test_exception_outside_scope_not_stale()
    test_register_unregister_roundtrip()
    test_extends_loads_merged_spec()
    test_extends_cycle_detection()
    test_extends_parent_not_found()
    test_extends_multi_level()

    print(f"\n{'=' * 50}")
    print(f"Total: {PASSED + FAILED}  Passed: {PASSED}  Failed: {FAILED}")
    return 0 if FAILED == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
