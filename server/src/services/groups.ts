import { Prisma, type PrismaClient } from "@prisma/client";
import { can, type AuthenticatedIdentity } from "../domain/authorization.js";
import { AppError } from "../domain/errors.js";
import type { GroupResponse } from "../schemas/api.js";
import { runIdempotently } from "./idempotency.js";

type GroupInput = {
  description: string;
  name: string;
  slug: string;
  visibility: "public" | "private";
};

const groupView = (
  group: {
    id: string;
    communityId: string;
    name: string;
    slug: string;
    description: string;
    visibility: "PUBLIC" | "PRIVATE";
    createdAt: Date;
    _count: { members: number };
    members: { userId: string }[];
  },
): GroupResponse => ({
  id: group.id,
  communityId: group.communityId,
  name: group.name,
  slug: group.slug,
  description: group.description,
  visibility: group.visibility === "PUBLIC" ? "public" : "private",
  memberCount: group._count.members,
  joined: group.members.length > 0,
  createdAt: group.createdAt.toISOString(),
});

export const createGroup = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  communityId: string,
  input: GroupInput,
  idempotencyKey: string,
) => {
  if (!can(identity, "community:manage", { communityId })) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Community administration permission is required",
    );
  }

  try {
    return await runIdempotently<GroupResponse>(
      prisma,
      {
        actorUserId: identity.id,
        key: idempotencyKey,
        action: `group:create:${communityId}`,
        request: { communityId, ...input },
        statusCode: 201,
      },
      async (transaction) => {
        const community = await transaction.community.findUnique({
          where: { id: communityId },
          select: { id: true },
        });
        if (!community) {
          throw new AppError(
            404,
            "COMMUNITY_NOT_FOUND",
            "Community not found",
          );
        }
        const group = await transaction.group.create({
          data: {
            communityId,
            createdById: identity.id,
            description: input.description,
            name: input.name,
            slug: input.slug,
            visibility:
              input.visibility === "public" ? "PUBLIC" : "PRIVATE",
            members: {
              create: { userId: identity.id, status: "ACTIVE" },
            },
          },
          include: {
            _count: {
              select: { members: { where: { status: "ACTIVE" } } },
            },
            members: {
              where: { userId: identity.id, status: "ACTIVE" },
              select: { userId: true },
            },
          },
        });
        await transaction.auditLog.create({
          data: {
            actorUserId: identity.id,
            action: "group.created",
            targetType: "group",
            targetId: group.id,
            communityId,
            idempotencyKey,
            metadata: { visibility: input.visibility },
          },
        });
        return groupView(group);
      },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        409,
        "GROUP_SLUG_EXISTS",
        "A group with this slug already exists in the community",
      );
    }
    throw error;
  }
};

export const listGroups = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  communityId: string,
  limit: number,
  cursor?: string,
) => {
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: {
      visibility: true,
      memberships: {
        where: { userId: identity.id, status: "ACTIVE" },
        select: { userId: true },
      },
    },
  });
  if (
    !community ||
    (community.visibility === "PRIVATE" &&
      community.memberships.length === 0 &&
      !can(identity, "community:manage", { communityId }))
  ) {
    throw new AppError(404, "COMMUNITY_NOT_FOUND", "Community not found");
  }
  const managesCommunity = can(identity, "community:manage", { communityId });
  const groups = await prisma.group.findMany({
    where: {
      communityId,
      deletedAt: null,
      ...(managesCommunity
        ? {}
        : {
            OR: [
              { visibility: "PUBLIC" },
              {
                members: {
                  some: { userId: identity.id, status: "ACTIVE" },
                },
              },
            ],
          }),
    },
    include: {
      _count: { select: { members: { where: { status: "ACTIVE" } } } },
      members: {
        where: { userId: identity.id, status: "ACTIVE" },
        select: { userId: true },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = groups.length > limit;
  const page = groups.slice(0, limit);
  return {
    items: page.map(groupView),
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  };
};
