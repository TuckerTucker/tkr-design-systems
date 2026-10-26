#!/usr/bin/env python3
"""Build the Riso single-file reference export.

Reads ``systems/riso/spec.yaml`` and emits ``systems/riso/riso-reference.html``
— one self-contained page carrying two payloads for two audiences:

1. **Machine payload.** The entire spec, serialized to JSON inside a
   ``<script type="application/json" id="riso-spec">`` tag as the first element
   in the body. An agent parses that block and has every token, contract, and
   rule without scraping markup.

2. **Human payload.** The same spec rendered as a live, operable press —
   every paper stock and ink drum switchable, so the duotone/halftone/grain
   pipeline can be *seen* rather than inferred. Screenshots of this page are
   visual ground truth for vision-model verification.

The generator exists because a hand-authored reference drifts from the spec the
same way ``spec.yaml`` v2.0.0 drifted from the implementation. Regenerate after
any spec change; never edit the HTML directly.

Usage:
    python3 tools/builders/build_riso_reference.py [--out PATH]
"""

from __future__ import annotations

import argparse
import json
import sys
from html import escape
from pathlib import Path
from typing import Any
from urllib.parse import quote

import structlog

logger = structlog.get_logger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "tools" / "design-system-skill"))

from design_system_skill.token_file import read_spec_with_tokens  # noqa: E402
SPEC_PATH = REPO_ROOT / "systems" / "riso" / "spec.yaml"
DEFAULT_OUT = REPO_ROOT / "systems" / "riso" / "riso-reference.html"

# Rec.709 luminance coefficients — the basis of both duotone matrices.
LUMA_R, LUMA_G, LUMA_B = 0.2126, 0.7152, 0.0722


# ─── Color + filter math (mirrors design-system-riso.jsx exactly) ────

def hex_to_rgb(value: str) -> tuple[float, float, float]:
    """Convert a #RRGGBB string to normalized 0-1 RGB floats.

    Args:
        value: Hex color string, with or without a leading '#'.

    Returns:
        Tuple of (r, g, b) in the 0-1 range.
    """
    h = value.lstrip("#")
    return (
        int(h[0:2], 16) / 255,
        int(h[2:4], 16) / 255,
        int(h[4:6], 16) / 255,
    )


def duotone_matrix(ink_1: str, paper: str) -> str:
    """Build the primary duotone feColorMatrix values string.

    Linearly interpolates from ink-1 (shadows) to paper (highlights) along
    Rec.709 luminance: ``out = ink_1 + (paper - ink_1) * luminance``.

    Args:
        ink_1: Primary ink hex color.
        paper: Paper stock hex color.

    Returns:
        A 20-value feColorMatrix ``values`` string.
    """
    c1 = hex_to_rgb(ink_1)
    p = hex_to_rgb(paper)
    rows = []
    for i in range(3):
        d = p[i] - c1[i]
        rows.append(
            f"{LUMA_R * d:.4f} {LUMA_G * d:.4f} {LUMA_B * d:.4f} 0 {c1[i]:.4f}"
        )
    rows.append("0 0 0 1 0")
    return "  ".join(rows)


def ghost_matrix(ink_2: str) -> str:
    """Build the ghost/second-ink feColorMatrix values string.

    Emits flat ink-2 RGB with ``alpha = 1 - luminance``, so the second ink
    prints only into shadow areas.

    Args:
        ink_2: Secondary ink hex color.

    Returns:
        A 20-value feColorMatrix ``values`` string.
    """
    c2 = hex_to_rgb(ink_2)
    return (
        f"0 0 0 0 {c2[0]:.4f}  "
        f"0 0 0 0 {c2[1]:.4f}  "
        f"0 0 0 0 {c2[2]:.4f}  "
        f"{-LUMA_R} {-LUMA_G} {-LUMA_B} 0 1"
    )


def grain_data_url(frequency: float, seed: int = 7, tile: int = 220) -> str:
    """Build the inline feTurbulence grain background as a data URL.

    Args:
        frequency: baseFrequency for feTurbulence.
        seed: Turbulence seed (fixed at 7 in the implementation).
        tile: Tile edge length in px.

    Returns:
        A ``url("data:image/svg+xml,...")`` string ready for ``background-image``.
    """
    svg = (
        f"<svg xmlns='http://www.w3.org/2000/svg' width='{tile}' height='{tile}'>"
        f"<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='{frequency}' "
        f"numOctaves='2' seed='{seed}' stitchTiles='stitch'/>"
        f"<feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0'/></filter>"
        f"<rect width='{tile}' height='{tile}' filter='url(#n)'/></svg>"
    )
    return f'url("data:image/svg+xml;charset=utf8,{quote(svg)}")'


# ─── Spec access helpers ────────────────────────────────────────────

def state_default(spec: dict[str, Any], state_id: str) -> Any:
    """Look up a system_state entry's default value.

    Args:
        spec: Parsed spec mapping.
        state_id: The ``id`` of the system_state entry.

    Returns:
        The entry's ``default`` value, or None if absent.
    """
    for entry in spec.get("system_state", []):
        if entry.get("id") == state_id:
            return entry.get("default")
    return None


def e(value: Any) -> str:
    """HTML-escape a value for safe interpolation into markup."""
    return escape(str(value), quote=True)


# ─── Page fragments ─────────────────────────────────────────────────

