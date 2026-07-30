import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedIdentity } from "../src/domain/authorization.js";
import { setCommunityMembership } from "../src/services/communities.js";
import { setRsvp } from "../src/services/events.js";

const user: AuthenticatedIdentity = {
  id: "user_1",
  status: "active",
  assignments: [{ role: "user", scope: "platform" }],
};
const inactive: AuthenticatedIdentity = { ...user, status: "disabled" };
const updatedAt = new Date("2026-07-30T12:00:00.000Z");

describe("community participation", () => {
  it("fails closed without permission or a visible community", async () => {
    const prisma = {
      community: { findUnique: vi.fn() },
      communityMember: { upsert: vi.fn() },
    };
    await expect(
      setCommunityMembership(prisma as never, inactive, "c1", "joined"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });

    prisma.community.findUnique.mockResolvedValueOnce(null);
    await expect(
      setCommunityMembership(prisma as never, user, "missing", "joined"),
    ).rejects.toMatchObject({ code: "COMMUNITY_NOT_FOUND", statusCode: 404 });

    prisma.community.findUnique.mockResolvedValueOnce({
      id: "private",
      visibility: "PRIVATE",
      memberships: [],
    });
    await expect(
      setCommunityMembership(prisma as never, user, "private", "joined"),
    ).rejects.toMatchObject({ code: "PRIVATE_COMMUNITY", statusCode: 403 });
  });

  it.each([
    ["joined", "ACTIVE"],
    ["left", "LEFT"],
  ] as const)("persists %s membership", async (requested, persisted) => {
    const prisma = {
      community: {
        findUnique: vi.fn().mockResolvedValue({
          id: "c1",
          visibility: "PUBLIC",
          memberships: [],
        }),
      },
      communityMember: {
        upsert: vi.fn().mockResolvedValue({ status: persisted, updatedAt }),
      },
    };
    await expect(
      setCommunityMembership(prisma as never, user, "c1", requested),
    ).resolves.toEqual({
      communityId: "c1",
      status: requested,
      updatedAt: updatedAt.toISOString(),
    });
    expect(prisma.communityMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: persisted }),
        update: { status: persisted },
      }),
    );
  });

  it("allows an existing member to rejoin a private community", async () => {
    const prisma = {
      community: {
        findUnique: vi.fn().mockResolvedValue({
          id: "private",
          visibility: "PRIVATE",
          memberships: [{ userId: user.id }],
        }),
      },
      communityMember: {
        upsert: vi.fn().mockResolvedValue({ status: "ACTIVE", updatedAt }),
      },
    };
    await expect(
      setCommunityMembership(prisma as never, user, "private", "joined"),
    ).resolves.toMatchObject({ status: "joined" });
  });
});

describe("event participation", () => {
  it("conceals missing and inaccessible private events", async () => {
    const prisma = {
      event: { findUnique: vi.fn() },
      eventRsvp: { upsert: vi.fn() },
    };
    await expect(setRsvp(prisma as never, inactive, "e1", "going")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    prisma.event.findUnique.mockResolvedValueOnce(null);
    await expect(setRsvp(prisma as never, user, "missing", "going")).rejects.toMatchObject({
      code: "EVENT_NOT_FOUND",
    });
    prisma.event.findUnique.mockResolvedValueOnce({
      id: "e1",
      community: { visibility: "PRIVATE", memberships: [] },
    });
    await expect(setRsvp(prisma as never, user, "e1", "going")).rejects.toMatchObject({
      code: "EVENT_NOT_FOUND",
    });
  });

  it.each([
    ["going", "GOING"],
    ["not_going", "NOT_GOING"],
  ] as const)("persists %s RSVP", async (requested, persisted) => {
    const prisma = {
      event: {
        findUnique: vi.fn().mockResolvedValue({
          id: "e1",
          community: { visibility: "PUBLIC", memberships: [] },
        }),
      },
      eventRsvp: {
        upsert: vi.fn().mockResolvedValue({
          eventId: "e1",
          status: persisted,
          updatedAt,
        }),
      },
    };
    await expect(setRsvp(prisma as never, user, "e1", requested)).resolves.toEqual({
      eventId: "e1",
      status: requested,
      updatedAt: updatedAt.toISOString(),
    });
  });
});
