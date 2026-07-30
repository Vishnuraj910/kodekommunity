import { CalendarDays, FileText, ShieldCheck, UsersRound } from "lucide-react";
import { useState } from "react";
import type {
  AdminEventCreate,
  AdminEventUpdate,
  AdminGroupCreate,
  AdminGroupUpdate,
  AdminOverview,
  AdminPostCreate,
  AdminPostUpdate,
  AdminUserCreate,
  AdminUserUpdate,
  ApiRoleAssignment,
} from "../../../server/src/schemas/api";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";

type AdminSection = "users" | "events" | "posts" | "groups";

type AdminPageProps = {
  overview: AdminOverview;
  createUser: (input: AdminUserCreate) => Promise<void>;
  updateUser: (userId: string, input: AdminUserUpdate) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  updateRole: (
    userId: string,
    action: "grant" | "revoke",
    assignment: ApiRoleAssignment,
  ) => Promise<void>;
  createEvent: (input: AdminEventCreate) => Promise<void>;
  updateEvent: (eventId: string, input: AdminEventUpdate) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  createPost: (input: AdminPostCreate) => Promise<void>;
  updatePost: (postId: string, input: AdminPostUpdate) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  createGroup: (input: AdminGroupCreate) => Promise<void>;
  updateGroup: (groupId: string, input: AdminGroupUpdate) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
};

const value = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();

const isoFromLocal = (input: string) => new Date(input).toISOString();

const sectionOptions = [
  { id: "users", label: "Users", icon: ShieldCheck },
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "posts", label: "Posts", icon: FileText },
  { id: "groups", label: "Groups", icon: UsersRound },
] as const;

const roleOptions = [
  { value: "root", label: "Root" },
  { value: "maintainer", label: "Maintainer" },
  { value: "super_admin", label: "Super admin" },
  { value: "admin", label: "Admin" },
  { value: "presenter", label: "Presenter" },
] as const;

const assignmentKey = (assignment: ApiRoleAssignment) =>
  `${assignment.role}-${assignment.scope}-${
    assignment.scope === "platform" ? "platform" : assignment.scopeId
  }`;

