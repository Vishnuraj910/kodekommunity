import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, test } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";

let app: FastifyInstance;
const conversationKey = `direct-${Date.now()}`;
const messageKey = `direct-message-${Date.now()}`;
const messageKeys = [messageKey, `${messageKey}-2`, `${messageKey}-3`];
const messageBody = `Thanks for the review notes — I incorporated the rollback checklist ${Date.now()}.`;
let conversationId: string | undefined;

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
  if (conversationId) {
    await app.prisma.auditLog.deleteMany({
      where: { targetType: "conversation", targetId: conversationId },
    });
    await app.prisma.conversation.deleteMany({
      where: { id: conversationId },
    });
  }
  await app.prisma.idempotencyRecord.deleteMany({
    where: { key: { in: [conversationKey, ...messageKeys] } },
  });
  await app.close();
});

test("two active community members create one direct thread and exchange messages", async () => {
  const conversation = await app.inject({
    method: "POST",
    url: "/api/v1/conversations/direct",
    headers: {
      "idempotency-key": conversationKey,
      "x-kommunity-user-id": "jon",
    },
    payload: { communityId: "c1", targetUserId: "maya" },
  });
  assert.equal(conversation.statusCode, 201);
  assert.equal(conversation.json().type, "direct");
  assert.equal(conversation.json().participantCount, 2);
  conversationId = conversation.json().id;

  const replay = await app.inject({
    method: "POST",
    url: "/api/v1/conversations/direct",
    headers: {
      "idempotency-key": conversationKey,
      "x-kommunity-user-id": "jon",
    },
    payload: { communityId: "c1", targetUserId: "maya" },
  });
  assert.equal(replay.statusCode, 201);
  assert.equal(replay.json().id, conversationId);

  const message = await app.inject({
    method: "POST",
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: {
      "idempotency-key": messageKey,
      "x-kommunity-user-id": "maya",
    },
    payload: { body: messageBody },
  });
  assert.equal(message.statusCode, 201);
  for (const [index, key] of messageKeys.slice(1).entries()) {
    const extraMessage = await app.inject({
      method: "POST",
      url: `/api/v1/conversations/${conversationId}/messages`,
      headers: {
        "idempotency-key": key,
        "x-kommunity-user-id": "maya",
      },
      payload: { body: `${messageBody} page ${index + 2}` },
    });
    assert.equal(extraMessage.statusCode, 201);
  }

  const history = await app.inject({
    method: "GET",
    url: `/api/v1/conversations/${conversationId}/messages?limit=2`,
    headers: { "x-kommunity-user-id": "jon" },
  });
  assert.equal(history.statusCode, 200);
  assert.ok(
    history.json().items.some(
      (messageItem: { body: string }) => messageItem.body === `${messageBody} page 2`,
    ),
  );
  assert.equal(typeof history.json().nextCursor, "string");
  const olderHistory = await app.inject({
    method: "GET",
    url: `/api/v1/conversations/${conversationId}/messages?limit=2&cursor=${history.json().nextCursor}`,
    headers: { "x-kommunity-user-id": "jon" },
  });
  assert.equal(olderHistory.statusCode, 200);
  assert.deepEqual(
    olderHistory.json().items.map((item: { body: string }) => item.body),
    [messageBody],
  );

  const outsider = await app.inject({
    method: "GET",
    url: `/api/v1/conversations/${conversationId}/messages?limit=20`,
    headers: { "x-kommunity-user-id": "lena" },
  });
  assert.equal(outsider.statusCode, 404);
});

test("a member cannot start a direct thread with a community outsider", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/conversations/direct",
    headers: {
      "idempotency-key": `direct-forbidden-${Date.now()}`,
      "x-kommunity-user-id": "jon",
    },
    payload: { communityId: "c1", targetUserId: "lena" },
  });
  assert.equal(response.statusCode, 404);
});
