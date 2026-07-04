import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { renderMarkdownPreview } from "../services/contentApi";
import { getCapability } from "../services/token";

/*
 * Preview data support for <MarkdownPreview> (MasterPrompt 4.6): debounced
 * server render with stale-request abort, and guarded-asset hydration that
 * swaps workspace image tags to capability-fetched object URLs.
 */
const RENDER_DEBOUNCE_MS = 150;

export type PreviewStatus = "loading" | "ready" | "error";

export function useRenderedHtml(source: string, noteKey: string) {
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
export function hydrateAssetImages(container: HTMLElement): () => void {
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
      mounts.push({ holder, text: mark.textContent ?? "" });
    }
    setCopyMounts(mounts);
    return () => setCopyMounts([]);
    // articleRef is a stable ref object; html drives re-mount.
  }, [articleRef, html]);

  return copyMounts;
}
