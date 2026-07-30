import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, test } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { updateAdminUser } from "../src/services/admin.js";

let app: FastifyInstance;
const suffix = Date.now().toString(36);
const userId = `admin-test-${suffix}`;
const eventId = `admin-event-${suffix}`;
const postId = `admin-post-${suffix}`;
const groupId = `admin-group-${suffix}`;
const headers = (idempotencyKey?: string) => ({
  "x-kommunity-user-id": "maya",
  ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
});
type ReplayRequest = {
  headers: Record<string, string | undefined>;
  method: "DELETE" | "PATCH" | "POST";
  payload?: object;
  url: string;
};
const expectReplay = async (
  request: ReplayRequest,
  statusCode: number,
) => {
  const response = await app.inject(request);
  assert.equal(response.statusCode, statusCode);
  assert.equal(response.headers["idempotent-replayed"], "true");
};

beforeAll(async () => {
  app = await buildApp(
    loadConfig({
      ...process.env,
      NODE_ENV: "test",
      ALLOW_DEMO_AUTH: "true",
      DEMO_USER_ID: "maya",
      LOG_LEVEL: "silent",
    }),
  );
});

afterAll(async () => {
  await app.prisma.auditLog.deleteMany({
    where: { targetId: { in: [userId, eventId, postId, groupId] } },
  });
  await app.prisma.idempotencyRecord.deleteMany({
    where: { actorUserId: "maya", action: { startsWith: "admin:" } },
  });
  await app.prisma.post.deleteMany({ where: { id: postId } });
  await app.prisma.group.deleteMany({ where: { id: groupId } });
  await app.prisma.event.deleteMany({ where: { id: eventId } });
  await app.prisma.user.deleteMany({ where: { id: userId } });
  await app.close();
});

test("only root can open the platform administration directory", async () => {
  const forbidden = await app.inject({
    method: "GET",
    url: "/api/v1/admin",
    headers: { "x-kommunity-user-id": "aisha" },
  });
  assert.equal(forbidden.statusCode, 403);

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/admin",
    headers: headers(),
  });
  assert.equal(response.statusCode, 200);
  assert.ok(response.json().users.some((user: { id: string }) => user.id === "maya"));
  assert.ok(Array.isArray(response.json().events));
  assert.ok(Array.isArray(response.json().posts));
  assert.ok(Array.isArray(response.json().groups));
});

test("root can create, update, and revoke a user with one baseline role", async () => {
  const createRequest = {
    method: "POST",
    url: "/api/v1/admin/users",
    headers: headers(`admin-user-create-${suffix}`),
    payload: {
      id: userId,
      displayName: "Admin Created User",
      email: `${userId}@example.test`,
      handle: userId,
    },
  } as const;
  const created = await app.inject(createRequest);
  assert.equal(created.statusCode, 201);
  assert.deepEqual(created.json().assignments, [
    { role: "user", scope: "platform" },
  ]);
  assert.equal(created.json().email, `${userId}@example.test`);
  assert.equal(created.json().status, "invited");
  await expectReplay(createRequest, 201);

  const updateRequest = {
    method: "PATCH",
    url: `/api/v1/admin/users/${userId}`,
    headers: headers(`admin-user-update-${suffix}`),
    payload: {
      displayName: "Updated Admin User",
      status: "active",
    },
  } as const;
  const updated = await app.inject(updateRequest);
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json().displayName, "Updated Admin User");
  assert.equal(updated.json().status, "active");
  await expectReplay(updateRequest, 200);

  const deleteRequest = {
    method: "DELETE",
    url: `/api/v1/admin/users/${userId}`,
    headers: headers(`admin-user-delete-${suffix}`),
  } as const;
  const removed = await app.inject(deleteRequest);
  assert.equal(removed.statusCode, 204);
  await expectReplay(deleteRequest, 204);

  const directory = await app.inject({
    method: "GET",
    url: "/api/v1/admin",
    headers: headers(),
  });
  const revoked = directory
    .json()
    .users.find((user: { id: string }) => user.id === userId);
  assert.equal(revoked.status, "revoked");
});

