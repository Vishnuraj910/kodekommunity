import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  createAdminEvent: vi.fn(),
  createAdminGroup: vi.fn(),
  createAdminPost: vi.fn(),
  createAdminUser: vi.fn(),
  createBroadcast: vi.fn(),
  createChannel: vi.fn(),
  createDirectConversation: vi.fn(),
  createGroup: vi.fn(),
  createPost: vi.fn(),
  deleteAdminEvent: vi.fn(),
  deleteAdminGroup: vi.fn(),
  deleteAdminPost: vi.fn(),
  deleteAdminUser: vi.fn(),
  loadAdminOverview: vi.fn(),
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
  updateAdminEvent: vi.fn(),
  updateAdminGroup: vi.fn(),
  updateAdminPost: vi.fn(),
  updateAdminUser: vi.fn(),
  updateProfile: vi.fn(),
  updateRole: vi.fn(),
}));
const live = vi.hoisted(() => ({
  callbacks: new Map<
    string,
    Array<(message: Record<string, unknown>) => void>
  >(),
  unsubscribe: vi.fn(),
}));

vi.mock("./services/api", () => api);
vi.mock("./services/live-chat", () => ({
  subscribeToConversation: vi.fn(
    (conversationId: string, callback: (message: Record<string, unknown>) => void) => {
      const callbacks = live.callbacks.get(conversationId) ?? [];
      callbacks.push(callback);
      live.callbacks.set(conversationId, callbacks);
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
const adminOverview = {
  users: [{ ...bootstrap.user, email: "maya@kommunity.local" }],
  communities: bootstrap.communities,
  events: bootstrap.events,
  posts: [post],
  groups: [group],
};

const primeAuthenticatedApp = () => {
  api.loadAuthSession.mockResolvedValue({
    user: {
      displayName: bootstrap.user.displayName,
      email: "maya@kommunity.local",
      handle: bootstrap.user.handle,
    },
  });
  api.loadAdminOverview.mockResolvedValue(adminOverview);
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
  for (const operation of [
    api.createAdminEvent,
    api.createAdminGroup,
    api.createAdminPost,
    api.createAdminUser,
    api.deleteAdminEvent,
    api.deleteAdminGroup,
    api.deleteAdminPost,
    api.deleteAdminUser,
    api.updateAdminEvent,
    api.updateAdminGroup,
    api.updateAdminPost,
    api.updateAdminUser,
    api.updateRole,
  ]) {
    operation.mockResolvedValue(undefined);
  }
  api.updateProfile.mockResolvedValue({
    user: {
      displayName: "Maya Updated",
      email: "maya@kommunity.local",
      handle: "maya-updated",
    },
  });
};

const openRootFeed = async (_user: ReturnType<typeof userEvent.setup>) => {
  expect(await screen.findByText("Ship small, observable changes.")).toBeVisible();
};

const emitLive = (conversationId: string, liveMessage: typeof message) => {
  for (const callback of live.callbacks.get(conversationId) ?? []) {
    callback(liveMessage);
  }
};

const deferred = <Value,>() => {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  live.callbacks.clear();
  primeAuthenticatedApp();
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "startViewTransition");
});

describe("authenticated social application", () => {
  it("loads each server-backed workspace and supports durable chat", async () => {
    const user = userEvent.setup();
    localStorage.setItem("kommunity-theme", "dark");
    render(<App />);

    await openRootFeed(user);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("complementary", { name: /role preview/i })).toBeVisible();
    const roleSwitcher = screen.getByRole("combobox", { name: /active role/i });
    expect(roleSwitcher).not.toBeInstanceOf(HTMLSelectElement);
    await user.click(roleSwitcher);
    expect(screen.getByRole("listbox")).toHaveAttribute(
      "data-slot",
      "select-content",
    );
    await user.click(screen.getByRole("option", { name: /^root/i }));

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

    emitLive("conversation_1", {
      ...message,
      id: "message_live",
      body: "Arrived live",
    });
    expect(
      await within(
        screen.getByRole("log", { name: "Message history" }),
      ).findByText("Arrived live"),
    ).toBeVisible();
    emitLive("conversation_1", { ...message });

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

  it("uses the device view transition for mobile page changes", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(max-width: 900px)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const startViewTransition = vi.fn((update: () => void) => {
      update();
      return {};
    });
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });
    render(<App />);
    await openRootFeed(user);
    startViewTransition.mockClear();

    await user.click(screen.getByRole("button", { name: /^groups$/i }));

    expect(startViewTransition).toHaveBeenCalledOnce();
    expect(screen.getByText("Platform reliability")).toBeVisible();
  });

  it("toasts incoming messages and stores actionable notifications", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openRootFeed(user);

    emitLive("conversation_1", {
      ...message,
      id: "message_notification",
      body: "Please review the deployment plan.",
    });

    expect(await screen.findByRole("status")).toHaveTextContent(
      "New message from Lee Morgan",
    );
    expect(
      screen.getByRole("button", { name: "Notifications (1 unread)" }),
    ).toBeVisible();

    emitLive("conversation_1", {
      ...message,
      id: "message_notification",
      body: "Please review the deployment plan.",
    });
    expect(
      screen.getByRole("button", { name: "Notifications (1 unread)" }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: /^feed$/i }));
    await user.click(
      screen.getByRole("button", { name: "Notifications (1 unread)" }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Open notification: New message from Lee Morgan",
      }),
    );
    expect(await screen.findByRole("heading", { name: "Messages" })).toBeVisible();
    expect(window.location.pathname).toBe("/messages");

    await user.click(
      screen.getByRole("button", { name: "Notifications (1 unread)" }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Clear notification: New message from Lee Morgan",
      }),
    );
    expect(
      await screen.findByRole("button", { name: "Notifications" }),
    ).toBeVisible();
  });

  it("creates every supported social resource from the composer", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openRootFeed(user);

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
    await user.click(screen.getByRole("combobox", { name: /visibility/i }));
    await user.click(screen.getByRole("option", { name: "Private" }));
    await user.click(screen.getByRole("button", { name: /create channel/i }));
    await waitFor(() => expect(api.createChannel).toHaveBeenCalled());
  });

  it("uses local login and registration as a fallback and clears the session", async () => {
    const user = userEvent.setup();
    api.loadAuthSession.mockRejectedValueOnce(new Error("No session"));
    api.loginWithEmail.mockResolvedValue({ user: bootstrap.user });
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /use email and password/i }));
    expect(window.location.pathname).toBe("/login");
    await user.type(screen.getByLabelText(/email or username/i), "MAYA@EXAMPLE.TEST");
    await user.type(screen.getByLabelText(/^password$/i), "a secure password");
    await user.click(screen.getByRole("button", { name: /^log in$/i }));
    await openRootFeed(user);
    expect(window.location.pathname).toBe("/");
    expect(api.loginWithEmail).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /sign out/i }));
    await waitFor(() => expect(api.logout).toHaveBeenCalled());
    expect(window.location.pathname).toBe("/login");
    expect(screen.getByRole("button", { name: /continue with oidc/i })).toBeVisible();
  });

  it("keeps the themed login surface visible until the workspace is ready", async () => {
    const user = userEvent.setup();
    const workspace = deferred<typeof bootstrap>();
    api.loadAuthSession.mockRejectedValueOnce(new Error("No session"));
    api.loginWithEmail.mockResolvedValue({
      user: {
        displayName: "Maya Chen",
        email: "maya@kommunity.local",
        handle: "maya",
      },
    });
    api.loadBootstrap.mockReturnValueOnce(workspace.promise);
    render(<App />);

    await user.click(
      await screen.findByRole("button", {
        name: /use email and password/i,
      }),
    );
    await user.type(
      screen.getByLabelText(/email or username/i),
      "maya@kommunity.local",
    );
    await user.type(screen.getByLabelText(/^password$/i), "a secure password");
    await user.click(screen.getByRole("button", { name: /^log in$/i }));

    await waitFor(() => expect(api.loadBootstrap).toHaveBeenCalled());
    expect(
      screen.getByRole("heading", { name: /continue to your network/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /opening your network/i }),
    ).toBeDisabled();

    workspace.resolve(bootstrap);
    expect(
      await screen.findByText("Ship small, observable changes."),
    ).toBeVisible();
  });

  it("keeps the secure-session handoff stable while restoring a login", async () => {
    const workspace = deferred<typeof bootstrap>();
    api.loadBootstrap.mockReturnValueOnce(workspace.promise);
    render(<App />);

    await waitFor(() => expect(api.loadBootstrap).toHaveBeenCalled());
    expect(screen.getByText("Checking your secure session…")).toBeVisible();
    expect(
      screen.queryByText("Loading your communities…"),
    ).not.toBeInTheDocument();

    workspace.resolve(bootstrap);
    expect(
      await screen.findByText("Ship small, observable changes."),
    ).toBeVisible();
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
    await openRootFeed(user);
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
    await openRootFeed(user);
    await user.click(screen.getByRole("button", { name: /^messages$/i }));
    fireEvent.submit(screen.getByLabelText(/^message$/i).closest("form")!);
    fireEvent.submit(screen.getByLabelText(/member user id/i).closest("form")!);
    expect(api.postMessage).not.toHaveBeenCalled();
    expect(api.createDirectConversation).not.toHaveBeenCalled();
  });

  it("opens root at home and previews only the roles actually assigned to the user", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText("Ship small, observable changes.")).toBeVisible();
    expect(window.location.pathname).toBe("/");
    await user.click(screen.getByRole("button", { name: /^admin$/i }));
    expect(
      await screen.findByRole("heading", { name: /platform administration/i }),
    ).toBeVisible();
    expect(window.location.pathname).toBe("/admin");
    expect(screen.getByRole("button", { name: /^admin$/i })).toBeVisible();
    const roleSelect = screen.getByLabelText(/active role/i);
    await user.click(roleSelect);
    const roleOptions = screen.getByRole("listbox");
    expect(within(roleOptions).getByRole("option", { name: "Root · platform" })).toBeVisible();
    expect(within(roleOptions).getByRole("option", { name: "User · platform" })).toBeVisible();
    expect(
      within(roleOptions).queryByRole("option", { name: "Maintainer · platform" }),
    ).not.toBeInTheDocument();
    expect(
      within(roleOptions).queryByRole("option", { name: "Admin · KodeKommunity" }),
    ).not.toBeInTheDocument();
  });

  it("keeps a baseline user out of platform administration", async () => {
    api.loadBootstrap.mockResolvedValueOnce({
      ...bootstrap,
      user: {
        ...bootstrap.user,
        id: "aisha",
        assignments: [{ role: "user", scope: "platform" }],
      },
    });
    render(<App />);

    expect(await screen.findByText("Ship small, observable changes.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /^admin$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: /role preview/i })).not.toBeInTheDocument();
  });

  it("reconciles navigation when the active root revokes their own root role", async () => {
    const user = userEvent.setup();
    api.updateRole.mockResolvedValueOnce({
      user: {
        ...bootstrap.user,
        assignments: [{ role: "user", scope: "platform" }],
      },
    });
    render(<App />);

    await screen.findByText("Ship small, observable changes.");
    await user.click(screen.getByRole("button", { name: /^admin$/i }));
    await user.click(
      await screen.findByRole("button", {
        name: /revoke root from maya chen/i,
      }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^admin$/i })).not.toBeInTheDocument(),
    );
    expect(window.location.pathname).toBe("/");
    expect(api.loadAdminOverview).toHaveBeenCalledOnce();
  });

  it("lets a user open and update their account details", async () => {
    const user = userEvent.setup();
    localStorage.setItem("kommunity-theme", "dark");
    render(<App />);
    await openRootFeed(user);

    await user.click(screen.getByRole("button", { name: /^profile$/i }));
    expect(
      await screen.findByRole("heading", { name: /account details/i }),
    ).toBeVisible();
    expect(screen.getByLabelText(/email address/i)).toHaveValue(
      "maya@kommunity.local",
    );
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute("readonly");
    expect(
      within(
        screen.getByRole("region", { name: /account details/i }),
      ).getByRole("button", { name: /^sign out$/i }),
    ).toBeVisible();
    const themeSettings = screen.getByRole("radiogroup", {
      name: /theme preference/i,
    });
    expect(within(themeSettings).getByRole("radio", { name: /system/i })).toBeVisible();
    expect(within(themeSettings).getByRole("radio", { name: /dark/i })).toBeChecked();
    expect(
      within(themeSettings).getByRole("radio", { name: /dark/i }),
    ).not.toBeInstanceOf(HTMLInputElement);
    await user.click(within(themeSettings).getByRole("radio", { name: /light/i }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("kommunity-theme")).toBe("light");

    await user.clear(screen.getByLabelText(/display name/i));
    await user.type(screen.getByLabelText(/display name/i), "Maya Updated");
    await user.clear(screen.getByLabelText(/username/i));
    await user.type(screen.getByLabelText(/username/i), "maya-updated");
    await user.click(screen.getByRole("button", { name: /save profile/i }));

    await waitFor(() =>
      expect(api.updateProfile).toHaveBeenCalledWith({
        displayName: "Maya Updated",
        username: "maya-updated",
      }),
    );
    expect(screen.getByText("@maya-updated")).toBeVisible();
  });
});