PAGE_CSS = """
:root {
  --ui-bg: #14110F;
  --ui-panel: #1C1917;
  --ui-line: rgba(255,255,255,0.09);
  --ui-text: #E7E2DA;
  --ui-dim: #98908A;
  --ui-faint: #6A625D;
  --ui-good: #34D399;
  --ui-bad: #FF6B6B;
  --ui-mark: #FF48B0;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--ui-bg);
  color: var(--ui-text);
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
.wrap { max-width: 1180px; margin: 0 auto; padding: 40px 28px 120px; }
code, .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }

h1 { font-size: 40px; font-weight: 700; letter-spacing: -0.03em; margin: 0 0 4px; }
h2 {
  font-size: 12px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.16em; color: var(--ui-mark);
  margin: 64px 0 16px; padding-bottom: 8px;
  border-bottom: 1px solid var(--ui-line);
}
h3 { font-size: 17px; font-weight: 700; margin: 32px 0 10px; letter-spacing: -0.01em; }
h4 { font-size: 12px; font-weight: 700; margin: 20px 0 8px; color: var(--ui-dim);
     text-transform: uppercase; letter-spacing: 0.1em; }
p { color: var(--ui-dim); margin: 0 0 12px; max-width: 74ch; }
a { color: var(--ui-mark); }

.lede { font-size: 16px; color: var(--ui-text); max-width: 74ch; }
.kicker { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.18em; color: var(--ui-faint); }

.agent-note {
  border: 1px solid var(--ui-mark); border-left-width: 3px;
  background: rgba(255,72,176,0.06);
  padding: 18px 20px; margin: 28px 0 8px; border-radius: 3px;
}
.agent-note h4 { margin-top: 0; color: var(--ui-mark); }
.agent-note ol { margin: 0; padding-left: 20px; color: var(--ui-dim); }
.agent-note li { margin-bottom: 6px; }

table { width: 100%; border-collapse: collapse; margin: 10px 0 18px; font-size: 13px; }
th {
  text-align: left; font-size: 9.5px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.14em; color: var(--ui-faint); padding: 6px 10px;
  border-bottom: 1px solid var(--ui-line); font-family: 'JetBrains Mono', monospace;
}
td { padding: 7px 10px; border-bottom: 1px solid rgba(255,255,255,0.04);
     color: var(--ui-dim); vertical-align: top; }
td.k { color: var(--ui-text); font-family: 'JetBrains Mono', monospace; font-size: 11.5px; white-space: nowrap; }
td strong { color: var(--ui-text); font-weight: 600; }
.scroll { overflow-x: auto; }

pre {
  background: #0E0C0B; border: 1px solid var(--ui-line); border-radius: 3px;
  padding: 14px 16px; overflow-x: auto; font-size: 11.5px; line-height: 1.6;
  color: #C9C2BA; margin: 8px 0 16px;
}
.chip {
  display: inline-block; font-family: 'JetBrains Mono', monospace; font-size: 9px;
  font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
  padding: 2px 7px; border-radius: 2px; border: 1px solid currentColor;
}
.chip.req { color: var(--ui-bad); }
.chip.rec { color: #FBBF24; }
.chip.mech { color: #60A5FA; }
.chip.sem { color: #A78BFA; }

.swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: 10px; }
.sw { border: 1px solid var(--ui-line); border-radius: 3px; overflow: hidden; }
.sw .fill { height: 54px; }
.sw .meta { padding: 7px 9px; }
.sw .nm { font-size: 11.5px; font-weight: 600; color: var(--ui-text); }
.sw .hx { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--ui-faint); }

.rule { border: 1px solid var(--ui-line); border-radius: 3px; padding: 16px 18px; margin-bottom: 10px; }
.rule .hd { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.rule .rid { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700; color: var(--ui-text); }
.rule .stmt { color: var(--ui-text); margin-bottom: 6px; }
.rule .why { color: var(--ui-dim); font-size: 13px; }
.rule .why b { color: var(--ui-faint); font-weight: 700; font-size: 10px;
               text-transform: uppercase; letter-spacing: 0.12em; }

.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 14px 0 26px; }
.pane { border: 1px solid var(--ui-line); border-radius: 3px; overflow: hidden; }
.pane > .lbl {
  font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.14em; padding: 7px 10px;
  border-bottom: 1px solid var(--ui-line);
}
.pane.ok > .lbl { color: var(--ui-good); background: rgba(52,211,153,0.07); }
.pane.no > .lbl { color: var(--ui-bad);  background: rgba(255,107,107,0.07); }
.pane .note { padding: 8px 10px 10px; font-size: 11.5px; color: var(--ui-dim);
              border-top: 1px solid var(--ui-line); }

.dl { display: grid; grid-template-columns: max-content 1fr; gap: 2px 14px; margin: 6px 0 16px; font-size: 12.5px; }
.dl dt { font-family: 'JetBrains Mono', monospace; color: var(--ui-text); font-size: 11.5px; }
.dl dd { margin: 0; color: var(--ui-dim); }
.dos li { color: var(--ui-dim); margin-bottom: 4px; }
.dos li::marker { color: var(--ui-good); }
.donts li::marker { color: var(--ui-bad); }

.cmp { border: 1px solid var(--ui-line); border-radius: 3px; padding: 16px 18px; margin-bottom: 12px; }
.cmp .nm { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 700; }
.cmp .tier { font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase;
             color: var(--ui-faint); font-family: 'JetBrains Mono', monospace; }
.cmp .contract { color: var(--ui-text); font-size: 13px; margin: 8px 0 4px; }

/* ── press controls ── */
.press {
  position: sticky; top: 0; z-index: 500;
  display: flex; gap: 22px; flex-wrap: wrap; align-items: center;
  background: rgba(20,17,15,0.94); backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--ui-line); padding: 12px 28px; margin-bottom: 0;
}
.press .grp { display: flex; align-items: center; gap: 7px; }
.press .grp > span {
  font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.14em; color: var(--ui-faint);
}
.press button {
  font: inherit; font-size: 11px; cursor: pointer; padding: 4px 9px;
  background: transparent; color: var(--ui-dim);
  border: 1px solid var(--ui-line); border-radius: 2px;
  display: flex; align-items: center; gap: 5px;
}
.press button[aria-pressed="true"] { color: var(--ui-text); border-color: var(--ui-mark); background: rgba(255,72,176,0.12); }
.press .dot { width: 9px; height: 9px; display: inline-block; border: 1px solid rgba(0,0,0,0.3); }

/* ── the Riso surface itself ── */
.riso {
  position: relative;
  background: var(--riso-paper);
  color: var(--riso-text);
  font-family: 'Space Grotesk', system-ui, sans-serif;
}
.riso .grain {
  position: absolute; inset: 0; pointer-events: none; z-index: 100;
  mix-blend-mode: overlay;
  background-image: var(--riso-grain-url);
  background-size: 220px 220px;
  opacity: var(--riso-grain-amount);
}
.duo { position: relative; display: inline-block; color: var(--riso-ink-1); line-height: 1; }
.duo > .f { position: relative; z-index: 2; }
.duo > .g {
  position: absolute; left: 0; top: 0; width: 100%; z-index: 1;
  color: var(--riso-ink-2);
  mix-blend-mode: var(--riso-blend);
  opacity: var(--riso-ink-density);
  transform: translate(var(--riso-off-x), var(--riso-off-y));
  pointer-events: none;
}
.duo.i2 { color: var(--riso-ink-2); }
.duo.i2 > .g { color: var(--riso-ink-1); }

.ht { width: 100%; overflow: hidden; position: relative;
      mix-blend-mode: var(--riso-blend); opacity: var(--riso-ink-density); }
.ht > i {
  position: absolute; inset: -50%; display: block;
  background-image: radial-gradient(circle, var(--ht-ink)
    calc(35% - (var(--riso-ht-softness) * 15%)),
    transparent calc(36% + (var(--riso-ht-softness) * 15%)));
  background-size: var(--riso-ht-size) var(--riso-ht-size);
  transform: rotate(var(--riso-ht-angle));
  filter: blur(var(--riso-bleed));
}
.ht.i1 { --ht-ink: var(--riso-ink-1); }
.ht.i2 { --ht-ink: var(--riso-ink-2); }

.tag {
  font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 700;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--riso-ink-1);
  mix-blend-mode: var(--riso-blend); opacity: var(--riso-ink-density);
}
.tag.i2 { color: var(--riso-ink-2); }
.tag.sm { font-size: 8.5px; letter-spacing: 0.14em; }

.body-ink { filter: blur(calc(var(--riso-bleed) * 0.4)); }

/* specimen shell */
.shell { display: grid; grid-template-columns: 260px 1fr; min-height: 460px; }
.shell .sb { border-right: 1px solid rgba(0,0,0,0.15); position: relative; z-index: 2; }
.shell .ca { position: relative; z-index: 2; display: flex; flex-direction: column; }
.li { padding: 10px 16px; border-top: 1px solid rgba(0,0,0,0.1); cursor: default; }
.li.sel { background: rgba(0,0,0,0.03); }
.li .row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; }
.li .nm { font-size: 14px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.2; }
.li .pv { font-size: 11px; opacity: 0.65; line-height: 1.4; margin-top: 3px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.unread {
  padding: 1px 6px; background: var(--riso-ink-2); color: var(--riso-paper);
  font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 700;
  letter-spacing: 0.04em; mix-blend-mode: var(--riso-blend); opacity: var(--riso-ink-density);
}
.msg { margin-bottom: 18px; display: flex; flex-direction: column; }
.msg.user { align-self: flex-end; max-width: 70%; align-items: flex-end; }
.msg.ai { align-self: flex-start; max-width: 84%; }
.msg .hd { display: flex; gap: 8px; align-items: baseline; margin-bottom: 5px; }
.msg .tx { font-size: 14px; font-weight: 500; line-height: 1.55; letter-spacing: -0.005em; }

.specimen { border: 1px solid var(--ui-line); border-radius: 3px; overflow: hidden; margin: 14px 0 24px; }
.mini { padding: 22px 20px; }

.layers { display: flex; flex-direction: column-reverse; gap: 3px; margin: 10px 0 20px; max-width: 620px; }
.layers .ly {
  display: grid; grid-template-columns: 54px 150px 1fr; align-items: center; gap: 12px;
  border: 1px solid var(--ui-line); border-left: 3px solid var(--ui-mark);
  padding: 9px 12px; border-radius: 2px; font-size: 12.5px; color: var(--ui-dim);
}
.layers .ly .z { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ui-faint); }
.layers .ly .nm { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ui-text); }

footer { margin-top: 80px; padding-top: 20px; border-top: 1px solid var(--ui-line);
         font-size: 11.5px; color: var(--ui-faint); }

@media (max-width: 860px) {
  .pair { grid-template-columns: 1fr; }
  .shell { grid-template-columns: 1fr; }
}
"""