test("root can create, update, and soft-delete events, posts, and groups", async () => {
  const createEventRequest = {
    method: "POST",
    url: "/api/v1/admin/events",
    headers: headers(`admin-event-create-${suffix}`),
    payload: {
      id: eventId,
      communityId: "c1",
      slug: `admin-event-${suffix}`,
      title: "Admin event",
      description: "A managed event",
      startsAt: "2027-01-10T10:00:00.000Z",
      endsAt: "2027-01-10T11:00:00.000Z",
      location: "Online",
    },
  } as const;
  const createdEvent = await app.inject(createEventRequest);
  assert.equal(createdEvent.statusCode, 201);
  await expectReplay(createEventRequest, 201);
  const updateEventRequest = {
    method: "PATCH",
    url: `/api/v1/admin/events/${eventId}`,
    headers: headers(`admin-event-update-${suffix}`),
    payload: {
      title: "Updated admin event",
      startsAt: "2027-01-10T10:30:00.000Z",
      endsAt: "2027-01-10T11:30:00.000Z",
    },
  } as const;
  const updatedEvent = await app.inject(updateEventRequest);
  assert.equal(updatedEvent.statusCode, 200);
  assert.equal(updatedEvent.json().title, "Updated admin event");
  await expectReplay(updateEventRequest, 200);

  const createPostRequest = {
    method: "POST",
    url: "/api/v1/admin/posts",
    headers: headers(`admin-post-create-${suffix}`),
    payload: {
      id: postId,
      communityId: "c1",
      groupId: "g1",
      body: "Admin managed post",
    },
  } as const;
  const createdPost = await app.inject(createPostRequest);
  assert.equal(createdPost.statusCode, 201);
  await expectReplay(createPostRequest, 201);
  const updatePostRequest = {
    method: "PATCH",
    url: `/api/v1/admin/posts/${postId}`,
    headers: headers(`admin-post-update-${suffix}`),
    payload: { body: "Updated admin managed post", groupId: "g1" },
  } as const;
  const updatedPost = await app.inject(updatePostRequest);
  assert.equal(updatedPost.statusCode, 200);
  assert.equal(updatedPost.json().body, "Updated admin managed post");
  await expectReplay(updatePostRequest, 200);

  const createGroupRequest = {
    method: "POST",
    url: "/api/v1/admin/groups",
    headers: headers(`admin-group-create-${suffix}`),
    payload: {
      id: groupId,
      communityId: "c1",
      slug: `admin-group-${suffix}`,
      name: "Admin managed group",
      description: "A managed group",
      visibility: "private",
    },
  } as const;
  const createdGroup = await app.inject(createGroupRequest);
  assert.equal(createdGroup.statusCode, 201);
  await expectReplay(createGroupRequest, 201);
  const updateGroupRequest = {
    method: "PATCH",
    url: `/api/v1/admin/groups/${groupId}`,
    headers: headers(`admin-group-update-${suffix}`),
    payload: { name: "Updated admin group", visibility: "public" },
  } as const;
  const updatedGroup = await app.inject(updateGroupRequest);
  assert.equal(updatedGroup.statusCode, 200);
  assert.equal(updatedGroup.json().name, "Updated admin group");
  assert.equal(updatedGroup.json().visibility, "public");
  await expectReplay(updateGroupRequest, 200);

  for (const [resource, id] of [
    ["events", eventId],
    ["posts", postId],
    ["groups", groupId],
  ] as const) {
    const deleteRequest = {
      method: "DELETE",
      url: `/api/v1/admin/${resource}/${id}`,
      headers: headers(`admin-${resource}-delete-${suffix}`),
    } as const;
    const removed = await app.inject(deleteRequest);
    assert.equal(removed.statusCode, 204);
    await expectReplay(deleteRequest, 204);
  }

  const overview = await app.inject({
    method: "GET",
    url: "/api/v1/admin",
    headers: headers(),
  });
  assert.equal(
    overview.json().events.some((event: { id: string }) => event.id === eventId),
    false,
  );
  assert.equal(
    overview.json().posts.some((post: { id: string }) => post.id === postId),
    false,
  );
  assert.equal(
    overview.json().groups.some((group: { id: string }) => group.id === groupId),
    false,
  );
});

