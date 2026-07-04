import { AutosaveScheduler } from "./autosave-scheduler.js";
import type { NoteDocument, NoteMetadata } from "../../shared/schemas/notes.js";

/*
 * Editor state machine (MasterPrompt.md 4.5, WF-006/007): owns noteKey,
 * loadedVersion, draft, and save state. Autosave timing and save
 * serialization live in AutosaveScheduler (750ms debounce, one save in
 * flight, latest draft queues). A version conflict or external change while
 * dirty pauses autosave and preserves BOTH versions until the user
 * explicitly reloads or overwrites. SSE events carrying one of our own
 * operation IDs are suppressed (self-event, never a conflict).
 */
const AUTOSAVE_MS = 750;

export type EditorSaveState = "saved" | "unsaved" | "saving" | "conflict" | "error";
export type ConflictKind = "changed" | "source-missing" | null;
export type ReadOnlyReason = "oversized" | "encoding" | null;

export interface EditorSnapshot {
  noteKey: string | null;
  document: NoteDocument | null;
  draft: string;
  saveState: EditorSaveState;
  conflict: ConflictKind;
  readOnlyReason: ReadOnlyReason;
}

export interface EditorWorkspaceEvent {
  type: string;
  noteKey?: string;
  oldKey?: string;
  version?: string;
  operationId?: string;
}

export interface EditorTransport {
  load(noteKey: string): Promise<NoteDocument>;
  save(
    noteKey: string,
    draft: string,
    expectedVersion: string,
    operationId: string,
  ): Promise<NoteMetadata>;
}

export interface EditorControllerOptions {
  autosaveMs?: number;
  newOperationId?: () => string;
  onChange?: (snapshot: EditorSnapshot) => void;
}

/*
 * Thrown when a note switch is requested while the current draft cannot be
 * saved (save error or unresolved conflict). The caller owns the REQ-017
 * stay/discard question; the controller never drops a draft on its own.
 */
export class DraftUnsettledError extends Error {
  constructor() {
    super("The current draft is unsaved and could not be flushed.");
    this.name = "DraftUnsettledError";
  }
}

export class EditorController {
  private state: EditorSnapshot = {
    noteKey: null,
    document: null,
    draft: "",
    saveState: "saved",
    conflict: null,
    readOnlyReason: null,
  };

  private loadedVersion = "";
  private latestDiskVersion = "";
  // Bumped on every open(); a save that started under an older epoch is
  // stale and must not touch state when it settles (reload supersedes it).
  private openEpoch = 0;
  private lastSaveEpoch = 0;
  private readonly ownOperations = new Set<string>();
  private readonly scheduler: AutosaveScheduler;
  private readonly newOperationId: () => string;
  private readonly onChange: ((snapshot: EditorSnapshot) => void) | undefined;

  constructor(
    private readonly transport: EditorTransport,
    options: EditorControllerOptions = {},
  ) {
    this.newOperationId = options.newOperationId ?? (() => crypto.randomUUID());
    this.onChange = options.onChange;
    this.scheduler = new AutosaveScheduler(options.autosaveMs ?? AUTOSAVE_MS, {
      save: () => this.performSave(),
      onQueuedReady: () => {
        // A queued draft restarts only when the note is unchanged and the
        // prior save landed clean (conflict/error pause the pipeline).
        if (this.lastSaveEpoch === this.openEpoch && this.state.saveState === "saved") {
          this.update({ ...this.state, saveState: "unsaved" });
          void this.scheduler.request();
        }
      },
    });
  }

  snapshot(): EditorSnapshot {
    return this.state;
  }

  async open(noteKey: string): Promise<void> {
    // REQ-017: a pending draft settles before another note replaces it.
    if (this.state.noteKey && this.state.noteKey !== noteKey) {
      await this.flush();
      if (this.state.saveState !== "saved") throw new DraftUnsettledError();
    }
    this.scheduler.cancelTimer();
    this.openEpoch += 1;
    const document = await this.transport.load(noteKey);
    this.loadedVersion = document.versionToken;
    this.latestDiskVersion = document.versionToken;
    this.update({
      noteKey,
      document,
      draft: document.content,
      saveState: "saved",
      conflict: null,
      readOnlyReason: readOnlyReasonOf(document),
    });
  }

  changeDraft(text: string): void {
    if (this.state.readOnlyReason || this.state.conflict) return;
    this.update({ ...this.state, draft: text, saveState: "unsaved" });
    this.scheduler.schedule();
  }

  retry(): void {
    if (this.state.saveState !== "error") return;
    void this.scheduler.request();
  }

