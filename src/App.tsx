import {
  CalendarDays,
  ChevronDown,
  Hash,
  Home,
  LogOut,
  MessageCircle,
  Moon,
  Plus,
  Radio,
  Send,
  ShieldCheck,
  Smile,
  Sun,
  UsersRound,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { EmojiStyle } from "emoji-picker-react";
import type {
  BootstrapResponse,
  BroadcastResponse,
  ChannelResponse,
  GroupResponse,
  MessageResponse,
  PostResponse,
} from "../server/src/schemas/api.ts";
import { AuthScreen } from "./features/auth/AuthScreen";
import { SocialComposer } from "./features/social/SocialComposer";
import {
  createBroadcast,
  createChannel,
  createDirectConversation,
  createGroup,
  createPost,
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
} from "./services/api";
import { subscribeToConversation } from "./services/live-chat";

const EmojiPicker = lazy(() => import("emoji-picker-react"));
const nativeEmojiStyle = "native" as EmojiStyle;
type Page = "feed" | "groups" | "broadcasts" | "events" | "messages";

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
  conversations,
  viewerId,
}: {
  conversations: BootstrapResponse["conversations"];
  viewerId: string;
}): React.JSX.Element {
  const [activeId, setActiveId] = useState(conversations[0]?.id ?? "");
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [directTarget, setDirectTarget] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    void loadMessages(activeId)
      .then((page) => {
        if (!cancelled) setMessages(page.items);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Messages unavailable");
        }
      });
    const unsubscribe = subscribeToConversation(activeId, (message) => {
      setMessages((current) =>
        current.some((item) => item.id === message.id)
          ? current
          : [...current, { ...message, own: message.authorId === viewerId }],
      );
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
      const created = await createDirectConversation("c1", directTarget.trim());
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
          <input
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
        <div className="live-thread">
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
          <input
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
  const [posts, setPosts] = useState<PostResponse[]>([]);
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastResponse[]>([]);
  const [channels, setChannels] = useState<ChannelResponse[]>([]);
  const [page, setPage] = useState<Page>("feed");
  const [composerOpen, setComposerOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("kommunity-theme") === "dark" ? "dark" : "light"),
  );
  const [activeRole, setActiveRole] = useState("all");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("kommunity-theme", theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    void loadAuthSession()
      .then(() => {
        if (!cancelled) setAuth("authenticated");
      })
      .catch(() => {
        if (!cancelled) setAuth("anonymous");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (auth !== "authenticated") return;
    let cancelled = false;
    void Promise.all([
      loadBootstrap(),
      loadPosts("c1"),
      loadGroups("c1"),
      loadBroadcasts("c1"),
      loadChannels("c1"),
    ])
      .then(([boot, postPage, groupPage, broadcastPage, channelPage]) => {
        if (cancelled) return;
        setBootstrap(boot);
        setPosts(postPage.items);
        setGroups(groupPage.items);
        setBroadcasts(broadcastPage.items);
        setChannels(channelPage.items);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setNotice(caught instanceof Error ? caught.message : "App data unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [auth]);

  const assignments = bootstrap?.user.assignments ?? [];
  const canManage = assignments.some(
    (assignment) =>
      assignment.role === "root" ||
      (assignment.scope === "community" &&
        assignment.scopeId === "c1" &&
        ["super_admin", "admin"].includes(assignment.role)),
  );
  const canSwitch = assignments.some(
    (assignment) => assignment.role === "root" || assignment.role === "maintainer",
  );
  const roleOptions = useMemo(
    () => ["all", ...new Set(assignments.map((assignment) => assignment.role))],
    [assignments],
  );

  if (auth === "checking") {
    return <main className="auth-loading"><Brand /><span>Checking your secure session…</span></main>;
  }
  if (auth === "anonymous") {
    return (
      <AuthScreen
        onLocalLogin={async (input) => {
          await loginWithEmail(input);
          setAuth("authenticated");
        }}
        onLocalRegister={async (input) => {
          await registerWithEmail(input);
          setAuth("authenticated");
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
  ] as const;

  return (
    <div className="live-shell">
      <aside className="live-sidebar">
        <Brand />
        <nav aria-label="Primary navigation">
          {nav.map(([id, label, Icon]) => (
            <button className={page === id ? "active" : ""} key={id} onClick={() => setPage(id)}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>
        <button className="live-create" onClick={() => setComposerOpen(true)}><Plus size={18} /> Create</button>
        <div className="live-profile">
          <span>{bootstrap.user.initials}</span>
          <div><strong>{bootstrap.user.displayName}</strong><small>@{bootstrap.user.handle}</small></div>
        </div>
        <button
          className="live-signout"
          onClick={async () => {
            await logout();
            setBootstrap(null);
            setAuth("anonymous");
          }}
        ><LogOut size={16} /> Sign out</button>
      </aside>

      <main className="live-main">
        <header className="live-header">
          <div><small>KodeKommunity</small><h1>{nav.find(([id]) => id === page)?.[1]}</h1></div>
          <button aria-label="Toggle theme" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </header>
        {notice && <div className="live-notice" role="status">{notice}</div>}

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
                <button onClick={() => setPage("messages")}><MessageCircle size={15} /> Open conversations</button>
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
            conversations={[
              ...bootstrap.conversations,
              ...channels
                .filter((channel) => !bootstrap.conversations.some((item) => item.id === channel.id))
                .map((channel) => ({
                  id: channel.id,
                  communityId: channel.communityId,
                  title: channel.title,
                  type: "community" as const,
                  updatedAt: channel.updatedAt,
                  lastMessage: null,
                })),
            ]}
            viewerId={bootstrap.user.id}
          />
        )}
      </main>

      {canSwitch && (
        <aside className="live-role-dock" aria-label="Role preview">
          <ShieldCheck size={16} />
          <select aria-label="Active role" value={activeRole} onChange={(event) => setActiveRole(event.target.value)}>
            {roleOptions.map((role) => <option key={role} value={role}>{role === "all" ? "All roles" : role}</option>)}
          </select>
          <ChevronDown size={14} />
        </aside>
      )}

      {composerOpen && (
        <SocialComposer
          canManageCommunity={canManage}
          onClose={() => setComposerOpen(false)}
          onCreatePost={async (input) => {
            const created = await createPost("c1", input);
            setPosts((current) => [created, ...current]);
          }}
          onCreateGroup={async (input) => {
            const created = await createGroup("c1", input);
            setGroups((current) => [created, ...current]);
          }}
          onCreateBroadcast={async (input) => {
            const created = await createBroadcast("c1", input);
            setBroadcasts((current) => [created, ...current]);
          }}
          onCreateChannel={async (input) => {
            const created = await createChannel("c1", input);
            setChannels((current) => [created, ...current]);
          }}
        />
      )}
    </div>
  );
}

export default App;
