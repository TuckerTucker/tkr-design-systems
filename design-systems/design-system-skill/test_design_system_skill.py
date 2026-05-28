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


def section(name: str) -> None:
    print(f"\n── {name} ──")


# ─── test: list_systems ─────────────────────────────────────────────

def test_list_systems():
    section("list_systems")
    res = list_systems()
    assert_(res.ok, "list_systems returns ok=True")
    ids = [d["id"] for d in res.data] if res.ok else []
    expected = {"wireframe", "swiss", "terminal", "editorial",
                "sketch", "prism", "revolt", "riso"}
    assert_(set(ids) == expected,
            f"all 8 expected systems present (got {sorted(ids)})")
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
    project = HERE.parent
    for spec_name in ["swiss-spec.yaml", "wireframe-spec.yaml", "terminal-spec.yaml",
                      "editorial-spec.yaml", "sketch-spec.yaml", "prism-spec.yaml",
                      "revolt-spec.yaml", "riso-spec-v0.2.yaml"]:
        path = project / spec_name
        res = validate_spec(path)
        assert_(res.ok, f"validate_spec({spec_name}) returns ok=True",
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
        for needle in ["spec_version", "grammar_family",
                       "severity", "check_method", "check_scope", "system.name"]:
            assert_(needle in msgs,
                    f"error message mentions '{needle}' (msgs: {msgs[:200]})")
    Path(bad_path).unlink(missing_ok=True)


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
    project = HERE.parent
    artifact = project / "swiss-library" / "components" / "list-item-default.svg"
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
    project = HERE.parent
    artifact = project / "wireframe-library" / "layouts" / "dashboard-mobile.svg"
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


# ─── test: register/unregister round-trip ──────────────────────────

def test_register_unregister_roundtrip():
    section("register/unregister round-trip")
    # We don't want to mutate the real registry; instead, point the env var
    # at a temp registry seeded from the real one.
    import os
    import shutil
    from design_system_skill import paths as paths_mod
    project = HERE.parent
    real_registry = project / "registry.yaml"
    with tempfile.TemporaryDirectory() as td:
        # Mirror the project layout so library_root resolution works.
        td_path = Path(td)
        # Copy registry to temp so we can mutate it.
        temp_registry = td_path / "registry.yaml"
        shutil.copy2(real_registry, temp_registry)
        # Symlink the spec files we care about. macOS sandbox may not allow
        # symlinks freely; use copies as a fallback.
        for spec in ["swiss-spec.yaml", "swiss-library"]:
            src = project / spec
            dst = td_path / spec
            try:
                if src.is_dir():
                    shutil.copytree(src, dst)
                else:
                    shutil.copy2(src, dst)
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
            # Re-register
            reg = register_system(td_path / "swiss-spec.yaml")
            assert_(reg.ok, "re-register swiss-spec succeeds",
                    json.dumps(reg.to_dict(), default=str)[:300] if not reg.ok else "")
            ls3 = list_systems()
            assert_(ls3.ok and "swiss" in [d["id"] for d in ls3.data],
                    "swiss is back in listing after register")
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
    test_get_rulebook()
    test_check_compliance_swiss_component()
    test_check_compliance_wireframe_pattern()
    test_check_compliance_unknown_artifact()
    test_register_unregister_roundtrip()

    print(f"\n{'=' * 50}")
    print(f"Total: {PASSED + FAILED}  Passed: {PASSED}  Failed: {FAILED}")
    return 0 if FAILED == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
