"""Computed colour gates: WCAG contrast (issue #7) and accent/danger hue (issue #8).

Two gates run over a system's token document (``systems/<id>/tokens.json``)
in **every mode combination** (``token_file.iter_mode_selections``) and
over every declared page backdrop:

1. **Contrast gate.** Every contract pair (``contract.CONTRAST_PAIRS``)
   plus the file's own ``contrast_pairs`` must reach the WCAG 2.x minimum
   for its kind: ``text`` 4.5:1 (SC 1.4.3), ``large_text`` 3:1 (SC 1.4.3
   large-scale), ``ui`` 3:1 (SC 1.4.11 non-text contrast). ``advisory``
   and ``disabled`` pairs are computed and reported but never fail. A
   file pair of either kind needs a ``note`` (the reason), and a
   ``disabled`` pair must name a disabled-role token (a path whose last
   segment contains ``disabled``) on one side: SC 1.4.3 exempts inactive
   UI components, not arbitrary low-contrast text (``EXEMPT_KINDS``).
2. **Hue gate.** ``color.accent`` and ``color.action`` must sit at least
   ``HUE_GAP_MIN`` degrees of OKLCH hue away from ``color.danger`` whenever
   both colours carry hue (OKLCH chroma >= ``HUE_CHROMA_FLOOR``; greys have
   no hue and are exempt). ADR-0002 records the decision.

Alpha compositing. A translucent colour is drawn over what is beneath it,
so ratios are computed on composited, opaque colours:

- the backdrop is ``color.page_bg`` (must be opaque), or each colour
  listed in the token file's ``contrast_backdrops`` (token paths of opaque
  colours that stand in for ``color.page_bg``, e.g. Prism's gradient
  stops); every pair is evaluated over every backdrop;
- a translucent pair background composites over the backdrop
  (source-over in gamma-encoded sRGB, as browsers paint);
- the foreground composites over the composited background.

Waivers. A failing pair may be waived only when it is decorative or
otherwise not needed to perceive content (``ui`` pairs; text must be fixed,
never waived). Waivers live in the token file::

    "contrast_waivers": [
      {"pair": "color.accent on color.surface",
       "modes": [{"ink": "sunset"}],          # optional partial selections
       "reason": "why this pair is decorative here"}
    ]
    "hue_waivers": [
      {"pair": "color.accent vs color.danger", "reason": "..."}
    ]

A reason is required, and a waiver (or one of its ``modes`` patterns) that
matches no failing result is **stale** and fails the gate, the same
discipline as ``rulebook-exceptions.yaml``.

Fixes. ``suggest_lightness_fix`` finds the smallest OKLCH lightness change
that makes a colour pass against a fixed partner while keeping its hue and
chroma (chroma is reduced only as far as needed to stay inside the sRGB
gamut). It is the documented way token values are corrected.

Input boundaries. A system whose inputs are identified by something other
than their stroke re-expresses ``color.border_input on color.surface`` with
a ``contrast_pairs`` entry carrying ``replaces`` (see ``REPLACEABLE_PAIRS``).

The gate functions are pure (callers pass parsed token documents);
``check_color_gates_for_spec`` / ``check_color_gates_all`` read the files
for the CLI and the MCP server.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Callable, Iterable

import structlog
import yaml

from .contract import (
    CONTRAST_PAIRS,
    PAIR_ADVISORY,
    PAIR_DISABLED,
    PAIR_LARGE_TEXT,
    PAIR_TEXT,
    PAIR_UI,
    parse_color,
)
from .errors import Error, Result
from .token_file import (
    get_token,
    iter_mode_selections,
    load_token_file,
    resolve_mode,
    token_file_path,
    validate_token_document,
)

logger = structlog.get_logger(__name__)


# ─── Thresholds ─────────────────────────────────────────────────────

CONTRAST_MINIMUMS: dict[str, float | None] = {
    PAIR_TEXT: 4.5,
    PAIR_LARGE_TEXT: 3.0,
    PAIR_UI: 3.0,
    PAIR_ADVISORY: None,
    PAIR_DISABLED: None,
}
"""WCAG 2.x minimum ratio per pair kind; ``None`` = reported, never fails."""

WAIVABLE_KINDS = frozenset({PAIR_UI})
"""Pair kinds a contrast waiver may cover (decorative non-text marks only)."""

HUE_GAP_MIN = 40.0
"""Minimum OKLCH hue distance (degrees) between accent/action and danger."""

HUE_CHROMA_FLOOR = 0.04
"""OKLCH chroma below which a colour is treated as grey (no hue)."""

HUE_GATE_TOKENS: tuple[str, ...] = ("color.accent", "color.action")
"""Colours that must not be mistakable for danger by hue alone."""

HUE_GATE_REFERENCE = "color.danger"

PAGE_BG = "color.page_bg"

RGB = tuple[float, float, float]


# ─── sRGB / luminance / compositing ─────────────────────────────────

def _to_linear(channel: float) -> float:
    """Decode one gamma-encoded sRGB channel in 0-1 to linear light."""
    if channel <= 0.04045:
        return channel / 12.92
    return ((channel + 0.055) / 1.055) ** 2.4


def _to_gamma(channel: float) -> float:
    """Encode one linear-light channel in 0-1 to gamma-encoded sRGB."""
    if channel <= 0.0031308:
        return channel * 12.92
    return 1.055 * channel ** (1 / 2.4) - 0.055


def relative_luminance(rgb: RGB) -> float:
    """WCAG 2.x relative luminance of an opaque sRGB colour.

    Uses the sRGB transfer function (threshold 0.04045; WCAG's printed
    0.03928 differs only below 1/255 and changes no 8-bit result).

    Args:
        rgb: Channels 0-255.

    Returns:
        Luminance in 0-1.
    """
    r, g, b = (_to_linear(c / 255) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(fg: RGB, bg: RGB) -> float:
    """WCAG contrast ratio ``(L1 + 0.05) / (L2 + 0.05)`` of two opaque colours.

    Args:
        fg: Opaque foreground, channels 0-255.
        bg: Opaque background, channels 0-255.

    Returns:
        Ratio in 1-21 (order-independent).
    """
    l1, l2 = sorted((relative_luminance(fg), relative_luminance(bg)), reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)


def composite(color: tuple[float, float, float, float], under: RGB) -> RGB:
    """Paint a possibly translucent colour over an opaque one (source-over).

    Browsers blend in gamma-encoded sRGB, so this does too.

    Args:
        color: ``(r, g, b, a)`` with channels 0-255 and alpha 0-1.
        under: Opaque colour beneath, channels 0-255.

    Returns:
        The opaque result, channels 0-255 (unrounded).
    """
    r, g, b, a = color
    return (r * a + under[0] * (1 - a), g * a + under[1] * (1 - a), b * a + under[2] * (1 - a))


def to_hex(rgb: RGB) -> str:
    """Round an opaque colour to ``#RRGGBB``."""
    return "#" + "".join(f"{max(0, min(255, round(c))):02X}" for c in rgb)


