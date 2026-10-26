"""Drift guard between the showcase JSX and the token files (issue #4).

``systems/<id>/tokens.json`` is the single source of truth for token
values, and every showcase page (``apps/showcase/src/systems/
design-system-<id>.jsx``) reads its system's design values from it. This
module keeps it that way: it scans each page for colour literals
(``#RGB``/``#RRGGBB``/``#RRGGBBAA``, ``rgb()``/``rgba()``,
``hsl()``/``hsla()``) and fails when one

* ``token_literal`` — equals a value the system's token file produces (in
  any mode) and no allow-list entry scoped to that place covers it: it
  should be a token reference, otherwise the page drifts when the token
  changes;
* ``unlisted`` — is not a token value and no allow-list entry covers it.

What is left after migration is the showcase's *documentation chrome*
(the dark spec viewer around the live preview: ``#0A0A0A`` page,
``#CCC``/``#999``/``#555`` doc text, ``Do``/``Dont`` greens and reds, white
hairlines) plus the occasional deliberate one-off. Those are listed,
each with a reason, in the allow-list file
(``apps/showcase/jsx-color-allowlist.yaml``)::

    version: 1
    entries:
      - literal: "#CCC"                 # matched by normalized value
        systems: ["*"]                  # system ids (registry / token file ids)
        regions: ["*"]                  # optional: top-level declarations
        context: "fontSize: 10"         # optional: regex the source line must match
        reason: Doc text (spec viewer chrome).

Regions are the page's top-level declarations (``Tk``, ``CBox``,
``SwissChat``, ``App``); inside a ``<name>Spec`` object the region is
``<name>Spec.<section>`` (``swissSpec.color``). ``regions`` entries are
``fnmatch`` patterns.

An entry whose value equals a token value of a system it applies to must
narrow itself with ``regions`` other than ``*`` or with ``context`` — a
blanket entry would hide exactly the drift this guard exists to catch.
An entry that matches no literal on any page it applies to is *stale* and
fails (``allowlist_stale``), so the list cannot rot. An entry without a
reason, or with an unknown key, makes the file invalid.

The scan covers comments and prose too: a hex value quoted in a sentence
is a copy of a token that will go stale when the token changes.
"""

from __future__ import annotations

import fnmatch
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterable

import structlog
import yaml

from .contract import normalize_color
from .errors import Error, Result
from .token_file import TOKEN_FILE_NAME, color_values, load_token_file

logger = structlog.get_logger(__name__)


ALLOWLIST_RELPATH = Path("apps/showcase/jsx-color-allowlist.yaml")
"""Allow-list location, relative to the repository root."""


def repo_root() -> Path:
    """Return the repository root (the directory holding ``systems/`` and ``apps/``).

    Returns:
        Absolute path derived from this module's location.
    """
    # parents: design_system_skill, design-system-skill, tools, <repo>
    return Path(__file__).resolve().parents[3]

_ENTRY_KEYS = frozenset({"literal", "systems", "regions", "context", "reason"})
_TOP_LEVEL_KEYS = frozenset({"version", "entries"})

COLOR_LITERAL_RE = re.compile(
    r"#(?:[0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{3})(?![0-9A-Za-z_])"
    r"|\b(?:rgba?|hsla?)\([^()]*\)"
)
"""Colour literals in source text. Template expressions (``${c.accent}``) never match."""

_DECL_RE = re.compile(
    r"^(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)"
)
_SECTION_RE = re.compile(r"^\s{2}([A-Za-z_$][\w$]*):\s*\(\)\s*=>")


@dataclass(frozen=True)
class Literal:
    """One colour literal found in a page.

    Attributes:
        system: Showcase system id (``neutral``, ``swiss``, ...).
        file: Page path relative to the project root.
        line: 1-based line number.
        column: 1-based column.
        text: The literal as written.
        value: Normalized value (``normalize_color``), or the lower-cased
            text when the literal is not a parsable colour (``hsl()``).
        region: Enclosing top-level declaration (see module docstring).
        source_line: The full source line (for ``context`` matching).
    """

    system: str
    file: str
    line: int
    column: int
    text: str
    value: str
    region: str
    source_line: str


