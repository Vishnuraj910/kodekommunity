import {
  identityStatuses,
  roleAssignmentSchema,
  roleNames,
  type ApiRoleAssignment,
} from "../server/src/schemas/api.ts";
import { isRecord } from "./validation.ts";

export { identityStatuses, roleNames };

export type RoleName = (typeof roleNames)[number];

export type RoleAssignment = ApiRoleAssignment;

export type AuthorizationContext = {
  communityId?: string;
  eventId?: string;
};

export type IdentityStatus = (typeof identityStatuses)[number];

export type AuthorizationSubject = {
  status: IdentityStatus;
  assignments: readonly RoleAssignment[];
};

export type RoleDirectory = Record<string, RoleAssignment[]>;
export type IdentityStatusDirectory = Record<string, IdentityStatus>;

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

export const isRoleAssignment = (value: unknown): value is RoleAssignment =>
  roleAssignmentSchema.safeParse(value).success;

export const isRoleDirectory = (value: unknown): value is RoleDirectory => {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  if (!entries.length || entries.length > 1_000) return false;

  const validEntries = entries.every(
    ([userId, assignments]) =>
      /^[a-zA-Z0-9_-]{1,64}$/.test(userId) &&
      Array.isArray(assignments) &&
      assignments.length > 0 &&
      assignments.length <= 100 &&
      assignments.every(isRoleAssignment) &&
      hasRole(assignments, "user"),
  );

  return (
    validEntries &&
    entries.some(([, assignments]) =>
      hasRole(assignments as RoleAssignment[], "root"),
    )
  );
};

export const isIdentityStatusDirectory = (
  value: unknown,
): value is IdentityStatusDirectory => {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return (
    entries.length > 0 &&
    entries.length <= 1_000 &&
    entries.every(
      ([userId, status]) =>
        /^[a-zA-Z0-9_-]{1,64}$/.test(userId) &&
        identityStatuses.some((candidate) => candidate === status),
    )
  );
};

export const activeSubject = (
  assignments: readonly RoleAssignment[],
): AuthorizationSubject => ({
  status: "active",
  assignments,
});

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
  subject: AuthorizationSubject,
  permission: Permission,
  context: AuthorizationContext = {},
): boolean => {
  if (subject.status !== "active") return false;
  if (
    (permission === "community:transfer" ||
      permission === "community:manage") &&
    !context.communityId
  ) {
    return false;
  }
  if (permission === "event:present" && !context.eventId) return false;

  const { assignments } = subject;
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
          can(subject, "community:manage", context))
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
