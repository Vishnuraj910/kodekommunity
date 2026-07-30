import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { AppError } from "../domain/errors.js";
import {
  authResponseSchema,
  emailVerificationQuerySchema,
  errorSchema,
  loginRequestSchema,
  oidcCallbackQuerySchema,
  profileUpdateRequestSchema,
  registrationRequestSchema,
  registrationResponseSchema,
} from "../schemas/api.js";
import {
  currentAuthenticatedUser,
  loginWithPassword,
  registerWithPassword,
  updateAuthenticatedUser,
  verifyEmailAddress,
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
const oidcFlowCookieName = "kommunity_oidc_flow";
const oidcFlowCookieOptions = (secure: boolean) => ({
  ...cookieOptions(secure),
  path: "/api/v1/auth/oidc",
  maxAge: 10 * 60,
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
      const authorization = await beginOidcFlow(fastify);
      reply.setCookie(
        oidcFlowCookieName,
        authorization.state,
        oidcFlowCookieOptions(fastify.config.NODE_ENV === "production"),
      );
      return reply.redirect(authorization.url.href);
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
      const boundState = request.cookies[oidcFlowCookieName];
      reply.clearCookie(
        oidcFlowCookieName,
        oidcFlowCookieOptions(fastify.config.NODE_ENV === "production"),
      );
      if (!boundState || boundState !== request.query.state) {
        throw new AppError(
          401,
          "INVALID_OIDC_FLOW",
          "The OIDC login flow is invalid or expired",
        );
      }
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

  fastify.patch(
    "/auth/profile",
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 20, timeWindow: "15 minutes" } },
      schema: {
        tags: ["Authentication"],
        summary: "Update the authenticated user's profile",
        security: [{ CookieSession: [] }],
        body: profileUpdateRequestSchema,
        response: {
          200: authResponseSchema,
          400: errorSchema,
          401: errorSchema,
          409: errorSchema,
          429: errorSchema,
        },
      },
    },
    async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      return {
        user: await updateAuthenticatedUser(
          fastify,
          request.auth.id,
          request.body,
        ),
      };
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
          201: registrationResponseSchema,
          400: errorSchema,
          409: errorSchema,
          429: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await registerWithPassword(fastify, request.body);
      reply.header("Cache-Control", "no-store");
      if (result.status === "verification_required") {
        return reply.code(201).send(result);
      }
      reply.setCookie(
        fastify.config.SESSION_COOKIE_NAME,
        result.session.token,
        {
          ...cookieOptions(fastify.config.NODE_ENV === "production"),
          expires: result.session.expiresAt,
        },
      );
      return reply.code(201).send({
        status: "authenticated",
        user: result.user,
      });
    },
  );

  fastify.get(
    "/auth/verify-email",
    {
      config: { rateLimit: { max: 30, timeWindow: "15 minutes" } },
      schema: {
        tags: ["Authentication"],
        summary: "Verify an email-and-password account",
        querystring: emailVerificationQuerySchema,
        response: { 400: errorSchema, 429: errorSchema },
      },
    },
    async (request, reply) => {
      await verifyEmailAddress(fastify, request.query.token);
      const destination = new URL("/login", fastify.config.CLIENT_ORIGIN);
      destination.searchParams.set("verified", "1");
      return reply
        .header("Cache-Control", "no-store")
        .redirect(destination.href);
    },
  );

  fastify.post(
    "/auth/login",
    {
      config: { rateLimit: { max: 10, timeWindow: "15 minutes" } },
      schema: {
        tags: ["Authentication"],
        summary: "Log in with email or username and password",
        description: "Secondary login method when OIDC is not used.",
        body: loginRequestSchema,
        response: {
          200: authResponseSchema,
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
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
