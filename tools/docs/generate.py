#!/usr/bin/env python3
"""Regenerate the marked regions of the docs from their sources of truth.

Issue #14. Counts, tool tables, system tables and per-system rule lists used
to be typed by hand into the skills, the MCP README and the handoff, and
drifted from the code. Each now lives in a marked region::

    <!-- generated:NAME -->
    ...rendered content...
    <!-- /generated:NAME -->

and this script rewrites every region from its source:

- ``mcp-tool-count``, ``mcp-tools``: the ``@mcp.tool()`` functions in
  ``tools/mcp-server/server.py`` and their docstring summaries (read by AST,
  without importing the server).
- ``system-count``, ``which-system``, ``system-rules``, ``library-counts``:
  ``systems/registry.yaml`` joined with each ``spec.yaml``, ``tokens.json``
  (default mode) and library directory. A registry entry naming an earlier
  entry's spec (``neutral``) is an alias.
- ``library-vocabulary-count``: the component vocabulary in
  ``docs/specs/LIBRARY-SPEC.md``.
- ``which-component``, ``rules-agents-get-wrong`` and the *Suits* column of
  ``which-system``: hand-written in ``tools/docs/guidance.yaml``; every
  component id, variant, rule id, check id and doc path in them is checked
  against its source.

A region opens with its marker at the end of a line (block region: the
content is whole lines) or mid-line (inline region: the content is a phrase,
e.g. a count in a sentence). Writing is idempotent; regenerate after any
source changes.

``--check`` also verifies the tables in ``docs/specs/SCHEMA-V0.3.md``, which
have their own generators (``contract.render_*_table``,
``contrast.render_thresholds_table``) and ``begin``/``end`` markers; this
script does not rewrite them.

Usage::

    uv run python tools/docs/generate.py           # rewrite stale regions
    uv run python tools/docs/generate.py --check   # exit 1 if any is stale

Exit status: 0 when every region is current (or was rewritten), 1 when a
region is stale under ``--check`` or any source or marker problem was found
(nothing is written then).
"""

from __future__ import annotations

import argparse
import ast
import json
import os
import re
import sys
from dataclasses import dataclass, field
from functools import cached_property
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence

import structlog
import yaml

logger = structlog.get_logger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[2]

GUIDANCE_PATH = Path("tools/docs/guidance.yaml")
SERVER_PATH = Path("tools/mcp-server/server.py")
LIBRARY_SPEC_PATH = Path("docs/specs/LIBRARY-SPEC.md")
REGISTRY_PATH = Path("systems/registry.yaml")
RULEBOOK_CHECK_PATH = Path("tools/builders/rulebook_check.py")
SHOWCASE_DIR = Path("apps/showcase/src/systems")
SCHEMA_V03_PATH = Path("docs/specs/SCHEMA-V0.3.md")

# Every file that carries generated regions, and the regions it must carry.
# A region listed here whose markers are missing is an error, so a marker
# deleted by an edit cannot silently stop a doc from being maintained.
EXPECTED_REGIONS: dict[str, frozenset[str]] = {
    "tools/mcp-server/README.md": frozenset({"mcp-tool-count", "mcp-tools"}),
    "docs/HANDOFF.md": frozenset({
        "library-vocabulary-count", "system-count", "library-counts",
    }),
    "docs/specs/UNIFIED-FOUNDATION.md": frozenset({"library-vocabulary-count"}),
}

# MCP tool name prefix → README section title.
MCP_TOOL_GROUPS: dict[str, str] = {
    "ds_": "Design System",
    "wf_": "Wireframe",
}

# Showcase JSX file per system when it is not design-system-<id>.jsx.
SHOWCASE_FILE_OVERRIDES: dict[str, str] = {"wireframe": "design-system-neutral.jsx"}

MARKER_START = re.compile(r"<!-- generated:([a-z0-9-]+) -->")
MARKER_END = re.compile(r"<!-- /generated:([a-z0-9-]+) -->")

