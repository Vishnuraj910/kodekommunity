import { z } from "zod";

export const identifierSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .describe("Stable Kommunity identifier");

export const identityStatuses = [
  "active",
  "invited",
  "disabled",
  "revoked",
] as const;
export const identityStatusSchema = z.enum(identityStatuses);

export const roleNames = [
  "root",
  "maintainer",
  "super_admin",
  "admin",
  "presenter",
  "user",
] as const;

export const platformRoleAssignmentSchema = z
  .object({
    role: z.enum(["root", "maintainer", "user"]),
    scope: z.literal("platform"),
  })
  .strict();

export const communityRoleAssignmentSchema = z
  .object({
    role: z.enum(["super_admin", "admin"]),
    scope: z.literal("community"),
    scopeId: identifierSchema,
  })
  .strict();

export const eventRoleAssignmentSchema = z
  .object({
    role: z.literal("presenter"),
    scope: z.literal("event"),
    scopeId: identifierSchema,
  })
  .strict();

export const roleAssignmentSchema = z.discriminatedUnion("scope", [
  platformRoleAssignmentSchema,
  communityRoleAssignmentSchema,
  eventRoleAssignmentSchema,
]);

export const userSchema = z.object({
  id: identifierSchema,
  handle: z.string().min(1).max(32),
  displayName: z.string().min(1).max(120),
  initials: z.string().min(1).max(8),
  status: identityStatusSchema,
  assignments: z.array(roleAssignmentSchema).max(100),
});

export const communitySchema = z.object({
  id: identifierSchema,
  slug: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  description: z.string().max(1000),
  visibility: z.enum(["public", "private"]),
  memberCount: z.number().int().nonnegative(),
  joined: z.boolean(),
});

export const eventSchema = z.object({
  id: identifierSchema,
  communityId: identifierSchema,
  title: z.string().min(1).max(160),
  description: z.string().max(2000),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  location: z.string().min(1).max(240),
  attendeeCount: z.number().int().nonnegative(),
  going: z.boolean(),
});

export const conversationSchema = z.object({
  id: identifierSchema,
  communityId: identifierSchema,
  title: z.string().min(1).max(160),
  type: z.enum(["community", "direct", "event", "group"]),
  updatedAt: z.string().datetime(),
  lastMessage: z
    .object({
      body: z.string().max(4000),
      createdAt: z.string().datetime(),
    })
    .nullable(),
});

export const messageSchema = z.object({
  id: identifierSchema,
  conversationId: identifierSchema,
  authorId: identifierSchema,
  author: z.string().min(1).max(120),
  initials: z.string().min(1).max(8),
  color: z.enum([
    "ink",
    "blue",
    "coral",
    "orange",
    "plum",
    "sage",
    "violet",
  ]),
  body: z.string().min(1).max(4000),
  createdAt: z.string().datetime(),
  own: z.boolean(),
});

export const liveMessageSchema = messageSchema.omit({ own: true });

export const messageCreatedEventSchema = z.object({
  type: z.literal("message.created"),
  conversationId: identifierSchema,
  message: liveMessageSchema,
});

export type LiveMessage = z.infer<typeof liveMessageSchema>;

export const bootstrapSchema = z.object({
  user: userSchema,
  communities: z.array(communitySchema).max(100),
  events: z.array(eventSchema).max(100),
  conversations: z.array(conversationSchema).max(100),
});

export const accessDirectorySchema = z.object({
  users: z.array(userSchema).max(1000),
});

export const auditEventSchema = z.object({
  id: identifierSchema,
  actorUserId: identifierSchema,
  action: z.string().min(1).max(120),
  targetType: z.string().min(1).max(80),
  targetId: identifierSchema,
  communityId: identifierSchema.nullable(),
  eventId: identifierSchema.nullable(),
  idempotencyKey: z.string().max(128).nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
});

export const errorSchema = z.object({
  error: z.object({
    code: z.string().min(1).max(80),
    message: z.string().min(1).max(500),
    requestId: z.string().min(1).max(128),
    details: z.unknown().optional(),
  }),
});

export const idParamsSchema = z.object({ id: identifierSchema }).strict();

export const conversationParamsSchema = z
  .object({ conversationId: identifierSchema })
  .strict();

export const eventParamsSchema = z
  .object({ eventId: identifierSchema })
  .strict();

export const communityParamsSchema = z
  .object({ communityId: identifierSchema })
  .strict();

