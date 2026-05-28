"""Wireframe generation from briefs with design system integration.

Generates wireframe SVGs from a brief, optionally rendered in a specific
design system. See ../SKILL.md for operation interface and 7-step flow.

Example:
    >>> from wireframe_skill import wireframe
    >>> result = wireframe(
    ...     brief="dashboard for a chat app",
    ...     system="swiss",
    ...     platform="desktop",
    ...     output_dir="./out",
    ... )
    >>> if result.ok:
    ...     print(result.svg_path)
"""

from .generator import wireframe, GenerationResult
from .substitution import (
    extract_text_nodes,
    build_substitution_request,
    validate_substitutions,
    apply_substitutions,
    TextNode,
)
from .decomposition import (
    build_decomposition_request,
    validate_blueprint,
)
from .assembler import assemble_blueprint
from .placement import (
    build_layout_selection_request,
    apply_layout_selection,
)
from .tokens import export_tokens_for_authoring
from .components import read_component, read_components_batch

__all__ = [
    "wireframe",
    "GenerationResult",
    "extract_text_nodes",
    "build_substitution_request",
    "validate_substitutions",
    "apply_substitutions",
    "TextNode",
    "build_decomposition_request",
    "validate_blueprint",
    "assemble_blueprint",
    "build_layout_selection_request",
    "apply_layout_selection",
    "export_tokens_for_authoring",
    "read_component",
    "read_components_batch",
]
