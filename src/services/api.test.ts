import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBroadcast,
  createChannel,
  createDirectConversation,
  createGroup,
  createPost,
  loadAccessDirectory,
  loadAuthSession,
  loadBootstrap,
  loadBroadcasts,
  loadChannels,
  loadGroups,
  loadMessages,
  loadPosts,
  logout,
  postMessage,
  registerWithEmail,
  updateCommunityMembership,
  updateRole,
  updateRsvp,
  loginWithEmail,
} from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("API client", () => {
  it("logs in through a same-origin cookie session and validates the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            displayName: "Maya Chen",
            email: "maya@example.test",
            handle: "maya",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      loginWithEmail({
        email: "maya@example.test",
        password: "A secure passphrase! 2026",
      }),
    ).resolves.toEqual({
      user: {
        displayName: "Maya Chen",
        email: "maya@example.test",
        handle: "maya",
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/login",
      expect.objectContaining({
        credentials: "same-origin",
        method: "POST",
      }),
    );
  });

  it("publishes a post with a fresh idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "post_1",
          communityId: "c1",
          groupId: null,
          body: "A useful update",
          author: {
            id: "maya",
            displayName: "Maya Chen",
            initials: "MC",
            color: "ink",
          },
          own: true,
          createdAt: "2026-07-30T12:00:00.000Z",
          updatedAt: "2026-07-30T12:00:00.000Z",
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000001",
    );

    await createPost("c1", { body: "A useful update" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/communities/c1/posts",
      expect.objectContaining({
        headers: expect.objectContaining({
          "idempotency-key": "00000000-0000-4000-8000-000000000001",
        }),
        method: "POST",
      }),
    );
  });

  it("exposes a consistent typed error across every social operation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "AUTHORIZATION_DENIED",
              message: "This action is not permitted",
              requestId: "request_1",
            },
          }),
          { status: 403, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const operations = [
      loadBootstrap(),
      loadAuthSession(),
      registerWithEmail({
        displayName: "Lee Morgan",
        email: "lee@example.test",
        handle: "lee",
        password: "a secure passphrase",
      }),
      loadAccessDirectory(),
      loadMessages("conversation/one"),
      updateRsvp("event/one", "going"),
      updateCommunityMembership("community/one", "joined"),
      postMessage("conversation/one", "hello"),
      loadGroups("community/one"),
      createGroup("c1", {
        description: "A group",
        name: "Group",
        slug: "group",
        visibility: "public",
      }),
      loadPosts("community/one"),
      loadBroadcasts("community/one"),
      createBroadcast("c1", {
        body: "Details",
        title: "Update",
      }),
      loadChannels("community/one"),
      createChannel("c1", {
        description: "Conversation",
        participantIds: [],
        slug: "general",
        title: "General",
        visibility: "private",
      }),
      createDirectConversation("c1", "lee"),
      updateRole("lee", "grant", { role: "user", scope: "platform" }),
    ];
    const results = await Promise.allSettled(operations);

    expect(results).toHaveLength(17);
    for (const result of results) {
      expect(result.status).toBe("rejected");
      if (result.status === "rejected") {
        expect(result.reason).toEqual(
          expect.objectContaining({
            code: "AUTHORIZATION_DENIED",
            message: "This action is not permitted",
            status: 403,
          }),
        );
      }
    }
  });

  it("falls back to a safe error when the server error body is malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ nope: true }), {
          status: 502,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(logout()).rejects.toEqual(
      expect.objectContaining({
        code: "UNKNOWN_API_ERROR",
        message: "The server rejected the request",
        status: 502,
      }),
    );
  });
});