_TM_RE = re.compile(r'const\s+TM\s*=\s*\{[^}]*?\btag:\s*"([^"]+)"')
_LIB_HEADING_RE = re.compile(r"^###\s+(Primitives|Composites|Patterns)\s+\((\d+)\)\s*$")
_LIB_ITEM_RE = re.compile(r"^\d+\.\s+\*\*([a-z_]+)\*\*\s+—")
_LIB_VARIANTS_RE = re.compile(r"^\s+-\s+variants:\s+(.*)$")
_RAW_TAG_RE = re.compile(r"(?:</?[a-zA-Z][\w:-]*(?:\s[^<>]*)?>)+")
_SENTENCE_END = re.compile(r"(?<!e\.g)(?<!i\.e)(?<!etc)\.(?=\s+[A-Z(`'\"])")


class SourceError(Exception):
    """A source of truth is missing, malformed, or contradicts a reference."""


# ─── Sources ──────────────────────────────────────────────────────────

@dataclass(frozen=True)
class McpTool:
    """One ``@mcp.tool()`` function in the MCP server.

    Attributes:
        name: Tool (function) name.
        summary: First line of its docstring.
    """

    name: str
    summary: str


@dataclass(frozen=True)
class SystemInfo:
    """One registry entry joined with its spec, token file and library.

    Attributes:
        id: Registry id.
        alias_of: Id of the first registry entry with the same spec, if this
            entry is an alias; else None.
        spec: Parsed spec.yaml.
        tokens: Parsed tokens.json in its default mode, or None.
        library_root: Absolute library directory.
        showcase_tag: ``TM.tag`` from the showcase JSX, or None.
    """

    id: str
    alias_of: str | None
    spec: dict[str, Any]
    tokens: dict[str, Any] | None
    library_root: Path
    showcase_tag: str | None

    @property
    def name(self) -> str:
        return str(self.spec["system"].get("name", self.id))

    @property
    def tagline(self) -> str:
        return str(self.spec["system"].get("tagline", ""))

    @property
    def grammar_family(self) -> str:
        return str(self.spec["system"].get("grammar_family", ""))

    @property
    def rulebook(self) -> list[dict[str, Any]]:
        return list(self.spec.get("rulebook") or [])

    def svg_count(self, kind: str) -> int:
        """Count the SVG files in the library's ``components`` or ``layouts``."""
        directory = self.library_root / kind
        return len(list(directory.glob("*.svg"))) if directory.is_dir() else 0


@dataclass
class Sources:
    """Lazily loaded sources of truth under a repository root.

    Attributes:
        root: Repository root.
        guidance_override: Use this mapping instead of reading
            ``tools/docs/guidance.yaml`` (tests).
    """

    root: Path
    guidance_override: Mapping[str, Any] | None = None

    @cached_property
    def guidance(self) -> Mapping[str, Any]:
        if self.guidance_override is not None:
            return self.guidance_override
        return _read_yaml(self.root / GUIDANCE_PATH)

    @cached_property
    def mcp_tools(self) -> list[McpTool]:
        return parse_mcp_tools(self.root / SERVER_PATH)

    @cached_property
    def library_vocabulary(self) -> dict[str, tuple[str, ...]]:
        return parse_library_vocabulary(self.root / LIBRARY_SPEC_PATH)

    @cached_property
    def systems(self) -> list[SystemInfo]:
        return load_systems(self.root)

    @property
    def canonical_systems(self) -> list[SystemInfo]:
        return [s for s in self.systems if s.alias_of is None]

    def system(self, system_id: str) -> SystemInfo | None:
        return next((s for s in self.systems if s.id == system_id), None)

    @cached_property
    def check_ids(self) -> frozenset[str]:
        path = self.root / RULEBOOK_CHECK_PATH
        text = path.read_text() if path.exists() else ""
        return frozenset(re.findall(r'"rule_id":\s*"([a-z0-9-]+)"', text)
                         + re.findall(r'_RULE_ID\s*=\s*"([a-z0-9-]+)"', text))


