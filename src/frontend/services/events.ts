import { getCapability } from "./token";

/*
 * SSE consumer (MasterPrompt.md 5.3): EventSource cannot set the capability
 * header, so the stream is read with fetch + ReadableStream. Reconnect
 * strategy is a full data refetch by the caller; no event replay.
 */
export interface WorkspaceEventMessage {
  type: string;
  payload: Record<string, unknown>;
}

export function subscribeWorkspaceEvents(
  onEvent: (event: WorkspaceEventMessage) => void,
): () => void {
  const controller = new AbortController();
  const token = getCapability();
  if (!token) return () => undefined;

  void (async () => {
    try {
      const response = await fetch("/api/v1/events", {
        headers: { "X-Local-Notes-Token": token },
        signal: controller.signal,
      });
      const reader = response.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const typeMatch = /^event: (.+)$/m.exec(frame);
          const dataMatch = /^data: (.+)$/m.exec(frame);
          if (typeMatch?.[1] && dataMatch?.[1]) {
            try {
              onEvent({ type: typeMatch[1], payload: JSON.parse(dataMatch[1]) });
            } catch {
              // Malformed frame: skip; stream continues.
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
      }
    } catch {
      // Aborted or connection lost: caller refetches on next subscribe.
    }
  })();

  return () => controller.abort();
}
