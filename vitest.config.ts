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
    // Step 15 coverage gate (workflow/testing-validation.md 15.5): overall
    // floor plus 100% on the security-critical set. Filesystem-safety trio
    // rows are ratchets at the current high-water mark - remaining v8
    // branch/function artifacts close before Step 15 sign-off.
    coverage: {
      provider: "v8",
      // Unit/integration-testable logic only: the .tsx view layer and app
      // bootstrap are exercised by the Playwright suites (a11y/E2E), which
      // v8 coverage cannot see - counting them here would only blur the gate.
      include: [
        "src/backend/**",
        "src/shared/**",
        "src/frontend/stores/**",
        "src/frontend/editor/**/*.ts",
      ],
      // search-worker.ts executes as compiled dist inside a worker thread -
      // its behavior is asserted by tests/integration/search-worker.spec.ts
      // but v8 instrumentation cannot observe that process.
      exclude: ["src/backend/search/search-worker.ts"],
      reporter: ["text-summary", "json-summary"],
      thresholds: {
        statements: 75,
        branches: 70,
        functions: 70,
        lines: 80,
        "src/backend/security/**": { statements: 100, branches: 100, functions: 100, lines: 100 },
        "src/backend/filesystem/atomic-writer.ts": { lines: 100, branches: 100, statements: 95, functions: 77 },
        "src/backend/filesystem/path-guard.ts": { lines: 100, functions: 100, statements: 92, branches: 85 },
        "src/backend/filesystem/workspace-lock.ts": { lines: 97, branches: 93, statements: 94, functions: 83 },
      },
    },
  },
});
