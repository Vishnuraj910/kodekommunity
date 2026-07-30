import type { PrismaClient } from "@prisma/client";
import { can, type AuthenticatedIdentity } from "../domain/authorization.js";
import { AppError } from "../domain/errors.js";

export const setCommunityMembership = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  communityId: string,
  status: "joined" | "left",
) => {
  if (!can(identity, "content:participate")) {
    throw new AppError(403, "FORBIDDEN", "Participation permission is required");
  }
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: {
      id: true,
      visibility: true,
      memberships: {
        where: { userId: identity.id, status: "ACTIVE" },
        select: { userId: true },
      },
    },
  });
  if (!community) {
    throw new AppError(404, "COMMUNITY_NOT_FOUND", "Community not found");
  }
  if (
    status === "joined" &&
    community.visibility === "PRIVATE" &&
    community.memberships.length === 0
  ) {
    throw new AppError(
      403,
      "PRIVATE_COMMUNITY",
      "Private communities require an invitation",
    );
  }

  const membership = await prisma.communityMember.upsert({
    where: { communityId_userId: { communityId, userId: identity.id } },
    create: {
      communityId,
      userId: identity.id,
      status: status === "joined" ? "ACTIVE" : "LEFT",
    },
    update: { status: status === "joined" ? "ACTIVE" : "LEFT" },
  });
  return {
    communityId,
    status: membership.status === "ACTIVE" ? ("joined" as const) : ("left" as const),
    updatedAt: membership.updatedAt.toISOString(),
  };
};
