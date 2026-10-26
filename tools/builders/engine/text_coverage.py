"""Text-colour coverage: every colour a template paints text in is a checked pair.

The contrast gate (``design_system_skill.contrast``, issue #7) only checks
the pairs a system declares: the contract pairs plus the token file's
``contrast_pairs``. A token used as a text fill that sits in no pair would
pass unchecked (Sketch's ``extras.color.accent_light`` annotation labels
were 1.9:1). This module derives, from the builder templates, every
``(text colour token, background token)`` combination actually rendered
and compares it with the declared pairs, so a new unchecked text colour
cannot appear.

What counts as a usage. Each ``<text>`` / ``<tspan>`` with character
content in a template body. Its colour is its own ``fill``, else its
``class`` (the system's ``TextClass`` fill), else the nearest ancestor's
``fill`` / ``class``. A text with a ``stroke`` also contributes a ``ui``
usage of the stroke token. Font size and weight inherit the same way
(defaults 16px / 400).

Class. WCAG 2.x large-scale text is at least 24px, or at least 18.66px
(14pt) at weight 700 or more: such a usage is ``large_text`` (3:1),
anything smaller is ``text`` (4.5:1).

Background heuristic. The background is the topmost shape painted
*before* the text, in document order, whose box contains the centre of
the text's estimated box (width ~0.55 em per character, shifted by
``text-anchor``; height ~0.7 em above the baseline). Shapes are ``rect``,
``circle``, ``ellipse``, ``polygon`` and ``path`` (an ``|rrect=`` path
uses its geometry, other paths the box of their coordinates); shapes
inside ``<defs>``, ``<clipPath>``, ``<mask>``, ``<pattern>`` or with
``fill="none"`` are skipped. Transforms are ignored: the templates only
use small ``rotate`` tilts. A shape whose fill is not a colour token
(``url(#gradient)``) and the absence of any shape both resolve to
``color.page_bg``: the envelope paints nothing behind components except
Prism's gradient strip, whose stops the gate checks as
``contrast_backdrops``.

Template alpha. A text fill written with ``|alpha=`` or drawn under an
``opacity`` below 1 is not the token's value, so no token pair can vouch
for it: such usages are accepted only when their pair is ``advisory`` or
``disabled`` (never failing, and so independent of alpha). A translucent
*background* is recorded by its token (the gate composites the token's
own alpha).

Required class. A usage needs a declared pair for its ``(fg, bg)`` whose
kind is at least as strict as the usage's class. Size alone sets the
class: no token is held to 3:1 when it renders below WCAG large size,
whatever its role (``color.text_muted`` timestamps at 8-12px need
4.5:1). The one role exception is an ``advisory`` contract foreground
(``color.text_placeholder``): placeholders are reported, never blocking,
on every background. ``advisory`` and ``disabled`` pairs cover any
usage; the gate requires them to carry a note.
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from typing import Any

from design_system_skill.contract import (
    CONTRAST_PAIRS,
    PAIR_ADVISORY,
    PAIR_DISABLED,
    PAIR_LARGE_TEXT,
    PAIR_TEXT,
    PAIR_UI,
)
from design_system_skill.contrast import declared_pairs, pair_label

from .plugin import builder_of, text_classes
from .templates import PLACEHOLDER_RE

PAGE_BG = "color.page_bg"
UNTOKENISED = "<no token fill>"
"""``TextUsage.fg`` of a text whose fill is missing (SVG default black) or not a token."""

LARGE_REGULAR_PX = 24.0
LARGE_BOLD_PX = 18.66
BOLD_WEIGHT = 700

#: Strictness of each pair kind for coverage (higher = stricter minimum).
KIND_RANK: dict[str, int] = {
    PAIR_ADVISORY: 0,
    PAIR_DISABLED: 0,
    PAIR_UI: 1,
    PAIR_LARGE_TEXT: 1,
    PAIR_TEXT: 2,
}
NEVER_FAILING = frozenset({PAIR_ADVISORY, PAIR_DISABLED})

_SKIP_CONTAINERS = {"defs", "clipPath", "mask", "pattern", "linearGradient",
                    "radialGradient", "filter", "style", "symbol", "marker"}
_SHAPES = {"rect", "circle", "ellipse", "polygon", "path"}
_NUM_RE = re.compile(r"-?\d*\.?\d+(?:[eE][-+]?\d+)?")
_WRAP_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">'


@dataclass(frozen=True)
class TextUsage:
    """One text (or text stroke) colour rendered by a template.

    Attributes:
        system: System id.
        kind: Builder kind (``library`` / ``patterns``).
        item: Component or layout id.
        fg: Foreground token path.
        bg: Background token path.
        klass: ``text`` / ``large_text`` (fills) or ``ui`` (text strokes).
        size: Font size in px.
        weight: Font weight.
        alpha_modified: The template changes the fill's alpha
            (``|alpha=`` or ``opacity`` < 1).
        bg_from_shape: The background came from an underlying shape
            (False: fell back to ``color.page_bg``).
        snippet: The text content (truncated), for messages.
    """

    system: str
    kind: str
    item: str
    fg: str
    bg: str
    klass: str
    size: float
    weight: int
    alpha_modified: bool
    bg_from_shape: bool
    snippet: str


@dataclass
class _Shape:
    box: tuple[float, float, float, float]
    token: str | None


@dataclass
class _Ctx:
    fill: str | None = None
    stroke: str | None = None
    size: float = 16.0
    weight: int = 400
    opacity: float = 1.0
    anchor: str = "start"
    x: float | None = None
    y: float | None = None


def _num(value: str | None, default: float | None = None) -> float | None:
    """First number in an attribute (``x="10 20"`` -> 10), or ``default``."""
    if value is None:
        return default
    m = _NUM_RE.search(value)
    return float(m.group()) if m else default


def _weight(value: str | None, default: int) -> int:
    if value is None:
        return default
    if value.strip() == "bold":
        return 700
    if value.strip() == "normal":
        return 400
    n = _num(value)
    return int(n) if n is not None else default


def _token_of(paint: str | None) -> tuple[str | None, bool]:
    """``(token path, has alpha filter)`` of a paint value, or ``(None, False)``."""
    if not paint:
        return None, False
    m = PLACEHOLDER_RE.fullmatch(paint.strip())
    if not m:
        return None, False
    return m["path"], m["filter"] == "alpha"


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _shape_box(tag: str, el: ET.Element) -> tuple[float, float, float, float] | None:
    """Axis-aligned box ``(x0, y0, x1, y1)`` of a shape, or None."""
    if tag == "rect":
        w, h = _num(el.get("width")), _num(el.get("height"))
        if w is None or h is None:
            return None
        x, y = _num(el.get("x"), 0.0), _num(el.get("y"), 0.0)
        return (x, y, x + w, y + h)
    if tag in ("circle", "ellipse"):
        cx, cy = _num(el.get("cx"), 0.0), _num(el.get("cy"), 0.0)
        rx = _num(el.get("r") if tag == "circle" else el.get("rx"), 0.0)
        ry = _num(el.get("r") if tag == "circle" else el.get("ry"), 0.0)
        return (cx - rx, cy - ry, cx + rx, cy + ry)
    data = el.get("points") if tag == "polygon" else el.get("d")
    if not data:
        return None
    m = PLACEHOLDER_RE.search(data)
    if m and m["filter"] == "rrect":
        x, y, w, h = (float(v) for v in m["arg"].split(",")[:4])
        return (x, y, x + w, y + h)
    if tag == "path" and re.search(r"[a-z]", re.sub(r"[eE][-+]?\d", "", data)):
        return None  # relative commands: no reliable box without a path parser
    nums = [float(v) for v in _NUM_RE.findall(data)]
    if len(nums) < 4:
        return None
    xs, ys = nums[0::2], nums[1::2]
    return (min(xs), min(ys), max(xs), max(ys))


def _classify(size: float, weight: int) -> str:
    """WCAG class of text at this size/weight."""
    if size >= LARGE_REGULAR_PX or (size >= LARGE_BOLD_PX and weight >= BOLD_WEIGHT):
        return PAIR_LARGE_TEXT
    return PAIR_TEXT


def scan_template(body: str, class_fills: Mapping[str, str], *, system: str = "",
                  kind: str = "", item: str = "") -> list[TextUsage]:
    """Derive the text-colour usages of one template body.

    Args:
        body: Template body (placeholders unresolved).
        class_fills: ``{css class: fill placeholder}`` from the system's
            text classes, e.g. ``{"text-primary": "{color.text_primary}"}``.
        system: System id (copied into each usage).
        kind: Builder kind (copied into each usage).
        item: Item id (copied into each usage).

    Returns:
        One usage per text element with content (plus one ``ui`` usage per
        stroked text), in document order.

    Raises:
        xml.etree.ElementTree.ParseError: If the body is not well-formed.
    """
    root = ET.fromstring(f"{_WRAP_OPEN}{body}</svg>")
    shapes: list[_Shape] = []
    usages: list[TextUsage] = []

    def class_fill(el: ET.Element) -> str | None:
        for name in (el.get("class") or "").split():
            if name in class_fills:
                return class_fills[name]
        return None

    def walk(el: ET.Element, ctx: _Ctx) -> None:
        tag = _local(el.tag)
        if tag in _SKIP_CONTAINERS:
            return
        own_fill = el.get("fill") or class_fill(el)
        here = _Ctx(
            fill=own_fill if own_fill is not None else ctx.fill,
            stroke=el.get("stroke", ctx.stroke),
            size=_num(el.get("font-size"), ctx.size),
            weight=_weight(el.get("font-weight"), ctx.weight),
            opacity=ctx.opacity * (_num(el.get("opacity"), 1.0) or 0.0),
            anchor=el.get("text-anchor", ctx.anchor),
            x=_num(el.get("x"), ctx.x),
            y=_num(el.get("y"), ctx.y),
        )
        if tag in _SHAPES and here.fill != "none":
            box = _shape_box(tag, el)
            if box is not None:
                token, _ = _token_of(el.get("fill") or here.fill)
                shapes.append(_Shape(box, token))
        if tag in ("text", "tspan"):
            content = (el.text or "").strip()
            if content:
                usages.extend(_text_usages(here, content, shapes, system, kind, item))
        for child in el:
            walk(child, here)

    for child in root:
        walk(child, _Ctx())
    return usages


def _text_usages(ctx: _Ctx, content: str, shapes: list[_Shape], system: str,
                 kind: str, item: str) -> list[TextUsage]:
    """Usages of one text element given the shapes painted before it."""
    fg, fg_alpha = _token_of(ctx.fill)
    stroke, _ = _token_of(ctx.stroke)
    if fg is None and ctx.fill != "none":
        # No fill (SVG paints black) or a non-token paint: not checkable.
        fg = UNTOKENISED
    width = len(content) * ctx.size * 0.55
    x, y = ctx.x or 0.0, ctx.y or 0.0
    cx = x + {"middle": 0.0, "end": -width / 2}.get(ctx.anchor, width / 2)
    cy = y - ctx.size * 0.35
    bg, from_shape = PAGE_BG, False
    for shape in reversed(shapes):
        x0, y0, x1, y1 = shape.box
        if x0 <= cx <= x1 and y0 <= cy <= y1:
            bg, from_shape = shape.token or PAGE_BG, shape.token is not None
            break
    common = dict(system=system, kind=kind, item=item, bg=bg, size=ctx.size,
                  weight=ctx.weight, bg_from_shape=from_shape, snippet=content[:40])
    out = []
    if fg is not None:
        out.append(TextUsage(fg=fg, klass=_classify(ctx.size, ctx.weight),
                             alpha_modified=fg_alpha or ctx.opacity < 1.0, **common))
    if stroke is not None:
        out.append(TextUsage(fg=stroke, klass=PAIR_UI, alpha_modified=ctx.opacity < 1.0,
                             **common))
    return out


def scan_builder(system_id: str, module: Any) -> list[TextUsage]:
    """Every text usage across a system's builder kinds.

    Args:
        system_id: System id.
        module: The system's plugin module (exposes ``BUILDER``).

    Returns:
        Usages in kind/item/document order.
    """
    usages: list[TextUsage] = []
    for kind, kd in builder_of(system_id, module).items():
        fills = {c.name: f"{{{c.fill}}}" for c in text_classes(kd["classes"])}
        for item_id, (_w, _h, body) in kd["items"].items():
            usages.extend(scan_template(body, fills, system=system_id, kind=kind, item=item_id))
    return usages


def contract_caps() -> dict[str, str]:
    """``{fg: advisory}`` for contract foregrounds the contract pairs as ``advisory``.

    Only the advisory role (placeholders) caps a requirement. A
    ``large_text`` contract pair never does: large-text minimums apply only
    to text that is actually large, so a small usage of any token is held
    to 4.5:1 (#7 follow-up: the old ``large_text`` cap let 8-12px
    ``text_muted`` timestamps pass at 3:1).
    """
    return {p.fg: PAIR_ADVISORY for p in CONTRAST_PAIRS if p.kind == PAIR_ADVISORY}


@dataclass
class CoverageReport:
    """Coverage of one system's text usages by its declared pairs.

    Attributes:
        system: System id.
        usages: Every usage found.
        combos: ``{pair label: required kind}`` over the usages.
        problems: One message per uncovered or under-classed combination.
        capped: Pair labels whose requirement the advisory contract role capped.
    """

    system: str
    usages: list[TextUsage] = field(default_factory=list)
    combos: dict[str, str] = field(default_factory=dict)
    problems: list[str] = field(default_factory=list)
    capped: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        """True when every rendered text colour is covered."""
        return not self.problems


def check_coverage(system_id: str, usages: Iterable[TextUsage],
                   tokens: Mapping[str, Any]) -> CoverageReport:
    """Compare rendered text colours with a token document's declared pairs.

    Args:
        system_id: System id (for messages).
        usages: Text usages from ``scan_builder``.
        tokens: The system's token document.

    Returns:
        A ``CoverageReport``; ``problems`` is empty when every usage has a
        declared pair at least as strict as its class (see module doc).
    """
    report = CoverageReport(system=system_id, usages=list(usages))
    declared = {pair_label(fg, bg): kind for fg, bg, kind, _ in declared_pairs(dict(tokens))}
    caps = contract_caps()
    grouped: dict[str, list[TextUsage]] = {}
    for u in report.usages:
        grouped.setdefault(pair_label(u.fg, u.bg), []).append(u)
    for label, group in grouped.items():
        fg = group[0].fg
        if fg == UNTOKENISED:
            report.problems.append(
                f"{system_id}: {len(group)} text(s) have no token fill (missing fill paints "
                f"SVG default black; e.g. {group[0].kind}/{group[0].item}: {group[0].snippet!r}); "
                f"give them a colour token")
            continue
        need = max((u.klass for u in group), key=lambda k: KIND_RANK[k])
        cap = caps.get(fg)
        if cap is not None and KIND_RANK[cap] < KIND_RANK[need]:
            need = cap
            report.capped.append(label)
        report.combos[label] = need
        have = declared.get(label)
        where = ", ".join(sorted({f"{u.kind}/{u.item}" for u in group})[:4])
        if have is None:
            report.problems.append(
                f"{system_id}: {label} is rendered as {need} ({len(group)}x, e.g. {where}: "
                f"{group[0].snippet!r}) but is in no contrast pair; add a contrast_pairs "
                f"entry (text / large_text / ui, or advisory / disabled with a note)")
            continue
        if have in NEVER_FAILING:
            continue
        altered = [u for u in group if u.alpha_modified]
        if altered:
            report.problems.append(
                f"{system_id}: {label}: {len(altered)} text(s) change the fill's alpha in the "
                f"template (|alpha= or opacity, e.g. {altered[0].kind}/{altered[0].item}: "
                f"{altered[0].snippet!r}), so the {have} pair does not check what is painted; "
                f"use a token value")
        if KIND_RANK[have] < KIND_RANK[need] or (need != PAIR_UI and have == PAIR_UI):
            report.problems.append(
                f"{system_id}: {label} is declared {have} but rendered as {need} "
                f"(e.g. {where}); declare it {need}")
    return report
