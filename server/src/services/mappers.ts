import type {
  AvatarTone,
  IdentityStatus,
  Message,
  Prisma,
  RoleAssignment,
  User,
} from "@prisma/client";
import type {
  ApiRoleAssignment,
  ApiUser,
  MessageResponse,
} from "../schemas/api.js";

export const apiRoleAssignmentSelect = {
  role: true,
  scope: true,
  communityId: true,
  eventId: true,
} satisfies Prisma.RoleAssignmentSelect;

export const apiUserSelect = {
  id: true,
  handle: true,
  displayName: true,
  initials: true,
  status: true,
  roleAssignments: { select: apiRoleAssignmentSelect },
} satisfies Prisma.UserSelect;

const roleNames = {
  ROOT: "root",
  MAINTAINER: "maintainer",
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  PRESENTER: "presenter",
  USER: "user",
} as const;

const identityStatuses = {
  ACTIVE: "active",
  INVITED: "invited",
  DISABLED: "disabled",
  REVOKED: "revoked",
} as const;

export const toApiIdentityStatus = (
  status: IdentityStatus,
): ApiUser["status"] => identityStatuses[status];

export const toApiRoleAssignment = (
  assignment: Pick<
    RoleAssignment,
    "communityId" | "eventId" | "role" | "scope"
  >,
): ApiRoleAssignment => {
  const role = roleNames[assignment.role];
  if (assignment.scope === "PLATFORM") {
    if (role !== "root" && role !== "maintainer" && role !== "user") {
      throw new Error("Invalid platform role assignment persisted");
    }
    return { role, scope: "platform" };
  }
  if (assignment.scope === "COMMUNITY") {
    if (
      (role !== "super_admin" && role !== "admin") ||
      !assignment.communityId
    ) {
      throw new Error("Invalid community role assignment persisted");
    }
    return {
      role,
      scope: "community",
      scopeId: assignment.communityId,
    };
  }
  if (role !== "presenter" || !assignment.eventId) {
    throw new Error("Invalid event role assignment persisted");
  }
  return { role, scope: "event", scopeId: assignment.eventId };
};

export const toApiUser = (
  user: Pick<User, "displayName" | "handle" | "id" | "initials" | "status"> & {
    roleAssignments: Array<
      Pick<RoleAssignment, "communityId" | "eventId" | "role" | "scope">
    >;
  },
): ApiUser => ({
  id: user.id,
  handle: user.handle,
  displayName: user.displayName,
  initials: user.initials,
  status: toApiIdentityStatus(user.status),
  assignments: user.roleAssignments.map(toApiRoleAssignment),
});

const avatarColors: Record<
  AvatarTone,
  MessageResponse["color"]
> = {
  INK: "ink",
  BLUE: "blue",
  CORAL: "coral",
  ORANGE: "orange",
  PLUM: "plum",
  SAGE: "sage",
  VIOLET: "violet",
};

export const toApiMessage = (
  message: Pick<
    Message,
    "authorId" | "body" | "conversationId" | "createdAt" | "id"
  > & {
    author: Pick<User, "avatarTone" | "displayName" | "initials">;
  },
  viewerId: string,
): MessageResponse => ({
  id: message.id,
  conversationId: message.conversationId,
  authorId: message.authorId,
  author: message.author.displayName,
  initials: message.author.initials,
  color: avatarColors[message.author.avatarTone],
  body: message.body,
  createdAt: message.createdAt.toISOString(),
  own: message.authorId === viewerId,
});
