import type { ApiError } from "../../shared/schemas/envelope";
import { getCapability } from "./token";

/*
 * API client: every request carries the capability header; 401 means the
 * session token is stale -> secure relaunch surface (REQ-001).
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const token = getCapability();
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: token ? { "X-Local-Notes-Token": token } : {},
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const error = (body as ApiError).error;
    throw new ApiRequestError(response.status, error?.code ?? "INTERNAL", error?.message ?? "Request failed.");
  }
  return (body as { data: T }).data;
}

export async function apiGet<T>(path: string, options: { signal?: AbortSignal } = {}): Promise<T> {
  return request<T>(path, { signal: options.signal ?? null });
}

export async function apiPost<T>(path: string): Promise<T> {
  return request<T>(path, { method: "POST" });
}
