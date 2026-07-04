import { EditorView } from "@codemirror/view";

/*
 * Quiet Workbench CodeMirror theme (Design_System.md 3/9.2): tokens map
 * through CSS variables - no raw colors here (they resolve from the
 * Tailwind theme at runtime).
 */
export const quietWorkbenchTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "var(--color-surface-code)",
      color: "var(--color-text-source)",
      height: "100%",
      // REQ-021 editor appearance settings; fallbacks match pre-settings look.
      fontSize: "var(--editor-font-size, 13px)",
    },
    ".cm-content": {
      fontFamily: "var(--font-mono)",
      lineHeight: "var(--editor-line-height, 1.7)",
      caretColor: "var(--color-focus)",
      maxWidth: "var(--editor-max-width, 76ch)",
      paddingBottom: "5rem",
    },
    ".cm-gutters": {
      backgroundColor: "var(--color-surface-code)",
      color: "var(--color-text-disabled)",
      border: "none",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-cursor": { borderLeftColor: "var(--color-focus)" },
    ".cm-activeLine": { backgroundColor: "transparent" },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "var(--color-text-muted)",
    },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "var(--color-surface-selected)",
    },
  },
  { dark: true },
);
