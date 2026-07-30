import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { AuthenticatedIdentity } from "../domain/authorization.js";
import { toApiIdentityStatus, toApiRoleAssignment } from "./mappers.js";

export const hashSessionToken = (token: string) =>
  createHash("sha256").update(token, "utf8").digest("hex");

export const newSessionToken = () => randomBytes(32).toString("base64url");

export const prepareSession = (ttlHours: number) => {
  const token = newSessionToken();
  return {
    token,
    record: {
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
    },
  };
};

export const createSession = async (
  fastify: FastifyInstance,
  userId: string,
) => {
  const { token, record } = prepareSession(fastify.config.SESSION_TTL_HOURS);
  await fastify.prisma.session.create({
    data: { ...record, userId },
  });
  return { expiresAt: record.expiresAt, token };
};

export const revokeSession = async (
  fastify: FastifyInstance,
  token: string | undefined,
) => {
  if (!token) return;
  await fastify.prisma.session.updateMany({
    where: { tokenHash: hashSessionToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

export const resolveSession = async (
  fastify: FastifyInstance,
  token: string | undefined,
): Promise<AuthenticatedIdentity | null> => {
  if (!token) return null;
  const session = await fastify.prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      expiresAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          status: true,
          roleAssignments: {
            select: {
              role: true,
              scope: true,
              communityId: true,
              eventId: true,
            },
          },
        },
      },
    },
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }

  const status = toApiIdentityStatus(session.user.status);
  if (status !== "active") return null;
  return {
    id: session.user.id,
    status,
    assignments: session.user.roleAssignments.map(toApiRoleAssignment),
  };
};
