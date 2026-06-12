/**
 * Typed library HTTP client — results cross the seam as typed values
 * (never thrown), structured server errors pass through, malformed bodies
 * and network failures map to actionable errors, and aborts are flagged
 * so callers can ignore them (rapid system switching).
 */
import { describe, expect, it } from "vitest";

import { createLibraryApi } from "../../../src/panels/library/model/libraryApi.js";
import {
  librarySystems,
  swissButtonDetail,
  swissComponents,
  swissLayouts,
  swissTokens,
} from "./helpers/fixtures.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fetchReturning(
  body: unknown,
  status = 200,
  capture?: (url: string) => void,
): typeof fetch {
  return async (input) => {
    capture?.(String(input));
    return jsonResponse(body, status);
  };
}

describe("successful fetches validate and pass through", () => {
  it("lists systems", async () => {
    const api = createLibraryApi({
      fetchImpl: fetchReturning(librarySystems()),
    });
    const result = await api.listSystems();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.map((system) => system.id)).toEqual([
      "swiss",
      "terminal",
      "broken-system",
    ]);
  });

  it("fetches tokens with the systemId encoded into the route", async () => {
    const urls: string[] = [];
    const api = createLibraryApi({
      fetchImpl: fetchReturning(swissTokens(), 200, (url) => urls.push(url)),
    });
    const result = await api.getTokens("swiss");
    expect(result.ok).toBe(true);
    expect(urls).toEqual(["/api/library/swiss/tokens"]);
  });

  it("fetches the component index", async () => {
    const api = createLibraryApi({
      fetchImpl: fetchReturning(swissComponents()),
    });
    const result = await api.getComponents("swiss");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.find((entry) => entry.id === "card")?.variants).toEqual(
      ["default", "gray_surface"],
    );
  });

  it("fetches a component detail carrying the raw SVG", async () => {
    const api = createLibraryApi({
      fetchImpl: fetchReturning(swissButtonDetail()),
    });
    const result = await api.getComponentDetail("swiss", "button");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.svg).toContain("<svg");
  });

  it("fetches layout templates", async () => {
    const api = createLibraryApi({ fetchImpl: fetchReturning(swissLayouts()) });
    const result = await api.getLayouts("swiss");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.map((layout) => layout.id)).toContain("dashboard");
  });

  it("prefixes the injected base URL (integration seam)", async () => {
    const urls: string[] = [];
    const api = createLibraryApi({
      baseUrl: "http://127.0.0.1:9999",
      fetchImpl: fetchReturning(librarySystems(), 200, (url) =>
        urls.push(url),
      ),
    });
    await api.listSystems();
    expect(urls).toEqual(["http://127.0.0.1:9999/api/library/systems"]);
  });
});

describe("failure paths stay typed", () => {
  it("passes the server's structured error through unchanged", async () => {
    const api = createLibraryApi({
      fetchImpl: fetchReturning(
        {
          error: {
            code: "bridge_unavailable",
            message: "The MCP bridge is not running.",
            fix: "Wait for the bridge to restart.",
          },
        },
        503,
      ),
    });
    const result = await api.getTokens("swiss");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("bridge_unavailable");
    expect(result.error.fix).toContain("restart");
    expect(result.aborted).toBeUndefined();
  });

  it("maps a malformed body to an actionable error", async () => {
    const api = createLibraryApi({
      fetchImpl: fetchReturning({ nonsense: true }),
    });
    const result = await api.listSystems();
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.message).toContain("/api/library/systems");
  });

  it("maps a network failure to an actionable error", async () => {
    const api = createLibraryApi({
      fetchImpl: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    const result = await api.listSystems();
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.message).toContain("ECONNREFUSED");
    expect(result.error.fix).not.toBe("");
  });

  it("flags aborts so callers can ignore the abandoned fetch", async () => {
    const api = createLibraryApi({
      fetchImpl: async () => {
        const error = new Error("The operation was aborted.");
        error.name = "AbortError";
        throw error;
      },
    });
    const controller = new AbortController();
    const result = await api.getTokens("swiss", controller.signal);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.aborted).toBe(true);
  });

  it("survives a non-JSON error body", async () => {
    const api = createLibraryApi({
      fetchImpl: async () => new Response("upstream broke", { status: 502 }),
    });
    const result = await api.listSystems();
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.message).toContain("502");
  });
});
