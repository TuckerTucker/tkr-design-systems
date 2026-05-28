#!/usr/bin/env python3
"""
Calibration test for SVG letter-spacing conversion.

Renders samples of the same text at multiple letter-spacing values to find
the SVG factor that produces visual tracking equivalent to a target em value
in CSS.

Output: a grid SVG showing a reference (CSS-rendered HTML for comparison)
plus a series of SVG renders at decreasing factors. The factor that visually
matches the CSS reference is the calibration value.

Usage: python3 calibrate_tracking.py
       Then convert calibration.svg to PNG and inspect.
"""

from pathlib import Path

# The reference: CSS letter-spacing of 0.16em on 9px Inter
# This is what we want our SVG output to match visually.
REFERENCE_EM = 0.16
REFERENCE_TEXT = "SESSIONS"
REFERENCE_FONT_SIZE = 9
REFERENCE_FAMILY = "Inter, system-ui, sans-serif"

# Candidate SVG factors to test.
# Naive factor is 1.0 (em * font_size, used as-is in SVG).
# We expect the right value to be smaller — somewhere between 0.3 and 0.7.
CANDIDATE_FACTORS = [1.0, 0.85, 0.70, 0.60, 0.55, 0.50, 0.45, 0.40, 0.30]


def make_calibration_svg() -> str:
    """Build a calibration SVG showing the reference HTML and SVG variants
    side-by-side at the same scale."""

    # Each row: factor label + SVG-rendered text + the computed letter-spacing value.
    # Plus one CSS reference row at the top using foreignObject.
    row_height = 60
    label_x = 20
    text_x = 240
    spec_x = 600
    width = 800
    height = (len(CANDIDATE_FACTORS) + 3) * row_height + 40

    rows = []

    # Header row
    rows.append(f'''
    <text x="{label_x}" y="32"
          font-family="{REFERENCE_FAMILY}" font-size="11" font-weight="700"
          fill="#000">FACTOR</text>
    <text x="{text_x}" y="32"
          font-family="{REFERENCE_FAMILY}" font-size="11" font-weight="700"
          fill="#000">RENDERED</text>
    <text x="{spec_x}" y="32"
          font-family="{REFERENCE_FAMILY}" font-size="11" font-weight="700"
          fill="#000">letter-spacing VALUE</text>
    <line x1="{label_x}" y1="42" x2="{width - 20}" y2="42"
          stroke="#000" stroke-width="1"/>
    ''')

    # CSS reference row (uses foreignObject so the browser renders HTML+CSS)
    css_letter_spacing = f"{REFERENCE_EM}em"
    rows.append(f'''
    <text x="{label_x}" y="{60 + 30}"
          font-family="{REFERENCE_FAMILY}" font-size="11" font-weight="500"
          fill="#000">CSS REFERENCE</text>
    <foreignObject x="{text_x}" y="{60}" width="350" height="50">
      <div xmlns="http://www.w3.org/1999/xhtml"
           style="font-family: {REFERENCE_FAMILY};
                  font-size: {REFERENCE_FONT_SIZE}px;
                  letter-spacing: {css_letter_spacing};
                  color: #666;
                  line-height: 50px;">
        {REFERENCE_TEXT}
      </div>
    </foreignObject>
    <text x="{spec_x}" y="{60 + 30}"
          font-family="{REFERENCE_FAMILY}" font-size="10" font-weight="400"
          fill="#666">{REFERENCE_EM}em (target)</text>
    ''')

    # SVG variant rows at each candidate factor
    for i, factor in enumerate(CANDIDATE_FACTORS):
        y = 60 + (i + 1) * row_height
        svg_letter_spacing = REFERENCE_EM * REFERENCE_FONT_SIZE * factor
        rows.append(f'''
    <text x="{label_x}" y="{y + 30}"
          font-family="{REFERENCE_FAMILY}" font-size="11" font-weight="500"
          fill="#000">factor = {factor}</text>
    <text x="{text_x}" y="{y + 30}"
          font-family="{REFERENCE_FAMILY}" font-size="{REFERENCE_FONT_SIZE}"
          font-weight="500" fill="#666"
          letter-spacing="{svg_letter_spacing:.3f}">{REFERENCE_TEXT}</text>
    <text x="{spec_x}" y="{y + 30}"
          font-family="{REFERENCE_FAMILY}" font-size="10" font-weight="400"
          fill="#666">{svg_letter_spacing:.3f}px</text>
        ''')

    return f'''<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 {width} {height}" width="{width}" height="{height}">
  <rect x="0" y="0" width="{width}" height="{height}" fill="#FFFFFF"/>
  {"".join(rows)}
</svg>
'''


if __name__ == "__main__":
    out = Path(__file__).parent / "calibration.svg"
    out.write_text(make_calibration_svg())
    print(f"Wrote {out}")
    print(f"Convert with: convert -background white -density 200 {out.name} calibration.png")
    print()
    print("Compare each row to the CSS REFERENCE row.")
    print("The factor that visually matches is the calibration value.")
