/**
 * Vite configuration — builds the docking-shell SPA into dist/ in exactly
 * the layout studio-server's static hosting expects (index.html at the
 * root, content-hashed bundles under assets/). The dev server proxies
 * /api and /ws to a locally running studio-server.
 */
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const STUDIO_SERVER = "http://127.0.0.1:4400";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: true,
  },
  server: {
    proxy: {
      "/api": { target: STUDIO_SERVER, changeOrigin: false },
      "/ws": { target: STUDIO_SERVER, ws: true, changeOrigin: false },
    },
  },
});
