import { describe, expect, it } from "vitest";
import {
  activeSubject,
  assignmentScope,
  can,
  defaultAssignmentFor,
  hasRole,
  isIdentityStatusDirectory,
  isRoleAssignment,
  isRoleDirectory,
  roleAssignmentKey,
  roleDefinitions,
  roleNames,
  toggleAssignment,
  type RoleAssignment,
} from "./roles";

const user: RoleAssignment = { role: "user", scope: "platform" };
const root: RoleAssignment = { role: "root", scope: "platform" };
const maintainer: RoleAssignment = { role: "maintainer", scope: "platform" };
const owner: RoleAssignment = {
  role: "super_admin",
  scope: "community",
  scopeId: "c1",
};
const admin: RoleAssignment = {
  role: "admin",
  scope: "community",
  scopeId: "c1",
};
const presenter: RoleAssignment = {
  role: "presenter",
  scope: "event",
  scopeId: "e1",
};

describe("role authorization", () => {
  it("builds stable scoped keys and defaults for every role", () => {
    expect(roleAssignmentKey(root)).toBe("root:platform");
    expect(roleAssignmentKey(admin)).toBe("admin:community:c1");
    expect(roleAssignmentKey(presenter)).toBe("presenter:event:e1");
    expect(roleNames.map(defaultAssignmentFor)).toEqual([
      root,
      maintainer,
      owner,
      admin,
      presenter,
      user,
    ]);
    expect(Object.keys(roleDefinitions)).toEqual([...roleNames]);
  });

  it("validates assignments and bounded directories with a baseline user and root", () => {
    expect(isRoleAssignment(admin)).toBe(true);
    expect(isRoleAssignment({ role: "admin", scope: "platform" })).toBe(false);
    expect(isRoleDirectory({ maya: [user, root], lee: [user, admin] })).toBe(true);
    expect(isRoleDirectory(null)).toBe(false);
    expect(isRoleDirectory({})).toBe(false);
    expect(isRoleDirectory({ "bad id": [user, root] })).toBe(false);
    expect(isRoleDirectory({ maya: [] })).toBe(false);
    expect(isRoleDirectory({ maya: [root] })).toBe(false);
    expect(isRoleDirectory({ maya: [user] })).toBe(false);
    expect(
      isRoleDirectory(
        Object.fromEntries(
          Array.from({ length: 1_001 }, (_, index) => [`u${index}`, [user, root]]),
        ),
      ),
    ).toBe(false);
  });

  it("validates identity lifecycle directories", () => {
    expect(isIdentityStatusDirectory({ maya: "active", sam: "disabled" })).toBe(true);
    expect(isIdentityStatusDirectory(null)).toBe(false);
    expect(isIdentityStatusDirectory({})).toBe(false);
    expect(isIdentityStatusDirectory({ "bad id": "active" })).toBe(false);
    expect(isIdentityStatusDirectory({ maya: "unknown" })).toBe(false);
  });

  it("checks exact scope and fails closed for inactive identities", () => {
    expect(hasRole([admin], "admin")).toBe(true);
    expect(hasRole([admin], "admin", { communityId: "c2" })).toBe(false);
    expect(hasRole([presenter], "presenter", { eventId: "e1" })).toBe(true);
    expect(hasRole(undefined, "user")).toBe(false);

    expect(can({ status: "disabled", assignments: [root] }, "platform:manage")).toBe(false);
    expect(can(activeSubject([root]), "platform:manage")).toBe(true);
    expect(can(activeSubject([user]), "platform:manage")).toBe(false);
    expect(can(activeSubject([maintainer]), "platform:maintain")).toBe(true);
    expect(can(activeSubject([owner]), "community:transfer", { communityId: "c1" })).toBe(true);
    expect(can(activeSubject([admin]), "community:transfer", { communityId: "c1" })).toBe(false);
    expect(can(activeSubject([admin]), "community:manage", { communityId: "c1" })).toBe(true);
    expect(can(activeSubject([presenter]), "event:present", { eventId: "e1" })).toBe(true);
    expect(can(activeSubject([admin]), "event:present", { communityId: "c1", eventId: "e2" })).toBe(true);
    expect(can(activeSubject([user]), "content:participate")).toBe(true);
    expect(can(activeSubject([admin]), "community:manage")).toBe(false);
    expect(can(activeSubject([presenter]), "event:present")).toBe(false);
  });

  it("renders scope labels and toggles only the exact scoped grant", () => {
    expect(assignmentScope(root)).toBe("Platform");
    expect(assignmentScope(admin)).toBe("KodeKommunity");
    expect(
      assignmentScope({ ...admin, scopeId: "c2" }),
    ).toBe("Community c2");
    expect(assignmentScope(presenter)).toBe("Designing for trust");
    expect(
      assignmentScope({ ...presenter, scopeId: "e2" }),
    ).toBe("Event e2");

    expect(toggleAssignment([user], user)).toEqual([user]);
    expect(toggleAssignment([user], admin)).toEqual([user, admin]);
    expect(toggleAssignment([user, admin], admin)).toEqual([user]);
  });
});
