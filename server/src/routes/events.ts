import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  errorSchema,
  eventParamsSchema,
  rsvpRequestSchema,
  rsvpResponseSchema,
} from "../schemas/api.js";
import { setRsvp } from "../services/events.js";

export const eventRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.put(
    "/events/:eventId/rsvp",
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        tags: ["Events"],
        summary: "Set the authenticated user's RSVP",
        security: [{ DemoUser: [] }],
        params: eventParamsSchema,
        body: rsvpRequestSchema,
        response: {
          200: rsvpResponseSchema,
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          429: errorSchema,
        },
      },
    },
    async (request) =>
      setRsvp(
        fastify.prisma,
        request.auth,
        request.params.eventId,
        request.body.status,
      ),
  );
};
