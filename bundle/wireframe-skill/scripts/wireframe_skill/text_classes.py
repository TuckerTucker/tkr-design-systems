"""The shared text-class vocabulary: CSS class -> contract colour token.

Library SVGs, ``export_tokens_for_authoring``'s CSS class block and
blueprint atoms all colour text through these classes rather than inline
``fill`` attributes (rule ``wireframe-css-classes-not-inline-fills``), so a
colour change is made once, at the class definition. This module is the
one home of the mapping; it imports nothing from the package so the atom
renderer and the token exporter can both depend on it.
"""

from __future__ import annotations

CLASS_TOKENS: tuple[tuple[str, str], ...] = (
    ("text-primary", "text_primary"),
    ("text-secondary", "text_secondary"),
    ("text-disabled", "text_muted"),
    ("text-inverse", "text_inverse"),
    ("text-danger", "danger"),
    ("text-success", "success"),
    ("text-warning", "warning"),
    ("text-info", "info"),
)
"""CSS class -> token in the contract's ``color`` group, in style-block order."""

_CLASS_BY_CONTRACT_TOKEN: dict[str, str] = {token: cls for cls, token in CLASS_TOKENS}


def class_for_contract_color(contract_path: str) -> str | None:
    """Return the shared text class for a contract colour path, if one exists.

    Args:
        contract_path: Token path in the contract, e.g. ``color.text_primary``
            (the form ``common_tokens.COLOR_SOURCES`` maps portable names to).

    Returns:
        The class name (e.g. ``text-primary``), or None when no shared class
        carries that colour.
    """
    group, _, name = contract_path.partition(".")
    if group != "color":
        return None
    return _CLASS_BY_CONTRACT_TOKEN.get(name)
