/*
 * Self-event suppression registry (MasterPrompt.md 4.5): a mutation registers
 * its operation ID for every path it will touch BEFORE the filesystem change;
 * the watcher takes the ID when the event arrives and attaches it to the SSE
 * payload so the originating client never sees a false conflict. Entries are
 * single-shot and expire so later unrelated events cannot inherit stale IDs.
 */
const DEFAULT_TTL_MS = 10_000;

interface Entry {
  operationId: string;
  expiresAt: number;
}

export class OperationRegistry {
  private readonly entries = new Map<string, Entry>();
  private readonly ttlMs: number;

  constructor(options: { ttlMs?: number } = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  }

  register(relPath: string, operationId: string): void {
    this.entries.set(relPath, { operationId, expiresAt: Date.now() + this.ttlMs });
  }

  take(relPath: string): string | undefined {
    const entry = this.entries.get(relPath);
    if (!entry) return undefined;
    this.entries.delete(relPath);
    if (entry.expiresAt < Date.now()) return undefined;
    return entry.operationId;
  }
}
