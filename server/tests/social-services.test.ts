import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedIdentity } from "../src/domain/authorization.js";
import { createBroadcast, listBroadcasts } from "../src/services/broadcasts.js";
import { createChannel, listChannels } from "../src/services/channels.js";
import { createGroup, listGroups } from "../src/services/groups.js";
import { createPost, listPosts } from "../src/services/posts.js";

const member: AuthenticatedIdentity = {
  id: "member_1",
  status: "active",
  assignments: [{ role: "user", scope: "platform" }],
};
const administrator: AuthenticatedIdentity = {
  id: "admin_1",
  status: "active",
  assignments: [
    { role: "user", scope: "platform" },
    { role: "admin", scope: "community", scopeId: "c1" },
  ],
};
const inactive: AuthenticatedIdentity = { ...member, status: "disabled" };
const instant = new Date("2026-07-30T12:00:00.000Z");

const postRecord = (id: string) => ({
  id,
  communityId: "c1",
  groupId: null,
  body: `Post ${id}`,
  authorId: id === "post_1" ? member.id : "other",
  createdAt: instant,
  updatedAt: instant,
  author: {
    id: "other",
    displayName: "Other Member",
    initials: "OM",
    avatarTone: "BLUE",
  },
});
const groupRecord = (id: string, visibility: "PUBLIC" | "PRIVATE" = "PUBLIC") => ({
  id,
  communityId: "c1",
  name: `Group ${id}`,
  slug: `group-${id}`,
  description: "A useful group",
  visibility,
  createdAt: instant,
  _count: { members: 2 },
  members: id === "group_1" ? [{ userId: member.id }] : [],
});
const broadcastRecord = (
  id: string,
  status: "DRAFT" | "SCHEDULED" = "DRAFT",
) => ({
  id,
  communityId: "c1",
  groupId: null,
  title: `Broadcast ${id}`,
  body: "A useful update",
  status,
  startsAt: status === "SCHEDULED" ? instant : null,
  endsAt: null,
  createdAt: instant,
  updatedAt: instant,
  author: { id: administrator.id, displayName: "Admin User" },
});
const channelRecord = (
  id: string,
  slug: string | null = `channel-${id}`,
  visibility: "PUBLIC" | "PRIVATE" = "PUBLIC",
) => ({
  id,
  communityId: "c1",
  groupId: null,
  title: `Channel ${id}`,
  slug,
  description: "A durable channel",
  visibility,
  updatedAt: instant,
  _count: { participants: 2 },
});

describe("post visibility and publishing", () => {
  it("rejects inactive, hidden-community, and non-member publishers", async () => {
    const prisma = {
      community: { findUnique: vi.fn() },
      group: { findFirst: vi.fn() },
      post: { findMany: vi.fn() },
    };
    await expect(
      createPost(prisma as never, inactive, "c1", { body: "post" }, "key_1"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    prisma.community.findUnique.mockResolvedValueOnce(null);
    await expect(listPosts(prisma as never, member, "missing", 10)).rejects.toMatchObject({
      code: "COMMUNITY_NOT_FOUND",
    });
    prisma.community.findUnique.mockResolvedValueOnce({
      visibility: "PRIVATE",
      memberships: [],
    });
    await expect(listPosts(prisma as never, member, "c1", 10)).rejects.toMatchObject({
      code: "COMMUNITY_NOT_FOUND",
    });
    prisma.community.findUnique.mockResolvedValueOnce({
      visibility: "PUBLIC",
      memberships: [],
    });
    await expect(
      createPost(prisma as never, member, "c1", { body: "post" }, "key_2"),
    ).rejects.toMatchObject({ code: "COMMUNITY_MEMBERSHIP_REQUIRED" });
  });

  it("enforces group existence and membership", async () => {
    const prisma = {
      community: {
        findUnique: vi.fn().mockResolvedValue({
          visibility: "PUBLIC",
          memberships: [{ userId: member.id }],
        }),
      },
      group: { findFirst: vi.fn() },
    };
    prisma.group.findFirst.mockResolvedValueOnce(null);
    await expect(
      createPost(
        prisma as never,
        member,
        "c1",
        { body: "post", groupId: "missing" },
        "key_3",
      ),
    ).rejects.toMatchObject({ code: "GROUP_NOT_FOUND" });
    prisma.group.findFirst.mockResolvedValueOnce({ members: [] });
    await expect(
      createPost(
        prisma as never,
        member,
        "c1",
        { body: "post", groupId: "group_1" },
        "key_4",
      ),
    ).rejects.toMatchObject({ code: "GROUP_MEMBERSHIP_REQUIRED" });
  });

  it("filters member feeds and paginates administrator feeds", async () => {
    const prisma = {
      community: {
        findUnique: vi.fn().mockResolvedValue({
          visibility: "PUBLIC",
          memberships: [{ userId: member.id }],
        }),
      },
      post: { findMany: vi.fn() },
    };
    prisma.post.findMany.mockResolvedValueOnce([postRecord("post_1")]);
    await expect(listPosts(prisma as never, member, "c1", 10)).resolves.toMatchObject({
      items: [expect.objectContaining({ own: true })],
      nextCursor: null,
    });
    expect(prisma.post.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) }),
    );

    prisma.post.findMany.mockResolvedValueOnce([
      postRecord("post_1"),
      postRecord("post_2"),
    ]);
    await expect(
      listPosts(prisma as never, administrator, "c1", 1, "cursor_1"),
    ).resolves.toMatchObject({ nextCursor: "post_1" });
    expect(prisma.post.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: { id: "cursor_1" }, skip: 1 }),
    );
  });
});