@dataclass
class AllowEntry:
    """One allow-list entry.

    Attributes:
        index: Position in the ``entries`` list (for messages).
        literal: The colour as written in the file.
        value: Normalized colour value used for matching.
        systems: System ids the entry applies to (``*`` = all).
        regions: ``fnmatch`` patterns over regions (``*`` = anywhere).
        context: Optional regex the source line must match.
        reason: Why the literal is not a token reference. Always non-empty.
        hits: Number of literals the entry covered in the last scan.
    """

    index: int
    literal: str
    value: str
    systems: tuple[str, ...]
    regions: tuple[str, ...]
    context: re.Pattern[str] | None
    reason: str
    hits: int = 0

    @property
    def scoped(self) -> bool:
        """True when the entry is narrower than "anywhere in the page"."""
        return self.context is not None or any(r != "*" for r in self.regions)

    def applies_to(self, system: str) -> bool:
        """Return True if the entry covers ``system``."""
        return "*" in self.systems or system in self.systems

    def matches(self, lit: Literal) -> bool:
        """Return True if the entry covers ``lit``."""
        if lit.value != self.value or not self.applies_to(lit.system):
            return False
        if not any(fnmatch.fnmatchcase(lit.region, r) for r in self.regions):
            return False
        return self.context is None or bool(self.context.search(lit.source_line))

    def describe(self) -> str:
        """Return a one-line human description of the entry."""
        bits = [f"#{self.index} {self.literal}", f"systems={list(self.systems)}"]
        if self.regions != ("*",):
            bits.append(f"regions={list(self.regions)}")
        if self.context is not None:
            bits.append(f"context={self.context.pattern!r}")
        return " ".join(bits)


@dataclass(frozen=True)
class JsxDriftItem:
    """One failure.

    Attributes:
        kind: ``token_literal`` | ``unlisted`` | ``allowlist_stale`` |
            ``allowlist_unscoped``.
        system: System id, or ``*`` for allow-list problems spanning pages.
        file: Page or allow-list path relative to the project root.
        line: 1-based line (0 for allow-list problems).
        literal: The colour as written.
        tokens: Token paths producing the same value (``token_literal``).
        message: Human-readable explanation.
    """

    kind: str
    system: str
    file: str
    line: int
    literal: str
    tokens: tuple[str, ...]
    message: str


@dataclass(frozen=True)
class ShowcasePage:
    """A showcase page and the token file it must read from.

    Attributes:
        system: Showcase system id (the page's route).
        token_system: Id of the system whose token file the page reads.
        jsx: Absolute path of the page.
        tokens: Absolute path of the token file.
    """

    system: str
    token_system: str
    jsx: Path
    tokens: Path