export const paginationQuerySchema = z
  .object({
    cursor: identifierSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const rsvpRequestSchema = z
  .object({
    status: z.enum(["going", "not_going"]),
  })
  .strict();

export const rsvpResponseSchema = z.object({
  eventId: identifierSchema,
  status: z.enum(["going", "not_going"]),
  updatedAt: z.string().datetime(),
});

export const membershipRequestSchema = z
  .object({
    status: z.enum(["joined", "left"]),
  })
  .strict();

export const membershipResponseSchema = z.object({
  communityId: identifierSchema,
  status: z.enum(["joined", "left"]),
  updatedAt: z.string().datetime(),
});

export const messageRequestSchema = z
  .object({
    body: z.string().trim().min(1).max(4000),
  })
  .strict();

export const roleChangeRequestSchema = z
  .object({
    targetUserId: identifierSchema,
    action: z.enum(["grant", "revoke"]),
    assignment: roleAssignmentSchema,
  })
  .strict();

export const roleChangeResponseSchema = z.object({
  user: userSchema,
});

export const idempotencyHeadersSchema = z.object({
  "idempotency-key": z.string().min(8).max(128),
});

export const emailSchema = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());

export const adminUserSchema = userSchema.extend({
  email: emailSchema.nullable(),
});

export const passwordSchema = z.string().min(12).max(128);

export const registrationRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120),
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export const loginRequestSchema = z
  .object({
    identifier: z.string().trim().toLowerCase().min(3).max(320),
    password: z.string().max(128),
  })
  .strict();

export const authenticatedUserSchema = z.object({
  displayName: z.string().min(1).max(120),
  email: emailSchema,
  handle: z.string().min(1).max(32),
});

export const authResponseSchema = z.object({
  user: authenticatedUserSchema,
});

export const profileUpdateRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(32)
      .regex(/^[a-z0-9_-]+$/),
  })
  .strict();

export const registrationResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("authenticated"),
    user: authenticatedUserSchema,
  }),
  z.object({
    status: z.literal("verification_required"),
    username: z.string().min(1).max(32),
  }),
]);

export const emailVerificationQuerySchema = z
  .object({ token: z.string().min(32).max(512) })
  .strict();

export const oidcCallbackQuerySchema = z
  .object({
    code: z.string().min(1).max(4000),
    state: z.string().min(16).max(512),
  })
  .catchall(z.string().max(4000));

export const adminUserCreateSchema = z
  .object({
    id: identifierSchema.optional(),
    displayName: z.string().trim().min(1).max(120),
    email: emailSchema,
    handle: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(32)
      .regex(/^[a-z0-9_-]+$/),
  })
  .strict();

export const adminUserUpdateSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    email: emailSchema.optional(),
    handle: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(32)
      .regex(/^[a-z0-9_-]+$/)
      .optional(),
    status: identityStatusSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one user field is required",
  });

export const adminUserParamsSchema = z
  .object({ userId: identifierSchema })
  .strict();

export const adminEventParamsSchema = z
  .object({ eventId: identifierSchema })
  .strict();

export const adminPostParamsSchema = z
  .object({ postId: identifierSchema })
  .strict();

export const adminGroupParamsSchema = z
  .object({ groupId: identifierSchema })
  .strict();

export const adminEventCreateSchema = z
  .object({
    id: identifierSchema.optional(),
    communityId: identifierSchema,
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(2000),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    location: z.string().trim().min(1).max(240),
  })
  .strict()
  .refine((value) => Date.parse(value.endsAt) > Date.parse(value.startsAt), {
    message: "Event end must be after its start",
    path: ["endsAt"],
  });

export const adminEventUpdateSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().min(1).max(2000).optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    location: z.string().trim().min(1).max(240).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one event field is required",
  });

export const adminPostCreateSchema = z
  .object({
    id: identifierSchema.optional(),
    communityId: identifierSchema,
    groupId: identifierSchema.optional(),
    body: z.string().trim().min(1).max(10_000),
  })
  .strict();

export const adminPostUpdateSchema = z
  .object({
    groupId: identifierSchema.nullable().optional(),
    body: z.string().trim().min(1).max(10_000).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one post field is required",
  });

export const groupRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: z.string().trim().min(1).max(1000),
    visibility: z.enum(["public", "private"]),
  })
  .strict();

export const adminGroupCreateSchema = groupRequestSchema.extend({
  id: identifierSchema.optional(),
  communityId: identifierSchema,
}).strict();

export const adminGroupUpdateSchema = groupRequestSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one group field is required",
  });

export const groupSchema = z.object({
  id: identifierSchema,
  communityId: identifierSchema,
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(80),
  description: z.string().max(1000),
  visibility: z.enum(["public", "private"]),
  memberCount: z.number().int().nonnegative(),
  joined: z.boolean(),
  createdAt: z.string().datetime(),
});

export const groupPageSchema = z.object({
  items: z.array(groupSchema).max(100),
  nextCursor: identifierSchema.nullable(),
});

export type GroupResponse = z.infer<typeof groupSchema>;

export const postRequestSchema = z
  .object({
    body: z.string().trim().min(1).max(10_000),
    groupId: identifierSchema.optional(),
  })
  .strict();

