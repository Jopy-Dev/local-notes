import { mkdir } from "node:fs/promises";
import { join } from "node:path";

/*
 * Workspace initialization (MasterPrompt.md 2.2, REQ-002). Creates required +
 * deferred directories without touching existing content. POSIX mode 0700 on
 * application directories; Windows ignores mode bits. MVP reads/writes active
 * notes under save-data/notes; archive mutation under save-data/archive;
 * attachments/templates/backups/exports/plugins are forward-compatibility
 * only (no MVP controls).
 */
export const WORKSPACE_DIRECTORIES = [
  "save-data/notes",
  "save-data/archive",
  "save-data/attachments",
  "save-data/templates",
  "backups",
  "exports",
  "cache",
  "logs",
  "plugins",
] as const;

export async function initWorkspace(rootDir: string): Promise<void> {
  for (const relative of WORKSPACE_DIRECTORIES) {
    await mkdir(join(rootDir, ...relative.split("/")), { recursive: true, mode: 0o700 });
  }
}
