import { describe, expect, it } from "vitest";
import { parseRoute } from "../../src/frontend/app/routes.js";

// AppRouter route contract (MasterPrompt.md 1.6): exact routes only,
// unknown paths redirect to dashboard.
describe("parseRoute", () => {
  it("parses the four known routes", () => {
    expect(parseRoute("/")).toEqual({ name: "dashboard" });
    expect(parseRoute("/settings")).toEqual({ name: "settings" });
    expect(parseRoute("/recovery/search")).toEqual({ name: "search-recovery" });
    expect(parseRoute("/notes/abc123")).toEqual({ name: "note", noteKey: "abc123" });
  });

  it("treats unknown or malformed paths as redirect-to-dashboard", () => {
    expect(parseRoute("/nope")).toBeNull();
    expect(parseRoute("/notes/")).toBeNull();
    expect(parseRoute("/notes/a/b")).toBeNull();
    expect(parseRoute("/settings/extra")).toBeNull();
  });

  it("rejects note keys that are not base64url", () => {
    expect(parseRoute("/notes/../etc")).toBeNull();
    expect(parseRoute("/notes/a+b")).toBeNull();
  });
});
