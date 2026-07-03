import { randomUUID } from "node:crypto";
import { lstat, readFile, rm, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";
import { z } from "zod";

/*
 * WorkspaceLock (MasterPrompt.md 2.6, REQ-003): one process owns the
 * workspace. Exclusive wx create; same-host live PID -> exact conflict
 * message + exit 2 path; dead PID -> single stale-recovery retry;
 * unreadable/foreign-host lock -> fail closed with recovery guidance.
 */
export const WORKSPACE_LOCK_MESSAGE = "Workspace already in use.";

const lockFileSchema = z.object({
  instanceId: z.string().min(1),
  pid: z.number().int().positive(),
  hostname: z.string().min(1),
  startedAt: z.string(),
  appVersion: z.string(),
  workspaceRealPath: z.string(),
});

export class WorkspaceLockError extends Error {
  readonly code = "WORKSPACE_LOCKED";
}

export interface AcquireOptions {
  rootDir: string;
  appVersion: string;
  // Test seam: PID liveness probe (process boundary).
  pidAlive?: (pid: number) => boolean;
}

export interface WorkspaceLock {
  instanceId: string;
  release: () => Promise<void>;
}

function defaultPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function tryCreate(lockPath: string, payload: string): Promise<boolean> {
  try {
    await writeFile(lockPath, payload, { flag: "wx", mode: 0o600 });
    return true;
  } catch {
    return false;
  }
}

export async function acquireWorkspaceLock(options: AcquireOptions): Promise<WorkspaceLock> {
  const pidAlive = options.pidAlive ?? defaultPidAlive;
  const lockPath = join(options.rootDir, ".lock");
  const instanceId = randomUUID();
  const payload = JSON.stringify({
    instanceId,
    pid: process.pid,
    hostname: hostname(),
    startedAt: new Date().toISOString(),
    appVersion: options.appVersion,
    workspaceRealPath: options.rootDir,
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (await tryCreate(lockPath, payload)) {
      return { instanceId, release: () => release(lockPath, instanceId) };
    }

    // Existing entry must be a regular file - symlink/junction fails closed (2.6).
    const stats = await lstat(lockPath).catch(() => null);
    if (!stats || stats.isSymbolicLink() || !stats.isFile()) {
      throw new WorkspaceLockError(WORKSPACE_LOCK_MESSAGE);
    }

    let owner: z.infer<typeof lockFileSchema>;
    try {
      owner = lockFileSchema.parse(JSON.parse(await readFile(lockPath, "utf8")));
    } catch {
      throw new WorkspaceLockError(
        `${WORKSPACE_LOCK_MESSAGE} The lock file is unreadable - verify no other Local-Notes instance is running, then delete .lock manually.`,
      );
    }

    if (owner.hostname !== hostname()) {
      throw new WorkspaceLockError(
        `${WORKSPACE_LOCK_MESSAGE} The lock belongs to another machine - verify no other instance uses this workspace, then delete .lock manually.`,
      );
    }
    if (pidAlive(owner.pid)) {
      throw new WorkspaceLockError(WORKSPACE_LOCK_MESSAGE);
    }

    // Dead same-host owner: remove stale file, retry exclusive create ONCE.
    await rm(lockPath, { force: true });
  }

  throw new WorkspaceLockError(WORKSPACE_LOCK_MESSAGE);
}

async function release(lockPath: string, instanceId: string): Promise<void> {
  try {
    const current = lockFileSchema.parse(JSON.parse(await readFile(lockPath, "utf8")));
    if (current.instanceId !== instanceId) return; // never remove someone else's lock
    await rm(lockPath, { force: true });
  } catch {
    // Missing/unreadable at release: nothing safe to do.
  }
}
