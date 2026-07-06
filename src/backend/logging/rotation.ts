import { appendFile, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

/*
 * Local diagnostics storage (MasterPrompt.md 4.9, REQ-025): rotate each file
 * at the size cap; hourly + startup retention removes >maxAgeDays files, then
 * oldest files until total <= maxTotalBytes. Maintenance failure must never
 * crash note workflows - callers wrap with a one-time terminal warning.
 */
export const LOG_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const LOG_MAX_TOTAL_BYTES = 100 * 1024 * 1024;
export const LOG_MAX_AGE_DAYS = 30;

export interface SweepOptions {
  maxTotalBytes: number;
  maxAgeDays: number;
  now?: () => number;
}

export async function sweepLogs(logsDir: string, options: SweepOptions): Promise<void> {
  const now = options.now?.() ?? Date.now();
  const cutoff = now - options.maxAgeDays * 24 * 60 * 60 * 1000;
  const entries = await readdir(logsDir);
  const files: { path: string; mtimeMs: number; size: number }[] = [];
  for (const name of entries) {
    const path = join(logsDir, name);
    const stats = await stat(path).catch(() => null);
    if (stats?.isFile()) files.push({ path, mtimeMs: stats.mtimeMs, size: stats.size });
  }
  files.sort((a, b) => a.mtimeMs - b.mtimeMs); // oldest first

  let total = files.reduce((sum, file) => sum + file.size, 0);
  for (const file of files) {
    const expired = file.mtimeMs < cutoff;
    if (!expired && total <= options.maxTotalBytes) break;
    await rm(file.path, { force: true });
    total -= file.size;
  }
}

export class RotatingLogDestination {
  private currentPath: string;
  private currentBytes = 0;
  private sequence = 0;

  constructor(
    private readonly logsDir: string,
    private readonly options: { maxFileBytes: number } = { maxFileBytes: LOG_MAX_FILE_BYTES },
  ) {
    this.currentPath = this.nextPath();
  }

  private nextPath(): string {
    const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
    this.sequence += 1;
    return join(this.logsDir, `local-notes-${stamp}-${process.pid}-${this.sequence}.log`);
  }

  /* Writes serialize through a promise chain: pino streams fire-and-forget,
   * and concurrent appendFile calls could reorder lines or split rotation. */
  private tail: Promise<void> = Promise.resolve();

  write(line: string): Promise<void> {
    const next = this.tail.then(() => this.append(line));
    // A failed write never wedges the chain for later lines.
    this.tail = next.catch(() => undefined);
    return next;
  }

  private async append(line: string): Promise<void> {
    const bytes = Buffer.byteLength(line, "utf8");
    if (this.currentBytes > 0 && this.currentBytes + bytes > this.options.maxFileBytes) {
      this.currentPath = this.nextPath();
      this.currentBytes = 0;
    }
    await appendFile(this.currentPath, line, { mode: 0o600 });
    this.currentBytes += bytes;
  }

  async close(): Promise<void> {
    // Drain queued lines; appendFile holds no open handle between writes.
    await this.tail;
  }
}
