import { Prisma, type PrismaClient } from "@prisma/client";
import { can, type AuthenticatedIdentity } from "../domain/authorization.js";
import { AppError } from "../domain/errors.js";
import type { ChannelResponse } from "../schemas/api.js";
import { runIdempotently } from "./idempotency.js";

type ChannelInput = {
  description: string;
  groupId?: string;
  participantIds: string[];
  slug: string;
  title: string;
  visibility: "public" | "private";
};

const channelView = (channel: {
  id: string;
  communityId: string;
  groupId: string | null;
  title: string;
  slug: string | null;
  description: string;
  visibility: "PUBLIC" | "PRIVATE";
  updatedAt: Date;
  _count: { participants: number };
}): ChannelResponse => {
  if (!channel.slug) {
    throw new AppError(500, "CHANNEL_DATA_INVALID", "Channel slug is missing");
  }
  return {
    id: channel.id,
    communityId: channel.communityId,
    groupId: channel.groupId,
    title: channel.title,
    slug: channel.slug,
    description: channel.description,
    visibility: channel.visibility === "PUBLIC" ? "public" : "private",
    participantCount: channel._count.participants,
    updatedAt: channel.updatedAt.toISOString(),
  };
};

export const createChannel = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  communityId: string,
  input: ChannelInput,
  idempotencyKey: string,
) => {
  if (!can(identity, "community:manage", { communityId })) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Community administration permission is required",
    );
  }
  const participantIds = [...new Set([identity.id, ...input.participantIds])];
  const eligibleParticipants = await prisma.communityMember.count({
    where: {
      communityId,
      userId: { in: participantIds },
      status: "ACTIVE",
    },
  });
  if (eligibleParticipants !== participantIds.length) {
    throw new AppError(
      400,
      "INVALID_CHANNEL_PARTICIPANTS",
      "Every channel participant must be an active community member",
    );
  }
  if (input.groupId) {
    const group = await prisma.group.findFirst({
      where: { id: input.groupId, communityId, deletedAt: null },
      select: { id: true },
    });
    if (!group) throw new AppError(404, "GROUP_NOT_FOUND", "Group not found");
  }

  try {
    return await runIdempotently<ChannelResponse>(
      prisma,
      {
        actorUserId: identity.id,
        key: idempotencyKey,
        action: `channel:create:${communityId}`,
        request: { communityId, ...input, participantIds },
        statusCode: 201,
      },
      async (transaction) => {
        const channel = await transaction.conversation.create({
          data: {
            communityId,
            createdById: identity.id,
            description: input.description,
            groupId: input.groupId,
            participants: {
              create: participantIds.map((userId) => ({ userId })),
            },
            slug: input.slug,
            title: input.title,
            type: input.groupId ? "GROUP" : "COMMUNITY",
            visibility:
              input.visibility === "public" ? "PUBLIC" : "PRIVATE",
          },
          include: { _count: { select: { participants: true } } },
        });
        await transaction.auditLog.create({
          data: {
            actorUserId: identity.id,
            action: "channel.created",
            targetType: "conversation",
            targetId: channel.id,
            communityId,
            idempotencyKey,
            metadata: {
              participantCount: participantIds.length,
              visibility: input.visibility,
            },
          },
        });
        return channelView(channel);
      },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        409,
        "CHANNEL_SLUG_EXISTS",
        "A channel with this slug already exists in the community",
      );
    }
    throw error;
  }
};

export const listChannels = async (
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
  const channels = await prisma.conversation.findMany({
    where: {
      communityId,
      deletedAt: null,
      type: { in: ["COMMUNITY", "GROUP"] },
      participants: { some: { userId: identity.id } },
    },
    include: { _count: { select: { participants: true } } },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = channels.length > limit;
  const page = channels.slice(0, limit);
  return {
    items: page.map(channelView),
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  };
};
