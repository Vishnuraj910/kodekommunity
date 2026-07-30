import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { afterAll, test } from "vitest";
import { seedDatabase } from "../prisma/seed.js";

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

test("the idempotent seed creates realistic auth and social coverage", async () => {
  const summary = await seedDatabase(
    prisma,
    "Integration seed passphrase! 2026",
  );

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
});
