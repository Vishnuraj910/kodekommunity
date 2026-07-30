import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { AppError } from "../domain/errors.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import { createSession, prepareSession } from "./sessions.js";

type Registration = {
  displayName: string;
  email: string;
  password: string;
};

type Login = {
  identifier: string;
  password: string;
};

type AuthenticatedUser = {
  displayName: string;
  email: string;
  handle: string;
};

const initialsFor = (displayName: string) =>
  displayName
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const usernameFor = (displayName: string, email: string) => {
  const base = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 23);
  const suffix = createHash("sha256").update(email).digest("hex").slice(0, 8);
  return `${base || "member"}_${suffix}`;
};

const dummyHash = hashPassword("Kommunity timing equalization value");

export const registerWithPassword = async (
  fastify: FastifyInstance,
  registration: Registration,
): Promise<
  | {
      status: "authenticated";
      session: { expiresAt: Date; token: string };
      user: AuthenticatedUser;
    }
  | { status: "verification_required"; username: string }
> => {
  const passwordHash = await hashPassword(registration.password);
  const autoActivate = fastify.config.EMAIL_VERIFICATION_MODE === "auto";
  const session = autoActivate
    ? prepareSession(fastify.config.SESSION_TTL_HOURS)
    : undefined;
  const verificationToken = autoActivate
    ? undefined
    : randomBytes(32).toString("base64url");
  const verificationTokenHash = verificationToken
    ? createHash("sha256").update(verificationToken).digest("hex")
    : undefined;
  let claimedInvitation = false;
  try {
    const result = await fastify.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtext(${`kommunity:registration:${registration.email.toLowerCase()}`})
        )
      `;
      const existing = await transaction.user.findFirst({
        where: {
          email: { equals: registration.email, mode: "insensitive" },
        },
        select: {
          id: true,
          status: true,
          passwordCredential: { select: { userId: true } },
        },
      });
      if (
        existing &&
        (existing.status !== "INVITED" || existing.passwordCredential)
      ) {
        throw new AppError(
          409,
          "ACCOUNT_ALREADY_EXISTS",
          "An account with those details already exists",
        );
      }
      const authenticationData = {
        status: autoActivate ? ("ACTIVE" as const) : ("INVITED" as const),
        passwordCredential: { create: { passwordHash } },
        ...(session ? { sessions: { create: session.record } } : {}),
        ...(verificationTokenHash
          ? {
              emailVerifications: {
                create: {
                  tokenHash: verificationTokenHash,
                  expiresAt: new Date(
                    Date.now() +
                      fastify.config.EMAIL_VERIFICATION_TTL_HOURS *
                        60 *
                        60 *
                        1000,
                  ),
                },
              },
            }
          : {}),
      };
      const user = existing
        ? await transaction.user.update({
            where: { id: existing.id },
            data: authenticationData,
            select: {
              id: true,
              displayName: true,
              email: true,
              handle: true,
            },
          })
        : await transaction.user.create({
            data: {
              displayName: registration.displayName,
              email: registration.email,
              handle: usernameFor(registration.displayName, registration.email),
              initials: initialsFor(registration.displayName),
              ...authenticationData,
              roleAssignments: {
                create: { role: "USER", scope: "PLATFORM" },
              },
            },
            select: {
              id: true,
              displayName: true,
              email: true,
              handle: true,
            },
          });
      claimedInvitation = Boolean(existing);
      await transaction.auditLog.create({
        data: {
          actorUserId: user.id,
          action: existing
            ? "auth.local.invitation_claimed"
            : "auth.local.registered",
          targetType: "user",
          targetId: user.id,
          metadata: {
            method: "password",
            verificationRequired: !autoActivate,
          },
        },
      });
      return user;
    });
    const user = result;
    if (!session && verificationToken && verificationTokenHash) {
      try {
        await fastify.verificationMailer.sendVerificationEmail({
          email: user.email!,
          username: user.handle,
          verificationUrl: new URL(
            `/api/v1/auth/verify-email?token=${encodeURIComponent(verificationToken)}`,
            fastify.config.API_PUBLIC_URL,
          ).href,
          idempotencyKey: verificationTokenHash,
        });
      } catch {
        if (claimedInvitation) {
          await fastify.prisma.$transaction([
            fastify.prisma.emailVerification.deleteMany({
              where: { tokenHash: verificationTokenHash },
            }),
            fastify.prisma.passwordCredential.deleteMany({
              where: { userId: user.id },
            }),
            fastify.prisma.auditLog.deleteMany({
              where: {
                actorUserId: user.id,
                action: "auth.local.invitation_claimed",
              },
            }),
          ]);
        } else {
          await fastify.prisma.$transaction(async (transaction) => {
            await transaction.auditLog.deleteMany({
              where: {
                actorUserId: user.id,
                action: "auth.local.registered",
              },
            });
            await transaction.user.delete({ where: { id: user.id } });
          });
        }
        throw new AppError(
          503,
          "VERIFICATION_DELIVERY_FAILED",
          "The verification email could not be sent. Please try again.",
        );
      }
      return { status: "verification_required", username: user.handle };
    }
    if (!session) {
      throw new Error("Registration session was not prepared");
    }
    return {
      status: "authenticated",
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
        "ACCOUNT_ALREADY_EXISTS",
        "An account with those details already exists",
      );
    }
    throw error;
  }
};

export const loginWithPassword = async (
  fastify: FastifyInstance,
  login: Login,
): Promise<{
  session: { expiresAt: Date; token: string };
  user: AuthenticatedUser;
}> => {
  const user = await fastify.prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: login.identifier, mode: "insensitive" } },
        { handle: { equals: login.identifier, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      displayName: true,
      email: true,
      handle: true,
      status: true,
      passwordCredential: { select: { passwordHash: true } },
    },
  });
  const passwordHash = user?.passwordCredential?.passwordHash ?? (await dummyHash);
  const passwordMatches = await verifyPassword(login.password, passwordHash);
  if (user && passwordMatches && user.status === "INVITED") {
    throw new AppError(
      403,
      "EMAIL_VERIFICATION_REQUIRED",
      "Verify your email address before logging in",
    );
  }
  if (
    !user ||
    !passwordMatches ||
    user.status !== "ACTIVE" ||
    !user.email
  ) {
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "The email, username, or password is incorrect",
    );
  }

  const session = await createSession(fastify, user.id);
  return {
    session,
    user: {
      displayName: user.displayName,
      email: user.email,
      handle: user.handle,
    },
  };
};

export const verifyEmailAddress = async (
  fastify: FastifyInstance,
  token: string,
): Promise<void> => {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const verification = await fastify.prisma.emailVerification.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      consumedAt: true,
    },
  });
  if (
    !verification ||
    verification.consumedAt ||
    verification.expiresAt <= new Date()
  ) {
    throw new AppError(
      400,
      "INVALID_VERIFICATION_LINK",
      "This verification link is invalid or has expired",
    );
  }

  const now = new Date();
  await fastify.prisma.$transaction(async (transaction) => {
    const consumed = await transaction.emailVerification.updateMany({
      where: {
        id: verification.id,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) {
      throw new AppError(
        400,
        "INVALID_VERIFICATION_LINK",
        "This verification link is invalid or has expired",
      );
    }
    const activated = await transaction.user.updateMany({
      where: { id: verification.userId, status: "INVITED" },
      data: { status: "ACTIVE" },
    });
    if (activated.count !== 1) {
      throw new AppError(
        400,
        "INVALID_VERIFICATION_LINK",
        "This verification link is invalid or has expired",
      );
    }
    await transaction.auditLog.create({
      data: {
        actorUserId: verification.userId,
        action: "auth.email.verified",
        targetType: "user",
        targetId: verification.userId,
        metadata: { method: "verification_link" },
      },
    });
  });
};

export const currentAuthenticatedUser = async (
  fastify: FastifyInstance,
  userId: string,
): Promise<AuthenticatedUser> => {
  const user = await fastify.prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, email: true, handle: true },
  });
  if (!user?.email) {
    throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  }
  return user as AuthenticatedUser;
};

export const updateAuthenticatedUser = async (
  fastify: FastifyInstance,
  userId: string,
  input: { displayName: string; username: string },
): Promise<AuthenticatedUser> => {
  try {
    return await fastify.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.update({
        where: { id: userId },
        data: {
          displayName: input.displayName,
          handle: input.username,
          initials: initialsFor(input.displayName),
        },
        select: {
          displayName: true,
          email: true,
          handle: true,
        },
      });
      if (!user.email) {
        throw new AppError(
          400,
          "PROFILE_UPDATE_REJECTED",
          "This profile cannot be updated",
        );
      }
      await transaction.auditLog.create({
        data: {
          actorUserId: userId,
          action: "auth.profile.updated",
          targetType: "user",
          targetId: userId,
          metadata: { fields: ["displayName", "username"] },
        },
      });
      return user as AuthenticatedUser;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        409,
        "USERNAME_ALREADY_EXISTS",
        "That username is already in use",
      );
    }
    throw error;
  }
};