test("root administration fails closed for protected, missing, and invalid resources", async () => {
  for (const request of [
    {
      method: "PATCH",
      url: "/api/v1/admin/users/maya",
      headers: headers(`admin-protect-root-update-${suffix}`),
      payload: { status: "revoked" },
      expectedCode: "CURRENT_ROOT_REQUIRED",
    },
    {
      method: "DELETE",
      url: "/api/v1/admin/users/maya",
      headers: headers(`admin-protect-root-delete-${suffix}`),
      expectedCode: "CURRENT_ROOT_REQUIRED",
    },
    {
      method: "PATCH",
      url: "/api/v1/admin/users/missing-user",
      headers: headers(`admin-missing-user-update-${suffix}`),
      payload: { displayName: "Missing" },
      expectedCode: "IDENTITY_NOT_FOUND",
    },
    {
      method: "DELETE",
      url: "/api/v1/admin/users/missing-user",
      headers: headers(`admin-missing-user-delete-${suffix}`),
      expectedCode: "IDENTITY_NOT_FOUND",
    },
    {
      method: "PATCH",
      url: "/api/v1/admin/events/missing-event",
      headers: headers(`admin-missing-event-update-${suffix}`),
      payload: { title: "Missing" },
      expectedCode: "EVENT_NOT_FOUND",
    },
    {
      method: "DELETE",
      url: "/api/v1/admin/events/missing-event",
      headers: headers(`admin-missing-event-delete-${suffix}`),
      expectedCode: "EVENT_NOT_FOUND",
    },
    {
      method: "PATCH",
      url: "/api/v1/admin/posts/missing-post",
      headers: headers(`admin-missing-post-update-${suffix}`),
      payload: { body: "Missing" },
      expectedCode: "POST_NOT_FOUND",
    },
    {
      method: "DELETE",
      url: "/api/v1/admin/posts/missing-post",
      headers: headers(`admin-missing-post-delete-${suffix}`),
      expectedCode: "POST_NOT_FOUND",
    },
    {
      method: "PATCH",
      url: "/api/v1/admin/groups/missing-group",
      headers: headers(`admin-missing-group-update-${suffix}`),
      payload: { name: "Missing" },
      expectedCode: "GROUP_NOT_FOUND",
    },
    {
      method: "DELETE",
      url: "/api/v1/admin/groups/missing-group",
      headers: headers(`admin-missing-group-delete-${suffix}`),
      expectedCode: "GROUP_NOT_FOUND",
    },
  ] as const) {
    const response = await app.inject(request);
    assert.ok([404, 409].includes(response.statusCode));
    assert.equal(response.json().error.code, request.expectedCode);
  }

  const duplicateIdentity = await app.inject({
    method: "POST",
    url: "/api/v1/admin/users",
    headers: headers(`admin-duplicate-user-${suffix}`),
    payload: {
      id: `duplicate-${suffix}`,
      displayName: "Duplicate identity",
      email: "maya@kommunity.local",
      handle: `duplicate-${suffix}`,
    },
  });
  assert.equal(duplicateIdentity.statusCode, 409);
  assert.equal(duplicateIdentity.json().error.code, "IDENTITY_CONFLICT");

  for (const [resource, payload] of [
    [
      "events",
      {
        communityId: "missing-community",
        slug: `missing-event-${suffix}`,
        title: "Missing event",
        description: "Missing community",
        startsAt: "2027-02-01T10:00:00.000Z",
        endsAt: "2027-02-01T11:00:00.000Z",
        location: "Online",
      },
    ],
    ["posts", { communityId: "missing-community", body: "Missing post" }],
    [
      "groups",
      {
        communityId: "missing-community",
        slug: `missing-group-${suffix}`,
        name: "Missing group",
        description: "Missing community",
        visibility: "public",
      },
    ],
  ] as const) {
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/admin/${resource}`,
      headers: headers(`admin-missing-community-${resource}-${suffix}`),
      payload,
    });
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, "COMMUNITY_NOT_FOUND");
  }
});

test("concurrent root revocations preserve one active root", async () => {
  const rootA = `root-a-${suffix}`;
  const rootB = `root-b-${suffix}`;
  const previousRoots = await app.prisma.user.findMany({
    where: {
      status: "ACTIVE",
      roleAssignments: {
        some: { role: "ROOT", scope: "PLATFORM" },
      },
    },
    select: { id: true, status: true },
  });

  try {
    await app.prisma.user.updateMany({
      where: { id: { in: previousRoots.map((root) => root.id) } },
      data: { status: "DISABLED" },
    });
    for (const id of [rootA, rootB]) {
      await app.prisma.user.create({
        data: {
          id,
          displayName: id,
          email: `${id}@example.test`,
          handle: id,
          initials: id === rootA ? "RA" : "RB",
          status: "ACTIVE",
          roleAssignments: {
            create: [
              { role: "USER", scope: "PLATFORM" },
              { role: "ROOT", scope: "PLATFORM" },
            ],
          },
        },
      });
    }

    const identity = (id: string) => ({
      id,
      status: "active" as const,
      assignments: [
        { role: "user" as const, scope: "platform" as const },
        { role: "root" as const, scope: "platform" as const },
      ],
    });
    const outcomes = await Promise.allSettled([
      updateAdminUser(
        app.prisma,
        identity(rootA),
        rootB,
        { status: "revoked" },
        `concurrent-root-a-${suffix}`,
      ),
      updateAdminUser(
        app.prisma,
        identity(rootB),
        rootA,
        { status: "revoked" },
        `concurrent-root-b-${suffix}`,
      ),
    ]);

    assert.equal(
      await app.prisma.roleAssignment.count({
        where: {
          role: "ROOT",
          scope: "PLATFORM",
          user: { status: "ACTIVE" },
        },
      }),
      1,
    );
    assert.equal(
      outcomes.filter((outcome) => outcome.status === "rejected").length,
      1,
    );
  } finally {
    await app.prisma.idempotencyRecord.deleteMany({
      where: { actorUserId: { in: [rootA, rootB] } },
    });
    await app.prisma.auditLog.deleteMany({
      where: { actorUserId: { in: [rootA, rootB] } },
    });
    await app.prisma.user.deleteMany({ where: { id: { in: [rootA, rootB] } } });
    for (const root of previousRoots) {
      await app.prisma.user.update({
        where: { id: root.id },
        data: { status: root.status },
      });
    }
  }
});
