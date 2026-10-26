import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// systems/<id>/tokens.json is the single source of truth for design values
// (docs/specs/TOKENS.md § 4). It lives outside the Vite root, so expose it
// as @systems and let the dev server read it.
const systemsDir = fileURLToPath(new URL("../../systems", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@systems": systemsDir } },
  server: { fs: { allow: [".", systemsDir] } },
});