describe("group visibility", () => {
  it("rejects unauthorized creation and concealed communities", async () => {
    await expect(
      createGroup(
        {} as never,
        member,
        "c1",
        { description: "x", name: "x", slug: "xxx", visibility: "public" },
        "key_group",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const prisma = {
      community: { findUnique: vi.fn().mockResolvedValue(null) },
      group: { findMany: vi.fn() },
    };
    await expect(listGroups(prisma as never, member, "c1", 10)).rejects.toMatchObject({
      code: "COMMUNITY_NOT_FOUND",
    });
    prisma.community.findUnique.mockResolvedValueOnce({
      visibility: "PRIVATE",
      memberships: [],
    });
    await expect(listGroups(prisma as never, member, "c1", 10)).rejects.toMatchObject({
      code: "COMMUNITY_NOT_FOUND",
    });
  });

  it("filters member groups while administrators receive a paginated directory", async () => {
    const prisma = {
      community: {
        findUnique: vi.fn().mockResolvedValue({
          visibility: "PUBLIC",
          memberships: [],
        }),
      },
      group: { findMany: vi.fn() },
    };
    prisma.group.findMany.mockResolvedValueOnce([groupRecord("group_1")]);
    await expect(listGroups(prisma as never, member, "c1", 10)).resolves.toMatchObject({
      items: [expect.objectContaining({ joined: true, visibility: "public" })],
      nextCursor: null,
    });
    expect(prisma.group.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) }),
    );
    prisma.group.findMany.mockResolvedValueOnce([
      groupRecord("group_1"),
      groupRecord("group_2", "PRIVATE"),
    ]);
    await expect(
      listGroups(prisma as never, administrator, "c1", 1, "cursor"),
    ).resolves.toMatchObject({ nextCursor: "group_1" });
  });

  it("checks the community in-transaction and maps unique slug conflicts", async () => {
    const transaction = {
      $executeRaw: vi.fn(),
      auditLog: { create: vi.fn() },
      community: { findUnique: vi.fn().mockResolvedValue(null) },
      group: { create: vi.fn() },
      idempotencyRecord: {
        create: vi.fn(),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (operation: (tx: unknown) => Promise<unknown>) =>
        operation(transaction),
      ),
    };
    const input = {
      description: "Private working group",
      name: "Reliability",
      slug: "reliability",
      visibility: "private" as const,
    };
    await expect(
      createGroup(prisma as never, administrator, "c1", input, "key_missing"),
    ).rejects.toMatchObject({ code: "COMMUNITY_NOT_FOUND" });

    prisma.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        clientVersion: "6",
        code: "P2002",
      }),
    );
    await expect(
      createGroup(prisma as never, administrator, "c1", input, "key_duplicate"),
    ).rejects.toMatchObject({ code: "GROUP_SLUG_EXISTS" });
  });
});

describe("broadcast scheduling and visibility", () => {
  it("validates permission, community, schedule, and group scope", async () => {
    await expect(
      createBroadcast(
        {} as never,
        member,
        "c1",
        { body: "body", title: "title" },
        "key_broadcast_1",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const prisma = {
      community: { findUnique: vi.fn().mockResolvedValue(null) },
      group: { findFirst: vi.fn() },
    };
    await expect(
      createBroadcast(
        prisma as never,
        administrator,
        "c1",
        { body: "body", title: "title" },
        "key_broadcast_2",
      ),
    ).rejects.toMatchObject({ code: "COMMUNITY_NOT_FOUND" });
    prisma.community.findUnique.mockResolvedValue({ id: "c1" });
    await expect(
      createBroadcast(
        prisma as never,
        administrator,
        "c1",
        {
          body: "body",
          startsAt: "2020-01-01T00:00:00.000Z",
          title: "title",
        },
        "key_broadcast_3",
      ),
    ).rejects.toMatchObject({ code: "BROADCAST_START_IN_PAST" });
    prisma.group.findFirst.mockResolvedValueOnce(null);
    await expect(
      createBroadcast(
        prisma as never,
        administrator,
        "c1",
        { body: "body", groupId: "missing", title: "title" },
        "key_broadcast_4",
      ),
    ).rejects.toMatchObject({ code: "GROUP_NOT_FOUND" });
  });

  it("conceals private directories and filters regular-member status", async () => {
    const prisma = {
      community: { findUnique: vi.fn() },
      broadcast: { findMany: vi.fn() },
    };
    prisma.community.findUnique.mockResolvedValueOnce(null);
    await expect(
      listBroadcasts(prisma as never, member, "missing", 10),
    ).rejects.toMatchObject({ code: "COMMUNITY_NOT_FOUND" });
    prisma.community.findUnique.mockResolvedValueOnce({
      visibility: "PRIVATE",
      memberships: [],
    });
    await expect(
      listBroadcasts(prisma as never, member, "c1", 10),
    ).rejects.toMatchObject({ code: "COMMUNITY_NOT_FOUND" });
    prisma.community.findUnique.mockResolvedValue({
      visibility: "PUBLIC",
      memberships: [{ userId: member.id }],
    });
    prisma.broadcast.findMany.mockResolvedValueOnce([broadcastRecord("broadcast_1")]);
    await listBroadcasts(prisma as never, member, "c1", 10);
    expect(prisma.broadcast.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ["SCHEDULED", "LIVE", "ENDED"] } }),
      }),
    );
    prisma.broadcast.findMany.mockResolvedValueOnce([
      broadcastRecord("broadcast_1", "SCHEDULED"),
      broadcastRecord("broadcast_2"),
    ]);
    await expect(
      listBroadcasts(prisma as never, administrator, "c1", 1, "cursor"),
    ).resolves.toMatchObject({ nextCursor: "broadcast_1" });
  });
});

