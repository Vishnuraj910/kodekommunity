import { z } from "zod";

export const identifierSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .describe("Stable Kommunity identifier");

export const identityStatusSchema = z.enum([
  "active",
  "invited",
  "disabled",
  "revoked",
]);

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
  type: z.enum(["community", "direct", "event"]),
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

export const idParamsSchema = z.object({
  id: identifierSchema,
});

export const conversationParamsSchema = z.object({
  conversationId: identifierSchema,
});

export const eventParamsSchema = z.object({
  eventId: identifierSchema,
});

export const communityParamsSchema = z.object({
  communityId: identifierSchema,
});

export const paginationQuerySchema = z.object({
  cursor: identifierSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

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

export const messagePageSchema = z.object({
  items: z.array(messageSchema).max(100),
  nextCursor: identifierSchema.nullable(),
});

export const auditPageSchema = z.object({
  items: z.array(auditEventSchema).max(100),
  nextCursor: identifierSchema.nullable(),
});

export type ApiRoleAssignment = z.infer<typeof roleAssignmentSchema>;
export type ApiUser = z.infer<typeof userSchema>;
export type BootstrapResponse = z.infer<typeof bootstrapSchema>;
export type MessageResponse = z.infer<typeof messageSchema>;
export type RoleChangeRequest = z.infer<typeof roleChangeRequestSchema>;
