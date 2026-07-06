/*
 * Markdown source formatting commands (user feedback round 2, REQ-016):
 * pure text transformations the Source-mode toolbar dispatches into
 * CodeMirror. Each command takes the current document + selection and
 * returns original-document change spans plus the post-edit selection, so
 * the caller keeps undo history and cursor mapping intact.
 */
export type MarkdownCommandId =
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "copy-mark"
  | "h1"
  | "h2"
  | "h3"
  | "bullet-list"
  | "ordered-list"
  | "task-list"
  | "link"
  | "table"
  | "code-block";

export interface CommandSelection {
  from: number;
  to: number;
}

export interface CommandChange {
  from: number;
  to: number;
  insert: string;
}

export interface CommandResult {
  /* Spans are positions in the ORIGINAL document (CodeMirror ChangeSpec). */
  changes: CommandChange[];
  selection: { anchor: number; head: number };
}

interface WrapPair {
  prefix: string;
  suffix: string;
  /* Guard: never unwrap when the inner text still starts with this (keeps
   * italic's single `*` from eating one star of a bold `**` wrap). */
  unwrapBlockedBy?: string;
}

const WRAPS: Record<"bold" | "italic" | "underline" | "strike" | "copy-mark", WrapPair> = {
  bold: { prefix: "**", suffix: "**" },
  italic: { prefix: "*", suffix: "*", unwrapBlockedBy: "**" },
  underline: { prefix: "<u>", suffix: "</u>" },
  strike: { prefix: "~~", suffix: "~~" },
  "copy-mark": { prefix: "<copy>", suffix: "</copy>" },
};

const TABLE_TEMPLATE = "| Column 1 | Column 2 |\n| --- | --- |\n|  |  |";

function surrounds(doc: string, sel: CommandSelection, marker: string | undefined): boolean {
  if (marker === undefined) return false;
  const selected = doc.slice(sel.from, sel.to);
  if (selected.startsWith(marker) && selected.endsWith(marker)) return true;
  return (
    doc.slice(Math.max(0, sel.from - marker.length), sel.from) === marker &&
    doc.slice(sel.to, sel.to + marker.length) === marker
  );
}

/* Unwrap when the selection itself carries the markers. */
function unwrapInner(doc: string, sel: CommandSelection, pair: WrapPair): CommandResult | null {
  const selected = doc.slice(sel.from, sel.to);
  const carries =
    selected.length >= pair.prefix.length + pair.suffix.length &&
    selected.startsWith(pair.prefix) &&
    selected.endsWith(pair.suffix);
  if (!carries) return null;
  const inner = selected.slice(pair.prefix.length, selected.length - pair.suffix.length);
  return {
    changes: [{ from: sel.from, to: sel.to, insert: inner }],
    selection: { anchor: sel.from, head: sel.from + inner.length },
  };
}

/* Unwrap when the markers sit immediately outside the selection. */
function unwrapOuter(doc: string, sel: CommandSelection, pair: WrapPair): CommandResult | null {
  const before = doc.slice(Math.max(0, sel.from - pair.prefix.length), sel.from);
  const after = doc.slice(sel.to, sel.to + pair.suffix.length);
  if (before !== pair.prefix || after !== pair.suffix) return null;
  return {
    changes: [
      { from: sel.from - pair.prefix.length, to: sel.from, insert: "" },
      { from: sel.to, to: sel.to + pair.suffix.length, insert: "" },
    ],
    selection: { anchor: sel.from - pair.prefix.length, head: sel.to - pair.prefix.length },
  };
}

function wrapCommand(doc: string, sel: CommandSelection, pair: WrapPair): CommandResult {
  const blocked = surrounds(doc, sel, pair.unwrapBlockedBy);
  const unwrapped = blocked ? null : (unwrapInner(doc, sel, pair) ?? unwrapOuter(doc, sel, pair));
  if (unwrapped) return unwrapped;
  return {
    changes: [
      { from: sel.from, to: sel.from, insert: pair.prefix },
      { from: sel.to, to: sel.to, insert: pair.suffix },
    ],
    selection: { anchor: sel.from + pair.prefix.length, head: sel.to + pair.prefix.length },
  };
}

function lineSpan(doc: string, sel: CommandSelection): { start: number; end: number } {
  const start = doc.lastIndexOf("\n", sel.from - 1) + 1;
  const newlineAt = doc.indexOf("\n", sel.to);
  return { start, end: newlineAt === -1 ? doc.length : newlineAt };
}

