// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createMarkdownProbe } from "../../src/frontend/editor/markdown-extensions.js";
import { MarkdownCompatibilityService } from "../../src/frontend/editor/markdown-compat.js";

/*
 * MarkdownCompatibilityService (MasterPrompt.md 4.6, REQ-015/036): exact
 * normalized round-trip equality gates visual editing; <u> and <copy> are
 * the only raw HTML that must survive serialization unchanged.
 */
const probe = createMarkdownProbe();
const roundTrip = (source: string) => probe.serialize(probe.parse(source));

describe("markdown extensions round-trip (REQ-015/REQ-036)", () => {
  it("serializes underline back to <u>, not ++", () => {
    expect(roundTrip("Text with <u>underline</u> kept.").trimEnd()).toBe(
      "Text with <u>underline</u> kept.",
    );
  });

  it("round-trips <copy> marks exactly", () => {
    expect(roundTrip("Copy <copy>this snippet</copy> now.").trimEnd()).toBe(
      "Copy <copy>this snippet</copy> now.",
    );
  });

  it("keeps conservative GFM stable", () => {
    const source = [
      "# Heading",
      "",
      "A paragraph with **bold**, *italic* and a [link](https://example.com).",
      "",
      "- [ ] open",
      "- [x] done",
    ].join("\n");
    expect(roundTrip(source).trimEnd()).toBe(source);
  });
});

describe("MarkdownCompatibilityService (MasterPrompt 4.6)", () => {
  const service = new MarkdownCompatibilityService(probe);

  it("marks a lossless note as edit-compatible", () => {
    const outcome = service.check("# Doc\n\nPlain paragraph.\n", "v1");
    expect(outcome.compatibility).toBe("edit");
    expect(outcome.compatibilityReason).toBeNull();
  });

  it("normalizes CRLF in memory only and still passes equality", () => {
    const outcome = service.check("# Doc\r\n\r\nParagraph.\r\n", "v2");
    expect(outcome.compatibility).toBe("edit");
  });

  it("flags static source-only constructs before any round-trip", () => {
    const outcome = service.check("---\ntitle: x\n---\n\n# Doc\n", "v3");
    expect(outcome.compatibility).toBe("source-only");
    expect(outcome.compatibilityReason).toContain("Frontmatter");
  });

  it("representation-only differences are edit-compatible (structural fixed point)", () => {
    // Setext heading parses to the same structure ATX serializes back to -
    // the file canonicalizes on the first real edit, never on open.
    const outcome = service.check("Heading\n=======\n\nBody.\n", "v4");
    expect(outcome.compatibility).toBe("edit");
  });

  it("accepts the serializer's own canonical output as a fixed point", () => {
    const canonical = roundTrip("# Doc\n\nText with **bold**.\n");
    const outcome = service.check(canonical, "v5");
    expect(outcome.compatibility).toBe("edit");
  });

  /*
   * Whitespace-tolerant round-trip (user feedback round 1, Option A): runs
   * of blank lines and the serializer's own &nbsp; blank-paragraph output
   * are lossless-by-definition - the guard must not lock users out of files
   * the visual editor itself wrote. Real constructs stay source-only.
   */
  it("tolerates runs of blank lines (whitespace-only variance)", () => {
    const outcome = service.check("## A\n\n\n\n## B\ntext\n", "v6");
    expect(outcome.compatibility).toBe("edit");
  });

  it("tolerates the serializer's own &nbsp; blank paragraphs", () => {
    const outcome = service.check("# Heading1\n\n## Heading2\n\n\n\n&nbsp;\n", "v7");
    expect(outcome.compatibility).toBe("edit");
  });

  it("emphasis marker style is representation-only under the structural rule", () => {
    expect(service.check("_alt emphasis_\n", "v9").compatibility).toBe("edit");
  });

  it("destructive constructs stay source-only via the static scan", () => {
    expect(service.check("Text with a footnote.[^1]\n\n[^1]: note\n", "v10").compatibility).toBe(
      "source-only",
    );
    expect(service.check("<div>raw block</div>\n", "v11").compatibility).toBe("source-only");
  });
});
