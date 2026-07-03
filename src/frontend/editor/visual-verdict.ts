import { getCompatibilityService } from "./markdown-compat";
import type { NoteDocument } from "../../shared/schemas/notes.js";

/*
 * Visual-editing verdict (MasterPrompt 4.6, REQ-015): the backend static
 * verdict gates the TipTap round-trip check, computed once per loaded
 * content (versionToken-cached by the compatibility service). Source-mode
 * edits revalidate through draftVerdict on re-entry to visual mode.
 */
export interface VisualVerdictResult {
  visualCompatibility: "edit" | "source-only";
  visualCompatibilityReason: string | null;
}

export function visualVerdict(
  document: NoteDocument | null,
  readOnly: boolean,
): VisualVerdictResult {
  if (!document || document.extension !== ".md" || readOnly) {
    return {
      visualCompatibility: "source-only",
      visualCompatibilityReason: document?.compatibilityReason ?? null,
    };
  }
  if (document.markdownCompatibility === "source-only") {
    return {
      visualCompatibility: "source-only",
      visualCompatibilityReason: document.compatibilityReason,
    };
  }
  const scan = getCompatibilityService().check(document.content, document.versionToken);
  return {
    visualCompatibility: scan.compatibility,
    visualCompatibilityReason: scan.compatibilityReason,
  };
}

export function draftVerdict(draft: string): VisualVerdictResult {
  const scan = getCompatibilityService().assess(draft);
  return {
    visualCompatibility: scan.compatibility,
    visualCompatibilityReason: scan.compatibilityReason,
  };
}
