import type { PrismaClient } from "@prisma/client";
import type { BootstrapResponse } from "../schemas/api.js";
import { apiUserSelect, toApiUser } from "./mappers.js";

export const getBootstrap = async (
  prisma: PrismaClient,
  userId: string,
): Promise<BootstrapResponse> => {
  const [user, communities, events, conversations] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: apiUserSelect,
    }),
    prisma.community.findMany({
      where: {
        OR: [
          { visibility: "PUBLIC" },
          { memberships: { some: { userId, status: "ACTIVE" } } },
        ],
      },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        visibility: true,
        _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
        memberships: {
          where: { userId, status: "ACTIVE" },
          select: { userId: true },
        },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 100,
    }),
    prisma.event.findMany({
      where: {
        community: {
          OR: [
            { visibility: "PUBLIC" },
            { memberships: { some: { userId, status: "ACTIVE" } } },
          ],
        },
      },
      select: {
        id: true,
        communityId: true,
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        location: true,
        _count: { select: { rsvps: { where: { status: "GOING" } } } },
        rsvps: {
          where: { userId, status: "GOING" },
          select: { userId: true },
        },
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: 100,
    }),
    prisma.conversation.findMany({
      where: { deletedAt: null, participants: { some: { userId } } },
      select: {
        id: true,
        communityId: true,
        title: true,
        type: true,
        updatedAt: true,
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, createdAt: true },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 100,
    }),
  ]);

  return {
    user: toApiUser(user),
    communities: communities.map((community) => ({
      id: community.id,
      slug: community.slug,
      name: community.name,
      description: community.description,
      visibility: community.visibility.toLowerCase() as "public" | "private",
      memberCount: community._count.memberships,
      joined: community.memberships.length > 0,
    })),
    events: events.map((event) => ({
      id: event.id,
      communityId: event.communityId,
      title: event.title,
      description: event.description,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      location: event.location,
      attendeeCount: event._count.rsvps,
      going: event.rsvps.length > 0,
    })),
    conversations: conversations.map((conversation) => {
      const lastMessage = conversation.messages[0];
      return {
        id: conversation.id,
        communityId: conversation.communityId,
        title: conversation.title,
        type: conversation.type.toLowerCase() as
          | "community"
          | "direct"
          | "event"
          | "group",
        updatedAt: conversation.updatedAt.toISOString(),
        lastMessage: lastMessage
          ? {
              body: lastMessage.body,
              createdAt: lastMessage.createdAt.toISOString(),
            }
          : null,
      };
    }),
  };
};
