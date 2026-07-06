import type { ConfigUpdate, ConfigV1 } from "../../../shared/schemas/config.js";

/*
 * Settings form model (SCREEN-003, REQ-021): option lists mirror the ConfigV1
 * appearance schema; the draft diff keeps PUT /settings partial. Pure module
 * so the dialog component stays a rendering shell.
 */
export const THEMES: { value: ConfigV1["theme"]; label: string }[] = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

// REQ-021 exact ranges: font 12..24 px integer, line height 1.2..2.0.
export const FONT_SIZES = Array.from({ length: 13 }, (_, index) => 12 + index);
export const LINE_HEIGHTS = Array.from({ length: 9 }, (_, index) => (12 + index) / 10);

export interface AppearanceDraft {
  theme: ConfigV1["theme"];
  editorFontSize: number;
  lineHeight: number;
}

export function draftFrom(config: ConfigV1): AppearanceDraft {
  return {
    theme: config.theme,
    editorFontSize: config.editorFontSize,
    lineHeight: config.lineHeight,
  };
}

export function changedFields(config: ConfigV1, draft: AppearanceDraft): ConfigUpdate {
  const partial: ConfigUpdate = {};
  if (draft.theme !== config.theme) partial.theme = draft.theme;
  if (draft.editorFontSize !== config.editorFontSize) partial.editorFontSize = draft.editorFontSize;
  if (draft.lineHeight !== config.lineHeight) partial.lineHeight = draft.lineHeight;
  return partial;
}

export function themeByLabel(label: string): ConfigV1["theme"] {
  return THEMES.find((theme) => theme.label === label)?.value ?? "system";
}
