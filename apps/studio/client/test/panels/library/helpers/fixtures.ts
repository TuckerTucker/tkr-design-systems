/**
 * REAL fixture content for library-panel tests — payloads captured from
 * the actual server projections (studio-api library routes over the real
 * design-systems MCP server) and the real swiss library SVG imported raw.
 * Shapes are faithful to @studio/contract http-payloads and the bridge's
 * AuthoringTokens (server/src/mcp/types.ts); the integration suite gets
 * the same data through a real composed server.
 */
import type {
  ComponentDetail,
  ComponentIndexEntry,
  LayoutTemplate,
  LibrarySystem,
  TokenSetResponse,
} from "@studio/contract";

import swissButtonSvgRaw from "../../../../../../../systems/swiss/components/button-primary.svg?raw";
import scriptInjectionRaw from "../../../../../server/test/artifact-pipeline/fixtures/adversarial/script-injection.svg?raw";
import eventHandlersRaw from "../../../../../server/test/artifact-pipeline/fixtures/adversarial/event-handlers.svg?raw";
import externalReferencesRaw from "../../../../../server/test/artifact-pipeline/fixtures/adversarial/external-references.svg?raw";

export const SWISS_BUTTON_SVG: string = swissButtonSvgRaw;
export const SCRIPT_INJECTION_SVG: string = scriptInjectionRaw;
export const EVENT_HANDLERS_SVG: string = eventHandlersRaw;
export const EXTERNAL_REFERENCES_SVG: string = externalReferencesRaw;

/** GET /api/library/systems — real registry projection (subset) plus a
 * draft stub (the shape ds_list_systems degrades to for an unreadable
 * spec: name = id, empty tagline, status "draft"). */
export function librarySystems(): LibrarySystem[] {
  return [
    {
      id: "swiss",
      name: "Swiss",
      tagline: "Grid + Grotesk + Single Saturated Accent",
      status: "available",
    },
    {
      id: "terminal",
      name: "Terminal",
      tagline: "CLI + Phosphor Heritage",
      status: "available",
    },
    { id: "broken-system", name: "broken-system", status: "draft" },
  ];
}

/** GET /api/library/swiss/tokens — the REAL wf_get_tokens payload for
 * swiss, verbatim (captured from export_tokens_for_authoring). */
export function swissTokens(): TokenSetResponse {
  return {
    systemId: "swiss",
    tokens: {
      system_id: "swiss",
      palette: [
        {
          name: "ink",
          value: "#000000",
          role: "all body and structural type",
          usage_constraint:
            "the only color for body type; never substituted with grays",
        },
        {
          name: "paper",
          value: "#FFFFFF",
          role: "page and primary surface",
          usage_constraint: "no off-whites or warm whites; pure paper",
        },
        {
          name: "gray_surface",
          value: "#F5F5F5",
          role: "secondary surface (selection background, message blocks)",
          usage_constraint: "the only gray surface; no intermediate tiers",
        },
        {
          name: "gray_metadata",
          value: "#666666",
          role: "9px uppercase metadata only",
          usage_constraint: "never used for body type or anything above 11px",
        },
        {
          name: "rule_hairline",
          value: "#F0F0F0",
          role: "1px dividers between subtle sections",
          usage_constraint: "",
        },
        {
          name: "rule_default",
          value: "#E0E0E0",
          role: "1px dividers between distinct sections",
          usage_constraint: "",
        },
        {
          name: "red",
          value: "#E3000B",
          role: "the system's only accent",
          usage_constraint: "exactly 4 uses per screen — see rulebook",
        },
      ],
      drawing_rules: {
        fill_page_bg: "#FFFFFF",
        fill_surface: "#FFFFFF",
        fill_surface_elevated: "#F5F5F5",
        fill_interactive: "#E3000B",
        text_primary: "#000000",
        text_secondary: "#000000",
        text_disabled: "#666666",
        text_inverse: "#FFFFFF",
        radius_default: 0,
        radius_inputs: 0,
        radius_chrome: 0,
        elevation_note:
          "elevation strategy is 'typographic' — check artifact_treatments in the spec for filter/overlay details",
      },
      typography: {
        font_stack_structural: "Inter, system-ui, sans-serif",
        font_stack_mono: "",
        scale: [
          { px: 9, role: "metadata" },
          { px: 11, role: "small_label" },
          { px: 13, role: "secondary_body" },
          { px: 14, role: "body" },
          { px: 22, role: "display_small" },
          { px: 32, role: "display_medium" },
          { px: 40, role: "display_large" },
        ],
        case_rules: { metadata: "uppercase", body: "mixed", headers: "mixed" },
        tracking: { metadata: 0.16, body: 0, headers: 0 },
        css_class_block: "<style>\n  .text-primary { fill: #212121; }\n</style>",
      },
      layout: {
        grid_unit: 8,
        allowed_steps: [8, 16, 24, 32, 40, 48, 64],
        page_margin_mobile: 12,
        page_margin_desktop: 32,
        component_gap: 12,
        section_gap: 32,
        canvas: {
          mobile: { w: 375, h: 812 },
          desktop: { w: 1280, h: 800 },
        },
        section_comment_format:
          "<!-- ==================== SECTION ==================== -->",
      },
    },
  };
}

