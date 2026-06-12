/**
 * Slug grammar — generation, collision suffixing, and the traversal-input
 * defense that keeps unvalidated ids away from path composition.
 */
import { describe, expect, it } from "vitest";

import { allocateSlug, isValidSlug, slugify } from "../../src/store/slug.js";

describe("slugify", () => {
  it("kebab-cases display names", () => {
    expect(slugify("Checkout Flow", "workspace")).toBe("checkout-flow");
    expect(slugify("  Checkout   Flow!  ", "workspace")).toBe("checkout-flow");
    expect(slugify("Checkout (mobile)", "artifact")).toBe("checkout-mobile");
  });

  it("strips diacritics", () => {
    expect(slugify("Café Menü", "workspace")).toBe("cafe-menu");
  });

  it("falls back when the name slugs to empty", () => {
    expect(slugify("🎉🎉🎉", "workspace")).toBe("workspace");
    expect(slugify("!!!", "artifact")).toBe("artifact");
    expect(slugify("", "workspace")).toBe("workspace");
  });
});

describe("allocateSlug", () => {
  it("returns the base when free", () => {
    expect(allocateSlug("checkout-flow", new Set())).toBe("checkout-flow");
  });

  it("suffixes -2, -3, … on collision", () => {
    const taken = new Set(["checkout-flow"]);
    expect(allocateSlug("checkout-flow", taken)).toBe("checkout-flow-2");
    taken.add("checkout-flow-2");
    expect(allocateSlug("checkout-flow", taken)).toBe("checkout-flow-3");
  });
});

describe("isValidSlug", () => {
  it("accepts kebab-case slugs", () => {
    expect(isValidSlug("checkout-flow")).toBe(true);
    expect(isValidSlug("a")).toBe(true);
    expect(isValidSlug("v2-final")).toBe(true);
  });

  it("rejects traversal sequences, separators, and hidden-file prefixes", () => {
    expect(isValidSlug("../escape")).toBe(false);
    expect(isValidSlug("..")).toBe(false);
    expect(isValidSlug("a/../b")).toBe(false);
    expect(isValidSlug("/etc/passwd")).toBe(false);
    expect(isValidSlug("a\\b")).toBe(false);
    expect(isValidSlug(".trash-checkout-flow")).toBe(false);
    expect(isValidSlug(".hidden")).toBe(false);
  });

  it("rejects null bytes, whitespace, case, and empty input", () => {
    expect(isValidSlug("a\0b")).toBe(false);
    expect(isValidSlug("a b")).toBe(false);
    expect(isValidSlug("Checkout")).toBe(false);
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("-leading")).toBe(false);
    expect(isValidSlug("trailing-")).toBe(false);
  });
});
