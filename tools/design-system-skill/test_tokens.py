"""Tests for the common token contract: load_contract, validate_common_tokens, resolve_token.

Phase A tracer for the common-tokens.v1 contract. These tests use small
in-memory fixture specs so they're isolated from the 8 real system specs;
Phase A.5 migrations will produce a parallel set of fixtures driven from
the real specs.

Run from the repository root:
    uv run pytest -q tools/design-system-skill/test_tokens.py
"""

from __future__ import annotations
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from design_system_skill import (  # noqa: E402
    load_contract,
    validate_common_tokens,
    resolve_token,
    UnknownTokenError,
    CrossSystemTokenError,
    MalformedTokenRefError,
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
        # Under pytest a counted failure would pass silently; fail the test instead.
        if "pytest" in sys.modules:
            raise AssertionError(f"{label}: {detail}" if detail else label)


def section(title: str) -> None:
    print(f"\n{title}")
    print("─" * len(title))


# ─── Fixtures ───────────────────────────────────────────────────────


def valid_swiss_like_spec() -> dict:
    """Minimal spec with a well-formed tokens.common subtree (Swiss-shaped)."""
    return {
        "spec_version": "0.2",
        "system": {"id": "swiss"},
        "common_tokens_version": "1.0",
        "tokens": {
            # Legacy structure preserved (not touched by the contract):
            "colors": {"page_bg": "#FFFFFF"},
            # Portable common layer:
            "common": {
                "color": {
                    "ink":               "#000000",
                    "ink-muted":         "#666666",
                    "surface":           "#FFFFFF",
                    "surface-inset":     "#F5F5F5",
                    "accent":            "#E3000B",
                    "accent-on":         "#FFFFFF",
                    "outline":           "#E0E0E0",
                    "outline-strong":    "#000000",
                    "image-placeholder": "#DCDCD6",
                },
                "typography": {
                    "display":  {"family": "Inter", "size": 40, "weight": 700, "leading": 1.05, "case": "mixed"},
                    "headline": {"family": "Inter", "size": 32, "weight": 700},
                    "title":    {"family": "Inter", "size": 22, "weight": 700},
                    "body":     {"family": "Inter", "size": 14, "weight": 400},
                    "caption":  {"family": "Inter", "size": 9,  "weight": 400, "case": "uppercase"},
                },
                "spacing": {"xs": 4, "sm": 8, "md": 16, "lg": 24, "xl": 48},
                "stroke":  {"hairline": 0.5, "regular": 1, "bold": 2},
                "radius":  {"none": 0, "sm": 2, "md": 4, "full": 9999},
            },
            "system": {
                "grid": {"columns": 12, "gutter": 24, "margin": 48},
                "headline-stroke-overlay": True,
            },
        },
    }


def legacy_spec_without_common() -> dict:
    return {
        "spec_version": "0.2",
        "system": {"id": "legacy"},
        "tokens": {"colors": {"page_bg": "#FFFFFF"}},
    }


# ─── load_contract ──────────────────────────────────────────────────


def test_load_contract():
    section("load_contract")
    c = load_contract("1.0")
    assert_(c.version == "1.0", "contract reports version 1.0", c.version)
    assert_("ink" in c.required["color"], "ink is required color")
    assert_("display" in c.required["typography"], "display is required typography")
    assert_("md" in c.required["spacing"], "md is required spacing")
    assert_("code" in c.optional.get("typography", {}), "code is optional typography")
    assert_(c.is_required("color", "ink"), "is_required('color', 'ink') is True")
    assert_(not c.is_required("color", "code"), "is_required('color', 'code') is False")


# ─── validate_common_tokens ─────────────────────────────────────────


def test_validate_legacy_spec_is_silent():
    section("validate_common_tokens — legacy spec without tokens.common")
    spec = legacy_spec_without_common()
    errors = validate_common_tokens(spec)
    assert_(errors == [], "legacy spec (no tokens.common) produces zero errors", str(errors))


def test_validate_valid_spec_is_silent():
    section("validate_common_tokens — well-formed spec")
    spec = valid_swiss_like_spec()
    errors = validate_common_tokens(spec)
    assert_(errors == [], "valid swiss-shaped spec produces zero errors", str([(e.code, e.message) for e in errors]))


def test_validate_catches_missing_required():
    section("validate_common_tokens — missing required token")
    spec = valid_swiss_like_spec()
    del spec["tokens"]["common"]["color"]["ink"]
    errors = validate_common_tokens(spec)
    codes = {e.code for e in errors}
    assert_("COMMON_TOKENS_MISSING_TOKEN" in codes, "missing $ink produces MISSING_TOKEN", str(codes))


def test_validate_catches_missing_category():
    section("validate_common_tokens — missing required category")
    spec = valid_swiss_like_spec()
    del spec["tokens"]["common"]["spacing"]
    errors = validate_common_tokens(spec)
    codes = {e.code for e in errors}
    assert_("COMMON_TOKENS_MISSING_CATEGORY" in codes, "missing spacing category produces MISSING_CATEGORY", str(codes))


def test_validate_catches_bad_color():
    section("validate_common_tokens — malformed hex color")
    spec = valid_swiss_like_spec()
    spec["tokens"]["common"]["color"]["ink"] = "not-a-hex"
    errors = validate_common_tokens(spec)
    codes = {e.code for e in errors}
    assert_("COMMON_TOKENS_BAD_COLOR" in codes, "non-hex ink produces BAD_COLOR", str(codes))


def test_validate_catches_negative_length():
    section("validate_common_tokens — negative length")
    spec = valid_swiss_like_spec()
    spec["tokens"]["common"]["spacing"]["md"] = -16
    errors = validate_common_tokens(spec)
    codes = {e.code for e in errors}
    assert_("COMMON_TOKENS_BAD_LENGTH" in codes, "negative spacing produces BAD_LENGTH", str(codes))


def test_validate_catches_text_style_missing_field():
    section("validate_common_tokens — text-style missing 'weight'")
    spec = valid_swiss_like_spec()
    del spec["tokens"]["common"]["typography"]["body"]["weight"]
    errors = validate_common_tokens(spec)
    codes = {e.code for e in errors}
    assert_("COMMON_TOKENS_TEXT_STYLE_MISSING_FIELD" in codes, "body missing weight is flagged", str(codes))


def test_validate_catches_bad_weight():
    section("validate_common_tokens — text-style weight out of range")
    spec = valid_swiss_like_spec()
    spec["tokens"]["common"]["typography"]["body"]["weight"] = 50
    errors = validate_common_tokens(spec)
    codes = {e.code for e in errors}
    assert_("COMMON_TOKENS_TEXT_STYLE_BAD_WEIGHT" in codes, "weight=50 is rejected", str(codes))


def test_validate_catches_unknown_token():
    section("validate_common_tokens — typo'd token name")
    spec = valid_swiss_like_spec()
    spec["tokens"]["common"]["color"]["ink-mute"] = "#888888"  # typo of ink-muted
    errors = validate_common_tokens(spec)
    codes = {e.code for e in errors}
    assert_("COMMON_TOKENS_UNKNOWN_TOKEN" in codes, "ink-mute typo is flagged as unknown", str(codes))


# ─── resolve_token (portable refs) ──────────────────────────────────


def test_resolve_bare_color_ref():
    section("resolve_token — bare $ink")
    spec = valid_swiss_like_spec()
    v = resolve_token(spec, "$ink")
    assert_(v == "#000000", f"$ink resolves to #000000 (got {v!r})")


def test_resolve_explicit_color_ref():
    section("resolve_token — $color.ink")
    spec = valid_swiss_like_spec()
    v = resolve_token(spec, "$color.ink")
    assert_(v == "#000000", f"$color.ink resolves to #000000 (got {v!r})")


def test_resolve_type_ref():
    section("resolve_token — $type.headline")
    spec = valid_swiss_like_spec()
    v = resolve_token(spec, "$type.headline")
    assert_(isinstance(v, dict) and v.get("size") == 32, f"$type.headline resolves to dict with size=32 (got {v!r})")


def test_resolve_space_ref():
    section("resolve_token — $space.md")
    spec = valid_swiss_like_spec()
    v = resolve_token(spec, "$space.md")
    assert_(v == 16, f"$space.md resolves to 16 (got {v!r})")


def test_resolve_stroke_and_radius():
    section("resolve_token — $stroke.bold + $radius.full")
    spec = valid_swiss_like_spec()
    s = resolve_token(spec, "$stroke.bold")
    r = resolve_token(spec, "$radius.full")
    assert_(s == 2, f"$stroke.bold = 2 (got {s!r})")
    assert_(r == 9999, f"$radius.full = 9999 (got {r!r})")


def test_resolve_unknown_token_raises():
    section("resolve_token — unknown token raises UnknownTokenError")
    spec = valid_swiss_like_spec()
    try:
        resolve_token(spec, "$nonexistent")
        assert_(False, "$nonexistent should have raised")
    except UnknownTokenError as e:
        assert_(True, f"raised UnknownTokenError: {e}")


def test_resolve_malformed_namespace_raises():
    section("resolve_token — unknown namespace raises MalformedTokenRefError")
    spec = valid_swiss_like_spec()
    try:
        resolve_token(spec, "$weird.headline")
        assert_(False, "$weird.headline should have raised")
    except MalformedTokenRefError as e:
        assert_(True, f"raised MalformedTokenRefError: {e}")


def test_resolve_missing_dollar_raises():
    section("resolve_token — portable ref without $ raises")
    spec = valid_swiss_like_spec()
    try:
        resolve_token(spec, "ink")
        assert_(False, "should have raised")
    except MalformedTokenRefError as e:
        assert_(True, f"raised: {e}")


# ─── resolve_token (system-scoped refs) ─────────────────────────────


def test_resolve_system_ref_with_matching_scope():
    section("resolve_token — swiss:grid.columns with scope='swiss'")
    spec = valid_swiss_like_spec()
    v = resolve_token(spec, "swiss:grid.columns", scope="swiss")
    assert_(v == 12, f"swiss:grid.columns resolves to 12 (got {v!r})")


def test_resolve_system_ref_in_portable_scope_is_rejected():
    section("resolve_token — system ref rejected in portable scope")
    spec = valid_swiss_like_spec()
    try:
        resolve_token(spec, "swiss:grid.columns", scope="portable")
        assert_(False, "should have raised CrossSystemTokenError")
    except CrossSystemTokenError as e:
        assert_(True, f"raised: {e}")


def test_resolve_cross_system_ref_is_rejected():
    section("resolve_token — riso:foo in swiss scope is rejected")
    spec = valid_swiss_like_spec()
    try:
        resolve_token(spec, "riso:separation-1", scope="swiss")
        assert_(False, "should have raised CrossSystemTokenError")
    except CrossSystemTokenError as e:
        assert_(True, f"raised: {e}")


def test_resolve_system_path_walks_nested():
    section("resolve_token — dotted system path walks nested dicts")
    spec = valid_swiss_like_spec()
    v = resolve_token(spec, "swiss:grid.gutter", scope="swiss")
    assert_(v == 24, f"swiss:grid.gutter = 24 (got {v!r})")


# ─── Sanity: rejects raw hex / raw px masquerading as tokens ────────


def test_resolve_raw_hex_is_rejected():
    section("resolve_token — raw '#000000' is not a token reference")
    spec = valid_swiss_like_spec()
    try:
        resolve_token(spec, "#000000")
        assert_(False, "should have raised")
    except MalformedTokenRefError:
        assert_(True, "raw hex is rejected as malformed")


# ─── Runner ─────────────────────────────────────────────────────────


if __name__ == "__main__":
    test_load_contract()
    test_validate_legacy_spec_is_silent()
    test_validate_valid_spec_is_silent()
    test_validate_catches_missing_required()
    test_validate_catches_missing_category()
    test_validate_catches_bad_color()
    test_validate_catches_negative_length()
    test_validate_catches_text_style_missing_field()
    test_validate_catches_bad_weight()
    test_validate_catches_unknown_token()
    test_resolve_bare_color_ref()
    test_resolve_explicit_color_ref()
    test_resolve_type_ref()
    test_resolve_space_ref()
    test_resolve_stroke_and_radius()
    test_resolve_unknown_token_raises()
    test_resolve_malformed_namespace_raises()
    test_resolve_missing_dollar_raises()
    test_resolve_system_ref_with_matching_scope()
    test_resolve_system_ref_in_portable_scope_is_rejected()
    test_resolve_cross_system_ref_is_rejected()
    test_resolve_system_path_walks_nested()
    test_resolve_raw_hex_is_rejected()

    print(f"\n{'='*40}")
    print(f"  {PASSED} passed, {FAILED} failed")
    print(f"{'='*40}\n")
    sys.exit(1 if FAILED else 0)