# ─── OKLCH ──────────────────────────────────────────────────────────

def rgb_to_oklch(rgb: RGB) -> tuple[float, float, float]:
    """Convert sRGB (0-255) to OKLCH (Ottosson 2020).

    Args:
        rgb: Channels 0-255.

    Returns:
        ``(L, C, h)``: lightness 0-1, chroma >= 0, hue in degrees 0-360.
    """
    r, g, b = (_to_linear(c / 255) for c in rgb)
    l_ = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m_ = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s_ = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = (math.copysign(abs(v) ** (1 / 3), v) for v in (l_, m_, s_))
    lab_l = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    lab_a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    lab_b = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    chroma = math.hypot(lab_a, lab_b)
    hue = math.degrees(math.atan2(lab_b, lab_a)) % 360
    return lab_l, chroma, hue


def oklch_to_linear(lightness: float, chroma: float, hue: float) -> RGB:
    """Convert OKLCH to *linear* sRGB in 0-1 (may fall outside the gamut)."""
    a = chroma * math.cos(math.radians(hue))
    b = chroma * math.sin(math.radians(hue))
    l_ = lightness + 0.3963377774 * a + 0.2158037573 * b
    m_ = lightness - 0.1055613458 * a - 0.0638541728 * b
    s_ = lightness - 0.0894841775 * a - 1.2914855480 * b
    l3, m3, s3 = l_ ** 3, m_ ** 3, s_ ** 3
    return (
        4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
        -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
        -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3,
    )


def in_srgb_gamut(lightness: float, chroma: float, hue: float, eps: float = 1e-6) -> bool:
    """Return True when an OKLCH colour is displayable in sRGB."""
    return all(-eps <= c <= 1 + eps for c in oklch_to_linear(lightness, chroma, hue))


def oklch_to_rgb(lightness: float, chroma: float, hue: float) -> tuple[RGB, float]:
    """Convert OKLCH to sRGB, reducing chroma until the colour is in gamut.

    Lightness and hue are kept; chroma is bisected down to the gamut
    boundary when the requested colour is not displayable (CSS Color 4
    style chroma reduction, without the JND shortcut).

    Args:
        lightness: OKLCH L, clamped to 0-1.
        chroma: Requested OKLCH C.
        hue: OKLCH h in degrees.

    Returns:
        ``(rgb, chroma_used)`` with channels 0-255 (unrounded).
    """
    lightness = min(1.0, max(0.0, lightness))
    if not in_srgb_gamut(lightness, chroma, hue):
        lo, hi = 0.0, chroma
        for _ in range(40):
            mid = (lo + hi) / 2
            if in_srgb_gamut(lightness, mid, hue):
                lo = mid
            else:
                hi = mid
        chroma = lo
    lin = oklch_to_linear(lightness, chroma, hue)
    rgb = tuple(255 * _to_gamma(min(1.0, max(0.0, c))) for c in lin)
    return rgb, chroma  # type: ignore[return-value]


def hue_distance(h1: float, h2: float) -> float:
    """Shortest angular distance between two hues, in degrees (0-180)."""
    d = abs(h1 - h2) % 360
    return 360 - d if d > 180 else d


# ─── Fix suggestion ─────────────────────────────────────────────────

@dataclass(frozen=True)
class LightnessFix:
    """Smallest OKLCH lightness change that makes a colour pass.

    Attributes:
        old: The original value.
        new: The suggested value (``#RRGGBB``, or ``#RRGGBBAA`` /
            ``rgba()`` spelling when the original was translucent).
        delta_l: Signed OKLCH lightness change.
        ratio_before: Worst ratio across partners before the change.
        ratio_after: Worst ratio across partners after the change.
        delta_alpha: Opacity increase, for a translucent colour whose
            lightness is already at the end of the range (e.g. white
            glass text); 0 when only lightness moved.
    """

    old: str
    new: str
    delta_l: float
    ratio_before: float
    ratio_after: float
    delta_alpha: float = 0.0


