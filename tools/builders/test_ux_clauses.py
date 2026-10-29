"""Discriminating tests for the UX-philosophy clauses in rulebook_check.py.

Run:
    uv run pytest -q tools/builders/test_ux_clauses.py

Rule of record: claude.md § UX Philosophy. Three of its clauses are encoded
as mechanical checks; this file proves each one FAILS on an artifact that
violates it. A clause with no failing fixture is not enforced, it is
decorative — so every clause here is driven from both sides, by a violating
fixture and its clean twin under fixtures/ux/ beside rulebook_check.py.

No mocks: every case reads a real SVG off disk through the real checker,
the shipped populations are swept from systems/, and the CLI case shells
out to the entry point CI runs. The fixtures are authored SVGs — the
artifact under test, not a substitute for one. They are shared byte-for-byte
with tkr-kit, whose core/design/rulebook parity test reads them.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
# Repository layout: this file sits beside rulebook_check.py in tools/builders/.
# Skill-bundle layout (tkr-kit's vendored copy): it sits in <skill>/scripts/
# and rulebook_check.py in <skill>/tooling/.
TOOLING = HERE if (HERE / "rulebook_check.py").is_file() else HERE.parent / "tooling"
sys.path.insert(0, str(TOOLING))

import rulebook_check as rb  # noqa: E402

RULEBOOK_CHECK = TOOLING / "rulebook_check.py"
FIXTURES = TOOLING / "fixtures" / "ux"
WIREFRAME = rb.system_dir("wireframe")
# systems/ (repository) or libraries/ (skill bundle): every system's directory.
SYSTEMS = WIREFRAME.parent

# 85 shipped layouts measured 2026-10-28 across every system; the floor keeps
# a sweep over a moved or emptied directory from passing by examining nothing.
MIN_SHIPPED_LAYOUTS = 80
# 7 shipped `*-required` components measured 2026-10-28.
MIN_SHIPPED_REQUIRED = 7

_PROBE = "<svg></svg>"


def run_check(check_fn, path: Path) -> dict:
    """Run one check against a real file on disk.

    Args:
        check_fn: A rulebook check function.
        path: SVG to read.

    Returns:
        The check's result dict.
    """
    return check_fn(path.read_text())


def test_every_fixture_has_its_twin() -> None:
    """The eight fixtures exist: four violating, four clean (incl. the catalog sheet)."""
    names = sorted(p.name for p in FIXTURES.glob("*.svg"))
    assert names == [
        "catalog-sheet-with-toast.svg",
        "confirm-dialog-no-undo.svg",
        "confirm-dialog-with-undo.svg",
        "required-label-marked.svg",
        "required-label-mixed.svg",
        "required-label-unmarked.svg",
        "toast-absent.svg",
        "toast-placed.svg",
    ]


# ─── ux-no-toast-notifications ─────────────────────────────────────

def test_placed_toast_fails_and_names_the_component() -> None:
    bad = run_check(rb.check_ux_no_toast, FIXTURES / "toast-placed.svg")
    assert not bad["passed"], bad
    assert bad["violations"] == ["toast-success"]
    assert bad["exempt"] is None


def test_inline_status_twin_passes() -> None:
    good = run_check(rb.check_ux_no_toast, FIXTURES / "toast-absent.svg")
    assert good["passed"], good
    assert good["inventory_source"] == "group-ids"


def test_toast_clause_does_not_run_on_a_component_fragment() -> None:
    """Authoring the primitive is not the violation; placing one in a screen is."""
    fragment = WIREFRAME / "components" / "toast-error.svg"
    assert fragment.exists()
    scope = rb.detect_scope(str(fragment))
    assert scope == "component"
    selected = rb._select_checks(rb.CHECKS_BY_RULESET["wireframe"], scope)
    assert rb.check_ux_no_toast not in [fn for fn, _ in selected]
    # ...while the fragment itself would fail if the clause did run on it.
    assert not run_check(rb.check_ux_no_toast, fragment)["passed"]


# ─── ux-no-confirm-dialog-without-undo ─────────────────────────────

def test_are_you_sure_dialog_without_undo_fails() -> None:
    bad = run_check(rb.check_ux_confirm_dialog_has_undo, FIXTURES / "confirm-dialog-no-undo.svg")
    assert not bad["passed"], bad
    assert bad["violations"] == ["modal-confirmation"]
    assert bad["undo_affordance"] is False


def test_undo_row_twin_passes() -> None:
    good = run_check(rb.check_ux_confirm_dialog_has_undo, FIXTURES / "confirm-dialog-with-undo.svg")
    assert good["passed"], good
    assert good["undo_affordance"] is True


def test_no_shipped_layout_confirms_with_a_dialog() -> None:
    """Swept, not sampled: no layout in ANY system carries a dialog without undo.

    The wireframe library shipped layouts/modal-confirmation.svg — an "Are you
    sure?" dialog with Cancel/Delete — until it was replaced by the
    deferred-commit undo row (layouts/undo-row-default.svg).
    """
    layouts = sorted(SYSTEMS.glob("*/layouts/*.svg"))
    assert len(layouts) >= MIN_SHIPPED_LAYOUTS, len(layouts)
    offenders = [str(f.relative_to(SYSTEMS)) for f in layouts
                 if not run_check(rb.check_ux_confirm_dialog_has_undo, f)["passed"]]
    assert offenders == []


def test_shipped_undo_row_layout_passes_on_a_real_inventory() -> None:
    layouts = WIREFRAME / "layouts"
    replacement = layouts / "undo-row-default.svg"
    assert replacement.exists()
    live = run_check(rb.check_ux_confirm_dialog_has_undo, replacement)
    assert live["passed"] and live["undo_affordance"] is True, live
    assert live["inventory_source"] != "none"
    assert not (layouts / "modal-confirmation.svg").exists()


# ─── ux-required-fields-indicated ──────────────────────────────────

def test_unmarked_required_field_fails() -> None:
    bad = run_check(rb.check_ux_required_field_indicated, FIXTURES / "required-label-unmarked.svg")
    assert not bad["passed"], bad
    assert bad["examined"] == 1


def test_marked_required_field_passes() -> None:
    good = run_check(rb.check_ux_required_field_indicated, FIXTURES / "required-label-marked.svg")
    assert good["passed"], good
    assert good["examined"] == 1


def test_indicator_is_scoped_per_component() -> None:
    """A whole-artifact asterisk search would pass this file; the subtree scope must not."""
    mixed = run_check(rb.check_ux_required_field_indicated, FIXTURES / "required-label-mixed.svg")
    assert not mixed["passed"], mixed
    assert mixed["examined"] == 2


def test_nested_groups_do_not_merge_component_subtrees() -> None:
    """The subtree walk balances <g> tags rather than stopping at the first </g>."""
    nested = (
        '<svg viewBox="0 0 100 100">\n'
        '<g id="a__label-required_0" transform="translate(0,0)">\n'
        '  <g transform="translate(1,1)"><text x="0" y="10">Email <tspan>*</tspan></text></g>\n'
        '</g>\n'
        '<g id="b__label-required_1" transform="translate(0,50)">\n'
        '  <g transform="translate(1,1)"><text x="0" y="10">Postal code</text></g>\n'
        '</g>\n'
        '</svg>'
    )
    blocks = rb._component_blocks(nested)
    assert len(blocks) == 2
    assert "Postal code" not in blocks[0][1] and "Email" not in blocks[1][1]
    res = rb.check_ux_required_field_indicated(nested)
    assert not res["passed"] and res["examined"] == 2, res


def test_every_shipped_required_component_renders_its_indicator() -> None:
    shipped = sorted(SYSTEMS.glob("*/components/*required*.svg"))
    assert len(shipped) >= MIN_SHIPPED_REQUIRED, len(shipped)
    offenders = [str(f.relative_to(SYSTEMS)) for f in shipped
                 if not run_check(rb.check_ux_required_field_indicated, f)["passed"]]
    assert offenders == []


# ─── the catalog exemption ─────────────────────────────────────────

def test_catalog_sheet_is_exempt_and_says_so() -> None:
    fixture = FIXTURES / "catalog-sheet-with-toast.svg"
    toast = run_check(rb.check_ux_no_toast, fixture)
    dialog = run_check(rb.check_ux_confirm_dialog_has_undo, fixture)
    assert toast["passed"] and toast["exempt"] == "catalog-sheet", toast
    assert dialog["passed"] and dialog["exempt"] == "catalog-sheet", dialog


def test_deleting_the_catalog_marker_restores_the_finding() -> None:
    """The exemption is a marker in the artifact, not a filename allowlist."""
    fixture = FIXTURES / "catalog-sheet-with-toast.svg"
    without_marker = "\n".join(
        line for line in fixture.read_text().splitlines() if "CATALOG-SHEET" not in line
    )
    restored = rb.check_ux_no_toast(without_marker)
    assert not restored["passed"] and restored["exempt"] is None, restored


def test_shipped_contact_sheet_carries_the_marker() -> None:
    sheet = WIREFRAME / "contact-sheet.svg"
    assert sheet.exists()
    assert run_check(rb.check_ux_no_toast, sheet)["exempt"] == "catalog-sheet"


# ─── inventory: a vacuous pass must be visibly vacuous ─────────────

def test_unnamed_artifact_reports_inventory_source_none() -> None:
    blank = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>'
    assert rb.extract_component_inventory(blank) == ([], "none")
    res = rb.check_ux_no_toast(blank)
    assert res["passed"] and res["inventory_source"] == "none"


@pytest.mark.parametrize(("svg", "expected"), [
    ("<!-- ==================== LABEL-REQUIRED ==================== -->",
     (["label-required"], "banners")),
    ("<!-- LABEL-REQUIRED -->", (["label-required"], "banners")),
    ('<g id="form__label-required_0" transform="translate(0, 0)"></g>',
     (["label-required"], "group-ids")),
    ("<!-- No title bar; just title + body + actions -->", ([], "none")),
])
def test_both_naming_conventions_are_read_and_prose_is_not(svg: str, expected) -> None:
    assert rb.extract_component_inventory(svg) == expected


# ─── registry complement ───────────────────────────────────────────

def _rule_ids(checks) -> set[str]:
    return {fn(_PROBE)["rule_id"] for fn, _ in checks}


UX_RULE_IDS = _rule_ids(rb.UX_CHECKS)


def test_three_ux_clauses_are_encoded() -> None:
    assert UX_RULE_IDS == {
        "ux-no-toast-notifications",
        "ux-no-confirm-dialog-without-undo",
        "ux-required-fields-indicated",
    }


@pytest.mark.parametrize("ruleset", sorted(rb.CHECKS_BY_RULESET))
def test_every_ruleset_carries_every_ux_clause(ruleset: str) -> None:
    """The live registry is enumerated: _with_ux() is a claim about a helper."""
    assert UX_RULE_IDS <= _rule_ids(rb.CHECKS_BY_RULESET[ruleset])


def test_the_complement_detects_a_ruleset_without_the_clauses() -> None:
    """Drive the complement with an omission so the assertion above can fail."""
    stripped = [c for c in rb.CHECKS_BY_RULESET["wireframe"] if c not in rb.UX_CHECKS]
    assert UX_RULE_IDS - _rule_ids(stripped) == UX_RULE_IDS


def test_ux_rule_ids_can_be_named_in_an_exceptions_file() -> None:
    """Each clause reduces to its offending component ids for allow-list matching."""
    assert UX_RULE_IDS <= rb.known_rule_ids("sketch")
    bad = run_check(rb.check_ux_no_toast, FIXTURES / "toast-placed.svg")
    assert rb.violation_items(bad) == ["toast-success"]


# ─── the real entry point ──────────────────────────────────────────

def _cli(fixture: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(RULEBOOK_CHECK), str(FIXTURES / fixture),
         "--ruleset", "wireframe", "--scope", "artifact"],
        capture_output=True, text=True, check=False,
    )


def test_cli_fails_a_placed_toast() -> None:
    proc = _cli("toast-placed.svg")
    assert proc.returncode == 1, proc.stderr[-400:]
    assert "[FAIL] ux-no-toast-notifications" in proc.stdout
    assert "1 failed" in proc.stdout


def test_cli_passes_the_clean_twin_with_no_failures_at_all() -> None:
    """So the FAIL above is attributable to the toast and nothing else."""
    proc = _cli("toast-absent.svg")
    assert proc.returncode == 0, proc.stdout[-600:]
    assert "[PASS] ux-no-toast-notifications" in proc.stdout
    assert "0 failed" in proc.stdout