def build_press_css(spec: dict[str, Any]) -> str:
    """Emit CSS custom-property blocks for every paper and ink preset.

    Each preset becomes a ``[data-paper="id"]`` / ``[data-ink="id"]`` rule on
    the root, so the whole page re-presses by flipping two attributes.

    Args:
        spec: Parsed spec mapping.

    Returns:
        A CSS string.
    """
    presets = spec["press_presets"]
    grain_freq = state_default(spec, "grain_frequency")
    lines: list[str] = []

    lines.append(":root {")
    lines.append(f"  --riso-off-x: {state_default(spec, 'registration_offset_x')}px;")
    lines.append(f"  --riso-off-y: {state_default(spec, 'registration_offset_y')}px;")
    lines.append(f"  --riso-ht-size: {state_default(spec, 'halftone_dot_size')}px;")
    lines.append(f"  --riso-ht-angle: {state_default(spec, 'halftone_angle')}deg;")
    lines.append(f"  --riso-ht-softness: {state_default(spec, 'halftone_softness')};")
    lines.append(f"  --riso-grain-amount: {state_default(spec, 'grain_amount')};")
    lines.append(f"  --riso-bleed: {state_default(spec, 'ink_bleed')}px;")
    lines.append(f"  --riso-tremor: {state_default(spec, 'type_tremor')}px;")
    lines.append(f"  --riso-grain-url: {grain_data_url(float(grain_freq))};")
    lines.append("}")

    for paper in presets["paper"]:
        lines.append(f'[data-paper="{paper["id"]}"] {{')
        lines.append(f'  --riso-paper: {paper["paper"]};')
        lines.append(f'  --riso-text: {paper["text_ink"]};')
        lines.append(f'  --riso-blend: {paper["blend"]};')
        lines.append(f'  --riso-ink-density: {paper["density"]};')
        lines.append("}")

    for ink in presets["ink"]:
        lines.append(f'[data-ink="{ink["id"]}"] {{')
        lines.append(f'  --riso-ink-1: {ink["ink_1"]};')
        lines.append(f'  --riso-ink-2: {ink["ink_2"]};')
        lines.append("}")

    return "\n".join(lines)


def build_filter_defs(spec: dict[str, Any]) -> str:
    """Emit one live SVG <defs> block per (paper, ink) combination.

    Filter ids follow ``riso-duo-primary--<paper>--<ink>`` so a specimen can
    reference the correct resolved matrix for the active press state without
    recomputing anything at runtime.

    Args:
        spec: Parsed spec mapping.

    Returns:
        An inline SVG element as an HTML string.
    """
    presets = spec["press_presets"]
    out = ['<svg aria-hidden="true" width="0" height="0" style="position:absolute">', "<defs>"]
    for paper in presets["paper"]:
        for ink in presets["ink"]:
            fid = f'{paper["id"]}--{ink["id"]}'
            out.append(
                f'<filter id="riso-duo-primary--{fid}" color-interpolation-filters="sRGB">'
                f'<feColorMatrix type="matrix" values="{duotone_matrix(ink["ink_1"], paper["paper"])}"/>'
                f"</filter>"
            )
    for ink in presets["ink"]:
        out.append(
            f'<filter id="riso-duo-ghost--{ink["id"]}" color-interpolation-filters="sRGB">'
            f'<feColorMatrix type="matrix" values="{ghost_matrix(ink["ink_2"])}"/>'
            f"</filter>"
        )
    out.append("</defs></svg>")
    return "\n".join(out)


def duo(text: str, size: int, weight: int = 700, tracking: str = "-0.03em", ink2: bool = False) -> str:
    """Render a DuotoneText specimen span.

    Args:
        text: The text content.
        size: Font size in px.
        weight: Font weight.
        tracking: CSS letter-spacing value.
        ink2: Render with ink-2 as the primary layer.

    Returns:
        HTML string.
    """
    cls = "duo i2" if ink2 else "duo"
    style = f"font-size:{size}px;font-weight:{weight};letter-spacing:{tracking}"
    return (
        f'<span class="{cls}" style="{style}">'
        f'<span class="f">{e(text)}</span>'
        f'<span class="g" aria-hidden="true">{e(text)}</span></span>'
    )


def halftone(height: int, ink: int = 1, style: str = "") -> str:
    """Render a HalftoneStrip specimen.

    Args:
        height: Strip height in px.
        ink: 1 or 2, selecting which drum draws the dots.
        style: Extra inline CSS for the container.

    Returns:
        HTML string.
    """
    return f'<div class="ht i{ink}" style="height:{height}px;{style}"><i></i></div>'


def tag(text: str, ink: int = 1, small: bool = False) -> str:
    """Render an InkTag specimen.

    Args:
        text: Label content.
        ink: 1 or 2, selecting the drum.
        small: Use the 8.5px micro step.

    Returns:
        HTML string.
    """
    cls = f'tag{" i2" if ink == 2 else ""}{" sm" if small else ""}'
    return f'<span class="{cls}">{e(text)}</span>'


# ─── Section builders ───────────────────────────────────────────────

def sec_header(spec: dict[str, Any]) -> str:
    """Build the title block and the agent-facing reading instructions."""
    s = spec["system"]
    return f"""
<header>
  <div class="kicker">{e(s['grammar_family'])} · spec {e(spec['spec_version'])} · system v{e(s['version'])}</div>
  <h1>{e(s['name'])}</h1>
  <p class="lede">{e(s['tagline'])} — {e(s['premise'].strip())}</p>
</header>

<div class="agent-note">
  <h4>If you are an agent reading this file</h4>
  <ol>
    <li>The complete spec is JSON in <code>&lt;script type="application/json" id="riso-spec"&gt;</code>.
        Parse that; do not scrape the markup below for values.</li>
    <li>The markup below is the <em>visual</em> ground truth for the same data — it renders the real
        duotone / halftone / grain pipeline. Screenshot it to verify your own output against it.</li>
    <li>Riso is <strong>parametric</strong>. There is no single palette: a surface resolves from one
        <code>press_presets.paper</code> row and one <code>press_presets.ink</code> row. Pick a pair,
        then hold it for the whole artifact.</li>
    <li>The rulebook is the highest-value section. Most of it is <em>negative</em> constraints —
        the things that look reasonable and are wrong here. Read it before generating.</li>
    <li>Source of truth is <code>systems/riso/spec.yaml</code>, itself reconciled against
        <code>{e(s['source_jsx'])}</code>. This page is generated; never hand-edit it.</li>
  </ol>
</div>
"""


