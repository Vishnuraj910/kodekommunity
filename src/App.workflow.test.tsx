import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  createBroadcast: vi.fn(),
  createChannel: vi.fn(),
  createDirectConversation: vi.fn(),
  createGroup: vi.fn(),
  createPost: vi.fn(),
  loadAuthSession: vi.fn(),
  loadBootstrap: vi.fn(),
  loadBroadcasts: vi.fn(),
  loadChannels: vi.fn(),
  loadGroups: vi.fn(),
  loadMessages: vi.fn(),
  loadPosts: vi.fn(),
  loginWithEmail: vi.fn(),
  logout: vi.fn(),
  postMessage: vi.fn(),
  registerWithEmail: vi.fn(),
}));
const live = vi.hoisted(() => ({
  callback: undefined as ((message: Record<string, unknown>) => void) | undefined,
  unsubscribe: vi.fn(),
}));

vi.mock("./services/api", () => api);
vi.mock("./services/live-chat", () => ({
  subscribeToConversation: vi.fn(
    (_conversationId: string, callback: (message: Record<string, unknown>) => void) => {
      live.callback = callback;
      return live.unsubscribe;
    },
  ),
}));
vi.mock("emoji-picker-react", () => ({
  default: ({ onEmojiClick }: { onEmojiClick: (emoji: { emoji: string }) => void }) => (
    <button onClick={() => onEmojiClick({ emoji: "😊" })}>Pick smile</button>
  ),
}));

import App from "./App";

const createdAt = "2026-07-30T12:00:00.000Z";
const message = {
  id: "message_1",
  conversationId: "conversation_1",
  authorId: "lee",
  author: "Lee Morgan",
  initials: "LM",
  color: "blue",
  body: "Welcome to the platform",
  createdAt,
  own: false,
};
const bootstrap = {
  user: {
    id: "maya",
    handle: "maya",
    displayName: "Maya Chen",
    initials: "MC",
    status: "active",
    assignments: [
      { role: "user", scope: "platform" },
      { role: "root", scope: "platform" },
    ],
  },
  communities: [
    {
      id: "c1",
      slug: "kodekommunity",
      name: "KodeKommunity",
      description: "A community for thoughtful builders.",
      visibility: "public",
      memberCount: 13,
      joined: true,
    },
  ],
  events: [
    {
      id: "event_1",
      communityId: "c1",
      title: "Reliable systems clinic",
      description: "An applied architecture session.",
      startsAt: createdAt,
      endsAt: "2026-07-30T13:00:00.000Z",
      location: "Online",
      attendeeCount: 8,
      going: true,
    },
  ],
  conversations: [
    {
      id: "conversation_1",
      communityId: "c1",
      title: "General",
      type: "community",
      updatedAt: createdAt,
      lastMessage: { body: "Welcome", createdAt },
    },
  ],
};
const post = {
  id: "post_1",
  communityId: "c1",
  groupId: null,
  body: "Ship small, observable changes.",
  author: {
    id: "maya",
    displayName: "Maya Chen",
    initials: "MC",
    color: "ink",
  },
  own: true,
  createdAt,
  updatedAt: createdAt,
};
const group = {
  id: "group_1",
  communityId: "c1",
  name: "Platform reliability",
  slug: "platform-reliability",
  description: "A focused group for dependable systems.",
  visibility: "private",
  memberCount: 4,
  joined: true,
  createdAt,
  updatedAt: createdAt,
};
const broadcast = {
  id: "broadcast_1",
  communityId: "c1",
  groupId: null,
  title: "Office hours",
  body: "Bring deployment questions.",
  status: "draft",
  startsAt: null,
  endsAt: null,
  createdByUserId: "maya",
  createdAt,
  updatedAt: createdAt,
};
const channel = {
  id: "channel_1",
  communityId: "c1",
  groupId: null,
  title: "Architecture",
  slug: "architecture",
  description: "Architecture decisions.",
  visibility: "public",
  participantCount: 3,
  createdAt,
  updatedAt: createdAt,
};

