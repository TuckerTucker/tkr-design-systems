#!/usr/bin/env python3
"""End-to-end consumer check across every registered design system.

For each system in ``systems/registry.yaml`` this command does what a
consumer of the skills/MCP server does, through the same functions the
MCP tools are (``tools/mcp-server/server.py``), and nothing internal:

1. **Generate** a reference wireframe for mobile and desktop.
   ``wf_generate(compose=True)`` returns the system's component inventory
   (the decomposition request); the reference layout below is turned into
   a blueprint from that inventory and assembled with
   ``wf_assemble_from_blueprint``. Composition is the one route every
   system can satisfy on both platforms: layout patterns exist for some
   systems only, and only the neutral library authors mobile patterns.
   A reference component the system has not authored falls back to the
   neutral library (docs/specs/LIBRARY-SPEC.md, composition rule 5): its
   source is read with ``wf_read_component`` and placed as a custom
   component. Fallbacks are expected for partial libraries and are
   recorded in the report.
2. **Check** the emitted SVG with ``ds_check_compliance(scope="artifact")``.
   Any failing rule (including a stale ``rulebook-exceptions.yaml``
   entry) fails the system, as does a system with no mechanical ruleset.
3. **Render** a PNG preview with the canonical renderer
   (``tools/builders/render_preview.py``, CairoSVG).
4. **Report** pass/fail per system and platform as a table (plus
   ``report.json`` in the output directory) and exit non-zero if any
   system failed a stage.

Usage::

    uv run python tools/e2e/check_systems.py
    uv run python tools/e2e/check_systems.py --system swiss --system riso
    uv run python tools/e2e/check_systems.py --out /tmp/e2e

Exit status: 0 when every checked system passes, 1 when any fails,
2 on a usage error (e.g. an unknown system id).
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from types import ModuleType
from typing import Any, Callable, Sequence

import structlog

logger = structlog.get_logger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT_DIR = REPO_ROOT / "output" / "e2e"

PLATFORMS: tuple[str, ...] = ("mobile", "desktop")

# Rule 5 fallback source: the wireframe-skill's neutral library (registered
# as the ``neutral`` alias of ``wireframe``).
FALLBACK_SYSTEM = "neutral"

REFERENCE_BRIEF = (
    "Reference consumer screen: a tab bar, a search field, a stat, a "
    "summary card, a two-item list with one item selected, a form field, "
    "and primary + secondary actions."
)

# The reference layout: regions top to bottom, each a list of rows, each
# row a list of component ids placed left to right. Every id is authored
# by the neutral library and by every system with a full component set,
# so only genuinely partial libraries fall back. It is sized to fit the
# 375x812 mobile canvas in every system's component dimensions.
REFERENCE_LAYOUT: tuple[tuple[str, tuple[tuple[str, ...], ...]], ...] = (
    ("header", (
        ("tab-item-active", "tab-item-default"),
    )),
    ("main", (
        ("input-search",),
        ("stat-default",),
        ("card-default",),
        ("list-item-default",),
        ("list-item-selected",),
        ("form-field-default",),
        ("button-primary", "button-secondary"),
    )),
)

# Spacing between and around placed components. A multiple of 8 so it sits
# on the 8px grids the systems use.
GUTTER = 16

_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


# ─── Dependencies (IoC seam) ──────────────────────────────────────────

@dataclass(frozen=True)
class ConsumerTools:
    """The public operations the check drives, injectable for tests.

    Each callable has the signature and dict-shaped return of the MCP tool
    it stands for; ``render`` matches ``render_preview.render``.

    Attributes:
        builtin_ids: Ids in the repository's built-in registry
            (``systems/registry.yaml``), in registry order — the population
            the check examines. ``ds_list_systems`` alone cannot be the
            population: it also lists the developer's user overlay
            (``~/.claude/design-systems/registry.yaml``), whose systems
            belong to other projects.
        list_systems: ``ds_list_systems()``.
        generate: ``wf_generate(brief, platform=, system=, compose=, ...)``.
        read_component: ``wf_read_component(system_id, component_id=)``.
        assemble: ``wf_assemble_from_blueprint(blueprint, system_id,
            output_dir=, filename_stem=, brief=, platform=)``.
        check_compliance: ``ds_check_compliance(system_id, artifact_path,
            scope=)``.
        render: ``render(src, dst) -> Path``.
    """

    builtin_ids: Callable[[], list[str]]
    list_systems: Callable[[], dict[str, Any]]
    generate: Callable[..., dict[str, Any]]
    read_component: Callable[..., dict[str, Any]]
    assemble: Callable[..., dict[str, Any]]
    check_compliance: Callable[..., dict[str, Any]]
    render: Callable[..., Path]


def _import_from_path(name: str, path: Path) -> ModuleType:
    """Import a module from a file path.

    Args:
        name: Module name to register in ``sys.modules``.
        path: Path to the ``.py`` file.

    Returns:
        The imported module.

    Raises:
        ImportError: If the module cannot be loaded.
    """
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load {name} from {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def read_registry_ids(registry: Path) -> list[str]:
    """Return the ids a registry file declares, in file order.

    Args:
        registry: A ``registry.yaml``.

    Returns:
        Its entry ids (aliases such as ``neutral`` included).

    Raises:
        RuntimeError: If the file has no ``systems`` list.
    """
    import yaml

    data = yaml.safe_load(registry.read_text()) or {}
    entries = data.get("systems")
    if not isinstance(entries, list):
        raise RuntimeError(f"{registry} has no 'systems' list")
    return [str(e["id"]) for e in entries]


def default_tools(repo_root: Path = REPO_ROOT) -> ConsumerTools:
    """Bind the check to the real MCP tool functions and preview renderer.

    Args:
        repo_root: Repository root containing ``tools/``.

    Returns:
        ConsumerTools backed by ``tools/mcp-server/server.py`` and
        ``tools/builders/render_preview.py``.
    """
    server = sys.modules.get("server")
    if server is None or not hasattr(server, "wf_assemble_from_blueprint"):
        server = _import_from_path("server", repo_root / "tools" / "mcp-server" / "server.py")
    render_preview = _import_from_path(
        "render_preview", repo_root / "tools" / "builders" / "render_preview.py")
    registry = repo_root / "systems" / "registry.yaml"
    return ConsumerTools(
        builtin_ids=lambda: read_registry_ids(registry),
        list_systems=server.ds_list_systems,
        generate=server.wf_generate,
        read_component=server.wf_read_component,
        assemble=server.wf_assemble_from_blueprint,
        check_compliance=server.ds_check_compliance,
        render=render_preview.render,
    )


# ─── Results ──────────────────────────────────────────────────────────

@dataclass
class StageResult:
    """Outcome of one stage (generate, rulebook or render).

    Attributes:
        ok: Whether the stage passed. None when it did not run because an
            earlier stage failed.
        summary: Short human-readable outcome for the table.
        errors: Failure details.
    """

    ok: bool | None = None
    summary: str = "skipped"
    errors: list[str] = field(default_factory=list)


@dataclass
class PlatformResult:
    """End-to-end outcome for one system on one platform.

    Attributes:
        platform: "mobile" or "desktop".
        generate: Generation stage result.
        rulebook: Rulebook-check stage result.
        render: Render stage result.
        fallbacks: Component ids drawn from the neutral library (rule 5).
        svg_path: Emitted wireframe SVG, if generated.
        spec_path: Emitted wireframe spec.yaml, if generated.
        png_path: Rendered preview, if rendered.
        warnings: Non-fatal warnings from assembly.
        compliance: Rulebook counts {ruleset, passed, failed, advisory,
            waived, failed_rules, advisory_rules, waived_rules}.
    """

    platform: str
    generate: StageResult = field(default_factory=StageResult)
    rulebook: StageResult = field(default_factory=StageResult)
    render: StageResult = field(default_factory=StageResult)
    fallbacks: list[str] = field(default_factory=list)
    svg_path: str | None = None
    spec_path: str | None = None
    png_path: str | None = None
    warnings: list[str] = field(default_factory=list)
    compliance: dict[str, Any] | None = None

    @property
    def ok(self) -> bool:
        """True when all three stages passed."""
        return bool(self.generate.ok and self.rulebook.ok and self.render.ok)


@dataclass
class SystemResult:
    """End-to-end outcome for one system across platforms.

    Attributes:
        system_id: Registry id.
        platforms: One result per platform checked.
    """

    system_id: str
    platforms: list[PlatformResult] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        """True when every platform passed."""
        return bool(self.platforms) and all(p.ok for p in self.platforms)

    def to_dict(self) -> dict[str, Any]:
        """Serialize for report.json.

        Returns:
            Dict with system_id, ok, and per-platform results.
        """
        return {
            "system_id": self.system_id,
            "ok": self.ok,
            "platforms": [{**asdict(p), "ok": p.ok} for p in self.platforms],
        }


# ─── Blueprint construction ───────────────────────────────────────────

@dataclass(frozen=True)
class _Placeable:
    """A component ready to place: library reference or neutral fallback."""

    component_id: str
    width: int
    height: int
    fallback_svg: str | None = None

    def entry(self, x: int, y: int) -> dict[str, Any]:
        """Blueprint component entry at region-relative (x, y)."""
        out: dict[str, Any] = {
            "component_id": self.component_id,
            "x": x, "y": y, "w": self.width, "h": self.height,
        }
        if self.fallback_svg is not None:
            out["type"] = "custom"
            out["component_id"] = f"{FALLBACK_SYSTEM}-{self.component_id}"
            out["svg"] = self.fallback_svg
        return out


def _resolve_components(
    inventory: list[dict[str, Any]],
    tools: ConsumerTools,
) -> tuple[dict[str, _Placeable], list[str], list[str]]:
    """Resolve every reference component against a system's inventory.

    Args:
        inventory: ``decomposition_request["components"]`` for the system.
        tools: Consumer tools (``read_component`` supplies fallbacks).

    Returns:
        (placeables by id, fallback ids, errors).
    """
    by_id = {c["component_id"]: c for c in inventory}
    needed = sorted({cid for _, rows in REFERENCE_LAYOUT for row in rows for cid in row})
    placeables: dict[str, _Placeable] = {}
    fallbacks: list[str] = []
    errors: list[str] = []
    for cid in needed:
        comp = by_id.get(cid)
        if comp is not None:
            placeables[cid] = _Placeable(cid, int(comp["viewBox_w"]), int(comp["viewBox_h"]))
            continue
        neutral = tools.read_component(FALLBACK_SYSTEM, component_id=cid)
        if not neutral.get("ok") or not neutral.get("svg_source"):
            errors.append(
                f"component '{cid}' is not authored and has no neutral fallback: "
                f"{neutral.get('errors') or neutral.get('error')}")
            continue
        view_box = neutral.get("viewBox") or {}
        placeables[cid] = _Placeable(
            cid, int(view_box.get("w", 0)), int(view_box.get("h", 0)),
            fallback_svg=neutral["svg_source"],
        )
        fallbacks.append(cid)
    return placeables, fallbacks, errors


def build_reference_blueprint(
    placeables: dict[str, _Placeable],
    canvas: dict[str, int],
) -> dict[str, Any]:
    """Lay the reference rows out as a flow inside the canvas.

    Rows stack top to bottom with GUTTER spacing; components in a row sit
    left to right and wrap when the row is full. The header region is as
    tall as its content; main takes the rest. Placements carry w/h so
    ``validate_blueprint`` rejects anything that does not fit.

    Args:
        placeables: Resolved components by reference id.
        canvas: ``{"width", "height"}`` for the platform.

    Returns:
        A schema 1.0 blueprint.
    """
    canvas_w, canvas_h = int(canvas["width"]), int(canvas["height"])
    regions: list[dict[str, Any]] = []
    region_y = 0
    for index, (region_id, rows) in enumerate(REFERENCE_LAYOUT):
        components: list[dict[str, Any]] = []
        y = GUTTER
        for row in rows:
            x, row_h = GUTTER, 0
            for cid in row:
                item = placeables.get(cid)
                if item is None:
                    continue
                if x > GUTTER and x + item.width > canvas_w - GUTTER:
                    x, y = GUTTER, y + row_h + GUTTER
                    row_h = 0
                components.append(item.entry(x, y))
                x += item.width + GUTTER
                row_h = max(row_h, item.height)
            y += row_h + GUTTER
        last = index == len(REFERENCE_LAYOUT) - 1
        region_h = canvas_h - region_y if last else y
        regions.append({
            "id": region_id, "x": 0, "y": region_y, "w": canvas_w, "h": region_h,
            "components": components,
        })
        region_y += region_h
    return {
        "schema_version": "1.0",
        "canvas": {"width": canvas_w, "height": canvas_h},
        "regions": regions,
    }


# ─── Stages ───────────────────────────────────────────────────────────

def _errors_of(result: dict[str, Any]) -> list[str]:
    """Flatten the error shapes the MCP tools return into strings."""
    errs = result.get("errors") or result.get("validation_errors") or []
    out = []
    for e in errs:
        out.append(e.get("message", str(e)) if isinstance(e, dict) else str(e))
    return out or ["unknown error"]


def _generate(system_id: str, platform: str, out_dir: Path,
              tools: ConsumerTools, result: PlatformResult) -> None:
    """Stage 1: compose the reference wireframe through the public path."""
    request = tools.generate(
        brief=REFERENCE_BRIEF, platform=platform, system=system_id,
        output_dir=str(out_dir), compose=True,
    )
    decomposition = request.get("decomposition_request") if request.get("ok") else None
    if not decomposition:
        result.generate = StageResult(False, "FAIL (inventory)", _errors_of(request))
        return

    placeables, fallbacks, errors = _resolve_components(decomposition["components"], tools)
    result.fallbacks = fallbacks
    if errors:
        result.generate = StageResult(False, "FAIL (components)", errors)
        return

    blueprint = build_reference_blueprint(placeables, decomposition["canvas"])
    assembled = tools.assemble(
        blueprint, system_id=system_id, output_dir=str(out_dir),
        filename_stem=f"reference-{platform}", brief=REFERENCE_BRIEF,
        platform=platform,
    )
    if not assembled.get("ok") or not assembled.get("svg_path"):
        result.generate = StageResult(False, "FAIL (assemble)", _errors_of(assembled))
        return
    result.svg_path = assembled["svg_path"]
    result.spec_path = assembled.get("spec_path")
    result.warnings = list(assembled.get("warnings") or [])
    placed = sum(len(r["components"]) for r in blueprint["regions"])
    result.generate = StageResult(True, f"ok ({placed} placed)")


def _check_rulebook(system_id: str, tools: ConsumerTools, result: PlatformResult) -> None:
    """Stage 2: artifact-scope mechanical rulebook check."""
    checked = tools.check_compliance(system_id, result.svg_path, scope="artifact")
    if not checked.get("ok"):
        result.rulebook = StageResult(False, "FAIL (error)", _errors_of(checked))
        return
    data = checked["data"]
    by_status: dict[str, list[str]] = {"fail": [], "advisory": [], "waived": []}
    for r in data.get("results", []):
        if r.get("status") in by_status:
            by_status[r["status"]].append(str(r.get("rule_id")))
    result.compliance = {
        "ruleset": data.get("ruleset"),
        "passed": data.get("passed", 0),
        "failed": data.get("failed", 0),
        "advisory": data.get("advisory", 0),
        "waived": data.get("waived", 0),
        "failed_rules": by_status["fail"],
        "advisory_rules": by_status["advisory"],
        "waived_rules": by_status["waived"],
    }
    counts = (f"{data.get('passed', 0)}p/{data.get('failed', 0)}f/"
              f"{data.get('advisory', 0)}a/{data.get('waived', 0)}w")
    if data.get("ruleset") is None:
        result.rulebook = StageResult(
            False, "FAIL (no ruleset)",
            [data.get("note") or f"No mechanical ruleset ran for '{system_id}'."])
    elif data.get("failed", 0) > 0:
        details = [
            f"{r.get('rule_id')}: {json.dumps(r.get('detail'), default=str)[:400]}"
            for r in data.get("results", []) if r.get("status") == "fail"
        ]
        result.rulebook = StageResult(False, f"FAIL {counts}", details)
    else:
        result.rulebook = StageResult(True, f"ok {counts}")


def _render(tools: ConsumerTools, result: PlatformResult) -> None:
    """Stage 3: render the PNG preview and confirm it is a real PNG."""
    svg_path = Path(result.svg_path)
    png_path = svg_path.with_suffix(".png")
    try:
        written = Path(tools.render(svg_path, png_path))
    except Exception as exc:  # renderer errors are the finding, not a crash
        result.render = StageResult(False, "FAIL", [f"{type(exc).__name__}: {exc}"])
        return
    if not written.exists() or written.stat().st_size == 0:
        result.render = StageResult(False, "FAIL", [f"no PNG written at {written}"])
        return
    with written.open("rb") as fh:
        if fh.read(len(_PNG_SIGNATURE)) != _PNG_SIGNATURE:
            result.render = StageResult(False, "FAIL", [f"{written} is not a PNG"])
            return
    result.png_path = str(written)
    result.render = StageResult(True, "ok")


def check_system(
    system_id: str,
    out_dir: Path,
    tools: ConsumerTools,
    platforms: Sequence[str] = PLATFORMS,
) -> SystemResult:
    """Run generate → rulebook → render for one system on each platform.

    Args:
        system_id: Registry id.
        out_dir: Directory for this system's outputs.
        tools: Consumer tools.
        platforms: Platforms to check.

    Returns:
        SystemResult with a PlatformResult per platform.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    system_result = SystemResult(system_id)
    for platform in platforms:
        log = logger.bind(system_id=system_id, platform=platform)
        log.info("e2e_platform_start")
        result = PlatformResult(platform)
        try:
            _generate(system_id, platform, out_dir, tools, result)
            if result.generate.ok:
                _check_rulebook(system_id, tools, result)
                _render(tools, result)
        except Exception as exc:
            # An unexpected exception is a failure of this system, reported
            # in the table rather than aborting the remaining systems.
            log.exception("e2e_platform_crashed")
            stage = next((s for s in ("generate", "rulebook", "render")
                          if getattr(result, s).ok is not True), "render")
            setattr(result, stage, StageResult(False, "CRASH", [f"{type(exc).__name__}: {exc}"]))
        log.info("e2e_platform_done", ok=result.ok, fallbacks=result.fallbacks)
        system_result.platforms.append(result)
    return system_result


