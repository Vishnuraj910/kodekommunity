import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { bootstrapSchema, errorSchema } from "../schemas/api.js";
import { getBootstrap } from "../services/bootstrap.js";

export const bootstrapRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/bootstrap",
    {
      preHandler: fastify.authenticate,
      schema: {
        tags: ["Bootstrap"],
        summary: "Load visible communities, events, and conversations",
        security: [{ DemoUser: [] }],
        response: {
          200: bootstrapSchema,
          401: errorSchema,
          403: errorSchema,
        },
      },
    },
    async (request) => getBootstrap(fastify.prisma, request.auth.id),
  );
};
