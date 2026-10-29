#!/usr/bin/env python3
"""Build the skill-shaped bundle tkr-kit vendors as a pinned snapshot.

tkr-kit carries the two skills at ``.claude/skills/design-system-skill/``
and ``.claude/skills/wireframe-skill/`` and syncs them from a tag of this
repository without running Python (tkr-kit ADR-067, decision 7). So the
bundle is committed here, at ``bundle/design-system-skill/`` and
``bundle/wireframe-skill/``, in exactly that layout, and CI fails when the
committed copy is stale (``--check``).

Every source file under the scanned roots (``SCANNED_ROOTS``) is either
mapped into the bundle (``PREFIX_RULES``, ``SYSTEM_RULE``) or excluded
with a recorded reason (``EXCLUDED``, ``EXCLUDED_PATTERNS``). A file that is neither is an error,
so a new source file cannot silently miss the bundle.

Bytes are copied verbatim except for two transforms:

- ``libraries/registry.yaml``: entry paths renamed from ``<id>/`` to
  ``<id>-library/`` (the bundle's directory names).
- Markdown that lands in the bundle (each ``SKILL.md`` and
  ``references/*.md``): every path the text names is rewritten to where it
  lives in the bundle, or to a repository URL when it is not bundled. The
  rewritten docs are then verified: every path they name must resolve
  inside the bundle (see ``doc_path_findings``).

The full rules, and the paths deliberately left unchecked, are in
``docs/specs/BUNDLE.md``.

Usage::

    uv run python tools/bundle/build_bundle.py           # (re)write bundle/
    uv run python tools/bundle/build_bundle.py --check   # CI: exit 1 if stale

Exit status: 0 when the bundle is current (or was written), 1 when
``--check`` finds a stale, missing or extra file, 2 when the bundle cannot
be built (an unmapped source file, or a doc naming a path that resolves
nowhere).
"""

from __future__ import annotations

import argparse
import fnmatch
import os
import posixpath
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable, Mapping, Sequence

import structlog

logger = structlog.get_logger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = REPO_ROOT / "bundle"
REPO_URL = "https://github.com/TuckerTucker/tkr-design-systems"

DSS = "design-system-skill"
WF = "wireframe-skill"
SKILLS = (DSS, WF)

# ─── What goes where ──────────────────────────────────────────────────

# Repository paths whose every file must be mapped or excluded. Anything
# outside them (apps/, tools/mcp-server/, tools/e2e/, docs/adr/ ...) is
# repository-only by construction.
SCANNED_ROOTS: tuple[str, ...] = (
    "LICENSE",
    "NOTICE",
    "conftest.py",
    "docs/specs/",
    "systems/",
    "tools/builders/",
    "tools/design-system-skill/",
    "tools/wireframe-skill/",
)

# (source prefix, ((skill, destination prefix), ...)). A prefix ending in
# "/" maps a directory; otherwise it maps one file. The longest matching
# prefix wins.
PREFIX_RULES: tuple[tuple[str, tuple[tuple[str, str], ...]], ...] = (
    ("LICENSE", ((DSS, "LICENSE"), (WF, "LICENSE"))),
    ("NOTICE", ((DSS, "NOTICE"), (WF, "NOTICE"))),
    # The repository's pytest configuration (hermetic user-registry overlay)
    # travels with each skill's tests.
    ("conftest.py", ((DSS, "scripts/conftest.py"), (WF, "scripts/conftest.py"))),
    ("docs/specs/", ((DSS, "references/"),)),
    ("systems/registry.yaml", ((DSS, "libraries/registry.yaml"),)),
    ("tools/builders/test_ux_clauses.py", ((DSS, "scripts/test_ux_clauses.py"),)),
    ("tools/builders/", ((DSS, "tooling/"),)),
    ("tools/design-system-skill/SKILL.md", ((DSS, "SKILL.md"),)),
    ("tools/design-system-skill/schemas/", ((DSS, "schemas/"),)),
    ("tools/design-system-skill/", ((DSS, "scripts/"),)),
    ("tools/wireframe-skill/SKILL.md", ((WF, "SKILL.md"),)),
    ("tools/wireframe-skill/", ((WF, "scripts/"),)),
)

