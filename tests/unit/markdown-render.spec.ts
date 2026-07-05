import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../../src/backend/markdown/render-pipeline.js";
import { encodeNoteKey } from "../../src/backend/filesystem/path-guard.js";

/*
 * REQ-028 XSS corpus + link/image policy (MasterPrompt.md 4.6, 7.2) against
 * the render pipeline's public interface. The note lives at docs/guide.md so
 * relative references resolve against save-data/notes/docs.
 */
const NOTE = "docs/guide.md";
const render = (source: string) => renderMarkdown(source, NOTE).html;

describe("sanitizer strips active content (REQ-028)", () => {
  it.each([
    ["script tag", "<script>alert(1)</script>", "<script"],
    ["inline handler", '<img src="x.png" onerror="alert(1)">', "onerror"],
    ["iframe", '<iframe src="https://evil.example"></iframe>', "<iframe"],
    ["object", "<object data='x'></object>", "<object"],
    ["embed", "<embed src='x'>", "<embed"],
    ["style tag", "<style>body{background:url(javascript:1)}</style>", "<style"],
    ["form", "<form action='https://evil.example'><button>x</button></form>", "<form"],
    ["meta refresh", "<meta http-equiv='refresh' content='0;url=https://evil.example'>", "<meta"],
    ["base tag", "<base href='https://evil.example/'>", "<base"],
    ["svg element", "<svg onload='alert(1)'><circle r='1'/></svg>", "<svg"],
    ["math element", "<math><mtext></mtext></math>", "<math"],
  ])("removes %s", (_name, source, marker) => {
    const html = render(source);
    expect(html).not.toContain(marker);
    expect(html).not.toContain("alert(1)");
  });

  it("neutralizes javascript: markdown links as inert text", () => {
    const html = render("[click](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("click");
    expect(html).not.toMatch(/<a[^>]*javascript/i);
  });

  it("keeps script content out even when nested in allowed structure", () => {
    const html = render("> quote\n>\n> <script>fetch('https://evil.example')</script>");
    expect(html).not.toContain("fetch(");
    expect(html).not.toContain("evil.example");
  });
});

describe("raw HTML allowlist", () => {
  it("keeps attribute-less <u> and <copy>", () => {
    const html = render("Text with <u>underline</u> and <copy>snippet</copy>.");
    expect(html).toContain("<u>underline</u>");
    expect(html).toContain("<copy>snippet</copy>");
  });

  it("strips attributes from <u> and <copy>", () => {
    const html = render('A <u onclick="alert(1)">u</u> and <copy class="x">c</copy>.');
    expect(html).toContain("<u>u</u>");
    expect(html).toContain("<copy>c</copy>");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("class=");
  });

  it("drops other raw HTML tags but keeps their text", () => {
    const html = render("before <div>inside</div> after");
    expect(html).not.toContain("<div");
    expect(html).toContain("inside");
  });
});

describe("link policy (REQ-014)", () => {
  it("rewrites workspace-relative note links to internal routes", () => {
    const html = render("[other](sub/other.md)");
    expect(html).toContain(`href="/notes/${encodeNoteKey("docs/sub/other.md")}"`);
    expect(html).toContain('data-link="internal"');
  });

  it("marks http/https links for confirmation", () => {
    const html = render("[site](https://example.com/page)");
    expect(html).toContain('href="https://example.com/page"');
    expect(html).toContain('data-link="external"');
    expect(html).toContain('rel="noreferrer"');
  });

  it.each([
    ["mailto", "[m](mailto:a@b.c)"],
    ["file", "[f](file:///etc/passwd)"],
    ["vbscript", "[v](vbscript:x)"],
    ["data", "[d](data:text/html,<script>1</script>)"],
  ])("renders %s scheme links as inert text", (_name, source) => {
    const html = render(source);
    expect(html).not.toContain("<a");
    expect(html).toContain('data-blocked="link"');
  });

  it("renders workspace-escaping note links as inert text", () => {
    const html = render("[escape](../../../etc/passwd.md)");
    expect(html).not.toContain("<a");
    expect(html).toContain('data-blocked="link"');
  });
});

describe("image policy (REQ-014)", () => {
  it("rewrites workspace-relative raster images to the guarded asset route", () => {
    const html = render("![shot](images/shot.png)");
    expect(html).toContain(`src="/api/v1/assets/${encodeNoteKey("notes/docs/images/shot.png")}"`);
    expect(html).toContain('alt="shot"');
  });

  it("allows attachment references inside save-data (MasterPrompt 2.2)", () => {
    const html = render("![a](../../attachments/pic.jpg)");
    expect(html).toContain(`src="/api/v1/assets/${encodeNoteKey("attachments/pic.jpg")}"`);
  });

  it.each([
    ["remote", "![r](https://evil.example/x.png)"],
    ["protocol-relative", "![p](//evil.example/x.png)"],
    ["data URL", "![d](data:image/png;base64,AAAA)"],
    ["file URL", "![f](file:///c:/secret.png)"],
    ["save-data escape", "![e](../../../outside.png)"],
    ["svg", "![s](vector.svg)"],
    ["non-image", "![n](notes.txt)"],
  ])("blocks %s images with a placeholder", (_name, source) => {
    const html = render(source);
    expect(html).not.toContain("<img");
    expect(html).toContain('data-blocked="image"');
  });
});
