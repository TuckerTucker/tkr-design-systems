#!/usr/bin/env python3
"""
Calibration test v2: cross-validates CSS rendering, then matches SVG to it.

The previous test had only one CSS reference row, which made it impossible
to tell whether the CSS was rendering correctly or whether the test was
broken. This version renders multiple CSS rows at known increasing em
values so the eye can verify the CSS layer behaves linearly. Then it
renders SVG variants for the eye to match against the target CSS row.

Layout:
  Top half: CSS reference rows at em = 0, 0.05, 0.10, 0.16, 0.25, 0.40
  Bottom half: SVG variants at factor = 1.0, 0.85, 0.70, 0.55, 0.40, 0.30,
                                  0.20, 0.15, 0.10
                applied to em=0.16 base intent on 9px Inter

Visual check sequence:
  1. Verify CSS rows show progressive widening from 0em to 0.40em.
     If they don't, the test itself is broken.
  2. Find the CSS row at em = 0.16 (the target).
  3. Find the SVG row whose rendering matches that target row.
  4. The factor of that SVG row is the calibration value.

Usage: python3 calibrate_tracking_v2.py
       Open calibration_v2.svg in Chrome.
"""

from pathlib import Path

REFERENCE_TEXT = "SESSIONS"
REFERENCE_FONT_SIZE = 9
REFERENCE_FAMILY = "Inter, system-ui, sans-serif"
TARGET_EM = 0.16

CSS_EM_VALUES = [0.00, 0.05, 0.10, 0.16, 0.25, 0.40]
SVG_FACTORS = [1.00, 0.85, 0.70, 0.55, 0.40, 0.30, 0.20, 0.15, 0.10]


def make_calibration_svg() -> str:
    label_x = 24
    text_x = 280
    spec_x = 620
    width = 880
    row_height = 56
    section_pad = 32

    # Section heights
    css_section_height = (len(CSS_EM_VALUES) + 1) * row_height
    svg_section_height = (len(SVG_FACTORS) + 1) * row_height
    height = css_section_height + svg_section_height + section_pad * 3

    rows = []

    # ── CSS section header ──────────────────────────────────────
    y = section_pad
    rows.append(f'''
    <text x="{label_x}" y="{y + 14}"
          font-family="{REFERENCE_FAMILY}" font-size="11" font-weight="700"
          fill="#000">CSS REFERENCE — verify these widen progressively</text>
    <line x1="{label_x}" y1="{y + 22}" x2="{width - 24}" y2="{y + 22}"
          stroke="#000" stroke-width="1"/>
    ''')

    # CSS rows
    for i, em in enumerate(CSS_EM_VALUES):
        y_row = section_pad + (i + 1) * row_height
        is_target = abs(em - TARGET_EM) < 0.001
        marker = "  ← TARGET" if is_target else ""
        label_color = "#E3000B" if is_target else "#000"

        rows.append(f'''
    <text x="{label_x}" y="{y_row + 28}"
          font-family="{REFERENCE_FAMILY}" font-size="11" font-weight="500"
          fill="{label_color}">CSS  letter-spacing: {em}em{marker}</text>
    <foreignObject x="{text_x}" y="{y_row}" width="320" height="{row_height}">
      <div xmlns="http://www.w3.org/1999/xhtml"
           style="font-family: {REFERENCE_FAMILY};
                  font-size: {REFERENCE_FONT_SIZE}px;
                  font-weight: 500;
                  letter-spacing: {em}em;
                  color: #666;
                  line-height: {row_height}px;">
        {REFERENCE_TEXT}
      </div>
    </foreignObject>
    <text x="{spec_x}" y="{y_row + 28}"
          font-family="{REFERENCE_FAMILY}" font-size="10" font-weight="400"
          fill="#999">computed: {em * REFERENCE_FONT_SIZE:.3f}px</text>
        ''')

    # ── SVG section header ──────────────────────────────────────
    y = section_pad * 2 + css_section_height
    rows.append(f'''
    <text x="{label_x}" y="{y + 14}"
          font-family="{REFERENCE_FAMILY}" font-size="11" font-weight="700"
          fill="#000">SVG VARIANTS — find the one that matches the TARGET row above</text>
    <line x1="{label_x}" y1="{y + 22}" x2="{width - 24}" y2="{y + 22}"
          stroke="#000" stroke-width="1"/>
    ''')

    # SVG rows
    for i, factor in enumerate(SVG_FACTORS):
        y_row = section_pad * 2 + css_section_height + (i + 1) * row_height
        svg_letter_spacing = TARGET_EM * REFERENCE_FONT_SIZE * factor

        rows.append(f'''
    <text x="{label_x}" y="{y_row + 28}"
          font-family="{REFERENCE_FAMILY}" font-size="11" font-weight="500"
          fill="#000">SVG  factor = {factor:.2f}</text>
    <text x="{text_x}" y="{y_row + 28}"
          font-family="{REFERENCE_FAMILY}" font-size="{REFERENCE_FONT_SIZE}"
          font-weight="500" fill="#666"
          letter-spacing="{svg_letter_spacing:.3f}">{REFERENCE_TEXT}</text>
    <text x="{spec_x}" y="{y_row + 28}"
          font-family="{REFERENCE_FAMILY}" font-size="10" font-weight="400"
          fill="#999">letter-spacing="{svg_letter_spacing:.3f}"</text>
        ''')

    return f'''<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 {width} {height}" width="{width}" height="{height}">
  <rect x="0" y="0" width="{width}" height="{height}" fill="#FFFFFF"/>
  {"".join(rows)}
</svg>
'''


if __name__ == "__main__":
    out = Path(__file__).parent / "calibration_v2.svg"
    out.write_text(make_calibration_svg())
    print(f"Wrote {out}")
    print()
    print("Open in Chrome.")
    print("Step 1: Confirm the CSS rows widen progressively from 0em to 0.40em.")
    print("        If they don't, the CSS isn't rendering — investigate before reading SVG rows.")
    print("Step 2: Find the SVG factor whose 'SESSIONS' visually matches the TARGET CSS row.")
