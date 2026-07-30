import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, test } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";

let app: FastifyInstance;

const email = `local-auth-${Date.now()}@example.test`;
const handle = `local_auth_${Date.now()}`.slice(0, 32);
const password = "A secure test passphrase! 2026";

const sessionCookie = (response: { headers: Record<string, unknown> }) => {
  const raw = response.headers["set-cookie"];
  if (typeof raw !== "string") {
    assert.fail("Expected the response to set a session cookie");
  }
  return raw.split(";", 1)[0];
};

beforeAll(async () => {
  app = await buildApp(
    loadConfig({
      ...process.env,
      NODE_ENV: "test",
      ALLOW_DEMO_AUTH: "false",
      LOG_LEVEL: "silent",
    }),
  );
});

afterAll(async () => {
  await app.prisma.auditLog.deleteMany({ where: { actor: { email } } });
  await app.prisma.user.deleteMany({ where: { email } });
  await app.close();
});

test("a user can register, use and revoke a session, then log in again", async () => {
  const registration = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: {
      displayName: "Local Auth Tester",
      email,
      handle,
      password,
    },
  });
  assert.equal(registration.statusCode, 201);
  assert.deepEqual(registration.json().user, {
    displayName: "Local Auth Tester",
    email,
    handle,
  });
  assert.equal("password" in registration.json(), false);
  const firstCookie = sessionCookie(registration);

  const currentSession = await app.inject({
    method: "GET",
    url: "/api/v1/auth/session",
    headers: { cookie: firstCookie },
  });
  assert.equal(currentSession.statusCode, 200);
  assert.equal(currentSession.json().user.email, email);

  const logout = await app.inject({
    method: "POST",
    url: "/api/v1/auth/logout",
    headers: { cookie: firstCookie },
  });
  assert.equal(logout.statusCode, 204);

  const revokedSession = await app.inject({
    method: "GET",
    url: "/api/v1/auth/session",
    headers: { cookie: firstCookie },
  });
  assert.equal(revokedSession.statusCode, 401);

  const wrongPassword = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password: "A different passphrase! 2026" },
  });
  assert.equal(wrongPassword.statusCode, 401);
  assert.equal(wrongPassword.json().error.code, "INVALID_CREDENTIALS");

  const login = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email: email.toUpperCase(), password },
  });
  assert.equal(login.statusCode, 200);
  assert.notEqual(sessionCookie(login), firstCookie);
});

test("registration rejects a duplicate email without disclosing internals", async () => {
  const duplicate = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: {
      displayName: "Duplicate Tester",
      email: email.toUpperCase(),
      handle: `duplicate_${Date.now()}`.slice(0, 32),
      password,
    },
  });

  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.json().error.code, "ACCOUNT_ALREADY_EXISTS");
});
