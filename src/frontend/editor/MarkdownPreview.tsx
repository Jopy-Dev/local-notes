import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CopyIcon } from "../components/icons";
import { Button } from "../components/ui/Button";
import { ConfirmationDialog } from "../components/ui/ConfirmationDialog";
import { IconButton } from "../components/ui/IconButton";
import { navigate } from "../services/navigation";
import { copyToClipboard } from "./copy-actions";
import type { FindRequest } from "./find-decorations";
import { applyPreviewFind, clearPreviewFind } from "./preview-find";
import { hydrateAssetImages, useCopyMounts, useRenderedHtml } from "./preview-support";

/*
 * <MarkdownPreview> per Design_System.md 9.2 (REQ-014): renders ONLY the
 * server-sanitized HTML from /markdown/render. Debounced render + guarded
 * image hydration live in preview-support. Links re-classify client-side
 * (7.2): internal -> route navigation, external -> hostname confirmation,
 * anything else stays inert.
 */
interface MarkdownPreviewProps {
  source: string;
  noteKey: string;
  onToast: (message: string) => void;
  find?: FindRequest | null;
  onFindMatches?: (total: number) => void;
}

export function MarkdownPreview({ source, noteKey, onToast, ...props }: MarkdownPreviewProps) {
  const { html, status, retry } = useRenderedHtml(source, noteKey);
  const articleRef = useRef<HTMLElement | null>(null);
  const [pendingExternal, setPendingExternal] = useState<string | null>(null);
  const copyMounts = useCopyMounts(articleRef, html);
  const onFindMatchesRef = useRef(props.onFindMatches);
  onFindMatchesRef.current = props.onFindMatches;
  // React re-applies dangerouslySetInnerHTML whenever the prop OBJECT identity
  // changes, even for an identical string - that detaches the useCopyMounts
  // holder spans on every re-render. A stable object keyed on html keeps the
  // sanitized subtree (and the REQ-036 affordance) intact.
  const htmlProp = useMemo(() => (html === null ? null : { __html: html }), [html]);

  useEffect(() => {
    const container = articleRef.current;
    if (!container || html === null) return;
    return hydrateAssetImages(container);
  }, [html]);

  // REQ-035: highlight the rendered article via CSS custom highlights -
  // never by mutating the sanitized subtree (MasterPrompt 7.2).
  useEffect(() => {
    const container = articleRef.current;
    if (!container || html === null) return;
    const result = applyPreviewFind(container, props.find ?? null);
    if (props.find) onFindMatchesRef.current?.(result.total);
    result.activeElement?.scrollIntoView({ block: "nearest" });
    return clearPreviewFind;
  }, [html, props.find]);

  // REQ-036: sanitized HTML never carries button markup - <IconButton>
  // portals render into the useCopyMounts holder spans client-side.
  function copyMarkedText(text: string) {
    void copyToClipboard(text).then((copied) =>
      onToast(copied ? "Text copied" : "Copy failed - clipboard unavailable"),
    );
  }

  function onClick(event: React.MouseEvent<HTMLElement>) {
    const anchor = (event.target as HTMLElement).closest("a");
    if (!anchor) return;
    event.preventDefault();
    const kind = anchor.getAttribute("data-link");
    const href = anchor.getAttribute("href") ?? "";
    // Client-side re-classification (7.2): trust the data-link tag only as a
    // hint; the href shape decides.
    if (kind === "internal" && href.startsWith("/notes/")) {
      navigate(href);
      return;
    }
    if (kind === "external" && /^https?:/i.test(href)) {
      setPendingExternal(href);
    }
  }

  if (status === "error") {
    return (
      <div className="grid min-h-0 min-w-0 place-items-center bg-surface-editor p-6">
        <div className="text-center">
          <p className="text-sm text-text-secondary">The preview could not be rendered.</p>
          <Button size="sm" className="mt-3" onClick={retry}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (html === null) {
    return (
      <div aria-busy="true" className="min-h-0 min-w-0 space-y-3 bg-surface-editor p-6">
        <span className="sr-only">Rendering preview</span>
        {[0, 1, 2].map((row) => (
          <div key={row} aria-hidden className="h-4 animate-pulse rounded-sm bg-surface-panel" />
        ))}
      </div>
    );
  }

  let externalHost = "";
  if (pendingExternal) {
    try {
      externalHost = new URL(pendingExternal).hostname;
    } catch {
      externalHost = "";
    }
  }

  return (
    <>
      {/* Server-sanitized HTML only (MasterPrompt 7.2) - the render route is
          the sanitization boundary; nothing else may reach this sink. */}
      <article
        ref={articleRef}
        aria-label="Rendered note"
        onClick={onClick}
        className="markdown-preview min-h-0 min-w-0 overflow-auto bg-surface-editor px-4.5 py-3 [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin]"
        dangerouslySetInnerHTML={htmlProp ?? undefined}
      />
      {copyMounts.map((mount, index) =>
        createPortal(
          <IconButton
            label="Copy marked text"
            className="mx-0.5 align-middle"
            onClick={() => copyMarkedText(mount.text)}
          >
            <CopyIcon size={14} />
          </IconButton>,
          mount.holder,
          `copy-affordance-${index}`,
        ),
      )}
      <ConfirmationDialog
        open={pendingExternal !== null && externalHost !== ""}
        title="Open external link?"
        details={`This opens ${externalHost} in your default browser. Local-Notes never loads external content on its own.`}
        confirmLabel={`Open ${externalHost}`}
        onConfirm={() => {
          if (pendingExternal) window.open(pendingExternal, "_blank", "noopener,noreferrer");
          setPendingExternal(null);
        }}
        onClose={() => setPendingExternal(null)}
      />
    </>
  );
}
