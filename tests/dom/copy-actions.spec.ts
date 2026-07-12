// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  copyPlainText,
  copyToClipboard,
  markdownForClipboard,
  plainTextFromHtml,
} from "../../src/frontend/editor/copy-actions.js";
import { renderMarkdownPreview } from "../../src/frontend/services/contentApi.js";

vi.mock("../../src/frontend/services/contentApi.js", () => ({
  renderMarkdownPreview: vi.fn(),
}));

/*
 * Copy actions (MasterPrompt.md 4.7, REQ-020): Copy Text strips Markdown
 * syntax by reading the sanitized preview DOM's textContent; clipboard
 * failure surfaces as a false result for toast feedback, never a throw.
 */
describe("plainTextFromHtml", () => {
  it("strips markup and keeps readable text", () => {
    const html = "<h1>Title</h1><p>Text with <strong>bold</strong> and <a href=\"/notes/x\">a link</a>.</p>";
    expect(plainTextFromHtml(html).replace(/\s+/g, " ").trim()).toBe(
      "Title Text with bold and a link.",
    );
  });

  it("keeps copy-mark inner text without the tag", () => {
    expect(plainTextFromHtml("<p>Use <copy>npm run dev</copy> now.</p>")).toContain("npm run dev");
  });

  // Round 6: the render pipeline emits <br> for source newlines (breaks mode);
  // Copy Text must keep the same line structure it produced before.
  it("converts <br> line breaks to newlines", () => {
    expect(plainTextFromHtml("<p>First line.<br />Second line.<br />Third line.</p>")).toBe(
      "First line.\nSecond line.\nThird line.",
    );
  });

  it("keeps blank-line paragraph separation with <br> breaks present", () => {
    // Same shape the pipeline emitted before breaks mode: paragraphs stay
    // separated by a blank line, <br> only breaks lines inside one paragraph.
    expect(plainTextFromHtml("<p>a<br />b</p>\n<p>c</p>")).toBe("a\nb\n\nc");
  });
});

/*
 * Round 6 (REQ-020): Copy Markdown excludes the app's <copy>/</copy> markers -
 * they are a copy affordance, not note content. Marked regions keep their
 * inner markdown; code examples keep literal tags.
 */
describe("markdownForClipboard", () => {
  it("strips inline copy tags and keeps the marked text", () => {
    expect(markdownForClipboard("Run <copy>npm run dev</copy> now.")).toBe("Run npm run dev now.");
  });

  it("removes tag-only lines of a block region entirely", () => {
    expect(markdownForClipboard("before\n<copy>\n## Heading\n- item\n</copy>\nafter")).toBe(
      "before\n## Heading\n- item\nafter",
    );
  });

  it("keeps content sharing a line with a tag", () => {
    expect(markdownForClipboard("<copy>First line\nlast line</copy>")).toBe(
      "First line\nlast line",
    );
  });

  it("keeps a same-line region's content on its line", () => {
    expect(markdownForClipboard("<copy>## The system provides:</copy>")).toBe(
      "## The system provides:",
    );
  });

  it("returns source without copy tags byte-identical otherwise", () => {
    const source = "# Title\r\n\r\nPlain **bold** text.\t end";
    expect(markdownForClipboard(source)).toBe(source);
  });

  it("keeps literal tags inside fenced code blocks", () => {
    const source = "```\n<copy>\nexample\n</copy>\n```";
    expect(markdownForClipboard(source)).toBe(source);
  });

  it("keeps literal tags inside inline code spans", () => {
    const source = "Type `<copy>` to open a region.";
    expect(markdownForClipboard(source)).toBe(source);
  });

  it("strips a tag outside a code span on the same line", () => {
    expect(markdownForClipboard("Use `<copy>` like <copy>this</copy>.")).toBe(
      "Use `<copy>` like this.",
    );
  });
});

describe("copyToClipboard", () => {
  it("resolves true on clipboard success", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    await expect(copyToClipboard("text")).resolves.toBe(true);
  });

  it("resolves false when the clipboard is denied", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    await expect(copyToClipboard("text")).resolves.toBe(false);
  });
});

describe("copyPlainText", () => {
  it("copies the literal draft for .txt without rendering", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    await expect(copyPlainText("raw draft", "key", ".txt")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("raw draft");
    expect(renderMarkdownPreview).not.toHaveBeenCalled();
  });

  it("copies the sanitized preview text for .md", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    vi.mocked(renderMarkdownPreview).mockResolvedValue({
      html: "<h1>Title</h1><p>Body <strong>bold</strong></p>",
    } as Awaited<ReturnType<typeof renderMarkdownPreview>>);
    await expect(copyPlainText("# Title\n\nBody **bold**", "key", ".md")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("Title\nBody bold");
  });

  it("resolves false when the render request fails", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
    vi.mocked(renderMarkdownPreview).mockRejectedValue(new Error("offline"));
    await expect(copyPlainText("# Title", "key", ".md")).resolves.toBe(false);
  });
});
