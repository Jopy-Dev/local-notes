import { describe, expect, it } from "vitest";
import { classifyStartupError, EXIT_CODES } from "../../src/cli/exit-codes.js";

// CLI stable exit codes (MasterPrompt.md 4.1).
describe("classifyStartupError", () => {
  it("maps port-in-use to exit 3", () => {
    const error = Object.assign(new Error("listen EADDRINUSE"), { code: "EADDRINUSE" });
    expect(classifyStartupError(error)).toBe(EXIT_CODES.portUnavailable);
  });

  it("maps workspace lock conflict to exit 2", () => {
    const error = Object.assign(new Error("Workspace already in use."), {
      code: "WORKSPACE_LOCKED",
    });
    expect(classifyStartupError(error)).toBe(EXIT_CODES.workspaceLocked);
  });

  it("maps config/workspace validation failure to exit 4", () => {
    const error = Object.assign(new Error("invalid config"), { code: "CONFIG_INVALID" });
    expect(classifyStartupError(error)).toBe(EXIT_CODES.invalidConfig);
  });

  it("maps unknown failures to exit 1", () => {
    expect(classifyStartupError(new Error("boom"))).toBe(EXIT_CODES.unexpected);
  });
});