# systems/<id>/<rest> -> design-system-skill/libraries/<id>-library/<rest>
SYSTEM_RULE = re.compile(r"^systems/([^/]+)/(.*)$")

# Scanned files deliberately left out of the bundle, each with its reason.
EXCLUDED: Mapping[str, str] = {
    "docs/specs/BUNDLE.md": (
        "describes how this repository builds the bundle; it has no meaning "
        "inside the consumer's skill tree"),
    "tools/builders/build_riso_reference.py": (
        "authoring script that writes systems/riso/riso-reference.html into "
        "the repository; its output is bundled, the generator is not"),
    "tools/builders/test_build.py": (
        "unit-tests the library engine against the repository's engine "
        "fixtures and systems/ layout; the bundle's engine is proven instead by "
        "running tooling/build.py --check inside the bundle "
        "(tools/bundle/test_build_bundle.py)"),
    "tools/design-system-skill/test_jsx_drift.py": (
        "checks the showcase app (apps/showcase), which the bundle does not "
        "carry; the jsx-drift subcommand is repository-only"),
}

# Scanned files left out by pattern (fnmatch; ``*`` crosses ``/``), each
# with its reason.
EXCLUDED_PATTERNS: Mapping[str, str] = {
    "systems/*.png": (
        "PNG previews of library SVGs, rendered for people browsing this "
        "repository; no skill code or tkr-kit consumer reads them, the SVG is "
        "the artifact, and they are about half the bundle's bytes"),
}


def exclusion_reason(repo_path: str) -> str | None:
    """Why a scanned file is left out of the bundle, or None when it is not.

    Args:
        repo_path: ``/``-separated path relative to the repository root.

    Returns:
        The recorded reason (``EXCLUDED`` or ``EXCLUDED_PATTERNS``).
    """
    if repo_path in EXCLUDED:
        return EXCLUDED[repo_path]
    for pattern, reason in EXCLUDED_PATTERNS.items():
        if fnmatch.fnmatchcase(repo_path, pattern):
            return reason
    return None


# Markdown files in the bundle whose named paths are rewritten and checked.
_DOC_DEST = re.compile(r"^(SKILL\.md|references/[^/]+\.md)$")


@dataclass(frozen=True)
class Dest:
    """A location in the bundle.

    Attributes:
        skill: ``design-system-skill`` or ``wireframe-skill``.
        rel: Path relative to the skill root (``/``-separated). Ends in
            ``/`` when it names a directory.
    """

    skill: str
    rel: str

    @property
    def path(self) -> str:
        """The bundle-relative path, e.g. ``design-system-skill/SKILL.md``."""
        return f"{self.skill}/{self.rel}"


def map_source(repo_path: str) -> tuple[Dest, ...]:
    """Map a repository path (file or ``/``-terminated directory) into the bundle.

    Args:
        repo_path: ``/``-separated path relative to the repository root.

    Returns:
        The bundle destinations, or ``()`` when the path is not bundled
        (outside the rules, or excluded).
    """
    if exclusion_reason(repo_path) is not None:
        return ()
    m = SYSTEM_RULE.match(repo_path)
    if m and m.group(1) != "registry.yaml":
        return (Dest(DSS, f"libraries/{m.group(1)}-library/{m.group(2)}"),)
    best: tuple[str, tuple[tuple[str, str], ...]] | None = None
    for prefix, dests in PREFIX_RULES:
        hit = repo_path.startswith(prefix) if prefix.endswith("/") else repo_path == prefix
        if hit and (best is None or len(prefix) > len(best[0])):
            best = (prefix, dests)
    if best is None:
        return ()
    rest = repo_path[len(best[0]):]
    return tuple(Dest(skill, dest + rest) for skill, dest in best[1])


