import assert from "node:assert/strict";
import test from "node:test";

import {
  can,
  roleAssignmentKey,
  toggleAssignment,
} from "../src/roles.ts";

test("scoped permissions fail closed without matching context", () => {
  const assignments = [
    { role: "user", scope: "platform" },
    { role: "admin", scope: "community", scopeId: "community-a" },
    { role: "presenter", scope: "event", scopeId: "event-a" },
  ];

  assert.equal(can(assignments, "community:manage"), false);
  assert.equal(
    can(assignments, "community:manage", { communityId: "community-b" }),
    false,
  );
  assert.equal(
    can(assignments, "community:manage", { communityId: "community-a" }),
    true,
  );
  assert.equal(can(assignments, "event:present"), false);
  assert.equal(
    can(assignments, "event:present", { eventId: "event-b" }),
    false,
  );
  assert.equal(
    can(assignments, "event:present", { eventId: "event-a" }),
    true,
  );
});

test("toggling a scoped role preserves grants for other scopes", () => {
  const assignments = [
    { role: "user", scope: "platform" },
    { role: "admin", scope: "community", scopeId: "c1" },
    { role: "admin", scope: "community", scopeId: "c2" },
  ];

  const result = toggleAssignment(assignments, {
    role: "admin",
    scope: "community",
    scopeId: "c1",
  });

  assert.deepEqual(result.map(roleAssignmentKey), [
    "user:platform",
    "admin:community:c2",
  ]);
});
