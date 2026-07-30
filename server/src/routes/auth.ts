import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  authResponseSchema,
  errorSchema,
  loginRequestSchema,
  oidcCallbackQuerySchema,
  registrationRequestSchema,
} from "../schemas/api.js";
import {
  currentAuthenticatedUser,
  loginWithPassword,
  registerWithPassword,
} from "../services/authentication.js";
import { revokeSession } from "../services/sessions.js";
import {
  beginOidcFlow,
  completeOidcFlow,
} from "../services/oidc-authentication.js";

const cookieOptions = (secure: boolean) => ({
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure,
});

export const authRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/auth/oidc/start",
    {
      config: { rateLimit: { max: 20, timeWindow: "15 minutes" } },
      schema: {
        tags: ["Authentication"],
        summary: "Start the preferred OIDC login or registration flow",
        response: {
          400: errorSchema,
          429: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (_request, reply) => {
      const authorizationUrl = await beginOidcFlow(fastify);
      return reply.redirect(authorizationUrl.href);
    },
  );

  fastify.get(
    "/auth/oidc/callback",
    {
      config: { rateLimit: { max: 30, timeWindow: "15 minutes" } },
      schema: {
        tags: ["Authentication"],
        summary: "Complete the preferred OIDC login or registration flow",
        querystring: oidcCallbackQuerySchema,
        response: {
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
          409: errorSchema,
          429: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const callbackBase =
        fastify.config.OIDC_REDIRECT_URI ?? fastify.config.CLIENT_ORIGIN;
      const result = await completeOidcFlow(
        fastify,
        new URL(request.raw.url ?? "", callbackBase),
        request.query.state,
      );
      reply
        .header("Cache-Control", "no-store")
        .setCookie(fastify.config.SESSION_COOKIE_NAME, result.session.token, {
          ...cookieOptions(fastify.config.NODE_ENV === "production"),
          expires: result.session.expiresAt,
        });
      return reply.redirect(new URL("/", fastify.config.CLIENT_ORIGIN).href);
    },
  );

  fastify.post(
    "/auth/register",
    {
      config: { rateLimit: { max: 8, timeWindow: "15 minutes" } },
      schema: {
        tags: ["Authentication"],
        summary: "Register with email and password",
        description:
          "Secondary registration method. OIDC is the preferred account flow.",
        body: registrationRequestSchema,
        response: {
          201: authResponseSchema,
          400: errorSchema,
          409: errorSchema,
          429: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await registerWithPassword(fastify, request.body);
      reply
        .header("Cache-Control", "no-store")
        .setCookie(fastify.config.SESSION_COOKIE_NAME, result.session.token, {
          ...cookieOptions(fastify.config.NODE_ENV === "production"),
          expires: result.session.expiresAt,
        });
      return reply.code(201).send({ user: result.user });
    },
  );

  fastify.post(
    "/auth/login",
    {
      config: { rateLimit: { max: 10, timeWindow: "15 minutes" } },
      schema: {
        tags: ["Authentication"],
        summary: "Log in with email and password",
        description: "Secondary login method when OIDC is not used.",
        body: loginRequestSchema,
        response: {
          200: authResponseSchema,
          400: errorSchema,
          401: errorSchema,
          429: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await loginWithPassword(fastify, request.body);
      reply
        .header("Cache-Control", "no-store")
        .setCookie(fastify.config.SESSION_COOKIE_NAME, result.session.token, {
          ...cookieOptions(fastify.config.NODE_ENV === "production"),
          expires: result.session.expiresAt,
        });
      return { user: result.user };
    },
  );

  fastify.get(
    "/auth/session",
    {
      preHandler: fastify.authenticate,
      schema: {
        tags: ["Authentication"],
        summary: "Get the current authenticated user",
        security: [{ CookieSession: [] }],
        response: { 200: authResponseSchema, 401: errorSchema },
      },
    },
    async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      return {
        user: await currentAuthenticatedUser(fastify, request.auth.id),
      };
    },
  );

  fastify.post(
    "/auth/logout",
    {
      schema: {
        tags: ["Authentication"],
        summary: "Revoke the current session",
        security: [{ CookieSession: [] }],
        response: { 204: z.null(), 401: errorSchema },
      },
    },
    async (request, reply) => {
      await revokeSession(
        fastify,
        request.cookies[fastify.config.SESSION_COOKIE_NAME],
      );
      reply
        .header("Cache-Control", "no-store")
        .clearCookie(
          fastify.config.SESSION_COOKIE_NAME,
          cookieOptions(fastify.config.NODE_ENV === "production"),
        );
      return reply.code(204).send(null);
    },
  );
};