def _spell_like(old: str, rgb: RGB, alpha: float) -> str:
    """Spell a colour in the same notation family as ``old``."""
    hexv = to_hex(rgb)
    if alpha >= 1.0:
        return hexv
    r, g, b = (max(0, min(255, round(c))) for c in rgb)
    return f"rgba({r},{g},{b},{round(alpha, 3):g})"


def suggest_lightness_fix(
    value: str,
    partners: Iterable[tuple[str, str]],
    minimum: float,
    move: str = "fg",
    step: float = 0.0005,
) -> LightnessFix | None:
    """Find the smallest OKLCH lightness change to ``value`` that passes.

    Hue and chroma are kept (chroma is reduced only where the new
    lightness cannot hold it in sRGB). Both directions are searched and
    the smaller change wins; the rounded 8-bit result is re-checked.
    Alpha is kept, so a translucent colour's *colour* moves, not its
    opacity — unless no lightness passes (translucent white text is
    already at L = 1), in which case opacity is raised in 0.01 steps.

    Args:
        value: The colour to change (any ``parse_color`` spelling).
        partners: ``(partner_value, backdrop_value)`` pairs the colour must
            pass against in every mode / backdrop. ``partner_value`` is the
            other side of the pair; ``backdrop_value`` the opaque page
            colour beneath both.
        minimum: Required ratio.
        move: ``"fg"`` when ``value`` is the foreground (it composites
            over the partner), ``"bg"`` when it is the background (the
            partner composites over it).
        step: Lightness search step.

    Returns:
        The fix, or ``None`` when no lightness in 0-1 passes.
    """
    parsed = parse_color(value)
    if parsed is None:
        raise ValueError(f"not a colour: {value!r}")
    alpha = parsed[3]
    partner_list = [(parse_color(p), parse_color(bd)) for p, bd in partners]

    def worst(rgb: RGB) -> float:
        return _worst_with_alpha(partner_list, rgb, alpha, move)

    base_rgb = parsed[:3]
    before = worst(base_rgb)
    lightness, chroma, hue = rgb_to_oklch(base_rgb)
    best: tuple[float, RGB] | None = None
    for direction in (1, -1):
        delta = 0.0
        while True:
            delta += step
            target = lightness + direction * delta
            if target < 0 or target > 1:
                break
            rgb, _ = oklch_to_rgb(target, chroma, hue)
            rounded = tuple(float(round(c)) for c in rgb)
            if worst(rounded) >= minimum:
                if best is None or delta < abs(best[0]):
                    best = (direction * delta, rounded)
                break
    if best is None:
        if alpha >= 1.0:
            return None
        new_alpha = alpha
        while new_alpha < 1.0:
            new_alpha = min(1.0, round(new_alpha + 0.01, 2))
            ratio = _worst_with_alpha(partner_list, base_rgb, new_alpha, move)
            if ratio >= minimum:
                return LightnessFix(value, _spell_like(value, base_rgb, new_alpha), 0.0,
                                    round(before, 2), round(ratio, 2),
                                    round(new_alpha - alpha, 2))
        return None
    new = _spell_like(value, best[1], alpha)
    return LightnessFix(value, new, round(best[0], 4), round(before, 2), round(worst(best[1]), 2))


def _worst_with_alpha(partner_list: list[Any], rgb: RGB, alpha: float, move: str) -> float:
    """Worst ratio of ``rgb`` at ``alpha`` against every partner/backdrop."""
    ratios = []
    for partner, backdrop in partner_list:
        under = backdrop[:3]
        if move == "fg":
            bg = composite(partner, under)
            fg = composite((*rgb, alpha), bg)
        else:
            bg = composite((*rgb, alpha), under)
            fg = composite(partner, bg)
        ratios.append(contrast_ratio(fg, bg))
    return min(ratios)


# ─── Results ────────────────────────────────────────────────────────

@dataclass
class PairResult:
    """One contrast pair evaluated in one mode over one backdrop.

    Attributes:
        pair: ``"<fg> on <bg>"``.
        fg: Foreground token path.
        bg: Background token path.
        kind: Pair kind.
        fg_value: Foreground value as written in the (resolved) file.
        bg_value: Background value as written.
        ratio: Contrast ratio, rounded to 2 decimals (pass/fail uses the
            unrounded value: 4.499 fails 4.5).
        minimum: Required ratio, or ``None`` for advisory pairs.
        passes: Meets the minimum (always True for advisory pairs).
        mode: Mode selection (``{}`` for single-mode systems).
        backdrop: Token path of the page backdrop used.
        waived: A waiver covers this failure.
        waiver_reason: The waiver's reason, when waived.
        note: The pair's note from ``contrast_pairs``, if any.
    """

    pair: str
    fg: str
    bg: str
    kind: str
    fg_value: str
    bg_value: str
    ratio: float
    minimum: float | None
    passes: bool
    mode: dict[str, str]
    backdrop: str
    waived: bool = False
    waiver_reason: str | None = None
    note: str | None = None


