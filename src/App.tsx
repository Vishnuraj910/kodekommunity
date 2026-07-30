import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bookmark,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Compass,
  Copy,
  Crown,
  Globe2,
  Heart,
  Home,
  Lock,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  MessageSquare,
  Mic2,
  Moon,
  MoreHorizontal,
  Paperclip,
  Plus,
  QrCode,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Sun,
  UserPlus,
  UserRound,
  UsersRound,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import type {
  EmojiClickData,
  EmojiStyle,
  Theme as EmojiTheme,
} from "emoji-picker-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  communities,
  conversations,
  events as seedEvents,
  initialMessages,
  isMessageArray,
  people,
  type EventItem,
  type Person,
} from "./data";
import {
  assignmentScope,
  can,
  hasRole,
  isIdentityStatusDirectory,
  isRoleDirectory,
  roleAssignmentKey,
  roleDefinitions,
  roleNames,
  type AuthorizationContext,
  type AuthorizationSubject,
  type IdentityStatusDirectory,
  type Permission,
  type RoleAssignment,
  type RoleDirectory,
  type RoleName,
} from "./roles";
import {
  clearKommunityBrowserData,
  isBoolean,
  isString,
  isStringArray,
  readStoredState,
  type StateValidator,
  writeStoredState,
} from "./storage";
import {
  ApiError,
  loadAccessDirectory,
  loadBootstrap,
  loadMessages,
  postMessage,
  updateRole,
  updateRsvp,
  updateCommunityMembership,
} from "./services/api";

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1_000;
const ONE_DAY_MS = 24 * 60 * 60 * 1_000;

type Page =
  | "home"
  | "discover"
  | "groups"
  | "events"
  | "messages"
  | "connections"
  | "access"
  | "notifications"
  | "profile"
  | "settings";

type NavItem = {
  id: Page;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

type ToastState = { id: number; message: string } | null;

const EmojiPicker = lazy(() => import("emoji-picker-react"));

const navItems: NavItem[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "discover", label: "Discover", icon: Compass },
  { id: "groups", label: "Groups", icon: UsersRound },
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "messages", label: "Messages", icon: MessageCircle, badge: 4 },
  { id: "connections", label: "Connections", icon: UserPlus },
  { id: "access", label: "Access control", icon: ShieldCheck },
];

const pageTitles: Record<Page, string> = {
  home: "Home",
  discover: "Discover",
  groups: "Groups",
  events: "Events",
  messages: "Messages",
  connections: "Connections",
  access: "Access control",
  notifications: "Notifications",
  profile: "Your profile",
  settings: "Settings",
};

const isTheme = (value: unknown): value is "light" | "dark" =>
  value === "light" || value === "dark";

function useBrowserState<T>(
  key: string,
  initial: T,
  validate: StateValidator<T>,
  storageKind: "local" | "session" = "local",
  ttlMs?: number,
) {
  const storage = useMemo(() => {
    try {
      return storageKind === "local"
        ? window.localStorage
        : window.sessionStorage;
    } catch {
      return null;
    }
  }, [storageKind]);
  const shouldPersist = useRef(false);
  const [value, setValue] = useState<T>(() => {
    return storage
      ? readStoredState(storage, key, initial, validate)
      : initial;
  });

  useEffect(() => {
    if (!storage || !shouldPersist.current) return;
    shouldPersist.current = false;
    writeStoredState(storage, key, value, ttlMs);
  }, [key, storage, ttlMs, value]);

  const setStoredValue = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    shouldPersist.current = true;
    setValue(next);
  }, []);

  return [value, setStoredValue] as const;
}

const canPreview = (
  subject: AuthorizationSubject,
  permission: Permission,
  context: AuthorizationContext = {},
): boolean => can(subject, permission, context);

function useModalKeyboard(
  dialogRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusableSelector =
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      );

    window.requestAnimationFrame(() => {
      const initialFocus =
        dialog?.querySelector<HTMLElement>("[autofocus]") ?? focusable()[0];
      initialFocus?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const controls = focusable();
      if (!controls.length) return;
      const first = controls[0];
      const last = controls.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [dialogRef, onClose]);
}

function Avatar({
  initials,
  color = "ink",
  size = "md",
  status,
}: {
  initials: string;
  color?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  status?: boolean;
}): React.JSX.Element {
  return (
    <span className={`avatar avatar-${size} avatar-${color}`}>
      {initials}
      {status && <span className="avatar-status" aria-label="Online" />}
    </span>
  );
}

function Logo({ compact = false }: { compact?: boolean }): React.JSX.Element {
  return (
    <div className="brand" aria-label="Kommunity">
      <span className="brand-mark">
        <span />
        <span />
        <span />
      </span>
      {!compact && <span className="brand-word">kommunity</span>}
    </div>
  );
}

