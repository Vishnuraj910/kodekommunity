import type { AvatarTone, PrismaClient } from "@prisma/client";
import { can, type AuthenticatedIdentity } from "../domain/authorization.js";
import { AppError } from "../domain/errors.js";
import type { PostResponse } from "../schemas/api.js";
import { runIdempotently } from "./idempotency.js";

type PostInput = {
  body: string;
  groupId?: string;
};

const authorSelect = {
  id: true,
  displayName: true,
  initials: true,
  avatarTone: true,
} as const;

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
      avatarTone: AvatarTone;
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

const communityAccess = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  communityId: string,
) => {
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: {
      visibility: true,
      memberships: {
        where: { userId: identity.id, status: "ACTIVE" },
        select: { userId: true },
      },
    },
  });
  const manages = can(identity, "community:manage", { communityId });
  if (
    !community ||
    (community.visibility === "PRIVATE" &&
      community.memberships.length === 0 &&
      !manages)
  ) {
    throw new AppError(404, "COMMUNITY_NOT_FOUND", "Community not found");
  }
  return { isMember: community.memberships.length > 0, manages };
};

export const createPost = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  communityId: string,
  input: PostInput,
  idempotencyKey: string,
) => {
  if (!can(identity, "content:participate")) {
    throw new AppError(403, "FORBIDDEN", "Participation permission is required");
  }
  const access = await communityAccess(prisma, identity, communityId);
  if (!access.isMember && !access.manages) {
    throw new AppError(
      403,
      "COMMUNITY_MEMBERSHIP_REQUIRED",
      "Active community membership is required to publish",
    );
  }
  if (input.groupId) {
    const group = await prisma.group.findFirst({
      where: {
        id: input.groupId,
        communityId,
        deletedAt: null,
      },
      select: {
        members: {
          where: { userId: identity.id, status: "ACTIVE" },
          select: { userId: true },
        },
      },
    });
    if (!group) {
      throw new AppError(404, "GROUP_NOT_FOUND", "Group not found");
    }
    if (group.members.length === 0 && !access.manages) {
      throw new AppError(
        403,
        "GROUP_MEMBERSHIP_REQUIRED",
        "Active group membership is required to publish",
      );
    }
  }

  return runIdempotently<PostResponse>(
    prisma,
    {
      actorUserId: identity.id,
      key: idempotencyKey,
      action: `post:create:${communityId}`,
      request: { communityId, ...input },
      statusCode: 201,
    },
    async (transaction) => {
      const post = await transaction.post.create({
        data: {
          authorId: identity.id,
          body: input.body,
          communityId,
          groupId: input.groupId,
        },
        include: { author: { select: authorSelect } },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: identity.id,
          action: "post.published",
          targetType: "post",
          targetId: post.id,
          communityId,
          idempotencyKey,
          metadata: { groupId: input.groupId ?? null },
        },
      });
      return postView(post, identity.id);
    },
  );
};

export const listPosts = async (
  prisma: PrismaClient,
  identity: AuthenticatedIdentity,
  communityId: string,
  limit: number,
  cursor?: string,
) => {
  const access = await communityAccess(prisma, identity, communityId);
  const posts = await prisma.post.findMany({
    where: {
      communityId,
      deletedAt: null,
      ...(access.manages
        ? {}
        : {
            OR: [
              { groupId: null },
              { group: { visibility: "PUBLIC" } },
              {
                group: {
                  members: {
                    some: { userId: identity.id, status: "ACTIVE" },
                  },
                },
              },
            ],
          }),
    },
    include: { author: { select: authorSelect } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = posts.length > limit;
  const page = posts.slice(0, limit);
  return {
    items: page.map((post) => postView(post, identity.id)),
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  };
};