@dataclass
class JsxDriftReport:
    """Result of a scan.

    Attributes:
        pages: Pages scanned (system ids).
        literals: Number of colour literals found.
        allowed: Number covered by allow-list entries.
        items: Failures.
    """

    pages: list[str] = field(default_factory=list)
    literals: int = 0
    allowed: int = 0
    items: list[JsxDriftItem] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serialisable dict."""
        return {
            "pages": self.pages,
            "literals": self.literals,
            "allowed": self.allowed,
            "failures": [asdict(i) for i in self.items],
        }


class AllowlistError(ValueError):
    """Raised when the allow-list file is unreadable or invalid.

    Attributes:
        path: The offending file.
        errors: Every validation problem found, collected in one pass.
    """

    def __init__(self, path: Path, errors: list[str]) -> None:
        self.path = Path(path)
        self.errors = list(errors)
        super().__init__(f"{self.path}: " + "; ".join(self.errors))


# ──────────────────────────────────────────────────────────────────────
# Discovery
# ──────────────────────────────────────────────────────────────────────

def discover_pages(root: Path | None = None) -> list[ShowcasePage]:
    """Find every showcase page and the token file it reads.

    Each token file names its page in ``source``. The wireframe file's
    page is ``design-system-neutral.jsx`` (the ``neutral`` registry alias
    shares the wireframe spec and token file), so the page's system id is
    taken from its file name.

    Args:
        root: Repository root (defaults to ``repo_root()``).

    Returns:
        Pages sorted by system id.
    """
    root = root or repo_root()
    pages: list[ShowcasePage] = []
    for tokens in sorted((root / "systems").glob(f"*/{TOKEN_FILE_NAME}")):
        loaded = load_token_file(tokens)
        if not loaded.ok:
            continue
        source = loaded.data.get("source")
        if not isinstance(source, str) or not source.endswith(".jsx"):
            continue
        jsx = root / source
        if not jsx.is_file():
            continue
        system = jsx.stem.removeprefix("design-system-")
        pages.append(ShowcasePage(system, tokens.parent.name, jsx, tokens))
    return sorted(pages, key=lambda p: p.system)


# ──────────────────────────────────────────────────────────────────────
# Scanning
# ──────────────────────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    return normalize_color(text) or re.sub(r"\s+", "", text.lower())


def scan_source(text: str, system: str, file: str) -> list[Literal]:
    """Return every colour literal in a page's source.

    Args:
        text: Page source.
        system: System id recorded on each literal.
        file: Path recorded on each literal.

    Returns:
        Literals in source order.
    """
    out: list[Literal] = []
    decl = "<module>"
    section: str | None = None
    for lineno, line in enumerate(text.splitlines(), start=1):
        m = _DECL_RE.match(line)
        if m:
            decl, section = m.group(1), None
        elif decl.endswith("Spec"):
            s = _SECTION_RE.match(line)
            if s:
                section = s.group(1)
        region = f"{decl}.{section}" if section else decl
        for lit in COLOR_LITERAL_RE.finditer(line):
            out.append(Literal(system, file, lineno, lit.start() + 1, lit.group(0),
                               _normalize(lit.group(0)), region, line))
    return out


def token_values_by_color(doc: dict[str, Any]) -> dict[str, list[str]]:
    """Map each normalized colour value to the token paths producing it.

    Mode overrides are included (path suffixed with ``@axis=option``).

    Args:
        doc: Token document.

    Returns:
        ``{normalized value: [token path, ...]}``.
    """
    out: dict[str, list[str]] = {}

    def walk(node: Any, path: str) -> None:
        if isinstance(node, dict):
            for k, v in node.items():
                walk(v, f"{path}.{k}" if path else k)
        elif isinstance(node, str):
            norm = normalize_color(node)
            if norm:
                out.setdefault(norm, []).append(path)

    for key, value in doc.items():
        if key in {"color", "extras", "elevation"}:
            walk(value, key)
    for axis in (doc.get("modes") or {}).get("axes") or []:
        for option, overrides in (axis.get("options") or {}).items():
            for path, value in (overrides or {}).items():
                norm = normalize_color(value)
                if norm:
                    out.setdefault(norm, []).append(f"{path}@{axis.get('id')}={option}")
    # color_values is the contract definition of "a value the file produces";
    # anything it knows that the walk missed is still a token value.
    for norm in color_values(doc):
        out.setdefault(norm, ["<token>"])
    return out


# ──────────────────────────────────────────────────────────────────────
# Allow-list
# ──────────────────────────────────────────────────────────────────────

def _as_tuple(value: Any, default: tuple[str, ...]) -> tuple[str, ...] | None:
    if value is None:
        return default
    if isinstance(value, str):
        value = [value]
    if isinstance(value, list) and value and all(isinstance(v, str) and v for v in value):
        return tuple(value)
    return None


def parse_allowlist(data: Any, source: Path) -> list[AllowEntry]:
    """Validate a parsed allow-list document and build its entries.

    Args:
        data: The YAML document (``None`` for an empty file).
        source: Path of the file, used in error messages.

    Returns:
        Entries in file order.

    Raises:
        AllowlistError: Listing every problem found.
    """
    if data is None:
        return []
    if not isinstance(data, dict):
        raise AllowlistError(source, ["top level must be a mapping with an 'entries' list"])
    errors: list[str] = []
    unknown_top = set(data) - _TOP_LEVEL_KEYS
    if unknown_top:
        errors.append(f"unknown top-level key(s): {sorted(unknown_top)}")
    raw_entries = data.get("entries") or []
    if not isinstance(raw_entries, list):
        raise AllowlistError(source, errors + ["'entries' must be a list"])

    entries: list[AllowEntry] = []
    seen: dict[tuple, int] = {}
    for i, raw in enumerate(raw_entries):
        where = f"entries[{i}]"
        if not isinstance(raw, dict):
            errors.append(f"{where}: must be a mapping")
            continue
        unknown = set(raw) - _ENTRY_KEYS
        if unknown:
            errors.append(f"{where}: unknown key(s) {sorted(unknown)}")
        ok = True
        literal = raw.get("literal")
        value = _normalize(literal) if isinstance(literal, str) else None
        if not isinstance(literal, str) or not COLOR_LITERAL_RE.fullmatch(literal.strip()):
            errors.append(f"{where}: 'literal' must be a colour literal (got {literal!r})")
            ok = False
        systems = _as_tuple(raw.get("systems"), ("*",))
        if systems is None:
            errors.append(f"{where}: 'systems' must be a non-empty list of ids")
            ok = False
        regions = _as_tuple(raw.get("regions"), ("*",))
        if regions is None:
            errors.append(f"{where}: 'regions' must be a non-empty list of patterns")
            ok = False
        context = raw.get("context")
        pattern: re.Pattern[str] | None = None
        if context is not None:
            try:
                pattern = re.compile(context)
            except (re.error, TypeError) as exc:
                errors.append(f"{where}: 'context' is not a valid regex ({exc})")
                ok = False
        reason = raw.get("reason")
        if not isinstance(reason, str) or not reason.strip():
            errors.append(f"{where}: 'reason' is required and must be non-empty")
            ok = False
        if not ok:
            continue
        key = (value, systems, regions, context)
        if key in seen:
            errors.append(f"{where}: duplicates entries[{seen[key]}]")
            continue
        seen[key] = i
        entries.append(AllowEntry(i, literal.strip(), value, systems, regions, pattern,
                                  reason.strip()))
    if errors:
        raise AllowlistError(source, errors)
    return entries


def load_allowlist(path: Path) -> list[AllowEntry]:
    """Load and validate the allow-list file.

    Args:
        path: Path to the YAML file. A missing file is an empty list.

    Returns:
        Entries in file order.

    Raises:
        AllowlistError: If the file can't be parsed or validated.
    """
    if not path.exists():
        return []
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise AllowlistError(path, [f"YAML parse error: {exc}"]) from exc
    return parse_allowlist(data, path)


# ──────────────────────────────────────────────────────────────────────
# Check
# ──────────────────────────────────────────────────────────────────────

def _rel(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return path.as_posix()


def find_jsx_drift(
    pages: Iterable[ShowcasePage],
    entries: list[AllowEntry],
    root: Path,
    allowlist_file: str = ALLOWLIST_RELPATH.as_posix(),
) -> JsxDriftReport:
    """Scan pages against their token files and the allow-list.

    Args:
        pages: Pages to scan.
        entries: Allow-list entries (their ``hits`` are reset and counted).
        root: Repository root, for relative paths in the report.
        allowlist_file: Allow-list path shown in allow-list failures.

    Returns:
        The report; ``report.items`` is empty when the pages are clean.
    """
    report = JsxDriftReport()
    for e in entries:
        e.hits = 0
    scanned: set[str] = set()
    for page in pages:
        scanned.add(page.system)
        report.pages.append(page.system)
        loaded = load_token_file(page.tokens)
        if not loaded.ok:
            raise ValueError("; ".join(err.message for err in loaded.errors))
        by_color = token_values_by_color(loaded.data)
        rel = _rel(page.jsx, root)
        for e in entries:
            if e.applies_to(page.system) and e.value in by_color and not e.scoped:
                report.items.append(JsxDriftItem(
                    "allowlist_unscoped", page.system, allowlist_file, 0, e.literal,
                    tuple(by_color[e.value]),
                    f"{e.describe()} equals {', '.join(by_color[e.value])} of {page.token_system}; "
                    f"narrow it with 'regions' or 'context' so it cannot hide a token literal",
                ))
        for lit in scan_source(page.jsx.read_text(encoding="utf-8"), page.system, rel):
            report.literals += 1
            entry = next((e for e in entries if e.matches(lit)), None)
            if entry is not None and (entry.scoped or lit.value not in by_color):
                entry.hits += 1
                report.allowed += 1
                continue
            if lit.value in by_color:
                paths = tuple(by_color[lit.value])
                report.items.append(JsxDriftItem(
                    "token_literal", page.system, rel, lit.line, lit.text, paths,
                    f"{rel}:{lit.line}:{lit.column} [{lit.region}] {lit.text} equals "
                    f"{', '.join(paths)} — reference the token instead",
                ))
            else:
                report.items.append(JsxDriftItem(
                    "unlisted", page.system, rel, lit.line, lit.text, (),
                    f"{rel}:{lit.line}:{lit.column} [{lit.region}] {lit.text} is not a "
                    f"token value and no allow-list entry covers it",
                ))
    for e in entries:
        applies = "*" in e.systems or any(s in scanned for s in e.systems)
        if applies and e.hits == 0:
            report.items.append(JsxDriftItem(
                "allowlist_stale", "*", allowlist_file, 0, e.literal, (),
                f"{e.describe()} matched no literal — delete it ({e.reason})",
            ))
    return report


def check_jsx_drift(
    systems: Iterable[str] | None = None,
    root: Path | None = None,
    allowlist: Path | None = None,
) -> Result:
    """Check showcase pages for colour literals that bypass the token files.

    Args:
        systems: Showcase system ids to scan (default: every page).
            Allow-list entries for pages outside the scan are never stale.
        root: Repository root (defaults to ``repo_root()``).
        allowlist: Allow-list path (defaults to ``ALLOWLIST_RELPATH``).

    Returns:
        ``Result.success(report dict)`` when clean, otherwise a failure with
        one ``TOKEN_DRIFT`` error per problem (``EXCEPTIONS_INVALID`` when
        the allow-list is invalid).
    """
    root = root or repo_root()
    allow_path = allowlist or (root / ALLOWLIST_RELPATH)
    try:
        entries = load_allowlist(allow_path)
    except AllowlistError as exc:
        return Result.failure([Error("EXCEPTIONS_INVALID", m, {"file": str(exc.path)})
                               for m in exc.errors])
    pages = discover_pages(root)
    if systems is not None:
        wanted = set(systems)
        unknown = wanted - {p.system for p in pages}
        if unknown:
            return Result.failure(Error("SYSTEM_NOT_FOUND",
                                        f"no showcase page for {sorted(unknown)}"))
        pages = [p for p in pages if p.system in wanted]
    report = find_jsx_drift(pages, entries, root, _rel(allow_path, root))
    logger.info("jsx_drift_checked", pages=report.pages, literals=report.literals,
                allowed=report.allowed, failures=len(report.items))
    if report.items:
        return Result(ok=False, data=report.to_dict(), errors=[
            Error("TOKEN_DRIFT", item.message, asdict(item)) for item in report.items
        ])
    return Result.success(report.to_dict())
