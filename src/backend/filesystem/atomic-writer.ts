import { createHash, randomUUID } from "node:crypto";
import { open, readFile, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { AppError } from "../../shared/errors/codes.js";

/*
 * AtomicFileWriter (MasterPrompt.md 2.5, REQ-023): per-path mutex, optional
 * optimistic version check, exclusive temp sibling, write + flush, version
 * recheck, atomic rename, temp cleanup on failure. Copy-then-delete across
 * devices is prohibited - workspace mutation stays inside one root.
 */
export function computeVersionToken(bytes: Buffer, relPath: string): string {
  return createHash("sha256").update(bytes).update("\n").update(relPath, "utf8").digest("hex");
}

export interface WriteRequest {
  absPath: string;
  relPath: string;
  bytes: Buffer;
  expectedVersion?: string;
}

export interface WriteResult {
  versionToken: string;
}

// Test seam: fault injection at each protocol stage (fs = acceptable boundary
// mock per tdd skill; every other collaborator stays real).
export interface WriterFaults {
  failStage?: "write" | "flush" | "rename";
}

function conflict(): AppError {
  return new AppError("NOTE_CONFLICT", "The file changed on disk since it was loaded.");
}

async function currentVersion(absPath: string, relPath: string): Promise<string | null> {
  try {
    return computeVersionToken(await readFile(absPath), relPath);
  } catch {
    return null;
  }
}

export class AtomicFileWriter {
  // In-process mutex keyed by canonical target path (2.5 step 1).
  private readonly locks = new Map<string, Promise<unknown>>();

  constructor(private readonly faults: WriterFaults = {}) {}

  async write(request: WriteRequest): Promise<WriteResult> {
    const key = request.absPath;
    const previous = this.locks.get(key) ?? Promise.resolve();
    const task = previous.catch(() => undefined).then(() => this.locked(request));
    this.locks.set(key, task);
    try {
      return await task;
    } finally {
      if (this.locks.get(key) === task) this.locks.delete(key);
    }
  }

  private async locked(request: WriteRequest): Promise<WriteResult> {
    const { absPath, relPath, bytes, expectedVersion } = request;

    if (expectedVersion !== undefined) {
      const before = await currentVersion(absPath, relPath);
      if (before === null || before !== expectedVersion) throw conflict();
    }

    const tempPath = join(dirname(absPath), `.local-notes-tmp-${randomUUID()}`);
    let handle;
    try {
      // Exclusive create: a colliding temp name fails instead of clobbering.
      handle = await open(tempPath, "wx", 0o600);
      if (this.faults.failStage === "write") throw new Error("injected write failure");
      await handle.writeFile(bytes);
      if (this.faults.failStage === "flush") throw new Error("injected flush failure");
      await handle.sync();
      await handle.close();
      handle = undefined;

      // Recheck immediately before replacement (2.5 step 6).
      if (expectedVersion !== undefined) {
        const beforeRename = await currentVersion(absPath, relPath);
        if (beforeRename !== expectedVersion) throw conflict();
      }

      if (this.faults.failStage === "rename") throw new Error("injected rename failure");
      await rename(tempPath, absPath);
    } catch (error) {
      await handle?.close().catch(() => undefined);
      await rm(tempPath, { force: true });
      throw error;
    }

    return { versionToken: computeVersionToken(bytes, relPath) };
  }
}
