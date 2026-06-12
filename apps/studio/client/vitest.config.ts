/**
 * Vitest configuration — two projects per the testing policy:
 * - unit: jsdom + Testing Library for shell components and pure logic
 * - integration: node environment; boots a REAL composed studio-server on
 *   an ephemeral port (server test composition reused) and exercises the
 *   preferences endpoints and the /ws protocol over real connections.
 */
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/** apps/studio — the npm workspace root (default fs allow scope). */
const studioRoot = fileURLToPath(new URL("..", import.meta.url));
/** Repo root /systems — real design-system SVGs imported ?raw by the
 * library-panel fixtures (test/panels/library/helpers/fixtures.ts). */
const systemsDir = fileURLToPath(new URL("../../../systems", import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [studioRoot, systemsDir],
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./test/setup.ts"],
          include: [
            "test/unit/**/*.test.{ts,tsx}",
            "test/canvas/**/*.test.{ts,tsx}",
            "test/panels/**/*.test.{ts,tsx}",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["test/integration/**/*.test.ts"],
          testTimeout: 60_000,
          hookTimeout: 120_000,
          // The server fixture binds real ports and temp dirs; keep the
          // suites sequential so fixtures never race on shared resources.
          fileParallelism: false,
        },
      },
    ],
  },
});
