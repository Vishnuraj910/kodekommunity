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

type AdminSection = "users" | "events" | "posts" | "groups";

type AdminPageProps = {
  overview: AdminOverview;
  createUser: (input: AdminUserCreate) => Promise<void>;
  updateUser: (userId: string, input: AdminUserUpdate) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
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

      <div className="admin-tabs" role="tablist" aria-label="Admin resources">
        {sectionOptions.map(({ id, label, icon: Icon }) => (
          <button
            aria-selected={section === id}
            className={section === id ? "active" : ""}
            key={id}
            onClick={() => setSection(id)}
            role="tab"
            type="button"
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
      {error && <div className="auth-error" role="alert">{error}</div>}

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
              <div className="admin-role-summary">
                {user.assignments.map((assignment) => (
                  <span key={`${assignment.role}-${assignment.scope}-${"scopeId" in assignment ? assignment.scopeId : "platform"}`}>
                    {assignment.role}
                    {assignment.scope === "platform" ? "" : ` · ${assignment.scopeId}`}
                  </span>
                ))}
              </div>
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
    </section>
  );
}
