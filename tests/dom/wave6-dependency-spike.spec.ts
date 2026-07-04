// @vitest-environment jsdom
// Wave 6 compile-check gate per MasterPrompt.md 10: TipTap Markdown round-trip
// + Orama save/load against pinned versions BEFORE any editor build. Failure
// reopens the dependency decision (Implementation_Plan.md 8).
import { Editor } from "@tiptap/core";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { create, insert, load, save, search } from "@orama/orama";
import { describe, expect, it } from "vitest";

function createMarkdownEditor(): Editor {
  return new Editor({
    // StarterKit 3.x already registers link + underline marks.
    extensions: [StarterKit, TableKit, TaskList, TaskItem, Markdown],
    content: "",
  });
}

describe("wave 6 spike: TipTap 3.27 markdown round-trip", () => {
  it("round-trips conservative markdown exactly (MasterPrompt 4.6 equality bar)", () => {
    const editor = createMarkdownEditor();
    const source = [
      "# Heading",
      "",
      "A paragraph with **bold**, *italic* and a [link](https://example.com).",
      "",
      "- first",
      "- second",
      "",
      "1. one",
      "2. two",
    ].join("\n");

    const manager = editor.storage.markdown.manager;
    const roundTripped = manager.serialize(manager.parse(source));

    expect(roundTripped.trimEnd()).toBe(source);
    editor.destroy();
  });

  it("keeps GFM tables, task lists and underline stable across a second pass", () => {
    const editor = createMarkdownEditor();
    const source = [
      "| Name | Value |",
      "| --- | --- |",
      "| alpha | 1 |",
      "",
      "- [ ] open task",
      "- [x] done task",
      "",
      "Text with <u>underline</u> kept.",
    ].join("\n");

    const manager = editor.storage.markdown.manager;
    const first = manager.serialize(manager.parse(source));
    const second = manager.serialize(manager.parse(first));

    // Serializer canonicalizes: table cells gain alignment padding and <u>
    // becomes ++underline++. Per MasterPrompt 4.6 exact-equality, sources in
    // non-canonical form go source-only; canonical form must be a fixed point.
    expect(first).toContain("| alpha | 1");
    expect(first).toContain("- [ ] open task");
    expect(first).toContain("- [x] done task");
    expect(first).toContain("++underline++");
    expect(second).toBe(first);
    editor.destroy();
  });
});

describe("wave 6 spike: Orama 3.1 save/load", () => {
  it("search results survive a save/load round trip", async () => {
    const schema = { id: "string", title: "string", content: "string" } as const;
    const original = create({ schema });
    await insert(original, { id: "n1", title: "Grocery list", content: "milk eggs bread" });
    await insert(original, { id: "n2", title: "Meeting notes", content: "quarterly roadmap" });

    const raw = save(original);
    // Serializable index contract (MasterPrompt 11): must survive JSON transport.
    const revived = create({ schema });
    load(revived, JSON.parse(JSON.stringify(raw)));

    const hits = await search(revived, { term: "roadmap" });
    expect(hits.hits.map((hit) => hit.document.id)).toEqual(["n2"]);
  });
});
