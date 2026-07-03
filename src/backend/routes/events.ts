import type { FastifyInstance } from "fastify";
import { API_PREFIX } from "../../shared/constants/server.js";
import { serializeSseEvent } from "../events/event-bus.js";
import type { EventBus } from "../events/event-bus.js";

/*
 * SSE endpoint (MasterPrompt.md 5.3): text/event-stream with 15s heartbeat.
 * Capability enforcement happens in the shared boundary hook; the browser
 * consumes this with a fetch streaming reader because EventSource cannot set
 * the token header.
 */
const HEARTBEAT_MS = 15_000;

export function registerEventsRoute(
  app: FastifyInstance,
  options: { bus: EventBus; heartbeatMs?: number },
): void {
  app.get(`${API_PREFIX}/events`, (request, reply) => {
    reply.hijack();
    const { raw } = reply;
    raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      connection: "keep-alive",
    });

    raw.write(serializeSseEvent({ type: "workspace.ready" }));
    const unsubscribe = options.bus.subscribe((event) => {
      raw.write(serializeSseEvent(event));
    });
    const heartbeat = setInterval(() => {
      raw.write(":hb\n\n");
    }, options.heartbeatMs ?? HEARTBEAT_MS);

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
    };
    request.raw.on("close", cleanup);
    raw.on("error", cleanup);
  });
}
