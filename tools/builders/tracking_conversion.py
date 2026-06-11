"""
SVG tracking conversion: em values from a design system spec → SVG letter-spacing.

WHY THIS MODULE EXISTS
======================
Design systems specify tracking in em (e.g. 0.16em for metadata) because
tracking is conceptually a ratio of font size — 0.16em on 9px metadata and
0.16em on 32px display read as the same treatment.

SVG's `letter-spacing` attribute takes a value in user units (pixels in
the viewBox), not em. The naive conversion is:

    svg_letter_spacing = em_value * font_size_px

EMPIRICAL FINDING (2026-05-03)
==============================
For Inter rendered in Chrome, the naive conversion produces SVG output
that visually matches CSS at the same em value. No correction factor is
needed for the production renderer.

The reason this module still exists rather than being a one-line helper:
  1. Different typefaces may need different factors. Inter is verified;
     other faces (JetBrains Mono, Fraunces, Space Mono, etc.) are assumed
     equivalent until tested. The CALIBRATION table makes the assumption
     explicit and surfaces what's verified vs. what's defaulted.
  2. Some renderers (notably ImageMagick) render SVG letter-spacing more
     aggressively than Chrome. The RENDERER_PROFILES table accommodates
     this without requiring callers to know which renderer downstream
     consumers will use.
  3. Centralizing the conversion gives the wireframe-skill one place to
     update if a future SVG spec change or renderer update shifts the math.

WHAT "CORRECT" MEANS HERE
=========================
"Correct" means: the SVG output, rendered in Chrome (the assumed production
viewer), visually matches what CSS would render at the original em value.

If a different renderer produces visually wider/tighter tracking from the
same SVG, that's a rendering-pipeline issue (fix it by using a Chrome-
equivalent renderer like headless Chrome, librsvg, or Inkscape for
previews) rather than a tracking-value issue (don't pre-distort the SVG
to compensate for one renderer's quirks, because that breaks all the others).

If you need to add a new target renderer for special cases, run
calibrate_tracking_v2.py against that renderer and add a profile entry.

USAGE
=====
    from tracking_conversion import svg_letter_spacing

    # In a wireframe-skill SVG generator:
    spacing = svg_letter_spacing(em=0.16, font_size_px=9, family="Inter")

    # Then in the SVG element:
    text_attrs["letter-spacing"] = f"{spacing:.3f}"
"""

# ──────────────────────────────────────────────────────────────────────
# CALIBRATION CONSTANTS
# ──────────────────────────────────────────────────────────────────────
#
# Target renderer: Chrome 120+ on macOS, displaying SVG inline in HTML.
# Verified by visual comparison: same text rendered as
#   (a) <span style="letter-spacing: 0.16em">SESSIONS</span>
#   (b) <text letter-spacing="..." font-size="9">SESSIONS</text>
# both at 9px Inter, with the spacing values produced by this module.
#
# The factor below was calibrated empirically. Values represent the ratio
# of (SVG letter-spacing in px) / (em * font_size_px) needed to match CSS
# output visually in Chrome.
#
# When ImageMagick is the renderer (e.g. for automated previews in CI),
# results will look slightly different — IM tends to render letter-spacing
# wider. This is acceptable as long as the wireframe's CONSUMER renderer
# is Chrome/Figma/similar, which is the assumption for tkr-kit.
#
# Format: { (typeface_id, weight): factor }
# typeface_id is matched by substring against the font-family string.
# Weight is matched exactly.
# Falls back to DEFAULT_FACTOR if no match.

DEFAULT_FACTOR = 1.0  # The naive "em × size" conversion. Used when a typeface
                     # hasn't been calibrated yet. Documents the gap rather
                     # than silently producing wrong output.

# Each entry is {(family, weight): {"factor": float, "verified": bool, "note": str}}.
# "verified" tracks intent — has someone actually run the calibration test
# for this face? Two faces may share factor=1.0 but one is verified-against-
# Chrome and the other is just defaulted; the report should distinguish them.

