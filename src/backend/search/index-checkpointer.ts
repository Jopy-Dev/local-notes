/*
 * Dirty-index checkpoint scheduler (MasterPrompt.md 4.3): save after 30s
 * idle, at most once per 5min, forced on close. Save failures never block
 * note workflows - the cache is disposable by contract (2.8).
 */
export class IndexCheckpointer {
  private dirty = false;
  private lastSaveAt = Number.NEGATIVE_INFINITY;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly save: () => Promise<void>,
    private readonly idleMs: number,
    private readonly minIntervalMs: number,
  ) {}

  markDirty(): void {
    this.dirty = true;
    this.schedule(this.idleMs);
  }

  async close(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    if (this.dirty) await this.saveNow();
  }

  private schedule(delayMs: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const sinceLastSave = Date.now() - this.lastSaveAt;
      if (sinceLastSave < this.minIntervalMs) this.schedule(this.minIntervalMs - sinceLastSave);
      else void this.saveNow();
    }, delayMs);
    this.timer.unref?.();
  }

  private async saveNow(): Promise<void> {
    await this.save().catch(() => undefined);
    this.dirty = false;
    this.lastSaveAt = Date.now();
  }
}