def sec_press_controls(spec: dict[str, Any]) -> str:
    """Build the sticky paper/ink selector bar."""
    presets = spec["press_presets"]
    papers = "".join(
        f'<button type="button" data-set="paper" data-val="{e(p["id"])}" '
        f'aria-pressed="{"true" if p["id"] == "cream" else "false"}">'
        f'<span class="dot" style="background:{e(p["paper"])}"></span>{e(p["label"])}</button>'
        for p in presets["paper"]
    )
    inks = "".join(
        f'<button type="button" data-set="ink" data-val="{e(i["id"])}" '
        f'aria-pressed="{"true" if i["id"] == "classic" else "false"}">'
        f'<span class="dot" style="background:{e(i["ink_1"])}"></span>'
        f'<span class="dot" style="background:{e(i["ink_2"])}"></span>{e(i["label"])}</button>'
        for i in presets["ink"]
    )
    return f"""
<div class="press">
  <div class="grp"><span>Paper</span>{papers}</div>
  <div class="grp"><span>Ink</span>{inks}</div>
</div>
"""


def sec_specimen(spec: dict[str, Any]) -> str:
    """Build the canonical composed surface — the sidebar + main chat shell."""
    items = [
        ("01", "2m", "Tokyo Trip", "Want me to build a day-by-day itinerary?", 2, True),
        ("02", "1h", "Recipe Ideas", "Here are 5 ramen variations you'll love…", 0, False),
        ("03", "3h", "Book Club", "I'd recommend starting with Murakami's…", 1, False),
        ("04", "1d", "Fitness Plan", "Your 4-week progressive routine is ready.", 0, False),
    ]
    rows = []
    for idx, time, name, preview, unread, selected in items:
        chip = f'<span class="unread">{unread}</span>' if unread else ""
        title = duo(name, 14, 700, "-0.01em") if selected else f'<span>{e(name)}</span>'
        rows.append(
            f'<div class="li{" sel" if selected else ""}">'
            f'<div class="row">{tag(f"№{idx} · {time}", 1, True)}{chip}</div>'
            f'<div class="nm">{title}</div>'
            f'<div class="pv">{e(preview)}</div></div>'
        )

    msgs = [
        ("ai", "The Press", "14:23", "Absolutely. Tokyo is incredible. Are you looking for a "
                                     "culture-focused trip, a food adventure, or a mix of everything?"),
        ("user", "Reply · T. Harris", "14:24", "Definitely a mix — temples in the morning, ramen at night."),
    ]
    bubbles = []
    for who, sender, time, text in msgs:
        ink = 2 if who == "user" else 1
        bubbles.append(
            f'<div class="msg {who}"><div class="hd">{tag(sender, ink)}{tag(time, 1, True)}</div>'
            f'<div class="tx body-ink">{e(text)}</div></div>'
        )

    sections = "".join(
        f'<div style="padding:10px 12px;border-right:1px solid var(--riso-text);'
        f'border-bottom:1px solid var(--riso-text)">{tag(f"{n}.", 1)}'
        f'<div style="font-size:13px;font-weight:600;letter-spacing:-0.01em;margin-top:3px">{e(l)}</div></div>'
        for n, l in [("I", "Temples"), ("II", "Ramen"), ("III", "Culture"), ("IV", "Parks")]
    )

    return f"""
<h2>The surface</h2>
<p>Every value in this specimen resolves from the two presets selected above. Nothing is hardcoded —
switch paper or ink and the inks, blend mode, density, filters, and text color all re-press together.</p>

<div class="specimen riso" data-riso>
  <div class="shell">
    <div class="sb">
      <div style="padding:18px 16px 8px">
        {duo("RISO", 28, 700, "-0.04em")}
        <div style="margin-top:6px">{tag("Edition №04 · Vol. I", 2)}</div>
      </div>
      {halftone(10, 1, "margin:6px 16px 8px")}
      <div style="padding:6px 16px 4px">{tag("Recent Issues")}</div>
      {''.join(rows)}
      <div style="padding:12px 16px;border-top:1px solid var(--riso-text)">
        {tag("Press Operator", 1, True)}
        <div style="font-size:13px;font-weight:600;margin-top:2px">T. Harris</div>
      </div>
    </div>
    <div class="ca">
      <div style="padding:18px 24px 10px;border-bottom:1px solid var(--riso-text)">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          {tag("Issue №04 · Filed 14:23", 2)}{tag("● Active", 1)}
        </div>
        <div style="margin-top:6px">{duo("Tokyo Trip", 30, 700, "-0.03em")}</div>
        <div style="font-size:12px;opacity:0.75;margin-top:6px;font-style:italic">
          A printed correspondence on temples, ramen, and the after-hours food scene in Shibuya.</div>
      </div>
      {halftone(12, 2)}
      <div style="padding:18px 24px;display:flex;flex-direction:column">
        {''.join(bubbles)}
        <div style="margin-bottom:8px">{tag("Sections — 04", 2)}</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);
                    border-top:1px solid var(--riso-text);border-left:1px solid var(--riso-text)">
          {sections}
        </div>
      </div>
      <div style="margin-top:auto;padding:14px 24px;border-top:1px solid var(--riso-text);background:rgba(0,0,0,0.02)">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:14px">
          <span style="font-size:14px;font-style:italic;opacity:0.6">Compose your reply…</span>
          {tag("File Reply →", 2)}
        </div>
      </div>
    </div>
  </div>
  <div class="grain"></div>
</div>
"""


def sec_layers(spec: dict[str, Any]) -> str:
    """Build the ink-stacking / artifact-treatment layer diagram."""
    stack = spec["tokens"]["elevation"]["ink_stacking_order"]
    rows = "".join(
        f'<div class="ly"><span class="z">z {e(l["z"])}</span>'
        f'<span class="nm">{e(l["layer"])}</span><span>{e(l["detail"])}</span></div>'
        for l in stack
    )
    treatments = "".join(
        f'<tr><td class="k">{e(t["id"])}</td><td><strong>{e(t["layer"])}</strong></td>'
        f'<td>{e(t.get("description", "").strip())}</td></tr>'
        for t in spec["artifact_treatments"]
    )
    return f"""
<h2>Layer order</h2>
<p>Riso has no elevation system. Depth is ink order. Read the diagram bottom-up — paper is printed
first, grain last, and grain is applied <em>once</em>, over the composed artifact.</p>
<div class="layers">{rows}</div>

<h4>Artifact treatments</h4>
<div class="scroll"><table>
  <thead><tr><th>id</th><th>layer</th><th>applies</th></tr></thead>
  <tbody>{treatments}</tbody>
</table></div>
"""


