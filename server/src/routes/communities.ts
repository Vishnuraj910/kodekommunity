import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  communityParamsSchema,
  errorSchema,
  membershipRequestSchema,
  membershipResponseSchema,
} from "../schemas/api.js";
import { setCommunityMembership } from "../services/communities.js";

export const communityRoutes: FastifyPluginAsyncZod = async (fastify) => {
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