@dataclass
class HueResult:
    """The hue gate for one token in one mode.

    Attributes:
        pair: ``"<token> vs color.danger"``.
        token: ``color.accent`` or ``color.action``.
        value: The token's value.
        danger_value: ``color.danger``'s value.
        hue: OKLCH hue of the token (composited over the page), degrees.
        danger_hue: OKLCH hue of danger, degrees.
        chroma: OKLCH chroma of the token.
        danger_chroma: OKLCH chroma of danger.
        gap: Hue distance in degrees (``None`` when exempt).
        exempt: One side is grey (chroma below the floor).
        passes: Exempt, or gap >= ``HUE_GAP_MIN``.
        mode: Mode selection.
        waived: A waiver covers this failure.
        waiver_reason: The waiver's reason, when waived.
    """

    pair: str
    token: str
    value: str
    danger_value: str
    hue: float
    danger_hue: float
    chroma: float
    danger_chroma: float
    gap: float | None
    exempt: bool
    passes: bool
    mode: dict[str, str]
    waived: bool = False
    waiver_reason: str | None = None


@dataclass
class GateReport:
    """Outcome of one gate over a token document.

    Attributes:
        system: Token file ``system`` id.
        gate: ``"contrast"`` or ``"hue"``.
        results: Every evaluated result (dicts of ``PairResult`` /
            ``HueResult``).
        errors: Blocking errors (failures, stale or invalid waivers).
        modes: Number of mode combinations evaluated.
        backdrops: Backdrop token paths evaluated.
    """

    system: str
    gate: str
    results: list[dict[str, Any]] = field(default_factory=list)
    errors: list[Error] = field(default_factory=list)
    modes: int = 0
    backdrops: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        """True when the gate raised no errors."""
        return not self.errors

    def summary(self) -> dict[str, Any]:
        """Serialisable view: counts, worst results per pair, errors."""
        failing = [r for r in self.results if not r["passes"] and not r["waived"]]
        waived = [r for r in self.results if not r["passes"] and r["waived"]]
        return {
            "system": self.system,
            "gate": self.gate,
            "ok": self.ok,
            "modes": self.modes,
            "backdrops": self.backdrops,
            "checked": len(self.results),
            "failed": len(failing),
            "waived": len(waived),
            "worst": _worst_per_pair(self.results, self.gate),
            "errors": [{"code": e.code, "message": e.message, "detail": e.detail}
                       for e in self.errors],
        }


def _worst_per_pair(results: list[dict[str, Any]], gate: str) -> list[dict[str, Any]]:
    """Return the worst result of each pair (lowest ratio / smallest gap)."""
    worst: dict[str, dict[str, Any]] = {}
    for r in results:
        key = r["pair"]
        score = r["ratio"] if gate == "contrast" else (r["gap"] if r["gap"] is not None else 999)
        prev = worst.get(key)
        prev_score = None if prev is None else (
            prev["ratio"] if gate == "contrast" else (prev["gap"] if prev["gap"] is not None else 999))
        if prev is None or score < prev_score:
            worst[key] = r
    return list(worst.values())


def mode_label(mode: dict[str, str]) -> str:
    """Human label for a mode selection: ``paper=kraft,ink=sunset`` or ``default``."""
    return ",".join(f"{k}={v}" for k, v in mode.items()) or "default"


# ─── Waivers ────────────────────────────────────────────────────────

@dataclass
class _Waiver:
    index: int
    pair: str
    modes: list[dict[str, str]] | None
    reason: str
    matched_patterns: set[int] = field(default_factory=set)
    matched: bool = False


def _parse_waivers(
    doc: dict[str, Any], key: str, known_pairs: dict[str, str] | set[str], code: str,
) -> tuple[list[_Waiver], list[Error]]:
    """Validate and parse a waiver list (``contrast_waivers`` / ``hue_waivers``).

    Args:
        doc: Token document.
        key: Top-level key holding the list.
        known_pairs: Pair labels a waiver may name (mapping to their kind
            for contrast waivers).
        code: Error code for malformed waivers.

    Returns:
        ``(waivers, errors)``.
    """
    raw = doc.get(key)
    if raw is None:
        return [], []
    errors: list[Error] = []
    system = doc.get("system")
    if not isinstance(raw, list):
        return [], [Error(code, f"tokens: '{key}' must be a list", {"system_id": system})]
    axes = {a.get("id"): set((a.get("options") or {}).keys())
            for a in (doc.get("modes") or {}).get("axes") or [] if isinstance(a, dict)}
    out: list[_Waiver] = []
    for i, w in enumerate(raw):
        where = f"{key}[{i}]"
        if not isinstance(w, dict):
            errors.append(Error(code, f"tokens: {where} must be an object", {"system_id": system}))
            continue
        unknown = sorted(set(w) - {"pair", "modes", "reason"})
        if unknown:
            errors.append(Error(code, f"tokens: {where} has unknown keys {unknown}",
                                {"system_id": system}))
        pair = w.get("pair")
        reason = w.get("reason")
        if not isinstance(reason, str) or not reason.strip():
            errors.append(Error(code, f"tokens: {where} ({pair!r}) needs a non-empty 'reason'",
                                {"system_id": system, "pair": pair}))
            continue
        if pair not in known_pairs:
            errors.append(Error(code, f"tokens: {where} names unknown pair {pair!r}; "
                                      f"known pairs: {sorted(known_pairs)}",
                                {"system_id": system, "pair": pair}))
            continue
        if isinstance(known_pairs, dict) and known_pairs[pair] not in WAIVABLE_KINDS:
            errors.append(Error(code, f"tokens: {where} waives {pair!r}, a "
                                      f"'{known_pairs[pair]}' pair; only {sorted(WAIVABLE_KINDS)} "
                                      f"pairs may be waived (text must be fixed, not waived)",
                                {"system_id": system, "pair": pair}))
            continue
        modes = w.get("modes")
        if modes is not None:
            bad = not isinstance(modes, list) or not modes or not all(
                isinstance(m, dict) and m and all(
                    k in axes and v in axes[k] for k, v in m.items()) for m in modes)
            if bad:
                errors.append(Error(code, f"tokens: {where}.modes must be a non-empty list of "
                                          f"partial mode selections naming known axes/options "
                                          f"({ {k: sorted(v) for k, v in axes.items()} })",
                                    {"system_id": system, "pair": pair}))
                continue
        out.append(_Waiver(i, pair, modes, reason.strip()))
    return out, errors


