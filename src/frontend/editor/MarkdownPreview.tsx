import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CopyIcon } from "../components/icons";
import { Button } from "../components/ui/Button";
import { ConfirmationDialog } from "../components/ui/ConfirmationDialog";
import { IconButton } from "../components/ui/IconButton";
import { renderMarkdownPreview } from "../services/contentApi";
import { getCapability } from "../services/token";
import { navigate } from "../services/navigation";
import { copyToClipboard } from "./copy-actions";

/*
 * <MarkdownPreview> per Design_System.md 9.2 (REQ-014): renders ONLY the
 * server-sanitized HTML from /markdown/render. Requests debounce 150ms and
 * abort when stale (MasterPrompt 4.6). Links re-classify client-side (7.2):
 * internal -> route navigation, external -> hostname confirmation, anything
 * else stays inert. Guarded images fetch as blobs with the capability
 * header and swap in as object URLs, revoked on replacement/unmount.
 */
const RENDER_DEBOUNCE_MS = 150;

interface MarkdownPreviewProps {
  source: string;
  noteKey: string;
  onToast: (message: string) => void;
}

/*
 * REQ-036: each sanitized <copy> element gets an inline <IconButton>
 * affordance appended client-side (Design_System.md 9.1) - the sanitized
 * HTML itself never carries button markup. Portal hosts are plain spans
 * inserted after each mark; they vanish with the next innerHTML swap.
 */
interface CopyMount {
  holder: HTMLElement;
  text: string;
}

type PreviewStatus = "loading" | "ready" | "error";

function useRenderedHtml(source: string, noteKey: string) {
  const [html, setHtml] = useState<string | null>(null);
  const [status, setStatus] = useState<PreviewStatus>("loading");
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      if (html === null) setStatus("loading");
      renderMarkdownPreview(source, noteKey, abort.signal)
        .then((preview) => {
          setHtml(preview.html);
          setStatus("ready");
        })
        .catch((error: unknown) => {
          if ((error as { name?: string }).name === "AbortError") return;
          setStatus("error");
        });
    }, RENDER_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
    // html intentionally omitted: it only gates the loading flash on first render.
  }, [source, noteKey, retryTick]);

  return { html, status, retry: () => setRetryTick((tick) => tick + 1) };
}

/* Swap guarded asset <img> tags to capability-fetched object URLs (4.6). */
function hydrateAssetImages(container: HTMLElement): () => void {
  const objectUrls: string[] = [];
  const token = getCapability();
  for (const img of Array.from(container.querySelectorAll<HTMLImageElement>("img"))) {
    const src = img.getAttribute("src") ?? "";
    if (!src.startsWith("/api/v1/assets/")) continue;
    img.removeAttribute("src");
    fetch(src, { headers: token ? { "X-Local-Notes-Token": token } : {} })
      .then(async (response) => {
        if (!response.ok) throw new Error("asset blocked");
        const url = URL.createObjectURL(await response.blob());
        objectUrls.push(url);
        img.src = url;
      })
      .catch(() => {
        const placeholder = document.createElement("span");
        placeholder.setAttribute("data-blocked", "image");
        placeholder.textContent = img.alt ? `Blocked image: ${img.alt}` : "Blocked image";
        img.replaceWith(placeholder);
      });
  }
  return () => {
    for (const url of objectUrls) URL.revokeObjectURL(url);
  };
}

export function MarkdownPreview({ source, noteKey, onToast }: MarkdownPreviewProps) {
  const { html, status, retry } = useRenderedHtml(source, noteKey);
  const articleRef = useRef<HTMLElement | null>(null);
  const [pendingExternal, setPendingExternal] = useState<string | null>(null);
  const [copyMounts, setCopyMounts] = useState<CopyMount[]>([]);

  useEffect(() => {
    const container = articleRef.current;
    if (!container || html === null) return;
    return hydrateAssetImages(container);
  }, [html]);

  useEffect(() => {
    const container = articleRef.current;
    if (!container || html === null) return;
    const mounts: CopyMount[] = [];
    for (const mark of Array.from(container.querySelectorAll("copy"))) {
      const holder = document.createElement("span");
      holder.setAttribute("data-copy-affordance", "");
      mark.after(holder);
      mounts.push({ holder, text: mark.textContent ?? "" });
    }
    setCopyMounts(mounts);
    return () => setCopyMounts([]);
  }, [html]);

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
        dangerouslySetInnerHTML={{ __html: html }}
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
