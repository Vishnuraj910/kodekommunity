import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  adminEventCreateSchema,
  adminEventParamsSchema,
  adminEventUpdateSchema,
  adminGroupCreateSchema,
  adminGroupParamsSchema,
  adminGroupUpdateSchema,
  adminOverviewSchema,
  adminPostCreateSchema,
  adminPostParamsSchema,
  adminPostUpdateSchema,
  adminUserCreateSchema,
  adminUserParamsSchema,
  adminUserSchema,
  adminUserUpdateSchema,
  errorSchema,
  eventSchema,
  groupSchema,
  idempotencyHeadersSchema,
  postSchema,
} from "../schemas/api.js";
import {
  createAdminEvent,
  createAdminGroup,
  createAdminPost,
  createAdminUser,
  deleteAdminEvent,
  deleteAdminGroup,
  deleteAdminPost,
  getAdminOverview,
  revokeAdminUser,
  updateAdminEvent,
  updateAdminGroup,
  updateAdminPost,
  updateAdminUser,
} from "../services/admin.js";

export const adminRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/admin",
    {
      preHandler: fastify.authenticate,
      schema: {
        tags: ["Administration"],
        summary: "Load the root administration directory",
        security: [{ CookieSession: [] }, { DemoUser: [] }],
        response: {
          200: adminOverviewSchema,
          401: errorSchema,
          403: errorSchema,
        },
      },
    },
    async (request) => getAdminOverview(fastify.prisma, request.auth),
  );

  fastify.post(
    "/admin/users",
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: {
        tags: ["Administration"],
        summary: "Create an invited user with the baseline user role",
        security: [{ CookieSession: [] }, { DemoUser: [] }],
        headers: idempotencyHeadersSchema,
        body: adminUserCreateSchema,
        response: {
          201: adminUserSchema,
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
          409: errorSchema,
          429: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await createAdminUser(
        fastify.prisma,
        request.auth,
        request.body,
        request.headers["idempotency-key"],
      );
      if (result.replayed) reply.header("Idempotent-Replayed", "true");
      return reply.code(201).send(result.value);
    },
  );

  fastify.patch(
    "/admin/users/:userId",
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        tags: ["Administration"],
        summary: "Update a user identity",
        security: [{ CookieSession: [] }, { DemoUser: [] }],
        headers: idempotencyHeadersSchema,
        params: adminUserParamsSchema,
        body: adminUserUpdateSchema,
        response: {
          200: adminUserSchema,
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
      const result = await updateAdminUser(
        fastify.prisma,
        request.auth,
        request.params.userId,
        request.body,
        request.headers["idempotency-key"],
      );
      if (result.replayed) reply.header("Idempotent-Replayed", "true");
      return result.value;
    },
  );

  fastify.delete(
    "/admin/users/:userId",
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: {
        tags: ["Administration"],
        summary: "Revoke a user and every active session",
        security: [{ CookieSession: [] }, { DemoUser: [] }],
        headers: idempotencyHeadersSchema,
        params: adminUserParamsSchema,
        response: {
          204: z.null(),
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
      const result = await revokeAdminUser(
        fastify.prisma,
        request.auth,
        request.params.userId,
        request.headers["idempotency-key"],
      );
      if (result.replayed) reply.header("Idempotent-Replayed", "true");
      return reply.code(204).send(null);
    },
  );

  fastify.post(
    "/admin/events",
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: {
        tags: ["Administration"],
        summary: "Create an event",
        security: [{ CookieSession: [] }, { DemoUser: [] }],
        headers: idempotencyHeadersSchema,
        body: adminEventCreateSchema,
        response: {
          201: eventSchema,
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
      const result = await createAdminEvent(
        fastify.prisma,
        request.auth,
        request.body,
        request.headers["idempotency-key"],
      );
      if (result.replayed) reply.header("Idempotent-Replayed", "true");
      return reply.code(201).send(result.value);
    },
  );

  fastify.patch(
    "/admin/events/:eventId",
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        tags: ["Administration"],
        summary: "Update an event",
        security: [{ CookieSession: [] }, { DemoUser: [] }],
        headers: idempotencyHeadersSchema,
        params: adminEventParamsSchema,
        body: adminEventUpdateSchema,
        response: {
          200: eventSchema,
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
      const result = await updateAdminEvent(
        fastify.prisma,
        request.auth,
        request.params.eventId,
        request.body,
        request.headers["idempotency-key"],
      );
      if (result.replayed) reply.header("Idempotent-Replayed", "true");
      return result.value;
    },
  );

  fastify.delete(
    "/admin/events/:eventId",
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: {
        tags: ["Administration"],
        summary: "Soft-delete an event",
        security: [{ CookieSession: [] }, { DemoUser: [] }],
        headers: idempotencyHeadersSchema,
        params: adminEventParamsSchema,
        response: {
          204: z.null(),
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
      const result = await deleteAdminEvent(
        fastify.prisma,
        request.auth,
        request.params.eventId,
        request.headers["idempotency-key"],
      );
      if (result.replayed) reply.header("Idempotent-Replayed", "true");
      return reply.code(204).send(null);
    },
  );

  fastify.post(
    "/admin/posts",
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        tags: ["Administration"],
        summary: "Create a post",
        security: [{ CookieSession: [] }, { DemoUser: [] }],
        headers: idempotencyHeadersSchema,
        body: adminPostCreateSchema,
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
      const result = await createAdminPost(
        fastify.prisma,
        request.auth,
        request.body,
        request.headers["idempotency-key"],
      );
      if (result.replayed) reply.header("Idempotent-Replayed", "true");
      return reply.code(201).send(result.value);
    },
  );

  fastify.patch(
    "/admin/posts/:postId",
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 40, timeWindow: "1 minute" } },
      schema: {
        tags: ["Administration"],
        summary: "Update a post",
        security: [{ CookieSession: [] }, { DemoUser: [] }],
        headers: idempotencyHeadersSchema,
        params: adminPostParamsSchema,
        body: adminPostUpdateSchema,
        response: {
          200: postSchema,
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
      const result = await updateAdminPost(
        fastify.prisma,
        request.auth,
        request.params.postId,
        request.body,
        request.headers["idempotency-key"],
      );
      if (result.replayed) reply.header("Idempotent-Replayed", "true");
      return result.value;
    },
  );

  fastify.delete(
    "/admin/posts/:postId",
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        tags: ["Administration"],
        summary: "Soft-delete a post",
        security: [{ CookieSession: [] }, { DemoUser: [] }],
        headers: idempotencyHeadersSchema,
        params: adminPostParamsSchema,
        response: {
          204: z.null(),
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
      const result = await deleteAdminPost(
        fastify.prisma,
        request.auth,
        request.params.postId,
        request.headers["idempotency-key"],
      );
      if (result.replayed) reply.header("Idempotent-Replayed", "true");
      return reply.code(204).send(null);
    },
  );

  fastify.post(
    "/admin/groups",
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: {
        tags: ["Administration"],
        summary: "Create a group",
        security: [{ CookieSession: [] }, { DemoUser: [] }],
        headers: idempotencyHeadersSchema,
        body: adminGroupCreateSchema,
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
      const result = await createAdminGroup(
        fastify.prisma,
        request.auth,
        request.body,
        request.headers["idempotency-key"],
      );
      if (result.replayed) reply.header("Idempotent-Replayed", "true");
      return reply.code(201).send(result.value);
    },
  );

  fastify.patch(
    "/admin/groups/:groupId",
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        tags: ["Administration"],
        summary: "Update a group",
        security: [{ CookieSession: [] }, { DemoUser: [] }],
        headers: idempotencyHeadersSchema,
        params: adminGroupParamsSchema,
        body: adminGroupUpdateSchema,
        response: {
          200: groupSchema,
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
      const result = await updateAdminGroup(
        fastify.prisma,
        request.auth,
        request.params.groupId,
        request.body,
        request.headers["idempotency-key"],
      );
      if (result.replayed) reply.header("Idempotent-Replayed", "true");
      return result.value;
    },
  );

  fastify.delete(
    "/admin/groups/:groupId",
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: {
        tags: ["Administration"],
        summary: "Soft-delete a group and its child content",
        security: [{ CookieSession: [] }, { DemoUser: [] }],
        headers: idempotencyHeadersSchema,
        params: adminGroupParamsSchema,
        response: {
          204: z.null(),
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
      const result = await deleteAdminGroup(
        fastify.prisma,
        request.auth,
        request.params.groupId,
        request.headers["idempotency-key"],
      );
      if (result.replayed) reply.header("Idempotent-Replayed", "true");
      return reply.code(204).send(null);
    },
  );
};
