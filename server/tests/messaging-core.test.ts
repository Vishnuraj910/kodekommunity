import type { AvatarTone } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import type { AuthenticatedIdentity } from "../src/domain/authorization.js";
import {
  broadcastRequestSchema,
  messageCreatedEventSchema,
} from "../src/schemas/api.js";
import { MessageHub } from "../src/services/message-hub.js";
import {
  toApiIdentityStatus,
  toApiMessage,
  toApiRoleAssignment,
} from "../src/services/mappers.js";
import { createMessage, listMessages } from "../src/services/messages.js";

const identity: AuthenticatedIdentity = {
  id: "member_1",
  status: "active",
  assignments: [{ role: "user", scope: "platform" }],
};
const instant = new Date("2026-07-30T12:00:00.000Z");
const avatarTone: AvatarTone = "CORAL";
const message = (id: string, authorId = identity.id) => ({
  id,
  conversationId: "conversation_1",
  authorId,
  body: `Message ${id}`,
  createdAt: instant,
  author: {
    avatarTone,
    displayName: "Member One",
    initials: "MO",
  },
});

describe("message persistence", () => {
  it("conceals conversations from non-participants", async () => {
    const prisma = {
      conversationParticipant: { findUnique: vi.fn().mockResolvedValue(null) },
      message: { findMany: vi.fn() },
    };
    await expect(
      listMessages(prisma as never, identity, "conversation_1", 10),
    ).rejects.toMatchObject({ code: "CONVERSATION_NOT_FOUND" });
  });

  it("returns chronological bounded pages with viewer-relative ownership", async () => {
    const prisma = {
      conversationParticipant: {
        findUnique: vi.fn().mockResolvedValue({ userId: identity.id }),
      },
      message: {
        findMany: vi.fn().mockResolvedValue([
          message("message_2", "other"),
          message("message_1"),
        ]),
      },
    };
    await expect(
      listMessages(prisma as never, identity, "conversation_1", 1, "cursor_1"),
    ).resolves.toEqual({
      items: [expect.objectContaining({ id: "message_2", own: false })],
      nextCursor: "message_2",
    });
    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "cursor_1" }, skip: 1, take: 2 }),
    );
    prisma.message.findMany.mockResolvedValueOnce([]);
    await expect(
      listMessages(prisma as never, identity, "conversation_1", 10),
    ).resolves.toEqual({ items: [], nextCursor: null });
  });

  it("checks participation again inside the idempotent transaction", async () => {
    const transaction = {
      $executeRaw: vi.fn(),
      conversationParticipant: { findUnique: vi.fn().mockResolvedValue(null) },
      idempotencyRecord: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (operation: (tx: unknown) => Promise<unknown>) =>
        operation(transaction),
      ),
    };
    await expect(
      createMessage(
        prisma as never,
        identity,
        "conversation_1",
        "hello",
        "message_key",
      ),
    ).rejects.toMatchObject({ code: "CONVERSATION_NOT_FOUND" });
  });
});

describe("message mapping and event contracts", () => {
  it("maps every persisted role scope and identity status", () => {
    expect(toApiRoleAssignment({
      role: "ROOT",
      scope: "PLATFORM",
      communityId: null,
      eventId: null,
    })).toEqual({ role: "root", scope: "platform" });
    expect(toApiRoleAssignment({
      role: "ADMIN",
      scope: "COMMUNITY",
      communityId: "c1",
      eventId: null,
    })).toEqual({ role: "admin", scope: "community", scopeId: "c1" });
    expect(toApiRoleAssignment({
      role: "PRESENTER",
      scope: "EVENT",
      communityId: null,
      eventId: "e1",
    })).toEqual({ role: "presenter", scope: "event", scopeId: "e1" });
    expect(() => toApiRoleAssignment({
      role: "ADMIN",
      scope: "PLATFORM",
      communityId: null,
      eventId: null,
    })).toThrow("Invalid platform");
    expect(() => toApiRoleAssignment({
      role: "ADMIN",
      scope: "COMMUNITY",
      communityId: null,
      eventId: null,
    })).toThrow("Invalid community");
    expect(() => toApiRoleAssignment({
      role: "USER",
      scope: "EVENT",
      communityId: null,
      eventId: null,
    })).toThrow("Invalid event");
    expect(["ACTIVE", "INVITED", "DISABLED", "REVOKED"].map((status) =>
      toApiIdentityStatus(status as never),
    )).toEqual(["active", "invited", "disabled", "revoked"]);
    expect(toApiMessage(message("one"), identity.id)).toMatchObject({
      color: "coral",
      own: true,
    });
  });

  it("validates broadcast time ordering and realtime event shape", () => {
    expect(
      broadcastRequestSchema.safeParse({
        body: "Details",
        endsAt: "2026-08-01T13:00:00.000Z",
        title: "Update",
      }).success,
    ).toBe(false);
    expect(
      broadcastRequestSchema.safeParse({
        body: "Details",
        endsAt: "2026-08-01T12:00:00.000Z",
        startsAt: "2026-08-01T13:00:00.000Z",
        title: "Update",
      }).success,
    ).toBe(false);
    expect(
      messageCreatedEventSchema.safeParse({
        type: "message.created",
        conversationId: "conversation_1",
        message: {
          ...toApiMessage(message("one"), identity.id),
          author: "",
        },
      }).success,
    ).toBe(false);
  });
});

describe("in-memory realtime fan-out", () => {
  it("sends only to healthy open subscribers and cleans empty topics", () => {
    const hub = new MessageHub();
    const healthy = {
      bufferedAmount: 0,
      close: vi.fn(),
      readyState: WebSocket.OPEN,
      send: vi.fn(),
    };
    const slow = {
      bufferedAmount: 300_000,
      close: vi.fn(),
      readyState: WebSocket.OPEN,
      send: vi.fn(),
    };
    const closed = {
      bufferedAmount: 0,
      close: vi.fn(),
      readyState: WebSocket.CLOSED,
      send: vi.fn(),
    };
    const leaveHealthy = hub.subscribe("conversation_1", healthy as never);
    const leaveSlow = hub.subscribe("conversation_1", slow as never);
    const leaveClosed = hub.subscribe("conversation_1", closed as never);
    hub.publish({
      type: "message.created",
      conversationId: "conversation_1",
      message: {
        id: "message_1",
        conversationId: "conversation_1",
        authorId: identity.id,
        author: "Member One",
        initials: "MO",
        color: "coral",
        body: "hello",
        createdAt: instant.toISOString(),
      },
    });
    expect(healthy.send).toHaveBeenCalledOnce();
    expect(slow.close).toHaveBeenCalledWith(1013, "Client is not keeping up");
    expect(closed.send).not.toHaveBeenCalled();
    hub.publish({
      type: "message.created",
      conversationId: "no_subscribers",
      message: {
        id: "message_2",
        conversationId: "no_subscribers",
        authorId: identity.id,
        author: "Member One",
        initials: "MO",
        color: "coral",
        body: "hello",
        createdAt: instant.toISOString(),
      },
    });
    leaveHealthy();
    leaveSlow();
    leaveClosed();
  });
});
