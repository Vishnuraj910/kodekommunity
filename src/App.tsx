import {
  CalendarDays,
  Hash,
  Home,
  LogOut,
  MessageCircle,
  Moon,
  Plus,
  Radio,
  Send,
  Settings,
  ShieldCheck,
  Smile,
  Sun,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import type { EmojiStyle } from "emoji-picker-react";
import { Input } from "./components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import type {
  AdminOverview,
  ApiRoleAssignment,
  BootstrapResponse,
  BroadcastResponse,
  ChannelResponse,
  GroupResponse,
  MessageResponse,
  PostResponse,
} from "../server/src/schemas/api.ts";
import { AdminPage } from "./features/admin/AdminPage";
import { AuthScreen } from "./features/auth/AuthScreen";
import { ProfilePage } from "./features/profile/ProfilePage";
import {
  NotificationCenter,
  type AppNotification,
} from "./features/notifications/NotificationCenter";
import { SocialComposer } from "./features/social/SocialComposer";
import {
  createAdminEvent,
  createAdminGroup,
  createAdminPost,
  createAdminUser,
  createBroadcast,
  createChannel,
  createDirectConversation,
  createGroup,
  createPost,
  deleteAdminEvent,
  deleteAdminGroup,
  deleteAdminPost,
  deleteAdminUser,
  loadAdminOverview,
  loadAuthSession,
  loadBootstrap,
  loadBroadcasts,
  loadChannels,
  loadGroups,
  loadMessages,
  loadPosts,
  loginWithEmail,
  logout,
  postMessage,
  registerWithEmail,
  updateAdminEvent,
  updateAdminGroup,
  updateAdminPost,
  updateAdminUser,
  updateProfile,
} from "./services/api";
import { subscribeToConversation } from "./services/live-chat";

const EmojiPicker = lazy(() => import("emoji-picker-react"));
const nativeEmojiStyle = "native" as EmojiStyle;
type Theme = "light" | "dark";
type ThemePreference = Theme | "system";
type TransitionKind = "auth" | "page";

type DocumentWithViewTransitions = Document & {
  startViewTransition?: (update: () => void) => {
    finished?: Promise<unknown>;
  };
};

const getDeviceTheme = (): Theme =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

const getSavedThemePreference = (): ThemePreference => {
  const savedTheme = localStorage.getItem("kommunity-theme");
  return savedTheme === "light" || savedTheme === "dark"
    ? savedTheme
    : "system";
};

const runViewTransition = (
  update: () => void,
  {
    kind,
    mobileOnly = false,
  }: { kind: TransitionKind; mobileOnly?: boolean },
) => {
  const reducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 900px)").matches;
  const transitionDocument = document as DocumentWithViewTransitions;

  if (
    reducedMotion ||
    (mobileOnly && !mobile) ||
    typeof transitionDocument.startViewTransition !== "function"
  ) {
    update();
    return;
  }

  document.documentElement.dataset.transitionKind = kind;
  const transition = transitionDocument.startViewTransition(() => {
    flushSync(update);
  });
  if (transition.finished) {
    void transition.finished.finally(() => {
      if (document.documentElement.dataset.transitionKind === kind) {
        delete document.documentElement.dataset.transitionKind;
      }
    });
  } else {
    delete document.documentElement.dataset.transitionKind;
  }
};

const loadWorkspaceData = async () => {
  const boot = await loadBootstrap();
  const communityId =
    boot.communities.find((community) => community.joined)?.id ??
    boot.communities[0]?.id;
  if (!communityId) {
    throw new Error("No community is available for this account");
  }
  const [postPage, groupPage, broadcastPage, channelPage] = await Promise.all([
    loadPosts(communityId),
    loadGroups(communityId),
    loadBroadcasts(communityId),
    loadChannels(communityId),
  ]);
  const root = boot.user.assignments.some(
    (assignment) => assignment.role === "root",
  );
  const overview = root ? await loadAdminOverview() : null;
  return {
    boot,
    broadcastPage,
    channelPage,
    communityId,
    groupPage,
    overview,
    postPage,
    root,
  };
};

type Page =
  | "feed"
  | "groups"
  | "broadcasts"
  | "events"
  | "messages"
  | "profile"
  | "admin";

const pagePaths: Record<Page, string> = {
  feed: "/",
  groups: "/groups",
  broadcasts: "/broadcasts",
  events: "/events",
  messages: "/messages",
  profile: "/profile",
  admin: "/admin",
};

