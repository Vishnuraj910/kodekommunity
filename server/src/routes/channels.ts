import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  channelPageSchema,
  channelRequestSchema,
  channelSchema,
  communityParamsSchema,
  errorSchema,
  idempotencyHeadersSchema,
  paginationQuerySchema,
} from "../schemas/api.js";
import { createChannel, listChannels } from "../services/channels.js";

export const channelRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/communities/:communityId/channels",
    {
      preHandler: fastify.authenticate,
      schema: {
        tags: ["Channels"],
        summary: "List channels in which the identity participates",
        security: [{ CookieSession: [] }, { DemoUser: [] }],
        params: communityParamsSchema,
        querystring: paginationQuerySchema,
        response: {
          200: channelPageSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request) =>
      listChannels(
        fastify.prisma,
        request.auth,
        request.params.communityId,
        request.query.limit,
        request.query.cursor,
      ),
  );

  fastify.post(
    "/communities/:communityId/channels",
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        tags: ["Channels"],
        summary: "Create a participant-scoped community or group channel",
        security: [{ CookieSession: [] }, { DemoUser: [] }],
        params: communityParamsSchema,
        headers: idempotencyHeadersSchema,
        body: channelRequestSchema,
        response: {
          201: channelSchema,
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
      const result = await createChannel(
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
