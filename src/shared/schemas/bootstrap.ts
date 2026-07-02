import { z } from "zod";
import { configV1Schema } from "./config.js";

// GET /api/v1/bootstrap response (MasterPrompt.md 5.2).
export const bootstrapResponseSchema = z.object({
  config: configV1Schema,
  workspaceDisplayPath: z.string(),
  indexStatus: z.enum(["unavailable", "building", "ready", "degraded"]),
  appVersion: z.string(),
});

export type BootstrapResponse = z.infer<typeof bootstrapResponseSchema>;
