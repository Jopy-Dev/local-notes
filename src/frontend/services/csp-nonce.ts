/*
 * Per-response CSP nonce (MasterPrompt.md 7.1): the packaged server injects
 * it into the shell's meta tag; CodeMirror passes it to its runtime
 * <style> injection so style-src holds without 'unsafe-inline'.
 * Under the Vite dev server the placeholder survives and no nonce applies
 * (dev CSP is not enforced there).
 */
const PLACEHOLDER = "__CSP_NONCE__";

export function cspNonce(): string | undefined {
  const content = document
    .querySelector('meta[name="csp-nonce"]')
    ?.getAttribute("content");
  if (!content || content === PLACEHOLDER) return undefined;
  return content;
}
