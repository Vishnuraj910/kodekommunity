import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  accessDirectorySchema,
  auditPageSchema,
  errorSchema,
  idempotencyHeadersSchema,
  paginationQuerySchema,
  roleChangeRequestSchema,
  roleChangeResponseSchema,
} from "../schemas/api.js";
import {
  changeRole,
  getAccessDirectory,
  listAuditEvents,
} from "../services/access.js";

export const accessRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/access/users",
    {
      preHandler: fastify.authenticate,
      schema: {
        tags: ["Access"],
        summary: "List identities and scoped role assignments",
        security: [{ DemoUser: [] }],
        response: {
          200: accessDirectorySchema,
          401: errorSchema,
          403: errorSchema,
        },
      },
    },
    async (request) => getAccessDirectory(fastify.prisma, request.auth),
  );

  fastify.post(
    "/access/roles",
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: {
        tags: ["Access"],
        summary: "Grant or revoke a scoped role assignment",
        description:
          "Root-only, idempotent, audited operation. The final root and baseline user role are protected.",
        security: [{ DemoUser: [] }],
        headers: idempotencyHeadersSchema,
        body: roleChangeRequestSchema,
        response: {
          200: roleChangeResponseSchema,
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
      const result = await changeRole(
        fastify.prisma,
        request.auth,
        request.body,
        request.headers["idempotency-key"],
      );
      if (result.replayed) reply.header("Idempotent-Replayed", "true");
      return result.value;
    },
  );

  fastify.get(
    "/access/audit",
    {
      preHandler: fastify.authenticate,
      schema: {
        tags: ["Access"],
        summary: "List attributed privileged audit events",
        security: [{ DemoUser: [] }],
        querystring: paginationQuerySchema,
        response: {
          200: auditPageSchema,
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
        },
      },
    },
    async (request) =>
      listAuditEvents(
        fastify.prisma,
        request.auth,
        request.query.limit,
        request.query.cursor,
      ),
  );
};
