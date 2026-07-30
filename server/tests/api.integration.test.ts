import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, test, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { AppError } from "../src/domain/errors.js";

let app: FastifyInstance;

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
  await app.close();
});

test("health, bootstrap, and OpenAPI are available", async () => {
  const health = await app.inject({ method: "GET", url: "/api/v1/health/ready" });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.json(), { status: "ready" });

  const bootstrap = await app.inject({
    method: "GET",
    url: "/api/v1/bootstrap",
    headers: { "x-kommunity-user-id": "maya" },
  });
  assert.equal(bootstrap.statusCode, 200);
  assert.equal(bootstrap.json().user.id, "maya");
  assert.equal(bootstrap.json().communities.length, 6);

  const specification = await app.inject({
    method: "GET",
    url: "/docs/json",
  });
  assert.equal(specification.statusCode, 200);
  assert.ok(specification.json().paths["/api/v1/access/roles"]);

  const missingIdentity = await app.inject({
    method: "GET",
    url: "/api/v1/bootstrap",
  });
  assert.equal(missingIdentity.statusCode, 401);
  assert.equal(missingIdentity.json().error.code, "AUTHENTICATION_REQUIRED");
});

test("HTTP failures use stable public error contracts", async () => {
  const missing = await app.inject({ method: "GET", url: "/api/v1/not-a-route" });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().error.code, "NOT_FOUND");

  const invalidIdentity = await app.inject({
    method: "GET",
    url: "/api/v1/bootstrap",
    headers: { "x-kommunity-user-id": "not valid!" },
  });
  assert.equal(invalidIdentity.statusCode, 401);
  assert.equal(invalidIdentity.json().error.code, "INVALID_DEMO_IDENTITY");

  const unknownIdentity = await app.inject({
    method: "GET",
    url: "/api/v1/bootstrap",
    headers: { "x-kommunity-user-id": "missing_identity" },
  });
  assert.equal(unknownIdentity.statusCode, 401);
  assert.equal(unknownIdentity.json().error.code, "IDENTITY_NOT_FOUND");

  const unsupported = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers: { "content-type": "application/xml" },
    payload: "<not-json />",
  });
  assert.equal(unsupported.statusCode, 415);
  assert.equal(typeof unsupported.json().error.code, "string");

  const userLookup = vi.spyOn(app.prisma.user, "findUnique");
  userLookup.mockRejectedValueOnce(
    new AppError(418, "TEST_PUBLIC_ERROR", "Public test error", {
      safe: true,
    }),
  );
  const detailed = await app.inject({
    method: "GET",
    url: "/api/v1/bootstrap",
    headers: { "x-kommunity-user-id": "maya" },
  });
  assert.equal(detailed.statusCode, 418);
  assert.deepEqual(detailed.json().error.details, { safe: true });

  userLookup.mockRejectedValueOnce(new Error("private database detail"));
  const internal = await app.inject({
    method: "GET",
    url: "/api/v1/bootstrap",
    headers: { "x-kommunity-user-id": "maya" },
  });
  assert.equal(internal.statusCode, 500);
  assert.equal(internal.json().error.code, "INTERNAL_SERVER_ERROR");
  assert.doesNotMatch(internal.body, /private database detail/);
  userLookup.mockRestore();
});

