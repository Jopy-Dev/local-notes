// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { applyEditorAppearance } from "../../src/frontend/services/theme.js";

/*
 * REQ-021 editor appearance CSS custom properties. Round 2b removed the
 * width setting entirely - the editor and preview always fill their pane,
 * so appearance only carries font size and line height.
 */
describe("applyEditorAppearance", () => {
  it("applies font size and line height custom properties", () => {
    applyEditorAppearance({ editorFontSize: 16, lineHeight: 1.8 });
    const style = document.documentElement.style;
    expect(style.getPropertyValue("--editor-font-size")).toBe("16px");
    expect(style.getPropertyValue("--editor-line-height")).toBe("1.8");
  });

  it("never sets a width cap", () => {
    applyEditorAppearance({ editorFontSize: 14, lineHeight: 1.6 });
    expect(document.documentElement.style.getPropertyValue("--editor-max-width")).toBe("");
  });
});
