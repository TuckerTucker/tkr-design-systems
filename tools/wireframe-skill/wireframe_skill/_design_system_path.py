"""Make the design-system-skill package importable.

The wireframe skill depends on ``design_system_skill`` without either being
installed as a wheel. Two layouts are supported, probed in order:

1. Repository layout (this repo): the skills are siblings under ``tools/``::

       tools/wireframe-skill/wireframe_skill/      ← this package
       tools/design-system-skill/                  ← target

2. Skill-bundle layout (Claude Code skills, e.g. tkr-kit's vendored copy)::

       <skills>/wireframe-skill/scripts/wireframe_skill/
       <skills>/design-system-skill/scripts/       ← target

``$DESIGN_SYSTEM_SKILL_DIR`` wins over both when set.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def candidate_dirs(here: Path, env: dict[str, str]) -> list[Path]:
    """Return the directories that may hold the ``design_system_skill`` package.

    Args:
        here: This package's directory (``.../wireframe_skill``).
        env: Environment mapping (injected so tests can drive it).

    Returns:
        Candidate directories in priority order.
    """
    out: list[Path] = []
    if env.get("DESIGN_SYSTEM_SKILL_DIR"):
        out.append(Path(env["DESIGN_SYSTEM_SKILL_DIR"]).expanduser())
    # here.parents = [wireframe-skill | scripts, tools | wireframe-skill, <repo> | <skills>]
    out.append(here.parents[1] / "design-system-skill")
    if len(here.parents) >= 3:
        out.append(here.parents[2] / "design-system-skill" / "scripts")
    return out


def ensure_importable(here: Path | None = None, env: dict[str, str] | None = None) -> Path | None:
    """Put the first candidate holding ``design_system_skill`` on ``sys.path``.

    Args:
        here: Package directory; defaults to this module's directory.
        env: Environment mapping; defaults to ``os.environ``.

    Returns:
        The directory used, or ``None`` when no candidate holds the package
        (an already-importable install is then relied on).
    """
    here = here or Path(__file__).resolve().parent
    for d in candidate_dirs(here, dict(os.environ) if env is None else env):
        if (d / "design_system_skill" / "__init__.py").exists():
            if str(d) not in sys.path:
                sys.path.insert(0, str(d))
            return d
    return None