describe("channel membership and visibility", () => {
  it("validates permissions, participant membership, and group scope", async () => {
    const input = {
      description: "Channel",
      participantIds: ["member_1"],
      slug: "channel",
      title: "Channel",
      visibility: "private" as const,
    };
    await expect(
      createChannel({} as never, member, "c1", input, "key_channel_1"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const prisma = {
      communityMember: { count: vi.fn().mockResolvedValue(1) },
      group: { findFirst: vi.fn() },
    };
    await expect(
      createChannel(
        prisma as never,
        administrator,
        "c1",
        { ...input, participantIds: ["member_1", "outsider"] },
        "key_channel_2",
      ),
    ).rejects.toMatchObject({ code: "INVALID_CHANNEL_PARTICIPANTS" });
    prisma.communityMember.count.mockResolvedValueOnce(1);
    prisma.group.findFirst.mockResolvedValueOnce(null);
    await expect(
      createChannel(
        prisma as never,
        administrator,
        "c1",
        { ...input, groupId: "missing", participantIds: [] },
        "key_channel_3",
      ),
    ).rejects.toMatchObject({ code: "GROUP_NOT_FOUND" });
  });

  it("conceals private directories, paginates, and rejects corrupt channel rows", async () => {
    const prisma = {
      community: { findUnique: vi.fn() },
      conversation: { findMany: vi.fn() },
    };
    prisma.community.findUnique.mockResolvedValueOnce(null);
    await expect(listChannels(prisma as never, member, "missing", 10)).rejects.toMatchObject({
      code: "COMMUNITY_NOT_FOUND",
    });
    prisma.community.findUnique.mockResolvedValueOnce({
      visibility: "PRIVATE",
      memberships: [],
    });
    await expect(listChannels(prisma as never, member, "c1", 10)).rejects.toMatchObject({
      code: "COMMUNITY_NOT_FOUND",
    });
    prisma.community.findUnique.mockResolvedValue({
      visibility: "PUBLIC",
      memberships: [{ userId: member.id }],
    });
    prisma.conversation.findMany.mockResolvedValueOnce([channelRecord("channel_1", null)]);
    await expect(listChannels(prisma as never, member, "c1", 10)).rejects.toMatchObject({
      code: "CHANNEL_DATA_INVALID",
    });
    prisma.conversation.findMany.mockResolvedValueOnce([
      channelRecord("channel_1"),
      channelRecord("channel_2", "channel-two", "PRIVATE"),
    ]);
    await expect(
      listChannels(prisma as never, member, "c1", 1, "cursor"),
    ).resolves.toMatchObject({
      items: [expect.objectContaining({ visibility: "public" })],
      nextCursor: "channel_1",
    });
  });

  it("creates a public group channel and maps unique slug conflicts", async () => {
    const transaction = {
      $executeRaw: vi.fn(),
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      conversation: {
        create: vi.fn().mockResolvedValue({
          ...channelRecord("created_channel"),
          groupId: "group_1",
        }),
      },
      idempotencyRecord: {
        create: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const prisma = {
      communityMember: { count: vi.fn().mockResolvedValue(2) },
      group: { findFirst: vi.fn().mockResolvedValue({ id: "group_1" }) },
      $transaction: vi.fn(async (operation: (tx: unknown) => Promise<unknown>) =>
        operation(transaction),
      ),
    };
    const input = {
      description: "Group channel",
      groupId: "group_1",
      participantIds: [member.id],
      slug: "group-channel",
      title: "Group channel",
      visibility: "public" as const,
    };
    await expect(
      createChannel(prisma as never, administrator, "c1", input, "key_created"),
    ).resolves.toMatchObject({
      replayed: false,
      value: expect.objectContaining({ visibility: "public" }),
    });

    prisma.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        clientVersion: "6",
        code: "P2002",
      }),
    );
    await expect(
      createChannel(prisma as never, administrator, "c1", input, "key_duplicate"),
    ).rejects.toMatchObject({ code: "CHANNEL_SLUG_EXISTS" });
  });
});
