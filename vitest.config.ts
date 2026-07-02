import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Standalone test config: vite.config.ts roots at src/frontend for the SPA,
// while suites live under tests/ (MasterPrompt.md 1.4).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.spec.ts", "tests/**/*.spec.tsx"],
    environment: "node",
  },
});
