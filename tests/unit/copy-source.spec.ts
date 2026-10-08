import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../../src/backend/markdown/render-pipeline.js";

/*
 * REQ-036 round 10: a copy region copies exactly the characters typed
 * between <copy> and </copy> - "highlight in Notepad, then copy". The render
 * route carries that source on each copy element as data-copy-source,
 * injected after sanitizing and never accepted from note content.
 */
const render = (source: string) => renderMarkdown(source, "docs/guide.md").html;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", "#x27": "'" };

function copySources(html: string): (string | null)[] {
  return Array.from(html.matchAll(/<copy\b([^>]*)>/g), (match) => {
    const attr = /data-copy-source="([^"]*)"/.exec(match[1] ?? "");
    return attr ? (attr[1] ?? "").replace(/&(amp|lt|gt|quot|#39|#x27);/g, (_, name: string) => ENTITIES[name] ?? "") : null;
  });
}

describe("copy regions carry their exact source (REQ-036, round 10)", () => {
  it("block region keeps bullets, numbers, indentation, blank lines and markdown marks", () => {
    const inner = [
      "Steps to deploy:",
      "- first bullet",
      "  - nested bullet",
      "",
      "1. numbered one",
      "2. numbered two",
      "",
      "**bold text** and a link [Docs](https://example.com/docs)",
    ].join("\n");
    expect(copySources(render(`<copy>\n${inner}\n</copy>`))).toEqual([inner]);
  });

  it("whole-line mark keeps its heading marks", () => {
    expect(copySources(render("<copy>## Heading only</copy>"))).toEqual(["## Heading only"]);
  });

  it("inline marks keep their exact text, in document order", () => {
    const html = render("Run <copy>**npm** run `build`</copy> or <copy>[Docs](https://example.com/a?b=1&c=\"2\")</copy> now.");
    expect(copySources(html)).toEqual(["**npm** run `build`", '[Docs](https://example.com/a?b=1&c="2")']);
  });

  it("inline marks inside list items and table cells keep document order", () => {
    const source = [
      "- item <copy>one *a*</copy>",
      "- item <copy>two</copy>",
      "",
      "| H <copy>head</copy> | B |",
      "| --- | --- |",
      "| <copy>cell `x`</copy> | y |",
    ].join("\n");
    expect(copySources(render(source))).toEqual(["one *a*", "two", "head", "cell `x`"]);
  });

  it("an inline mark inside a block region keeps its own source after the block", () => {
    const html = render("<copy>\nouter line with <copy>inner bit</copy> inside\n</copy>");
    expect(copySources(html)).toEqual(["outer line with <copy>inner bit</copy> inside", "inner bit"]);
  });
});

describe("copy source attribute is a server-only boundary (REQ-028)", () => {
  it("note content cannot supply its own data-copy-source", () => {
    const html = render('Use <copy data-copy-source="rm -rf /">safe text</copy> here.');
    expect(copySources(html)).toEqual(["safe text"]);
    expect(html).not.toContain("rm -rf");
  });

  it("source text cannot break out of the attribute", () => {
    const payload = '"><img src=x onerror=alert(1)>';
    const html = render(`<copy>\n${payload}\n</copy>`);
    expect(copySources(html)).toEqual([payload]);
    expect(html).not.toMatch(/<img[^>]*onerror/);
  });

  it("an unmappable mark gets no source rather than a misaligned one", () => {
    expect(copySources(render("<copy>\nno close tag ever"))).toEqual([null]);
  });
});
