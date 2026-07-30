import {
  accessDirectorySchema,
  authResponseSchema,
  broadcastPageSchema,
  broadcastSchema,
  bootstrapSchema,
  channelPageSchema,
  channelSchema,
  directConversationSchema,
  errorSchema,
  groupPageSchema,
  groupSchema,
  messagePageSchema,
  messageSchema,
  membershipResponseSchema,
  postPageSchema,
  postSchema,
  roleChangeResponseSchema,
  rsvpResponseSchema,
  type ApiRoleAssignment,
} from "../../server/src/schemas/api.ts";

const apiRoot = "/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

const request = async <T>(
  path: string,
  schema: { parse: (value: unknown) => T },
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(`${apiRoot}${path}`, {
    ...init,
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const parsed = errorSchema.safeParse(payload);
    throw new ApiError(
      parsed.success ? parsed.data.error.message : "The server rejected the request",
      response.status,
      parsed.success ? parsed.data.error.code : "UNKNOWN_API_ERROR",
    );
  }
  return schema.parse(payload);
};

const requestWithoutResponse = async (
  path: string,
  init?: RequestInit,
): Promise<void> => {
  const response = await fetch(`${apiRoot}${path}`, {
    ...init,
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const payload: unknown = await response.json();
    const parsed = errorSchema.safeParse(payload);
    throw new ApiError(
      parsed.success ? parsed.data.error.message : "The server rejected the request",
      response.status,
      parsed.success ? parsed.data.error.code : "UNKNOWN_API_ERROR",
    );
  }
};

export const loadBootstrap = () => request("/bootstrap", bootstrapSchema);

export const loadAuthSession = () =>
  request("/auth/session", authResponseSchema);

export const loginWithEmail = (input: {
  email: string;
  password: string;
}) =>
  request("/auth/login", authResponseSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const registerWithEmail = (input: {
  displayName: string;
  email: string;
  handle: string;
  password: string;
}) =>
  request("/auth/register", authResponseSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const logout = () =>
  requestWithoutResponse("/auth/logout", { method: "POST" });

export const loadAccessDirectory = () =>
  request("/access/users", accessDirectorySchema);

export const loadMessages = (conversationId: string) =>
  request(
    `/conversations/${encodeURIComponent(conversationId)}/messages?limit=100`,
    messagePageSchema,
  );

export const updateRsvp = (
  eventId: string,
  status: "going" | "not_going",
) =>
  request(`/events/${encodeURIComponent(eventId)}/rsvp`, rsvpResponseSchema, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });

export const updateCommunityMembership = (
  communityId: string,
  status: "joined" | "left",
) =>
  request(
    `/communities/${encodeURIComponent(communityId)}/membership`,
    membershipResponseSchema,
    {
      method: "PUT",
      body: JSON.stringify({ status }),
    },
  );

export const postMessage = (conversationId: string, body: string) =>
  request(
    `/conversations/${encodeURIComponent(conversationId)}/messages`,
    messageSchema,
    {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ body }),
    },
  );

export const loadGroups = (communityId: string) =>
  request(
    `/communities/${encodeURIComponent(communityId)}/groups?limit=100`,
    groupPageSchema,
  );

export const createGroup = (
  communityId: string,
  input: {
    description: string;
    name: string;
    slug: string;
    visibility: "public" | "private";
  },
) =>
  request(
    `/communities/${encodeURIComponent(communityId)}/groups`,
    groupSchema,
    {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify(input),
    },
  );

export const loadPosts = (communityId: string) =>
  request(
    `/communities/${encodeURIComponent(communityId)}/posts?limit=100`,
    postPageSchema,
  );

export const createPost = (
  communityId: string,
  input: { body: string; groupId?: string },
) =>
  request(
    `/communities/${encodeURIComponent(communityId)}/posts`,
    postSchema,
    {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify(input),
    },
  );

export const loadBroadcasts = (communityId: string) =>
  request(
    `/communities/${encodeURIComponent(communityId)}/broadcasts?limit=100`,
    broadcastPageSchema,
  );

export const createBroadcast = (
  communityId: string,
  input: {
    body: string;
    endsAt?: string;
    groupId?: string;
    startsAt?: string;
    title: string;
  },
) =>
  request(
    `/communities/${encodeURIComponent(communityId)}/broadcasts`,
    broadcastSchema,
    {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify(input),
    },
  );

export const loadChannels = (communityId: string) =>
  request(
    `/communities/${encodeURIComponent(communityId)}/channels?limit=100`,
    channelPageSchema,
  );

export const createChannel = (
  communityId: string,
  input: {
    description: string;
    groupId?: string;
    participantIds: string[];
    slug: string;
    title: string;
    visibility: "public" | "private";
  },
) =>
  request(
    `/communities/${encodeURIComponent(communityId)}/channels`,
    channelSchema,
    {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify(input),
    },
  );

export const createDirectConversation = (
  communityId: string,
  targetUserId: string,
) =>
  request("/conversations/direct", directConversationSchema, {
    method: "POST",
    headers: { "idempotency-key": crypto.randomUUID() },
    body: JSON.stringify({ communityId, targetUserId }),
  });

export const updateRole = (
  targetUserId: string,
  action: "grant" | "revoke",
  assignment: ApiRoleAssignment,
) =>
  request("/access/roles", roleChangeResponseSchema, {
    method: "POST",
    headers: { "idempotency-key": crypto.randomUUID() },
    body: JSON.stringify({ targetUserId, action, assignment }),
  });