def sec_presets(spec: dict[str, Any]) -> str:
    """Build the paper stock and ink drum preset tables."""
    presets = spec["press_presets"]
    papers = "".join(
        f'<tr><td><span class="dot" style="display:inline-block;width:22px;height:22px;'
        f'background:{e(p["paper"])};border:1px solid rgba(255,255,255,0.2)"></span></td>'
        f'<td><strong>{e(p["label"])}</strong></td><td class="k">{e(p["paper"])}</td>'
        f'<td class="k">{e(p["blend"])}</td><td class="k">{e(p["density"])}×</td>'
        f'<td class="k">{e(p["text_ink"])}</td><td>{e(p["character"])}</td></tr>'
        for p in presets["paper"]
    )
    inks = "".join(
        f'<tr><td><span style="display:inline-flex;gap:2px">'
        f'<span style="width:22px;height:22px;background:{e(i["ink_1"])};border:1px solid rgba(255,255,255,0.15)"></span>'
        f'<span style="width:22px;height:22px;background:{e(i["ink_2"])};border:1px solid rgba(255,255,255,0.15)"></span>'
        f'</span></td><td><strong>{e(i["label"])}</strong></td>'
        f'<td class="k">{e(i["ink_1"])}</td><td class="k">{e(i["ink_2"])}</td>'
        f'<td>{e(i["character"])}</td></tr>'
        for i in presets["ink"]
    )
    state_rows = "".join(
        f'<tr><td class="k">{e(s["id"])}</td>'
        f'<td class="k">{e(s.get("css_var") or "—")}</td>'
        f'<td class="k">{e(s.get("default"))}{e(s.get("unit", ""))}</td>'
        f'<td class="k">{e(s.get("range") or s.get("options") or s.get("source") or "—")}</td>'
        f'<td class="k">{e(s.get("step", "—"))}</td>'
        f'<td>{e((s.get("note") or s.get("ceiling_note") or "").strip())}</td></tr>'
        for s in spec["system_state"]
    )
    return f"""
<h2>Press presets</h2>
<p>Both axes are <strong>atomic</strong>. Selecting a paper changes four values at once — color, blend
mode, ink density, and text ink — because that is what physically happens when you change stock.
Unbundling them produces combinations no press can print.</p>

<h4>Paper stocks</h4>
<div class="scroll"><table>
  <thead><tr><th></th><th>stock</th><th>color</th><th>blend</th><th>density</th><th>text ink</th><th>character</th></tr></thead>
  <tbody>{papers}</tbody>
</table></div>

<h4>Ink drums</h4>
<div class="scroll"><table>
  <thead><tr><th></th><th>pair</th><th>ink-1</th><th>ink-2</th><th>character</th></tr></thead>
  <tbody>{inks}</tbody>
</table></div>

<h4>Press controls (system_state)</h4>
<div class="scroll"><table>
  <thead><tr><th>id</th><th>css var</th><th>default</th><th>range / options</th><th>step</th><th>note</th></tr></thead>
  <tbody>{state_rows}</tbody>
</table></div>
"""


def sec_type(spec: dict[str, Any]) -> str:
    """Build the typography section — families and the named scale, rendered live."""
    typo = spec["tokens"]["typography"]
    fams = "".join(
        f'<div class="cmp"><div class="nm" style="font-family:{e(f["stack"])};font-size:20px">'
        f'{e(f["stack"].split(",")[0].strip(chr(39)))}</div>'
        f'<div class="tier">{e(f["role"])}</div>'
        f'<p style="margin:8px 0 0">{e(f["mixing_rule"].strip())}</p></div>'
        for f in typo["families"]
    )
    rows = []
    for st in typo["scale"]:
        mono = st["family"] == "metadata"
        face = "'JetBrains Mono', monospace" if mono else "'Space Grotesk', sans-serif"
        upper = "text-transform:uppercase;" if mono else ""
        sample = (
            f'<span style="font-family:{face};font-size:{st["size"]}px;font-weight:{st["weight"]};'
            f'letter-spacing:{st["tracking"]}em;{upper}line-height:{st["line_height"]}">Compose</span>'
        )
        rows.append(
            f'<tr><td class="k">{e(st["id"])}</td><td class="k">{e(st["size"])}px</td>'
            f'<td class="k">{e(st["weight"])}</td><td class="k">{e(st["tracking"])}em</td>'
            f'<td class="k">{e(st["treatment"])}</td><td>{e(st["role"])}</td>'
            f'<td style="text-align:right">{sample}</td></tr>'
        )
    mods = "".join(
        f'<dt>{e(k)}</dt><dd><code>{e(v)}</code></dd>'
        for k, v in typo["modifiers"].items()
    )
    return f"""
<h2>Typography</h2>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">{fams}</div>

<h4>Named scale</h4>
<p>The <code>treatment</code> column is load-bearing: it names the primitive that must render the step.
A masthead rendered as plain text is not a masthead.</p>
<div class="scroll"><table>
  <thead><tr><th>step</th><th>size</th><th>weight</th><th>tracking</th><th>treatment</th><th>role</th><th>specimen</th></tr></thead>
  <tbody>{''.join(rows)}</tbody>
</table></div>

<h4>Ink imperfection modifiers</h4>
<dl class="dl">{mods}</dl>
"""


def sec_filters(spec: dict[str, Any]) -> str:
    """Build the filter/pattern section with resolved defs and the formulas."""
    fl = {f["id"]: f for f in spec["filter_library"]}
    pat = spec["css_pattern_library"][0]
    primary, ghost, grain = fl["riso_duotone_primary"], fl["riso_duotone_ghost"], fl["riso_grain"]
    return f"""
<h2>Filters &amp; patterns</h2>
<p>Two SVG filters, one CSS pattern, one CSS noise layer. The single most common way to get Riso wrong
is to reimplement halftone as <code>feTurbulence</code> — that produces noise, not dots. Halftone here
is a rotated radial-gradient; grain is the turbulence.</p>

<h3>riso_duotone_primary</h3>
<p>{e(primary['description'].strip())}</p>
<pre>{e(primary['matrix_formula'].strip())}</pre>
<p class="kicker">resolved · cream + classic</p>
<pre>{e(primary['svg_defs'].strip())}</pre>

<h3>riso_duotone_ghost</h3>
<p>{e(ghost['description'].strip())}</p>
<pre>{e(ghost['matrix_formula'].strip())}</pre>
<p class="kicker">resolved · classic</p>
<pre>{e(ghost['svg_defs'].strip())}</pre>

<h3>riso_halftone <span class="chip mech">css, not svg</span></h3>
<p>{e(pat['description'])}</p>
<pre>{e(pat['css'].strip())}</pre>
<p><strong>Required container:</strong> <code>{e(pat['required_container'])}</code> — rotating without
the oversize inset leaves visible wedges at the strip corners.</p>
<div class="specimen riso" data-riso>
  <div class="mini">
    <div style="margin-bottom:8px">{tag("halftone · ink-1 · 14px", 1, True)}</div>
    {halftone(14, 1)}
    <div style="margin:14px 0 8px">{tag("halftone · ink-2 · 22px", 2, True)}</div>
    {halftone(22, 2)}
  </div>
  <div class="grain"></div>
</div>

<h3>riso_grain</h3>
<p>{e(grain['description'].strip())}</p>
<pre>{e(grain['svg_defs'].strip())}</pre>
"""


