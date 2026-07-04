import { execSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { resolveSearchWorkerPath } from "../../src/backend/search/worker-engine.js";

/*
 * Shared dist build for real-worker integration specs: the search worker
 * runs only as compiled JS (Node cannot resolve .js specifiers from .ts
 * sources). Rebuild only when a backend/shared source is newer than the
 * compiled worker - vitest runs each spec file in its own process, so a
 * plain in-memory flag would not dedupe.
 */
function newestMtime(dir: string): number {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    const mtime = entry.isDirectory() ? newestMtime(path) : statSync(path).mtimeMs;
    if (mtime > newest) newest = mtime;
  }
  return newest;
}

export function ensureDistBuilt(): string {
  const root = process.cwd();
  const existing = resolveSearchWorkerPath();
  if (existing) {
    const workerMtime = statSync(existing).mtimeMs;
    const sourceMtime = Math.max(
      newestMtime(join(root, "src", "backend")),
      newestMtime(join(root, "src", "shared")),
    );
    if (workerMtime > sourceMtime) return existing;
  }
  execSync("npm run build:server", { cwd: root, stdio: "ignore" });
  const built = resolveSearchWorkerPath();
  if (!built) throw new Error("dist search worker missing after build:server");
  return built;
}
