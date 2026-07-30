import {
  accessDirectorySchema,
  bootstrapSchema,
  errorSchema,
  messagePageSchema,
  messageSchema,
  membershipResponseSchema,
  roleChangeResponseSchema,
  rsvpResponseSchema,
  type ApiRoleAssignment,
} from "../server/src/schemas/api.ts";

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
    headers: {
      "content-type": "application/json",
      "x-kommunity-user-id": "maya",
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

export const loadBootstrap = () => request("/bootstrap", bootstrapSchema);

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
