import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, test } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";

let app: FastifyInstance;
const slug = `platform-engineering-${Date.now()}`;
const idempotencyKey = `group-${Date.now()}`;

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
  const group = await app.prisma.group.findUnique({
    where: { communityId_slug: { communityId: "c1", slug } },
    select: { id: true },
  });
  if (group) {
    await app.prisma.auditLog.deleteMany({
      where: { targetType: "group", targetId: group.id },
    });
    await app.prisma.group.delete({ where: { id: group.id } });
  }
  await app.prisma.idempotencyRecord.deleteMany({
    where: { key: idempotencyKey },
  });
  await app.close();
});

test("a community administrator creates an idempotent group visible to members", async () => {
  const payload = {
    description:
      "A focused circle for reliable systems, incident learning, and operable software.",
    name: "Platform Engineering",
    slug,
    visibility: "public",
  };
  const first = await app.inject({
    method: "POST",
    url: "/api/v1/communities/c1/groups",
    headers: {
      "idempotency-key": idempotencyKey,
      "x-kommunity-user-id": "priya",
    },
    payload,
  });
  assert.equal(first.statusCode, 201);
  assert.equal(first.json().communityId, "c1");
  assert.equal(first.json().slug, slug);

  const replay = await app.inject({
    method: "POST",
    url: "/api/v1/communities/c1/groups",
    headers: {
      "idempotency-key": idempotencyKey,
      "x-kommunity-user-id": "priya",
    },
    payload,
  });
  assert.equal(replay.statusCode, 201);
  assert.equal(replay.headers["idempotent-replayed"], "true");
  assert.equal(replay.json().id, first.json().id);

  const groups = await app.inject({
    method: "GET",
    url: "/api/v1/communities/c1/groups?limit=20",
    headers: { "x-kommunity-user-id": "jon" },
  });
  assert.equal(groups.statusCode, 200);
  assert.ok(groups.json().items.some((group: { slug: string }) => group.slug === slug));
});

test("a regular member cannot create a group", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/communities/c1/groups",
    headers: {
      "idempotency-key": `group-forbidden-${Date.now()}`,
      "x-kommunity-user-id": "jon",
    },
    payload: {
      description: "A group that should not be created.",
      name: "Unauthorized Group",
      slug: `unauthorized-${Date.now()}`,
      visibility: "public",
    },
  });
  assert.equal(response.statusCode, 403);
});
