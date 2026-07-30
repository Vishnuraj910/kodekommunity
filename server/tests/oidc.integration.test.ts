import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, test } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";

let app: FastifyInstance;

const email = `oidc-${Date.now()}@example.test`;
const state = `state-${Date.now()}`;

const provider = {
  authorizationRequest: async () => ({
    codeVerifier: "test-code-verifier",
    nonce: "test-nonce",
    state,
    url: new URL(
      `https://identity.example.test/authorize?state=${encodeURIComponent(state)}`,
    ),
  }),
  consumeCallback: async ({
    expectedNonce,
    expectedState,
  }: {
    expectedNonce: string;
    expectedState: string;
  }) => {
    assert.equal(expectedNonce, "test-nonce");
    assert.equal(expectedState, state);
    return {
      displayName: "OIDC Tester",
      email,
      emailVerified: true,
      issuer: "https://identity.example.test",
      preferredUsername: `oidc_${Date.now()}`,
      subject: `subject-${Date.now()}`,
    };
  },
};

beforeAll(async () => {
  app = await buildApp(
    loadConfig({
      ...process.env,
      NODE_ENV: "test",
      ALLOW_DEMO_AUTH: "false",
      LOG_LEVEL: "silent",
      OIDC_ISSUER_URL: "https://identity.example.test",
      OIDC_CLIENT_ID: "kommunity-test",
      OIDC_CLIENT_SECRET: "test-secret",
      OIDC_REDIRECT_URI:
        "http://127.0.0.1:8787/api/v1/auth/oidc/callback",
    }),
    { oidcClient: provider },
  );
});

afterAll(async () => {
  await app.prisma.auditLog.deleteMany({ where: { actor: { email } } });
  await app.prisma.user.deleteMany({ where: { email } });
  await app.close();
});

test("OIDC is the preferred one-time registration and login flow", async () => {
  const start = await app.inject({
    method: "GET",
    url: "/api/v1/auth/oidc/start",
  });
  assert.equal(start.statusCode, 302);
  assert.equal(
    start.headers.location,
    `https://identity.example.test/authorize?state=${encodeURIComponent(state)}`,
  );

  const callback = await app.inject({
    method: "GET",
    url: `/api/v1/auth/oidc/callback?code=provider-code&state=${encodeURIComponent(state)}`,
  });
  assert.equal(callback.statusCode, 302);
  assert.equal(callback.headers.location, "http://127.0.0.1:4173/");
  assert.equal(typeof callback.headers["set-cookie"], "string");

  const session = await app.inject({
    method: "GET",
    url: "/api/v1/auth/session",
    headers: {
      cookie: (callback.headers["set-cookie"] as string).split(";", 1)[0],
    },
  });
  assert.equal(session.statusCode, 200);
  assert.equal(session.json().user.email, email);

  const replay = await app.inject({
    method: "GET",
    url: `/api/v1/auth/oidc/callback?code=replayed&state=${encodeURIComponent(state)}`,
  });
  assert.equal(replay.statusCode, 401);
  assert.equal(replay.json().error.code, "INVALID_OIDC_FLOW");
});
