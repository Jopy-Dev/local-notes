import { InfoIcon } from "../icons";

/*
 * <ReadOnlyBanner> per Design_System.md 9.2 (REQ-014/019): explicit reason
 * text, never color-only; mutation controls stay disabled while visible.
 */
const COPY: Record<"oversized" | "encoding", string> = {
  oversized:
    "This note is larger than 5 MiB and opens read-only. The file on disk is never truncated.",
  encoding:
    "Unsupported encoding: this file is not valid UTF-8. It opens read-only and is never rewritten.",
};

export function ReadOnlyBanner({ reason }: { reason: "oversized" | "encoding" }) {
  return (
    <section
      role="status"
      className="flex items-center gap-2.5 border-b border-border-subtle bg-surface-panel py-2 pr-3 pl-4.5"
    >
      <span className="shrink-0 text-info">
        <InfoIcon size={16} />
      </span>
      <span className="text-xs text-text-secondary">{COPY[reason]}</span>
    </section>
  );
}