/** A borders_only drawing_rules block (the wireframe/neutral shape from
 * _build_drawing_rules' borders_only branch). */
export function bordersOnlyTokens(): TokenSetResponse {
  const base = swissTokens();
  return {
    systemId: "wireframe",
    tokens: {
      ...base.tokens,
      system_id: "wireframe",
      drawing_rules: {
        fill_page_bg: "#F5F5F5",
        fill_surface: "#FFFFFF",
        fill_surface_elevated: "#FFFFFF",
        fill_interactive: "#424242",
        text_primary: "#212121",
        text_secondary: "#757575",
        text_disabled: "#BDBDBD",
        text_inverse: "#FFFFFF",
        radius_default: 6,
        radius_inputs: 6,
        radius_chrome: 8,
        stroke_border: "stroke='#E0E0E0' stroke-width='1'",
        stroke_border_strong: "stroke='#E0E0E0' stroke-width='1.5'",
        no_shadow: true,
        elevation_note: "borders only — no box-shadow or drop-shadow",
      },
    },
  };
}

/** GET /api/library/swiss/components — the REAL swiss index projection
 * (componentIndexFromSpec over systems/swiss/spec.yaml). */
export function swissComponents(): ComponentIndexEntry[] {
  return [
    { id: "button", name: "Button", variants: ["primary", "text"] },
    { id: "card", name: "Card", variants: ["default", "gray_surface"] },
    { id: "input", name: "Input", variants: ["text"] },
    { id: "list_item", name: "List Item", variants: ["default", "selected"] },
    { id: "badge", name: "Badge", variants: [] },
    { id: "avatar", name: "Avatar", variants: ["index_only"] },
    { id: "nav", name: "Nav", variants: ["sidebar"] },
    {
      id: "section_header",
      name: "Section Header",
      variants: ["metadata"],
    },
    {
      id: "separator",
      name: "Separator",
      variants: ["hairline", "default", "strong"],
    },
  ];
}

/** GET /api/library/swiss/components/button — real index entry + the
 * real library SVG. */
export function swissButtonDetail(): ComponentDetail {
  return {
    id: "button",
    name: "Button",
    variants: ["primary", "text"],
    svg: SWISS_BUTTON_SVG,
  };
}

/** GET /api/library/swiss/layouts — the REAL swiss projection
 * (layoutsFromSpec over systems/swiss/spec.yaml; subset). */
export function swissLayouts(): LayoutTemplate[] {
  return [
    {
      id: "auth",
      name: "Auth",
      archetype: "auth",
      platforms: ["mobile", "desktop"],
      description:
        "Centered single-column form. 280px max width. Brand at top, 32px gap, then form fields stacked with 24px gap. Submit button below, red text label. No card surface around the form.",
    },
    {
      id: "dashboard",
      name: "Dashboard",
      archetype: "dashboard",
      platforms: ["mobile", "desktop"],
      description:
        "Sidebar + main split. Sidebar 280px (per nav.sidebar). Main content uses display type (32px or 40px) for primary metrics, 13px body for supporting text. Numerical hierarchy throughout.",
    },
    {
      id: "data_table",
      name: "Data Table",
      archetype: "data_table",
      platforms: ["mobile", "desktop"],
      description:
        "Tabular data with zero-padded indices, 9px tracked uppercase column headers, 9px tracked uppercase status text (ACTIVE/PENDING/INACTIVE) — text-only, no pill badges. Hairline rules between rows.",
    },
  ];
}
