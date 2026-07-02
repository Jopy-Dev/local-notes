import { useSyncExternalStore } from "react";
import { MonitorIcon } from "../icons";

/*
 * <UnsupportedViewport> per Design_System.md 9.2 + 4.3: below 1024x640 the
 * app renders resize guidance instead of the shell - no mobile navigation.
 * Exact current/min dimensions shown (a11y contract).
 */
export const MIN_SUPPORTED = { width: 1024, height: 640 } as const;

const QUERY = `(max-width: ${MIN_SUPPORTED.width - 1}px), (max-height: ${MIN_SUPPORTED.height - 1}px)`;

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  window.addEventListener("resize", onChange);
  return () => {
    mql.removeEventListener("change", onChange);
    window.removeEventListener("resize", onChange);
  };
}

export function useViewportSupported(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !window.matchMedia(QUERY).matches,
    () => true,
  );
}

export function UnsupportedViewport() {
  const size = useSyncExternalStore(
    subscribe,
    () => `${window.innerWidth} × ${window.innerHeight}`,
    () => "",
  );

  return (
    <section
      aria-labelledby="unsupported-title"
      className="grid min-h-dvh w-full place-items-center bg-surface-root p-7"
    >
      <div className="w-[min(460px,100%)] rounded-panel border border-border-subtle bg-surface-panel p-6.5">
        <span className="text-warning">
          <MonitorIcon size={24} />
        </span>
        <h1
          id="unsupported-title"
          className="mt-4 text-title font-heading tracking-title text-text-primary"
        >
          Desktop viewport required
        </h1>
        <p className="mt-2 leading-normal text-text-secondary">
          Local Notes is designed for desktop and laptop browsers. Enlarge this window to at least{" "}
          {MIN_SUPPORTED.width} {"×"} {MIN_SUPPORTED.height}.
        </p>
        <span className="mt-4 inline-block rounded-sm border border-border-subtle px-1.5 py-1 font-mono text-xs text-text-muted">
          {size}
        </span>
      </div>
    </section>
  );
}
