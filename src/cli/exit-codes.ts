// Stable CLI exit codes (MasterPrompt.md 4.1). Contract for scripts/tests.
export const EXIT_CODES = {
  clean: 0,
  unexpected: 1,
  workspaceLocked: 2,
  portUnavailable: 3,
  invalidConfig: 4,
} as const;

interface CodedError {
  code?: string;
}

export function classifyStartupError(error: unknown): number {
  const code = (error as CodedError)?.code;
  if (code === "EADDRINUSE") return EXIT_CODES.portUnavailable;
  if (code === "WORKSPACE_LOCKED") return EXIT_CODES.workspaceLocked;
  if (code === "CONFIG_INVALID" || code === "WORKSPACE_INVALID") return EXIT_CODES.invalidConfig;
  return EXIT_CODES.unexpected;
}
