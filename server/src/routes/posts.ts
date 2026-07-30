import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  communityParamsSchema,
  errorSchema,
  idempotencyHeadersSchema,
  paginationQuerySchema,
  postPageSchema,
  postRequestSchema,
  postSchema,
} from "../schemas/api.js";
import { createPost, listPosts } from "../services/posts.js";

export const postRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/communities/:communityId/posts",
    {
      preHandler: fastify.authenticate,
      schema: {
        tags: ["Posts"],
        summary: "List the posts visible in a community feed",
        security: [{ CookieSession: [] }, { DemoUser: [] }],
        params: communityParamsSchema,
        querystring: paginationQuerySchema,
        response: {
          200: postPageSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request) =>
      listPosts(
        fastify.prisma,
        request.auth,
        request.params.communityId,
        request.query.limit,
        request.query.cursor,
      ),
  );

  fastify.post(
    "/communities/:communityId/posts",
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: {
        tags: ["Posts"],
        summary: "Publish a plain-text community or group post",
        description:
          "Content is stored and rendered as plain text. An Idempotency-Key is required.",
        security: [{ CookieSession: [] }, { DemoUser: [] }],
        params: communityParamsSchema,
        headers: idempotencyHeadersSchema,
        body: postRequestSchema,
        response: {
          201: postSchema,
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
      const result = await createPost(
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