def _apply_waivers(results: list[Any], waivers: list[_Waiver]) -> None:
    """Mark failing results covered by a waiver; record which waivers matched."""
    for r in results:
        if r.passes:
            continue
        for w in waivers:
            if w.pair != r.pair:
                continue
            if w.modes is None:
                w.matched = True
                r.waived, r.waiver_reason = True, w.reason
                break
            hits = [j for j, pat in enumerate(w.modes)
                    if all(r.mode.get(k) == v for k, v in pat.items())]
            if hits:
                w.matched = True
                w.matched_patterns.update(hits)
                r.waived, r.waiver_reason = True, w.reason
                break


def _stale_errors(waivers: list[_Waiver], key: str, code: str, system: Any) -> list[Error]:
    errors = []
    for w in waivers:
        if not w.matched:
            errors.append(Error(code, f"tokens: {key}[{w.index}] waives {w.pair!r} but that pair "
                                      f"no longer fails; delete the stale waiver",
                                {"system_id": system, "pair": w.pair, "stale": True}))
        elif w.modes is not None:
            for j, pat in enumerate(w.modes):
                if j not in w.matched_patterns:
                    errors.append(Error(code, f"tokens: {key}[{w.index}] mode pattern {pat} for "
                                              f"{w.pair!r} matches no failing mode; delete it",
                                        {"system_id": system, "pair": w.pair, "stale": True}))
    return errors


# ─── Contrast gate ──────────────────────────────────────────────────

REPLACEABLE_PAIRS = frozenset({"color.border_input on color.surface"})
"""Contract pairs a system may re-express with ``contrast_pairs[].replaces``.

WCAG 1.4.11 asks for 3:1 on the visual information *needed to identify* a
control. A system whose inputs are identified by something other than
their stroke (Terminal's ``$`` prompt glyph, a filled field that itself
meets 3:1 against the page) declares that identifying pair instead, with
a note saying why; it is checked in place of the stroke pair.
"""


def declared_pairs(doc: dict[str, Any]) -> list[tuple[str, str, str, str | None]]:
    """Return ``(fg, bg, kind, note)`` for contract pairs plus the file's own.

    A file pair carrying ``replaces`` (see ``REPLACEABLE_PAIRS``) takes the
    named contract pair's place.
    """
    own = [p for p in doc.get("contrast_pairs") or [] if isinstance(p, dict)]
    replaced = {p["replaces"] for p in own if p.get("replaces") in REPLACEABLE_PAIRS}
    candidates: list[tuple[str, str, str, str | None]] = [
        (p.fg, p.bg, p.kind, None) for p in CONTRAST_PAIRS
        if pair_label(p.fg, p.bg) not in replaced]
    candidates += [(p.get("fg"), p.get("bg"), p.get("kind"), p.get("note")) for p in own]
    # One entry per fg/bg: a file pair that repeats a contract pair with a
    # stricter kind (Prism's teal numerals: accent on surface as text, not
    # ui) supersedes it.
    pairs: dict[str, tuple[str, str, str, str | None]] = {}
    for cand in candidates:
        label = pair_label(cand[0], cand[1])
        prev = pairs.get(label)
        if prev is None or (CONTRAST_MINIMUMS.get(cand[2]) or 0) > (CONTRAST_MINIMUMS.get(prev[2]) or 0):
            pairs[label] = cand
    return list(pairs.values())


EXEMPT_KINDS = frozenset({PAIR_ADVISORY, PAIR_DISABLED})
"""Kinds that never fail; a token-file pair of these kinds needs a ``note``."""


def is_disabled_role(path: str) -> bool:
    """True when a token path names a disabled-state role (``extras.color.disabled_fill``)."""
    return "disabled" in path.rsplit(".", 1)[-1]


def _validate_exempt_pairs(doc: dict[str, Any]) -> list[Error]:
    """Check ``advisory`` / ``disabled`` file pairs: a note, and a disabled-role token.

    An exempt pair silences the gate for its colours, so it must say why;
    ``disabled`` is reserved for inactive components (WCAG 1.4.3's
    exception), which the token naming makes explicit.
    """
    errors = []
    system = doc.get("system")
    for i, p in enumerate(doc.get("contrast_pairs") or []):
        if not isinstance(p, dict) or p.get("kind") not in EXEMPT_KINDS:
            continue
        where = f"contrast_pairs[{i}] ({p.get('fg')} on {p.get('bg')})"
        if not isinstance(p.get("note"), str) or not p["note"].strip():
            errors.append(Error("CONTRAST_INVALID",
                                f"tokens: {where} is '{p['kind']}' and needs a 'note' saying why "
                                f"it may stay below the WCAG minimum",
                                {"system_id": system}))
        if p["kind"] == PAIR_DISABLED and not any(
                isinstance(p.get(side), str) and is_disabled_role(p[side]) for side in ("fg", "bg")):
            errors.append(Error("CONTRAST_INVALID",
                                f"tokens: {where} is 'disabled' but neither side is a disabled-role "
                                f"token (a path ending in '*disabled*'); only inactive components "
                                f"are exempt (WCAG 1.4.3)",
                                {"system_id": system}))
    return errors