test("browser mutations reject an untrusted Origin", async () => {
  const response = await app.inject({
    method: "PUT",
    url: "/api/v1/events/e1/rsvp",
    headers: {
      origin: "https://attacker.example.test",
      "x-kommunity-user-id": "maya",
    },
    payload: { status: "going" },
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, "ORIGIN_NOT_ALLOWED");

  const trusted = await app.inject({
    method: "PUT",
    url: "/api/v1/events/e1/rsvp",
    headers: {
      origin: "http://127.0.0.1:4173",
      "x-kommunity-user-id": "maya",
    },
    payload: { status: "going" },
  });
  assert.equal(trusted.statusCode, 200);
});

test("access routes expose bounded directories, audits, and replay markers", async () => {
  const key = `test-role-route-${Date.now()}`;
  const existing = await app.prisma.roleAssignment.findFirst({
    where: { userId: "lena", role: "MAINTAINER", scope: "PLATFORM" },
  });
  try {
    const users = await app.inject({
      method: "GET",
      url: "/api/v1/access/users",
      headers: { "x-kommunity-user-id": "maya" },
    });
    assert.equal(users.statusCode, 200);
    assert.ok(users.json().users.length >= 2);

    const first = await app.inject({
      method: "POST",
      url: "/api/v1/access/roles",
      headers: {
        "idempotency-key": key,
        "x-kommunity-user-id": "maya",
      },
      payload: {
        action: "grant",
        assignment: { role: "maintainer", scope: "platform" },
        targetUserId: "lena",
      },
    });
    assert.equal(first.statusCode, 200);

    const replay = await app.inject({
      method: "POST",
      url: "/api/v1/access/roles",
      headers: {
        "idempotency-key": key,
        "x-kommunity-user-id": "maya",
      },
      payload: {
        action: "grant",
        assignment: { role: "maintainer", scope: "platform" },
        targetUserId: "lena",
      },
    });
    assert.equal(replay.statusCode, 200);
    assert.equal(replay.headers["idempotent-replayed"], "true");

    const audit = await app.inject({
      method: "GET",
      url: "/api/v1/access/audit?limit=1",
      headers: { "x-kommunity-user-id": "maya" },
    });
    assert.equal(audit.statusCode, 200);
    assert.equal(audit.json().items.length, 1);
  } finally {
    await app.prisma.idempotencyRecord.deleteMany({ where: { key } });
    await app.prisma.auditLog.deleteMany({ where: { idempotencyKey: key } });
    if (!existing) {
      await app.prisma.roleAssignment.deleteMany({
        where: { userId: "lena", role: "MAINTAINER", scope: "PLATFORM" },
      });
    }
  }
});

test("inactive, unprivileged, and nonparticipant access fails closed", async () => {
  const inactive = await app.inject({
    method: "GET",
    url: "/api/v1/bootstrap",
    headers: { "x-kommunity-user-id": "disabled-demo" },
  });
  assert.equal(inactive.statusCode, 403);
  assert.equal(inactive.json().error.code, "IDENTITY_INACTIVE");

  const access = await app.inject({
    method: "GET",
    url: "/api/v1/access/users",
    headers: { "x-kommunity-user-id": "jon" },
  });
  assert.equal(access.statusCode, 403);

  const messages = await app.inject({
    method: "GET",
    url: "/api/v1/conversations/m1/messages",
    headers: { "x-kommunity-user-id": "lena" },
  });
  assert.equal(messages.statusCode, 404);

  const unknownQuery = await app.inject({
    method: "GET",
    url: "/api/v1/conversations/m1/messages?unexpected=true",
    headers: { "x-kommunity-user-id": "maya" },
  });
  assert.equal(unknownQuery.statusCode, 400);
  assert.equal(unknownQuery.json().error.code, "VALIDATION_ERROR");
});

test("message creation replays an idempotent request without duplicating data", async () => {
  const key = `test-message-${Date.now()}`;
  const body = `Integration message ${Date.now()}`;
  try {
    const first = await app.inject({
      method: "POST",
      url: "/api/v1/conversations/m1/messages",
      headers: {
        "x-kommunity-user-id": "maya",
        "idempotency-key": key,
      },
      payload: { body },
    });
    assert.equal(first.statusCode, 201);

    const replay = await app.inject({
      method: "POST",
      url: "/api/v1/conversations/m1/messages",
      headers: {
        "x-kommunity-user-id": "maya",
        "idempotency-key": key,
      },
      payload: { body },
    });
    assert.equal(replay.statusCode, 201);
    assert.equal(replay.headers["idempotent-replayed"], "true");
    assert.equal(replay.json().id, first.json().id);
    assert.equal(
      await app.prisma.message.count({ where: { body } }),
      1,
    );
  } finally {
    await app.prisma.message.deleteMany({ where: { body } });
    await app.prisma.idempotencyRecord.deleteMany({ where: { key } });
  }
});

test("community membership is persisted and can be restored", async () => {
  try {
    const joined = await app.inject({
      method: "PUT",
      url: "/api/v1/communities/c4/membership",
      headers: { "x-kommunity-user-id": "maya" },
      payload: { status: "joined" },
    });
    assert.equal(joined.statusCode, 200);
    assert.equal(joined.json().status, "joined");
    assert.equal(
      (
        await app.prisma.communityMember.findUniqueOrThrow({
          where: {
            communityId_userId: { communityId: "c4", userId: "maya" },
          },
        })
      ).status,
      "ACTIVE",
    );
  } finally {
    await app.prisma.communityMember.deleteMany({
      where: { communityId: "c4", userId: "maya" },
    });
  }
});

test("the final root assignment cannot be revoked", async () => {
  const mayaRoot =
    (await app.prisma.roleAssignment.findFirst({
      where: { role: "ROOT", scope: "PLATFORM", userId: "maya" },
    })) ??
    (await app.prisma.roleAssignment.create({
      data: {
        id: "test_maya_root",
        role: "ROOT",
        scope: "PLATFORM",
        userId: "maya",
      },
    }));
  const otherRoots = await app.prisma.roleAssignment.findMany({
    where: { role: "ROOT", scope: "PLATFORM", userId: { not: "maya" } },
  });
  try {
    await app.prisma.roleAssignment.deleteMany({
      where: { id: { in: otherRoots.map((assignment) => assignment.id) } },
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/access/roles",
      headers: {
        "x-kommunity-user-id": "maya",
        "idempotency-key": `test-final-root-${Date.now()}`,
      },
      payload: {
        targetUserId: "maya",
        action: "revoke",
        assignment: { role: "root", scope: "platform" },
      },
    });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().error.code, "FINAL_ROOT_REQUIRED");
  } finally {
    await app.prisma.roleAssignment.update({
      where: { id: mayaRoot.id },
      data: { role: "ROOT", scope: "PLATFORM" },
    });
    for (const assignment of otherRoots) {
      await app.prisma.roleAssignment.create({ data: assignment });
    }
  }
});
