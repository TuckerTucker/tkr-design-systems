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

def _minimal_token_doc(system_id: str = "synthetic") -> dict:
    """Build a token document supplying every contract token with a
    plausible value of the right kind (no file I/O)."""
    from design_system_skill import contract as c
    defaults = {
        c.KIND_COLOR: "#808080",
        c.KIND_PX: 4,
        c.KIND_PX_LIST: [4, 8, 16],
        c.KIND_FONT_STACK: "system-ui, sans-serif",
        c.KIND_SHADOW: "none",
        c.KIND_BLUR: "none",
        c.KIND_ELEVATION_STRATEGY: "borders_only",
    }
    doc: dict = {"contract_version": c.CONTRACT_VERSION, "system": system_id}
    for token in c.CONTRACT_TOKENS:
        if token.kind == c.KIND_TYPE_ROLE:
            value = {"size": 14, "weight": 400, "line_height": 1.5,
                     "tracking": 0, "family": "body", "case": "none"}
        else:
            value = defaults[token.kind]
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
    from design_system_skill.contract import render_contract_table, render_pairs_table
    doc = (HERE.parents[1] / "docs" / "specs" / "SCHEMA-V0.3.md").read_text()
    assert_(render_contract_table() in doc,
            "contract table in SCHEMA-V0.3.md equals render_contract_table()")
    assert_(render_pairs_table() in doc,
            "pairs table in SCHEMA-V0.3.md equals render_pairs_table()")


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
    assert_(kraft_sunset["color"]["accent"] == "#E8C700", "sunset ink-2 sets accent")
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
            doc["color"]["accent"] = "#0000FF"
            tok.write_text(json.dumps(doc))
            second = load_system("swiss")
            assert_(second.ok and second.data["tokens"]["colors"]["accent"] == "#0000FF",
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
                "page_bg": "#FFFFFF",         # token says #808080
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
        assert_(any(d["location"] == "tokens.colors.text_muted" and d["token_value"] == "#949494"
                    for d in drift), f"drift names text_muted vs #949494 ({drift})")

        val = validate_spec(spec_path, library_root=str(spec_path.parent))
        assert_(not val.ok and any(e.code == "TOKEN_DRIFT" for e in val.errors),
                "validate_spec fails with TOKEN_DRIFT")

        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            drift_exit = cli.main(["drift", "--spec", str(spec_path)])
        assert_(drift_exit == 1, f"CLI exits 1 on drift (got {drift_exit})")
        assert_("text_muted" in out.getvalue(), "CLI output names the drifting key")


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
    test_register_unregister_roundtrip()
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

    print(f"\n{'=' * 50}")
    print(f"Total: {PASSED + FAILED}  Passed: {PASSED}  Failed: {FAILED}")
    return 0 if FAILED == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
