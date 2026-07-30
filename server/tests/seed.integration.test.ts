import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { afterAll, test } from "vitest";
import { seedDatabase } from "../prisma/seed.js";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

test("the idempotent seed creates realistic auth and social coverage", async () => {
  const configuredPassword = process.env.SEED_COMMON_PASSWORD;
  assert.ok(configuredPassword, "SEED_COMMON_PASSWORD is required for this test");
  const summary = await seedDatabase(prisma, configuredPassword);

  for (const role of [
    "ROOT",
    "MAINTAINER",
    "SUPER_ADMIN",
    "ADMIN",
    "PRESENTER",
    "USER",
  ] as const) {
    assert.ok(summary.roleCounts[role] >= 2, `${role} needs two users`);
  }
  assert.equal(summary.credentials, summary.activeUsers);
  assert.ok(summary.groups >= 3);
  assert.ok(summary.posts >= 4);
  assert.ok(summary.broadcasts >= 2);
  assert.ok(summary.conversations >= 3);
  assert.ok(summary.messages >= 8);

  const app = await buildApp(
    loadConfig({
      ...process.env,
      NODE_ENV: "test",
      ALLOW_DEMO_AUTH: "false",
      LOG_LEVEL: "silent",
    }),
  );
  try {
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: "maya@kommunity.local",
        password: configuredPassword,
      },
    });
    assert.equal(login.statusCode, 200);
  } finally {
    await app.close();
  }
}, 15_000);
