import assert from "node:assert/strict";
import { test } from "vitest";
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

test("every permission is explicit and object scoped", () => {
  const root = identity([
    { role: "root", scope: "platform" },
    { role: "user", scope: "platform" },
  ]);
  const maintainer = identity([
    { role: "maintainer", scope: "platform" },
    { role: "user", scope: "platform" },
  ]);
  const owner = identity([
    { role: "super_admin", scope: "community", scopeId: "c1" },
    { role: "user", scope: "platform" },
  ]);
  const presenter = identity([
    { role: "presenter", scope: "event", scopeId: "e1" },
    { role: "user", scope: "platform" },
  ]);
  assert.equal(can(root, "event:present", { eventId: "any" }), true);
  assert.equal(can(maintainer, "platform:maintain"), true);
  assert.equal(can(maintainer, "platform:manage"), false);
  assert.equal(can(owner, "community:manage", { communityId: "c1" }), true);
  assert.equal(
    can(owner, "event:present", { communityId: "c1", eventId: "e2" }),
    true,
  );
  assert.equal(can(presenter, "event:present", { eventId: "e1" }), true);
  assert.equal(can(presenter, "event:present", { eventId: "e2" }), false);
  assert.equal(can(presenter, "event:present"), false);
  assert.equal(can(identity([]), "content:participate"), false);
  assert.equal(can(identity([{ role: "user", scope: "platform" }]), "content:participate"), true);
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
