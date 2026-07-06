import { useEffect, useState } from "react";
import type { RefObject } from "react";

/*
 * REQ-036: the copied text of a <copy> element. textContent flattens block
 * children without separators, so multi-line copy regions (round 2) walk
 * the sanitized subtree instead: block elements end a line, table cells
 * separate with tabs, <br> breaks - the clipboard keeps the note's shape.
 */
const LINE_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "PRE", "BLOCKQUOTE"]);

function collectCopyText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof Element)) return "";
  if (node.tagName === "BR") return "\n";
  const inner = Array.from(node.childNodes).map(collectCopyText).join("");
  if (node.tagName === "TD" || node.tagName === "TH") return `${inner}\t`;
  if (node.tagName === "TR") return `${inner.replace(/\t$/, "")}\n`;
  if (LINE_TAGS.has(node.tagName)) return `${inner.replace(/\n$/, "")}\n`;
  return inner;
}

export function copyMarkText(mark: Element): string {
  return collectCopyText(mark).replace(/\n$/, "");
}

/*
 * REQ-036: portal hosts for the inline copy affordance - a plain span
 * inserted after each sanitized <copy> element. Hosts vanish with the next
 * innerHTML swap; the component renders <IconButton> portals into them.
 */
export interface CopyMount {
  holder: HTMLElement;
  text: string;
}

export function useCopyMounts(
  articleRef: RefObject<HTMLElement | null>,
  html: string | null,
): CopyMount[] {
  const [copyMounts, setCopyMounts] = useState<CopyMount[]>([]);

  useEffect(() => {
    const container = articleRef.current;
    if (!container || html === null) return;
    const mounts: CopyMount[] = [];
    for (const mark of Array.from(container.querySelectorAll("copy"))) {
      const holder = document.createElement("span");
      holder.setAttribute("data-copy-affordance", "");
      mark.after(holder);
      mounts.push({ holder, text: copyMarkText(mark) });
    }
    setCopyMounts(mounts);
    return () => setCopyMounts([]);
    // articleRef is a stable ref object; html drives re-mount.
  }, [articleRef, html]);

  return copyMounts;
}
