// Error taxonomy (MasterPrompt.md 7.3). Codes are the API contract; messages
// stay generic - never absolute paths or stack traces (5.1).
export const ErrorCodes = {
  LOCAL_ACCESS_REQUIRED: { status: 401 },
  HOST_NOT_ALLOWED: { status: 403 },
  ORIGIN_NOT_ALLOWED: { status: 403 },
  PATH_OUTSIDE_WORKSPACE: { status: 403 },
  ASSET_BLOCKED: { status: 403 },
  ASSET_NOT_FOUND: { status: 404 },
  NOT_FOUND: { status: 404 },
  NOTE_NOT_FOUND: { status: 404 },
  FOLDER_NOT_FOUND: { status: 404 },
  NOTE_EXISTS: { status: 409 },
  NOTE_CONFLICT: { status: 409 },
  READ_ONLY_NOTE: { status: 409 },
  ARCHIVE_COLLISION: { status: 409 },
  REBUILD_RUNNING: { status: 409 },
  BODY_TOO_LARGE: { status: 413 },
  INVALID_QUERY: { status: 400 },
  INVALID_FILENAME: { status: 422 },
  INVALID_MARKDOWN: { status: 422 },
  INVALID_SETTING: { status: 422 },
  RATE_LIMITED: { status: 429 },
  SEARCH_DEGRADED: { status: 503 },
  NOT_READY: { status: 503 },
  INTERNAL: { status: 500 },
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors: Record<string, string[]> | undefined;

  constructor(code: ErrorCode, message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  get status(): number {
    return ErrorCodes[this.code].status;
  }
}
