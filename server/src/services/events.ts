import type { PrismaClient } from "@prisma/client";
import { AppError } from "../domain/errors.js";
import { can, type AuthenticatedIdentity } from "../domain/authorization.js";

export const setRsvp = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  eventId: string,
  status: "going" | "not_going",
) => {
  if (!can(identity, "content:participate")) {
    throw new AppError(403, "FORBIDDEN", "Participation permission is required");
  }
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      deletedAt: true,
      community: {
        select: {
          visibility: true,
          memberships: {
            where: { userId: identity.id, status: "ACTIVE" },
            select: { userId: true },
          },
        },
      },
    },
  });
  if (
    !event ||
    event.deletedAt ||
    (event.community.visibility === "PRIVATE" &&
      event.community.memberships.length === 0)
  ) {
    throw new AppError(404, "EVENT_NOT_FOUND", "Event not found");
  }

  const rsvp = await prisma.eventRsvp.upsert({
    where: { eventId_userId: { eventId, userId: identity.id } },
    create: {
      eventId,
      userId: identity.id,
      status: status === "going" ? "GOING" : "NOT_GOING",
    },
    update: { status: status === "going" ? "GOING" : "NOT_GOING" },
  });
  return {
    eventId: rsvp.eventId,
    status: rsvp.status === "GOING" ? ("going" as const) : ("not_going" as const),
    updatedAt: rsvp.updatedAt.toISOString(),
  };
};