def is_scanned(repo_path: str) -> bool:
    """Whether a repository file falls under ``SCANNED_ROOTS``.

    Args:
        repo_path: ``/``-separated path relative to the repository root.

    Returns:
        True when the file must be mapped or excluded.
    """
    return any(repo_path.startswith(r) if r.endswith("/") else repo_path == r
               for r in SCANNED_ROOTS)


# ─── Registry transform ───────────────────────────────────────────────

_REGISTRY_PATH_LINE = re.compile(r"^(\s*(?:-\s+)?(?:spec|library_root):\s*)(\S+)(\s*)$")


def rewrite_registry(text: str) -> str:
    """Rename registry entry paths to the bundle's ``<id>-library`` directories.

    Args:
        text: The repository's ``systems/registry.yaml``.

    Returns:
        The same document with every ``spec`` / ``library_root`` value
        mapped through ``SYSTEM_RULE`` (comments and order untouched).

    Raises:
        BundleError: If a value names no bundled system directory.
    """
    out = []
    for line in text.splitlines(keepends=True):
        body = line.rstrip("\n")
        m = _REGISTRY_PATH_LINE.match(body)
        if m:
            value = m.group(2)
            probe = f"systems/{value}" + ("" if "/" in value else "/")
            dests = map_source(probe)
            if not dests or not dests[0].rel.startswith("libraries/"):
                raise BundleError([f"systems/registry.yaml: {value!r} maps to no system library"])
            mapped = dests[0].rel[len("libraries/"):]
            if "/" not in value:
                mapped = mapped.rstrip("/")
            body = f"{m.group(1)}{mapped}{m.group(3)}"
            line = body + ("\n" if line.endswith("\n") else "")
        out.append(line)
    return "".join(out)


# ─── Doc path rewriting ───────────────────────────────────────────────

# Tokens that name paths in a doc. Three places are read; everything else
# (prose, YAML/JSON examples and directory diagrams in non-command fences)
# is illustrative and left alone — see docs/specs/BUNDLE.md.
INLINE = "inline"      # a whole `code span` that is one path
COMMAND = "command"    # a path argument on a python3 / uv run command line
LINK = "link"          # a markdown link target: [x](target)

_FENCE = re.compile(r"^\s*(```|~~~)")
_COMMAND_START = re.compile(r"^\s*(?:\$\s+)?(?:uv run |python3? )")
_INLINE_CODE = re.compile(r"(`+)([^`]+?)\1")
_LINK = re.compile(r"\]\(([^)\s]+)\)")
_PATH_SHAPED = re.compile(r"^[\w.<>{}*\-/]+$")
_COMMAND_TOKEN = re.compile(r"\S+")

# Command heads naming a skill's CLI the way this repository runs it.
_CLI_HEADS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\buv run python3? "), "python3 "),
    (re.compile(r"\bpython3? (?:tools/)?design-system-skill(?=\s|$|`)"),
     "python3 tools/design-system-skill/__main__.py"),
    (re.compile(r"\bpython3? (?:tools/)?wireframe-skill(?=\s|$|`)"),
     "python3 tools/wireframe-skill/__main__.py"),
)

# Bundle-native prefixes: a token already written relative to a skill root.
_BUNDLE_NATIVE = ("libraries/", "references/", "schemas/", "scripts/", "tooling/")

# Paths a doc names on purpose although no file exists at them, each with
# its reason. fnmatch patterns over the whole token.
EXAMPLE_PATHS: Mapping[str, str] = {
    "*rulebook-exceptions.yaml": (
        "names where an author creates a system's allow-list; no built-in "
        "system needs one"),
    "shared_assets/": "a proposed directory the docs discuss and defer; it does not exist",
    "./out": "an example output directory the caller chooses",
    "out/*": "an example output file the caller chooses",
}

# A token starting with one of these names a directory or file inside any
# system library (relative to the library, not to the skill root).
_LIBRARY_RELATIVE = ("components/", "layouts/")


