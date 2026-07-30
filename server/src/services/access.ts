import type {
  Prisma,
  PrismaClient,
  RoleName,
  RoleScope,
} from "@prisma/client";
import { can, type AuthenticatedIdentity } from "../domain/authorization.js";
import { AppError } from "../domain/errors.js";
import type {
  ApiRoleAssignment,
  RoleChangeRequest,
} from "../schemas/api.js";
import { runIdempotently } from "./idempotency.js";
import { apiUserSelect, toApiUser } from "./mappers.js";

const toPersistenceAssignment = (
  assignment: ApiRoleAssignment,
): {
  role: RoleName;
  scope: RoleScope;
  communityId: string | null;
  eventId: string | null;
} => {
  switch (assignment.scope) {
    case "platform":
      return {
        role: assignment.role.toUpperCase() as RoleName,
        scope: "PLATFORM",
        communityId: null,
        eventId: null,
      };
    case "community":
      return {
        role: assignment.role.toUpperCase() as RoleName,
        scope: "COMMUNITY",
        communityId: assignment.scopeId,
        eventId: null,
      };
    case "event":
      return {
        role: "PRESENTER",
        scope: "EVENT",
        communityId: null,
        eventId: assignment.scopeId,
      };
  }
};

const assignmentWhere = (
  userId: string,
  assignment: ReturnType<typeof toPersistenceAssignment>,
): Prisma.RoleAssignmentWhereInput => ({
  userId,
  role: assignment.role,
  scope: assignment.scope,
  communityId: assignment.communityId,
  eventId: assignment.eventId,
});

export const getAccessDirectory = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
) => {
  if (!can(identity, "platform:maintain")) {
    throw new AppError(403, "FORBIDDEN", "Platform maintainer access is required");
  }
  const users = await prisma.user.findMany({
    select: apiUserSelect,
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    take: 1000,
  });
  return { users: users.map(toApiUser) };
};

export const changeRole = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  request: RoleChangeRequest,
  idempotencyKey: string,
) => {
  if (!can(identity, "platform:manage")) {
    throw new AppError(403, "FORBIDDEN", "Root access is required");
  }
  return runIdempotently(
    prisma,
    {
      actorUserId: identity.id,
      key: idempotencyKey,
      action: "role:change",
      request,
      statusCode: 200,
    },
    async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext('kommunity:role-directory'))
      `;

      const target = await transaction.user.findUnique({
        where: { id: request.targetUserId },
        select: { id: true },
      });
      if (!target) {
        throw new AppError(404, "IDENTITY_NOT_FOUND", "Identity not found");
      }

      const assignment = toPersistenceAssignment(request.assignment);
      if (assignment.communityId) {
        const community = await transaction.community.findUnique({
          where: { id: assignment.communityId },
          select: { id: true },
        });
        if (!community) {
          throw new AppError(404, "COMMUNITY_NOT_FOUND", "Community not found");
        }
      }
      if (assignment.eventId) {
        const event = await transaction.event.findUnique({
          where: { id: assignment.eventId },
          select: { id: true },
        });
        if (!event) {
          throw new AppError(404, "EVENT_NOT_FOUND", "Event not found");
        }
      }

      const where = assignmentWhere(request.targetUserId, assignment);
      const existing = await transaction.roleAssignment.findFirst({
        where,
        select: { id: true },
      });
      let changed = false;
      if (request.action === "grant" && !existing) {
        await transaction.roleAssignment.create({
          data: {
            userId: request.targetUserId,
            ...assignment,
          },
        });
        changed = true;
      }
      if (request.action === "revoke" && existing) {
        if (assignment.role === "USER") {
          throw new AppError(
            409,
            "BASELINE_ROLE_REQUIRED",
            "The baseline user role cannot be revoked",
          );
        }
        if (assignment.role === "ROOT") {
          const rootCount = await transaction.roleAssignment.count({
            where: {
              role: "ROOT",
              scope: "PLATFORM",
              user: { status: "ACTIVE" },
            },
          });
          if (rootCount <= 1) {
            throw new AppError(
              409,
              "FINAL_ROOT_REQUIRED",
              "The final root assignment cannot be revoked",
            );
          }
        }
        await transaction.roleAssignment.delete({ where: { id: existing.id } });
        changed = true;
      }

      if (changed) {
        await transaction.auditLog.create({
          data: {
            actorUserId: identity.id,
            action: request.action === "grant" ? "role.granted" : "role.revoked",
            targetType: "user",
            targetId: request.targetUserId,
            communityId: assignment.communityId,
            eventId: assignment.eventId,
            idempotencyKey,
            metadata: {
              role: request.assignment.role,
              scope: request.assignment.scope,
              scopeId:
                request.assignment.scope === "platform"
                  ? null
                  : request.assignment.scopeId,
            },
          },
        });
      }
      const updated = await transaction.user.findUniqueOrThrow({
        where: { id: request.targetUserId },
        select: apiUserSelect,
      });
      return { user: toApiUser(updated) };
    },
  );
};

export const listAuditEvents = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  limit: number,
  cursor?: string,
) => {
  if (!can(identity, "platform:manage")) {
    throw new AppError(403, "FORBIDDEN", "Root access is required");
  }
  const records = await prisma.auditLog.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = records.length > limit;
  const page = records.slice(0, limit);
  return {
    items: page.map((record) => ({
      id: record.id,
      actorUserId: record.actorUserId,
      action: record.action,
      targetType: record.targetType,
      targetId: record.targetId,
      communityId: record.communityId,
      eventId: record.eventId,
      idempotencyKey: record.idempotencyKey,
      metadata: record.metadata as Record<string, unknown>,
      createdAt: record.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  };
};
