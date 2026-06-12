"""Locate the systems root and the registry file.

The registry lives at `<repo>/systems/registry.yaml`, alongside the
system library directories its entries point to. This module
centralizes path resolution so other modules don't recompute it
inconsistently.

The systems root is detected by walking up from this file's location
until a directory containing `registry.yaml` — directly or in a
`systems/` child — is found, falling back to `<repo>/systems` derived
from this file's location if the registry doesn't exist yet (initial
bootstrap case).
"""

from __future__ import annotations
import os
from pathlib import Path

import structlog

logger = structlog.get_logger(__name__)


_ENV_OVERRIDE = "DESIGN_SYSTEM_SKILL_REGISTRY"


def project_root() -> Path:
    """Return the directory containing (or that should contain) registry.yaml.

    Registry entries (spec, library_root) resolve relative to this
    directory, so it must be the directory the registry file lives in —
    `<repo>/systems` in the canonical layout.

    Resolution order:
        1. If $DESIGN_SYSTEM_SKILL_REGISTRY is set, use the directory of that file.
        2. Walk up from this file's location looking for registry.yaml,
           directly in an ancestor or in an ancestor's systems/ child.
        3. Fall back to <repo>/systems derived from this file's location.

    Returns:
        The systems root Path.
    """
    env = os.environ.get(_ENV_OVERRIDE)
    if env:
        return Path(env).expanduser().resolve().parent

    here = Path(__file__).resolve()
    # Walk up from <repo>/tools/design-system-skill/design_system_skill/paths.py
    # looking for a directory containing registry.yaml, either directly
    # (env-style custom layouts) or in a systems/ child (canonical layout).
    for parent in here.parents:
        if (parent / "registry.yaml").exists():
            return parent
        if (parent / "systems" / "registry.yaml").exists():
            return parent / "systems"
    # Bootstrap fallback: <repo>/systems, whether or not it exists yet.
    # here.parents = [design_system_skill, design-system-skill, tools, <repo>, ...]
    return here.parents[3] / "systems"


def registry_path() -> Path:
    """Return the absolute path to registry.yaml.

    Returns:
        The Path to registry.yaml (whether or not it exists).
    """
    env = os.environ.get(_ENV_OVERRIDE)
    if env:
        return Path(env).expanduser().resolve()
    return project_root() / "registry.yaml"