def run(
    system_ids: Sequence[str],
    out_dir: Path,
    tools: ConsumerTools,
    platforms: Sequence[str] = PLATFORMS,
) -> list[SystemResult]:
    """Check every given system and write ``report.json`` to out_dir.

    Args:
        system_ids: Registry ids to check, in report order.
        out_dir: Root output directory; each system gets a subdirectory.
        tools: Consumer tools.
        platforms: Platforms to check.

    Returns:
        One SystemResult per system.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    results = [check_system(sid, out_dir / sid, tools, platforms) for sid in system_ids]
    report = {
        "brief": REFERENCE_BRIEF,
        "ok": all(r.ok for r in results),
        "systems": [r.to_dict() for r in results],
    }
    (out_dir / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    return results


# ─── Reporting ────────────────────────────────────────────────────────

def format_table(results: Sequence[SystemResult]) -> str:
    """Render results as a Markdown table followed by failure details.

    Args:
        results: Results from :func:`run`.

    Returns:
        The report text.
    """
    header = ("System", "Platform", "Generate", "Rulebook (pass/fail/adv/waived)",
              "Render", "Neutral fallbacks", "Result")
    rows = []
    for sr in results:
        for p in sr.platforms:
            ruleset = (p.compliance or {}).get("ruleset")
            rulebook = p.rulebook.summary + (f" [{ruleset}]" if ruleset else "")
            rows.append((
                sr.system_id, p.platform, p.generate.summary, rulebook,
                p.render.summary,
                ", ".join(p.fallbacks) if p.fallbacks else "-",
                "PASS" if p.ok else "FAIL",
            ))
    widths = [max(len(str(c)) for c in col) for col in zip(header, *rows)]

    def line(cells: Sequence[str]) -> str:
        return "| " + " | ".join(str(c).ljust(w) for c, w in zip(cells, widths)) + " |"

    out = [line(header), "|" + "|".join("-" * (w + 2) for w in widths) + "|"]
    out.extend(line(r) for r in rows)

    details = []
    for sr in results:
        for p in sr.platforms:
            for stage in ("generate", "rulebook", "render"):
                for err in getattr(p, stage).errors:
                    details.append(f"- {sr.system_id}/{p.platform} {stage}: {err}")
    passed = sum(1 for r in results if r.ok)
    out.append("")
    out.append(f"{passed}/{len(results)} systems passed.")
    if details:
        out.append("")
        out.append("Failures:")
        out.extend(details)
    return "\n".join(out)


# ─── CLI ──────────────────────────────────────────────────────────────

def _registered_ids(tools: ConsumerTools) -> list[str]:
    """The built-in systems, in registry order — the population this check examines.

    Only the repository's own registry is examined: a user-overlay system
    (listed by ``ds_list_systems`` on a developer's machine) belongs to
    another project and is reported as ignored, never checked. Every
    built-in id must also be listed by the tools, or the run fails.

    Narrowing, declared: an overlay entry that *shadows* a built-in id is
    resolved by the tools to the overlay's files, and ``ds_list_systems``
    does not say which layer an id came from, so that case is not detected
    here. CI runs with no overlay.

    Raises:
        RuntimeError: If the registry cannot be listed or a built-in id is
            missing from the listing.
    """
    listed = tools.list_systems()
    if not listed.get("ok"):
        raise RuntimeError(f"ds_list_systems failed: {_errors_of(listed)}")
    listed_ids = [s["id"] for s in listed["data"]]
    builtin = tools.builtin_ids()
    missing = [i for i in builtin if i not in listed_ids]
    if missing:
        raise RuntimeError(f"built-in system(s) not listed by ds_list_systems: {missing}")
    ignored = [i for i in listed_ids if i not in builtin]
    if ignored:
        logger.info("e2e_overlay_systems_ignored", ids=ignored)
    return builtin


def main(argv: Sequence[str] | None = None, tools: ConsumerTools | None = None) -> int:
    """Run the end-to-end check and print the report.

    Args:
        argv: Command-line arguments (without program name).
        tools: Consumer tools; defaults to the real MCP tool functions.

    Returns:
        Process exit status: 0 all pass, 1 any failure, 2 usage error.
    """
    parser = argparse.ArgumentParser(
        prog="check_systems",
        description="Generate, rulebook-check and render a reference wireframe "
                    "for every registered design system.",
    )
    parser.add_argument("--system", action="append", dest="systems", metavar="ID",
                        help="System id to check (repeatable). Default: all registered.")
    parser.add_argument("--platform", action="append", dest="platforms",
                        choices=PLATFORMS, help="Platform to check (repeatable). Default: both.")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_DIR,
                        help=f"Output directory (default: {DEFAULT_OUT_DIR}).")
    args = parser.parse_args(argv)

    tools = tools or default_tools()
    registered = _registered_ids(tools)
    system_ids = args.systems or registered
    unknown = [s for s in system_ids if s not in registered]
    if unknown:
        print(f"Unknown system id(s): {', '.join(unknown)}. "
              f"Registered: {', '.join(registered)}", file=sys.stderr)
        return 2

    out_dir = args.out.resolve()
    platforms = tuple(args.platforms) if args.platforms else PLATFORMS
    logger.info("e2e_start", systems=system_ids, platforms=platforms, out_dir=str(out_dir))
    results = run(system_ids, out_dir, tools, platforms)
    print(format_table(results))
    print(f"\nOutputs: {out_dir}")
    ok = all(r.ok for r in results)
    logger.info("e2e_done", ok=ok, passed=sum(r.ok for r in results), total=len(results))
    return 0 if ok else 1


def _configure_logging() -> None:
    """Structured JSON logs on stderr so stdout carries only the report."""
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
    )


if __name__ == "__main__":
    _configure_logging()
    sys.exit(main())
