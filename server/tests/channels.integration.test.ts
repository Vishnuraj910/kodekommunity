import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, test } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";

let app: FastifyInstance;
const slug = `release-coordination-${Date.now()}`;
const channelKey = `channel-${Date.now()}`;
const messageKey = `channel-message-${Date.now()}`;
const messageBody = `Rollback rehearsal starts at ${new Date(Date.now() + 3_600_000).toISOString()}.`;

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
  const channel = await app.prisma.conversation.findUnique({
    where: { communityId_slug: { communityId: "c1", slug } },
    select: { id: true },
  });
  if (channel) {
    await app.prisma.auditLog.deleteMany({
      where: { targetType: "conversation", targetId: channel.id },
    });
    await app.prisma.conversation.delete({ where: { id: channel.id } });
  }
  await app.prisma.idempotencyRecord.deleteMany({
    where: { key: { in: [channelKey, messageKey] } },
  });
  await app.close();
});

test("an administrator creates a participant-scoped channel that supports chat", async () => {
  const channel = await app.inject({
    method: "POST",
    url: "/api/v1/communities/c1/channels",
    headers: {
      "idempotency-key": channelKey,
      "x-kommunity-user-id": "priya",
    },
    payload: {
      description: "Release owners coordinate readiness, risk, and rollback here.",
      participantIds: ["maya", "jon"],
      slug,
      title: "Release coordination",
      visibility: "private",
    },
  });
  assert.equal(channel.statusCode, 201);
  assert.equal(channel.json().slug, slug);
  assert.equal(channel.json().participantCount, 3);

  const channels = await app.inject({
    method: "GET",
    url: "/api/v1/communities/c1/channels?limit=20",
    headers: { "x-kommunity-user-id": "jon" },
  });
  assert.equal(channels.statusCode, 200);
  assert.ok(channels.json().items.some((item: { slug: string }) => item.slug === slug));

  const message = await app.inject({
    method: "POST",
    url: `/api/v1/conversations/${channel.json().id}/messages`,
    headers: {
      "idempotency-key": messageKey,
      "x-kommunity-user-id": "jon",
    },
    payload: { body: messageBody },
  });
  assert.equal(message.statusCode, 201);
  assert.equal(message.json().body, messageBody);

  const outsider = await app.inject({
    method: "GET",
    url: `/api/v1/conversations/${channel.json().id}/messages?limit=20`,
    headers: { "x-kommunity-user-id": "lena" },
  });
  assert.equal(outsider.statusCode, 404);
});

test("a regular member cannot create a channel", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/communities/c1/channels",
    headers: {
      "idempotency-key": `channel-forbidden-${Date.now()}`,
      "x-kommunity-user-id": "jon",
    },
    payload: {
      description: "This channel should not be created.",
      participantIds: [],
      slug: `unauthorized-${Date.now()}`,
      title: "Unauthorized channel",
      visibility: "private",
    },
  });
  assert.equal(response.statusCode, 403);
});
