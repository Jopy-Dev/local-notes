/*
 * Workspace event bus + SSE framing (MasterPrompt.md 5.3). Events carry keys,
 * versions, and operation IDs - NEVER note content. Reconnect strategy is a
 * full bootstrap refresh; no historical replay.
 */
export type WorkspaceEvent =
  | { type: "workspace.ready" }
  | { type: "note.added"; noteKey: string; version: string; operationId?: string }
  | { type: "note.changed"; noteKey: string; version: string; operationId?: string }
  | { type: "note.renamed"; oldKey: string; noteKey: string; version: string; operationId?: string }
  | { type: "note.removed"; noteKey: string; operationId?: string }
  | { type: "index.status"; status: "unavailable" | "building" | "ready" | "degraded" }
  | { type: "settings.changed" };

export type EventListener = (event: WorkspaceEvent) => void;

export function serializeSseEvent(event: WorkspaceEvent): string {
  const { type, ...payload } = event;
  return `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export class EventBus {
  private readonly listeners = new Set<EventListener>();

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(event: WorkspaceEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
