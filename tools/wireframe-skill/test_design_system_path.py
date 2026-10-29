"""Tests for wireframe_skill._design_system_path (layout discovery).

Run from the repository root:
    uv run pytest -q tools/wireframe-skill/test_design_system_path.py
"""

from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from wireframe_skill._design_system_path import candidate_dirs, ensure_importable  # noqa: E402


def _package(root: Path) -> Path:
    (root / "design_system_skill").mkdir(parents=True)
    (root / "design_system_skill" / "__init__.py").write_text("")
    return root


def test_repository_layout(tmp_path: Path):
    here = tmp_path / "tools" / "wireframe-skill" / "wireframe_skill"
    here.mkdir(parents=True)
    target = _package(tmp_path / "tools" / "design-system-skill")
    assert ensure_importable(here, env={}) == target
    assert str(target) in sys.path
    sys.path.remove(str(target))


def test_skill_bundle_layout(tmp_path: Path):
    here = tmp_path / "skills" / "wireframe-skill" / "scripts" / "wireframe_skill"
    here.mkdir(parents=True)
    target = _package(tmp_path / "skills" / "design-system-skill" / "scripts")
    assert ensure_importable(here, env={}) == target
    sys.path.remove(str(target))


def test_env_override_wins(tmp_path: Path):
    here = tmp_path / "tools" / "wireframe-skill" / "wireframe_skill"
    here.mkdir(parents=True)
    _package(tmp_path / "tools" / "design-system-skill")
    override = _package(tmp_path / "elsewhere")
    assert candidate_dirs(here, {"DESIGN_SYSTEM_SKILL_DIR": str(override)})[0] == override
    assert ensure_importable(here, env={"DESIGN_SYSTEM_SKILL_DIR": str(override)}) == override
    sys.path.remove(str(override))


def test_nothing_found(tmp_path: Path):
    here = tmp_path / "a" / "b" / "wireframe_skill"
    here.mkdir(parents=True)
    assert ensure_importable(here, env={}) is None
