import type { ApiError } from "../../shared/schemas/envelope";
import { getCapability } from "./token";

/*
 * API client: every request carries the capability header; 401 means the
 * session token is stale -> secure relaunch surface (REQ-001).
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string[]> | undefined;

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

async function request<T>(path: string, init: RequestInit, extraHeaders: Record<string, string> = {}): Promise<T> {
  const token = getCapability();
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { ...(token ? { "X-Local-Notes-Token": token } : {}), ...extraHeaders },
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const error = (body as ApiError).error;
    throw new ApiRequestError(
      response.status,
      error?.code ?? "INTERNAL",
      error?.message ?? "Request failed.",
      error?.fieldErrors,
    );
  }
  return (body as { data: T }).data;
}

export async function apiGet<T>(path: string, options: { signal?: AbortSignal } = {}): Promise<T> {
  return request<T>(path, { signal: options.signal ?? null });
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  if (body === undefined) return request<T>(path, { method: "POST" });
  return request<T>(
    path,
    { method: "POST", body: JSON.stringify(body) },
    { "Content-Type": "application/json" },
  );
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>(
    path,
    { method: "PUT", body: JSON.stringify(body) },
    { "Content-Type": "application/json" },
  );
}

/* Raw text saves (MasterPrompt.md 5.1): note drafts travel as text/plain
 * with the expected version in If-Match and operation ID for suppression. */
export async function apiPutText<T>(
  path: string,
  body: string,
  headers: Record<string, string>,
): Promise<T> {
  return request<T>(
    path,
    { method: "PUT", body },
    { "Content-Type": "text/plain; charset=utf-8", ...headers },
  );
}

/* Raw text posts (MasterPrompt.md 5.1): markdown render requests travel as
 * text/plain with the note key in X-Note-Key; stale previews abort. */
export async function apiPostText<T>(
  path: string,
  body: string,
  headers: Record<string, string>,
  options: { signal?: AbortSignal | undefined } = {},
): Promise<T> {
  return request<T>(
    path,
    { method: "POST", body, signal: options.signal ?? null },
    { "Content-Type": "text/plain; charset=utf-8", ...headers },
  );
}
