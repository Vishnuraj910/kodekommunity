import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { can, type AuthenticatedIdentity } from "../domain/authorization.js";
import { AppError } from "../domain/errors.js";
import type { DirectConversationResponse } from "../schemas/api.js";
import { runIdempotently } from "./idempotency.js";

const directKeyFor = (
  communityId: string,
  firstUserId: string,
  secondUserId: string,
) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        communityId,
        participants: [firstUserId, secondUserId].sort(),
      }),
    )
    .digest("hex");

const directView = (conversation: {
  id: string;
  communityId: string;
  title: string;
  updatedAt: Date;
  _count: { participants: number };
}): DirectConversationResponse => {
  if (conversation._count.participants !== 2) {
    throw new AppError(
      500,
      "DIRECT_CONVERSATION_INVALID",
      "A direct conversation must have exactly two participants",
    );
  }
  return {
    id: conversation.id,
    communityId: conversation.communityId,
    title: conversation.title,
    type: "direct",
    participantCount: 2,
    updatedAt: conversation.updatedAt.toISOString(),
  };
};

export const createDirectConversation = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  communityId: string,
  targetUserId: string,
  idempotencyKey: string,
) => {
  if (
    !can(identity, "content:participate") ||
    targetUserId === identity.id
  ) {
    throw new AppError(
      400,
      "INVALID_DIRECT_RECIPIENT",
      "Choose another eligible community member",
    );
  }
  const participantIds = [identity.id, targetUserId];
  const members = await prisma.communityMember.findMany({
    where: {
      communityId,
      status: "ACTIVE",
      userId: { in: participantIds },
      user: { status: "ACTIVE" },
    },
    select: {
      userId: true,
      user: { select: { displayName: true } },
    },
  });
  if (members.length !== 2) {
    throw new AppError(
      404,
      "DIRECT_RECIPIENT_NOT_FOUND",
      "The eligible community member was not found",
    );
  }
  const directKey = directKeyFor(communityId, identity.id, targetUserId);
  return runIdempotently<DirectConversationResponse>(
    prisma,
    {
      actorUserId: identity.id,
      key: idempotencyKey,
      action: `conversation:direct:${communityId}`,
      request: { communityId, targetUserId },
      statusCode: 201,
    },
    async (transaction) => {
      const existing = await transaction.conversation.findUnique({
        where: { directKey },
        include: { _count: { select: { participants: true } } },
      });
      if (existing && !existing.deletedAt) return directView(existing);

      const conversation = await transaction.conversation.create({
        data: {
          communityId,
          createdById: identity.id,
          description: "Private direct conversation",
          directKey,
          participants: {
            create: participantIds.map((userId) => ({ userId })),
          },
          title: members
            .map((member) => member.user.displayName)
            .sort()
            .join(" & ")
            .slice(0, 160),
          type: "DIRECT",
          visibility: "PRIVATE",
        },
        include: { _count: { select: { participants: true } } },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: identity.id,
          action: "conversation.direct.created",
          targetType: "conversation",
          targetId: conversation.id,
          communityId,
          idempotencyKey,
          metadata: { participantCount: 2 },
        },
      });
      return directView(conversation);
    },
  );
};
