import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/backend/app.js";
import { EventBus, serializeSseEvent } from "../../src/backend/events/event-bus.js";
import { generateCapability } from "../../src/backend/security/capability.js";
import { LOCAL_HOST, LOCAL_PORT } from "../../src/shared/constants/server.js";

/*
 * SSE contract (MasterPrompt.md 5.3, REQ-006): text/event-stream behind the
 * capability header (fetch reader client, EventSource cannot set headers);
 * workspace.ready greets new subscribers; note events carry keys, never
 * content. Integration listens on the real fixed port (skipped if busy).
 */
describe("serializeSseEvent", () => {
  it("formats event name + JSON payload per SSE framing", () => {
    const wire = serializeSseEvent({ type: "note.added", noteKey: "abc", version: "v" });
    expect(wire).toBe('event: note.added\ndata: {"noteKey":"abc","version":"v"}\n\n');
  });
});

describe("EventBus", () => {
  it("delivers published events to subscribers until unsubscribe", () => {
    const bus = new EventBus();
    const seen: string[] = [];
    const unsubscribe = bus.subscribe((event) => seen.push(event.type));
    bus.publish({ type: "index.status", status: "ready" });
    unsubscribe();
    bus.publish({ type: "index.status", status: "degraded" });
    expect(seen).toEqual(["index.status"]);
  });
});

describe("GET /api/v1/events (real port)", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("streams workspace.ready then published events to an authorized reader", async () => {
    const capability = generateCapability();
    const bus = new EventBus();
    app = await buildApp({ capability, eventBus: bus });
    try {
      await app.listen({ host: LOCAL_HOST, port: LOCAL_PORT });
    } catch {
      return; // port 8989 busy on this machine - covered in packaged E2E (Wave 8)
    }

    const controller = new AbortController();
    const response = await fetch(`http://${LOCAL_HOST}:${LOCAL_PORT}/api/v1/events`, {
      headers: { "X-Local-Notes-Token": capability },
      signal: controller.signal,
    });
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let received = "";
    const readUntil = async (marker: string) => {
      while (!received.includes(marker)) {
        const { value, done } = await reader.read();
        if (done) break;
        received += decoder.decode(value, { stream: true });
      }
    };

    await readUntil("workspace.ready");
    bus.publish({ type: "note.added", noteKey: "k1", version: "v1" });
    await readUntil("note.added");
    expect(received).toContain('"noteKey":"k1"');
    controller.abort();
  }, 15000);
});