function UserRoleEditor({
  overview,
  pending,
  perform,
  updateRole,
  user,
}: {
  overview: AdminOverview;
  pending: boolean;
  perform: (operation: () => Promise<void>) => Promise<void>;
  updateRole: AdminPageProps["updateRole"];
  user: AdminOverview["users"][number];
}): React.JSX.Element {
  const [role, setRole] =
    useState<(typeof roleOptions)[number]["value"]>("maintainer");
  const [scopeId, setScopeId] = useState("");
  const assignment: ApiRoleAssignment =
    role === "super_admin" || role === "admin"
      ? {
          role,
          scope: "community",
          scopeId: scopeId || overview.communities[0]?.id || "",
        }
      : role === "presenter"
        ? {
            role,
            scope: "event",
            scopeId: scopeId || overview.events[0]?.id || "",
          }
        : { role, scope: "platform" };

  return (
    <section
      aria-label={`Roles for ${user.displayName}`}
      className="admin-role-editor"
    >
      <div className="admin-role-summary">
        {user.assignments.map((current) => (
          <span key={assignmentKey(current)}>
            {current.role}
            {current.scope === "platform" ? "" : ` · ${current.scopeId}`}
            {current.role !== "user" && (
              <button
                aria-label={`Revoke ${current.role} from ${user.displayName}`}
                disabled={pending}
                onClick={() =>
                  void perform(() => updateRole(user.id, "revoke", current))
                }
                type="button"
              >
                Remove
              </button>
            )}
          </span>
        ))}
      </div>
      <div className="admin-role-controls">
        <label className="ui-field">
          <span id={`role-${user.id}-label`}>Role for {user.displayName}</span>
          <Select
            onValueChange={(nextRole) => {
              setRole(nextRole as (typeof roleOptions)[number]["value"]);
              setScopeId("");
            }}
            value={role}
          >
            <SelectTrigger
              aria-labelledby={`role-${user.id}-label`}
              id={`role-${user.id}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        {(role === "super_admin" || role === "admin") && (
          <label className="ui-field">
            <span id={`role-scope-${user.id}-label`}>Community</span>
            <Select
              onValueChange={setScopeId}
              value={scopeId || overview.communities[0]?.id}
            >
              <SelectTrigger
                aria-labelledby={`role-scope-${user.id}-label`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {overview.communities.map((community) => (
                  <SelectItem key={community.id} value={community.id}>
                    {community.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        )}
        {role === "presenter" && (
          <label className="ui-field">
            <span id={`role-event-${user.id}-label`}>Event</span>
            <Select
              onValueChange={setScopeId}
              value={scopeId || overview.events[0]?.id}
            >
              <SelectTrigger aria-labelledby={`role-event-${user.id}-label`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {overview.events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        )}
        <button
          aria-label={`Grant role to ${user.displayName}`}
          disabled={
            pending ||
            ((assignment.scope === "community" ||
              assignment.scope === "event") &&
              !assignment.scopeId)
          }
          onClick={() =>
            void perform(() => updateRole(user.id, "grant", assignment))
          }
          type="button"
        >
          Grant role
        </button>
      </div>
    </section>
  );
}

function AdminSelect({
  defaultValue,
  id,
  label,
  name,
  options,
}: {
  defaultValue?: string;
  id: string;
  label: string;
  name: string;
  options: Array<{ label: string; value: string }>;
}): React.JSX.Element {
  return (
    <label className="ui-field">
      <span id={`${id}-label`}>{label}</span>
      <Select defaultValue={defaultValue ?? options[0]?.value} name={name}>
        <SelectTrigger aria-labelledby={`${id}-label`} id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

export function AdminPage({
  overview,
  createUser,
  updateUser,
  deleteUser,
  updateRole,
  createEvent,
  updateEvent,
  deleteEvent,
  createPost,
  updatePost,
  deletePost,
  createGroup,
  updateGroup,
  deleteGroup,
}: AdminPageProps): React.JSX.Element {
  const [section, setSection] = useState<AdminSection>("users");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const perform = async (operation: () => Promise<void>) => {
    setPending(true);
    setError("");
    try {
      await operation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Admin action failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="admin-page" aria-labelledby="admin-title">
      <header className="admin-heading">
        <div>
          <small>Root workspace</small>
          <h2 id="admin-title">Platform administration</h2>
          <p>Manage identities and community content with attributed, recoverable changes.</p>
        </div>
        <strong>{overview.users.length} users</strong>
      </header>

      <Tabs
        onValueChange={(value) => setSection(value as AdminSection)}
        value={section}
      >
      <TabsList className="admin-tabs" aria-label="Admin resources">
        {sectionOptions.map(({ id, label, icon: Icon }) => (
          <TabsTrigger
            className={section === id ? "active" : ""}
            key={id}
            value={id}
          >
            <Icon size={16} /> {label}
          </TabsTrigger>
        ))}
      </TabsList>
      {error && <div className="auth-error" role="alert">{error}</div>}

      <TabsContent value="users">
      {section === "users" && (
        <div className="admin-stack">
          <form
            className="admin-create"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void perform(() =>
                createUser({
                  displayName: value(form, "displayName"),
                  handle: value(form, "handle"),
                  email: value(form, "email"),
                }),
              );
            }}
          >
            <h3>Create invited user</h3>
            <label>Display name<Input aria-label="New user display name" name="displayName" required /></label>
            <label>Username<Input aria-label="New user username" name="handle" pattern="[a-z0-9_-]+" required /></label>
            <label>Email<Input aria-label="New user email" name="email" type="email" required /></label>
            <button disabled={pending}>Create invited user</button>
          </form>
          {overview.users.map((user) => (
            <form
              className="admin-row"
              key={user.id}
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const email = value(form, "email");
                void perform(() =>
                  updateUser(user.id, {
                    displayName: value(form, "displayName"),
                    ...(email ? { email } : {}),
                    handle: value(form, "handle"),
                    status: value(form, "status") as AdminUserUpdate["status"],
                  }),
                );
              }}
            >
              <label>Name<Input defaultValue={user.displayName} name="displayName" /></label>
              <label>Username<Input defaultValue={user.handle} name="handle" /></label>
              <label>Email<Input defaultValue={user.email ?? ""} name="email" type="email" /></label>
              <AdminSelect
                defaultValue={user.status}
                id={`user-status-${user.id}`}
                label="Status"
                name="status"
                options={[
                  { value: "active", label: "Active" },
                  { value: "invited", label: "Invited" },
                  { value: "disabled", label: "Disabled" },
                  { value: "revoked", label: "Revoked" },
                ]}
              />
              <UserRoleEditor
                overview={overview}
                pending={pending}
                perform={perform}
                updateRole={updateRole}
                user={user}
              />
              <footer>
                <button aria-label={`Save ${user.displayName}`} disabled={pending}>Save</button>
                <button
                  aria-label={`Revoke ${user.displayName}`}
                  className="admin-danger"
                  disabled={pending}
                  onClick={() => void perform(() => deleteUser(user.id))}
                  type="button"
                >
                  Revoke
                </button>
              </footer>
            </form>
          ))}
        </div>
      )}
      </TabsContent>

      <TabsContent value="events">
      {section === "events" && (
        <div className="admin-stack">
          <form
            className="admin-create"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void perform(() =>
                createEvent({
                  communityId: value(form, "communityId"),
                  slug: value(form, "slug"),
                  title: value(form, "title"),
                  description: value(form, "description"),
                  startsAt: isoFromLocal(value(form, "startsAt")),
                  endsAt: isoFromLocal(value(form, "endsAt")),
                  location: value(form, "location"),
                }),
              );
            }}
          >
            <h3>Create event</h3>
            <AdminSelect id="new-event-community" label="Community" name="communityId" options={overview.communities.map((community) => ({ label: community.name, value: community.id }))} />
            <label>Title<Input name="title" required /></label>
            <label>Slug<Input name="slug" required /></label>
            <label>Description<Textarea name="description" required /></label>
            <label>Starts<Input name="startsAt" type="datetime-local" required /></label>
            <label>Ends<Input name="endsAt" type="datetime-local" required /></label>
            <label>Location<Input name="location" required /></label>
            <button disabled={pending}>Create event</button>
          </form>
          {overview.events.map((item) => (
            <form
              className="admin-row"
              key={item.id}
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void perform(() =>
                  updateEvent(item.id, {
                    title: value(form, "title"),
                    description: value(form, "description"),
                    startsAt: isoFromLocal(value(form, "startsAt")),
                    endsAt: isoFromLocal(value(form, "endsAt")),
                    location: value(form, "location"),
                  }),
                );
              }}
            >
              <label>Title<Input defaultValue={item.title} name="title" /></label>
              <label>Description<Textarea defaultValue={item.description} name="description" /></label>
              <label>Starts<Input defaultValue={item.startsAt.slice(0, 16)} name="startsAt" type="datetime-local" /></label>
              <label>Ends<Input defaultValue={item.endsAt.slice(0, 16)} name="endsAt" type="datetime-local" /></label>
              <label>Location<Input defaultValue={item.location} name="location" /></label>
              <footer>
                <button aria-label={`Save ${item.title}`} disabled={pending}>Save</button>
                <button aria-label={`Delete ${item.title}`} className="admin-danger" onClick={() => void perform(() => deleteEvent(item.id))} type="button">Delete</button>
              </footer>
            </form>
          ))}
        </div>
      )}
      </TabsContent>

      <TabsContent value="posts">
      {section === "posts" && (
        <div className="admin-stack">
          <form
            className="admin-create"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void perform(() =>
                createPost({
                  communityId: value(form, "communityId"),
                  body: value(form, "body"),
                }),
              );
            }}
          >
            <h3>Create post</h3>
            <AdminSelect id="new-post-community" label="Community" name="communityId" options={overview.communities.map((community) => ({ label: community.name, value: community.id }))} />
            <label>Body<Textarea name="body" required /></label>
            <button disabled={pending}>Create post</button>
          </form>
          {overview.posts.map((item) => (
            <form
              className="admin-row"
              key={item.id}
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void perform(() => updatePost(item.id, { body: value(form, "body") }));
              }}
            >
              <label>Post body<Textarea defaultValue={item.body} name="body" /></label>
              <small>By {item.author.displayName}</small>
              <footer>
                <button aria-label={`Save post by ${item.author.displayName}`} disabled={pending}>Save</button>
                <button aria-label={`Delete post by ${item.author.displayName}`} className="admin-danger" onClick={() => void perform(() => deletePost(item.id))} type="button">Delete</button>
              </footer>
            </form>
          ))}
        </div>
      )}
      </TabsContent>

      <TabsContent value="groups">
      {section === "groups" && (
        <div className="admin-stack">
          <form
            className="admin-create"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void perform(() =>
                createGroup({
                  communityId: value(form, "communityId"),
                  slug: value(form, "slug"),
                  name: value(form, "name"),
                  description: value(form, "description"),
                  visibility: value(form, "visibility") as "public" | "private",
                }),
              );
            }}
          >
            <h3>Create group</h3>
            <AdminSelect id="new-group-community" label="Community" name="communityId" options={overview.communities.map((community) => ({ label: community.name, value: community.id }))} />
            <label>Name<Input name="name" required /></label>
            <label>Slug<Input name="slug" required /></label>
            <label>Description<Textarea name="description" required /></label>
            <AdminSelect
              id="new-group-visibility"
              label="Visibility"
              name="visibility"
              options={[
                { value: "public", label: "Public" },
                { value: "private", label: "Private" },
              ]}
            />
            <button disabled={pending}>Create group</button>
          </form>
          {overview.groups.map((item) => (
            <form
              className="admin-row"
              key={item.id}
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void perform(() =>
                  updateGroup(item.id, {
                    name: value(form, "name"),
                    slug: value(form, "slug"),
                    description: value(form, "description"),
                    visibility: value(form, "visibility") as "public" | "private",
                  }),
                );
              }}
            >
              <label>Name<Input defaultValue={item.name} name="name" /></label>
              <label>Slug<Input defaultValue={item.slug} name="slug" /></label>
              <label>Description<Textarea defaultValue={item.description} name="description" /></label>
              <AdminSelect
                defaultValue={item.visibility}
                id={`group-visibility-${item.id}`}
                label="Visibility"
                name="visibility"
                options={[
                  { value: "public", label: "Public" },
                  { value: "private", label: "Private" },
                ]}
              />
              <footer>
                <button aria-label={`Save ${item.name}`} disabled={pending}>Save</button>
                <button aria-label={`Delete ${item.name}`} className="admin-danger" onClick={() => void perform(() => deleteGroup(item.id))} type="button">Delete</button>
              </footer>
            </form>
          ))}
        </div>
      )}
      </TabsContent>
      </Tabs>
    </section>
  );
}
