"""design-system-skill — registry, schema validation, and library resolution
for tkr-kit's design systems.

See ../SKILL.md for the operation interface and architectural rationale.

Public API:

    from design_system_skill import (
        load_system, list_systems, validate_spec,
        register_system, unregister_system,
        get_rulebook, check_compliance,
        check_drift, check_drift_all, read_spec_with_tokens,
        check_color_gates_for_spec, check_color_gates_all,
        check_jsx_drift,
        Result,
    )

Colour gates (WCAG contrast, accent/danger hue): see contrast.py.

Token contract and token files: see contract.py, token_file.py and
docs/specs/SCHEMA-V0.3.md / docs/specs/TOKENS.md.

All operations return a `Result` (see `errors.py`):

    result = load_system("swiss")
    if result.ok:
        spec = result.data
    else:
        for err in result.errors:
            print(err.code, err.message)
"""

from .errors import Result, Error
from .loader import load_system
from .registry import list_systems, register_system, unregister_system
from .validation import validate_spec
from .rulebook import get_rulebook, check_compliance
from .drift import check_drift, check_drift_all
from .contrast import check_color_gates_all, check_color_gates_for_spec
from .token_file import read_spec_with_tokens
from .jsx_drift import check_jsx_drift
from .tokens import (
    Contract,
    load_contract,
    validate_common_tokens,
    resolve_token,
    UnknownTokenError,
    CrossSystemTokenError,
    MalformedTokenRefError,
)

__all__ = [
    "Result",
    "Error",
    "load_system",
    "list_systems",
    "validate_spec",
    "register_system",
    "unregister_system",
    "get_rulebook",
    "check_compliance",
    "check_drift",
    "check_drift_all",
    "check_color_gates_for_spec",
    "check_color_gates_all",
    "read_spec_with_tokens",
    "check_jsx_drift",
    # Common token contract (v1.0+)
    "Contract",
    "load_contract",
    "validate_common_tokens",
    "resolve_token",
    "UnknownTokenError",
    "CrossSystemTokenError",
    "MalformedTokenRefError",
]