export const postSchema = z.object({
  id: identifierSchema,
  communityId: identifierSchema,
  groupId: identifierSchema.nullable(),
  body: z.string().min(1).max(10_000),
  author: z.object({
    id: identifierSchema,
    displayName: z.string().min(1).max(120),
    initials: z.string().min(1).max(8),
    color: z.enum([
      "ink",
      "blue",
      "coral",
      "orange",
      "plum",
      "sage",
      "violet",
    ]),
  }),
  own: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const postPageSchema = z.object({
  items: z.array(postSchema).max(100),
  nextCursor: identifierSchema.nullable(),
});

export type PostResponse = z.infer<typeof postSchema>;

export const broadcastRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1).max(5000),
    groupId: identifierSchema.optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.endsAt && !value.startsAt) {
      context.addIssue({
        code: "custom",
        message: "startsAt is required when endsAt is supplied",
        path: ["startsAt"],
      });
    }
    if (
      value.startsAt &&
      value.endsAt &&
      Date.parse(value.endsAt) <= Date.parse(value.startsAt)
    ) {
      context.addIssue({
        code: "custom",
        message: "endsAt must be after startsAt",
        path: ["endsAt"],
      });
    }
  });

export const broadcastSchema = z.object({
  id: identifierSchema,
  communityId: identifierSchema,
  groupId: identifierSchema.nullable(),
  title: z.string().min(1).max(160),
  body: z.string().min(1).max(5000),
  status: z.enum(["draft", "scheduled", "live", "ended", "cancelled"]),
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
  author: z.object({
    id: identifierSchema,
    displayName: z.string().min(1).max(120),
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const broadcastPageSchema = z.object({
  items: z.array(broadcastSchema).max(100),
  nextCursor: identifierSchema.nullable(),
});

export type BroadcastResponse = z.infer<typeof broadcastSchema>;

export const channelRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: z.string().trim().min(1).max(1000),
    visibility: z.enum(["public", "private"]),
    groupId: identifierSchema.optional(),
    participantIds: z.array(identifierSchema).max(100),
  })
  .strict();

export const channelSchema = z.object({
  id: identifierSchema,
  communityId: identifierSchema,
  groupId: identifierSchema.nullable(),
  title: z.string().min(1).max(160),
  slug: z.string().min(1).max(80),
  description: z.string().max(1000),
  visibility: z.enum(["public", "private"]),
  participantCount: z.number().int().positive(),
  updatedAt: z.string().datetime(),
});

export const channelPageSchema = z.object({
  items: z.array(channelSchema).max(100),
  nextCursor: identifierSchema.nullable(),
});

export type ChannelResponse = z.infer<typeof channelSchema>;

export const directConversationRequestSchema = z
  .object({
    communityId: identifierSchema,
    targetUserId: identifierSchema,
  })
  .strict();

export const directConversationSchema = z.object({
  id: identifierSchema,
  communityId: identifierSchema,
  title: z.string().min(1).max(160),
  type: z.literal("direct"),
  participantCount: z.literal(2),
  updatedAt: z.string().datetime(),
});

export type DirectConversationResponse = z.infer<
  typeof directConversationSchema
>;

export const messagePageSchema = z.object({
  items: z.array(messageSchema).max(100),
  nextCursor: identifierSchema.nullable(),
});

export const auditPageSchema = z.object({
  items: z.array(auditEventSchema).max(100),
  nextCursor: identifierSchema.nullable(),
});

export const adminOverviewSchema = z.object({
  users: z.array(adminUserSchema).max(1000),
  communities: z.array(communitySchema).max(100),
  events: z.array(eventSchema).max(1000),
  posts: z.array(postSchema).max(1000),
  groups: z.array(groupSchema).max(1000),
});

export type ApiRoleAssignment = z.infer<typeof roleAssignmentSchema>;
export type ApiUser = z.infer<typeof userSchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;
export type AdminOverview = z.infer<typeof adminOverviewSchema>;
export type AdminEventCreate = z.infer<typeof adminEventCreateSchema>;
export type AdminEventUpdate = z.infer<typeof adminEventUpdateSchema>;
export type AdminGroupCreate = z.infer<typeof adminGroupCreateSchema>;
export type AdminGroupUpdate = z.infer<typeof adminGroupUpdateSchema>;
export type AdminPostCreate = z.infer<typeof adminPostCreateSchema>;
export type AdminPostUpdate = z.infer<typeof adminPostUpdateSchema>;
export type AdminUserCreate = z.infer<typeof adminUserCreateSchema>;
export type AdminUserUpdate = z.infer<typeof adminUserUpdateSchema>;
export type BootstrapResponse = z.infer<typeof bootstrapSchema>;
export type MessageResponse = z.infer<typeof messageSchema>;
export type RoleChangeRequest = z.infer<typeof roleChangeRequestSchema>;
