import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  communityParamsSchema,
  errorSchema,
  groupPageSchema,
  groupRequestSchema,
  groupSchema,
  idempotencyHeadersSchema,
  membershipRequestSchema,
  membershipResponseSchema,
  paginationQuerySchema,
} from "../schemas/api.js";
import { setCommunityMembership } from "../services/communities.js";
import { createGroup, listGroups } from "../services/groups.js";

export const communityRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/communities/:communityId/groups",
    {
      preHandler: fastify.authenticate,
      schema: {
        tags: ["Groups"],
        summary: "List groups visible to the authenticated identity",
        security: [{ CookieSession: [] }, { DemoUser: [] }],
        params: communityParamsSchema,
        querystring: paginationQuerySchema,
        response: {
          200: groupPageSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request) =>
      listGroups(
        fastify.prisma,
        request.auth,
        request.params.communityId,
        request.query.limit,
        request.query.cursor,
      ),
  );

  fastify.post(
    "/communities/:communityId/groups",
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        tags: ["Groups"],
        summary: "Create a group as a community administrator",
        security: [{ CookieSession: [] }, { DemoUser: [] }],
        params: communityParamsSchema,
        headers: idempotencyHeadersSchema,
        body: groupRequestSchema,
        response: {
          201: groupSchema,
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
      const result = await createGroup(
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

  fastify.put(
    "/communities/:communityId/membership",
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        tags: ["Communities"],
        summary: "Join or leave a visible community",
        security: [{ DemoUser: [] }],
        params: communityParamsSchema,
        body: membershipRequestSchema,
        response: {
          200: membershipResponseSchema,
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          429: errorSchema,
        },
      },
    },
    async (request) =>
      setCommunityMembership(
        fastify.prisma,
        request.auth,
        request.params.communityId,
        request.body.status,
      ),
  );
};
