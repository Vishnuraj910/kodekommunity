import type { ApiRoleAssignment } from "../schemas/api.js";

export type AuthenticatedIdentity = {
  id: string;
  status: "active" | "invited" | "disabled" | "revoked";
  assignments: ApiRoleAssignment[];
};

export type AuthorizationContext = {
  communityId?: string;
  eventId?: string;
};

export type Permission =
  | "platform:manage"
  | "platform:maintain"
  | "community:manage"
  | "event:present"
  | "content:participate";

const hasRole = (
  identity: AuthenticatedIdentity,
  role: ApiRoleAssignment["role"],
  context: AuthorizationContext = {},
): boolean =>
  identity.assignments.some((assignment) => {
    if (assignment.role !== role) return false;
    if (assignment.scope === "community") {
      return assignment.scopeId === context.communityId;
    }
    if (assignment.scope === "event") {
      return assignment.scopeId === context.eventId;
    }
    return true;
  });

export const can = (
  identity: AuthenticatedIdentity,
  permission: Permission,
  context: AuthorizationContext = {},
): boolean => {
  if (identity.status !== "active") return false;
  if (
    permission === "community:manage" &&
    typeof context.communityId !== "string"
  ) {
    return false;
  }
  if (
    permission === "event:present" &&
    typeof context.eventId !== "string"
  ) {
    return false;
  }
  if (hasRole(identity, "root")) return true;

  switch (permission) {
    case "platform:manage":
      return false;
    case "platform:maintain":
      return hasRole(identity, "maintainer");
    case "community:manage":
      return (
        hasRole(identity, "super_admin", context) ||
        hasRole(identity, "admin", context)
      );
    case "event:present":
      return (
        hasRole(identity, "presenter", context) ||
        (typeof context.communityId === "string" &&
          can(identity, "community:manage", context))
      );
    case "content:participate":
      return hasRole(identity, "user");
  }
};