const primeAuthenticatedApp = () => {
  api.loadAuthSession.mockResolvedValue({ user: bootstrap.user });
  api.loadBootstrap.mockResolvedValue(bootstrap);
  api.loadPosts.mockResolvedValue({ items: [post], nextCursor: null });
  api.loadGroups.mockResolvedValue({ items: [group], nextCursor: null });
  api.loadBroadcasts.mockResolvedValue({ items: [broadcast], nextCursor: null });
  api.loadChannels.mockResolvedValue({
    items: [
      { ...channel, id: "conversation_1" },
      channel,
    ],
    nextCursor: null,
  });
  api.loadMessages.mockResolvedValue({ items: [message], nextCursor: null });
  api.postMessage.mockResolvedValue({
    ...message,
    id: "message_2",
    authorId: "maya",
    author: "Maya Chen",
    initials: "MC",
    body: "A durable message",
    own: true,
  });
  api.createDirectConversation.mockResolvedValue({
    id: "direct_new",
    communityId: "c1",
    title: "Direct message",
    type: "direct",
    updatedAt: createdAt,
    lastMessage: null,
  });
  api.logout.mockResolvedValue(undefined);
  api.createPost.mockResolvedValue({ ...post, id: "post_new", body: "New update" });
  api.createGroup.mockResolvedValue({ ...group, id: "group_new", name: "New group" });
  api.createBroadcast.mockResolvedValue({
    ...broadcast,
    id: "broadcast_new",
    title: "New broadcast",
  });
  api.createChannel.mockResolvedValue({ ...channel, id: "channel_new", title: "New channel" });
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  live.callback = undefined;
  primeAuthenticatedApp();
});

