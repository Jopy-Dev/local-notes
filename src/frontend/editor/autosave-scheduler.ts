/*
 * Autosave scheduling (MasterPrompt.md 4.5): waits the debounce delay after
 * the last edit, keeps exactly one save in flight, and coalesces edits that
 * land mid-save into a single queued follow-up. Extracted from
 * EditorController per the structural.class.complexity waiver condition
 * (KNOWN_ISSUES.md, editor-controller-wmc-2026-07-04).
 */
export interface AutosaveHooks {
  /* Performs one save attempt; must handle its own errors (never throws). */
  save: () => Promise<void>;
  /* Fires after a save settles when edits queued behind it; the owner
   * decides whether the follow-up save still applies. */
  onQueuedReady: () => void;
}

export class AutosaveScheduler {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight = false;
  private queued = false;
  private promise: Promise<void> | null = null;

  constructor(
    private readonly delayMs: number,
    private readonly hooks: AutosaveHooks,
  ) {}

  /* Debounce: (re)arms the delay after every edit. */
  schedule(): void {
    this.cancelTimer();
    this.timer = setTimeout(() => void this.request(), this.delayMs);
  }

  cancelTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  dropQueued(): void {
    this.queued = false;
  }

  /* Awaits the in-flight save and any queued follow-up it spawns. */
  async settle(): Promise<void> {
    while (this.promise) await this.promise;
  }

  request(): Promise<void> {
    if (this.inFlight) {
      this.queued = true;
      return this.promise ?? Promise.resolve();
    }
    const wrapped: Promise<void> = this.run().finally(() => {
      // A queued follow-up may have replaced the reference already.
      if (this.promise === wrapped) this.promise = null;
    });
    this.promise = wrapped;
    return wrapped;
  }

  private async run(): Promise<void> {
    this.inFlight = true;
    try {
      await this.hooks.save();
    } finally {
      this.inFlight = false;
      if (this.queued) {
        this.queued = false;
        this.hooks.onQueuedReady();
      }
    }
  }
}