def _read_yaml(path: Path) -> Any:
    if not path.exists():
        raise SourceError(f"source missing: {path}")
    try:
        return yaml.safe_load(path.read_text())
    except yaml.YAMLError as exc:
        raise SourceError(f"cannot parse {path}: {exc}") from exc


def parse_mcp_tools(server_path: Path) -> list[McpTool]:
    """List the MCP server's tools without importing it.

    A tool is a module-level function decorated with ``@mcp.tool()`` (or
    ``@mcp.tool``); its summary is the first line of its docstring.

    Args:
        server_path: Path to ``server.py``.

    Returns:
        Tools in source order.

    Raises:
        SourceError: When the file is missing or a tool has no docstring.
    """
    if not server_path.exists():
        raise SourceError(f"source missing: {server_path}")
    tree = ast.parse(server_path.read_text(), filename=str(server_path))
    tools: list[McpTool] = []
    for node in tree.body:
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        if not any(_is_mcp_tool_decorator(d) for d in node.decorator_list):
            continue
        doc = ast.get_docstring(node)
        if not doc:
            raise SourceError(f"MCP tool {node.name} has no docstring ({server_path})")
        tools.append(McpTool(node.name, doc.strip().splitlines()[0].strip()))
    return tools


def _is_mcp_tool_decorator(node: ast.expr) -> bool:
    target = node.func if isinstance(node, ast.Call) else node
    return (isinstance(target, ast.Attribute) and target.attr == "tool"
            and isinstance(target.value, ast.Name) and target.value.id == "mcp")


def parse_library_vocabulary(path: Path) -> dict[str, tuple[str, ...]]:
    """Read the component vocabulary from LIBRARY-SPEC.md.

    Each ``N. **id** —`` item under ``### Primitives (n)``, ``### Composites
    (n)`` or ``### Patterns (n)`` is a component; the following ``- variants:``
    line lists its variants in backticks. The ``(n)`` in each heading must
    match the number of items under it.

    Args:
        path: Path to LIBRARY-SPEC.md.

    Returns:
        ``{component_id: (variant, ...)}`` in document order.

    Raises:
        SourceError: When the file is missing, empty, or a heading count is wrong.
    """
    if not path.exists():
        raise SourceError(f"source missing: {path}")
    vocabulary: dict[str, tuple[str, ...]] = {}
    tier: tuple[str, int] | None = None
    tier_counts: dict[str, list[int]] = {}
    current: str | None = None
    for line in path.read_text().splitlines():
        heading = _LIB_HEADING_RE.match(line)
        if heading:
            tier = (heading.group(1), int(heading.group(2)))
            tier_counts[tier[0]] = [tier[1], 0]
            current = None
            continue
        if line.startswith("## ") or line.startswith("### "):
            tier, current = None, None
            continue
        if tier is None:
            continue
        item = _LIB_ITEM_RE.match(line)
        if item:
            current = item.group(1)
            vocabulary[current] = ()
            tier_counts[tier[0]][1] += 1
            continue
        variants = _LIB_VARIANTS_RE.match(line)
        if variants and current is not None:
            vocabulary[current] = tuple(re.findall(r"`([a-z_]+)`", variants.group(1)))
    if not vocabulary:
        raise SourceError(f"no component vocabulary found in {path}")
    for name, (declared, found) in tier_counts.items():
        if declared != found:
            raise SourceError(
                f"{path}: '### {name} ({declared})' lists {found} components")
    return vocabulary


