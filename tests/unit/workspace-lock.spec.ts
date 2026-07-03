import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  acquireWorkspaceLock,
  WORKSPACE_LOCK_MESSAGE,
} from "../../src/backend/filesystem/workspace-lock.js";

/*
 * WorkspaceLock (MasterPrompt.md 2.6, REQ-003): exclusive wx create; live
 * same-host owner blocks with the exact conflict message; dead-PID lock
 * recovers once; unreadable/foreign locks fail closed.
 */
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ln-lock-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const alive = () => true;
const dead = () => false;

describe("acquireWorkspaceLock", () => {
  it("creates the lock file with owner fields and releases it", async () => {
    const lock = await acquireWorkspaceLock({ rootDir: dir, appVersion: "0.1.0" });
    const parsed = JSON.parse(readFileSync(join(dir, ".lock"), "utf8"));
    expect(parsed.pid).toBe(process.pid);
    expect(parsed.hostname).toBe(hostname());
    expect(parsed.appVersion).toBe("0.1.0");
    expect(parsed.instanceId).toBeTruthy();
    await lock.release();
    expect(existsSync(join(dir, ".lock"))).toBe(false);
  });

  it("blocks a second instance while the owner is alive, without writes", async () => {
    await acquireWorkspaceLock({ rootDir: dir, appVersion: "0.1.0" });
    const before = readFileSync(join(dir, ".lock"), "utf8");
    await expect(
      acquireWorkspaceLock({ rootDir: dir, appVersion: "0.1.0", pidAlive: alive }),
    ).rejects.toMatchObject({ code: "WORKSPACE_LOCKED", message: WORKSPACE_LOCK_MESSAGE });
    expect(readFileSync(join(dir, ".lock"), "utf8")).toBe(before);
  });

  it("recovers a stale lock when the owning pid is dead", async () => {
    writeFileSync(
      join(dir, ".lock"),
      JSON.stringify({
        instanceId: "stale",
        pid: 999999,
        hostname: hostname(),
        startedAt: new Date().toISOString(),
        appVersion: "0.0.9",
        workspaceRealPath: dir,
      }),
    );
    const lock = await acquireWorkspaceLock({ rootDir: dir, appVersion: "0.1.0", pidAlive: dead });
    const parsed = JSON.parse(readFileSync(join(dir, ".lock"), "utf8"));
    expect(parsed.pid).toBe(process.pid);
    await lock.release();
  });

  it("fails closed on unreadable lock content", async () => {
    writeFileSync(join(dir, ".lock"), "not-json{{{");
    await expect(
      acquireWorkspaceLock({ rootDir: dir, appVersion: "0.1.0" }),
    ).rejects.toMatchObject({ code: "WORKSPACE_LOCKED" });
  });

  it("fails closed on a foreign-host lock even if the pid is dead locally", async () => {
    writeFileSync(
      join(dir, ".lock"),
      JSON.stringify({
        instanceId: "remote",
        pid: 4,
        hostname: "some-other-machine",
        startedAt: new Date().toISOString(),
        appVersion: "0.1.0",
        workspaceRealPath: dir,
      }),
    );
    await expect(
      acquireWorkspaceLock({ rootDir: dir, appVersion: "0.1.0", pidAlive: dead }),
    ).rejects.toMatchObject({ code: "WORKSPACE_LOCKED" });
  });

  it("release keeps a lock owned by a different instance", async () => {
    const lock = await acquireWorkspaceLock({ rootDir: dir, appVersion: "0.1.0" });
    writeFileSync(
      join(dir, ".lock"),
      JSON.stringify({
        instanceId: "someone-else",
        pid: 1234,
        hostname: hostname(),
        startedAt: new Date().toISOString(),
        appVersion: "0.1.0",
        workspaceRealPath: dir,
      }),
    );
    await lock.release();
    expect(existsSync(join(dir, ".lock"))).toBe(true);
  });
});