describe("authenticated social application", () => {
  it("loads each server-backed workspace and supports durable chat", async () => {
    const user = userEvent.setup();
    localStorage.setItem("kommunity-theme", "dark");
    render(<App />);

    expect(await screen.findByText("Ship small, observable changes.")).toBeVisible();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("complementary", { name: /role preview/i })).toBeVisible();
    await user.selectOptions(screen.getByLabelText(/active role/i), "root");

    await user.click(screen.getByRole("button", { name: /^groups$/i }));
    expect(screen.getByText("Platform reliability")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /open conversations/i }));
    expect(await screen.findByText("Welcome to the platform")).toBeVisible();
    expect(screen.getByText("Architecture")).toBeVisible();

    await user.type(screen.getByLabelText(/^message$/i), "A durable message");
    await user.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => expect(api.postMessage).toHaveBeenCalledWith(
      "conversation_1",
      "A durable message",
    ));

    live.callback?.({
      ...message,
      id: "message_live",
      body: "Arrived live",
    });
    expect(await screen.findByText("Arrived live")).toBeVisible();
    live.callback?.({ ...message });

    await user.click(screen.getByRole("button", { name: /add emoji/i }));
    await user.click(await screen.findByRole("button", { name: /pick smile/i }));
    expect(screen.getByLabelText(/^message$/i)).toHaveValue("😊");

    await user.type(screen.getByLabelText(/member user id/i), "lee");
    await user.click(screen.getByRole("button", { name: /start direct message/i }));
    await waitFor(() => expect(api.createDirectConversation).toHaveBeenCalledWith("c1", "lee"));

    await user.click(screen.getByRole("button", { name: /broadcasts/i }));
    expect(screen.getByText("Office hours")).toBeVisible();
    expect(screen.getByText(/draft · draft/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: /^events$/i }));
    expect(screen.getByText("Reliable systems clinic")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /toggle theme/i }));
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("creates every supported social resource from the composer", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Ship small, observable changes.");

    await user.click(screen.getByRole("button", { name: /^create$/i }));
    await user.type(screen.getByLabelText(/post body/i), "New update");
    await user.click(screen.getByRole("button", { name: /publish post/i }));
    await waitFor(() => expect(api.createPost).toHaveBeenCalledWith("c1", { body: "New update" }));

    await user.click(screen.getByRole("button", { name: /^create$/i }));
    await user.click(screen.getByRole("tab", { name: /^group$/i }));
    await user.type(screen.getByLabelText(/group name/i), "New group");
    await user.type(screen.getByLabelText(/^description$/i), "Useful collaboration");
    await user.click(screen.getByRole("button", { name: /create group/i }));
    await waitFor(() => expect(api.createGroup).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: /^create$/i }));
    await user.click(screen.getByRole("tab", { name: /^broadcast$/i }));
    await user.type(screen.getByLabelText(/broadcast title/i), "New broadcast");
    await user.type(screen.getByLabelText(/broadcast details/i), "An important update");
    await user.click(screen.getByRole("button", { name: /save broadcast draft/i }));
    await waitFor(() => expect(api.createBroadcast).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: /^create$/i }));
    await user.click(screen.getByRole("tab", { name: /^channel$/i }));
    await user.type(screen.getByLabelText(/channel name/i), "New channel");
    await user.type(screen.getByLabelText(/^description$/i), "A new conversation");
    await user.type(screen.getByLabelText(/participant user ids/i), "lee, sam");
    await user.selectOptions(screen.getByLabelText(/visibility/i), "private");
    await user.click(screen.getByRole("button", { name: /create channel/i }));
    await waitFor(() => expect(api.createChannel).toHaveBeenCalled());
  });

  it("uses local login and registration as a fallback and clears the session", async () => {
    const user = userEvent.setup();
    api.loadAuthSession.mockRejectedValueOnce(new Error("No session"));
    api.loginWithEmail.mockResolvedValue({ user: bootstrap.user });
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /use email and password/i }));
    await user.type(screen.getByLabelText(/email address/i), "MAYA@EXAMPLE.TEST");
    await user.type(screen.getByLabelText(/^password$/i), "a secure password");
    await user.click(screen.getByRole("button", { name: /^log in$/i }));
    expect(await screen.findByText("Ship small, observable changes.")).toBeVisible();
    expect(api.loginWithEmail).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /sign out/i }));
    await waitFor(() => expect(api.logout).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /continue with oidc/i })).toBeVisible();
  });

  it("fails closed when application data cannot be loaded", async () => {
    api.loadBootstrap.mockRejectedValueOnce(new Error("Data service unavailable"));
    render(<App />);
    expect(await screen.findByText("Data service unavailable")).toBeVisible();
    expect(screen.queryByRole("navigation", { name: /primary navigation/i })).not.toBeInTheDocument();
  });

  it("reports message and direct-conversation failures", async () => {
    const user = userEvent.setup();
    api.loadMessages.mockRejectedValueOnce(new Error("History unavailable"));
    api.postMessage.mockRejectedValueOnce(new Error("Send unavailable"));
    api.createDirectConversation.mockRejectedValueOnce("failed");
    render(<App />);
    await screen.findByText("Ship small, observable changes.");
    await user.click(screen.getByRole("button", { name: /^messages$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("History unavailable");

    await user.type(screen.getByLabelText(/^message$/i), "hello");
    await user.click(screen.getByRole("button", { name: /send message/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Send unavailable");

    await user.type(screen.getByLabelText(/member user id/i), "lee");
    await user.click(screen.getByRole("button", { name: /start direct message/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Conversation not created");
  });

  it("does not submit empty chat forms", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Ship small, observable changes.");
    await user.click(screen.getByRole("button", { name: /^messages$/i }));
    fireEvent.submit(screen.getByLabelText(/^message$/i).closest("form")!);
    fireEvent.submit(screen.getByLabelText(/member user id/i).closest("form")!);
    expect(api.postMessage).not.toHaveBeenCalled();
    expect(api.createDirectConversation).not.toHaveBeenCalled();
  });
});