def _is_example(core: str) -> bool:
    """Whether a token is a deliberate example path (``EXAMPLE_PATHS``)."""
    return any(fnmatch.fnmatchcase(core, pat) for pat in EXAMPLE_PATHS)


TokenFn = Callable[[str, str], str]


def _split_suffix(token: str) -> tuple[str, str]:
    """Split ``path::symbol`` / ``path#anchor`` / trailing punctuation off a token."""
    m = re.match(r"^(.*?)((?:::|#).*)?$", token)
    core, suffix = m.group(1), m.group(2) or ""
    trail = re.search(r"[,.;:)]+$", core)
    if trail and not core.endswith("..."):
        suffix = trail.group(0) + suffix
        core = core[:trail.start()]
    return core, suffix


def transform_doc(text: str, fn: TokenFn) -> str:
    """Apply ``fn(token, kind)`` to every path-shaped token a doc names.

    ``fn`` returns the replacement text (the token itself to leave it).
    Command lines first have their CLI heads normalised (``_CLI_HEADS``) so
    the script path is a token like any other.

    Args:
        text: Markdown source.
        fn: Token callback.

    Returns:
        The rewritten text.
    """
    def path_token(token: str, kind: str) -> str:
        core, suffix = _split_suffix(token)
        if core.startswith("${"):
            return fn(core, kind) + suffix
        if "/" not in core or not _PATH_SHAPED.match(core):
            return token
        return fn(core, kind) + suffix

    def command(line: str) -> str:
        for pattern, repl in _CLI_HEADS:
            line = pattern.sub(repl, line)
        return _COMMAND_TOKEN.sub(lambda m: path_token(m.group(0), COMMAND), line)

    def inline(m: re.Match[str]) -> str:
        ticks, body = m.group(1), m.group(2)
        if _COMMAND_START.match(body):
            return f"{ticks}{command(body)}{ticks}"
        if any(c.isspace() for c in body):
            return m.group(0)
        return f"{ticks}{path_token(body, INLINE)}{ticks}"

    def link(m: re.Match[str]) -> str:
        target = m.group(1)
        if re.match(r"^(?:[a-z]+:|#)", target):
            return m.group(0)
        return f"]({path_token(target, LINK)})"

    lines = text.splitlines(keepends=True)
    out: list[str] = []
    prose: list[str] = []

    def flush() -> None:
        # Inline spans and links are read per paragraph, so a code span
        # wrapped across lines is still one span.
        if prose:
            chunk = _INLINE_CODE.sub(inline, "".join(prose))
            out.append(_LINK.sub(link, chunk))
            prose.clear()

    i = 0
    while i < len(lines):
        line = lines[i]
        if _FENCE.match(line):
            flush()
            j = i + 1
            while j < len(lines) and not _FENCE.match(lines[j]):
                j += 1
            body = lines[i + 1:j]
            is_command = any(_COMMAND_START.match(b) for b in body)
            out.append(line)
            out.extend(command(b) if is_command else b for b in body)
            if j < len(lines):
                out.append(lines[j])
            i = j + 1
            continue
        prose.append(line)
        if not line.strip():
            flush()
        i += 1
    flush()
    return "".join(out)


def _render(dest: Dest, kind: str, doc: Dest) -> str:
    """Write a bundle location the way a doc of skill ``doc.skill`` names it."""
    rel = dest.rel if dest.skill == doc.skill else f"../{dest.skill}/{dest.rel}"
    if kind == COMMAND:
        return "${CLAUDE_SKILL_DIR}/" + rel
    if kind == LINK:
        here = posixpath.dirname(doc.path)
        out = posixpath.relpath(dest.path.rstrip("/"), here or ".")
        return out + ("/" if dest.rel.endswith("/") else "")
    return rel


def _glob(pattern: str) -> str:
    """Turn ``<id>`` / ``{id}`` placeholders into fnmatch wildcards."""
    return re.sub(r"<[^>]+>|\{[^}]+\}", "*", pattern)


