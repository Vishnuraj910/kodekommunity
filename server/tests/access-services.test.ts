import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedIdentity } from "../src/domain/authorization.js";
import {
  changeRole,
  getAccessDirectory,
  listAuditEvents,
} from "../src/services/access.js";

const root: AuthenticatedIdentity = {
  id: "root_1",
  status: "active",
  assignments: [
    { role: "root", scope: "platform" },
    { role: "user", scope: "platform" },
  ],
};
const member: AuthenticatedIdentity = {
  id: "member_1",
  status: "active",
  assignments: [{ role: "user", scope: "platform" }],
};
const persistedUser = {
  id: "target_1",
  displayName: "Target User",
  handle: "target",
  initials: "TU",
  status: "ACTIVE",
  roleAssignments: [{ role: "USER", scope: "PLATFORM", communityId: null, eventId: null }],
};

const createTransaction = () => ({
  $executeRaw: vi.fn().mockResolvedValue(1),
  auditLog: {
    create: vi.fn().mockResolvedValue({ id: "audit_1" }),
    findMany: vi.fn(),
  },
  community: { findUnique: vi.fn().mockResolvedValue({ id: "c1" }) },
  event: {
    findFirst: vi.fn().mockResolvedValue({ id: "e1" }),
    findUnique: vi.fn().mockResolvedValue({ id: "e1", deletedAt: new Date() }),
  },
  idempotencyRecord: {
    create: vi.fn().mockResolvedValue({}),
    findUnique: vi.fn().mockResolvedValue(null),
  },
  roleAssignment: {
    count: vi.fn().mockResolvedValue(2),
    create: vi.fn().mockResolvedValue({ id: "role_1" }),
    delete: vi.fn().mockResolvedValue({}),
    findFirst: vi.fn().mockResolvedValue(null),
  },
  user: {
    findMany: vi.fn().mockResolvedValue([persistedUser]),
    findUnique: vi.fn().mockResolvedValue({ id: "target_1" }),
    findUniqueOrThrow: vi.fn().mockResolvedValue(persistedUser),
  },
});

const prismaFor = (transaction: ReturnType<typeof createTransaction>) => ({
  ...transaction,
  $transaction: vi.fn(async (operation: (tx: unknown) => Promise<unknown>) =>
    operation(transaction),
  ),
});