function replaceLines(
  doc: string,
  sel: CommandSelection,
  transform: (lines: string[]) => string[],
): CommandResult {
  const { start, end } = lineSpan(doc, sel);
  const block = transform(doc.slice(start, end).split("\n")).join("\n");
  return {
    changes: [{ from: start, to: end, insert: block }],
    selection: { anchor: start, head: start + block.length },
  };
}

const HEADING_PREFIX = /^#{1,6} /;
const BULLET_PREFIX = /^- (?!\[[ xX]\] )/;
const ORDERED_PREFIX = /^\d+\. /;
const TASK_PREFIX = /^- \[[ xX]\] /;
const ANY_LIST_PREFIX = /^(?:- \[[ xX]\] |- |\* |\+ |\d+\. )/;

function toggleLinePrefix(
  lines: string[],
  isSet: RegExp,
  strip: RegExp,
  make: (index: number) => string,
): string[] {
  const content = lines.filter((line) => line.trim() !== "");
  const allSet = content.length > 0 && content.every((line) => isSet.test(line));
  let ordinal = 0;
  return lines.map((line) => {
    if (line.trim() === "") return line;
    const bare = line.replace(strip, "");
    if (allSet) return bare;
    ordinal += 1;
    return make(ordinal) + bare;
  });
}

function headingCommand(doc: string, sel: CommandSelection, level: number): CommandResult {
  const marker = "#".repeat(level) + " ";
  const exact = new RegExp(`^#{${level}} `);
  return replaceLines(doc, sel, (lines) =>
    toggleLinePrefix(lines, exact, HEADING_PREFIX, () => marker),
  );
}

function codeBlockCommand(doc: string, sel: CommandSelection): CommandResult {
  const { start, end } = lineSpan(doc, sel);
  const block = "```\n" + doc.slice(start, end) + "\n```";
  return {
    changes: [{ from: start, to: end, insert: block }],
    selection: { anchor: start, head: start + block.length },
  };
}

function linkCommand(doc: string, sel: CommandSelection): CommandResult {
  const selected = doc.slice(sel.from, sel.to);
  const label = selected === "" ? "text" : selected;
  const insert = `[${label}](url)`;
  const urlStart = sel.from + 1 + label.length + 2;
  return {
    changes: [{ from: sel.from, to: sel.to, insert }],
    selection:
      selected === ""
        ? { anchor: sel.from + 1, head: sel.from + 1 + label.length }
        : { anchor: urlStart, head: urlStart + 3 },
  };
}

function tableCommand(doc: string, sel: CommandSelection): CommandResult {
  const { start, end } = lineSpan(doc, sel);
  const line = doc.slice(start, end);
  // Insert on its own lines after the current one; keep the line intact.
  const insert = line === "" ? TABLE_TEMPLATE : `${line}\n\n${TABLE_TEMPLATE}`;
  return {
    changes: [{ from: start, to: end, insert }],
    selection: { anchor: start + insert.length, head: start + insert.length },
  };
}

type CommandHandler = (doc: string, sel: CommandSelection) => CommandResult;

const listHandler =
  (isSet: RegExp, make: (ordinal: number) => string): CommandHandler =>
  (doc, sel) =>
    replaceLines(doc, sel, (lines) => toggleLinePrefix(lines, isSet, ANY_LIST_PREFIX, make));

const HANDLERS: Record<MarkdownCommandId, CommandHandler> = {
  bold: (doc, sel) => wrapCommand(doc, sel, WRAPS.bold),
  italic: (doc, sel) => wrapCommand(doc, sel, WRAPS.italic),
  underline: (doc, sel) => wrapCommand(doc, sel, WRAPS.underline),
  strike: (doc, sel) => wrapCommand(doc, sel, WRAPS.strike),
  "copy-mark": (doc, sel) => wrapCommand(doc, sel, WRAPS["copy-mark"]),
  h1: (doc, sel) => headingCommand(doc, sel, 1),
  h2: (doc, sel) => headingCommand(doc, sel, 2),
  h3: (doc, sel) => headingCommand(doc, sel, 3),
  "bullet-list": listHandler(BULLET_PREFIX, () => "- "),
  "ordered-list": listHandler(ORDERED_PREFIX, (ordinal) => `${ordinal}. `),
  "task-list": listHandler(TASK_PREFIX, () => "- [ ] "),
  link: linkCommand,
  table: tableCommand,
  "code-block": codeBlockCommand,
};

export function applyMarkdownCommand(
  doc: string,
  sel: CommandSelection,
  command: MarkdownCommandId,
): CommandResult {
  return HANDLERS[command](doc, sel);
}
