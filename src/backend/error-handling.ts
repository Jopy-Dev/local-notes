import type { FastifyInstance } from "fastify";
import { AppError } from "../shared/errors/codes.js";
import type { ApiError } from "../shared/schemas/envelope.js";

// Uniform envelope + taxonomy mapping (MasterPrompt.md 5.1, 7.3): known errors
// map to code/status; unknown errors log the stack locally, return generic copy.
export function errorBody(error: AppError, requestId: string): ApiError {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
    },
    requestId,
  };
}

export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.status).send(errorBody(error, request.id));
    }
    request.log.error(error);
    return reply
      .status(500)
      .send(errorBody(new AppError("INTERNAL", "Unexpected local error."), request.id));
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send(errorBody(new AppError("NOT_FOUND", "Route not found."), request.id));
  });
}