def sec_components(spec: dict[str, Any]) -> str:
    """Build the component contract section."""
    blocks = []
    for cid, c in spec["components"].items():
        if cid == "list_item":
            continue
        specs = "".join(
            f"<dt>{e(k)}</dt><dd><code>{e(v)}</code></dd>" for k, v in (c.get("specs") or {}).items()
        )
        dos = "".join(f"<li>{e(d)}</li>" for d in c.get("dos") or [])
        donts = "".join(f"<li>{e(d)}</li>" for d in c.get("donts") or [])
        parts = " · ".join(c.get("parts") or [])
        blocks.append(f"""
<div class="cmp">
  <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
    <span class="nm">{e(cid)}</span>
    <span class="tier">{e(c.get('tier', ''))}</span>
    <span class="tier" style="margin-left:auto">{e(parts)}</span>
  </div>
  <div class="contract">{e(c['contract'].strip())}</div>
  <dl class="dl">{specs}</dl>
  <ul class="dos">{dos}</ul>
  <ul class="donts">{donts}</ul>
</div>""")

    li = spec["components"]["list_item"]
    variants = "".join(
        f'<tr><td class="k">{e(v["id"])}</td><td class="k">{e(v.get("svg", "—"))}</td>'
        f'<td class="k">{e(", ".join(v.get("applies_filters") or []))}</td>'
        f'<td>{e(v["rendering_notes"].strip())}</td></tr>'
        for v in li["variants"]
    )
    anatomy = "".join(
        f'<tr><td class="k">{e(p["id"])}</td><td class="k">{e(p["position"])}</td>'
        f'<td class="k">{e(p.get("fixed_width", "—"))}</td>'
        f'<td class="k">{e(", ".join(p.get("yields_to") or []) or "—")}</td>'
        f'<td class="k">{"optional" if p.get("optional") else "required"}</td></tr>'
        for p in li["anatomy"]
    )
    constraints = "".join(f"<li>{e(c)}</li>" for c in li["constraints"])
    return f"""
<h2>Components</h2>
<p>Primitives carry a behavioral contract, exact values, and do/don't rules. Anything reading a color
directly instead of a CSS variable is a bug — the press must be able to re-press it.</p>
{''.join(blocks)}

<h3>list_item <span class="tier">composite · authored SVG</span></h3>
<div class="scroll"><table>
  <thead><tr><th>part</th><th>position</th><th>width</th><th>yields to</th><th></th></tr></thead>
  <tbody>{anatomy}</tbody>
</table></div>
<div class="scroll"><table>
  <thead><tr><th>variant</th><th>svg</th><th>filters</th><th>rendering notes</th></tr></thead>
  <tbody>{variants}</tbody>
</table></div>
<ul class="donts">{constraints}</ul>
"""


def sec_patterns(spec: dict[str, Any]) -> str:
    """Build the composition-pattern section."""
    blocks = []
    for _, p in spec["patterns"].items():
        rows = "".join(
            f'<tr><td class="k">{e(k)}</td><td>{e(v)}</td></tr>' for k, v in p["rules"].items()
        )
        blocks.append(
            f'<h4>{e(p["name"])}</h4><div class="scroll"><table><tbody>{rows}</tbody></table></div>'
        )
    return f"""
<h2>Patterns</h2>
{''.join(blocks)}
"""


def _pane(kind: str, label: str, inner: str, note: str, grain: bool = True) -> str:
    """Wrap specimen markup in a labelled compliant/violating pane.

    Args:
        kind: "ok" or "no".
        label: Pane heading text.
        inner: Specimen HTML, rendered inside a live Riso surface.
        note: Explanatory caption.
        grain: Whether to paint the artifact grain layer.

    Returns:
        HTML string.
    """
    g = '<div class="grain"></div>' if grain else ""
    return (
        f'<div class="pane {kind}"><div class="lbl">{e(label)}</div>'
        f'<div class="riso" data-riso style="position:relative">'
        f'<div class="mini">{inner}</div>{g}</div>'
        f'<div class="note">{e(note)}</div></div>'
    )


def build_pairs() -> dict[str, str]:
    """Build the paired compliant/violating specimens, keyed by rulebook id.

    Contrast teaches negative constraints far better than prose does: each pair
    renders the tempting-but-wrong version beside the correct one, in the same
    live press state.

    Returns:
        Mapping of rule id to a rendered ``.pair`` block.
    """
    pairs: dict[str, str] = {}

    # ── no shadows ──
    ok = (
        f'<div style="border:1px solid var(--riso-text);padding:14px 16px">'
        f'{tag("Issue №04", 2)}<div style="margin-top:4px">{duo("Tokyo Trip", 24)}</div></div>'
    )
    no = (
        f'<div style="background:var(--riso-paper);padding:14px 16px;border-radius:6px;'
        f'box-shadow:0 8px 24px rgba(0,0,0,0.35)">'
        f'{tag("Issue №04", 2)}<div style="margin-top:4px;font-size:24px;font-weight:700;'
        f'letter-spacing:-0.03em">Tokyo Trip</div></div>'
    )
    pairs["riso-no-shadows"] = (
        '<div class="pair">'
        + _pane("ok", "Ink layering", ok, "A hairline rule and the duotone ghost. Depth is ink order.")
        + _pane("no", "Cast light", no, "Box-shadow and a 6px radius. This is a screen-light vocabulary "
                                        "pasted onto a print system — and the radius breaks the 0-radius rule too.")
        + "</div>"
    )

    # ── duotone display-only ──
    ok = (
        f'<div>{duo("Tokyo Trip", 30)}</div>'
        f'<div style="font-size:11px;opacity:0.65;margin-top:8px">'
        f'Want me to build a day-by-day itinerary?</div>'
    )
    no = (
        f'<div>{duo("Tokyo Trip", 30)}</div>'
        f'<div style="margin-top:8px">{duo("Want me to build a day-by-day itinerary?", 11, 400, "0")}</div>'
    )
    pairs["riso-duotone-display-only"] = (
        '<div class="pair">'
        + _pane("ok", "Ghost on display type only", ok,
                "Masthead carries the ghost; the 11px preview renders plain in the paper's text ink.")
        + _pane("no", "Ghost on 11px preview", no,
                "The 2px offset is larger than the letterforms' stroke gaps, so it reads as a printing "
                "fault rather than registration. Below 16px, duotone is just blur.")
        + "</div>"
    )

    # ── selection is a text treatment ──
    li_ok = (
        f'<div class="li sel" style="border-top:1px solid var(--riso-text)">'
        f'<div class="row">{tag("№01 · 2m", 1, True)}<span class="unread">2</span></div>'
        f'<div class="nm">{duo("Tokyo Trip", 14, 700, "-0.01em")}</div>'
        f'<div class="pv">Want me to build a day-by-day itinerary?</div></div>'
        f'<div class="li"><div class="row">{tag("№02 · 1h", 1, True)}</div>'
        f'<div class="nm">Recipe Ideas</div><div class="pv">Here are 5 ramen variations…</div></div>'
    )
    li_no = (
        f'<div class="li" style="background:var(--riso-ink-1);border-top:1px solid var(--riso-text)">'
        f'<div class="row"><span class="tag" style="color:var(--riso-paper);mix-blend-mode:normal;opacity:1">№01 · 2M</span></div>'
        f'<div class="nm" style="color:var(--riso-paper)">Tokyo Trip</div>'
        f'<div class="pv" style="color:var(--riso-paper);opacity:0.8">Want me to build a day-by-day itinerary?</div></div>'
        f'<div class="li"><div class="row">{tag("№02 · 1h", 1, True)}</div>'
        f'<div class="nm">Recipe Ideas</div><div class="pv">Here are 5 ramen variations…</div></div>'
    )
    pairs["riso-selection-is-text-treatment"] = (
        '<div class="pair">'
        + _pane("ok", "Density + ghost", li_ok,
                "Selection = the title gains its ghost layer, plus a rgba(0,0,0,0.03) paper darkening.")
        + _pane("no", "Solid ink fill", li_no,
                "A solid ink-1 block spends an entire drum on a hover-weight state change, and forces "
                "paper-colored knockout text that no other row uses.")
        + "</div>"
    )

    # ── halftone is a gradient, not noise ──
    ok = f'<div style="margin-bottom:8px">{tag("radial-gradient dots", 1, True)}</div>{halftone(26, 1)}'
    no = (
        f'<div style="margin-bottom:8px">{tag("feTurbulence", 1, True)}</div>'
        f'<div style="height:26px;background-image:var(--riso-grain-url);background-size:44px 44px;'
        f'opacity:0.9;mix-blend-mode:var(--riso-blend);filter:contrast(2.2)"></div>'
    )
    pairs["riso-halftone-is-gradient"] = (
        '<div class="pair">'
        + _pane("ok", "Dots", ok, "A rotated radial-gradient field. Dot pitch, angle, and softness are all "
                                  "driven by the press variables, so it re-presses with everything else.")
        + _pane("no", "Noise", no, "Turbulence at any frequency produces a stochastic field, never a screen. "
                                   "It also cannot respond to dot-size or angle — the controls go dead.")
        + "</div>"
    )

    # ── ink-2 is not body copy ──
    ok = (
        f'<div style="font-size:14px;line-height:1.55">Absolutely. Tokyo is incredible. Are you looking '
        f'for a culture-focused trip, a food adventure, or a mix of everything?</div>'
    )
    no = (
        f'<div style="font-size:14px;line-height:1.55;color:var(--riso-ink-2)">Absolutely. Tokyo is '
        f'incredible. Are you looking for a culture-focused trip, a food adventure, or a mix of everything?</div>'
    )
    pairs["riso-ink2-not-body"] = (
        '<div class="pair">'
        + _pane("ok", "Body in paper text ink", ok,
                "9.6:1 on cream. The inks carry structure and accent; the paper's own text ink carries reading.")
        + _pane("no", "Body in ink-2", no,
                "3.4:1 on cream — below the 4.5:1 floor for body text, and grain removes roughly another 12%.")
        + "</div>"
    )

    # ── metadata is InkTag ──
    ok = f'<div class="row" style="display:flex;gap:10px">{tag("№04 · Filed 14:23", 2)}{tag("● Active", 1)}</div>'
    no = (
        '<div style="display:flex;gap:10px;font-size:12px;font-weight:500">'
        '<span>No. 04 · Filed 14:23</span><span style="opacity:0.6">● Active</span></div>'
    )
    pairs["riso-metadata-is-inktag"] = (
        '<div class="pair">'
        + _pane("ok", "InkTag", ok,
                "JetBrains Mono, 9px, uppercase, 0.16em tracking, in ink — the colophon layer.")
        + _pane("no", "Grotesk metadata", no,
                "Same content in the content face. It stops reading as apparatus and starts competing "
                "with the headline; the printed-catalog rhythm disappears.")
        + "</div>"
    )

    # ── grain once, at the root ──
    ok_inner = (
        f'<div style="display:flex;gap:10px">'
        f'<div style="flex:1;border:1px solid var(--riso-text);padding:10px">{tag("Panel A", 1, True)}</div>'
        f'<div style="flex:1;border:1px solid var(--riso-text);padding:10px">{tag("Panel B", 1, True)}</div></div>'
    )
    no_inner = (
        f'<div style="display:flex;gap:10px">'
        f'<div style="flex:1;border:1px solid var(--riso-text);padding:10px;position:relative;overflow:hidden">'
        f'{tag("Panel A", 1, True)}<span class="grain" style="opacity:0.6"></span></div>'
        f'<div style="flex:1;border:1px solid var(--riso-text);padding:10px;position:relative;overflow:hidden">'
        f'{tag("Panel B", 1, True)}<span class="grain" style="opacity:0.6;background-position:12px 30px"></span></div></div>'
    )
    pairs["riso-grain-once-at-root"] = (
        '<div class="pair">'
        + _pane("ok", "One field, at the root", ok_inner,
                "A single continuous noise field over the composed artifact. The panels belong to one print.")
        + _pane("no", "Grain per component", no_inner,
                "Each panel carries its own layer, so the noise restarts at every boundary and doubles "
                "wherever components overlap. The seams are the tell.", grain=False)
        + "</div>"
    )
    return pairs


