/*
 * Theme + editor appearance application (MasterPrompt.md 4.8, REQ-021).
 * data-theme lands on <html>; token overrides live in styles/app.css. System
 * theme resolves through matchMedia and follows OS changes live without a
 * persistence write. Editor appearance travels as CSS custom properties so
 * CodeMirror and the preview pick changes up without restart.
 */
export type ThemeSetting = "system" | "light" | "dark";

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function resolveTheme(setting: ThemeSetting): "light" | "dark" {
  if (setting !== "system") return setting;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function applyTheme(setting: ThemeSetting): void {
  document.documentElement.dataset.theme = resolveTheme(setting);
}

/* Live OS-preference tracking while setting is "system" (REQ-021). */
export function watchSystemTheme(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export interface EditorAppearance {
  editorFontSize: number;
  lineHeight: number;
  editorWidth: "narrow" | "medium" | "wide" | "full";
}

// Prose width per Design_System.md 3.3: narrow 65ch, medium 76ch (default),
// wide 90ch; full removes the cap so every surface fills its pane (round 2).
const EDITOR_MAX_WIDTH: Record<EditorAppearance["editorWidth"], string> = {
  narrow: "65ch",
  medium: "76ch",
  wide: "90ch",
  full: "none",
};

export function applyEditorAppearance(appearance: EditorAppearance): void {
  const style = document.documentElement.style;
  style.setProperty("--editor-font-size", `${appearance.editorFontSize}px`);
  style.setProperty("--editor-line-height", String(appearance.lineHeight));
  style.setProperty("--editor-max-width", EDITOR_MAX_WIDTH[appearance.editorWidth]);
}
