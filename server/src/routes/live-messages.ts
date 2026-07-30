import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AppError } from "../domain/errors.js";

const clientEventSchema = z
  .object({
    type: z.literal("ping"),
  })
  .strict();

export const liveMessageRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/conversations/:conversationId/live",
    {
      websocket: true,
      preHandler: [
        fastify.authenticate,
        async (request) => {
          const { conversationId } = request.params as {
            conversationId: string;
          };
          const participant =
            await fastify.prisma.conversationParticipant.findUnique({
              where: {
                conversationId_userId: {
                  conversationId,
                  userId: request.auth.id,
                },
              },
              select: { userId: true },
            });
          if (!participant) {
            throw new AppError(
              404,
              "CONVERSATION_NOT_FOUND",
              "Conversation not found",
            );
          }
        },
      ],
    },
    (socket, request) => {
      const { conversationId } = request.params as {
        conversationId: string;
      };
      const unsubscribe = fastify.messageHub.subscribe(conversationId, socket);
      socket.on("message", (data) => {
        let payload: unknown;
        try {
          payload = JSON.parse(data.toString()) as unknown;
        } catch {
          socket.close(1008, "Malformed client event");
          return;
        }
        const parsed = clientEventSchema.safeParse(payload);
        if (!parsed.success) {
          socket.close(1008, "Unsupported client event");
          return;
        }
        socket.send(JSON.stringify({ type: "pong" }));
      });
      socket.once("close", unsubscribe);
      socket.once("error", unsubscribe);
    },
  );
};
