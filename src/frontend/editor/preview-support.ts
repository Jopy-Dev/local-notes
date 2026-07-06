import { useEffect, useState } from "react";
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

/* Copy-mark clipboard text + affordance mounts live in copy-mounts.ts. */