function Button({
  children,
  variant = "primary",
  size = "md",
  icon: Icon,
  onClick,
  className = "",
  disabled = false,
  type = "button",
}: {
  children?: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "soft" | "danger";
  size?: "sm" | "md" | "icon";
  icon?: LucideIcon;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}): React.JSX.Element {
  return (
    <button
      type={type}
      className={`button button-${variant} button-${size} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {Icon && <Icon size={size === "sm" ? 15 : 17} />}
      {children}
    </button>
  );
}

function IconButton({
  label,
  icon: Icon,
  onClick,
  className = "",
}: {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  className?: string;
}): React.JSX.Element {
  return (
    <button
      className={`icon-button ${className}`}
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Icon size={18} />
    </button>
  );
}

function Sidebar({
  page,
  onNavigate,
  onCreate,
  subject,
  activeRole,
}: {
  page: Page;
  onNavigate: (page: Page) => void;
  onCreate: () => void;
  subject: AuthorizationSubject;
  activeRole: RoleName | "all";
}): React.JSX.Element {
  const visibleNavItems = navItems.filter(
    (item) =>
      item.id !== "access" ||
      canPreview(subject, "platform:manage") ||
      canPreview(subject, "platform:maintain"),
  );
  const primaryRole =
    roleNames.find((role) => hasRole(subject.assignments, role)) ?? "user";

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <Logo />
        <button className="search-shortcut" onClick={() => onNavigate("discover")}>
          <Search size={16} />
          <span>Search</span>
          <kbd>⌘ K</kbd>
        </button>
        <nav className="primary-nav" aria-label="Primary navigation">
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "active" : ""}
              onClick={() => onNavigate(item.id)}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.badge ? <b>{item.badge}</b> : null}
            </button>
          ))}
        </nav>

        <div className="spaces">
          <div className="section-label">
            <span>Your spaces</span>
            <Plus size={14} />
          </div>
          {communities
            .filter((community) => community.joined)
            .slice(0, 3)
            .map((community) => (
              <button key={community.id} onClick={() => onNavigate("home")}>
                <span className={`space-glyph avatar-${community.color}`}>
                  {community.glyph}
                </span>
                <span>{community.name}</span>
              </button>
            ))}
        </div>
      </div>

      <div className="sidebar-bottom">
        <Button icon={Plus} onClick={onCreate} className="create-button">
          Create
        </Button>
        <button className="profile-switcher" onClick={() => onNavigate("profile")}>
          <Avatar initials="MC" size="sm" color="ink" status />
          <span>
            <strong>Maya Chen</strong>
            <small>
              {activeRole === "all"
                ? `${roleDefinitions[primaryRole].label} · all roles`
                : `${roleDefinitions[activeRole].label} view`}
            </small>
          </span>
          <ChevronDown size={16} />
        </button>
      </div>
    </aside>
  );
}

function MobileHeader({
  page,
  onNavigate,
}: {
  page: Page;
  onNavigate: (page: Page) => void;
}): React.JSX.Element {
  return (
    <header className="mobile-header">
      <Logo compact />
      <strong>{pageTitles[page]}</strong>
      <IconButton
        label="Notifications"
        icon={Bell}
        onClick={() => onNavigate("notifications")}
      />
    </header>
  );
}

function BottomNav({
  page,
  onNavigate,
  onCreate,
}: {
  page: Page;
  onNavigate: (page: Page) => void;
  onCreate: () => void;
}): React.JSX.Element {
  const items = navItems.filter((item) =>
    ["home", "discover", "events", "messages"].includes(item.id),
  );
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {items.map((item) => (
        <button
          key={item.id}
          className={page === item.id ? "active" : ""}
          onClick={() => onNavigate(item.id)}
        >
          <item.icon size={20} />
          <span>{item.label}</span>
          {item.badge ? <i>{item.badge}</i> : null}
        </button>
      ))}
      <button onClick={onCreate}>
        <span className="mobile-create">
          <Plus size={21} />
        </span>
        <span>Create</span>
      </button>
    </nav>
  );
}

function AppHeader({
  title,
  eyebrow,
  onNotify,
  actions,
}: {
  title: string;
  eyebrow?: string;
  onNotify?: () => void;
  actions?: React.ReactNode;
}): React.JSX.Element {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
      </div>
      <div className="page-actions">
        {actions}
        {onNotify && (
          <button
            aria-label="Open notifications"
            className="notification-button"
            onClick={onNotify}
          >
            <Bell size={19} />
            <span />
          </button>
        )}
      </div>
    </header>
  );
}

function EventMiniCard({
  event,
  onOpen,
}: {
  event: EventItem;
  onOpen?: () => void;
}): React.JSX.Element {
  return (
    <button className="event-mini-card" onClick={onOpen}>
      <span className={`date-tile date-${event.color}`}>
        <small>{event.month}</small>
        <strong>{event.date}</strong>
      </span>
      <span className="event-mini-content">
        <small>{event.community}</small>
        <strong>{event.title}</strong>
        <span>
          {event.day} · {event.time.split(" – ")[0]}
        </span>
      </span>
      <ArrowRight size={17} />
    </button>
  );
}

function PersonRow({
  person,
  connected,
  onConnect,
}: {
  person: Person;
  connected?: boolean;
  onConnect: () => void;
}): React.JSX.Element {
  return (
    <div className="person-row">
      <Avatar initials={person.initials} color={person.color} size="sm" />
      <span>
        <strong>{person.name}</strong>
        <small>{person.mutual} mutual connections</small>
      </span>
      <button
        className={connected ? "connected" : ""}
        onClick={onConnect}
        aria-label={connected ? `Request sent to ${person.name}` : `Connect with ${person.name}`}
      >
        {connected ? <Check size={16} /> : <UserPlus size={16} />}
      </button>
    </div>
  );
}

function RightRail({
  onNavigate,
  connectedIds,
  onConnect,
}: {
  onNavigate: (page: Page) => void;
  connectedIds: string[];
  onConnect: (person: Person) => void;
}): React.JSX.Element {
  return (
    <aside className="right-rail">
      <div className="rail-heading">
        <h3>Coming up</h3>
        <button onClick={() => onNavigate("events")}>View all</button>
      </div>
      <EventMiniCard event={seedEvents[0]} onOpen={() => onNavigate("events")} />

      <div className="rail-heading rail-spacing">
        <h3>People to meet</h3>
        <button onClick={() => onNavigate("connections")}>See all</button>
      </div>
      <div className="people-panel">
        {people.slice(0, 3).map((person) => (
          <PersonRow
            key={person.id}
            person={person}
            connected={connectedIds.includes(person.id)}
            onConnect={() => onConnect(person)}
          />
        ))}
      </div>

      <div className="privacy-note">
        <ShieldCheck size={19} />
        <span>
          <strong>Your privacy comes first</strong>
          <small>Your contact details are never shown to other members.</small>
        </span>
      </div>
      <footer className="rail-footer">About · Guidelines · Privacy · © 2026</footer>
    </aside>
  );
}

function HomePage({
  onNavigate,
  onCreate,
  onNotify,
  savedPosts,
  onToggleSave,
}: {
  onNavigate: (page: Page) => void;
  onCreate: () => void;
  onNotify: () => void;
  savedPosts: string[];
  onToggleSave: (id: string) => void;
}): React.JSX.Element {
  const [liked, setLiked] = useState<string[]>([]);

  const toggleLike = (id: string) => {
    setLiked((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  return (
    <div className="main-column">
      <AppHeader
        eyebrow="Wednesday, July 29"
        title="Good evening, Maya"
        onNotify={onNotify}
      />

      <section className="welcome-card">
        <div>
          <span className="welcome-label">
            <Sparkles size={14} /> Welcome back
          </span>
          <h2>There’s good energy in your spaces today.</h2>
          <p>Catch up on a lively discussion or find something new.</p>
        </div>
        <div className="welcome-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>

      <section className="composer-card" onClick={onCreate}>
        <Avatar initials="MC" size="sm" color="ink" />
        <button>Share something with your community…</button>
        <span className="composer-chip">
          <Plus size={16} /> New post
        </span>
      </section>

      <div className="feed-heading">
        <h2>From your spaces</h2>
        <button>
          Latest <ChevronDown size={15} />
        </button>
      </div>

      <article className="post-card">
        <header className="post-meta">
          <Avatar initials="PN" color="plum" size="sm" />
          <div>
            <strong>Priya Nair</strong>
            <span>
              in <b>KodeKommunity</b> · 42m
            </span>
          </div>
          <IconButton label="More options" icon={MoreHorizontal} />
        </header>
        <div className="post-body">
          <p>
            What’s one small thing you learned this week that changed how you
            approach your work? Mine: writing the empty state first makes the
            whole product story clearer.
          </p>
          <div className="topic-chip">💬 Open question</div>
        </div>
        <footer className="post-actions">
          <button
            aria-label={`${liked.includes("post-1") ? "Unlike" : "Like"} Priya Nair's post`}
            className={liked.includes("post-1") ? "active" : ""}
            onClick={() => toggleLike("post-1")}
          >
            <Heart
              size={18}
              fill={liked.includes("post-1") ? "currentColor" : "none"}
            />
            {liked.includes("post-1") ? 25 : 24}
          </button>
          <button aria-label="View 8 comments on Priya Nair's post">
            <MessageSquare size={18} /> 8
          </button>
          <button
            aria-label={`${savedPosts.includes("post-1") ? "Remove Priya Nair's post from saved items" : "Save Priya Nair's post"}`}
            className={`save-action ${
              savedPosts.includes("post-1") ? "active" : ""
            }`}
            onClick={() => onToggleSave("post-1")}
          >
            <Bookmark
              size={18}
              fill={savedPosts.includes("post-1") ? "currentColor" : "none"}
            />
          </button>
        </footer>
      </article>

      <article className="post-card event-feed-card">
        <header className="post-meta">
          <span className="space-glyph avatar-violet">◒</span>
          <div>
            <strong>Design Circle</strong>
            <span>Event · Yesterday</span>
          </div>
          <IconButton label="More options" icon={MoreHorizontal} />
        </header>
        <div className="event-poster poster-violet">
          <span>DESIGNING</span>
          <strong>FOR<br />TRUST</strong>
          <i>06 — 08 — 26</i>
          <div className="poster-shape shape-one" />
          <div className="poster-shape shape-two" />
        </div>
        <div className="event-feed-info">
          <span className="event-kicker">IN-PERSON TALK</span>
          <h3>Designing for trust</h3>
          <p>
            A candid conversation about creating products people can understand,
            trust, and leave.
          </p>
          <div className="event-details-line">
            <span>
              <CalendarDays size={15} /> Thu, Aug 6 · 6:30 PM
            </span>
            <span>
              <MapPin size={15} /> Foundry Hall
            </span>
          </div>
          <Button size="sm" variant="secondary" onClick={() => onNavigate("events")}>
            View event
          </Button>
        </div>
      </article>

      <article className="post-card">
        <header className="post-meta">
          <Avatar initials="JB" color="blue" size="sm" />
          <div>
            <strong>Jon Bell</strong>
            <span>
              in <b>Web Builders</b> · 3h
            </span>
          </div>
          <IconButton label="More options" icon={MoreHorizontal} />
        </header>
        <div className="post-body">
          <p>
            Tiny win: shipped my first browser extension today. It only does one
            thing, but it does it quietly and well. Source is open if anyone wants
            to learn from the messy middle.
          </p>
          <a className="link-preview" href="#discover" onClick={(event) => event.preventDefault()}>
            <span className="link-visual">&lt;/&gt;</span>
            <span>
              <small>GITHUB.COM</small>
              <strong>jonbell/tidy-tab</strong>
              <p>A tiny extension for a calmer new-tab page.</p>
            </span>
          </a>
        </div>
        <footer className="post-actions">
          <button
            aria-label={`${liked.includes("post-2") ? "Unlike" : "Like"} Jon Bell's post`}
            className={liked.includes("post-2") ? "active" : ""}
            onClick={() => toggleLike("post-2")}
          >
            <Heart
              size={18}
              fill={liked.includes("post-2") ? "currentColor" : "none"}
            />
            {liked.includes("post-2") ? 48 : 47}
          </button>
          <button aria-label="View 12 comments on Jon Bell's post">
            <MessageSquare size={18} /> 12
          </button>
          <button
            aria-label={`${savedPosts.includes("post-2") ? "Remove Jon Bell's post from saved items" : "Save Jon Bell's post"}`}
            className={`save-action ${
              savedPosts.includes("post-2") ? "active" : ""
            }`}
            onClick={() => onToggleSave("post-2")}
          >
            <Bookmark
              size={18}
              fill={savedPosts.includes("post-2") ? "currentColor" : "none"}
            />
          </button>
        </footer>
      </article>
    </div>
  );
}

function DiscoverPage({
  joinedIds,
  onToggleJoin,
  onNotify,
}: {
  joinedIds: string[];
  onToggleJoin: (id: string, name: string) => void;
  onNotify: () => void;
}): React.JSX.Element {
  const [query, setQuery] = useState("");
  const filtered = communities.filter(
    (community) =>
      community.name.toLowerCase().includes(query.toLowerCase()) ||
      community.tags.some((tag) =>
        tag.toLowerCase().includes(query.toLowerCase()),
      ),
  );

  return (
    <div className="wide-page">
      <AppHeader
        eyebrow="Find your people"
        title="Discover communities"
        onNotify={onNotify}
      />
      <div className="discover-hero">
        <div>
          <span className="eyebrow">There’s a space for that</span>
          <h2>Curiosity is better together.</h2>
          <p>
            Explore thoughtful, member-led communities around the things you care
            about.
          </p>
        </div>
        <div className="discover-art" aria-hidden="true">
          <span>K</span>
          <span>◒</span>
          <span>↗</span>
        </div>
      </div>
      <div className="toolbar">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Search communities or topics"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search communities or topics"
          />
          <kbd>⌘ K</kbd>
        </label>
        <Button variant="secondary" icon={SlidersHorizontal}>
          Filters
        </Button>
      </div>
      <div className="filter-chips">
        {["All", "Technology", "Design", "Creative", "Local", "Impact"].map(
          (item, index) => (
            <button key={item} className={index === 0 ? "active" : ""}>
              {item}
            </button>
          ),
        )}
      </div>
      <div className="community-grid">
        {filtered.map((community) => {
          const joined = joinedIds.includes(community.id);
          return (
            <article className="community-card" key={community.id}>
              <div className={`community-cover cover-${community.color}`}>
                <span>{community.glyph}</span>
                <div />
                <div />
              </div>
              <div className="community-card-body">
                <div className="community-title">
                  <span className={`space-glyph avatar-${community.color}`}>
                    {community.glyph}
                  </span>
                  <div>
                    <h3>{community.name}</h3>
                    <p>{community.members} members</p>
                  </div>
                </div>
                <p>{community.description}</p>
                <div className="card-tags">
                  {community.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <Button
                  variant={joined ? "secondary" : "primary"}
                  onClick={() => onToggleJoin(community.id, community.name)}
                  icon={joined ? Check : Plus}
                >
                  {joined ? "Joined" : "Join community"}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <div className="empty-state">
          <Search size={26} />
          <h3>No communities found</h3>
          <p>Try another name or topic.</p>
        </div>
      )}
    </div>
  );
}

const groupItems = [
  {
    id: "g1",
    name: "Frontend craft",
    community: "Web Builders",
    description: "Patterns, performance, accessibility, and the details that make interfaces feel right.",
    members: 186,
    activity: "12 new posts",
    glyph: "</>",
    color: "blue",
    privacy: "Public",
  },
  {
    id: "g2",
    name: "Design critique",
    community: "Design Circle",
    description: "Kind, specific feedback for work in progress. Weekly live critique on Wednesdays.",
    members: 94,
    activity: "Live today",
    glyph: "◒",
    color: "violet",
    privacy: "Public",
  },
  {
    id: "g3",
    name: "Maintainers’ room",
    community: "KodeKommunity",
    description: "A smaller space for open-source maintainers to compare notes and support one another.",
    members: 48,
    activity: "5 new messages",
    glyph: "M",
    color: "sage",
    privacy: "Private",
  },
  {
    id: "g4",
    name: "Ship small",
    community: "Indie Makers DXB",
    description: "A two-week cadence for turning small ideas into useful, shipped experiments.",
    members: 71,
    activity: "Sprint starts Monday",
    glyph: "↗",
    color: "orange",
    privacy: "Public",
  },
];

function GroupsPage({
  joinedIds,
  onToggle,
  onToast,
  onNavigate,
  canManageCommunity,
}: {
  joinedIds: string[];
  onToggle: (id: string, name: string) => void;
  onToast: (message: string) => void;
  onNavigate: (page: Page) => void;
  canManageCommunity: boolean;
}): React.JSX.Element {
  const [tab, setTab] = useState<"yours" | "discover">("yours");
  const visible =
    tab === "yours"
      ? groupItems.filter((group) => joinedIds.includes(group.id))
      : groupItems;

  return (
    <div className="wide-page groups-page">
      <AppHeader
        eyebrow="Closer circles"
        title="Groups"
        actions={canManageCommunity ? (
          <Button
            icon={Plus}
            className="desktop-action"
            onClick={() => onToast("Group creation flow opened")}
          >
            Create group
          </Button>
        ) : undefined}
      />
      <section className="groups-intro">
        <div>
          <span className="eyebrow">SMALLER SPACES, DEEPER CONVERSATIONS</span>
          <h2>Gather around a shared practice.</h2>
          <p>
            Groups live inside communities and give members a focused place to
            learn, plan, and talk.
          </p>
        </div>
        <div className="group-bubbles" aria-hidden="true">
          <span>◒</span>
          <span>&lt;/&gt;</span>
          <span>↗</span>
        </div>
      </section>
      <div className="tabs-row group-tabs">
        <div className="tabs">
          <button
            className={tab === "yours" ? "active" : ""}
            onClick={() => setTab("yours")}
          >
            Your groups
          </button>
          <button
            className={tab === "discover" ? "active" : ""}
            onClick={() => setTab("discover")}
          >
            Discover
          </button>
        </div>
        <label className="inline-search">
          <Search size={16} />
          <input aria-label="Search groups" placeholder="Search groups" />
        </label>
      </div>
      <div className="group-grid">
        {visible.map((group) => {
          const joined = joinedIds.includes(group.id);
          return (
            <article className="group-card" key={group.id}>
              <header className={`group-card-header poster-${group.color}`}>
                <span>{group.glyph}</span>
                <i>{group.privacy === "Private" ? <Lock size={13} /> : <Globe2 size={13} />} {group.privacy}</i>
              </header>
              <div className="group-card-body">
                <small>{group.community}</small>
                <h3>{group.name}</h3>
                <p>{group.description}</p>
                <div className="group-stats">
                  <span>
                    <UsersRound size={14} /> {group.members} members
                  </span>
                  <span>{group.activity}</span>
                </div>
              </div>
              <footer>
                {joined && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={MessageCircle}
                    onClick={() => onNavigate("messages")}
                  >
                    Open chat
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={joined ? "secondary" : "primary"}
                  icon={joined ? Check : Plus}
                  onClick={() => onToggle(group.id, group.name)}
                >
                  {joined ? "Joined" : group.privacy === "Private" ? "Request" : "Join"}
                </Button>
              </footer>
            </article>
          );
        })}
      </div>
      {!visible.length && (
        <div className="empty-state large">
          <UsersRound size={28} />
          <h3>Your next circle is waiting</h3>
          <p>Discover a group to join the conversation.</p>
          <Button onClick={() => setTab("discover")}>Discover groups</Button>
        </div>
      )}
    </div>
  );
}

function EventCard({
  event,
  going,
  onToggleGoing,
  onOpen,
}: {
  event: EventItem;
  going: boolean;
  onToggleGoing: () => void;
  onOpen: () => void;
}): React.JSX.Element {
  return (
    <article className="event-card">
      <div className={`event-card-art poster-${event.color}`}>
        <span className="event-category">{event.category}</span>
        <div className="event-art-ring" />
        <div className="event-art-dot" />
        <strong>{event.community.split(" ")[0]}</strong>
      </div>
      <div className="event-card-content">
        <div className={`date-block date-${event.color}`}>
          <small>{event.month}</small>
          <strong>{event.date}</strong>
        </div>
        <div className="event-card-copy">
          <span>{event.community}</span>
          <h3>{event.title}</h3>
          <p>
            <Clock3 size={15} /> {event.day} · {event.time}
          </p>
          <p>
            <MapPin size={15} /> {event.venue}
          </p>
        </div>
      </div>
      <footer className="event-card-footer">
        <div className="attendee-stack">
          <Avatar initials="LO" color="coral" size="xs" />
          <Avatar initials="JB" color="blue" size="xs" />
          <Avatar initials="PN" color="plum" size="xs" />
          <span>{event.attendees} going</span>
        </div>
        <div className="event-card-buttons">
          <Button size="sm" variant="ghost" onClick={onOpen}>
            Details
          </Button>
          <Button
            size="sm"
            variant={going ? "soft" : "primary"}
            icon={going ? Check : Plus}
            onClick={onToggleGoing}
          >
            {going ? "Going" : "RSVP"}
          </Button>
        </div>
      </footer>
    </article>
  );
}

function EventsPage({
  goingIds,
  onToggleGoing,
  onNotify,
  canManageCommunity,
  canPresent,
}: {
  goingIds: string[];
  onToggleGoing: (event: EventItem) => void;
  onNotify: () => void;
  canManageCommunity: boolean;
  canPresent: boolean;
}): React.JSX.Element {
  const [tab, setTab] = useState<"upcoming" | "mine">("upcoming");
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const visibleEvents =
    tab === "upcoming"
      ? seedEvents
      : seedEvents.filter((event) => goingIds.includes(event.id));

  return (
    <div className="wide-page">
      <AppHeader
        eyebrow="Meet in the real world"
        title="Events"
        onNotify={onNotify}
        actions={canManageCommunity ? (
          <Button icon={Plus} className="desktop-action">
            Create event
          </Button>
        ) : undefined}
      />
      <div className="tabs-row">
        <div className="tabs">
          <button
            className={tab === "upcoming" ? "active" : ""}
            onClick={() => setTab("upcoming")}
          >
            Upcoming
          </button>
          <button
            className={tab === "mine" ? "active" : ""}
            onClick={() => setTab("mine")}
          >
            My events
          </button>
        </div>
        <div className="view-toggle">
          <CalendarDays size={17} />
          <Menu size={17} />
        </div>
      </div>
      {tab === "upcoming" && (
        <section className="featured-event">
          <div className="featured-copy">
            <span className="event-kicker">FEATURED THIS WEEK</span>
            <h2>Designing for trust</h2>
            <p>
              An honest conversation about making digital products that respect
              the people who use them.
            </p>
            <div className="featured-meta">
              <span>
                <CalendarDays size={16} /> Thu, Aug 6 · 6:30 PM
              </span>
              <span>
                <MapPin size={16} /> Foundry Hall
              </span>
            </div>
            <Button
              variant={goingIds.includes("e1") ? "soft" : "primary"}
              icon={goingIds.includes("e1") ? Check : ArrowRight}
              onClick={() => onToggleGoing(seedEvents[0])}
            >
              {goingIds.includes("e1") ? "You’re going" : "Save your spot"}
            </Button>
          </div>
          <div className="featured-art">
            <div className="orbit orbit-a" />
            <div className="orbit orbit-b" />
            <div className="orbit orbit-c" />
            <strong>TRUST</strong>
          </div>
        </section>
      )}
      <div className="section-title-row">
        <div>
          <h2>{tab === "upcoming" ? "All upcoming" : "Your calendar"}</h2>
          <p>
            {visibleEvents.length} {visibleEvents.length === 1 ? "event" : "events"}
          </p>
        </div>
        <Button variant="secondary" icon={SlidersHorizontal} size="sm">
          Filter
        </Button>
      </div>
      {visibleEvents.length > 0 ? (
        <div className="events-grid">
          {visibleEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              going={goingIds.includes(event.id)}
              onToggleGoing={() => onToggleGoing(event)}
              onOpen={() => setSelectedEvent(event)}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state large">
          <CalendarDays size={28} />
          <h3>Your calendar is wide open</h3>
          <p>RSVP to an event and it’ll appear here.</p>
          <Button onClick={() => setTab("upcoming")}>Browse events</Button>
        </div>
      )}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          going={goingIds.includes(selectedEvent.id)}
          onToggleGoing={() => onToggleGoing(selectedEvent)}
          onClose={() => setSelectedEvent(null)}
          canPresent={canPresent}
        />
      )}
    </div>
  );
}

function EventDetailModal({
  event,
  going,
  onToggleGoing,
  onClose,
  canPresent,
}: {
  event: EventItem;
  going: boolean;
  onToggleGoing: () => void;
  onClose: () => void;
  canPresent: boolean;
}): React.JSX.Element {
  const [view, setView] = useState<"details" | "checkin">("details");
  const [checkedIn, setCheckedIn] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalKeyboard(dialogRef, onClose);
  const qrCells = Array.from({ length: 121 }, (_, index) => {
    const row = Math.floor(index / 11);
    const column = index % 11;
    const finder =
      (row < 4 && column < 4) ||
      (row < 4 && column > 6) ||
      (row > 6 && column < 4);
    return finder || ((index * 7 + row * 3 + column) % 5 < 2);
  });

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal event-detail-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${event.title} event details`}
        onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
      >
        <header>
          <div>
            <span className="eyebrow">{event.community}</span>
            <h2>{event.title}</h2>
          </div>
          <IconButton label="Close event details" icon={X} onClick={onClose} />
        </header>
        <div className="tabs event-modal-tabs">
          <button
            className={view === "details" ? "active" : ""}
            onClick={() => setView("details")}
          >
            Details
          </button>
          <button
            className={view === "checkin" ? "active" : ""}
            onClick={() => setView("checkin")}
            disabled={!going}
          >
            Check-in QR
          </button>
        </div>
        {view === "details" ? (
          <div className="event-detail-content">
            <div className={`event-detail-art poster-${event.color}`}>
              <span>{event.category}</span>
              <strong>{event.date}</strong>
              <small>{event.month}</small>
            </div>
            <div className="event-detail-meta">
              <span>
                <CalendarDays size={17} />
                <b>
                  {event.day}, {event.month} {event.date}
                  <small>{event.time}</small>
                </b>
              </span>
              <span>
                <MapPin size={17} />
                <b>
                  {event.venue}
                  <small>Directions available on the day</small>
                </b>
              </span>
              <span>
                <UsersRound size={17} />
                <b>
                  {event.attendees} people are going
                  <small>
                    {event.capacity
                      ? `${event.capacity - event.attendees} spots remaining`
                      : "No capacity limit"}
                  </small>
                </b>
              </span>
            </div>
            <p>
              A welcoming, practical session with time for questions and meeting
              other members. Your contact details remain private from organizers.
            </p>
            <div className="event-detail-actions">
              {canPresent && (
                <Button variant="secondary" icon={Mic2}>
                  Edit presentation
                </Button>
              )}
              <Button
                variant={going ? "soft" : "primary"}
                icon={going ? Check : Plus}
                onClick={onToggleGoing}
              >
                {going ? "You’re going" : "RSVP to this event"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="checkin-panel">
            {checkedIn ? (
              <div className="checkin-success">
                <span>
                  <CheckCircle2 size={32} />
                </span>
                <h3>You’re checked in</h3>
                <p>Welcome! Your attendance was recorded at 6:24 PM.</p>
              </div>
            ) : (
              <>
                <span className="eyebrow">PERSONAL EVENT PASS</span>
                <h3>Show this code to an organizer</h3>
                <p>For your privacy, this code refreshes automatically every 60 seconds.</p>
                <div className="qr-code" aria-label="Rotating event check-in QR code">
                  {qrCells.map((filled, index) => (
                    <i key={index} className={filled ? "filled" : ""} />
                  ))}
                </div>
                <div className="qr-timer">
                  <Clock3 size={15} /> Refreshing in 42 seconds
                </div>
                <Button onClick={() => setCheckedIn(true)} icon={QrCode}>
                  Simulate organizer scan
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MessagesPage({
  messages,
  onSend,
  theme,
}: {
  messages: typeof initialMessages;
  onSend: (body: string) => void;
  theme: "light" | "dark";
}): React.JSX.Element {
  const [activeId, setActiveId] = useState("m1");
  const [draft, setDraft] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const composerRef = useRef<HTMLFormElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const activeConversation =
    conversations.find((conversation) => conversation.id === activeId) ??
    conversations[0];

  useEffect(() => {
    if (!emojiOpen) return;

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!composerRef.current?.contains(event.target as Node)) {
        setEmojiOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEmojiOpen(false);
        messageInputRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [emojiOpen]);

  const addEmoji = (emojiData: EmojiClickData) => {
    const input = messageInputRef.current;
    const selectionStart = input?.selectionStart ?? draft.length;
    const selectionEnd = input?.selectionEnd ?? draft.length;
    const nextDraft = `${draft.slice(0, selectionStart)}${emojiData.emoji}${draft.slice(selectionEnd)}`;
    const nextCursor = selectionStart + emojiData.emoji.length;

    setDraft(nextDraft);
    window.requestAnimationFrame(() => {
      messageInputRef.current?.focus();
      messageInputRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    onSend(draft.trim());
    setDraft("");
    setEmojiOpen(false);
  };

  return (
    <div className={`messages-page ${mobileOpen ? "mobile-chat-open" : ""}`}>
      <section className="conversation-list">
        <div className="messages-title">
          <div>
            <span className="eyebrow">Stay connected</span>
            <h1>Messages</h1>
          </div>
          <IconButton label="New message" icon={Plus} />
        </div>
        <label className="message-search">
          <Search size={16} />
          <input
            aria-label="Search conversations"
            placeholder="Search conversations"
          />
        </label>
        <div className="conversation-tabs">
          <button className="active">All</button>
          <button>Unread</button>
          <button>Groups</button>
        </div>
        <div className="conversations">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              className={activeId === conversation.id ? "active" : ""}
              onClick={() => {
                setActiveId(conversation.id);
                setMobileOpen(true);
              }}
            >
              <Avatar
                initials={conversation.initials}
                color={conversation.color}
                size="md"
              />
              <span className="conversation-copy">
                <span>
                  <strong>{conversation.name}</strong>
                  <small>{conversation.time}</small>
                </span>
                <span>
                  <p>{conversation.preview}</p>
                  {conversation.unread > 0 && <b>{conversation.unread}</b>}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="chat-panel">
        <header className="chat-header">
          <IconButton
            label="Back to conversations"
            icon={ArrowLeft}
            className="chat-back"
            onClick={() => setMobileOpen(false)}
          />
          <Avatar
            initials={activeConversation.initials}
            color={activeConversation.color}
            size="sm"
          />
          <div>
            <strong>{activeConversation.name}</strong>
            <span>
              {activeConversation.type === "group"
                ? "284 members · 18 online"
                : activeConversation.type === "event"
                  ? "Event chat · closes in 12 days"
                  : "Active recently"}
            </span>
          </div>
          <IconButton label="Conversation options" icon={MoreHorizontal} />
        </header>
        {activeConversation.type === "event" && (
          <div className="chat-notice">
            <Clock3 size={15} /> This event chat will be deleted 7 days after the
            event ends.
          </div>
        )}
        <div className="message-thread">
          <div className="day-divider">
            <span>Today</span>
          </div>
          {activeId === "m1" ? (
            messages.map((message) => (
              <div
                className={`message-bubble-row ${message.own ? "own" : ""}`}
                key={message.id}
              >
                {!message.own && (
                  <Avatar
                    initials={message.initials}
                    color={message.color}
                    size="xs"
                  />
                )}
                <div>
                  {!message.own && <strong>{message.author}</strong>}
                  <p>{message.body}</p>
                  <small>{message.time}</small>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-thread">
              <MessageCircle size={28} />
              <h3>Say hello</h3>
              <p>This is the beginning of your conversation.</p>
            </div>
          )}
        </div>
        <form className="message-composer" onSubmit={submit} ref={composerRef}>
          <label className="attachment-button" title="Attach an image">
            <Paperclip size={18} />
            <input
              aria-label="Attach an image"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onSend(`📎 Shared ${file.name}`);
                event.target.value = "";
              }}
            />
          </label>
          <input
            aria-label={`Message ${activeConversation.name}`}
            ref={messageInputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={`Message ${activeConversation.name}`}
          />
          <IconButton
            label={emojiOpen ? "Close emoji picker" : "Add emoji"}
            icon={Smile}
            className={emojiOpen ? "active" : ""}
            onClick={() => setEmojiOpen((current) => !current)}
          />
          {emojiOpen && (
            <div
              className="emoji-picker-popover"
              data-testid="emoji-picker"
              role="dialog"
              aria-label="Emoji picker"
            >
              <Suspense
                fallback={
                  <div className="emoji-picker-loading">Loading emoji…</div>
                }
              >
                <EmojiPicker
                  theme={
                    (theme === "dark" ? "dark" : "light") as EmojiTheme
                  }
                  emojiStyle={"native" as EmojiStyle}
                  onEmojiClick={addEmoji}
                  autoFocusSearch={false}
                  lazyLoadEmojis
                  previewConfig={{ showPreview: false }}
                  searchPlaceholder="Search emoji"
                  width="100%"
                  height={360}
                />
              </Suspense>
            </div>
          )}
          <button
            className="send-button"
            aria-label="Send message"
            disabled={!draft.trim()}
          >
            <Send size={17} />
          </button>
        </form>
      </section>
    </div>
  );
}

function ConnectionsPage({
  connectedIds,
  onConnect,
  onNotify,
}: {
  connectedIds: string[];
  onConnect: (person: Person) => void;
  onNotify: () => void;
}): React.JSX.Element {
  const [tab, setTab] = useState<"connections" | "incoming" | "sent">(
    "connections",
  );
  const [handled, setHandled] = useState<string[]>([]);

  return (
    <div className="wide-page connections-page">
      <AppHeader
        eyebrow="Your network"
        title="Connections"
        onNotify={onNotify}
        actions={
          <Button icon={QrCode} variant="secondary" className="desktop-action">
            Share my QR
          </Button>
        }
      />
      <div className="connections-summary">
        <div>
          <span className="summary-icon">
            <UsersRound size={20} />
          </span>
          <span>
            <strong>38</strong>
            <small>Connections</small>
          </span>
        </div>
        <div>
          <span className="summary-icon accent">
            <UserPlus size={20} />
          </span>
          <span>
            <strong>2</strong>
            <small>New requests</small>
          </span>
        </div>
        <div className="network-privacy">
          <ShieldCheck size={20} />
          <p>Only you can see your full connection list.</p>
        </div>
      </div>
      <div className="tabs bordered-tabs">
        <button
          className={tab === "connections" ? "active" : ""}
          onClick={() => setTab("connections")}
        >
          Your connections
        </button>
        <button
          className={tab === "incoming" ? "active" : ""}
          onClick={() => setTab("incoming")}
        >
          Requests <b>2</b>
        </button>
        <button
          className={tab === "sent" ? "active" : ""}
          onClick={() => setTab("sent")}
        >
          Sent
        </button>
      </div>

      {tab === "connections" && (
        <>
          <div className="toolbar compact-toolbar">
            <label className="search-field">
              <Search size={17} />
              <input
                aria-label="Search your connections"
                placeholder="Search your connections"
              />
            </label>
            <Button variant="secondary" icon={SlidersHorizontal}>
              Sort
            </Button>
          </div>
          <div className="connection-grid">
            {[...people, ...people.slice(0, 2)].map((person, index) => (
              <article className="connection-card" key={`${person.id}-${index}`}>
                <Avatar
                  initials={person.initials}
                  color={person.color}
                  size="lg"
                  status={index < 3}
                />
                <div>
                  <h3>{person.name}</h3>
                  <span>@{person.handle}</span>
                  <p>{person.headline}</p>
                </div>
                <Button variant="secondary" size="sm" icon={MessageCircle}>
                  Message
                </Button>
                <IconButton label="More options" icon={MoreHorizontal} />
              </article>
            ))}
          </div>
        </>
      )}

      {tab === "incoming" && (
        <div className="requests-list">
          {people.slice(0, 2).map((person) =>
            handled.includes(person.id) ? null : (
              <article className="request-card" key={person.id}>
                <Avatar
                  initials={person.initials}
                  color={person.color}
                  size="lg"
                />
                <div className="request-copy">
                  <h3>{person.name}</h3>
                  <span>@{person.handle} · {person.mutual} mutual connections</span>
                  <p>
                    “Hi Maya! We met briefly at the open-source meetup. I’d love
                    to stay in touch.”
                  </p>
                </div>
                <div className="request-actions">
                  <Button
                    icon={Check}
                    onClick={() =>
                      setHandled((current) => [...current, person.id])
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    variant="secondary"
                    icon={X}
                    onClick={() =>
                      setHandled((current) => [...current, person.id])
                    }
                  >
                    Decline
                  </Button>
                </div>
              </article>
            ),
          )}
          {handled.length >= 2 && (
            <div className="empty-state large">
              <CheckCircle2 size={28} />
              <h3>You’re all caught up</h3>
              <p>No new connection requests right now.</p>
            </div>
          )}
        </div>
      )}

      {tab === "sent" && (
        <div className="requests-list">
          {people
            .filter((person) => connectedIds.includes(person.id))
            .map((person) => (
              <article className="request-card sent-card" key={person.id}>
                <Avatar
                  initials={person.initials}
                  color={person.color}
                  size="lg"
                />
                <div className="request-copy">
                  <h3>{person.name}</h3>
                  <span>@{person.handle}</span>
                  <p>Request sent just now</p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => onConnect(person)}
                >
                  Cancel request
                </Button>
              </article>
            ))}
          {!connectedIds.length && (
            <div className="empty-state large">
              <UserPlus size={28} />
              <h3>No pending requests</h3>
              <p>People you invite to connect will appear here.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationsPage({
  onNotify,
}: {
  onNotify: (message?: string) => void;
}): React.JSX.Element {
  const [read, setRead] = useState<string[]>(["n4"]);
  const notifications = [
    {
      id: "n1",
      icon: UserPlus,
      title: "Lena Ortiz sent you a connection request",
      detail: "6 mutual connections · 12 minutes ago",
      color: "coral",
    },
    {
      id: "n2",
      icon: CalendarDays,
      title: "Designing for trust starts next Thursday",
      detail: "Design Circle · 46 minutes ago",
      color: "violet",
    },
    {
      id: "n3",
      icon: MessageSquare,
      title: "Jon mentioned you in Web Builders",
      detail: "“@maya-chen-makes shared a great example…” · 2 hours ago",
      color: "blue",
    },
    {
      id: "n4",
      icon: Sparkles,
      title: "Your request to join Climate Builders was approved",
      detail: "Yesterday",
      color: "sage",
    },
  ];

  const markAll = () => {
    setRead(notifications.map((item) => item.id));
    onNotify("Everything is marked as read");
  };

  return (
    <div className="narrow-page">
      <AppHeader
        eyebrow="What’s new"
        title="Notifications"
        actions={
          <Button variant="ghost" onClick={markAll}>
            Mark all as read
          </Button>
        }
      />
      <div className="notification-tabs">
        <button className="active">All</button>
        <button>Mentions</button>
        <button>Requests</button>
      </div>
      <div className="notification-list">
        <div className="list-day">Today</div>
        {notifications.map((item) => {
          const Icon = item.icon;
          const isRead = read.includes(item.id);
          return (
            <button
              key={item.id}
              className={isRead ? "read" : ""}
              onClick={() => setRead((current) => [...current, item.id])}
            >
              <span className={`notification-icon avatar-${item.color}`}>
                <Icon size={19} />
              </span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </span>
              {!isRead && <i />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProfilePage({
  onNavigate,
  onToast,
  assignments,
}: {
  onNavigate: (page: Page) => void;
  onToast: (message: string) => void;
  assignments: RoleAssignment[];
}): React.JSX.Element {
  return (
    <div className="narrow-page profile-page">
      <AppHeader
        eyebrow="This is you"
        title="Your profile"
        actions={
          <Button
            variant="secondary"
            icon={Settings}
            onClick={() => onNavigate("settings")}
          >
            Edit profile
          </Button>
        }
      />
      <div className="profile-cover">
        <div className="cover-orbit cover-orbit-a" />
        <div className="cover-orbit cover-orbit-b" />
      </div>
      <section className="profile-card">
        <div className="profile-avatar-wrap">
          <Avatar initials="MC" color="ink" size="xl" status />
        </div>
        <div className="profile-actions">
          <IconButton
            label="Copy profile link"
            icon={Copy}
            onClick={() => onToast("Profile link copied")}
          />
          <Button variant="secondary" icon={QrCode}>
            My QR
          </Button>
        </div>
        <h2>Maya Chen</h2>
        <span>@maya-chen-makes</span>
        <div className="profile-role-strip" aria-label="Assigned roles">
          {assignments.map((assignment) => (
            <span
              className={`role-badge role-${roleDefinitions[assignment.role].tone}`}
              key={`${assignment.role}-${assignmentScope(assignment)}`}
            >
              {roleDefinitions[assignment.role].label}
              <small>{assignmentScope(assignment)}</small>
            </span>
          ))}
        </div>
        <p>
          Product-minded engineer. I like calm software, clear writing, and
          learning alongside generous people.
        </p>
        <div className="profile-tags">
          <span>Product engineering</span>
          <span>Open source</span>
          <span>Learning</span>
          <span>Available to mentor</span>
        </div>
        <div className="profile-stats">
          <div>
            <strong>38</strong>
            <small>Connections</small>
          </div>
          <div>
            <strong>3</strong>
            <small>Communities</small>
          </div>
          <div>
            <strong>12</strong>
            <small>Events attended</small>
          </div>
        </div>
      </section>
      <section className="profile-section">
        <div className="section-title-row">
          <div>
            <h2>Your communities</h2>
            <p>The spaces you call home</p>
          </div>
        </div>
        <div className="profile-community-list">
          {communities.slice(0, 3).map((community) => (
            <div key={community.id}>
              <span className={`space-glyph avatar-${community.color}`}>
                {community.glyph}
              </span>
              <span>
                <strong>{community.name}</strong>
                <small>{community.members} members</small>
              </span>
              <ArrowRight size={17} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SettingsPage({
  theme,
  onTheme,
  onToast,
  subject,
  onClearLocalData,
  onOpenAccess,
}: {
  theme: "light" | "dark";
  onTheme: (theme: "light" | "dark") => void;
  onToast: (message: string) => void;
  subject: AuthorizationSubject;
  onClearLocalData: () => void;
  onOpenAccess: () => void;
}): React.JSX.Element {
  const [discoverable, setDiscoverable] = useState(true);
  const [eventEmails, setEventEmails] = useState(true);
  return (
    <div className="narrow-page settings-page">
      <AppHeader eyebrow="Make it yours" title="Settings" />
      <div className="settings-layout">
        <nav className="settings-nav">
          <button className="active">
            <UserRound size={17} /> Profile
          </button>
          <button>
            <Bell size={17} /> Notifications
          </button>
          <button>
            <ShieldCheck size={17} /> Privacy
          </button>
          <button>
            <Lock size={17} /> Security
          </button>
        </nav>
        <div className="settings-content">
          <section className="settings-section">
            <div>
              <h2>Appearance</h2>
              <p>Choose how Kommunity looks on this device.</p>
            </div>
            <div className="theme-options">
              <button
                className={theme === "light" ? "active" : ""}
                onClick={() => onTheme("light")}
              >
                <span className="theme-preview light-preview">
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  <Sun size={17} /> Light
                </span>
              </button>
              <button
                className={theme === "dark" ? "active" : ""}
                onClick={() => onTheme("dark")}
              >
                <span className="theme-preview dark-preview">
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  <Moon size={17} /> Dark
                </span>
              </button>
            </div>
          </section>
          <section className="settings-section">
            <div>
              <h2>Privacy & discovery</h2>
              <p>You control how other people can find you.</p>
            </div>
            <label className="toggle-row">
              <span>
                <strong>Discoverable by exact handle</strong>
                <small>
                  People who know your full handle can find your public profile.
                </small>
              </span>
              <input
                type="checkbox"
                checked={discoverable}
                onChange={() => setDiscoverable(!discoverable)}
              />
              <i />
            </label>
            <label className="toggle-row">
              <span>
                <strong>Event reminders by email</strong>
                <small>Receive a reminder before events you’re attending.</small>
              </span>
              <input
                type="checkbox"
                checked={eventEmails}
                onChange={() => setEventEmails(!eventEmails)}
              />
              <i />
            </label>
          </section>
          <section className="settings-section account-roles-section">
            <div>
              <h2>
                <ShieldCheck size={18} /> Your roles & access
              </h2>
              <p>
                One account can hold several roles across platform, community,
                and event scopes.
              </p>
            </div>
            <div className="account-role-list">
              {subject.assignments.map((assignment) => (
                <div key={`${assignment.role}-${assignmentScope(assignment)}`}>
                  <span
                    className={`role-symbol role-${roleDefinitions[assignment.role].tone}`}
                  >
                    {assignment.role === "root" ? (
                      <Crown size={15} />
                    ) : assignment.role === "maintainer" ? (
                      <Wrench size={15} />
                    ) : assignment.role === "presenter" ? (
                      <Mic2 size={15} />
                    ) : (
                      <ShieldCheck size={15} />
                    )}
                  </span>
                  <span>
                    <strong>{roleDefinitions[assignment.role].label}</strong>
                    <small>{assignmentScope(assignment)}</small>
                  </span>
                </div>
              ))}
            </div>
            {(canPreview(subject, "platform:manage") ||
              canPreview(subject, "platform:maintain")) && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenAccess}
              >
                Open access control
              </Button>
            )}
          </section>
          <section className="settings-section privacy-contract">
            <div>
              <h2>
                <ShieldCheck size={19} /> Your privacy contract
              </h2>
              <p>
                Your email and phone number are never shown to other members,
                organizers, or community admins.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onToast("Data export is being prepared")}
            >
              Export my data
            </Button>
          </section>
          <section className="settings-section">
            <div>
              <h2>
                <LogOut size={18} /> Data on this device
              </h2>
              <p>
                Remove saved preview state, session messages, and Kommunity
                offline caches from this browser.
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={onClearLocalData}
            >
              Clear local data
            </Button>
          </section>
          <Button onClick={() => onToast("Settings saved")}>Save changes</Button>
        </div>
      </div>
    </div>
  );
}

const accessMembers = [
  {
    id: "maya",
    name: "Maya Chen",
    handle: "maya-chen-makes",
    initials: "MC",
    color: "ink",
  },
  {
    id: "priya",
    name: "Priya Nair",
    handle: "priya-nair-learns",
    initials: "PN",
    color: "plum",
  },
  {
    id: "lena",
    name: "Lena Ortiz",
    handle: "lena-ortiz-designs",
    initials: "LO",
    color: "coral",
  },
  {
    id: "jon",
    name: "Jon Bell",
    handle: "jon-bell-builds",
    initials: "JB",
    color: "blue",
  },
];

const roleAssignmentOptions: RoleAssignment[] = [
  { role: "root", scope: "platform" },
  { role: "maintainer", scope: "platform" },
  { role: "super_admin", scope: "community", scopeId: "c1" },
  { role: "super_admin", scope: "community", scopeId: "c2" },
  { role: "super_admin", scope: "community", scopeId: "c3" },
  { role: "admin", scope: "community", scopeId: "c1" },
  { role: "admin", scope: "community", scopeId: "c2" },
  { role: "admin", scope: "community", scopeId: "c3" },
  { role: "presenter", scope: "event", scopeId: "e1" },
  { role: "user", scope: "platform" },
];

function RoleIcon({ role }: { role: RoleName }): React.JSX.Element {
  if (role === "root") return <Crown size={16} />;
  if (role === "maintainer") return <Wrench size={16} />;
  if (role === "presenter") return <Mic2 size={16} />;
  if (role === "user") return <UserRound size={16} />;
  return <ShieldCheck size={16} />;
}

function FloatingRoleSwitcher({
  assignments,
  activeKey,
  onSwitch,
}: {
  assignments: RoleAssignment[];
  activeKey: string;
  onSwitch: (key: string) => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const activeAssignment = assignments.find(
    (assignment) => roleAssignmentKey(assignment) === activeKey,
  );
  const activeLabel = activeAssignment
    ? roleDefinitions[activeAssignment.role].label
    : "All roles";

  return (
    <aside
      className={`floating-role-switcher ${open ? "open" : ""}`}
      aria-label="Role switcher"
    >
      <button
        className="role-switcher-trigger"
        type="button"
        aria-expanded={open}
        aria-controls="role-switcher-panel"
        aria-label={`${open ? "Close" : "Open"} role switcher. Current view: ${activeLabel}`}
        title={`Current view: ${activeLabel}`}
        onClick={() => setOpen((current) => !current)}
      >
        <SlidersHorizontal size={17} />
        <span>{activeLabel}</span>
        <ChevronDown size={15} />
      </button>

      {open && (
        <div className="role-switcher-panel" id="role-switcher-panel">
          <header>
            <span>
              <strong>View as</strong>
              <small>Preview permissions by role</small>
            </span>
            <IconButton
              label="Close role switcher"
              icon={X}
              onClick={() => setOpen(false)}
            />
          </header>

          <div className="role-switcher-options">
            <button
              type="button"
              className={activeKey === "all" ? "active" : ""}
              aria-pressed={activeKey === "all"}
              onClick={() => onSwitch("all")}
            >
              <span className="role-symbol role-ink">
                <UsersRound size={16} />
              </span>
              <span>
                <strong>All roles</strong>
                <small>Combined permissions</small>
              </span>
              {activeKey === "all" && <Check size={16} />}
            </button>

            {assignments.map((assignment) => {
              const definition = roleDefinitions[assignment.role];
              const key = roleAssignmentKey(assignment);
              const active = key === activeKey;

              return (
                <button
                  type="button"
                  className={active ? "active" : ""}
                  aria-pressed={active}
                  key={key}
                  onClick={() => onSwitch(key)}
                >
                  <span className={`role-symbol role-${definition.tone}`}>
                    <RoleIcon role={assignment.role} />
                  </span>
                  <span>
                    <strong>{definition.label}</strong>
                    <small>{assignmentScope(assignment)}</small>
                  </span>
                  {active && <Check size={16} />}
                </button>
              );
            })}
          </div>

          <p>
            This changes your active permission view. Your assigned roles stay
            unchanged.
          </p>
        </div>
      )}
    </aside>
  );
}

function AccessPage({
  directory,
  viewerSubject,
  onToggleAssignment,
}: {
  directory: RoleDirectory;
  viewerSubject: AuthorizationSubject;
  onToggleAssignment: (
    userId: string,
    assignment: RoleAssignment,
  ) => void;
}): React.JSX.Element {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleName | "all">("all");
  const canEdit = canPreview(viewerSubject, "platform:manage");
  const rootCount = Object.values(directory).filter((assignments) =>
    hasRole(assignments, "root"),
  ).length;
  const filteredMembers = accessMembers.filter((member) => {
    const matchesQuery =
      member.name.toLowerCase().includes(query.toLowerCase()) ||
      member.handle.toLowerCase().includes(query.toLowerCase());
    const matchesRole =
      roleFilter === "all" ||
      hasRole(directory[member.id] ?? [], roleFilter);
    return matchesQuery && matchesRole;
  });

  return (
    <div className="wide-page access-page">
      <AppHeader
        eyebrow="Platform governance"
        title="Access control"
        actions={
          <span className={`access-mode ${canEdit ? "editable" : ""}`}>
            {canEdit ? <Crown size={15} /> : <Wrench size={15} />}
            {canEdit ? "Root access" : "Read-only maintainer"}
          </span>
        }
      />
      <section className="access-summary">
        <div>
          <span className="eyebrow">MULTI-ROLE AUTHORIZATION</span>
          <h2>One person, the right access in every context.</h2>
          <p>
            Platform roles are global. Community and event roles remain scoped,
            so authority never leaks into another space.
          </p>
        </div>
        <div className="access-scope-diagram" aria-label="Role scope summary">
          <span>
            <Crown size={18} /> Platform
            <small>root · maintainer · user</small>
          </span>
          <i />
          <span>
            <ShieldCheck size={18} /> Community
            <small>super_admin · admin</small>
          </span>
          <i />
          <span>
            <Mic2 size={18} /> Event
            <small>presenter</small>
          </span>
        </div>
      </section>

      <section className="role-catalog">
        {roleNames.map((role) => {
          const definition = roleDefinitions[role];
          const count = Object.values(directory).filter((assignments) =>
            hasRole(assignments, role),
          ).length;
          return (
            <button
              className={roleFilter === role ? "active" : ""}
              key={role}
              onClick={() =>
                setRoleFilter((current) => (current === role ? "all" : role))
              }
            >
              <span className={`role-symbol role-${definition.tone}`}>
                <RoleIcon role={role} />
              </span>
              <span>
                <strong>{definition.label}</strong>
                <small>{definition.scopeLabel}</small>
              </span>
              <b>{count}</b>
            </button>
          );
        })}
      </section>

      <div className="section-title-row access-members-title">
        <div>
          <h2>People & role assignments</h2>
          <p>{filteredMembers.length} people shown</p>
        </div>
        <label className="inline-search access-search">
          <Search size={16} />
          <input
            aria-label="Search people"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people"
          />
        </label>
      </div>

      <div className="access-member-list">
        {filteredMembers.map((member) => {
          const assignments = directory[member.id] ?? [];
          return (
            <article className="access-member-card" key={member.id}>
              <div className="access-member-person">
                <Avatar
                  initials={member.initials}
                  color={member.color}
                  size="md"
                />
                <span>
                  <strong>
                    {member.name}
                    {member.id === "maya" && <i>You</i>}
                  </strong>
                  <small>@{member.handle}</small>
                </span>
                <b>{assignments.length} roles</b>
              </div>
              <div className="role-assignment-grid">
                {roleAssignmentOptions.map((target) => {
                  const targetKey = roleAssignmentKey(target);
                  const assigned = assignments.some(
                    (assignment) =>
                      roleAssignmentKey(assignment) === targetKey,
                  );
                  const lastRoot =
                    target.role === "root" && assigned && rootCount === 1;
                  const disabled =
                    !canEdit || target.role === "user" || lastRoot;
                  const definition = roleDefinitions[target.role];
                  return (
                    <button
                      className={`${assigned ? "assigned" : ""} role-${definition.tone}`}
                      disabled={disabled}
                      key={targetKey}
                      onClick={() =>
                        onToggleAssignment(member.id, target)
                      }
                      title={
                        lastRoot
                          ? "The final root assignment cannot be removed"
                          : target.role === "user"
                            ? "User is the required baseline role"
                            : `${assigned ? "Remove" : "Assign"} ${definition.label}`
                      }
                    >
                      <span>
                        <RoleIcon role={target.role} />
                        {definition.label}
                      </span>
                      <small>{assignmentScope(target)}</small>
                      {assigned ? <Check size={15} /> : <Plus size={15} />}
                    </button>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
      {!filteredMembers.length && (
        <div className="empty-state large">
          <Search size={28} />
          <h3>No matching people</h3>
          <p>Clear the role filter or try another name.</p>
          <Button
            variant="secondary"
            onClick={() => {
              setQuery("");
              setRoleFilter("all");
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
      <div className="access-safety-note">
        <Lock size={18} />
        <span>
          <strong>Local permission preview</strong>
          <small>
            This prototype stores preview assignments in this browser only.
            Production authorization is enforced and audited by the server.
            The baseline user role and final root assignment remain protected.
          </small>
        </span>
      </div>
    </div>
  );
}

function CreateModal({
  onClose,
  onPublish,
}: {
  onClose: () => void;
  onPublish: (body: string) => void;
}): React.JSX.Element {
  const [body, setBody] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalKeyboard(dialogRef, onClose);
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="eyebrow">Share with your space</span>
            <h2 id="create-title">Create a post</h2>
          </div>
          <IconButton label="Close" icon={X} onClick={onClose} />
        </header>
        <div className="posting-as">
          <Avatar initials="MC" color="ink" size="sm" />
          <span>
            <strong>Maya Chen</strong>
            <button>
              KodeKommunity <ChevronDown size={14} />
            </button>
          </span>
        </div>
        <textarea
          aria-label="Post body"
          autoFocus
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="What would you like to share?"
          maxLength={4000}
        />
        <footer>
          <div>
            <IconButton label="Add emoji" icon={Smile} />
            <span>{body.length}/4000</span>
          </div>
          <Button
            disabled={!body.trim()}
            onClick={() => onPublish(body.trim())}
          >
            Publish post
          </Button>
        </footer>
      </div>
    </div>
  );
}

function Onboarding({
  onComplete,
}: {
  onComplete: () => void;
}): React.JSX.Element {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("Maya Chen");
  const [handle, setHandle] = useState("maya-chen-makes");
  const [selected, setSelected] = useState<string[]>([
    "Open source",
    "Learning",
  ]);
  const options = [
    "Open source",
    "Learning",
    "Design",
    "Events",
    "Hiring",
    "Mentoring",
  ];

  return (
    <div className="onboarding-shell">
      <header>
        <Logo />
        <span>Step {step} of 3</span>
      </header>
      <main>
        <div className="onboarding-progress">
          {[1, 2, 3].map((item) => (
            <span key={item} className={step >= item ? "active" : ""} />
          ))}
        </div>
        {step === 1 && (
          <section className="onboarding-step">
            <span className="eyebrow">Let’s start with you</span>
            <h1>Make yourself at home.</h1>
            <p>A name and a public handle are enough to begin.</p>
            <div className="avatar-picker">
              <Avatar initials="MC" color="ink" size="xl" />
              <button>
                <Plus size={17} /> Add a photo
              </button>
            </div>
            <label>
              <span>Display name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              <span>Public handle</span>
              <div className="handle-field">
                <span>@</span>
                <input
                  value={handle}
                  onChange={(event) => setHandle(event.target.value)}
                />
                <CheckCircle2 size={17} />
              </div>
              <small>Your email is never shown to other members.</small>
            </label>
          </section>
        )}
        {step === 2 && (
          <section className="onboarding-step">
            <span className="eyebrow">A little context</span>
            <h1>What brings you here?</h1>
            <p>Choose a few interests. You can change these at any time.</p>
            <div className="interest-grid">
              {options.map((option) => (
                <button
                  key={option}
                  className={selected.includes(option) ? "active" : ""}
                  onClick={() =>
                    setSelected((current) =>
                      current.includes(option)
                        ? current.filter((item) => item !== option)
                        : [...current, option],
                    )
                  }
                >
                  {selected.includes(option) && <Check size={16} />}
                  {option}
                </button>
              ))}
            </div>
          </section>
        )}
        {step === 3 && (
          <section className="onboarding-step">
            <span className="eyebrow">One last thing</span>
            <h1>Meet your first community.</h1>
            <p>We’ve found a welcoming place to help you get started.</p>
            <article className="onboarding-community">
              <div className="community-cover cover-ink">
                <span>K</span>
                <div />
                <div />
              </div>
              <div>
                <span className="space-glyph avatar-ink">K</span>
                <span>
                  <strong>KodeKommunity</strong>
                  <small>1.2k members · Open to join</small>
                </span>
                <CheckCircle2 size={20} />
              </div>
              <p>
                A generous space for people who make things with technology.
              </p>
            </article>
          </section>
        )}
        <div className="onboarding-actions">
          {step > 1 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button
            onClick={() => {
              if (step < 3) setStep(step + 1);
              else onComplete();
            }}
            icon={step === 3 ? Check : ArrowRight}
            disabled={step === 1 && (!name.trim() || !handle.trim())}
          >
            {step === 3 ? "Enter Kommunity" : "Continue"}
          </Button>
        </div>
      </main>
      <footer>
        <ShieldCheck size={16} /> Privacy-first by design. Your contact details stay
        private.
      </footer>
    </div>
  );
}

const initialRoleDirectory: RoleDirectory = {
  maya: [
    { role: "root", scope: "platform" },
    { role: "user", scope: "platform" },
  ],
  priya: [
    { role: "maintainer", scope: "platform" },
    { role: "super_admin", scope: "community", scopeId: "c1" },
    { role: "user", scope: "platform" },
  ],
  lena: [
    { role: "admin", scope: "community", scopeId: "c2" },
    { role: "presenter", scope: "event", scopeId: "e1" },
    { role: "user", scope: "platform" },
  ],
  jon: [
    { role: "user", scope: "platform" },
  ],
};

const initialIdentityStatuses: IdentityStatusDirectory = {
  maya: "active",
  priya: "active",
  lena: "active",
  jon: "active",
};

function App(): React.JSX.Element {
  const [viewerId, setViewerId] = useState("maya");
  const [page, setPage] = useState<Page>("home");
  const [theme, setTheme] = useBrowserState<"light" | "dark">(
    "kommunity-theme",
    "light",
    isTheme,
  );
  const [onboarded, setOnboarded] = useBrowserState(
    "kommunity-onboarded",
    true,
    isBoolean,
  );
  const [joinedIds, setJoinedIds] = useBrowserState<string[]>(
    "kommunity-joined",
    communities.filter((item) => item.joined).map((item) => item.id),
    isStringArray,
  );
  const [joinedGroupIds, setJoinedGroupIds] = useBrowserState<string[]>(
    "kommunity-groups",
    ["g1", "g2", "g3"],
    isStringArray,
  );
  const [goingIds, setGoingIds] = useBrowserState<string[]>(
    "kommunity-going",
    seedEvents.filter((item) => item.going).map((item) => item.id),
    isStringArray,
  );
  const [connectedIds, setConnectedIds] = useBrowserState<string[]>(
    "kommunity-connected",
    [],
    isStringArray,
  );
  const [savedPosts, setSavedPosts] = useBrowserState<string[]>(
    "kommunity-saved",
    [],
    isStringArray,
  );
  const [messages, setMessages] = useBrowserState(
    "kommunity-messages",
    initialMessages,
    isMessageArray,
    "session",
    EIGHT_HOURS_MS,
  );
  const [roleDirectory, setRoleDirectory] = useBrowserState<RoleDirectory>(
    "kommunity-role-directory",
    initialRoleDirectory,
    isRoleDirectory,
    "local",
    ONE_DAY_MS,
  );
  const [identityStatuses, setIdentityStatuses] =
    useBrowserState<IdentityStatusDirectory>(
      "kommunity-identity-statuses",
      initialIdentityStatuses,
      isIdentityStatusDirectory,
      "local",
      ONE_DAY_MS,
    );
  const [activeRoleKey, setActiveRoleKey] = useBrowserState(
    "kommunity-active-role",
    "all",
    isString,
    "local",
    ONE_DAY_MS,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const viewerAssignments =
    roleDirectory[viewerId] ?? initialRoleDirectory[viewerId] ?? [
      { role: "user", scope: "platform" },
    ];
  const viewerStatus = identityStatuses[viewerId] ?? "revoked";
  const canSwitchRoles =
    viewerStatus === "active" &&
    (hasRole(viewerAssignments, "root") ||
      hasRole(viewerAssignments, "maintainer"));
  const activeRoleAssignment =
    activeRoleKey === "all"
      ? undefined
      : viewerAssignments.find(
          (assignment) => roleAssignmentKey(assignment) === activeRoleKey,
        );
  const effectiveViewerAssignments = activeRoleAssignment
    ? viewerAssignments.filter(
        (assignment) =>
          assignment.role === "user" ||
          roleAssignmentKey(assignment) === activeRoleKey,
      )
    : viewerAssignments;
  const effectiveViewerSubject: AuthorizationSubject = {
    status: viewerStatus,
    assignments: effectiveViewerAssignments,
  };
  const activeRole = activeRoleAssignment?.role ?? "all";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    const hydrateFromServer = async () => {
      try {
        const bootstrap = await loadBootstrap();
        if (cancelled) return;
        setViewerId(bootstrap.user.id);
        setJoinedIds(
          bootstrap.communities
            .filter((community) => community.joined)
            .map((community) => community.id),
        );
        setGoingIds(
          bootstrap.events
            .filter((event) => event.going)
            .map((event) => event.id),
        );
        setRoleDirectory((current) => ({
          ...current,
          [bootstrap.user.id]: bootstrap.user.assignments,
        }));
        setIdentityStatuses((current) => ({
          ...current,
          [bootstrap.user.id]: bootstrap.user.status,
        }));

        const messagePage = await loadMessages("m1").catch(() => null);
        if (!cancelled && messagePage) {
          setMessages(
            messagePage.items.map((message) => ({
              id: message.id,
              author: message.author,
              initials: message.initials,
              color: message.color,
              body: message.body,
              time: new Intl.DateTimeFormat(undefined, {
                hour: "numeric",
                minute: "2-digit",
              }).format(new Date(message.createdAt)),
              own: message.own,
            })),
          );
        }

        const mayViewAccess = bootstrap.user.assignments.some(
          (assignment) =>
            assignment.role === "root" || assignment.role === "maintainer",
        );
        if (mayViewAccess) {
          const access = await loadAccessDirectory();
          if (cancelled) return;
          setRoleDirectory(
            Object.fromEntries(
              access.users.map((user) => [user.id, user.assignments]),
            ),
          );
          setIdentityStatuses(
            Object.fromEntries(
              access.users.map((user) => [user.id, user.status]),
            ),
          );
        }
      } catch (error) {
        if (!cancelled) {
          showToast(
            error instanceof ApiError
              ? `Backend unavailable: ${error.message}`
              : "Backend unavailable; using saved preview data",
          );
        }
      }
    };
    void hydrateFromServer();
    return () => {
      cancelled = true;
    };
  }, [
    setGoingIds,
    setIdentityStatuses,
    setJoinedIds,
    setMessages,
    setRoleDirectory,
  ]);

  useEffect(() => {
    if (
      activeRoleKey !== "all" &&
      (!canSwitchRoles || !activeRoleAssignment)
    ) {
      setActiveRoleKey("all");
    }
  }, [
    activeRoleAssignment,
    activeRoleKey,
    canSwitchRoles,
    setActiveRoleKey,
  ]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const showToast = (message: string) => {
    setToast({ id: Date.now(), message });
  };

  const switchActiveRole = (key: string) => {
    const nextAssignment = viewerAssignments.find(
      (assignment) => roleAssignmentKey(assignment) === key,
    );
    const nextAssignments = nextAssignment
      ? viewerAssignments.filter(
          (assignment) =>
            assignment.role === "user" ||
            roleAssignmentKey(assignment) === key,
        )
      : viewerAssignments;

    setActiveRoleKey(nextAssignment ? key : "all");
    const nextSubject: AuthorizationSubject = {
      status: viewerStatus,
      assignments: nextAssignments,
    };
    if (
      page === "access" &&
      !canPreview(nextSubject, "platform:manage") &&
      !canPreview(nextSubject, "platform:maintain")
    ) {
      setPage("home");
    }
    showToast(
      nextAssignment
        ? `Viewing as ${roleDefinitions[nextAssignment.role].label}`
        : "Using all assigned roles",
    );
  };

  const navigate = (next: Page) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleJoin = async (id: string, name: string) => {
    const joined = joinedIds.includes(id);
    try {
      const result = await updateCommunityMembership(
        id,
        joined ? "left" : "joined",
      );
      setJoinedIds((current) =>
        result.status === "joined"
          ? Array.from(new Set([...current, id]))
          : current.filter((item) => item !== id),
      );
      showToast(result.status === "joined" ? `Welcome to ${name}` : `You left ${name}`);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not update membership",
      );
    }
  };

  const toggleGoing = async (event: EventItem) => {
    const going = goingIds.includes(event.id);
    try {
      const result = await updateRsvp(
        event.id,
        going ? "not_going" : "going",
      );
      setGoingIds((current) =>
        result.status === "going"
          ? Array.from(new Set([...current, event.id]))
          : current.filter((item) => item !== event.id),
      );
      showToast(
        result.status === "going"
          ? `You’re going to ${event.title}`
          : "RSVP cancelled",
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not update RSVP");
    }
  };

  const toggleGroup = (id: string, name: string) => {
    const joined = joinedGroupIds.includes(id);
    setJoinedGroupIds((current) =>
      joined ? current.filter((item) => item !== id) : [...current, id],
    );
    showToast(
      joined
        ? `You left ${name}`
        : id === "g3"
          ? `Request sent to ${name}`
          : `Welcome to ${name}`,
    );
  };

  const toggleConnect = (person: Person) => {
    const sent = connectedIds.includes(person.id);
    setConnectedIds((current) =>
      sent
        ? current.filter((item) => item !== person.id)
        : [...current, person.id],
    );
    showToast(sent ? "Connection request cancelled" : `Request sent to ${person.name}`);
  };

  const toggleSave = (id: string) => {
    const saved = savedPosts.includes(id);
    setSavedPosts((current) =>
      saved ? current.filter((item) => item !== id) : [...current, id],
    );
    showToast(saved ? "Removed from saved" : "Post saved");
  };

  const sendMessage = async (body: string) => {
    try {
      const message = await postMessage("m1", body);
      setMessages((current) => [
        ...current,
        {
          id: message.id,
          author: message.author,
          initials: message.initials,
          color: message.color,
          body: message.body,
          time: "Just now",
          own: message.own,
        },
      ]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not send message");
    }
  };

  const updateMemberRole = async (
    userId: string,
    target: RoleAssignment,
  ) => {
    const role = target.role;
    if (!canPreview(effectiveViewerSubject, "platform:manage")) {
      showToast("Only root can change role assignments");
      return;
    }
    const memberAssignments = roleDirectory[userId] ?? [
      { role: "user", scope: "platform" },
    ];
    const rootCount = Object.values(roleDirectory).filter((assignments) =>
      hasRole(assignments, "root"),
    ).length;
    if (
      role === "root" &&
      hasRole(memberAssignments, "root") &&
      rootCount === 1
    ) {
      showToast("The final root assignment cannot be removed");
      return;
    }
    const targetKey = roleAssignmentKey(target);
    const adding = !memberAssignments.some(
      (assignment) => roleAssignmentKey(assignment) === targetKey,
    );
    try {
      const result = await updateRole(
        userId,
        adding ? "grant" : "revoke",
        target,
      );
      setRoleDirectory((current) => ({
        ...current,
        [userId]: result.user.assignments,
      }));
      showToast(
        `${roleDefinitions[role].label} ${adding ? "assigned" : "removed"}`,
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not update role");
    }
  };

  const clearLocalData = async () => {
    const confirmed = window.confirm(
      "Clear Kommunity data from this browser? This removes saved preview state, session messages, and offline caches.",
    );
    if (!confirmed) return;

    try {
      await clearKommunityBrowserData();
      window.location.reload();
    } catch {
      showToast("Could not clear all local data. Please try again.");
    }
  };

  const pageContent = useMemo(() => {
    switch (page) {
      case "home":
        return (
          <div className="home-layout">
            <HomePage
              onNavigate={navigate}
              onCreate={() => setCreateOpen(true)}
              onNotify={() => navigate("notifications")}
              savedPosts={savedPosts}
              onToggleSave={toggleSave}
            />
            <RightRail
              onNavigate={navigate}
              connectedIds={connectedIds}
              onConnect={toggleConnect}
            />
          </div>
        );
      case "discover":
        return (
          <DiscoverPage
            joinedIds={joinedIds}
            onToggleJoin={toggleJoin}
            onNotify={() => navigate("notifications")}
          />
        );
      case "groups":
        return (
          <GroupsPage
            joinedIds={joinedGroupIds}
            onToggle={toggleGroup}
            onToast={showToast}
            onNavigate={navigate}
            canManageCommunity={canPreview(
              effectiveViewerSubject,
              "community:manage",
              { communityId: "c1" },
            )}
          />
        );
      case "events":
        return (
          <EventsPage
            goingIds={goingIds}
            onToggleGoing={toggleGoing}
            onNotify={() => navigate("notifications")}
            canManageCommunity={canPreview(
              effectiveViewerSubject,
              "community:manage",
              { communityId: "c1" },
            )}
            canPresent={canPreview(effectiveViewerSubject, "event:present", {
              communityId: "c1",
              eventId: "e1",
            })}
          />
        );
      case "messages":
        return (
          <MessagesPage
            messages={messages}
            onSend={sendMessage}
            theme={theme}
          />
        );
      case "connections":
        return (
          <ConnectionsPage
            connectedIds={connectedIds}
            onConnect={toggleConnect}
            onNotify={() => navigate("notifications")}
          />
        );
      case "notifications":
        return <NotificationsPage onNotify={(message) => showToast(message ?? "")} />;
      case "access":
        return (
          <AccessPage
            directory={roleDirectory}
            viewerSubject={effectiveViewerSubject}
            onToggleAssignment={updateMemberRole}
          />
        );
      case "profile":
        return (
          <ProfilePage
            onNavigate={navigate}
            onToast={showToast}
            assignments={effectiveViewerAssignments}
          />
        );
      case "settings":
        return (
          <SettingsPage
            theme={theme}
            onTheme={setTheme}
            onToast={showToast}
            subject={effectiveViewerSubject}
            onClearLocalData={clearLocalData}
            onOpenAccess={() => navigate("access")}
          />
        );
    }
  }, [
    activeRoleKey,
    connectedIds,
    goingIds,
    joinedGroupIds,
    joinedIds,
    messages,
    page,
    roleDirectory,
    savedPosts,
    theme,
    viewerStatus,
  ]);

  if (!onboarded) {
    return <Onboarding onComplete={() => setOnboarded(true)} />;
  }

  return (
    <div className={`app-shell page-${page}`}>
      <Sidebar
        page={page}
        onNavigate={navigate}
        onCreate={() => setCreateOpen(true)}
        subject={effectiveViewerSubject}
        activeRole={activeRole}
      />
      <MobileHeader page={page} onNavigate={navigate} />
      <main className="app-content">{pageContent}</main>
      <BottomNav
        page={page}
        onNavigate={navigate}
        onCreate={() => setCreateOpen(true)}
      />
      {canSwitchRoles && (
        <FloatingRoleSwitcher
          assignments={viewerAssignments}
          activeKey={activeRoleKey}
          onSwitch={switchActiveRole}
        />
      )}
      <button
        className="floating-theme"
        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      >
        {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
      </button>
      {createOpen && (
        <CreateModal
          onClose={() => setCreateOpen(false)}
          onPublish={() => {
            setCreateOpen(false);
            showToast("Your post is live");
          }}
        />
      )}
      {toast && (
        <div className="toast" key={toast.id}>
          <CheckCircle2 size={18} />
          {toast.message}
        </div>
      )}
      <button
        className="demo-reset"
        onClick={() => {
          setOnboarded(false);
          setPage("home");
        }}
        title="Replay onboarding"
      >
        <Globe2 size={15} /> Replay onboarding
      </button>
    </div>
  );
}

export default App;