def sec_rulebook(spec: dict[str, Any]) -> str:
    """Build the rulebook, interleaving paired specimens where one exists."""
    pairs = build_pairs()
    blocks = []
    for r in spec["rulebook"]:
        sev = r.get("severity", "advisory")
        method = r.get("check_method", "")
        chips = [f'<span class="chip {"req" if sev == "required" else "rec"}">{e(sev)}</span>']
        if method:
            chips.append(f'<span class="chip {"mech" if method == "mechanical" else "sem"}">{e(method)}</span>')
        if r.get("check_scope"):
            chips.append(f'<span class="chip">{e(r["check_scope"])}</span>')
        impl = ""
        if r.get("check_implementation"):
            impl = f'<pre>{e(r["check_implementation"].strip())}</pre>'
        blocks.append(f"""
<div class="rule" id="{e(r['id'])}">
  <div class="hd"><span class="rid">{e(r['id'])}</span>{''.join(chips)}</div>
  <div class="stmt">{e(r['rule'])}</div>
  <div class="why"><b>Why</b> — {e(r['rationale'])}</div>
  {impl}
</div>""")
        if r["id"] in pairs:
            blocks.append(pairs[r["id"]])

    return f"""
<h2>Rulebook</h2>
<p>The highest-value section for anyone generating Riso. Most entries are negative constraints — the
choices that look reasonable in any other system and are wrong in this one. Where a rule is visually
demonstrable, the compliant and violating versions are rendered side by side in the current press state.</p>
{''.join(blocks)}
"""


def sec_voice(spec: dict[str, Any]) -> str:
    """Build the voice, vocabulary, state-text, and symbol sections."""
    v = spec["voice"]
    renames = "".join(
        f'<tr><td class="k">{e(k)}</td><td><strong>{e(val)}</strong></td></tr>'
        for k, val in v["vocabulary"]["renames"].items()
    )
    states = "".join(
        f'<tr><td class="k">{e(s["state"])}</td><td><strong>{e(s["copy"])}</strong></td>'
        f'<td class="k">{e(s["face"])}</td></tr>'
        for s in v["state_text"]
    )
    syms = "".join(
        f'<div class="sw"><div class="meta"><div class="nm" style="font-size:20px">{e(s["symbol"])}</div>'
        f'<div class="hx">{e(s["use"])}</div></div></div>'
        for s in v["symbols"]
    )
    conventions = "".join(f"<li>{e(c)}</li>" for c in v["conventions"])
    return f"""
<h2>Voice &amp; tone</h2>
<p>{e(v['premise'].strip())}</p>

<div class="scroll"><table>
  <thead><tr><th></th><th>vocabulary</th></tr></thead>
  <tbody>
    <tr><td class="k">use</td><td>{e(', '.join(v['vocabulary']['use']))}</td></tr>
    <tr><td class="k">avoid</td><td>{e(', '.join(v['vocabulary']['avoid']))}</td></tr>
  </tbody>
</table></div>

<h4>Renames</h4>
<div class="scroll"><table><tbody>{renames}</tbody></table></div>

<h4>State text</h4>
<div class="scroll"><table>
  <thead><tr><th>state</th><th>copy</th><th>face</th></tr></thead>
  <tbody>{states}</tbody>
</table></div>

<h4>Conventions</h4>
<ul class="dos">{conventions}</ul>

<h4>Symbol vocabulary</h4>
<div class="swatches">{syms}</div>
"""


