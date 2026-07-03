import { watch } from "chokidar";
import type { FSWatcher } from "chokidar";
import { relative } from "node:path";

/*
 * Filesystem watcher (MasterPrompt.md 4.2, REQ-006): chokidar on the active
 * notes root, followSymlinks=false, Local-Notes temp artifacts ignored,
 * events coalesced for 100ms so bursts land as one batch; UI budget is 2s
 * end-to-end. Rename pairs surface as removed+added.
 */
export interface WatchEvent {
  kind: "added" | "changed" | "removed";
  relPath: string;
}

export interface WatcherOptions {
  onBatch: (events: WatchEvent[]) => void;
  coalesceMs?: number;
}

const TEMP_PREFIX = ".local-notes-tmp-";
const DEFAULT_COALESCE_MS = 100;

export class WorkspaceWatcher {
  private readonly watcher: FSWatcher;
  private readonly pending = new Map<string, WatchEvent>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly readyPromise: Promise<void>;

  constructor(
    private readonly rootAbs: string,
    private readonly options: WatcherOptions,
  ) {
    this.watcher = watch(rootAbs, {
      ignoreInitial: true,
      followSymlinks: false,
      awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 20 },
    });
    this.readyPromise = new Promise((resolve) => this.watcher.once("ready", () => resolve()));
    this.watcher.on("add", (path) => this.queue("added", path));
    this.watcher.on("change", (path) => this.queue("changed", path));
    this.watcher.on("unlink", (path) => this.queue("removed", path));
  }

  ready(): Promise<void> {
    return this.readyPromise;
  }

  private queue(kind: WatchEvent["kind"], absPath: string): void {
    const relPath = relative(this.rootAbs, absPath).replaceAll("\\", "/");
    const filename = relPath.split("/").at(-1) ?? relPath;
    if (filename.startsWith(TEMP_PREFIX)) return;
    // Last event per path wins within a window (coalesce, no lost final state).
    this.pending.set(relPath, { kind, relPath });
    this.timer ??= setTimeout(() => this.flush(), this.options.coalesceMs ?? DEFAULT_COALESCE_MS);
  }

  private flush(): void {
    this.timer = undefined;
    if (this.pending.size === 0) return;
    const batch = [...this.pending.values()];
    this.pending.clear();
    this.options.onBatch(batch);
  }

  async close(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.flush();
    await this.watcher.close();
  }
}
