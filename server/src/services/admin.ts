import {
  Prisma,
  type IdentityStatus,
  type PrismaClient,
} from "@prisma/client";
import { can, type AuthenticatedIdentity } from "../domain/authorization.js";
import { AppError } from "../domain/errors.js";
import type {
  AdminEventCreate,
  AdminEventUpdate,
  AdminGroupCreate,
  AdminGroupUpdate,
  AdminPostCreate,
  AdminPostUpdate,
  AdminUserCreate,
  AdminUserUpdate,
  AdminUser,
  BootstrapResponse,
  GroupResponse,
  PostResponse,
} from "../schemas/api.js";
import { runIdempotently } from "./idempotency.js";
import { apiUserSelect, toApiUser } from "./mappers.js";

const adminUserSelect = {
  ...apiUserSelect,
  email: true,
} satisfies Prisma.UserSelect;

type AdminUserRecord = Prisma.UserGetPayload<{
  select: typeof adminUserSelect;
}>;

const toAdminUser = (user: AdminUserRecord): AdminUser => ({
  ...toApiUser(user),
  email: user.email,
});

const requireRoot = (identity: AuthenticatedIdentity) => {
  if (!can(identity, "platform:manage")) {
    throw new AppError(403, "FORBIDDEN", "Root access is required");
  }
};

const initialsFor = (displayName: string) =>
  displayName
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const eventView = (
  event: {
    id: string;
    communityId: string;
    title: string;
    description: string;
    startsAt: Date;
    endsAt: Date;
    location: string;
    _count: { rsvps: number };
    rsvps: { userId: string }[];
  },
): BootstrapResponse["events"][number] => ({
  id: event.id,
  communityId: event.communityId,
  title: event.title,
  description: event.description,
  startsAt: event.startsAt.toISOString(),
  endsAt: event.endsAt.toISOString(),
  location: event.location,
  attendeeCount: event._count.rsvps,
  going: event.rsvps.length > 0,
});

const postView = (
  post: {
    id: string;
    communityId: string;
    groupId: string | null;
    body: string;
    authorId: string;
    createdAt: Date;
    updatedAt: Date;
    author: {
      id: string;
      displayName: string;
      initials: string;
      avatarTone: string;
    };
  },
  viewerId: string,
): PostResponse => ({
  id: post.id,
  communityId: post.communityId,
  groupId: post.groupId,
  body: post.body,
  author: {
    id: post.author.id,
    displayName: post.author.displayName,
    initials: post.author.initials,
    color: post.author.avatarTone.toLowerCase() as PostResponse["author"]["color"],
  },
  own: post.authorId === viewerId,
  createdAt: post.createdAt.toISOString(),
  updatedAt: post.updatedAt.toISOString(),
});

const groupView = (
  group: {
    id: string;
    communityId: string;
    name: string;
    slug: string;
    description: string;
    visibility: "PUBLIC" | "PRIVATE";
    createdAt: Date;
    _count: { members: number };
    members: { userId: string }[];
  },
): GroupResponse => ({
  id: group.id,
  communityId: group.communityId,
  name: group.name,
  slug: group.slug,
  description: group.description,
  visibility: group.visibility === "PUBLIC" ? "public" : "private",
  memberCount: group._count.members,
  joined: group.members.length > 0,
  createdAt: group.createdAt.toISOString(),
});

const statusForPersistence = (
  status: AdminUserUpdate["status"],
): IdentityStatus | undefined =>
  status ? (status.toUpperCase() as IdentityStatus) : undefined;

const uniqueConflict = (error: unknown): never => {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new AppError(
      409,
      "IDENTITY_CONFLICT",
      "A user with that email, handle, or identifier already exists",
    );
  }
  throw error;
};

