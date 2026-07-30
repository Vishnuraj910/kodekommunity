import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, test } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";

let app: FastifyInstance;
const title = `Release readiness briefing ${Date.now()}`;
const idempotencyKey = `broadcast-${Date.now()}`;
const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

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
  const broadcast = await app.prisma.broadcast.findFirst({
    where: { title },
    select: { id: true },
  });
  if (broadcast) {
    await app.prisma.auditLog.deleteMany({
      where: { targetType: "broadcast", targetId: broadcast.id },
    });
    await app.prisma.broadcast.delete({ where: { id: broadcast.id } });
  }
  await app.prisma.idempotencyRecord.deleteMany({
    where: { key: idempotencyKey },
  });
  await app.close();
});

test("a community administrator schedules an idempotent broadcast", async () => {
  const payload = {
    body: "Join the maintainers for scope, rollback ownership, support coverage, and the final go/no-go decision.",
    startsAt,
    title,
  };
  const first = await app.inject({
    method: "POST",
    url: "/api/v1/communities/c1/broadcasts",
    headers: {
      "idempotency-key": idempotencyKey,
      "x-kommunity-user-id": "priya",
    },
    payload,
  });
  assert.equal(first.statusCode, 201);
  assert.equal(first.json().status, "scheduled");
  assert.equal(first.json().title, title);

  const replay = await app.inject({
    method: "POST",
    url: "/api/v1/communities/c1/broadcasts",
    headers: {
      "idempotency-key": idempotencyKey,
      "x-kommunity-user-id": "priya",
    },
    payload,
  });
  assert.equal(replay.statusCode, 201);
  assert.equal(replay.headers["idempotent-replayed"], "true");
  assert.equal(replay.json().id, first.json().id);

  const broadcasts = await app.inject({
    method: "GET",
    url: "/api/v1/communities/c1/broadcasts?limit=20",
    headers: { "x-kommunity-user-id": "jon" },
  });
  assert.equal(broadcasts.statusCode, 200);
  assert.ok(
    broadcasts
      .json()
      .items.some((broadcast: { title: string }) => broadcast.title === title),
  );
});

test("a regular member cannot create a broadcast", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/communities/c1/broadcasts",
    headers: {
      "idempotency-key": `broadcast-forbidden-${Date.now()}`,
      "x-kommunity-user-id": "jon",
    },
    payload: {
      body: "This should not be scheduled.",
      startsAt,
      title: "Unauthorized broadcast",
    },
  });
  assert.equal(response.statusCode, 403);
});
