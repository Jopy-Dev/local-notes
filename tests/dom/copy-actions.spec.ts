// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  copyPlainText,
  copyToClipboard,
  markdownForClipboard,
  plainTextFromSource,
} from "../../src/frontend/editor/copy-actions.js";

/*
 * Copy actions (MasterPrompt.md 4.7, REQ-020, round 7): Copy Text strips
 * Markdown syntax per source line and preserves the source's exact line and
 * blank-line structure - blank lines appear in the copy only where the note
 * has them. Clipboard failure surfaces as a false result, never a throw.
 */
describe("plainTextFromSource", () => {
  it("mirrors the source line structure of the approved round-7 sample", () => {
    const source = [
      "# Lets Brainstorm, Webapp Project Idea.",
      'I am thinking of a project Idea about HOA Management system for my village. "The system is optimized for a single village, a single currency, a single language (English)"',
      "",
      '### 1. Accounts "RBAC"',
      "",
      '**- User "Homeowner":**',
      '- View "Properties, Invoices" assigned to them. (Properties are the houses/units they have inside the village)',
      "- Pay Invoices.",
      '- Edit own profile "Only Password" If they need to update email need to submit a support ticket.',
      "",
      "**- Staff:**",
      '- Can register a User "Homeowner", (internal dashboard only -- no public sign-up).',
      "- Manage support tickets.",
      '- Manage user "Homeowner" accounts. (Only Edit Email).',
    ].join("\n");
    expect(plainTextFromSource(source)).toBe(
      [
        "Lets Brainstorm, Webapp Project Idea.",
        'I am thinking of a project Idea about HOA Management system for my village. "The system is optimized for a single village, a single currency, a single language (English)"',
        "",
        '1. Accounts "RBAC"',
        "",
        '- User "Homeowner":',
        'View "Properties, Invoices" assigned to them. (Properties are the houses/units they have inside the village)',
        "Pay Invoices.",
        'Edit own profile "Only Password" If they need to update email need to submit a support ticket.',
        "",
        "- Staff:",
        'Can register a User "Homeowner", (internal dashboard only -- no public sign-up).',
        "Manage support tickets.",
        'Manage user "Homeowner" accounts. (Only Edit Email).',
      ].join("\n"),
    );
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

describe("plainTextFromSource constructs", () => {
  it("preserves consecutive blank lines exactly as the source has them", () => {
    expect(plainTextFromSource("a\n\n\nb")).toBe("a\n\n\nb");
  });

  it("drops fence delimiters and keeps fenced content literal", () => {
    expect(plainTextFromSource("before\n```\nconst x = 1; // # not a heading\n```\nafter")).toBe(
      "before\nconst x = 1; // # not a heading\nafter",
    );
  });

  it("keeps link and image text without targets", () => {
    expect(plainTextFromSource("See [the guide](docs/guide.md) and ![shot](img/x.png).")).toBe(
      "See the guide and shot.",
    );
  });

  it("unwraps inline code and keeps literal copy tags inside it", () => {
    expect(plainTextFromSource("Type `<copy>` then `npm run dev`.")).toBe(
      "Type <copy> then npm run dev.",
    );
  });

  it("strips copy tags, underline tags, and emphasis pairs", () => {
    expect(
      plainTextFromSource("<copy>**bold** and <u>under</u> and ~~gone~~ and *it* and _em_</copy>"),
    ).toBe("bold and under and gone and it and em");
  });

  it("keeps unpaired emphasis markers as literal text", () => {
    expect(plainTextFromSource("2*3 equals 6 and snake_case stays")).toBe(
      "2*3 equals 6 and snake_case stays",
    );
  });

  it("flattens table rows to cell text and drops separator rows", () => {
    expect(plainTextFromSource("| A | B |\n| --- | --- |\n| 1 | 2 |")).toBe("A B\n1 2");
  });

  it("strips blockquote markers and task boxes", () => {
    expect(plainTextFromSource("> quoted line\n- [x] done task")).toBe("quoted line\ndone task");
  });

  it("drops horizontal rules", () => {
    expect(plainTextFromSource("above\n\n---\n\nbelow")).toBe("above\n\n\nbelow");
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
  it("copies the literal draft for .txt without transformation", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    await expect(copyPlainText("raw # draft", "key", ".txt")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("raw # draft");
  });

  it("copies syntax-stripped source text for .md preserving line structure", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    await expect(copyPlainText("# Title\n\nBody **bold**", "key", ".md")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("Title\n\nBody bold");
  });
});