def _exists(path: str, population: Iterable[str]) -> bool:
    """Whether ``path`` (maybe a placeholder pattern or a directory) names something real."""
    target = _glob(path.rstrip("/"))
    for p in population:
        if fnmatch.fnmatchcase(p, target) or fnmatch.fnmatchcase(p, target + "/*"):
            return True
    return False


def _to_repo_path(core: str, kind: str, doc_source: str) -> str | None:
    """Resolve a doc token to a repository path, or None when it names no repo path."""
    if kind == LINK:
        return posixpath.normpath(posixpath.join(posixpath.dirname(doc_source), core)) + (
            "/" if core.endswith("/") else "")
    if core.startswith("../"):
        return posixpath.normpath(posixpath.join(posixpath.dirname(doc_source), core))
    # A Python package path (design_system_skill/x) names a file inside its
    # skill's tool directory; a skill directory path (design-system-skill/x)
    # names a file of that skill.
    for prefix, replacement in (
        ("design_system_skill/", "tools/design-system-skill/design_system_skill/"),
        ("wireframe_skill/", "tools/wireframe-skill/wireframe_skill/"),
        ("design-system-skill/", "tools/design-system-skill/"),
        ("wireframe-skill/", "tools/wireframe-skill/"),
    ):
        if core.startswith(prefix):
            return replacement + core[len(prefix):]
    return core


def rewrite_doc(text: str, doc_source: str, doc: Dest, repo_files: Sequence[str],
                problems: list[str]) -> str:
    """Rewrite every path a bundled doc names to its bundle location.

    A path that is bundled becomes its location relative to the doc's skill
    root (``${CLAUDE_SKILL_DIR}/...`` on a command line, file-relative in a
    link). A path that exists in the repository but is not bundled becomes
    a repository URL. A path that exists in neither is reported.

    Args:
        text: The doc as authored in the repository.
        doc_source: Its repository path.
        doc: Its bundle location.
        repo_files: Every repository file (for existence checks).
        problems: Findings are appended here.

    Returns:
        The rewritten doc.
    """
    def fn(core: str, kind: str) -> str:
        if core.startswith(("${", "/", "~", ".claude/")) or core.startswith(_BUNDLE_NATIVE):
            return core
        if core.startswith(_LIBRARY_RELATIVE):
            if not _exists(f"systems/*/{core}", repo_files):
                problems.append(f"{doc_source}: {core!r} is in no system library")
            return core
        repo_path = _to_repo_path(core, kind, doc_source)
        dests = map_source(repo_path) if repo_path else ()
        if dests and (_exists(repo_path, repo_files) or _is_example(core)):
            return _render(dests[0], kind, doc)
        if kind == COMMAND and not _is_example(core):
            problems.append(f"{doc_source}: a command names {core!r}, which the bundle "
                            f"does not carry; name it as a repository path instead")
            return core
        if repo_path and _exists(repo_path, repo_files):
            kind_seg = "blob" if posixpath.splitext(repo_path.rstrip("/"))[1] else "tree"
            return f"{REPO_URL}/{kind_seg}/main/{repo_path.rstrip('/')}"
        if not _is_example(core):
            problems.append(f"{doc_source}: {core!r} names a path that is neither bundled "
                            f"nor in the repository")
        return core

    return transform_doc(text, fn)