def _validate_replacements(doc: dict[str, Any]) -> list[Error]:
    """Check ``contrast_pairs[].replaces``: replaceable target, note, non-advisory kind."""
    errors = []
    system = doc.get("system")
    seen: set[str] = set()
    for i, p in enumerate(doc.get("contrast_pairs") or []):
        if not isinstance(p, dict) or "replaces" not in p:
            continue
        target = p["replaces"]
        where = f"contrast_pairs[{i}]"
        if target not in REPLACEABLE_PAIRS:
            errors.append(Error("CONTRAST_INVALID",
                                f"tokens: {where}.replaces {target!r} is not replaceable; "
                                f"replaceable pairs: {sorted(REPLACEABLE_PAIRS)}",
                                {"system_id": system}))
        elif target in seen:
            errors.append(Error("CONTRAST_INVALID",
                                f"tokens: {where} replaces {target!r} a second time",
                                {"system_id": system}))
        seen.add(target)
        if not isinstance(p.get("note"), str) or not p["note"].strip():
            errors.append(Error("CONTRAST_INVALID",
                                f"tokens: {where} replaces {target!r} and needs a 'note' saying "
                                f"how the control is identified instead",
                                {"system_id": system}))
        if p.get("kind") == PAIR_ADVISORY:
            errors.append(Error("CONTRAST_INVALID",
                                f"tokens: {where} replaces {target!r} with an advisory pair; the "
                                f"identifying pair must be ui, large_text or text",
                                {"system_id": system}))
    return errors


def pair_label(fg: str, bg: str) -> str:
    """Canonical contrast pair label used in reports and waivers."""
    return f"{fg} on {bg}"


def backdrop_paths(doc: dict[str, Any]) -> list[str]:
    """Return the page backdrops to evaluate: ``color.page_bg`` plus ``contrast_backdrops``."""
    extra = doc.get("contrast_backdrops") or []
    return [PAGE_BG] + [p for p in extra if isinstance(p, str) and p != PAGE_BG]


def _validate_backdrops(doc: dict[str, Any]) -> list[Error]:
    errors = []
    raw = doc.get("contrast_backdrops")
    if raw is not None and not (isinstance(raw, list) and all(isinstance(p, str) for p in raw)):
        errors.append(Error("CONTRAST_INVALID",
                            "tokens: 'contrast_backdrops' must be a list of colour token paths",
                            {"system_id": doc.get("system")}))
    return errors


def check_contrast(doc: dict[str, Any]) -> GateReport:
    """Run the WCAG contrast gate over every mode combination and backdrop.

    Args:
        doc: A token document that already passed contract validation
            (every contract colour present and parseable).

    Returns:
        A ``GateReport``. Errors: ``CONTRAST_FAIL`` for each failing pair
        (one error per pair, naming the worst mode) and for each stale
        waiver; ``CONTRAST_INVALID`` for malformed waivers or
        backdrops.
    """
    system = doc.get("system")
    pairs = declared_pairs(doc)
    kinds = {pair_label(fg, bg): kind for fg, bg, kind, _ in pairs}
    report = GateReport(system=str(system), gate="contrast", backdrops=backdrop_paths(doc))
    report.errors.extend(_validate_backdrops(doc))
    report.errors.extend(_validate_replacements(doc))
    report.errors.extend(_validate_exempt_pairs(doc))
    waivers, werrs = _parse_waivers(doc, "contrast_waivers", kinds, "CONTRAST_INVALID")
    report.errors.extend(werrs)

    results: list[PairResult] = []
    for selection in iter_mode_selections(doc):
        report.modes += 1
        resolved = resolve_mode(doc, selection)
        for backdrop_path in report.backdrops:
            backdrop = parse_color(get_token(resolved, backdrop_path, None))
            if backdrop is None or backdrop[3] < 1.0:
                report.errors.append(Error(
                    "CONTRAST_INVALID",
                    f"tokens: backdrop {backdrop_path} must be an opaque colour "
                    f"(mode {mode_label(selection)})",
                    {"system_id": system, "backdrop": backdrop_path}))
                continue
            under = backdrop[:3]
            for fg_path, bg_path, kind, note in pairs:
                fg_val = backdrop_path_value(resolved, fg_path, backdrop_path)
                bg_val = backdrop_path_value(resolved, bg_path, backdrop_path)
                fg_c, bg_c = parse_color(fg_val), parse_color(bg_val)
                if fg_c is None or bg_c is None:
                    continue  # contract validation reports unparseable values
                bg_rgb = composite(bg_c, under)
                fg_rgb = composite(fg_c, bg_rgb)
                ratio = contrast_ratio(fg_rgb, bg_rgb)
                minimum = CONTRAST_MINIMUMS.get(kind)
                results.append(PairResult(
                    pair=pair_label(fg_path, bg_path), fg=fg_path, bg=bg_path, kind=kind,
                    fg_value=fg_val, bg_value=bg_val, ratio=round(ratio, 2), minimum=minimum,
                    passes=minimum is None or ratio >= minimum, mode=dict(selection),
                    backdrop=backdrop_path, note=note,
                ))

    _apply_waivers(results, waivers)
    report.errors.extend(_stale_errors(waivers, "contrast_waivers", "CONTRAST_FAIL", system))
    failing: dict[str, list[PairResult]] = {}
    for r in results:
        if not r.passes and not r.waived:
            failing.setdefault(r.pair, []).append(r)
    for label, rs in failing.items():
        worst = min(rs, key=lambda r: r.ratio)
        report.errors.append(Error(
            "CONTRAST_FAIL",
            f"[{system}] {label} ({worst.kind}) is {worst.ratio}:1, needs {worst.minimum}:1 "
            f"(worst in mode {mode_label(worst.mode)} over {worst.backdrop}; fails in "
            f"{len(rs)} mode/backdrop combination(s))",
            {"system_id": system, "pair": label, "kind": worst.kind, "ratio": worst.ratio,
             "minimum": worst.minimum, "mode": worst.mode, "backdrop": worst.backdrop,
             "failures": len(rs)},
        ))
    report.results = [asdict(r) for r in results]
    return report


