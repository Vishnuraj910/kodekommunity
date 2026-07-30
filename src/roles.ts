export const roleNames = [
  "root",
  "maintainer",
  "super_admin",
  "admin",
  "presenter",
  "user",
] as const;

export type RoleName = (typeof roleNames)[number];

export type RoleAssignment =
  | {
      role: "root" | "maintainer" | "user";
      scope: "platform";
    }
  | {
      role: "super_admin" | "admin";
      scope: "community";
      scopeId: string;
    }
  | {
      role: "presenter";
      scope: "event";
      scopeId: string;
    };

export type AuthorizationContext = {
  communityId?: string;
  eventId?: string;
};

export type Permission =
  | "platform:manage"
  | "platform:maintain"
  | "community:transfer"
  | "community:manage"
  | "event:present"
  | "content:participate";

export type RoleDefinition = {
  role: RoleName;
  label: string;
  description: string;
  scopeLabel: string;
  tone: "ink" | "violet" | "blue" | "sage" | "orange" | "coral";
};

export const roleAssignmentKey = (assignment: RoleAssignment): string =>
  assignment.scope === "platform"
    ? `${assignment.role}:platform`
    : `${assignment.role}:${assignment.scope}:${assignment.scopeId}`;

export const roleDefinitions: Record<RoleName, RoleDefinition> = {
  root: {
    role: "root",
    label: "Root",
    description: "Full platform administration, including access control.",
    scopeLabel: "Platform",
    tone: "ink",
  },
  maintainer: {
    role: "maintainer",
    label: "Maintainer",
    description: "Platform operations, safety, support, and maintenance.",
    scopeLabel: "Platform",
    tone: "blue",
  },
  super_admin: {
    role: "super_admin",
    label: "Super admin",
    description: "Primary owner of a specific community.",
    scopeLabel: "Community",
    tone: "violet",
  },
  admin: {
    role: "admin",
    label: "Admin",
    description: "Administration within a specific community.",
    scopeLabel: "Community",
    tone: "orange",
  },
  presenter: {
    role: "presenter",
    label: "Presenter",
    description: "May manage presentation details for a specific event.",
    scopeLabel: "Event",
    tone: "coral",
  },
  user: {
    role: "user",
    label: "User",
    description: "Regular participation in communities, events, and chat.",
    scopeLabel: "Platform",
    tone: "sage",
  },
};

export const defaultAssignmentFor = (role: RoleName): RoleAssignment => {
  switch (role) {
    case "root":
    case "maintainer":
    case "user":
      return { role, scope: "platform" };
    case "super_admin":
    case "admin":
      return { role, scope: "community", scopeId: "c1" };
    case "presenter":
      return { role, scope: "event", scopeId: "e1" };
  }
};

export const hasRole = (
  assignments: readonly RoleAssignment[] | undefined,
  role: RoleName,
  context: AuthorizationContext = {},
): boolean =>
  assignments?.some((assignment) => {
    if (assignment.role !== role) return false;
    if (assignment.scope === "community") {
      return context.communityId
        ? assignment.scopeId === context.communityId
        : true;
    }
    if (assignment.scope === "event") {
      return context.eventId ? assignment.scopeId === context.eventId : true;
    }
    return true;
  }) ?? false;

export const can = (
  assignments: readonly RoleAssignment[] | undefined,
  permission: Permission,
  context: AuthorizationContext = {},
): boolean => {
  if (hasRole(assignments, "root")) return true;

  switch (permission) {
    case "platform:manage":
      return false;
    case "platform:maintain":
      return hasRole(assignments, "maintainer");
    case "community:transfer":
      return (
        Boolean(context.communityId) &&
        hasRole(assignments, "super_admin", context)
      );
    case "community:manage":
      return (
        Boolean(context.communityId) &&
        (hasRole(assignments, "super_admin", context) ||
          hasRole(assignments, "admin", context))
      );
    case "event:present":
      return (
        (Boolean(context.eventId) &&
          hasRole(assignments, "presenter", context)) ||
        (Boolean(context.communityId) &&
          can(assignments, "community:manage", context))
      );
    case "content:participate":
      return hasRole(assignments, "user");
  }
};

export const assignmentScope = (assignment: RoleAssignment): string => {
  if (assignment.scope === "platform") return "Platform";
  if (assignment.scope === "community") {
    return assignment.scopeId === "c1"
      ? "KodeKommunity"
      : `Community ${assignment.scopeId}`;
  }
  return assignment.scopeId === "e1"
    ? "Designing for trust"
    : `Event ${assignment.scopeId}`;
};

export const toggleAssignment = (
  assignments: RoleAssignment[],
  target: RoleAssignment,
): RoleAssignment[] => {
  if (target.role === "user") return assignments;
  const targetKey = roleAssignmentKey(target);
  const exists = assignments.some(
    (assignment) => roleAssignmentKey(assignment) === targetKey,
  );
  return exists
    ? assignments.filter(
        (assignment) => roleAssignmentKey(assignment) !== targetKey,
      )
    : [...assignments, target];
};