def load_systems(root: Path) -> list[SystemInfo]:
    """Join every registry entry with its spec, default-mode tokens and library.

    Args:
        root: Repository root.

    Returns:
        Systems in registry order; a later entry naming an earlier entry's
        spec is an alias of it.

    Raises:
        SourceError: When the registry or a spec cannot be read.
    """
    registry_path = root / REGISTRY_PATH
    registry = _read_yaml(registry_path) or {}
    systems: list[SystemInfo] = []
    first_by_spec: dict[Path, str] = {}
    for entry in registry.get("systems") or []:
        spec_path = (registry_path.parent / entry["spec"]).resolve()
        spec = _read_yaml(spec_path)
        if not isinstance(spec, dict) or "system" not in spec:
            raise SourceError(f"{spec_path}: not a system spec")
        alias_of = first_by_spec.get(spec_path)
        first_by_spec.setdefault(spec_path, entry["id"])
        tokens = None
        tokens_file = spec["system"].get("tokens_file")
        if tokens_file:
            tokens = _default_mode_tokens(spec_path.parent / tokens_file)
        library_root = (registry_path.parent / entry.get("library_root", entry["id"])).resolve()
        showcase_id = alias_of or entry["id"]
        jsx = root / SHOWCASE_DIR / SHOWCASE_FILE_OVERRIDES.get(
            showcase_id, f"design-system-{showcase_id}.jsx")
        tag_match = _TM_RE.search(jsx.read_text()) if jsx.exists() else None
        systems.append(SystemInfo(
            id=entry["id"], alias_of=alias_of, spec=spec, tokens=tokens,
            library_root=library_root,
            showcase_tag=tag_match.group(1) if tag_match else None,
        ))
    if not systems:
        raise SourceError(f"{registry_path}: no systems registered")
    return systems