def backdrop_path_value(resolved: dict[str, Any], path: str, backdrop_path: str) -> Any:
    """Read a pair side; ``color.page_bg`` reads as the current backdrop."""
    if path == PAGE_BG:
        return get_token(resolved, backdrop_path, None)
    return get_token(resolved, path, None)


# ─── Hue gate ───────────────────────────────────────────────────────

def hue_pair_label(token: str) -> str:
    """Canonical hue-gate pair label used in reports and waivers."""
    return f"{token} vs {HUE_GATE_REFERENCE}"


def check_hue_gate(doc: dict[str, Any]) -> GateReport:
    """Run the accent/action-vs-danger hue gate over every mode combination.

    Colours are composited over ``color.page_bg`` before conversion, so a
    translucent action reads as the colour it actually shows.

    Args:
        doc: A contract-valid token document.

    Returns:
        A ``GateReport``. Errors: ``HUE_GATE_FAIL`` for each failing token
        (worst mode named) and each stale waiver; ``HUE_GATE_INVALID``
        for malformed waivers.
    """
    system = doc.get("system")
    report = GateReport(system=str(system), gate="hue", backdrops=[PAGE_BG])
    known = {hue_pair_label(t) for t in HUE_GATE_TOKENS}
    waivers, werrs = _parse_waivers(doc, "hue_waivers", known, "HUE_GATE_INVALID")
    report.errors.extend(werrs)

    results: list[HueResult] = []
    for selection in iter_mode_selections(doc):
        report.modes += 1
        resolved = resolve_mode(doc, selection)
        page = parse_color(get_token(resolved, PAGE_BG, None))
        danger_val = get_token(resolved, HUE_GATE_REFERENCE, None)
        danger = parse_color(danger_val)
        if page is None or danger is None:
            continue
        _, d_chroma, d_hue = rgb_to_oklch(composite(danger, page[:3]))
        for token in HUE_GATE_TOKENS:
            val = get_token(resolved, token, None)
            c = parse_color(val)
            if c is None:
                continue
            _, chroma, hue = rgb_to_oklch(composite(c, page[:3]))
            exempt = chroma < HUE_CHROMA_FLOOR or d_chroma < HUE_CHROMA_FLOOR
            gap = None if exempt else round(hue_distance(hue, d_hue), 1)
            results.append(HueResult(
                pair=hue_pair_label(token), token=token, value=val, danger_value=danger_val,
                hue=round(hue, 1), danger_hue=round(d_hue, 1), chroma=round(chroma, 3),
                danger_chroma=round(d_chroma, 3), gap=gap, exempt=exempt,
                passes=exempt or hue_distance(hue, d_hue) >= HUE_GAP_MIN, mode=dict(selection),
            ))

    _apply_waivers(results, waivers)
    report.errors.extend(_stale_errors(waivers, "hue_waivers", "HUE_GATE_FAIL", system))
    failing: dict[str, list[HueResult]] = {}
    for r in results:
        if not r.passes and not r.waived:
            failing.setdefault(r.pair, []).append(r)
    for label, rs in failing.items():
        worst = min(rs, key=lambda r: r.gap or 0.0)
        report.errors.append(Error(
            "HUE_GATE_FAIL",
            f"[{system}] {label}: OKLCH hue gap {worst.gap}° < {HUE_GAP_MIN:g}° "
            f"({worst.value} h={worst.hue}° vs {worst.danger_value} h={worst.danger_hue}°, "
            f"mode {mode_label(worst.mode)}); move danger's hue/lightness or add a hue_waivers "
            f"entry with a reason",
            {"system_id": system, "pair": label, "gap": worst.gap, "mode": worst.mode,
             "failures": len(rs)},
        ))
    report.results = [asdict(r) for r in results]
    return report


GATES: tuple[tuple[str, Callable[[dict[str, Any]], GateReport]], ...] = (
    ("contrast", check_contrast),
    ("hue_gate", check_hue_gate),
)
"""Every colour gate, keyed as it appears in reports (``data.<key>``)."""