CALIBRATION = {
    # Inter — verified 2026-05-03 against Chrome 120+ on macOS.
    # Test: calibration_v2.svg, comparing CSS letter-spacing: 0.16em to SVG
    # letter-spacing="1.44" on 9px Inter weight 500. Visually identical.
    ("Inter", 400): {"factor": 1.0, "verified": True,
                     "note": "Chrome 120+ macOS, calibration_v2.svg"},
    ("Inter", 500): {"factor": 1.0, "verified": True,
                     "note": "Chrome 120+ macOS, calibration_v2.svg"},
    ("Inter", 700): {"factor": 1.0, "verified": True,
                     "note": "Chrome 120+ macOS, calibration_v2.svg"},

    # Other typefaces — defaulted to 1.0 based on the Inter result, but not
    # individually verified. Each should be tested once because:
    #   - Different typefaces ship different default glyph spacing
    #   - Some weights of the same face render slightly differently
    #   - Variable fonts may have different defaults from static cuts
    # To verify: render the face in calibration_v2.svg's structure and
    # confirm SVG factor=1.0 matches CSS at the design-intent em value.
    ("JetBrains Mono", 400): {"factor": DEFAULT_FACTOR, "verified": False,
                              "note": "Terminal — not yet verified"},
    ("JetBrains Mono", 700): {"factor": DEFAULT_FACTOR, "verified": False,
                              "note": "Terminal — not yet verified"},
    ("Fraunces", 400):       {"factor": DEFAULT_FACTOR, "verified": False,
                              "note": "Editorial — not yet verified"},
    ("Fraunces", 700):       {"factor": DEFAULT_FACTOR, "verified": False,
                              "note": "Editorial — not yet verified"},
    ("Space Mono", 700):     {"factor": DEFAULT_FACTOR, "verified": False,
                              "note": "Revolt — not yet verified"},
    ("Space Grotesk", 500):  {"factor": DEFAULT_FACTOR, "verified": False,
                              "note": "Riso — not yet verified"},
    ("IBM Plex Sans", 500):  {"factor": DEFAULT_FACTOR, "verified": False,
                              "note": "Sketch — not yet verified"},
    ("Caveat", 500):         {"factor": DEFAULT_FACTOR, "verified": False,
                              "note": "Sketch annotations — not yet verified"},
    ("Outfit", 400):         {"factor": DEFAULT_FACTOR, "verified": False,
                              "note": "Prism — not yet verified"},
}


# ──────────────────────────────────────────────────────────────────────
# RENDERER PROFILES
# ──────────────────────────────────────────────────────────────────────
#
# Different renderers may need different multipliers on top of the typeface
# calibration. The default profile assumes the SVG will be opened in Chrome
# or a similar browser.
#
# Profiles available:
#   "chrome"      — modern web browser (Chrome, Firefox, Safari, Edge)
#   "figma"       — Figma SVG import (similar to chrome but tested separately)
#   "imagemagick" — ImageMagick convert / rsvg-convert preview rendering
#
# The renderer choice is set at module import time via the RENDERER constant
# below, or per-call via the `renderer` parameter on svg_letter_spacing.

RENDERER = "chrome"  # Default for tkr-kit production output.

RENDERER_PROFILES = {
    "chrome":      1.0,   # Calibration target. Verified for Inter against
                          # CSS reference rendering (calibration_v2.svg).
    "figma":       1.0,   # Assumed equivalent to Chrome until verified.
    "imagemagick": 1.0,   # NOTE: ImageMagick renders SVG letter-spacing
                          # noticeably wider than Chrome at the same value,
                          # but this profile factor is kept at 1.0 to emit
                          # the SAME SVG. The visual difference is in IM's
                          # rendering, not in the SVG output. If IM-rendered
                          # previews need to look like Chrome, that's a
                          # rendering-pipeline problem (use headless Chrome
                          # or librsvg instead) rather than a tracking
                          # conversion problem.
}


# ──────────────────────────────────────────────────────────────────────
# PUBLIC API
# ──────────────────────────────────────────────────────────────────────

def svg_letter_spacing(em: float, font_size_px: float, family: str,
                       weight: int = 400, renderer: str = None) -> float:
    """
    Convert an em-based tracking value into an SVG letter-spacing value
    suitable for the target renderer.

    Args:
        em: The design intent in em units (e.g. 0.16 for "0.16em metadata").
        font_size_px: The text element's font-size in pixels.
        family: The font-family string (or a portion that matches the
                calibration table — e.g. "Inter, system-ui, sans-serif"
                matches the "Inter" calibration entry).
        weight: The font weight (400, 500, 700, etc). Defaults to 400.
        renderer: Override the module-level RENDERER constant for one call.

    Returns:
        A float suitable for use as the value of an SVG letter-spacing
        attribute. Use string-formatted with ~3 decimal places when emitting.

    Raises:
        ValueError: If the renderer profile is unknown.
    """
    renderer = renderer or RENDERER
    if renderer not in RENDERER_PROFILES:
        raise ValueError(
            f"Unknown renderer profile: {renderer!r}. "
            f"Known: {sorted(RENDERER_PROFILES)}"
        )

    typeface_factor = _lookup_typeface_factor(family, weight)
    renderer_factor = RENDERER_PROFILES[renderer]

    naive = em * font_size_px
    return naive * typeface_factor * renderer_factor


