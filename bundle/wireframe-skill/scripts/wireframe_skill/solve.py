"""Layout solving via the tkr-kit operations registry.

Pass 1 of the compose flow authors a layout TREE (containers, components,
token-named spacing) instead of literal x/y integers. This module hands that
tree to `design.solve_layout`, which returns positioned boxes plus a blueprint
in exactly the shape `assembler.assemble_blueprint` already consumes.

The solve deliberately lives behind the operation rather than being
reimplemented here: the operation reads the spacing scale from the REGISTERED
design system, so a solve cannot use spacing the system never authored, and one
engine serves every caller.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any, Callable, Mapping

OPERATION = "design.solve_layout"


class LayoutSolveUnavailable(RuntimeError):
    """Raised when no tkr-kit CLI can be located to run the operation."""


class LayoutSolveFailed(RuntimeError):
    """Raised when the operation itself refused or failed."""


def resolve_runner(
    env: Mapping[str, str] | None = None,
    which: Callable[[str], str | None] = shutil.which,
) -> list[str]:
    """Finds the command prefix that runs a tkr-kit operation.

    Resolution order: an explicit TKR_CLI override, the `tkr` wrapper on PATH,
    then a checked-out repo located through TKR_KIT_HOME.

    Args:
        env: Environment to read; defaults to ``os.environ``.
        which: Executable lookup; defaults to ``shutil.which``.

    Returns:
        Argv prefix to which an operation id and flags are appended.

    Raises:
        LayoutSolveUnavailable: If no runner can be found.
    """
    env = os.environ if env is None else env
    override = env.get("TKR_CLI")
    if override:
        return [*override.split(), "op"]

    if which("tkr"):
        return ["tkr", "op"]

    home = env.get("TKR_KIT_HOME")
    if home:
        cli = Path(home) / "bin" / "tkr-cli.ts"
        if cli.exists() and which("bun"):
            return ["bun", "run", str(cli)]

    raise LayoutSolveUnavailable(
        "no tkr-kit CLI found. Install tkr-kit so `tkr` is on PATH, or set "
        "TKR_KIT_HOME to a checkout, or set TKR_CLI to the command that runs it."
    )


def solve_layout(
    tree: dict[str, Any],
    system_id: str,
    canvas: dict[str, int],
    scope: str | None = None,
    cwd: str | Path | None = None,
    runner: list[str] | None = None,
) -> dict[str, Any]:
    """Solves a layout tree into a blueprint through `design.solve_layout`.

    Args:
        tree: The root container node, with token-named spacing.
        system_id: Id of a design system already registered in the project.
        canvas: Artboard dimensions, `{"width": w, "height": h}`.
        scope: Token scope carried through to the blueprint. Defaults to portable.
        cwd: Project directory the operation resolves against.
        runner: Argv prefix that runs an operation; defaults to
            ``resolve_runner()``.

    Returns:
        The solution: `spacing`, `boxes`, `blueprint`, and `overflows`.

    Raises:
        LayoutSolveUnavailable: If no tkr-kit CLI can be located.
        LayoutSolveFailed: If the operation refused the input or errored.
    """
    payload: dict[str, Any] = {"systemId": system_id, "canvas": canvas, "tree": tree}
    if scope is not None:
        payload["scope"] = scope

    argv = [*(runner if runner is not None else resolve_runner()), OPERATION, "--input", json.dumps(payload), "--json"]
    env = {**os.environ, "TKR_LOG_LEVEL": os.environ.get("TKR_LOG_LEVEL", "fatal")}

    completed = subprocess.run(
        argv,
        capture_output=True,
        text=True,
        cwd=str(cwd) if cwd is not None else None,
        env=env,
        check=False,
    )

    if completed.returncode != 0:
        # The CLI writes its error envelope to stderr and leaves stdout empty,
        # so a refusal is never mistaken for a result.
        detail = completed.stderr.strip() or completed.stdout.strip() or "no output"
        try:
            envelope = json.loads(detail)
            error = envelope.get("error", {})
            detail = f"{error.get('code', 'error')}: {error.get('message', detail)}"
        except (ValueError, AttributeError):
            pass
        raise LayoutSolveFailed(f"{OPERATION} failed (exit {completed.returncode}) — {detail}")

    try:
        solution = json.loads(completed.stdout)["output"]
    except (ValueError, KeyError, TypeError) as exc:
        raise LayoutSolveFailed(f"{OPERATION} returned unreadable output: {exc}") from exc

    # Deliberately no log here: these subcommands print a JSON result to
    # stdout and structlog's default sink is stdout too, so a diagnostic line
    # would corrupt the contract a caller parses. The counts a log would carry
    # are already in the returned solution.
    return solution


def describe_overflows(overflows: list[dict[str, Any]]) -> list[str]:
    """Renders overflow findings as one readable line each.

    Args:
        overflows: Findings from a solution's `overflows` list.

    Returns:
        One human-readable line per finding.
    """
    lines = []
    for finding in overflows:
        against = finding.get("against", "canvas")
        where = finding.get("containerId") or "the canvas"
        right = finding.get("overflowRight", 0)
        bottom = finding.get("overflowBottom", 0)
        parts = []
        if right:
            parts.append(f"{right}px past the right edge")
        if bottom:
            parts.append(f"{bottom}px past the bottom edge")
        lines.append(
            f"'{finding.get('id')}' extends {' and '.join(parts) or 'out of bounds'} of {where} ({against})"
        )
    return lines
