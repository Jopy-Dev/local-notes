// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  copyPlainText,
  copyToClipboard,
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
