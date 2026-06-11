/**
 * Library panel view models — the panel-side projection of the wire
 * payloads served by /api/library/* (owned by studio-api in
 * @studio/contract; consumed read-only here).
 *
 * The token payload arrives as TokenSetResponse.tokens — the raw
 * wf_get_tokens authoring export (`Record<string, unknown>` on the wire).
 * parseTokenSet() is the boundary validator that projects it into typed
 * view models; sections render whatever exists and never fail whole on a
 * missing optional field (no mono stack, empty usage_constraint,
 * non-borders elevation strategy).
 */
import type { TokenSetResponse } from "@studio/contract";

export interface PaletteEntryView {
  /** e.g. "ink", "red". */
  name: string;
  /** Hex value, e.g. "#E3000B". */
  value: string;
  /** e.g. "the system's only accent". */
  role: string;
  /** May be empty. */
  usageConstraint: string;
}

export interface TypeScaleEntryView {
  px: number;
  /** e.g. "body", "display_small". */
  role: string;
}

export interface TypographyView {
  fontStackStructural: string;
  /** Empty when the system declares no mono stack. */
  fontStackMono: string;
  scale: TypeScaleEntryView[];
  /** e.g. { metadata: "uppercase" }. */
  caseRules: Record<string, string>;
  /** Letter-spacing in em, e.g. { metadata: 0.16 }. */
  tracking: Record<string, number>;
}

export interface DrawingRulesView {
  fillPageBg: string;
  fillSurface: string;
  fillSurfaceElevated: string;
  fillInteractive: string;
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  textInverse: string;
  radiusDefault: number;
  radiusInputs: number;
  radiusChrome: number;
  /** SVG attribute string ("stroke='#E0E0E0' stroke-width='1'"); only for borders_only systems. */
  strokeBorder: string | null;
  strokeBorderStrong: string | null;
  /** Rendered verbatim for non-borders elevation strategies. */
  elevationNote: string;
}

export interface LayoutTokensView {
  gridUnit: number;
  allowedSteps: number[];
  pageMarginMobile: number;
  pageMarginDesktop: number;
  componentGap: number;
  sectionGap: number;
}

export interface TokenBrowserView {
  systemId: string;
  palette: PaletteEntryView[];
  drawingRules: DrawingRulesView | null;
  typography: TypographyView | null;
  layout: LayoutTokensView | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function parsePalette(value: unknown): PaletteEntryView[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const entries: PaletteEntryView[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }
    const name = asString(entry["name"]);
    const hex = asString(entry["value"]);
    if (name === "" && hex === "") {
      continue;
    }
    entries.push({
      name,
      value: hex,
      role: asString(entry["role"]),
      usageConstraint: asString(entry["usage_constraint"]),
    });
  }
  return entries;
}

function parseStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }
  const record: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      record[key] = entry;
    }
  }
  return record;
}

function parseNumberRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    return {};
  }
  const record: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "number" && Number.isFinite(entry)) {
      record[key] = entry;
    }
  }
  return record;
}

function parseTypography(value: unknown): TypographyView | null {
  if (!isRecord(value)) {
    return null;
  }
  const scaleRaw = value["scale"];
  const scale: TypeScaleEntryView[] = [];
  if (Array.isArray(scaleRaw)) {
    for (const entry of scaleRaw) {
      if (isRecord(entry) && typeof entry["px"] === "number") {
        scale.push({ px: entry["px"], role: asString(entry["role"]) });
      }
    }
  }
  return {
    fontStackStructural: asString(value["font_stack_structural"]),
    fontStackMono: asString(value["font_stack_mono"]),
    scale,
    caseRules: parseStringRecord(value["case_rules"]),
    tracking: parseNumberRecord(value["tracking"]),
  };
}

function parseDrawingRules(value: unknown): DrawingRulesView | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    fillPageBg: asString(value["fill_page_bg"]),
    fillSurface: asString(value["fill_surface"]),
    fillSurfaceElevated: asString(value["fill_surface_elevated"]),
    fillInteractive: asString(value["fill_interactive"]),
    textPrimary: asString(value["text_primary"]),
    textSecondary: asString(value["text_secondary"]),
    textDisabled: asString(value["text_disabled"]),
    textInverse: asString(value["text_inverse"]),
    radiusDefault: asNumber(value["radius_default"]),
    radiusInputs: asNumber(value["radius_inputs"]),
    radiusChrome: asNumber(value["radius_chrome"]),
    strokeBorder:
      typeof value["stroke_border"] === "string"
        ? value["stroke_border"]
        : null,
    strokeBorderStrong:
      typeof value["stroke_border_strong"] === "string"
        ? value["stroke_border_strong"]
        : null,
    elevationNote: asString(value["elevation_note"]),
  };
}

function parseLayoutTokens(value: unknown): LayoutTokensView | null {
  if (!isRecord(value)) {
    return null;
  }
  const steps = Array.isArray(value["allowed_steps"])
    ? value["allowed_steps"].filter(
        (step): step is number =>
          typeof step === "number" && Number.isFinite(step),
      )
    : [];
  return {
    gridUnit: asNumber(value["grid_unit"]),
    allowedSteps: steps,
    pageMarginMobile: asNumber(value["page_margin_mobile"]),
    pageMarginDesktop: asNumber(value["page_margin_desktop"]),
    componentGap: asNumber(value["component_gap"]),
    sectionGap: asNumber(value["section_gap"]),
  };
}

/**
 * Project the wire TokenSetResponse into the token browser view model.
 * Lenient by design: each section parses independently so a missing or
 * malformed section renders as absent, never blanking the others.
 */
export function parseTokenSet(response: TokenSetResponse): TokenBrowserView {
  const tokens = response.tokens;
  return {
    systemId: response.systemId,
    palette: parsePalette(tokens["palette"]),
    drawingRules: parseDrawingRules(tokens["drawing_rules"]),
    typography: parseTypography(tokens["typography"]),
    layout: parseLayoutTokens(tokens["layout"]),
  };
}
