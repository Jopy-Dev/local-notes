import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PmNode } from "@tiptap/pm/model";

/*
 * REQ-036 in the visual editor (user feedback round 1): the preview's
 * click-to-copy affordance now also follows every copy-marked span while
 * editing. A non-editable ProseMirror widget button renders after each mark
 * run; mousedown is swallowed so clicking copies without moving the caret.
 * Same Decoration plugin foundation as find-decorations.ts - a third-party
 * extension stays rejected per arch/core.md 1.1.
 */
export const copyAffordanceKey = new PluginKey<DecorationSet>("copy-affordance");

const COPY_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path></svg>';

interface CopyRun {
  from: number;
  to: number;
  text: string;
}

function copyRuns(doc: PmNode): CopyRun[] {
  const runs: CopyRun[] = [];
  let open: CopyRun | null = null;
  doc.descendants((node, pos) => {
    if (!node.isText) {
      if (!node.isInline) open = null; // block boundary always ends a run
      return true;
    }
    const marked = node.marks.some((mark) => mark.type.name === "copy");
    if (marked) {
      if (open && open.to === pos) {
        open.to = pos + node.nodeSize;
        open.text += node.text ?? "";
      } else {
        open = { from: pos, to: pos + node.nodeSize, text: node.text ?? "" };
        runs.push(open);
      }
    } else {
      open = null;
    }
    return true;
  });
  return runs;
}

function buildWidget(text: string, onCopy: (text: string) => void): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "Copy marked text");
  button.title = "Copy marked text";
  button.contentEditable = "false";
  button.className =
    "copy-affordance mx-0.5 inline-grid h-6 w-6 cursor-pointer place-items-center rounded-control border border-transparent bg-transparent align-middle text-text-secondary hover:bg-surface-hover hover:text-text-primary";
  button.innerHTML = COPY_ICON_SVG;
  // Swallow the press so the caret never moves into the widget.
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", (event) => {
    event.preventDefault();
    onCopy(text);
  });
  return button;
}

function compute(doc: PmNode, onCopy: (text: string) => void): DecorationSet {
  const decorations = copyRuns(doc).map((run) =>
    Decoration.widget(run.to, () => buildWidget(run.text, onCopy), { side: 1 }),
  );
  return DecorationSet.create(doc, decorations);
}

export function createCopyAffordancePlugin(onCopy: (text: string) => void): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: copyAffordanceKey,
    state: {
      init: (_config, state) => compute(state.doc, onCopy),
      apply: (tr, previous) => (tr.docChanged ? compute(tr.doc, onCopy) : previous),
    },
    props: {
      decorations(state) {
        return copyAffordanceKey.getState(state);
      },
    },
  });
}
