import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, test } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";

let app: FastifyInstance;
const body = `Today we published our incident review template ${Date.now()}. It keeps the focus on learning, ownership, and concrete follow-up.`;
const idempotencyKey = `post-${Date.now()}`;

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
  const post = await app.prisma.post.findFirst({
    where: { body },
    select: { id: true },
  });
  if (post) {
    await app.prisma.auditLog.deleteMany({
      where: { targetType: "post", targetId: post.id },
    });
    await app.prisma.post.delete({ where: { id: post.id } });
  }
  await app.prisma.idempotencyRecord.deleteMany({
    where: { key: idempotencyKey },
  });
  await app.close();
});

test("a community member publishes an idempotent post into the feed", async () => {
  const first = await app.inject({
    method: "POST",
    url: "/api/v1/communities/c1/posts",
    headers: {
      "idempotency-key": idempotencyKey,
      "x-kommunity-user-id": "jon",
    },
    payload: { body },
  });
  assert.equal(first.statusCode, 201);
  assert.equal(first.json().author.id, "jon");
  assert.equal(first.json().body, body);

  const replay = await app.inject({
    method: "POST",
    url: "/api/v1/communities/c1/posts",
    headers: {
      "idempotency-key": idempotencyKey,
      "x-kommunity-user-id": "jon",
    },
    payload: { body },
  });
  assert.equal(replay.statusCode, 201);
  assert.equal(replay.headers["idempotent-replayed"], "true");
  assert.equal(replay.json().id, first.json().id);

  const feed = await app.inject({
    method: "GET",
    url: "/api/v1/communities/c1/posts?limit=20",
    headers: { "x-kommunity-user-id": "maya" },
  });
  assert.equal(feed.statusCode, 200);
  assert.ok(feed.json().items.some((post: { body: string }) => post.body === body));
});

test("a non-member cannot publish into a community", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/communities/c1/posts",
    headers: {
      "idempotency-key": `post-forbidden-${Date.now()}`,
      "x-kommunity-user-id": "lena",
    },
    payload: { body: "This should not be published." },
  });
  assert.equal(response.statusCode, 403);
});
