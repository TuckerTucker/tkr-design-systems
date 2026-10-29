"""Repository-wide pytest configuration.

The design-system registry overlays a per-user file
(``~/.claude/design-systems/registry.yaml``) on the built-in
``systems/registry.yaml``. A developer's own overlay must not leak into
the suite (it would add systems the tests do not know about), so every
test session points the overlay at an empty temporary directory. Tests
that exercise the overlay set ``DESIGN_SYSTEM_SKILL_USER_REGISTRY``
themselves.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

_OVERLAY_DIR = tempfile.TemporaryDirectory(prefix="dss-user-registry-")


def pytest_configure(config: pytest.Config) -> None:
    """Point the user registry overlay at an empty temp path for the session."""
    os.environ["DESIGN_SYSTEM_SKILL_USER_REGISTRY"] = str(
        Path(_OVERLAY_DIR.name) / "registry.yaml")


def pytest_unconfigure(config: pytest.Config) -> None:
    """Remove the session's overlay directory."""
    _OVERLAY_DIR.cleanup()
