import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, test } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";

let app: FastifyInstance;
const idempotencyKey = `realtime-message-${Date.now()}`;
const body = `Realtime delivery test ${Date.now()}`;

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
  await app.prisma.message.deleteMany({ where: { body } });
  await app.prisma.idempotencyRecord.deleteMany({
    where: { key: idempotencyKey },
  });
  await app.close();
});

test("a participant receives a typed event after durable message creation", async () => {
  const socket = await app.injectWS("/api/v1/conversations/m1/live", {
    headers: { "x-kommunity-user-id": "maya" },
  });
  const eventPromise = new Promise<string>((resolve) => {
    socket.once("message", (data) => resolve(data.toString()));
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/conversations/m1/messages",
    headers: {
      "idempotency-key": idempotencyKey,
      "x-kommunity-user-id": "maya",
    },
    payload: { body },
  });
  assert.equal(response.statusCode, 201);

  const event = JSON.parse(await eventPromise);
  assert.equal(event.type, "message.created");
  assert.equal(event.conversationId, "m1");
  assert.equal(event.message.id, response.json().id);
  assert.equal(event.message.body, body);
  assert.equal("own" in event.message, false);
  socket.terminate();
});

test("a nonparticipant cannot establish a live conversation subscription", async () => {
  await assert.rejects(
    app.injectWS("/api/v1/conversations/m1/live", {
      headers: { "x-kommunity-user-id": "lena" },
    }),
  );
});

test("live subscriptions answer typed pings and reject malformed frames", async () => {
  const pingSocket = await app.injectWS("/api/v1/conversations/m1/live", {
    headers: { "x-kommunity-user-id": "maya" },
  });
  const pong = new Promise<string>((resolve) => {
    pingSocket.once("message", (data) => resolve(data.toString()));
  });
  pingSocket.send(JSON.stringify({ type: "ping" }));
  assert.deepEqual(JSON.parse(await pong), { type: "pong" });
  pingSocket.terminate();

  const malformedSocket = await app.injectWS(
    "/api/v1/conversations/m1/live",
    { headers: { "x-kommunity-user-id": "maya" } },
  );
  const closeCode = new Promise<number>((resolve) => {
    malformedSocket.once("close", resolve);
  });
  malformedSocket.send("{not-json");
  assert.equal(await closeCode, 1008);
});
