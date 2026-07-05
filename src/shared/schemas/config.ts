import { z } from "zod";

/*
 * ConfigV1 (MasterPrompt.md 2.7). Exact defaults come from PRD REQ-021 +
 * REQ-034. Zod validates load and update; invalid appearance fields fall back
 * to these defaults with a local warning (Wave 1 wiring).
 */
export const configV1Schema = z.object({
  version: z.literal(1),
  theme: z.enum(["system", "light", "dark"]),
  workspace: z.string(),
  editorFontSize: z.number().int().min(12).max(24),
  lineHeight: z.number().min(1.2).max(2.0),
  editorWidth: z.enum(["narrow", "medium", "wide", "full"]),
  dashboardView: z.enum(["list", "card"]),
  sortBy: z.enum(["name", "created", "modified", "size"]),
  sortDirection: z.enum(["asc", "desc"]),
  folderPaneWidth: z.number().int().min(190).max(280),
  notesPaneWidth: z.number().int().min(280).max(420),
  folderPaneCollapsed: z.boolean(),
  notesPaneCollapsed: z.boolean(),
});

export type ConfigV1 = z.infer<typeof configV1Schema>;

/*
 * PUT /settings body (MasterPrompt.md 5.2): partial appearance/view/sort/pane
 * fields; workspace and version are never client-writable. strict() so an
 * unknown or read-only key is a 422, not a silent drop.
 */
export const configUpdateSchema = configV1Schema
  .omit({ version: true, workspace: true })
  .partial()
  .strict();

export type ConfigUpdate = z.infer<typeof configUpdateSchema>;

export function defaultConfig(workspace: string): ConfigV1 {
  return {
    version: 1,
    theme: "system",
    workspace,
    editorFontSize: 14,
    lineHeight: 1.6,
    editorWidth: "medium",
    dashboardView: "list",
    sortBy: "modified",
    sortDirection: "desc",
    folderPaneWidth: 220,
    notesPaneWidth: 320,
    folderPaneCollapsed: false,
    notesPaneCollapsed: false,
  };
}