def _default_mode_tokens(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise SourceError(f"source missing: {path}")
    try:
        doc = json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        raise SourceError(f"cannot parse {path}: {exc}") from exc
    for axis in (doc.get("modes") or {}).get("axes") or []:
        overrides = (axis.get("options") or {}).get(axis.get("default")) or {}
        for dotted, value in overrides.items():
            node = doc
            *parents, leaf = dotted.split(".")
            for part in parents:
                node = node.setdefault(part, {})
            node[leaf] = value
    return doc


# ─── Rendering helpers ────────────────────────────────────────────────

@dataclass(frozen=True)
class RenderContext:
    """What a region renderer gets.

    Attributes:
        sources: The sources of truth.
        target: Repository-relative path of the file being rendered (links
            are made relative to it).
    """

    sources: Sources
    target: Path

    def link(self, repo_path: str, label: str | None = None) -> str:
        """Markdown link from the target file to a repository path."""
        path, _, anchor = repo_path.partition("#")
        rel = os.path.relpath(path, self.target.parent.as_posix() or ".")
        href = rel + (f"#{anchor}" if anchor else "")
        return f"[{label or Path(path).name}]({href})"


def _inline(text: str) -> str:
    """Whitespace-normalise text and code-span raw tags (``<defs>``) outside code."""
    parts = " ".join(str(text).split()).split("`")
    for i in range(0, len(parts), 2):  # even indices are outside code spans
        parts[i] = _RAW_TAG_RE.sub(lambda m: f"`{m.group(0)}`", parts[i])
    return "`".join(parts)


def _cell(text: str) -> str:
    return _inline(text).replace("|", "\\|")


def _table(header: Sequence[str], rows: Sequence[Sequence[str]]) -> str:
    lines = ["| " + " | ".join(header) + " |",
             "|" + "|".join("-" * (len(h) + 2) for h in header) + "|"]
    lines += ["| " + " | ".join(_cell(c) for c in row) + " |" for row in rows]
    return "\n".join(lines)


def _number(value: Any) -> str:
    return f"{value:g}" if isinstance(value, float) else str(value)


def first_sentence(text: str) -> str:
    """First sentence of a rulebook entry, whitespace-normalised."""
    flat = " ".join(str(text).split())
    match = _SENTENCE_END.search(flat)
    return flat[: match.end()] if match else flat


def parse_component_ref(ref: str, vocabulary: Mapping[str, Sequence[str]]) -> tuple[str, str | None]:
    """Validate a ``component`` or ``component.variant`` reference.

    Args:
        ref: The reference.
        vocabulary: ``{component_id: variants}`` from LIBRARY-SPEC.md.

    Returns:
        ``(component_id, variant_or_None)``.

    Raises:
        SourceError: When the component or variant is not in the vocabulary.
    """
    component, _, variant = str(ref).partition(".")
    if component not in vocabulary:
        raise SourceError(
            f"which-component: unknown component id '{component}' "
            f"(not in {LIBRARY_SPEC_PATH})")
    if variant and variant not in vocabulary[component]:
        raise SourceError(
            f"which-component: '{component}' has no variant '{variant}' "
            f"(LIBRARY-SPEC variants: {', '.join(vocabulary[component])})")
    return component, variant or None


def _render_component_refs(refs: Sequence[str], vocabulary: Mapping[str, Sequence[str]]) -> str:
    parts = []
    for ref in refs:
        component, variant = parse_component_ref(ref, vocabulary)
        parts.append(f"`{component}` (`{variant}`)" if variant else f"`{component}`")
    return ", ".join(parts) if parts else "—"


# ─── Region renderers ─────────────────────────────────────────────────

def render_mcp_tool_count(ctx: RenderContext) -> str:
    return str(len(ctx.sources.mcp_tools))


def render_mcp_tools(ctx: RenderContext) -> str:
    groups: dict[str, list[McpTool]] = {prefix: [] for prefix in MCP_TOOL_GROUPS}
    for tool in ctx.sources.mcp_tools:
        prefix = next((p for p in MCP_TOOL_GROUPS if tool.name.startswith(p)), None)
        if prefix is None:
            raise SourceError(
                f"MCP tool {tool.name} has no group; add its prefix to MCP_TOOL_GROUPS")
        groups[prefix].append(tool)
    blocks = []
    for prefix, tools in groups.items():
        if not tools:
            continue
        noun = "tool" if len(tools) == 1 else "tools"
        blocks.append(f"### {MCP_TOOL_GROUPS[prefix]} ({len(tools)} {noun})\n\n"
                      + _table(["Tool", "Description"],
                               [[f"`{t.name}`", t.summary] for t in tools]))
    return "\n\n".join(blocks)


def render_system_count(ctx: RenderContext) -> str:
    systems = ctx.sources.systems
    canonical = ctx.sources.canonical_systems
    aliases = [s for s in systems if s.alias_of]
    text = f"{len(systems)} registry entries ({len(canonical)} systems"
    if aliases:
        names = ", ".join(f"`{a.id}` → `{a.alias_of}`" for a in aliases)
        text += f" plus {len(aliases)} alias{'es' if len(aliases) > 1 else ''}: {names}"
    return text + ")"


def render_library_vocabulary_count(ctx: RenderContext) -> str:
    return str(len(ctx.sources.library_vocabulary))


def render_which_component(ctx: RenderContext) -> str:
    vocabulary = ctx.sources.library_vocabulary
    rows = []
    for row in ctx.sources.guidance.get("which_component") or []:
        rows.append([
            row["job"],
            _render_component_refs(row.get("use") or [], vocabulary),
            _render_component_refs(row.get("not") or [], vocabulary),
            row["why"],
        ])
    if not rows:
        raise SourceError(f"{GUIDANCE_PATH}: which_component is empty")
    return _table(["Job", "Use", "Not", "Why"], rows)


def render_which_system(ctx: RenderContext) -> str:
    suits = dict((ctx.sources.guidance.get("which_system") or {}).get("suits") or {})
    canonical_ids = [s.id for s in ctx.sources.canonical_systems]
    missing = [i for i in canonical_ids if i not in suits]
    extra = [i for i in suits if i not in canonical_ids]
    if missing or extra:
        raise SourceError(
            f"{GUIDANCE_PATH}: which_system.suits must name every registered "
            f"system exactly once (missing: {missing or 'none'}; "
            f"not registered or an alias: {extra or 'none'})")
    rows = []
    for s in ctx.sources.systems:
        if s.alias_of:
            rows.append([f"`{s.id}`", f"Alias of `{s.alias_of}`: same spec and library.",
                         "", "", "", ""])
            continue
        intent = s.tagline
        if s.showcase_tag and s.showcase_tag != s.tagline:
            intent += f" (showcase: {s.showcase_tag})"
        rows.append([
            f"`{s.id}` {s.name}", intent, f"`{s.grammar_family}`", suits[s.id],
            f"{s.svg_count('components')} / {s.svg_count('layouts')}",
            str(len(s.rulebook)),
        ])
    return _table(["System", "Intent", "Grammar", "Suits",
                   "Components / layouts", "Rules"], rows)


def render_rules_agents_get_wrong(ctx: RenderContext) -> str:
    rows = []
    for item in ctx.sources.guidance.get("rules_agents_get_wrong") or []:
        refs = [_render_ref(ctx, ref) for ref in item.get("refs") or []]
        if not refs:
            raise SourceError(f"rules_agents_get_wrong: '{item['wrong']}' cites nothing")
        rows.append([item["wrong"], item["why"], ", ".join(refs)])
    if not rows:
        raise SourceError(f"{GUIDANCE_PATH}: rules_agents_get_wrong is empty")
    return _table(["Wrong", "Why", "Source"], rows)


def _render_ref(ctx: RenderContext, ref: str) -> str:
    kind, _, value = str(ref).partition(":")
    if kind == "rule":
        system_id, _, rule_id = value.partition("/")
        system = ctx.sources.system(system_id)
        if system is None:
            raise SourceError(f"rules_agents_get_wrong: unknown system in '{ref}'")
        if rule_id not in {r.get("id") for r in system.rulebook}:
            raise SourceError(
                f"rules_agents_get_wrong: '{ref}' is not a rulebook entry of {system_id}")
        return f"`{rule_id}`"
    if kind == "check":
        if value not in ctx.sources.check_ids:
            raise SourceError(
                f"rules_agents_get_wrong: '{ref}' is not a check in {RULEBOOK_CHECK_PATH}")
        return f"`{value}`"
    if kind == "doc":
        path = value.partition("#")[0]
        if not (ctx.sources.root / path).is_file():
            raise SourceError(f"rules_agents_get_wrong: '{ref}' names a missing file")
        return ctx.link(value)
    raise SourceError(f"rules_agents_get_wrong: unknown reference kind in '{ref}'")


def render_system_rules(ctx: RenderContext) -> str:
    blocks = []
    for s in ctx.sources.canonical_systems:
        aliases = [a.id for a in ctx.sources.systems if a.alias_of == s.id]
        title = f"#### {s.name} (`{s.id}`"
        title += "".join(f", alias `{a}`" for a in aliases) + ")"
        lines = [title, ""]
        facts = _token_facts(s.tokens)
        if facts:
            lines += [f"Tokens: {facts}.", ""]
        for rule in s.rulebook:
            meta = ", ".join(str(rule[k]) for k in ("severity", "check_method") if rule.get(k))
            lines.append(f"- `{rule['id']}` ({meta}): {_inline(first_sentence(rule.get('rule', '')))}")
        if not s.rulebook:
            lines.append("- _No rulebook entries._")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def _token_facts(tokens: Mapping[str, Any] | None) -> str:
    if not tokens:
        return ""
    facts = []
    steps = (tokens.get("space") or {}).get("steps")
    if steps:
        facts.append("spacing " + ", ".join(_number(v) for v in steps))
    sizes = {v["size"] for group in (tokens.get("type") or {},
                                     (tokens.get("extras") or {}).get("type") or {})
             for v in group.values() if isinstance(v, dict) and "size" in v}
    if sizes:
        facts.append("type sizes " + ", ".join(_number(v) for v in sorted(sizes)))
    radius = (tokens.get("radius") or {}).get("default")
    if radius is not None:
        facts.append(f"radius {_number(radius)}")
    accent = (tokens.get("color") or {}).get("accent")
    if accent:
        facts.append(f"accent `{accent}`")
    reduced = (tokens.get("motion") or {}).get("reduced_motion")
    if reduced:
        facts.append(f"reduced motion `{reduced}`")
    if (tokens.get("modes") or {}).get("axes"):
        facts.append("default mode")
    return "; ".join(facts)


def render_library_counts(ctx: RenderContext) -> str:
    rows = []
    for s in ctx.sources.systems:
        if s.alias_of:
            continue
        rows.append([
            f"`{s.id}`", s.spec.get("spec_version", ""),
            s.spec["system"].get("version", ""),
            str(s.svg_count("components")), str(s.svg_count("layouts")),
            str(len(s.rulebook)),
        ])
    return _table(["System", "spec_version", "Version", "Component SVGs",
                   "Layout SVGs", "Rulebook entries"], rows)


RENDERERS: dict[str, Callable[[RenderContext], str]] = {
    "mcp-tool-count": render_mcp_tool_count,
    "mcp-tools": render_mcp_tools,
    "system-count": render_system_count,
    "library-vocabulary-count": render_library_vocabulary_count,
    "which-component": render_which_component,
    "which-system": render_which_system,
    "rules-agents-get-wrong": render_rules_agents_get_wrong,
    "system-rules": render_system_rules,
    "library-counts": render_library_counts,
}


# ─── Documents ────────────────────────────────────────────────────────

@dataclass
class DocumentResult:
    """Outcome of rendering one file.

    Attributes:
        path: Repository-relative path.
        text: The file with every region regenerated (equal to the input
            when nothing is stale or on error).
        stale: Names of regions whose content changed.
        errors: Problems found; when non-empty nothing should be written.
    """

    path: Path
    text: str
    stale: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    regions: int = 0


def render_document(text: str, ctx: RenderContext,
                    expected: frozenset[str] = frozenset()) -> DocumentResult:
    """Regenerate every marked region in a document.

    Args:
        text: Current file content.
        ctx: Render context (its ``target`` names the file).
        expected: Regions the file must carry.

    Returns:
        The rendered document, the stale regions and any errors.
    """
    result = DocumentResult(ctx.target, text)
    out: list[str] = []
    pos = 0
    seen: set[str] = set()
    for start in MARKER_START.finditer(text):
        if start.start() < pos:
            result.errors.append(f"{ctx.target}: region '{start.group(1)}' is nested")
            continue
        name = start.group(1)
        end_marker = f"<!-- /generated:{name} -->"
        end_at = text.find(end_marker, start.end())
        next_start = MARKER_START.search(text, start.end())
        if end_at < 0 or (next_start and next_start.start() < end_at):
            result.errors.append(f"{ctx.target}: region '{name}' has no closing {end_marker}")
            continue
        seen.add(name)
        result.regions += 1
        old = text[start.end():end_at]
        renderer = RENDERERS.get(name)
        if renderer is None:
            result.errors.append(f"{ctx.target}: unknown region '{name}'")
            new = old
        else:
            try:
                body = renderer(ctx).strip("\n")
            except (SourceError, KeyError, TypeError) as exc:
                result.errors.append(f"{ctx.target}: region '{name}': {exc}")
                body = None
            if body is None:
                new = old
            elif old.startswith("\n"):
                new = f"\n{body}\n"
            else:
                new = body.strip()
        if new != old:
            result.stale.append(name)
        out.append(text[pos:start.end()])
        out.append(new)
        pos = end_at
    out.append(text[pos:])
    for end in MARKER_END.finditer(text):
        if f"<!-- generated:{end.group(1)} -->" not in text[: end.start()]:
            result.errors.append(f"{ctx.target}: closing marker for '{end.group(1)}' has no opening")
    for name in sorted(expected - seen):
        result.errors.append(
            f"{ctx.target}: missing region '{name}' "
            f"(expected <!-- generated:{name} --> … <!-- /generated:{name} -->)")
    if not result.errors:
        result.text = "".join(out)
    else:
        result.stale = []
    return result


def check_schema_tables(root: Path) -> list[str]:
    """Verify SCHEMA-V0.3.md's own generated tables match their code.

    Args:
        root: Repository root.

    Returns:
        One message per stale or missing table.
    """
    sys.path.insert(0, str(root / "tools" / "design-system-skill"))
    from design_system_skill.contract import (  # noqa: PLC0415
        render_contract_table, render_motion_table, render_pairs_table,
    )
    from design_system_skill.contrast import render_thresholds_table  # noqa: PLC0415

    path = root / SCHEMA_V03_PATH
    if not path.exists():
        return [f"{SCHEMA_V03_PATH}: missing"]
    text = path.read_text()
    problems = []
    for name, render in (("contract-table", render_contract_table),
                         ("pairs-table", render_pairs_table),
                         ("thresholds-table", render_thresholds_table),
                         ("motion-table", render_motion_table)):
        match = re.search(rf"<!-- {name}:begin -->(.*?)<!-- {name}:end -->", text, re.S)
        if match is None:
            problems.append(f"{SCHEMA_V03_PATH}: missing <!-- {name}:begin/end --> markers")
        elif match.group(1).strip() != render().strip():
            problems.append(
                f"{SCHEMA_V03_PATH}: {name} is stale (regenerate from design_system_skill)")
    return problems


def run(root: Path = REPO_ROOT, check: bool = False,
        targets: Mapping[str, frozenset[str]] | None = None,
        sources: Sources | None = None,
        schema_tables: bool = True) -> int:
    """Regenerate (or check) every target file.

    Args:
        root: Repository root.
        check: Report stale regions instead of writing them.
        targets: ``{relative path: expected regions}``; defaults to
            ``EXPECTED_REGIONS``.
        sources: Sources to render from; defaults to ``Sources(root)``.
        schema_tables: Also verify SCHEMA-V0.3.md's tables (check mode).

    Returns:
        Process exit status (see module docstring).
    """
    targets = EXPECTED_REGIONS if targets is None else targets
    sources = sources or Sources(root)
    results: list[DocumentResult] = []
    errors: list[str] = []
    for rel, expected in targets.items():
        path = root / rel
        if not path.exists():
            errors.append(f"{rel}: target file missing")
            continue
        ctx = RenderContext(sources, Path(rel))
        result = render_document(path.read_text(), ctx, expected)
        results.append(result)
        errors.extend(result.errors)
    if check and schema_tables:
        errors.extend(check_schema_tables(root))

    for message in errors:
        print(f"error: {message}", file=sys.stderr)
    stale = [(r.path, name) for r in results for name in r.stale]
    if errors:
        logger.error("docs_generate_failed", errors=len(errors))
        return 1
    if check:
        for path, name in stale:
            print(f"stale: {path} → {name}", file=sys.stderr)
        if stale:
            print("Run: uv run python tools/docs/generate.py", file=sys.stderr)
            return 1
        print(f"docs: {sum(r.regions for r in results)} regions in {len(results)} files current")
        return 0
    for result in results:
        if result.stale:
            (root / result.path).write_text(result.text)
            print(f"wrote {result.path}: {', '.join(result.stale)}")
    if not stale:
        print("docs: nothing to regenerate")
    logger.info("docs_generated", files=len({p for p, _ in stale}), regions=len(stale))
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    """CLI entry point.

    Args:
        argv: Arguments (default ``sys.argv[1:]``).

    Returns:
        Process exit status.
    """
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--check", action="store_true",
                        help="exit 1 if any generated region is stale; write nothing")
    args = parser.parse_args(argv)
    try:
        return run(REPO_ROOT, check=args.check)
    except SourceError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


def _configure_logging() -> None:
    """Structured JSON logs on stderr so stdout carries only the report."""
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
    )


if __name__ == "__main__":
    _configure_logging()
    sys.exit(main())
