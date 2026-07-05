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
  editorWidth: "narrow" | "medium" | "wide";
}

// Prose width per Design_System.md 3.3 (v1.4): narrow 65ch, medium 76ch
// (default), wide 90ch outer cap.
const EDITOR_WIDTH_CH: Record<EditorAppearance["editorWidth"], number> = {
  narrow: 65,
  medium: 76,
  wide: 90,
};

export function applyEditorAppearance(appearance: EditorAppearance): void {
  const style = document.documentElement.style;
  style.setProperty("--editor-font-size", `${appearance.editorFontSize}px`);
  style.setProperty("--editor-line-height", String(appearance.lineHeight));
  style.setProperty("--editor-max-width", `${EDITOR_WIDTH_CH[appearance.editorWidth]}ch`);
}
