import type { FastifyInstance } from "fastify";
import { LOCAL_HOST, LOCAL_PORT } from "../shared/constants/server.js";

// Bind exact IPv4 loopback only - never localhost, 0.0.0.0, ::, or LAN (ADR-003).
export async function startServer(app: FastifyInstance): Promise<string> {
  await app.listen({ host: LOCAL_HOST, port: LOCAL_PORT });
  return `http://${LOCAL_HOST}:${LOCAL_PORT}`;
}
