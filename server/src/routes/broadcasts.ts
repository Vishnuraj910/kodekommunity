import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  broadcastPageSchema,
  broadcastRequestSchema,
  broadcastSchema,
  communityParamsSchema,
  errorSchema,
  idempotencyHeadersSchema,
  paginationQuerySchema,
} from "../schemas/api.js";
import {
  createBroadcast,
  listBroadcasts,
} from "../services/broadcasts.js";

export const broadcastRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/communities/:communityId/broadcasts",
    {
      preHandler: fastify.authenticate,
      schema: {
        tags: ["Broadcasts"],
        summary: "List community broadcasts visible to the identity",
        security: [{ CookieSession: [] }, { DemoUser: [] }],
        params: communityParamsSchema,
        querystring: paginationQuerySchema,
        response: {
          200: broadcastPageSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request) =>
      listBroadcasts(
        fastify.prisma,
        request.auth,
        request.params.communityId,
        request.query.limit,
        request.query.cursor,
      ),
  );

  fastify.post(
    "/communities/:communityId/broadcasts",
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        tags: ["Broadcasts"],
        summary: "Create a draft or scheduled community broadcast",
        security: [{ CookieSession: [] }, { DemoUser: [] }],
        params: communityParamsSchema,
        headers: idempotencyHeadersSchema,
        body: broadcastRequestSchema,
        response: {
          201: broadcastSchema,
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
      const result = await createBroadcast(
        fastify.prisma,
        request.auth,
        request.params.communityId,
        request.body,
        request.headers["idempotency-key"],
      );
      if (result.replayed) reply.header("Idempotent-Replayed", "true");
      return reply.code(201).send(result.value);
    },
  );
};
