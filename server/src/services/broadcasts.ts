import type { BroadcastStatus, PrismaClient } from "@prisma/client";
import { can, type AuthenticatedIdentity } from "../domain/authorization.js";
import { AppError } from "../domain/errors.js";
import type { BroadcastResponse } from "../schemas/api.js";
import { runIdempotently } from "./idempotency.js";

type BroadcastInput = {
  body: string;
  endsAt?: string;
  groupId?: string;
  startsAt?: string;
  title: string;
};

const statusView = (
  status: BroadcastStatus,
): BroadcastResponse["status"] => status.toLowerCase() as BroadcastResponse["status"];

const broadcastView = (broadcast: {
  id: string;
  communityId: string;
  groupId: string | null;
  title: string;
  body: string;
  status: BroadcastStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; displayName: string };
}): BroadcastResponse => ({
  id: broadcast.id,
  communityId: broadcast.communityId,
  groupId: broadcast.groupId,
  title: broadcast.title,
  body: broadcast.body,
  status: statusView(broadcast.status),
  startsAt: broadcast.startsAt?.toISOString() ?? null,
  endsAt: broadcast.endsAt?.toISOString() ?? null,
  author: broadcast.author,
  createdAt: broadcast.createdAt.toISOString(),
  updatedAt: broadcast.updatedAt.toISOString(),
});

export const createBroadcast = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  communityId: string,
  input: BroadcastInput,
  idempotencyKey: string,
) => {
  if (!can(identity, "community:manage", { communityId })) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Community administration permission is required",
    );
  }
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { id: true },
  });
  if (!community) {
    throw new AppError(404, "COMMUNITY_NOT_FOUND", "Community not found");
  }
  if (input.startsAt && Date.parse(input.startsAt) <= Date.now()) {
    throw new AppError(
      400,
      "BROADCAST_START_IN_PAST",
      "A scheduled broadcast must start in the future",
    );
  }
  if (input.groupId) {
    const group = await prisma.group.findFirst({
      where: { id: input.groupId, communityId, deletedAt: null },
      select: { id: true },
    });
    if (!group) throw new AppError(404, "GROUP_NOT_FOUND", "Group not found");
  }

  return runIdempotently<BroadcastResponse>(
    prisma,
    {
      actorUserId: identity.id,
      key: idempotencyKey,
      action: `broadcast:create:${communityId}`,
      request: { communityId, ...input },
      statusCode: 201,
    },
    async (transaction) => {
      const broadcast = await transaction.broadcast.create({
        data: {
          authorId: identity.id,
          body: input.body,
          communityId,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          groupId: input.groupId,
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          status: input.startsAt ? "SCHEDULED" : "DRAFT",
          title: input.title,
        },
        include: {
          author: { select: { id: true, displayName: true } },
        },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: identity.id,
          action: "broadcast.created",
          targetType: "broadcast",
          targetId: broadcast.id,
          communityId,
          idempotencyKey,
          metadata: {
            groupId: input.groupId ?? null,
            status: statusView(broadcast.status),
          },
        },
      });
      return broadcastView(broadcast);
    },
  );
};

export const listBroadcasts = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  communityId: string,
  limit: number,
  cursor?: string,
) => {
  const manages = can(identity, "community:manage", { communityId });
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
      !manages)
  ) {
    throw new AppError(404, "COMMUNITY_NOT_FOUND", "Community not found");
  }
  const broadcasts = await prisma.broadcast.findMany({
    where: {
      communityId,
      deletedAt: null,
      ...(manages
        ? {}
        : { status: { in: ["SCHEDULED", "LIVE", "ENDED"] } }),
    },
    include: {
      author: { select: { id: true, displayName: true } },
    },
    orderBy: [{ startsAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = broadcasts.length > limit;
  const page = broadcasts.slice(0, limit);
  return {
    items: page.map(broadcastView),
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  };
};
