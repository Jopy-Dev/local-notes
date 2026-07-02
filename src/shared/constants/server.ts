// Launch contract: fixed loopback address, never an alternate port (REQ-001).
export const LOCAL_HOST = "127.0.0.1";
export const LOCAL_PORT = 8989;
export const LOCAL_HOST_HEADER = `${LOCAL_HOST}:${LOCAL_PORT}`;
export const LOCAL_ORIGIN = `http://${LOCAL_HOST_HEADER}`;
export const API_PREFIX = "/api/v1";
export const CAPABILITY_HEADER = "x-local-notes-token";
export const BODY_LIMIT_BYTES = 8 * 1024 * 1024;
