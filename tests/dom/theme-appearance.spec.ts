// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { applyEditorAppearance } from "../../src/frontend/services/theme.js";

/*
 * REQ-021 editor appearance CSS custom properties, including the round-2
 * "full" width: the cap becomes none so Read/Source/Split fill the pane.
 */
describe("applyEditorAppearance", () => {
  it.each([
    ["narrow", "65ch"],
    ["medium", "76ch"],
    ["wide", "90ch"],
    ["full", "none"],
  ] as const)("maps %s width to %s", (editorWidth, expected) => {
    applyEditorAppearance({ editorFontSize: 14, lineHeight: 1.6, editorWidth });
    const style = document.documentElement.style;
    expect(style.getPropertyValue("--editor-max-width")).toBe(expected);
    expect(style.getPropertyValue("--editor-font-size")).toBe("14px");
    expect(style.getPropertyValue("--editor-line-height")).toBe("1.6");
  });
});