def doc_path_findings(planned: Mapping[str, bytes]) -> list[str]:
    """Check that every path a bundled doc names resolves inside the bundle.

    Reads each bundled ``SKILL.md`` and ``references/*.md`` with the same
    tokenizer as the rewrite. Not checked, by design: URLs, absolute and
    home paths (the caller's filesystem), ``.claude/...`` (the consuming
    project's own tree), bare file names, and ``EXAMPLE_PATHS``. A
    ``components/`` / ``layouts/`` token resolves inside any system library.

    Args:
        planned: The bundle, ``bundle-relative path -> bytes``.

    Returns:
        One finding per unresolved path.
    """
    files = sorted(planned)
    findings: list[str] = []
    for path in files:
        skill, _, rel = path.partition("/")
        if not _DOC_DEST.match(rel):
            continue

        def fn(core: str, kind: str, skill: str = skill, path: str = path) -> str:
            if core.startswith("${CLAUDE_SKILL_DIR}/"):
                target = posixpath.normpath(f"{skill}/{core[len('${CLAUDE_SKILL_DIR}/'):]}")
            elif core.startswith(("/", "~", ".claude/", "${", "http")):
                return core
            elif kind == LINK:
                target = posixpath.normpath(posixpath.join(posixpath.dirname(path), core))
            elif core.startswith(_LIBRARY_RELATIVE):
                target = f"{DSS}/libraries/*/{core}"
            else:
                target = posixpath.normpath(posixpath.join(skill, core))
            if _is_example(core):
                return core
            if not _exists(target, files):
                findings.append(f"{path}: {core!r} does not resolve inside the bundle")
            return core

        transform_doc(planned[path].decode("utf-8"), fn)
    return findings


# ─── Planning, observing, comparing ───────────────────────────────────

class BundleError(Exception):
    """The bundle cannot be built; ``problems`` says why."""

    def __init__(self, problems: list[str]):
        super().__init__("; ".join(problems))
        self.problems = problems


SourceLister = Callable[[Path], list[str]]


