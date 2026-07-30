import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  conversationParamsSchema,
  errorSchema,
  idempotencyHeadersSchema,
  messagePageSchema,
  messageRequestSchema,
  messageSchema,
  paginationQuerySchema,
} from "../schemas/api.js";
import { createMessage, listMessages } from "../services/messages.js";

export const messageRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/conversations/:conversationId/messages",
    {
      preHandler: fastify.authenticate,
      schema: {
        tags: ["Messages"],
        summary: "List messages for a conversation participant",
        security: [{ DemoUser: [] }],
        params: conversationParamsSchema,
        querystring: paginationQuerySchema,
        response: {
          200: messagePageSchema,
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request) =>
      listMessages(
        fastify.prisma,
        request.auth,
        request.params.conversationId,
        request.query.limit,
        request.query.cursor,
      ),
  );

  fastify.post(
    "/conversations/:conversationId/messages",
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        tags: ["Messages"],
        summary: "Create a participant-authorized message",
        description:
          "Requires an Idempotency-Key. Reusing a key with the same request replays the original response.",
        security: [{ DemoUser: [] }],
        params: conversationParamsSchema,
        headers: idempotencyHeadersSchema,
        body: messageRequestSchema,
        response: {
          201: messageSchema,
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          409: errorSchema,
          429: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await createMessage(
        fastify.prisma,
        request.auth,
        request.params.conversationId,
        request.body.body,
        request.headers["idempotency-key"],
      );
      if (result.replayed) reply.header("Idempotent-Replayed", "true");
      return reply.code(201).send(result.value);
    },
  );
};