def check_color_gates(doc: dict[str, Any]) -> dict[str, GateReport]:
    """Run every colour gate (``GATES``) over a token document.

    Args:
        doc: A contract-valid token document.

    Returns:
        ``{report_key: GateReport}``, e.g. ``{"contrast": ..., "hue_gate": ...}``.
    """
    return {key: gate(doc) for key, gate in GATES}


# ─── File-level API (CLI / MCP) ─────────────────────────────────────

def check_color_gates_for_spec(spec_path: str | Path, verbose: bool = False) -> Result:
    """Run both colour gates for the token file a spec.yaml declares.

    Args:
        spec_path: Path to spec.yaml.
        verbose: Include every evaluated result (every pair in every mode
            and backdrop) under ``results``, not just the worst per pair.

    Returns:
        Result. ``data`` = ``{system_id, spec_path, tokens_path}`` plus one
        ``GateReport.summary()`` per gate (``contrast``, ``hue_gate``). Fails
        when a gate reports an error, or the token file is missing or not
        contract-valid.
    """
    spec_path = Path(spec_path).resolve()
    try:
        spec = yaml.safe_load(spec_path.read_text()) or {}
    except FileNotFoundError:
        return Result.failure(Error("SPEC_FILE_MISSING", f"Spec file not found: {spec_path}",
                                    {"path": str(spec_path)}))
    except yaml.YAMLError as exc:
        return Result.failure(Error("SPEC_PARSE_FAILED", f"YAML parse error: {exc}",
                                    {"path": str(spec_path)}))
    tok_path = token_file_path(spec_path, spec)
    sys_id = (spec.get("system") or {}).get("id")
    if tok_path is None:
        return Result.failure(Error(
            "SCHEMA_VALIDATION_FAILED",
            f"{spec_path} declares no system.tokens_file; no colours to check",
            {"spec_path": str(spec_path), "system_id": sys_id}))
    loaded = load_token_file(tok_path)
    if not loaded.ok:
        return loaded
    tok_errors, _ = validate_token_document(loaded.data, str(tok_path))
    if tok_errors:
        return Result.failure(tok_errors)
    reports = check_color_gates(loaded.data)
    data: dict[str, Any] = {
        "system_id": sys_id,
        "spec_path": str(spec_path),
        "tokens_path": str(tok_path),
    }
    errors: list[Error] = []
    for key, report in reports.items():
        data[key] = report.summary()
        if verbose:
            data[key]["results"] = report.results
        errors.extend(report.errors)
    logger.info("color_gates_checked", system_id=sys_id,
                **{f"{key}_ok": report.ok for key, report in reports.items()})
    if errors:
        result = Result.failure(errors)
        result.data = data
        return result
    return Result.success(data)


def check_color_gates_all(
    entries: list[tuple[str, Path]] | None = None,
    checker: Callable[[Path], Result] = check_color_gates_for_spec,
) -> Result:
    """Run the colour gates for every registered system (deduplicated by spec).

    Args:
        entries: Optional ``(system_id, spec_path)`` pairs; defaults to the
            registry.
        checker: Per-spec check; injectable for tests.

    Returns:
        Result with ``data = {"systems": {id: per-system data}}``; fails if
        any system fails a gate.
    """
    if entries is None:
        from .paths import project_root
        from .registry import Registry
        reg = Registry.load()
        if not reg.ok:
            return reg
        root = project_root()
        entries = [(e.id, (root / e.spec).resolve()) for e in reg.data.all()]
    systems: dict[str, Any] = {}
    errors: list[Error] = []
    seen: dict[Path, str] = {}
    ordered = sorted(entries, key=lambda e: Path(e[1]).parent.name != e[0])
    for sys_id, spec_path in ordered:
        if spec_path in seen:
            systems[sys_id] = {"alias_of": seen[spec_path]}
            continue
        seen[spec_path] = sys_id
        res = checker(spec_path)
        systems[sys_id] = res.data if res.data is not None else {
            "errors": [e.message for e in res.errors]}
        if not res.ok:
            errors.extend(
                Error(e.code, e.message if e.message.startswith("[") else f"[{sys_id}] {e.message}",
                      {**e.detail, "system_id": sys_id})
                for e in res.errors)
    if errors:
        result = Result.failure(errors)
        result.data = {"systems": systems}
        return result
    return Result.success({"systems": systems})


# ─── Documentation rendering ────────────────────────────────────────

def render_thresholds_table() -> str:
    """Render the per-kind minimum ratios as a Markdown table.

    Returns:
        A Markdown table (kind | minimum | WCAG criterion | waivable).
    """
    criteria = {
        PAIR_TEXT: "1.4.3 Contrast (Minimum)",
        PAIR_LARGE_TEXT: "1.4.3, large-scale text",
        PAIR_UI: "1.4.11 Non-text Contrast",
        PAIR_ADVISORY: "reported only (placeholders; decorative text, with a note)",
        PAIR_DISABLED: "reported only: 1.4.3 exempts inactive UI (note + disabled-role token)",
    }
    lines = ["| Kind | Minimum | WCAG 2.x | Waivable |", "|------|---------|----------|----------|"]
    for kind in (PAIR_TEXT, PAIR_LARGE_TEXT, PAIR_UI, PAIR_ADVISORY, PAIR_DISABLED):
        m = CONTRAST_MINIMUMS[kind]
        lines.append(f"| {kind} | {f'{m:g}:1' if m else '—'} | {criteria[kind]} | "
                     f"{'yes, with a reason' if kind in WAIVABLE_KINDS else 'no'} |")
    return "\n".join(lines)
