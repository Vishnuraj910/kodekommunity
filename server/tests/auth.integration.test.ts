import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, test } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";

let app: FastifyInstance;

const email = `local-auth-${Date.now()}@example.test`;
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
      password,
    },
  });
  assert.equal(registration.statusCode, 201);
  const username = registration.json().user.handle as string;
  assert.match(username, /^local_auth_tester_[a-f0-9]{8}$/);
  assert.deepEqual(
    registration.json().user,
    {
      displayName: "Local Auth Tester",
      email,
      handle: username,
    },
  );
  assert.equal("password" in registration.json(), false);
  const firstCookie = sessionCookie(registration);

  const currentSession = await app.inject({
    method: "GET",
    url: "/api/v1/auth/session",
    headers: { cookie: firstCookie },
  });
  assert.equal(currentSession.statusCode, 200);
  assert.equal(currentSession.json().user.email, email);
  const registeredBootstrap = await app.inject({
    method: "GET",
    url: "/api/v1/bootstrap",
    headers: { cookie: firstCookie },
  });
  assert.deepEqual(registeredBootstrap.json().user.assignments, [
    { role: "user", scope: "platform" },
  ]);

  const conflictingProfileUpdate = await app.inject({
    method: "PATCH",
    url: "/api/v1/auth/profile",
    headers: { cookie: firstCookie },
    payload: {
      displayName: "Local Auth Tester",
      username: "maya-builds",
    },
  });
  assert.equal(conflictingProfileUpdate.statusCode, 409);
  assert.equal(
    conflictingProfileUpdate.json().error.code,
    "USERNAME_ALREADY_EXISTS",
  );

  const updatedUsername = `local-auth-renamed-${Date.now()}`;
  const profileUpdate = await app.inject({
    method: "PATCH",
    url: "/api/v1/auth/profile",
    headers: { cookie: firstCookie },
    payload: {
      displayName: "Local Auth Renamed",
      username: updatedUsername,
    },
  });
  assert.equal(profileUpdate.statusCode, 200);
  assert.deepEqual(profileUpdate.json().user, {
    displayName: "Local Auth Renamed",
    email,
    handle: updatedUsername,
  });

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
    payload: { identifier: email, password: "A different passphrase! 2026" },
  });
  assert.equal(wrongPassword.statusCode, 401);
  assert.equal(wrongPassword.json().error.code, "INVALID_CREDENTIALS");

  const login = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { identifier: updatedUsername.toUpperCase(), password },
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
      password,
    },
  });

  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.json().error.code, "ACCOUNT_ALREADY_EXISTS");
});

test("email registration requires a verification link before password login", async () => {
  const verificationEmail = `verify-${Date.now()}@example.test`;
  const deliveries: Array<{
    email: string;
    username: string;
    verificationUrl: string;
  }> = [];
  const verificationApp = await buildApp(
    loadConfig({
      ...process.env,
      NODE_ENV: "test",
      ALLOW_DEMO_AUTH: "false",
      EMAIL_VERIFICATION_MODE: "email",
      RESEND_API_KEY: "re_test",
      EMAIL_FROM: "Kommunity <verify@example.test>",
      LOG_LEVEL: "silent",
    }),
    {
      verificationMailer: {
        sendVerificationEmail: async (delivery) => {
          deliveries.push(delivery);
        },
      },
    },
  );

  try {
    const registration = await verificationApp.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Verification Tester",
        email: verificationEmail,
        password,
      },
    });
    assert.equal(registration.statusCode, 201);
    assert.equal(registration.headers["set-cookie"], undefined);
    assert.deepEqual(registration.json(), {
      status: "verification_required",
      username: deliveries[0]?.username,
    });
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0]?.email, verificationEmail);

    const blockedLogin = await verificationApp.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: deliveries[0]!.username,
        password,
      },
    });
    assert.equal(blockedLogin.statusCode, 403);
    assert.equal(
      blockedLogin.json().error.code,
      "EMAIL_VERIFICATION_REQUIRED",
    );

    const verificationUrl = new URL(deliveries[0]!.verificationUrl);
    const verification = await verificationApp.inject({
      method: "GET",
      url: `${verificationUrl.pathname}${verificationUrl.search}`,
    });
    assert.equal(verification.statusCode, 302);
    assert.equal(
      verification.headers.location,
      "http://127.0.0.1:4173/login?verified=1",
    );
    const replay = await verificationApp.inject({
      method: "GET",
      url: `${verificationUrl.pathname}${verificationUrl.search}`,
    });
    assert.equal(replay.statusCode, 400);
    assert.equal(replay.json().error.code, "INVALID_VERIFICATION_LINK");
    const unknownToken = await verificationApp.inject({
      method: "GET",
      url: `/api/v1/auth/verify-email?token=${"x".repeat(43)}`,
    });
    assert.equal(unknownToken.statusCode, 400);
    assert.equal(
      unknownToken.json().error.code,
      "INVALID_VERIFICATION_LINK",
    );

    const login = await verificationApp.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: verificationEmail.toUpperCase(),
        password,
      },
    });
    assert.equal(login.statusCode, 200);
  } finally {
    await verificationApp.prisma.auditLog.deleteMany({
      where: { actor: { email: verificationEmail } },
    });
    await verificationApp.prisma.user.deleteMany({
      where: { email: verificationEmail },
    });
    await verificationApp.close();
  }
});

test("demo identities require an explicit development header", async () => {
  const demoApp = await buildApp(
    loadConfig({
      ...process.env,
      NODE_ENV: "test",
      ALLOW_DEMO_AUTH: "true",
      DEMO_USER_ID: "maya",
      LOG_LEVEL: "silent",
    }),
  );
  try {
    const anonymous = await demoApp.inject({
      method: "GET",
      url: "/api/v1/auth/session",
    });
    assert.equal(anonymous.statusCode, 401);

    const selectedDemoIdentity = await demoApp.inject({
      method: "GET",
      url: "/api/v1/auth/session",
      headers: { "x-kommunity-user-id": "maya" },
    });
    assert.equal(selectedDemoIdentity.statusCode, 200);
  } finally {
    await demoApp.close();
  }
});
