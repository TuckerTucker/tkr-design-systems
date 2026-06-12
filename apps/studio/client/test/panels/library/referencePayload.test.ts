/**
 * LibraryReference builders and the drag seam — typed payloads carrying
 * only identifiers and human labels (never paths), encoded under the
 * dedicated MIME type; foreign drag data is ignored on decode.
 */
import { isLibraryReference } from "@studio/contract";
import { describe, expect, it } from "vitest";

import {
  LIBRARY_REFERENCE_MIME,
  componentReference,
  decodeReferenceDrag,
  encodeReferenceDrag,
  layoutReference,
  paletteReference,
  scaleReference,
} from "../../../src/panels/library/reference/referencePayload.js";
import { swissComponents, swissLayouts } from "./helpers/fixtures.js";
import { createFakeDataTransfer } from "./helpers/libraryHarness.jsx";

const card = swissComponents().find((entry) => entry.id === "card");
if (card === undefined) {
  throw new Error("fixture missing the card component");
}

describe("reference builders", () => {
  it("builds a component reference carrying the selected variant", () => {
    const reference = componentReference("swiss", card, "gray_surface");
    expect(reference).toEqual({
      kind: "component",
      systemId: "swiss",
      componentId: "card",
      variantId: "gray_surface",
      label: "Card — gray_surface",
    });
    expect(isLibraryReference(reference)).toBe(true);
  });

  it("labels a variant-less component by name alone", () => {
    const badge = swissComponents().find((entry) => entry.id === "badge");
    expect(badge).toBeDefined();
    if (badge === undefined) {
      return;
    }
    const reference = componentReference("swiss", badge, "");
    expect(reference.label).toBe("Badge");
    expect(isLibraryReference(reference)).toBe(true);
  });

  it("builds a token reference with the dot path and hex value", () => {
    const reference = paletteReference("swiss", {
      name: "red",
      value: "#E3000B",
      role: "accent",
      usageConstraint: "",
    });
    expect(reference).toEqual({
      kind: "token",
      systemId: "swiss",
      tokenPath: "colors.palette.red",
      value: "#E3000B",
      label: "red #E3000B",
    });
    expect(isLibraryReference(reference)).toBe(true);
  });

  it("builds a type-scale token reference", () => {
    const reference = scaleReference("swiss", {
      px: 22,
      role: "display_small",
    });
    expect(reference).toEqual({
      kind: "token",
      systemId: "swiss",
      tokenPath: "typography.scale.22",
      value: "22px display_small",
      label: "22px display_small",
    });
  });

  it("builds a layout reference from the template", () => {
    const dashboard = swissLayouts().find(
      (layout) => layout.id === "dashboard",
    );
    expect(dashboard).toBeDefined();
    if (dashboard === undefined) {
      return;
    }
    const reference = layoutReference("swiss", dashboard);
    expect(reference).toEqual({
      kind: "layout",
      systemId: "swiss",
      templateId: "dashboard",
      label: "Dashboard",
    });
  });
});

describe("drag encode/decode round trip", () => {
  it("round-trips a reference under the dedicated MIME type", () => {
    const transfer = createFakeDataTransfer();
    const reference = componentReference("swiss", card, "default");
    encodeReferenceDrag(transfer as unknown as DataTransfer, reference);
    expect(transfer.effectAllowed).toBe("copy");
    expect(transfer.data.get("text/plain")).toBe("Card — default");
    const decoded = decodeReferenceDrag(transfer as unknown as DataTransfer);
    expect(decoded).toEqual(reference);
  });

  it("ignores foreign drag data (no library MIME entry)", () => {
    const transfer = createFakeDataTransfer();
    transfer.setData("text/plain", "some external drag");
    expect(decodeReferenceDrag(transfer as unknown as DataTransfer)).toBeNull();
  });

  it("ignores malformed JSON under the library MIME type", () => {
    const transfer = createFakeDataTransfer();
    transfer.setData(LIBRARY_REFERENCE_MIME, "{not json");
    expect(decodeReferenceDrag(transfer as unknown as DataTransfer)).toBeNull();
  });

  it("ignores well-formed JSON that fails the reference guard", () => {
    const transfer = createFakeDataTransfer();
    transfer.setData(
      LIBRARY_REFERENCE_MIME,
      JSON.stringify({ kind: "component", systemId: "", componentId: "x" }),
    );
    expect(decodeReferenceDrag(transfer as unknown as DataTransfer)).toBeNull();
  });
});
