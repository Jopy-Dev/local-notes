import { useEffect, useRef } from "react";
import { useEditorData } from "../stores/editorData";

/*
 * REQ-018: a clean open note renamed outside the app swaps the editor key;
 * the route follows silently. The editor key moving away from the routed key
 * can only be a rename follow - every other transition starts from a route
 * change, so the route is already ahead of the editor in those cases.
 */
export function useRenameFollow(routeNoteKey: string | null): void {
  const editorNoteKey = useEditorData((state) => state.noteKey);
  const previous = useRef(editorNoteKey);
  useEffect(() => {
    const before = previous.current;
    previous.current = editorNoteKey;
    if (!before || !editorNoteKey || before === editorNoteKey) return;
    if (routeNoteKey === before) {
      window.history.replaceState(null, "", `/notes/${editorNoteKey}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, [editorNoteKey, routeNoteKey]);
}
