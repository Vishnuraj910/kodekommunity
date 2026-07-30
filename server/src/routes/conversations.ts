import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  directConversationRequestSchema,
  directConversationSchema,
  errorSchema,
  idempotencyHeadersSchema,
} from "../schemas/api.js";
import { createDirectConversation } from "../services/direct-conversations.js";

export const conversationRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/conversations/direct",
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: {
        tags: ["Messages"],
        summary: "Create or return a canonical direct conversation",
        security: [{ CookieSession: [] }, { DemoUser: [] }],
        headers: idempotencyHeadersSchema,
        body: directConversationRequestSchema,
        response: {
          201: directConversationSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          409: errorSchema,
          429: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await createDirectConversation(
        fastify.prisma,
        request.auth,
        request.body.communityId,
        request.body.targetUserId,
        request.headers["idempotency-key"],
      );
      if (result.replayed) reply.header("Idempotent-Replayed", "true");
      return reply.code(201).send(result.value);
    },
  );
};
