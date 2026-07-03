import { existsSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RotatingLogDestination, sweepLogs } from "../../src/backend/logging/rotation.js";

/*
 * Log rotation/retention (MasterPrompt.md 4.9, REQ-025): rotate files at the
 * size cap; retention removes >30-day files first, then oldest until the
 * 100 MiB total cap passes. Fake clock via injected now().
 */
let dir: string;
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ln-logs-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function seedFile(name: string, bytes: number, ageMs: number, now: number): void {
  const path = join(dir, name);
  writeFileSync(path, Buffer.alloc(bytes, 97));
  const mtime = new Date(now - ageMs);
  utimesSync(path, mtime, mtime);
}

describe("sweepLogs", () => {
  it("removes files older than the retention window", async () => {
    const now = Date.now();
    seedFile("old.log", 10, 31 * DAY, now);
    seedFile("fresh.log", 10, 1 * DAY, now);
    await sweepLogs(dir, { maxTotalBytes: 1000, maxAgeDays: 30, now: () => now });
    expect(existsSync(join(dir, "old.log"))).toBe(false);
    expect(existsSync(join(dir, "fresh.log"))).toBe(true);
  });

  it("removes oldest files first until the total-size cap passes", async () => {
    const now = Date.now();
    seedFile("a-oldest.log", 400, 3 * DAY, now);
    seedFile("b-middle.log", 400, 2 * DAY, now);
    seedFile("c-newest.log", 400, 1 * DAY, now);
    await sweepLogs(dir, { maxTotalBytes: 900, maxAgeDays: 30, now: () => now });
    expect(existsSync(join(dir, "a-oldest.log"))).toBe(false);
    expect(existsSync(join(dir, "b-middle.log"))).toBe(true);
    expect(existsSync(join(dir, "c-newest.log"))).toBe(true);
  });
});

describe("RotatingLogDestination", () => {
  it("rotates to a new file when the size cap is exceeded", async () => {
    const destination = new RotatingLogDestination(dir, { maxFileBytes: 64 });
    await destination.write(`${"x".repeat(60)}\n`);
    await destination.write(`${"y".repeat(20)}\n`);
    await destination.close();
    const files = readdirSync(dir).filter((name) => name.endsWith(".log"));
    expect(files.length).toBe(2);
  });
});
