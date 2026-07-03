import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Frontend root lives in src/frontend (MasterPrompt.md 1.4); packaged output in dist/client (1.5).
// Dev-mode API traffic proxies to the local Fastify server (MasterPrompt.md 1.1).
export default defineConfig({
  root: "src/frontend",
  publicDir: false,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    proxy: {
      "/api/v1": {
        target: "http://127.0.0.1:8989",
        // Backend rejects any Host other than 127.0.0.1:8989 and requires
        // the exact local Origin on mutations (ADR-003); the dev proxy must
        // present both. Packaged app talks same-origin, no proxy involved.
        changeOrigin: true,
        headers: { origin: "http://127.0.0.1:8989" },
      },
    },
  },
});
