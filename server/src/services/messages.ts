import type { PrismaClient } from "@prisma/client";
import { AppError } from "../domain/errors.js";
import type { AuthenticatedIdentity } from "../domain/authorization.js";
import type { MessageResponse } from "../schemas/api.js";
import { runIdempotently } from "./idempotency.js";

const colors = {
  INK: "ink",
  BLUE: "blue",
  CORAL: "coral",
  ORANGE: "orange",
  PLUM: "plum",
  SAGE: "sage",
  VIOLET: "violet",
} as const;

const ensureParticipant = async (
  prisma: PrismaClient,
  conversationId: string,
  userId: string,
) => {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { userId: true },
  });
  if (!participant) {
    throw new AppError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
  }
};

export const listMessages = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  conversationId: string,
  limit: number,
  cursor?: string,
) => {
  await ensureParticipant(prisma, conversationId, identity.id);
  const messages = await prisma.message.findMany({
    where: { conversationId, deletedAt: null },
    include: { author: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = messages.length > limit;
  const page = messages.slice(0, limit);
  return {
    items: page.reverse().map(
      (message): MessageResponse => ({
        id: message.id,
        conversationId: message.conversationId,
        authorId: message.authorId,
        author: message.author.displayName,
        initials: message.author.initials,
        color: colors[message.author.avatarTone],
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        own: message.authorId === identity.id,
      }),
    ),
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  };
};

export const createMessage = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  conversationId: string,
  body: string,
  idempotencyKey: string,
) =>
  runIdempotently<MessageResponse>(
    prisma,
    {
      actorUserId: identity.id,
      key: idempotencyKey,
      action: `message:create:${conversationId}`,
      request: { conversationId, body },
      statusCode: 201,
    },
    async (transaction) => {
      const participant =
        await transaction.conversationParticipant.findUnique({
          where: {
            conversationId_userId: {
              conversationId,
              userId: identity.id,
            },
          },
        });
      if (!participant) {
        throw new AppError(
          404,
          "CONVERSATION_NOT_FOUND",
          "Conversation not found",
        );
      }
      const message = await transaction.message.create({
        data: { conversationId, authorId: identity.id, body },
        include: { author: true },
      });
      await transaction.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
      return {
        id: message.id,
        conversationId: message.conversationId,
        authorId: message.authorId,
        author: message.author.displayName,
        initials: message.author.initials,
        color: colors[message.author.avatarTone],
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        own: true,
      };
    },
  );