def sec_accessibility(spec: dict[str, Any]) -> str:
    """Build the contrast table and accessibility requirements."""
    a = spec["accessibility"]
    rows = "".join(
        f'<tr><td>{e(c["pair"])}</td><td class="k">{e(c["ratio"])}</td>'
        f'<td class="k" style="color:{"#34D399" if "AAA" in str(c["level"]) else "#FBBF24"}">{e(c["level"])}</td></tr>'
        for c in a["contrast"]
    )
    reqs = "".join(f"<li>{e(r)}</li>" for r in a["requirements"])
    return f"""
<h2>Accessibility</h2>
<p>Measured at the default press state (cream + classic). Every other preset pair must be re-measured —
ink density varies from 0.78 to 0.98 across the stocks.</p>
<div class="scroll"><table>
  <thead><tr><th>pair</th><th>ratio</th><th>level</th></tr></thead>
  <tbody>{rows}</tbody>
</table></div>
<ul class="donts">{reqs}</ul>
"""


def sec_duotone_demo() -> str:
    """Build a live duotone specimen driven by the real feColorMatrix filters.

    A grayscale luminance ramp is a better demonstration subject than a
    photograph: it makes the shadows-to-ink / highlights-to-paper mapping
    literally readable, and it keeps the export free of binary assets.

    Returns:
        HTML string.
    """
    return """
<h4>The duotone stack, live</h4>
<p>A grayscale luminance ramp pushed through the real filters. The primary layer maps shadows to ink-1
and highlights to the paper; the ghost layer prints flat ink-2 with <code>alpha = 1 − luminance</code>,
offset by the registration variables. Change the press above and the matrices change with it.</p>
<p><strong>Note the clip.</strong> The ghost filter reads alpha from luminance alone, so transparent
pixels resolve to solid ink-2 — including the empty margin of the default filter region. The ghost
layer is only safe over a fully opaque source inside an <code>overflow: hidden</code> container.
<code>RisoImage</code> satisfies both; this specimen clips to match.</p>
<div class="specimen riso" data-riso>
  <div class="mini">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
      <div>
        <div style="margin-bottom:6px"><span class="tag sm">01 · source</span></div>
        <svg viewBox="0 0 200 90" width="100%" height="90" role="img" aria-label="Grayscale luminance ramp">
          <defs><linearGradient id="ramp"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>
          <rect width="200" height="90" fill="url(#ramp)"/>
        </svg>
      </div>
      <div>
        <div style="margin-bottom:6px"><span class="tag sm">02 · primary duotone</span></div>
        <svg viewBox="0 0 200 90" width="100%" height="90" role="img" aria-label="Ramp through the primary duotone filter">
          <rect width="200" height="90" fill="url(#ramp)" data-duo-primary/>
        </svg>
      </div>
      <div>
        <div style="margin-bottom:6px"><span class="tag sm">03 · + offset ghost</span></div>
        <svg viewBox="0 0 200 90" width="100%" height="90" role="img" aria-label="Ramp with the ghost ink layer stacked and offset">
          <defs><clipPath id="ramp-clip"><rect width="200" height="90"/></clipPath></defs>
          <g clip-path="url(#ramp-clip)">
            <rect width="200" height="90" fill="url(#ramp)" data-duo-primary/>
            <g style="mix-blend-mode:multiply;transform:translate(var(--riso-off-x),var(--riso-off-y))">
              <rect width="200" height="90" fill="url(#ramp)" data-duo-ghost/>
            </g>
          </g>
        </svg>
      </div>
    </div>
  </div>
  <div class="grain"></div>
</div>
"""


PAGE_JS = """
(function () {
  var root = document.body;
  function apply(kind, value) {
    root.setAttribute('data-' + kind, value);
    var buttons = document.querySelectorAll('.press button[data-set="' + kind + '"]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-pressed', String(buttons[i].dataset.val === value));
    }
    retarget();
  }
  // Filter ids encode the resolved matrix for a (paper, ink) pair, so switching
  // presets is a matter of repointing, never recomputing.
  function retarget() {
    var paper = root.getAttribute('data-paper');
    var ink = root.getAttribute('data-ink');
    var primary = document.querySelectorAll('[data-duo-primary]');
    for (var i = 0; i < primary.length; i++) {
      primary[i].style.filter = 'url(#riso-duo-primary--' + paper + '--' + ink + ')';
    }
    var ghost = document.querySelectorAll('[data-duo-ghost]');
    for (var j = 0; j < ghost.length; j++) {
      ghost[j].style.filter = 'url(#riso-duo-ghost--' + ink + ')';
    }
  }
  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest ? ev.target.closest('.press button') : null;
    if (!btn) return;
    apply(btn.dataset.set, btn.dataset.val);
  });
  retarget();
})();
"""


def build_page(spec: dict[str, Any]) -> str:
    """Assemble the complete standalone HTML document.

    Args:
        spec: Parsed spec mapping.

    Returns:
        The full HTML document as a string.
    """
    s = spec["system"]
    spec_json = json.dumps(spec, indent=2, ensure_ascii=False, sort_keys=False)
    default_paper = state_default(spec, "active_paper")
    default_ink = state_default(spec, "active_ink")

    body = "\n".join([
        sec_header(spec),
        sec_specimen(spec),
        sec_layers(spec),
        sec_presets(spec),
        sec_type(spec),
        sec_filters(spec),
        sec_duotone_demo(),
        sec_components(spec),
        sec_patterns(spec),
        sec_rulebook(spec),
        sec_voice(spec),
        sec_accessibility(spec),
    ])

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(s['name'])} — Design System Reference</title>
<meta name="description" content="{e(s['tagline'])} — machine-readable spec plus live specimens.">
<meta name="generator" content="tools/builders/build_riso_reference.py">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
{PAGE_CSS}
{build_press_css(spec)}
</style>
</head>
<body data-paper="{e(default_paper)}" data-ink="{e(default_ink)}">

<!-- ══════════════════════════════════════════════════════════════════
     MACHINE PAYLOAD — the complete spec, first element in the body.
     Agents: parse this block. Everything below is the same data
     rendered for eyes.
     ══════════════════════════════════════════════════════════════════ -->
<script type="application/json" id="riso-spec">
{spec_json}
</script>

{build_filter_defs(spec)}

{sec_press_controls(spec)}

<div class="wrap">
{body}

<footer>
  Generated from <code>systems/riso/spec.yaml</code> (spec {e(spec['spec_version'])},
  system v{e(s['version'])}) by <code>tools/builders/build_riso_reference.py</code>.
  Regenerate after any spec change — do not hand-edit this file.
</footer>
</div>

<script>
{PAGE_JS}
</script>
</body>
</html>
"""


def main() -> int:
    """Read the spec and write the reference export.

    Returns:
        Process exit code.
    """
    parser = argparse.ArgumentParser(description="Build the Riso single-file reference export.")
    parser.add_argument("--spec", type=Path, default=SPEC_PATH, help="Path to spec.yaml")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Output HTML path")
    args = parser.parse_args()

    if not args.spec.exists():
        logger.error("spec_missing", path=str(args.spec))
        return 1

    # Token values live in systems/riso/tokens.json (schema v0.3); resolve
    # aliases and palette token references before rendering.
    loaded = read_spec_with_tokens(args.spec)
    if not loaded.ok:
        for err in loaded.errors:
            logger.error("spec_load_failed", code=err.code, message=err.message)
        return 1
    for warn in loaded.warnings:
        logger.warning("spec_token_warning", message=warn.message)
    spec = loaded.data
    logger.info(
        "spec_loaded",
        system=spec["system"]["id"],
        version=spec["system"]["version"],
        rules=len(spec.get("rulebook", [])),
        components=len(spec.get("components", {})),
    )

    html = build_page(spec)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(html)
    logger.info("reference_written", path=str(args.out), bytes=len(html.encode("utf-8")))

    print(f"Wrote {args.out} ({len(html.encode('utf-8')) / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
