import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";

let app: FastifyInstance;

before(async () => {
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

after(async () => {
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
});