const pageForPath = (pathname: string): Page | null =>
  (Object.entries(pagePaths).find(([, path]) => path === pathname)?.[0] as
    | Page
    | undefined) ?? null;

const replacePath = (path: string) => {
  window.history.replaceState(null, "", path);
};

type RolePreviewOption = {
  assignment?: ApiRoleAssignment;
  label: string;
  value: string;
};

const initials = (name: string) =>
  name
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const time = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

function Brand(): React.JSX.Element {
  return (
    <span className="live-brand">
      <i aria-hidden="true"><b /><b /><b /></i>
      kommunity
    </span>
  );
}

export function MessageWorkspace({
  communityId,
  conversations,
  selectedConversationId,
  viewerId,
}: {
  communityId: string;
  conversations: BootstrapResponse["conversations"];
  selectedConversationId?: string;
  viewerId: string;
}): React.JSX.Element {
  const [activeId, setActiveId] = useState(conversations[0]?.id ?? "");
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [directTarget, setDirectTarget] = useState("");
  const [error, setError] = useState("");
  const seenMessageIds = useRef(new Set<string>());

  useEffect(() => {
    if (
      selectedConversationId &&
      conversations.some(
        (conversation) => conversation.id === selectedConversationId,
      )
    ) {
      setActiveId(selectedConversationId);
    }
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    void loadMessages(activeId)
      .then((page) => {
        if (!cancelled) {
          for (const message of page.items) {
            seenMessageIds.current.add(message.id);
          }
          setMessages(page.items);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Messages unavailable");
        }
      });
    const unsubscribe = subscribeToConversation(activeId, (message) => {
      if (seenMessageIds.current.has(message.id)) return;
      seenMessageIds.current.add(message.id);
      setMessages((current) => [
        ...current,
        { ...message, own: message.authorId === viewerId },
      ]);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [activeId, viewerId]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!activeId || !body) return;
    try {
      const message = await postMessage(activeId, body);
      setMessages((current) =>
        current.some((item) => item.id === message.id)
          ? current
          : [...current, message],
      );
      setDraft("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Message not sent");
    }
  };

  const startDirect = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!directTarget.trim()) return;
    try {
      const created = await createDirectConversation(communityId, directTarget.trim());
      setActiveId(created.id);
      setDirectTarget("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Conversation not created");
    }
  };

  return (
    <div className="live-messages">
      <aside>
        <h2>Conversations</h2>
        <form onSubmit={startDirect}>
          <Input
            aria-label="Member user ID"
            placeholder="Member ID"
            value={directTarget}
            onChange={(event) => setDirectTarget(event.target.value)}
          />
          <button aria-label="Start direct message"><Plus size={16} /></button>
        </form>
        {conversations.map((conversation) => (
          <button
            className={conversation.id === activeId ? "active" : ""}
            key={conversation.id}
            onClick={() => setActiveId(conversation.id)}
          >
            <span>{conversation.type === "direct" ? <MessageCircle size={17} /> : <Hash size={17} />}</span>
            <span><strong>{conversation.title}</strong><small>{conversation.lastMessage?.body ?? "No messages yet"}</small></span>
          </button>
        ))}
      </aside>
      <section>
        <header>
          <h2>{conversations.find((item) => item.id === activeId)?.title ?? "Conversation"}</h2>
          <small>Live · history reconciles after reconnect</small>
        </header>
        <div
          aria-label="Message history"
          aria-live="polite"
          className="live-thread"
          role="log"
        >
          {messages.map((message) => (
            <article className={message.own ? "own" : ""} key={message.id}>
              <span>{message.initials}</span>
              <div><strong>{message.author}</strong><p>{message.body}</p><small>{time(message.createdAt)}</small></div>
            </article>
          ))}
          {!messages.length && <p className="live-empty">This is the beginning of the conversation.</p>}
        </div>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <form className="live-composer" onSubmit={send}>
          <Input
            aria-label="Message"
            placeholder="Write a thoughtful message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button aria-label="Add emoji" onClick={() => setEmojiOpen(!emojiOpen)} type="button"><Smile size={18} /></button>
          <button aria-label="Send message" disabled={!draft.trim()}><Send size={18} /></button>
          {emojiOpen && (
            <div className="live-emoji" role="dialog" aria-label="Emoji picker">
              <Suspense fallback={<span>Loading emoji…</span>}>
                <EmojiPicker
                  autoFocusSearch={false}
                  emojiStyle={nativeEmojiStyle}
                  height={340}
                  onEmojiClick={(emoji) => {
                    setDraft((current) => `${current}${emoji.emoji}`);
                    setEmojiOpen(false);
                  }}
                  previewConfig={{ showPreview: false }}
                  width="100%"
                />
              </Suspense>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}

function App(): React.JSX.Element {
  const [auth, setAuth] = useState<"checking" | "anonymous" | "authenticated">("checking");
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [authIdentity, setAuthIdentity] = useState<{
    displayName: string;
    email: string;
    handle: string;
  } | null>(null);
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null);
  const [posts, setPosts] = useState<PostResponse[]>([]);
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastResponse[]>([]);
  const [channels, setChannels] = useState<ChannelResponse[]>([]);
  const [page, setPage] = useState<Page>("feed");
  const [composerOpen, setComposerOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [themePreference, setThemePreference] = useState<ThemePreference>(
    getSavedThemePreference,
  );
  const [deviceTheme, setDeviceTheme] = useState<Theme>(getDeviceTheme);
  const theme =
    themePreference === "system" ? deviceTheme : themePreference;
  const [activeRole, setActiveRole] = useState("all");
  const [activeCommunityId, setActiveCommunityId] = useState("");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | undefined
  >();

  const publishNotification = useCallback((notification: AppNotification) => {
    setNotifications((current) =>
      current.some((item) => item.id === notification.id)
        ? current
        : [notification, ...current],
    );
    setToasts((current) =>
      current.some((item) => item.id === notification.id)
        ? current
        : [notification, ...current],
    );
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateDeviceTheme = (event: MediaQueryListEvent) => {
      setDeviceTheme(event.matches ? "dark" : "light");
    };
    setDeviceTheme(mediaQuery.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", updateDeviceTheme);
    return () => mediaQuery.removeEventListener("change", updateDeviceTheme);
  }, []);

  const selectTheme = (preference: ThemePreference) => {
    setThemePreference(preference);
    if (preference === "system") {
      localStorage.removeItem("kommunity-theme");
    } else {
      localStorage.setItem("kommunity-theme", preference);
    }
  };

  const applyWorkspaceData = (
    workspace: Awaited<ReturnType<typeof loadWorkspaceData>>,
  ) => {
    const {
      boot,
      broadcastPage,
      channelPage,
      communityId,
      groupPage,
      overview,
      postPage,
      root,
    } = workspace;
    setBootstrap(boot);
    setActiveCommunityId(communityId);
    setAdminOverview(overview);
    setPosts(postPage.items);
    setGroups(groupPage.items);
    setBroadcasts(broadcastPage.items);
    setChannels(channelPage.items);
    const requestedPage = pageForPath(window.location.pathname);
    const nextPage =
      requestedPage === "admin" && !root ? "feed" : requestedPage ?? "feed";
    setPage(nextPage);
    if (window.location.pathname !== pagePaths[nextPage]) {
      replacePath(pagePaths[nextPage]);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void loadAuthSession()
      .then((result) => {
        if (cancelled) return;
        setAuthIdentity(result.user);
        return loadWorkspaceData()
          .then((workspace) => {
            if (cancelled) return;
            applyWorkspaceData(workspace);
            runViewTransition(() => setAuth("authenticated"), {
              kind: "auth",
            });
          })
          .catch((caught: unknown) => {
            if (cancelled) return;
            setNotice(
              caught instanceof Error ? caught.message : "App data unavailable",
            );
            setAuth("authenticated");
          });
      })
      .catch(() => {
        if (!cancelled) {
          const verificationCompleted =
            window.location.pathname === "/login" &&
            new URLSearchParams(window.location.search).get("verified") === "1";
          if (!verificationCompleted) replacePath("/login");
          setAuth("anonymous");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const assignments = bootstrap?.user.assignments ?? [];
  const conversationDirectory = useMemo<
    BootstrapResponse["conversations"]
  >(() => {
    if (!bootstrap) return [];
    return [
      ...bootstrap.conversations,
      ...channels
        .filter(
          (channel) =>
            !bootstrap.conversations.some((item) => item.id === channel.id),
        )
        .map((channel) => ({
          id: channel.id,
          communityId: channel.communityId,
          title: channel.title,
          type: "community" as const,
          updatedAt: channel.updatedAt,
          lastMessage: null,
        })),
    ];
  }, [bootstrap, channels]);
  const isRoot = assignments.some((assignment) => assignment.role === "root");
  const canSwitch = assignments.some(
    (assignment) => assignment.role === "root" || assignment.role === "maintainer",
  );
  const roleOptions = useMemo<RolePreviewOption[]>(() => {
    if (!bootstrap || !canSwitch) return [];
    return [
      { value: "all", label: "All roles" },
      {
        value: "root",
        label: "Root · platform",
        assignment: { role: "root", scope: "platform" },
      },
      {
        value: "maintainer",
        label: "Maintainer · platform",
        assignment: { role: "maintainer", scope: "platform" },
      },
      ...bootstrap.communities.flatMap((community) => [
        {
          value: `super_admin:${community.id}`,
          label: `Super admin · ${community.name}`,
          assignment: {
            role: "super_admin",
            scope: "community",
            scopeId: community.id,
          } as ApiRoleAssignment,
        },
        {
          value: `admin:${community.id}`,
          label: `Admin · ${community.name}`,
          assignment: {
            role: "admin",
            scope: "community",
            scopeId: community.id,
          } as ApiRoleAssignment,
        },
      ]),
      ...bootstrap.events.map((event) => ({
        value: `presenter:${event.id}`,
        label: `Presenter · ${event.title}`,
        assignment: {
          role: "presenter",
          scope: "event",
          scopeId: event.id,
        } as ApiRoleAssignment,
      })),
      {
        value: "user",
        label: "User · platform",
        assignment: { role: "user", scope: "platform" },
      },
    ];
  }, [bootstrap, canSwitch]);
  const previewAssignment = roleOptions.find(
    (option) => option.value === activeRole,
  )?.assignment;
  const effectiveAssignments =
    activeRole === "all" || !previewAssignment
      ? assignments
      : previewAssignment.role === "user"
        ? [previewAssignment]
        : [
            { role: "user", scope: "platform" } as ApiRoleAssignment,
            previewAssignment,
          ];
  const canManage = effectiveAssignments.some(
    (assignment) =>
      assignment.role === "root" ||
      (assignment.scope === "community" &&
      assignment.scopeId === activeCommunityId &&
        ["super_admin", "admin"].includes(assignment.role)),
  );

  useEffect(() => {
    if (!bootstrap) return;

    const unsubscribers = conversationDirectory.map((conversation) =>
      subscribeToConversation(conversation.id, (message) => {
        if (message.authorId === bootstrap.user.id) return;
        publishNotification({
          id: `message:${message.id}`,
          title: `New message from ${message.author}`,
          description: message.body,
          createdAt: message.createdAt,
          destination: {
            page: "messages",
            conversationId: conversation.id,
          },
        });
      }),
    );

    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }, [bootstrap, conversationDirectory, publishNotification]);

  useEffect(() => {
    if (auth !== "authenticated" || !bootstrap) return;

    const handlePopState = () => {
      const requestedPage = pageForPath(window.location.pathname);
      const nextPage =
        requestedPage === "admin" && !isRoot ? "feed" : requestedPage ?? "feed";
      setPage(nextPage);
      if (window.location.pathname !== pagePaths[nextPage]) {
        replacePath(pagePaths[nextPage]);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [auth, bootstrap, isRoot]);

  if (auth === "checking") {
    return <main className="auth-loading"><Brand /><span>Checking your secure session…</span></main>;
  }
  if (auth === "anonymous") {
    return (
      <AuthScreen
        onLocalLogin={async (input) => {
          const result = await loginWithEmail(input);
          const workspace = await loadWorkspaceData();
          setAuthIdentity(result.user);
          applyWorkspaceData(workspace);
          runViewTransition(() => setAuth("authenticated"), { kind: "auth" });
        }}
        onLocalRegister={async (input) => {
          const result = await registerWithEmail(input);
          if (result.status === "verification_required") return result;
          const workspace = await loadWorkspaceData();
          setAuthIdentity(result.user);
          applyWorkspaceData(workspace);
          runViewTransition(() => setAuth("authenticated"), { kind: "auth" });
          return { status: "authenticated" };
        }}
        onOidc={() => window.location.assign("/api/v1/auth/oidc/start")}
      />
    );
  }
  if (!bootstrap) {
    return <main className="auth-loading"><Brand /><span>{notice || "Loading your communities…"}</span></main>;
  }

  const nav = [
    ["feed", "Feed", Home],
    ["groups", "Groups", UsersRound],
    ["broadcasts", "Broadcasts", Radio],
    ["events", "Events", CalendarDays],
    ["messages", "Messages", MessageCircle],
    ["profile", "Profile", UserRound],
    ...(isRoot ? [["admin", "Admin", Settings] as const] : []),
  ] as const;

  const refreshAdmin = async () => {
    setAdminOverview(await loadAdminOverview());
  };

  const navigateToPage = (nextPage: Page) => {
    runViewTransition(
      () => {
        setPage(nextPage);
        if (window.location.pathname !== pagePaths[nextPage]) {
          window.history.pushState(null, "", pagePaths[nextPage]);
        }
      },
      { kind: "page", mobileOnly: true },
    );
  };

  const openNotification = (notification: AppNotification) => {
    setToasts((current) =>
      current.filter((item) => item.id !== notification.id),
    );
    setSelectedConversationId(notification.destination.conversationId);
    navigateToPage(notification.destination.page);
  };

  const signOut = async () => {
    await logout();
    setBootstrap(null);
    setAuthIdentity(null);
    setAdminOverview(null);
    setActiveRole("all");
    setNotifications([]);
    setToasts([]);
    setSelectedConversationId(undefined);
    setPage("feed");
    replacePath("/login");
    setAuth("anonymous");
  };

  return (
    <div className="live-shell">
      <aside className="live-sidebar">
        <Brand />
        <nav aria-label="Primary navigation">
          {nav.map(([id, label, Icon]) => (
            <button
              aria-current={page === id ? "page" : undefined}
              aria-label={label}
              className={page === id ? "active" : ""}
              key={id}
              onClick={() => navigateToPage(id)}
              title={label}
            >
              <Icon size={20} /> <span>{label}</span>
            </button>
          ))}
        </nav>
        <button
          aria-label="Create"
          className="live-create"
          onClick={() => setComposerOpen(true)}
        >
          <Plus size={19} /> <span>Create</span>
        </button>
        <button
          aria-label="Open profile"
          className="live-profile"
          onClick={() => navigateToPage("profile")}
        >
          <span>{bootstrap.user.initials}</span>
          <div><strong>{bootstrap.user.displayName}</strong><small>@{bootstrap.user.handle}</small></div>
        </button>
        <button
          className="live-signout"
          onClick={signOut}
        ><LogOut size={16} /> Sign out</button>
      </aside>

      <main className="live-main">
        <header className="live-header">
          <div><small>KodeKommunity</small><h1>{nav.find(([id]) => id === page)?.[1]}</h1></div>
          <div className="live-header-actions">
            <NotificationCenter
              notifications={notifications}
              toasts={toasts}
              onClear={(notificationId) => {
                setNotifications((current) =>
                  current.filter((item) => item.id !== notificationId),
                );
                setToasts((current) =>
                  current.filter((item) => item.id !== notificationId),
                );
              }}
              onClearAll={() => {
                setNotifications([]);
                setToasts([]);
              }}
              onDismissToast={(notificationId) =>
                setToasts((current) =>
                  current.filter((item) => item.id !== notificationId),
                )
              }
              onOpen={openNotification}
            />
            <button
              aria-label="Toggle theme"
              className="desktop-theme-toggle"
              onClick={() => selectTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
        </header>
        {notice && <div className="live-notice" role="status">{notice}</div>}

        <div className="page-view" key={page}>
        {page === "feed" && (
          <section className="live-grid">
            {posts.map((post) => (
              <article className="live-card live-post" key={post.id}>
                <header><span>{post.author.initials}</span><div><strong>{post.author.displayName}</strong><small>{time(post.createdAt)}</small></div></header>
                <p>{post.body}</p>
              </article>
            ))}
          </section>
        )}
        {page === "groups" && (
          <section className="live-grid">
            {groups.map((group) => (
              <article className="live-card" key={group.id}>
                <small>{group.visibility} · {group.memberCount} members</small>
                <h2>{group.name}</h2><p>{group.description}</p>
                <button onClick={() => navigateToPage("messages")}><MessageCircle size={15} /> Open conversations</button>
              </article>
            ))}
          </section>
        )}
        {page === "broadcasts" && (
          <section className="live-grid">
            {broadcasts.map((broadcast) => (
              <article className="live-card" key={broadcast.id}>
                <small>{broadcast.status} · {broadcast.startsAt ? time(broadcast.startsAt) : "Draft"}</small>
                <h2>{broadcast.title}</h2><p>{broadcast.body}</p>
              </article>
            ))}
          </section>
        )}
        {page === "events" && (
          <section className="live-grid">
            {bootstrap.events.map((event) => (
              <article className="live-card" key={event.id}>
                <small>{time(event.startsAt)} · {event.attendeeCount} going</small>
                <h2>{event.title}</h2><p>{event.description}</p><strong>{event.location}</strong>
              </article>
            ))}
          </section>
        )}
        {page === "messages" && (
          <MessageWorkspace
            communityId={activeCommunityId}
            conversations={conversationDirectory}
            selectedConversationId={selectedConversationId}
            viewerId={bootstrap.user.id}
          />
        )}
        {page === "profile" && authIdentity && (
          <ProfilePage
            assignments={bootstrap.user.assignments}
            identity={{
              displayName: bootstrap.user.displayName,
              email: authIdentity.email,
              username: bootstrap.user.handle,
            }}
            onThemeChange={selectTheme}
            onSave={async (input) => {
              const result = await updateProfile(input);
              setAuthIdentity(result.user);
              setBootstrap((current) =>
                current
                  ? {
                      ...current,
                      user: {
                        ...current.user,
                        displayName: result.user.displayName,
                        handle: result.user.handle,
                        initials: initials(result.user.displayName),
                      },
                    }
                  : current,
              );
            }}
            onSignOut={signOut}
            theme={theme}
            themePreference={themePreference}
          />
        )}
        {page === "admin" && adminOverview && (
          <AdminPage
            overview={adminOverview}
            createUser={async (input) => {
              await createAdminUser(input);
              await refreshAdmin();
            }}
            updateUser={async (userId, input) => {
              await updateAdminUser(userId, input);
              await refreshAdmin();
            }}
            deleteUser={async (userId) => {
              await deleteAdminUser(userId);
              await refreshAdmin();
            }}
            createEvent={async (input) => {
              await createAdminEvent(input);
              await refreshAdmin();
            }}
            updateEvent={async (eventId, input) => {
              await updateAdminEvent(eventId, input);
              await refreshAdmin();
            }}
            deleteEvent={async (eventId) => {
              await deleteAdminEvent(eventId);
              await refreshAdmin();
            }}
            createPost={async (input) => {
              await createAdminPost(input);
              await refreshAdmin();
            }}
            updatePost={async (postId, input) => {
              await updateAdminPost(postId, input);
              await refreshAdmin();
            }}
            deletePost={async (postId) => {
              await deleteAdminPost(postId);
              await refreshAdmin();
            }}
            createGroup={async (input) => {
              await createAdminGroup(input);
              await refreshAdmin();
            }}
            updateGroup={async (groupId, input) => {
              await updateAdminGroup(groupId, input);
              await refreshAdmin();
            }}
            deleteGroup={async (groupId) => {
              await deleteAdminGroup(groupId);
              await refreshAdmin();
            }}
          />
        )}
        </div>
      </main>

      {canSwitch && (
        <aside className="live-role-dock" aria-label="Role preview">
          <ShieldCheck size={16} />
          <Select value={activeRole} onValueChange={setActiveRole}>
            <SelectTrigger aria-label="Active role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </aside>
      )}

      {composerOpen && (
        <SocialComposer
          canManageCommunity={canManage}
          onClose={() => setComposerOpen(false)}
          onCreatePost={async (input) => {
            const created = await createPost(activeCommunityId, input);
            setPosts((current) => [created, ...current]);
          }}
          onCreateGroup={async (input) => {
            const created = await createGroup(activeCommunityId, input);
            setGroups((current) => [created, ...current]);
          }}
          onCreateBroadcast={async (input) => {
            const created = await createBroadcast(activeCommunityId, input);
            setBroadcasts((current) => [created, ...current]);
          }}
          onCreateChannel={async (input) => {
            const created = await createChannel(activeCommunityId, input);
            setChannels((current) => [created, ...current]);
          }}
        />
      )}
    </div>
  );
}

export default App;
