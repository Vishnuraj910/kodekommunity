import assert from "node:assert/strict";
import test from "node:test";
import { can, type AuthenticatedIdentity } from "../src/domain/authorization.js";
import { loadConfig } from "../src/config/env.js";

const identity = (
  assignments: AuthenticatedIdentity["assignments"],
  status: AuthenticatedIdentity["status"] = "active",
): AuthenticatedIdentity => ({ id: "test-user", status, assignments });

test("scoped community roles cannot authorize another tenant", () => {
  const admin = identity([
    { role: "user", scope: "platform" },
    { role: "admin", scope: "community", scopeId: "c1" },
  ]);
  assert.equal(
    can(admin, "community:manage", { communityId: "c1" }),
    true,
  );
  assert.equal(
    can(admin, "community:manage", { communityId: "c2" }),
    false,
  );
  assert.equal(can(admin, "community:manage"), false);
});

test("inactive identities fail closed even with root", () => {
  const disabledRoot = identity(
    [
      { role: "root", scope: "platform" },
      { role: "user", scope: "platform" },
    ],
    "disabled",
  );
  assert.equal(can(disabledRoot, "platform:manage"), false);
});

test("production configuration rejects development identity selection", () => {
  assert.throws(() =>
    loadConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://localhost/kommunity",
      ALLOW_DEMO_AUTH: "true",
      DEMO_USER_ID: "maya",
    }),
  );
});