export const getAdminOverview = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
) => {
  requireRoot(identity);
  const [users, communities, events, posts, groups] = await Promise.all([
    prisma.user.findMany({
      select: adminUserSelect,
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      take: 1000,
    }),
    prisma.community.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        visibility: true,
        _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
        memberships: {
          where: { userId: identity.id, status: "ACTIVE" },
          select: { userId: true },
        },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 100,
    }),
    prisma.event.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        communityId: true,
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        location: true,
        _count: { select: { rsvps: { where: { status: "GOING" } } } },
        rsvps: {
          where: { userId: identity.id, status: "GOING" },
          select: { userId: true },
        },
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: 1000,
    }),
    prisma.post.findMany({
      where: { deletedAt: null },
      include: {
        author: {
          select: {
            id: true,
            displayName: true,
            initials: true,
            avatarTone: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 1000,
    }),
    prisma.group.findMany({
      where: { deletedAt: null },
      include: {
        _count: { select: { members: { where: { status: "ACTIVE" } } } },
        members: {
          where: { userId: identity.id, status: "ACTIVE" },
          select: { userId: true },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 1000,
    }),
  ]);

  return {
    users: users.map(toAdminUser),
    communities: communities.map((community) => ({
      id: community.id,
      slug: community.slug,
      name: community.name,
      description: community.description,
      visibility: community.visibility.toLowerCase() as "public" | "private",
      memberCount: community._count.memberships,
      joined: community.memberships.length > 0,
    })),
    events: events.map(eventView),
    posts: posts.map((post) => postView(post, identity.id)),
    groups: groups.map(groupView),
  };
};

export const createAdminUser = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  input: AdminUserCreate,
  idempotencyKey: string,
) => {
  requireRoot(identity);
  try {
    return await runIdempotently<AdminUser>(
      prisma,
      {
        actorUserId: identity.id,
        key: idempotencyKey,
        action: "admin:user:create",
        request: input,
        statusCode: 201,
      },
      async (transaction) => {
        const user = await transaction.user.create({
          data: {
            id: input.id,
            displayName: input.displayName,
            email: input.email,
            handle: input.handle,
            initials: initialsFor(input.displayName),
            status: "INVITED",
            roleAssignments: {
              create: { role: "USER", scope: "PLATFORM" },
            },
          },
          select: adminUserSelect,
        });
        await transaction.auditLog.create({
          data: {
            actorUserId: identity.id,
            action: "admin.user.created",
            targetType: "user",
            targetId: user.id,
            idempotencyKey,
            metadata: { status: "invited" },
          },
        });
        return toAdminUser(user);
      },
    );
  } catch (error) {
    return uniqueConflict(error);
  }
};

const protectRootStatus = async (
  transaction: Prisma.TransactionClient,
  identity: AuthenticatedIdentity,
  userId: string,
  status: AdminUserUpdate["status"],
) => {
  if (!status || status === "active") return;
  if (userId === identity.id) {
    throw new AppError(
      409,
      "CURRENT_ROOT_REQUIRED",
      "The active root cannot revoke their own access",
    );
  }
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtext('kommunity:active-root-invariant')
    )
  `;
  const targetIsRoot = await transaction.roleAssignment.findFirst({
    where: { userId, role: "ROOT", scope: "PLATFORM" },
    select: { id: true },
  });
  if (!targetIsRoot) return;
  const activeRoots = await transaction.roleAssignment.count({
    where: {
      role: "ROOT",
      scope: "PLATFORM",
      user: { status: "ACTIVE" },
    },
  });
  if (activeRoots <= 1) {
    throw new AppError(
      409,
      "FINAL_ROOT_REQUIRED",
      "The final active root cannot be revoked",
    );
  }
};

export const updateAdminUser = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  userId: string,
  input: AdminUserUpdate,
  idempotencyKey: string,
) => {
  requireRoot(identity);
  try {
    return await runIdempotently<AdminUser>(
      prisma,
      {
        actorUserId: identity.id,
        key: idempotencyKey,
        action: `admin:user:update:${userId}`,
        request: input,
        statusCode: 200,
      },
      async (transaction) => {
        await protectRootStatus(transaction, identity, userId, input.status);
        const existing = await transaction.user.findUnique({
          where: { id: userId },
          select: { id: true },
        });
        if (!existing) {
          throw new AppError(404, "IDENTITY_NOT_FOUND", "Identity not found");
        }
        const user = await transaction.user.update({
          where: { id: userId },
          data: {
            displayName: input.displayName,
            email: input.email,
            handle: input.handle,
            initials: input.displayName
              ? initialsFor(input.displayName)
              : undefined,
            status: statusForPersistence(input.status),
            ...(
              input.status && input.status !== "active"
                ? { sessions: { updateMany: { where: { revokedAt: null }, data: { revokedAt: new Date() } } } }
                : {}
            ),
          },
          select: adminUserSelect,
        });
        await transaction.auditLog.create({
          data: {
            actorUserId: identity.id,
            action: "admin.user.updated",
            targetType: "user",
            targetId: userId,
            idempotencyKey,
            metadata: { fields: Object.keys(input) },
          },
        });
        return toAdminUser(user);
      },
    );
  } catch (error) {
    return uniqueConflict(error);
  }
};

export const revokeAdminUser = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  userId: string,
  idempotencyKey: string,
) => {
  requireRoot(identity);
  return runIdempotently(
    prisma,
    {
      actorUserId: identity.id,
      key: idempotencyKey,
      action: `admin:user:revoke:${userId}`,
      request: { userId },
      statusCode: 204,
    },
    async (transaction) => {
      await protectRootStatus(transaction, identity, userId, "revoked");
      const result = await transaction.user.updateMany({
        where: { id: userId },
        data: { status: "REVOKED" },
      });
      if (result.count !== 1) {
        throw new AppError(404, "IDENTITY_NOT_FOUND", "Identity not found");
      }
      await transaction.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: identity.id,
          action: "admin.user.revoked",
          targetType: "user",
          targetId: userId,
          idempotencyKey,
          metadata: {},
        },
      });
      return { revoked: true };
    },
  );
};

const eventInclude = (viewerId: string) => ({
  _count: { select: { rsvps: { where: { status: "GOING" as const } } } },
  rsvps: {
    where: { userId: viewerId, status: "GOING" as const },
    select: { userId: true },
  },
});

const postInclude = {
  author: {
    select: {
      id: true,
      displayName: true,
      initials: true,
      avatarTone: true,
    },
  },
} as const;

const groupInclude = (viewerId: string) => ({
  _count: { select: { members: { where: { status: "ACTIVE" as const } } } },
  members: {
    where: { userId: viewerId, status: "ACTIVE" as const },
    select: { userId: true },
  },
});

const ensureCommunity = async (prisma: PrismaClient, communityId: string) => {
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { id: true },
  });
  if (!community) {
    throw new AppError(404, "COMMUNITY_NOT_FOUND", "Community not found");
  }
};

const ensureGroup = async (
  prisma: PrismaClient,
  communityId: string,
  groupId: string,
) => {
  const group = await prisma.group.findFirst({
    where: { id: groupId, communityId, deletedAt: null },
    select: { id: true },
  });
  if (!group) throw new AppError(404, "GROUP_NOT_FOUND", "Group not found");
};

export const createAdminEvent = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  input: AdminEventCreate,
  idempotencyKey: string,
) => {
  requireRoot(identity);
  await ensureCommunity(prisma, input.communityId);
  try {
    return await runIdempotently<BootstrapResponse["events"][number]>(
      prisma,
      {
        actorUserId: identity.id,
        key: idempotencyKey,
        action: "admin:event:create",
        request: input,
        statusCode: 201,
      },
      async (transaction) => {
        const event = await transaction.event.create({
          data: {
            ...input,
            startsAt: new Date(input.startsAt),
            endsAt: new Date(input.endsAt),
            createdById: identity.id,
          },
          include: eventInclude(identity.id),
        });
        await transaction.auditLog.create({
          data: {
            actorUserId: identity.id,
            action: "admin.event.created",
            targetType: "event",
            targetId: event.id,
            communityId: event.communityId,
            eventId: event.id,
            idempotencyKey,
            metadata: {},
          },
        });
        return eventView(event);
      },
    );
  } catch (error) {
    return uniqueConflict(error);
  }
};

export const updateAdminEvent = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  eventId: string,
  input: AdminEventUpdate,
  idempotencyKey: string,
) => {
  requireRoot(identity);
  const existing = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: { startsAt: true, endsAt: true, communityId: true },
  });
  if (!existing) throw new AppError(404, "EVENT_NOT_FOUND", "Event not found");
  const startsAt = input.startsAt ? new Date(input.startsAt) : existing.startsAt;
  const endsAt = input.endsAt ? new Date(input.endsAt) : existing.endsAt;
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new AppError(
      400,
      "EVENT_TIME_INVALID",
      "Event end must be after its start",
    );
  }
  try {
    return await runIdempotently<BootstrapResponse["events"][number]>(
      prisma,
      {
        actorUserId: identity.id,
        key: idempotencyKey,
        action: `admin:event:update:${eventId}`,
        request: input,
        statusCode: 200,
      },
      async (transaction) => {
        const event = await transaction.event.update({
          where: { id: eventId },
          data: {
            ...input,
            startsAt: input.startsAt ? startsAt : undefined,
            endsAt: input.endsAt ? endsAt : undefined,
          },
          include: eventInclude(identity.id),
        });
        await transaction.auditLog.create({
          data: {
            actorUserId: identity.id,
            action: "admin.event.updated",
            targetType: "event",
            targetId: eventId,
            communityId: existing.communityId,
            eventId,
            idempotencyKey,
            metadata: { fields: Object.keys(input) },
          },
        });
        return eventView(event);
      },
    );
  } catch (error) {
    return uniqueConflict(error);
  }
};

export const deleteAdminEvent = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  eventId: string,
  idempotencyKey: string,
) => {
  requireRoot(identity);
  return runIdempotently(
    prisma,
    {
      actorUserId: identity.id,
      key: idempotencyKey,
      action: `admin:event:delete:${eventId}`,
      request: { eventId },
      statusCode: 204,
    },
    async (transaction) => {
      const event = await transaction.event.findFirst({
        where: { id: eventId, deletedAt: null },
        select: { communityId: true },
      });
      if (!event) throw new AppError(404, "EVENT_NOT_FOUND", "Event not found");
      await transaction.event.update({
        where: { id: eventId },
        data: { deletedAt: new Date() },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: identity.id,
          action: "admin.event.deleted",
          targetType: "event",
          targetId: eventId,
          communityId: event.communityId,
          eventId,
          idempotencyKey,
          metadata: { deletion: "soft" },
        },
      });
      return { deleted: true };
    },
  );
};

export const createAdminPost = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  input: AdminPostCreate,
  idempotencyKey: string,
) => {
  requireRoot(identity);
  await ensureCommunity(prisma, input.communityId);
  if (input.groupId) await ensureGroup(prisma, input.communityId, input.groupId);
  return runIdempotently<PostResponse>(
    prisma,
    {
      actorUserId: identity.id,
      key: idempotencyKey,
      action: "admin:post:create",
      request: input,
      statusCode: 201,
    },
    async (transaction) => {
      const post = await transaction.post.create({
        data: { ...input, authorId: identity.id },
        include: postInclude,
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: identity.id,
          action: "admin.post.created",
          targetType: "post",
          targetId: post.id,
          communityId: post.communityId,
          idempotencyKey,
          metadata: { groupId: post.groupId },
        },
      });
      return postView(post, identity.id);
    },
  );
};

export const updateAdminPost = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  postId: string,
  input: AdminPostUpdate,
  idempotencyKey: string,
) => {
  requireRoot(identity);
  const existing = await prisma.post.findFirst({
    where: { id: postId, deletedAt: null },
    select: { communityId: true },
  });
  if (!existing) throw new AppError(404, "POST_NOT_FOUND", "Post not found");
  if (input.groupId) {
    await ensureGroup(prisma, existing.communityId, input.groupId);
  }
  return runIdempotently<PostResponse>(
    prisma,
    {
      actorUserId: identity.id,
      key: idempotencyKey,
      action: `admin:post:update:${postId}`,
      request: input,
      statusCode: 200,
    },
    async (transaction) => {
      const post = await transaction.post.update({
        where: { id: postId },
        data: input,
        include: postInclude,
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: identity.id,
          action: "admin.post.updated",
          targetType: "post",
          targetId: postId,
          communityId: existing.communityId,
          idempotencyKey,
          metadata: { fields: Object.keys(input) },
        },
      });
      return postView(post, identity.id);
    },
  );
};

export const deleteAdminPost = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  postId: string,
  idempotencyKey: string,
) => {
  requireRoot(identity);
  return runIdempotently(
    prisma,
    {
      actorUserId: identity.id,
      key: idempotencyKey,
      action: `admin:post:delete:${postId}`,
      request: { postId },
      statusCode: 204,
    },
    async (transaction) => {
      const post = await transaction.post.findFirst({
        where: { id: postId, deletedAt: null },
        select: { communityId: true },
      });
      if (!post) throw new AppError(404, "POST_NOT_FOUND", "Post not found");
      await transaction.post.update({
        where: { id: postId },
        data: { deletedAt: new Date() },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: identity.id,
          action: "admin.post.deleted",
          targetType: "post",
          targetId: postId,
          communityId: post.communityId,
          idempotencyKey,
          metadata: { deletion: "soft" },
        },
      });
      return { deleted: true };
    },
  );
};

export const createAdminGroup = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  input: AdminGroupCreate,
  idempotencyKey: string,
) => {
  requireRoot(identity);
  await ensureCommunity(prisma, input.communityId);
  try {
    return await runIdempotently<GroupResponse>(
      prisma,
      {
        actorUserId: identity.id,
        key: idempotencyKey,
        action: "admin:group:create",
        request: input,
        statusCode: 201,
      },
      async (transaction) => {
        const group = await transaction.group.create({
          data: {
            ...input,
            createdById: identity.id,
            visibility: input.visibility === "public" ? "PUBLIC" : "PRIVATE",
            members: {
              create: { userId: identity.id, status: "ACTIVE" },
            },
          },
          include: groupInclude(identity.id),
        });
        await transaction.auditLog.create({
          data: {
            actorUserId: identity.id,
            action: "admin.group.created",
            targetType: "group",
            targetId: group.id,
            communityId: group.communityId,
            idempotencyKey,
            metadata: { visibility: input.visibility },
          },
        });
        return groupView(group);
      },
    );
  } catch (error) {
    return uniqueConflict(error);
  }
};

export const updateAdminGroup = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  groupId: string,
  input: AdminGroupUpdate,
  idempotencyKey: string,
) => {
  requireRoot(identity);
  const existing = await prisma.group.findFirst({
    where: { id: groupId, deletedAt: null },
    select: { communityId: true },
  });
  if (!existing) throw new AppError(404, "GROUP_NOT_FOUND", "Group not found");
  try {
    return await runIdempotently<GroupResponse>(
      prisma,
      {
        actorUserId: identity.id,
        key: idempotencyKey,
        action: `admin:group:update:${groupId}`,
        request: input,
        statusCode: 200,
      },
      async (transaction) => {
        const group = await transaction.group.update({
          where: { id: groupId },
          data: {
            ...input,
            visibility:
              input.visibility === undefined
                ? undefined
                : input.visibility === "public"
                  ? "PUBLIC"
                  : "PRIVATE",
          },
          include: groupInclude(identity.id),
        });
        await transaction.auditLog.create({
          data: {
            actorUserId: identity.id,
            action: "admin.group.updated",
            targetType: "group",
            targetId: groupId,
            communityId: existing.communityId,
            idempotencyKey,
            metadata: { fields: Object.keys(input) },
          },
        });
        return groupView(group);
      },
    );
  } catch (error) {
    return uniqueConflict(error);
  }
};

export const deleteAdminGroup = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  groupId: string,
  idempotencyKey: string,
) => {
  requireRoot(identity);
  return runIdempotently(
    prisma,
    {
      actorUserId: identity.id,
      key: idempotencyKey,
      action: `admin:group:delete:${groupId}`,
      request: { groupId },
      statusCode: 204,
    },
    async (transaction) => {
      const group = await transaction.group.findFirst({
        where: { id: groupId, deletedAt: null },
        select: { communityId: true },
      });
      if (!group) throw new AppError(404, "GROUP_NOT_FOUND", "Group not found");
      const deletedAt = new Date();
      await transaction.group.update({
        where: { id: groupId },
        data: {
          deletedAt,
          posts: { updateMany: { where: { deletedAt: null }, data: { deletedAt } } },
          broadcasts: {
            updateMany: { where: { deletedAt: null }, data: { deletedAt } },
          },
          conversations: {
            updateMany: { where: { deletedAt: null }, data: { deletedAt } },
          },
        },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: identity.id,
          action: "admin.group.deleted",
          targetType: "group",
          targetId: groupId,
          communityId: group.communityId,
          idempotencyKey,
          metadata: { deletion: "soft" },
        },
      });
      return { deleted: true };
    },
  );
};
