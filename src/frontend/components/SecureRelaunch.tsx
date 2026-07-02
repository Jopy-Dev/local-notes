import { LockIcon } from "./icons";

/*
 * Capability-missing surface (REQ-001 acceptance): a tab without the current
 * launch token gets a secure relaunch instruction, never workspace data.
 */
export function SecureRelaunch() {
  return (
    <section
      aria-labelledby="relaunch-title"
      className="grid min-h-dvh w-full place-items-center bg-surface-root p-7"
    >
      <div className="w-[min(460px,100%)] rounded-panel border border-border-subtle bg-surface-panel p-6.5">
        <span className="text-info">
          <LockIcon size={24} />
        </span>
        <h1
          id="relaunch-title"
          className="mt-4 text-title font-heading tracking-title text-text-primary"
        >
          Secure relaunch required
        </h1>
        <p className="mt-2 leading-normal text-text-secondary">
          This tab has no active access token. Return to the tab Local-Notes opened, or use the
          one-time launch URL printed in your terminal. Restarting <code className="font-mono">npx
          local-notes</code> issues a fresh URL.
        </p>
      </div>
    </section>
  );
}
