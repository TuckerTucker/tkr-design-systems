"""Token-driven SVG library engine (GitHub issue #5).

One engine renders every design system's component library and layout
patterns from per-system data modules (``engine.systems.<id>``) and the
system's token file (``systems/<id>/tokens.json``, issue #4):

    discovery  — systems from ``systems/registry.yaml`` (aliases folded)
    plugin     — per-system ``BUILDER`` data: loading + shape validation
    templates  — ``{token.path}`` placeholders, ``<defs>``, SVG envelope
    runner     — render in memory, write, compare with committed files

The CLI is ``tools/builders/build.py``.
"""

from __future__ import annotations

import sys
from pathlib import Path

# The design-system-skill package: ``tools/design-system-skill`` in the
# repository layout, ``<skill>/scripts`` in the skill-bundle layout (where
# this engine sits under ``<skill>/tooling/``).
_ROOT = Path(__file__).resolve().parents[2]
_DSS = next((d for d in (_ROOT / "design-system-skill", _ROOT / "scripts")
             if (d / "design_system_skill" / "__init__.py").is_file()),
            _ROOT / "design-system-skill")
if str(_DSS) not in sys.path:
    sys.path.insert(0, str(_DSS))

from .discovery import RegistryError, SystemTarget, discover_systems, select_targets  # noqa: E402
from .plugin import BuilderDataError, load_plugin, validate_builder  # noqa: E402
from .runner import (  # noqa: E402
    AllowListError,
    BuildResult,
    RenderedFile,
    build,
    load_orphan_allowlist,
    load_tokens,
    orphan_files,
    render_kind,
    stale_files,
    write_files,
)
from .templates import (  # noqa: E402
    TemplateError,
    TextClass,
    TokenFilter,
    default_wrap,
    resolve,
)

__all__ = [
    "AllowListError",
    "BuildResult",
    "BuilderDataError",
    "RegistryError",
    "RenderedFile",
    "SystemTarget",
    "TemplateError",
    "TextClass",
    "TokenFilter",
    "build",
    "default_wrap",
    "discover_systems",
    "load_plugin",
    "load_orphan_allowlist",
    "load_tokens",
    "orphan_files",
    "render_kind",
    "resolve",
    "select_targets",
    "stale_files",
    "validate_builder",
    "write_files",
]
