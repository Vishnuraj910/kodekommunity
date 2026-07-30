import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import type { AppConfig } from "./config/env.js";
import { AppError } from "./domain/errors.js";
import { authPlugin } from "./plugins/auth.js";
import { openApiPlugin } from "./plugins/openapi.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { accessRoutes } from "./routes/access.js";
import { bootstrapRoutes } from "./routes/bootstrap.js";
import { communityRoutes } from "./routes/communities.js";
import { eventRoutes } from "./routes/events.js";
import { healthRoutes } from "./routes/health.js";
import { messageRoutes } from "./routes/messages.js";

export const buildApp = async (config: AppConfig) => {
  const app = Fastify({
    logger: { level: config.LOG_LEVEL },
    bodyLimit: 64 * 1024,
    requestIdHeader: false,
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate("config", config);

  await app.register(cors, {
    origin: config.CLIENT_ORIGIN,
    methods: ["GET", "POST", "PUT"],
    allowedHeaders: ["content-type", "idempotency-key", "x-kommunity-user-id"],
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    keyGenerator: (request) => request.ip,
  });
  await app.register(openApiPlugin);
  await app.register(prismaPlugin);
  await app.register(authPlugin);

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        requestId: request.id,
      },
    }),
  );
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          requestId: request.id,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      });
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          requestId: request.id,
          details: error.validation,
        },
      });
    }
    if (
      error instanceof Error &&
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      error.statusCode >= 400 &&
      error.statusCode < 500
    ) {
      const errorCode =
        "code" in error && typeof error.code === "string"
          ? error.code
          : "REQUEST_REJECTED";
      return reply.code(error.statusCode).send({
        error: {
          code: errorCode,
          message: error.message,
          requestId: request.id,
        },
      });
    }
    request.log.error({ err: error }, "Unhandled request error");
    return reply.code(500).send({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
        requestId: request.id,
      },
    });
  });

  await app.register(healthRoutes, { prefix: "/api/v1" });
  await app.register(bootstrapRoutes, { prefix: "/api/v1" });
  await app.register(communityRoutes, { prefix: "/api/v1" });
  await app.register(eventRoutes, { prefix: "/api/v1" });
  await app.register(messageRoutes, { prefix: "/api/v1" });
  await app.register(accessRoutes, { prefix: "/api/v1" });

  await app.ready();
  return app;
};
