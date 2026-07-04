import { create } from "zustand";
import { ApiRequestError } from "../services/api";
import { loadNoteDocument, saveNoteContent } from "../services/contentApi";
import { DraftUnsettledError, EditorController } from "../editor/editor-controller";
import type { EditorSnapshot, EditorWorkspaceEvent } from "../editor/editor-controller";
import { draftVerdict, visualVerdict } from "../editor/visual-verdict";

/*
 * React adapter over the EditorController state machine (WF-005/006/007).
 * The controller owns all transitions; this store mirrors its snapshot and
 * exposes actions. SSE note events route in via workspaceData.connectEvents.
 * Navigation away from an unsettled draft (save error or open conflict)
 * parks as pendingNavigation until the user answers stay/discard (REQ-017).
 * Visual-editing verdicts live in editor/visual-verdict (REQ-015).
 */
let lastAssessedContent: string | null = null;

const controller = new EditorController(
  {
    load: (noteKey) => loadNoteDocument(noteKey),
    save: async (noteKey, draft, expectedVersion, operationId) => {
      try {
        return await saveNoteContent(noteKey, draft, expectedVersion, operationId);
      } catch (error) {
        // Controller branches on `code` (NOTE_CONFLICT vs other failures).
        if (error instanceof ApiRequestError) throw Object.assign(error, { code: error.code });
        throw error;
      }
    },
  },
  {
    onChange: (snapshot) => {
      const content = snapshot.document?.content ?? null;
      if (content !== lastAssessedContent) {
        lastAssessedContent = content;
        useEditorData.setState({
          ...snapshot,
          loadError: null,
          ...visualVerdict(snapshot.document, snapshot.readOnlyReason !== null),
        });
        return;
      }
      useEditorData.setState({ ...snapshot, loadError: null });
    },
  },
);

type PendingNavigation = { kind: "open"; noteKey: string } | { kind: "close" } | null;

const closedState = {
  noteKey: null,
  document: null,
  draft: "",
  saveState: "saved" as const,
  conflict: null,
  readOnlyReason: null,
  loadError: null,
  pendingNavigation: null,
  visualCompatibility: "source-only" as const,
  visualCompatibilityReason: null,
};

interface EditorDataState extends EditorSnapshot {
  loadError: string | null;
  pendingNavigation: PendingNavigation;
  visualCompatibility: "edit" | "source-only";
  visualCompatibilityReason: string | null;
  revalidateVisual: () => void;
  openNote: (noteKey: string) => Promise<void>;
  changeDraft: (text: string) => void;
  retry: () => void;
  resolveReload: () => Promise<void>;
  resolveOverwrite: () => Promise<void>;
  handleEvent: (event: EditorWorkspaceEvent) => void;
  /* Settle a pending draft (WF-009 pre-archive flush); resolves even on
   * failure - callers re-check saveState. */
  flushDraft: () => Promise<void>;
  discardDraft: () => void;
  confirmPendingNavigation: () => Promise<void>;
  cancelPendingNavigation: () => void;
  closeNote: () => Promise<void>;
  discardAndClose: () => void;
}

export const useEditorData = create<EditorDataState>((set, get) => ({
  ...closedState,

  openNote: async (noteKey) => {
    const current = controller.snapshot();
    if (current.noteKey === noteKey && current.saveState !== "saved") {
      // Returning to the note that still holds the unsettled draft: never
      // reload disk content over it (REQ-017 "stay").
      set({ pendingNavigation: null });
      return;
    }
    try {
      await controller.open(noteKey);
      set({ pendingNavigation: null });
    } catch (error) {
      if (error instanceof DraftUnsettledError) {
        set({ pendingNavigation: { kind: "open", noteKey } });
      } else {
        set({ loadError: "This note could not be loaded. It may have been moved or removed." });
      }
    }
  },
  changeDraft: (text) => controller.changeDraft(text),
  retry: () => controller.retry(),

  // REQ-015: switching back to visual mode revalidates the CURRENT draft -
  // source-mode edits may have introduced unsupported constructs.
  revalidateVisual: () => {
    const { document, draft, readOnlyReason } = get();
    if (!document || document.extension !== ".md" || readOnlyReason) return;
    set({ ...draftVerdict(draft) });
  },
  resolveReload: () => controller.resolveReload(),
  resolveOverwrite: () => controller.resolveOverwrite(),
  handleEvent: (event) => controller.handleWorkspaceEvent(event),
  flushDraft: () => controller.flush(),
  discardDraft: () => controller.discardDraft(),

  confirmPendingNavigation: async () => {
    const pending = get().pendingNavigation;
    if (!pending) return;
    controller.discardDraft();
    if (pending.kind === "open") {
      set({ pendingNavigation: null });
      await get().openNote(pending.noteKey);
    } else {
      get().discardAndClose();
    }
  },
  cancelPendingNavigation: () => set({ pendingNavigation: null }),

  closeNote: async () => {
    const snapshot = controller.snapshot();
    if (snapshot.noteKey && snapshot.saveState !== "saved") {
      await controller.flush();
      if (controller.snapshot().saveState !== "saved") {
        set({ pendingNavigation: { kind: "close" } });
        return;
      }
    }
    get().discardAndClose();
  },
  discardAndClose: () => {
    controller.discardDraft();
    controller.dispose();
    // Closed state resets the verdict outside the controller's onChange, so
    // the content-identity memo must reset too - reopening the same content
    // otherwise skips the verdict recompute and sticks at source-only.
    lastAssessedContent = null;
    set(closedState);
  },
}));
