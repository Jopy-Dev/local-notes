// Uniform API envelope (MasterPrompt.md 5.1).
export interface ApiSuccess<T> {
  data: T;
  requestId: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
    // ARCHIVE_COLLISION advertises the rename-then-archive recovery (REQ-013).
    renameAllowed?: boolean;
  };
  requestId: string;
}
