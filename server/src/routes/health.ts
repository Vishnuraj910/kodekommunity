import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

const healthSchema = z.object({
  status: z.enum(["ok", "ready"]),
});

export const healthRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/health/live",
    {
      schema: {
        tags: ["Health"],
        summary: "Process liveness",
        response: { 200: healthSchema },
      },
    },
    async () => ({ status: "ok" as const }),
  );

  fastify.get(
    "/health/ready",
    {
      schema: {
        tags: ["Health"],
        summary: "Database readiness",
        response: { 200: healthSchema },
      },
    },
    async () => {
      await fastify.prisma.$queryRaw`SELECT 1`;
      return { status: "ready" as const };
    },
  );
};
