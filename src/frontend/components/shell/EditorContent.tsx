import type { EditorMode } from "../ui/EditorModeTabs";

/*
 * Static source + preview panes for the app-shell parity screen. Real editors
 * (CodeMirror source, TipTap visual, sanitized preview) land at Step 14.
 * Parity source: app-shell.html editor-workspace.
 */
const LINE_COUNT = 16;

function SourcePane() {
  return (
    <div
      aria-label="Markdown source"
      className="min-h-0 min-w-0 overflow-auto border-r border-border-subtle bg-surface-code [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin]"
    >
      <div className="grid min-h-full grid-cols-[44px_minmax(0,1fr)] pt-5.5 pb-20">
        <div
          aria-hidden="true"
          className="pr-2.5 text-right font-mono text-sm leading-[1.7] text-text-disabled select-none"
        >
          {Array.from({ length: LINE_COUNT }, (_, index) => (
            <span key={index}>
              {index + 1}
              <br />
            </span>
          ))}
        </div>
        <div className="max-w-[76ch] pr-7 pl-2 font-mono text-ui leading-[1.7] whitespace-pre-wrap text-text-source desktop:pr-7">
          <span className="text-accent"># Local Notes architecture</span>
          {"\n\n"}
          Local Notes runs as one local Node.js process. Fastify serves the React app and a worker
          thread maintains the search index.
          {"\n\n"}
          <span className="text-accent">## Runtime contract</span>
          {"\n\n"}
          <span className="text-text-muted">-</span> Bind only to{" "}
          <span className="text-info underline underline-offset-2">127.0.0.1:8989</span>.{"\n"}
          <span className="text-text-muted">-</span> Keep the filesystem as the source of truth.
          {"\n"}
          <span className="text-text-muted">-</span> Open the browser after health checks pass.
          {"\n"}
          <span className="text-text-muted">-</span> Shut down cleanly when the CLI process exits.
          {"\n\n"}
          <span className="text-accent">## Content safety</span>
          {"\n\n"}
          Writes use a temporary sibling file, flush, and atomic replacement. External edits pause
          autosave until the user explicitly reloads or overwrites.
          {"\n\n"}
          <span className="text-text-muted">&gt;</span> The interface must never hide uncertainty
          about which version is on disk.
        </div>
      </div>
    </div>
  );
}

function PreviewPane() {
  return (
    <article
      aria-label="Rendered note"
      className="min-h-0 min-w-0 overflow-auto bg-surface-editor [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin]"
    >
      <div className="mx-auto w-[min(68ch,calc(100%-64px))] pt-11 pb-25">
        <h1 className="mb-6.5 text-display font-heading tracking-title text-text-primary">
          Local Notes architecture
        </h1>
        <p className="mb-4 text-body leading-relaxed text-text-secondary">
          Local Notes runs as one local Node.js process. Fastify serves the React app and a worker
          thread maintains the search index.
        </p>
        <h2 className="mt-7.5 mb-3 text-h3 font-heading text-text-primary">Runtime contract</h2>
        <ul className="mb-4.5 list-disc space-y-1.5 pl-5.5 text-body leading-relaxed text-text-secondary">
          <li>
            Bind only to{" "}
            <code className="rounded-sm border border-border-subtle bg-surface-code px-1 py-0.5 font-mono text-[0.9em] text-text-code">
              127.0.0.1:8989
            </code>
            .
          </li>
          <li>Keep the filesystem as the source of truth.</li>
          <li>Open the browser after health checks pass.</li>
          <li>Shut down cleanly when the CLI process exits.</li>
        </ul>
        <h2 className="mt-7.5 mb-3 text-h3 font-heading text-text-primary">Content safety</h2>
        <p className="mb-4 text-body leading-relaxed text-text-secondary">
          Writes use a temporary sibling file, flush, and atomic replacement. External edits pause
          autosave until the user explicitly reloads or overwrites.
        </p>
        <blockquote className="my-5 rounded-control border border-border-subtle bg-surface-panel px-3.5 py-2.5 text-body leading-relaxed text-text-secondary">
          The interface must never hide uncertainty about which version is on disk.
        </blockquote>
      </div>
    </article>
  );
}

export function EditorContent({ mode }: { mode: EditorMode }) {
  return (
    <section
      aria-label="Note editor"
      className={
        mode === "split"
          ? "grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] desktop:grid-cols-[minmax(320px,1fr)_minmax(320px,1fr)]"
          : "grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)]"
      }
    >
      {mode !== "read" ? <SourcePane /> : null}
      {mode !== "edit" ? <PreviewPane /> : null}
    </section>
  );
}
