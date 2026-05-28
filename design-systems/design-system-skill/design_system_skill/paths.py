"""Locate the project root and the registry file.

For tkr-kit's draft, the registry lives at the project root as
`registry.yaml`. This module centralizes path resolution so other
modules don't recompute it inconsistently.

The project root is detected by walking up from this file's location
until a directory containing `registry.yaml` is found, falling back to
the parent of design-system-skill/ if the registry doesn't exist yet
(initial bootstrap case).
"""

from __future__ import annotations
import os
from pathlib import Path

import structlog

logger = structlog.get_logger(__name__)


_ENV_OVERRIDE = "DESIGN_SYSTEM_SKILL_REGISTRY"


def project_root() -> Path:
    """Return the directory containing (or that should contain) registry.yaml.

    Resolution order:
        1. If $DESIGN_SYSTEM_SKILL_REGISTRY is set, use the directory of that file.
        2. Walk up from this file's location looking for registry.yaml.
        3. Fall back to the grandparent of design_system_skill/.

    Returns:
        The project root Path.
    """
    env = os.environ.get(_ENV_OVERRIDE)
    if env:
        return Path(env).expanduser().resolve().parent

    here = Path(__file__).resolve()
    # Walk up from <project>/design-system-skill/design_system_skill/paths.py
    # looking for a directory containing registry.yaml.
    for parent in here.parents:
        if (parent / "registry.yaml").exists():
            return parent
    # Bootstrap fallback: the project root is the parent of design-system-skill/.
    # here.parents = [design_system_skill, design-system-skill, <project_root>, ...]
    return here.parents[2]


def registry_path() -> Path:
    """Return the absolute path to registry.yaml.

    Returns:
        The Path to registry.yaml (whether or not it exists).
    """
    env = os.environ.get(_ENV_OVERRIDE)
    if env:
        return Path(env).expanduser().resolve()
    return project_root() / "registry.yaml"