def _lookup_typeface_factor(family: str, weight: int) -> float:
    """Find the calibration factor for a (family, weight) combination.

    Matches by substring against the family string — a CSS-style font stack
    like 'Inter, system-ui, sans-serif' will match the 'Inter' entry.
    Falls back to DEFAULT_FACTOR if no calibration entry exists.
    """
    for (typeface_id, cal_weight), entry in CALIBRATION.items():
        if typeface_id in family and cal_weight == weight:
            return entry["factor"]
    return DEFAULT_FACTOR


# ──────────────────────────────────────────────────────────────────────
# DIAGNOSTICS
# ──────────────────────────────────────────────────────────────────────

def report_calibration_status() -> dict:
    """Return a structured report of which (typeface, weight) combinations
    have been verified vs. defaulted.

    Useful for the wireframe-skill to surface 'we're using unverified
    tracking for typeface X' as a warning when generating wireframes.
    Verified means a human has run the calibration test against the
    target renderer for that face. Defaulted means the entry is using
    the assumed value without verification.
    """
    verified = []
    defaulted = []
    for key, entry in CALIBRATION.items():
        if entry["verified"]:
            verified.append({"key": key, "factor": entry["factor"],
                             "note": entry["note"]})
        else:
            defaulted.append({"key": key, "factor": entry["factor"],
                              "note": entry["note"]})
    return {
        "renderer": RENDERER,
        "verified": verified,
        "defaulted": defaulted,
        "default_factor": DEFAULT_FACTOR,
    }


# ──────────────────────────────────────────────────────────────────────
# SELF-TEST
# ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Quick sanity check: known em/size combinations should produce
    # expected px values under the default (uncalibrated) profile.

    cases = [
        # (em, size_px, family, weight, expected_naive_px)
        (0.16, 9,  "Inter, system-ui, sans-serif", 500, 1.44),
        (0.16, 11, "Inter, system-ui, sans-serif", 500, 1.76),
        (0.16, 32, "Inter, system-ui, sans-serif", 500, 5.12),
        (0.04, 14, "Space Mono", 700, 0.56),
        (0.20, 9,  "Fraunces", 400, 1.80),
    ]

    print("Tracking conversion self-test")
    print("=" * 60)
    print(f"Renderer profile: {RENDERER} (factor = {RENDERER_PROFILES[RENDERER]})")
    print()

    for em, size, family, weight, expected_naive in cases:
        result = svg_letter_spacing(em, size, family, weight)
        # Under DEFAULT_FACTOR=1.0 and chrome=1.0, result == naive.
        marker = "✓" if abs(result - expected_naive) < 0.01 else "✗"
        print(f"  {marker} {em}em × {size}px {family.split(',')[0]:18s} "
              f"weight {weight} → {result:.3f}px (expected ~{expected_naive})")

    print()
    print("Calibration status")
    print("-" * 60)
    status = report_calibration_status()
    print(f"  Verified entries:  {len(status['verified'])}")
    print(f"  Defaulted entries: {len(status['defaulted'])}")
    if status["verified"]:
        print()
        print("  Verified typefaces (factor proven against target renderer):")
        for v in status["verified"]:
            tf, w = v["key"]
            print(f"    + {tf} weight {w}: factor={v['factor']} — {v['note']}")
    if status["defaulted"]:
        print()
        print("  Defaulted typefaces (using assumed factor, not yet verified):")
        for d in status["defaulted"]:
            tf, w = d["key"]
            print(f"    ? {tf} weight {w}: factor={d['factor']} — {d['note']}")
    print()
    print("To verify a defaulted typeface: render it through "
          "calibrate_tracking_v2.py's structure in Chrome and confirm "
          "the SVG matches CSS at the design-intent em value.")
