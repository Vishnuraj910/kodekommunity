import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { AppError } from "../domain/errors.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import { createSession, prepareSession } from "./sessions.js";

type Registration = {
  displayName: string;
  email: string;
  handle: string;
  password: string;
};

type Login = {
  email: string;
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

const dummyHash = hashPassword("Kommunity timing equalization value");

export const registerWithPassword = async (
  fastify: FastifyInstance,
  registration: Registration,
): Promise<{
  session: { expiresAt: Date; token: string };
  user: AuthenticatedUser;
}> => {
  const passwordHash = await hashPassword(registration.password);
  const session = prepareSession(fastify.config.SESSION_TTL_HOURS);
  try {
    const user = await fastify.prisma.$transaction(async (transaction) => {
      const created = await transaction.user.create({
        data: {
          displayName: registration.displayName,
          email: registration.email,
          handle: registration.handle,
          initials: initialsFor(registration.displayName),
          status: "ACTIVE",
          passwordCredential: { create: { passwordHash } },
          roleAssignments: {
            create: { role: "USER", scope: "PLATFORM" },
          },
          sessions: { create: session.record },
        },
        select: {
          id: true,
          displayName: true,
          email: true,
          handle: true,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: created.id,
          action: "auth.local.registered",
          targetType: "user",
          targetId: created.id,
          metadata: { method: "password" },
        },
      });
      return created;
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
    where: { email: { equals: login.email, mode: "insensitive" } },
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
  if (
    !user ||
    !passwordMatches ||
    user.status !== "ACTIVE" ||
    !user.email
  ) {
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "The email or password is incorrect",
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
