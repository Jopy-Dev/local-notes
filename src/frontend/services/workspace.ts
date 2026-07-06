/*
 * Workspace identity from GET /bootstrap (MasterPrompt.md 5.2). Module-held
 * like services/token: set once at boot, read by copy actions (REQ-020) so
 * "Copy local path" reproduces the home-relative display form the server
 * exposes (never a raw absolute home path, MasterPrompt.md 4.9).
 */
let workspaceDisplayPath: string | null = null;

export function setWorkspaceDisplayPath(path: string): void {
  workspaceDisplayPath = path;
}

export function getWorkspaceDisplayPath(): string | null {
  return workspaceDisplayPath;
}