describe("access administration services", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("restricts and maps the access directory", async () => {
    const transaction = createTransaction();
    await expect(
      getAccessDirectory(prismaFor(transaction) as never, member),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      getAccessDirectory(prismaFor(transaction) as never, root),
    ).resolves.toEqual({
      users: [
        expect.objectContaining({
          assignments: [{ role: "user", scope: "platform" }],
          id: "target_1",
          status: "active",
        }),
      ],
    });
  });

  it("requires root and conceals missing role targets", async () => {
    const request = {
      action: "grant" as const,
      assignment: { role: "maintainer" as const, scope: "platform" as const },
      targetUserId: "target_1",
    };
    await expect(
      changeRole(prismaFor(createTransaction()) as never, member, request, "key_0001"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const transaction = createTransaction();
    transaction.user.findUnique.mockResolvedValueOnce(null);
    await expect(
      changeRole(prismaFor(transaction) as never, root, request, "key_0002"),
    ).rejects.toMatchObject({ code: "IDENTITY_NOT_FOUND" });
  });

  it.each([
    [
      "community",
      {
        role: "admin" as const,
        scope: "community" as const,
        scopeId: "missing",
      },
      "COMMUNITY_NOT_FOUND",
    ],
    [
      "event",
      {
        role: "presenter" as const,
        scope: "event" as const,
        scopeId: "missing",
      },
      "EVENT_NOT_FOUND",
    ],
  ])("validates the %s scope before granting", async (_scope, assignment, code) => {
    const transaction = createTransaction();
    if (assignment.scope === "community") {
      transaction.community.findUnique.mockResolvedValueOnce(null);
    } else {
      transaction.event.findFirst.mockResolvedValueOnce(null);
    }
    await expect(
      changeRole(
        prismaFor(transaction) as never,
        root,
        { action: "grant", assignment, targetUserId: "target_1" },
        `key_${assignment.scope}`,
      ),
    ).rejects.toMatchObject({ code });
  });

  it("rejects presenter grants for soft-deleted events", async () => {
    const transaction = createTransaction();
    transaction.event.findFirst.mockResolvedValueOnce(null);
    await expect(
      changeRole(
        prismaFor(transaction) as never,
        root,
        {
          action: "grant",
          assignment: {
            role: "presenter",
            scope: "event",
            scopeId: "e1",
          },
          targetUserId: "target_1",
        },
        "key_deleted_event",
      ),
    ).rejects.toMatchObject({ code: "EVENT_NOT_FOUND" });
  });

  it.each([
    { role: "maintainer" as const, scope: "platform" as const },
    { role: "admin" as const, scope: "community" as const, scopeId: "c1" },
    { role: "presenter" as const, scope: "event" as const, scopeId: "e1" },
  ])("grants and audits a scoped $role assignment", async (assignment) => {
    const transaction = createTransaction();
    const result = await changeRole(
      prismaFor(transaction) as never,
      root,
      { action: "grant", assignment, targetUserId: "target_1" },
      `key_grant_${assignment.role}`,
    );
    expect(result).toMatchObject({ replayed: false, statusCode: 200 });
    expect(transaction.roleAssignment.create).toHaveBeenCalledOnce();
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "role.granted",
          metadata: expect.objectContaining({ role: assignment.role }),
        }),
      }),
    );
  });

  it("does not duplicate an existing grant", async () => {
    const transaction = createTransaction();
    transaction.roleAssignment.findFirst.mockResolvedValueOnce({ id: "existing" });
    await changeRole(
      prismaFor(transaction) as never,
      root,
      {
        action: "grant",
        assignment: { role: "maintainer", scope: "platform" },
        targetUserId: "target_1",
      },
      "key_existing",
    );
    expect(transaction.roleAssignment.create).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it("protects the baseline role and final root", async () => {
    const baseline = createTransaction();
    baseline.roleAssignment.findFirst.mockResolvedValueOnce({ id: "user_role" });
    await expect(
      changeRole(
        prismaFor(baseline) as never,
        root,
        {
          action: "revoke",
          assignment: { role: "user", scope: "platform" },
          targetUserId: "target_1",
        },
        "key_baseline",
      ),
    ).rejects.toMatchObject({ code: "BASELINE_ROLE_REQUIRED" });

    const finalRoot = createTransaction();
    finalRoot.roleAssignment.findFirst.mockResolvedValueOnce({ id: "root_role" });
    finalRoot.roleAssignment.count.mockResolvedValueOnce(1);
    await expect(
      changeRole(
        prismaFor(finalRoot) as never,
        root,
        {
          action: "revoke",
          assignment: { role: "root", scope: "platform" },
          targetUserId: "target_1",
        },
        "key_root",
      ),
    ).rejects.toMatchObject({ code: "FINAL_ROOT_REQUIRED" });
  });

  it("revokes and audits an existing non-baseline role", async () => {
    const transaction = createTransaction();
    transaction.roleAssignment.findFirst.mockResolvedValueOnce({ id: "admin_role" });
    await changeRole(
      prismaFor(transaction) as never,
      root,
      {
        action: "revoke",
        assignment: { role: "admin", scope: "community", scopeId: "c1" },
        targetUserId: "target_1",
      },
      "key_revoke",
    );
    expect(transaction.roleAssignment.delete).toHaveBeenCalledWith({
      where: { id: "admin_role" },
    });
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "role.revoked" }),
      }),
    );
  });

  it("paginates and serializes audit events", async () => {
    const record = {
      id: "audit_1",
      actorUserId: "root_1",
      action: "role.granted",
      targetType: "user",
      targetId: "target_1",
      communityId: "c1",
      eventId: null,
      idempotencyKey: "key",
      metadata: { role: "admin" },
      createdAt: new Date("2026-07-30T12:00:00.000Z"),
    };
    const transaction = createTransaction();
    transaction.auditLog.findMany.mockResolvedValue([record, { ...record, id: "audit_2" }]);
    await expect(
      listAuditEvents(prismaFor(transaction) as never, root, 1, "cursor_1"),
    ).resolves.toEqual({
      items: [expect.objectContaining({ id: "audit_1", createdAt: record.createdAt.toISOString() })],
      nextCursor: "audit_1",
    });
    expect(transaction.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "cursor_1" }, skip: 1, take: 2 }),
    );

    transaction.auditLog.findMany.mockResolvedValueOnce([]);
    await expect(
      listAuditEvents(prismaFor(transaction) as never, root, 10),
    ).resolves.toEqual({ items: [], nextCursor: null });
    await expect(
      listAuditEvents(prismaFor(transaction) as never, member, 10),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