  async flush(): Promise<void> {
    this.scheduler.cancelTimer();
    // Settle the in-flight save (and any queued follow-up) first.
    await this.scheduler.settle();
    if (this.state.saveState === "unsaved") await this.scheduler.request();
  }

  handleWorkspaceEvent(event: EditorWorkspaceEvent): void {
    if (!this.state.noteKey) return;
    if (event.type === "note.renamed" && event.oldKey === this.state.noteKey) {
      this.applyRename(event);
      return;
    }
    if (event.noteKey !== this.state.noteKey) return;
    const ownEcho = event.operationId !== undefined && this.ownOperations.delete(event.operationId);
    if (event.version) this.latestDiskVersion = event.version;
    if (ownEcho) return;
    this.applyForeignEvent(event.type, event.operationId !== undefined);
  }

  /* REQ-018: the open note was renamed on disk. Clean editors follow the new
   * key automatically (the shell syncs the route); dirty drafts park as
   * source-missing so nothing is lost. App-originated moves carry an
   * operation ID and are skipped - the move flow navigates the route itself. */
  private applyRename(event: EditorWorkspaceEvent): void {
    if (event.operationId !== undefined) return;
    if (this.state.saveState !== "saved") {
      this.enterConflict("source-missing");
      return;
    }
    if (event.noteKey) void this.open(event.noteKey).catch(() => undefined);
  }

  private applyForeignEvent(type: string, appOriginated: boolean): void {
    const dirty = this.state.saveState !== "saved";
    if (type === "note.removed") {
      // REQ-018: a clean note deleted outside the app parks as source-missing
      // (save-as-new / close) instead of silently showing stale content.
      // App-originated removals (archive) own their navigation.
      if (dirty || !appOriginated) this.enterConflict("source-missing");
      return;
    }
    if (type !== "note.changed" && type !== "note.added") return;
    if (dirty) this.enterConflict("changed");
    else void this.reloadFromDisk();
  }

  private enterConflict(kind: Exclude<ConflictKind, null>): void {
    this.scheduler.cancelTimer();
    this.update({ ...this.state, saveState: "conflict", conflict: kind });
  }

  /* Explicit conflict resolutions (REQ-018): reload adopts disk, overwrite
   * saves the preserved draft against the latest known disk version. */
  async resolveReload(): Promise<void> {
    if (!this.state.noteKey) return;
    await this.open(this.state.noteKey);
  }

  async resolveOverwrite(): Promise<void> {
    if (!this.state.noteKey) return;
    this.loadedVersion = this.latestDiskVersion || this.loadedVersion;
    this.update({ ...this.state, conflict: null, saveState: "unsaved" });
    await this.scheduler.request();
  }

  /* Explicit REQ-017 "discard": settle the state without saving so a switch
   * or close can proceed. Only the user's stay/discard choice calls this. */
  discardDraft(): void {
    this.scheduler.cancelTimer();
    this.scheduler.dropQueued();
    this.update({ ...this.state, saveState: "saved", conflict: null });
  }

  dispose(): void {
    this.scheduler.cancelTimer();
  }

  private async reloadFromDisk(): Promise<void> {
    if (!this.state.noteKey) return;
    await this.open(this.state.noteKey).catch(() => undefined);
  }

  private async performSave(): Promise<void> {
    if (!this.state.noteKey || this.state.readOnlyReason) return;
    const epoch = this.openEpoch;
    this.lastSaveEpoch = epoch;
    this.update({ ...this.state, saveState: "saving" });
    const operationId = this.newOperationId();
    this.ownOperations.add(operationId);
    try {
      const metadata = await this.transport.save(
        this.state.noteKey,
        this.state.draft,
        this.loadedVersion,
        operationId,
      );
      if (epoch !== this.openEpoch) return;
      this.loadedVersion = metadata.versionToken;
      this.latestDiskVersion = metadata.versionToken;
      const document = this.state.document ? { ...this.state.document, ...metadata } : null;
      this.update({ ...this.state, document, saveState: "saved" });
    } catch (error) {
      this.ownOperations.delete(operationId);
      if (epoch !== this.openEpoch) return;
      if ((error as { code?: string }).code === "NOTE_CONFLICT") {
        this.enterConflict("changed");
      } else {
        this.update({ ...this.state, saveState: "error" });
      }
    }
  }

  private update(next: EditorSnapshot): void {
    this.state = next;
    this.onChange?.(next);
  }
}

function readOnlyReasonOf(document: NoteDocument): ReadOnlyReason {
  if (document.oversized) return "oversized";
  if (document.textEncoding === "unsupported") return "encoding";
  return null;
}