def git_sources(repo: Path) -> list[str]:
    """List the repository's files as git sees them (tracked plus untracked, not ignored).

    Args:
        repo: Repository root.

    Returns:
        Sorted ``/``-separated paths of files that exist on disk.
    """
    out = subprocess.run(
        ["git", "-C", str(repo), "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
        capture_output=True, check=True,
    ).stdout.decode("utf-8")
    return sorted(p for p in set(out.split("\0")) if p and (repo / p).is_file())


def plan_bundle(repo: Path, sources: Sequence[str]) -> dict[str, bytes]:
    """Compute the bundle: every file, keyed by bundle-relative path.

    Args:
        repo: Repository root to read sources from.
        sources: Every repository file (see ``git_sources``).

    Returns:
        ``{"design-system-skill/SKILL.md": b"...", ...}``.

    Raises:
        BundleError: If a scanned file is neither mapped nor excluded, two
            sources map to one destination, or a doc names an unresolvable path.
    """
    problems: list[str] = []
    planned: dict[str, bytes] = {}
    origin: dict[str, str] = {}
    for src in sorted(sources):
        if not is_scanned(src):
            continue
        dests = map_source(src)
        if not dests:
            if exclusion_reason(src) is None:
                problems.append(f"{src}: under a scanned root but neither mapped nor excluded")
            continue
        raw = (repo / src).read_bytes()
        for dest in dests:
            if dest.path in planned:
                problems.append(f"{dest.path}: produced by both {origin[dest.path]} and {src}")
                continue
            data = raw
            if dest.rel == "libraries/registry.yaml":
                data = rewrite_registry(raw.decode("utf-8")).encode("utf-8")
            elif _DOC_DEST.match(dest.rel):
                data = rewrite_doc(raw.decode("utf-8"), src, dest, sources,
                                   problems).encode("utf-8")
            planned[dest.path] = data
            origin[dest.path] = src
    if problems:
        raise BundleError(problems)
    findings = doc_path_findings(planned)
    if findings:
        raise BundleError(findings)
    logger.info("bundle_planned", files=len(planned),
                per_skill={s: sum(1 for p in planned if p.startswith(s + "/")) for s in SKILLS})
    return dict(sorted(planned.items()))


# Generated by running the bundled code and tests in place; never bundle
# content. All are gitignored (.gitignore), so git's view of bundle/ — the
# view tkr-kit's drift check uses (ADR-067, decision 8) — excludes them too.
_IGNORED_DIRS = ("__pycache__", ".pytest_cache", "pytest-cache-files-*")
_IGNORED_FILES = (".DS_Store", "*.pyc", "*.pyo")


def observe_bundle(out: Path) -> dict[str, bytes]:
    """Read the bundle as it is on disk.

    Args:
        out: The bundle directory (holding one directory per skill).

    Returns:
        ``bundle-relative path -> bytes`` for every file except the
        generated caches named in ``_IGNORED_DIRS`` / ``_IGNORED_FILES``.
    """
    found: dict[str, bytes] = {}
    if not out.is_dir():
        return found
    for root, dirs, files in os.walk(out):
        dirs[:] = sorted(d for d in dirs
                         if not any(fnmatch.fnmatch(d, pat) for pat in _IGNORED_DIRS))
        for name in sorted(files):
            if any(fnmatch.fnmatch(name, pat) for pat in _IGNORED_FILES):
                continue
            path = Path(root) / name
            found[path.relative_to(out).as_posix()] = path.read_bytes()
    return found


@dataclass(frozen=True)
class Drift:
    """One difference between the planned and the committed bundle."""

    kind: str   # "missing" | "extra" | "stale"
    path: str


def compare(planned: Mapping[str, bytes], observed: Mapping[str, bytes]) -> list[Drift]:
    """Every file missing from, extra in, or different in the observed bundle.

    Args:
        planned: What the bundle should hold.
        observed: What it holds.

    Returns:
        Drift entries, sorted by path.
    """
    out = [Drift("missing", p) for p in planned if p not in observed]
    out += [Drift("extra", p) for p in observed if p not in planned]
    out += [Drift("stale", p) for p in planned if p in observed and observed[p] != planned[p]]
    return sorted(out, key=lambda d: (d.path, d.kind))


def write_bundle(out: Path, planned: Mapping[str, bytes]) -> list[Drift]:
    """Make the bundle directory match the plan exactly.

    Args:
        out: The bundle directory.
        planned: What it should hold.

    Returns:
        The drift that was repaired.
    """
    drift = compare(planned, observe_bundle(out))
    for d in drift:
        target = out / d.path
        if d.kind == "extra":
            target.unlink()
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(planned[d.path])
    for root, dirs, files in sorted(os.walk(out, topdown=False)):
        here = Path(root)
        if here != out and not any(here.iterdir()):
            here.rmdir()
    return drift


# ─── CLI ──────────────────────────────────────────────────────────────

def main(argv: Sequence[str] | None = None, *, lister: SourceLister = git_sources) -> int:
    """Build or check the bundle.

    Args:
        argv: Arguments (default: ``sys.argv[1:]``).
        lister: Lists the repository's files (injectable for tests).

    Returns:
        Process exit status (see module docstring).
    """
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    p.add_argument("--check", action="store_true",
                   help="exit 1 if the committed bundle is stale, missing or has extra files")
    p.add_argument("--repo", type=Path, default=REPO_ROOT, help="repository root")
    p.add_argument("--out", type=Path, default=None, help="bundle directory (default: <repo>/bundle)")
    args = p.parse_args(argv)
    repo = args.repo.resolve()
    out = (args.out or repo / "bundle").resolve()

    try:
        planned = plan_bundle(repo, lister(repo))
    except BundleError as exc:
        for problem in exc.problems:
            print(f"error {problem}", file=sys.stderr)
        logger.error("bundle_unbuildable", problems=len(exc.problems))
        return 2

    if args.check:
        drift = compare(planned, observe_bundle(out))
        for d in drift:
            print(f"{d.kind} {d.path}")
        if drift:
            print(f"{len(drift)} file(s) differ from the planned bundle; "
                  f"run: uv run python tools/bundle/build_bundle.py", file=sys.stderr)
            logger.warning("bundle_stale", drift=len(drift))
            return 1
        print(f"ok    {len(planned)} bundle files up to date")
        return 0

    repaired = write_bundle(out, planned)
    for d in repaired:
        print(f"{'removed' if d.kind == 'extra' else 'wrote'} {d.path}")
    print(f"{len(repaired)} of {len(planned)} bundle files changed")
    logger.info("bundle_written", changed=len(repaired), files=len(planned))
    return 0


def _configure_logging() -> None:
    """JSON logs on stderr; stdout carries the report."""
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
