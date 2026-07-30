import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { AppError } from "../domain/errors.js";
import { prepareSession } from "./sessions.js";

const flowHash = (state: string) =>
  createHash("sha256").update(state, "utf8").digest("hex");

const initialsFor = (displayName: string) =>
  displayName
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const handleFor = (
  preferredUsername: string | undefined,
  email: string,
  subject: string,
) => {
  const desired = (preferredUsername ?? email.split("@", 1)[0] ?? "member")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
  const suffix = createHash("sha256").update(subject).digest("hex").slice(0, 7);
  return `${(desired || "member").slice(0, 24)}_${suffix}`;
};

export const beginOidcFlow = async (fastify: FastifyInstance) => {
  const authorization = await fastify.oidcClient.authorizationRequest();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await fastify.prisma.$transaction([
    fastify.prisma.oidcFlow.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    }),
    fastify.prisma.oidcFlow.create({
      data: {
        stateHash: flowHash(authorization.state),
        codeVerifier: authorization.codeVerifier,
        nonce: authorization.nonce,
        expiresAt,
      },
    }),
  ]);
  return authorization.url;
};

export const completeOidcFlow = async (
  fastify: FastifyInstance,
  currentUrl: URL,
  state: string,
) => {
  const stateHash = flowHash(state);
  const flow = await fastify.prisma.oidcFlow.findUnique({
    where: { stateHash },
  });
  if (!flow || flow.expiresAt.getTime() <= Date.now()) {
    throw new AppError(
      401,
      "INVALID_OIDC_FLOW",
      "The OIDC login flow is invalid or expired",
    );
  }
  const consumed = await fastify.prisma.oidcFlow.deleteMany({
    where: {
      stateHash,
      codeVerifier: flow.codeVerifier,
      expiresAt: { gt: new Date() },
    },
  });
  if (consumed.count !== 1) {
    throw new AppError(
      401,
      "INVALID_OIDC_FLOW",
      "The OIDC login flow is invalid or expired",
    );
  }

  let profile;
  try {
    profile = await fastify.oidcClient.consumeCallback({
      codeVerifier: flow.codeVerifier,
      currentUrl,
      expectedNonce: flow.nonce,
      expectedState: state,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      401,
      "OIDC_CALLBACK_REJECTED",
      "The identity provider response could not be verified",
    );
  }

  if (
    !profile.emailVerified ||
    (fastify.config.OIDC_ISSUER_URL &&
      new URL(profile.issuer).href !==
        new URL(fastify.config.OIDC_ISSUER_URL).href)
  ) {
    throw new AppError(
      401,
      "OIDC_IDENTITY_UNVERIFIED",
      "The identity provider must supply a verified email",
    );
  }

  const session = prepareSession(fastify.config.SESSION_TTL_HOURS);
  try {
    const user = await fastify.prisma.$transaction(async (transaction) => {
      const identity = await transaction.oidcIdentity.findUnique({
        where: {
          issuer_subject: {
            issuer: profile.issuer,
            subject: profile.subject,
          },
        },
        select: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
              handle: true,
              status: true,
            },
          },
        },
      });

      let authenticatedUser = identity?.user ?? null;
      if (!authenticatedUser) {
        authenticatedUser = await transaction.user.findFirst({
          where: { email: { equals: profile.email, mode: "insensitive" } },
          select: {
            id: true,
            displayName: true,
            email: true,
            handle: true,
            status: true,
          },
        });
      }

      if (!authenticatedUser) {
        const displayName = profile.displayName.trim().slice(0, 120);
        authenticatedUser = await transaction.user.create({
          data: {
            displayName,
            email: profile.email.toLowerCase(),
            handle: handleFor(
              profile.preferredUsername,
              profile.email,
              profile.subject,
            ),
            initials: initialsFor(displayName),
            status: "ACTIVE",
            roleAssignments: {
              create: { role: "USER", scope: "PLATFORM" },
            },
          },
          select: {
            id: true,
            displayName: true,
            email: true,
            handle: true,
            status: true,
          },
        });
      }
      if (authenticatedUser.status !== "ACTIVE" || !authenticatedUser.email) {
        throw new AppError(
          403,
          "IDENTITY_INACTIVE",
          "This identity cannot access the application",
        );
      }

      await transaction.oidcIdentity.upsert({
        where: {
          issuer_subject: {
            issuer: profile.issuer,
            subject: profile.subject,
          },
        },
        create: {
          issuer: profile.issuer,
          subject: profile.subject,
          userId: authenticatedUser.id,
        },
        update: { lastLoginAt: new Date() },
      });
      await transaction.session.create({
        data: { ...session.record, userId: authenticatedUser.id },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: authenticatedUser.id,
          action: identity
            ? "auth.oidc.logged_in"
            : "auth.oidc.registered",
          targetType: "user",
          targetId: authenticatedUser.id,
          metadata: { issuer: profile.issuer },
        },
      });
      return authenticatedUser;
    });
    return {
      session: { expiresAt: session.record.expiresAt, token: session.token },
      user: {
        displayName: user.displayName,
        email: user.email!,
        handle: user.handle,
      },
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        409,
        "OIDC_ACCOUNT_CONFLICT",
        "The OIDC identity cannot be linked to this account",
      );
    }
    throw error;
  }
};
