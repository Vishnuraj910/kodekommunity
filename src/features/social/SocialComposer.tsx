import {
  CalendarClock,
  Hash,
  MessageSquareText,
  Radio,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

type ComposerKind = "post" | "group" | "broadcast" | "channel";

type SocialComposerProps = {
  canManageCommunity: boolean;
  onClose: () => void;
  onCreatePost: (input: { body: string }) => Promise<void>;
  onCreateGroup: (input: {
    description: string;
    name: string;
    slug: string;
    visibility: "public" | "private";
  }) => Promise<void>;
  onCreateBroadcast: (input: {
    body: string;
    startsAt?: string;
    title: string;
  }) => Promise<void>;
  onCreateChannel: (input: {
    description: string;
    participantIds: string[];
    slug: string;
    title: string;
    visibility: "public" | "private";
  }) => Promise<void>;
};

const managedKinds: Array<{
  id: ComposerKind;
  label: string;
  icon: typeof MessageSquareText;
}> = [
  { id: "post", label: "Post", icon: MessageSquareText },
  { id: "group", label: "Group", icon: UsersRound },
  { id: "broadcast", label: "Broadcast", icon: Radio },
  { id: "channel", label: "Channel", icon: Hash },
];

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

export function SocialComposer({
  canManageCommunity,
  onClose,
  onCreateBroadcast,
  onCreateChannel,
  onCreateGroup,
  onCreatePost,
}: SocialComposerProps): React.JSX.Element {
  const [kind, setKind] = useState<ComposerKind>("post");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [body, setBody] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [participantIds, setParticipantIds] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const availableKinds = canManageCommunity
    ? managedKinds
    : managedKinds.slice(0, 1);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (kind === "post") {
        await onCreatePost({ body: body.trim() });
      } else if (kind === "group") {
        await onCreateGroup({
          description: body.trim(),
          name: title.trim(),
          slug: slug || slugify(title),
          visibility,
        });
      } else if (kind === "broadcast") {
        await onCreateBroadcast({
          body: body.trim(),
          startsAt: startsAt
            ? new Date(startsAt).toISOString()
            : undefined,
          title: title.trim(),
        });
      } else {
        await onCreateChannel({
          description: body.trim(),
          participantIds: participantIds
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean),
          slug: slug || slugify(title),
          title: title.trim(),
          visibility,
        });
      }
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The request could not be completed",
      );
    } finally {
      setPending(false);
    }
  };

  const actionLabel =
    kind === "post"
      ? "Publish post"
      : kind === "group"
        ? "Create group"
        : kind === "broadcast"
          ? startsAt
            ? "Schedule broadcast"
            : "Save broadcast draft"
          : "Create channel";

  return (
    <div className="modal-backdrop social-composer-backdrop" onMouseDown={onClose}>
      <section
        aria-labelledby="social-composer-title"
        aria-modal="true"
        className="social-composer"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header>
          <div>
            <span className="eyebrow">Create in KodeKommunity</span>
            <h2 id="social-composer-title">Start something useful</h2>
          </div>
          <button aria-label="Close composer" onClick={onClose} type="button">
            <X size={19} />
          </button>
        </header>

        <div className="social-composer-tabs" role="tablist" aria-label="Create">
          {availableKinds.map((item) => (
            <button
              aria-selected={kind === item.id}
              className={kind === item.id ? "active" : ""}
              key={item.id}
              onClick={() => {
                setKind(item.id);
                setError(null);
              }}
              role="tab"
              type="button"
            >
              <item.icon size={16} /> {item.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit}>
          {kind !== "post" && (
            <label>
              {kind === "broadcast"
                ? "Broadcast title"
                : kind === "group"
                  ? "Group name"
                  : "Channel name"}
              <input
                maxLength={kind === "broadcast" ? 160 : 120}
                required
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  if (kind === "group" || kind === "channel") {
                    setSlug(slugify(event.target.value));
                  }
                }}
              />
            </label>
          )}

          {(kind === "group" || kind === "channel") && (
            <label>
              Slug
              <input
                maxLength={80}
                minLength={3}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
                value={slug}
                onChange={(event) => setSlug(slugify(event.target.value))}
              />
            </label>
          )}

          <label>
            {kind === "post"
              ? "Post body"
              : kind === "broadcast"
                ? "Broadcast details"
                : "Description"}
            <textarea
              autoFocus
              maxLength={kind === "post" ? 10_000 : 5_000}
              required
              rows={kind === "post" ? 7 : 5}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>

          {kind === "broadcast" && (
            <label>
              <span><CalendarClock size={15} /> Starts at</span>
              <input
                min={new Date().toISOString().slice(0, 16)}
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </label>
          )}

          {(kind === "group" || kind === "channel") && (
            <label>
              Visibility
              <select
                value={visibility}
                onChange={(event) =>
                  setVisibility(event.target.value as "public" | "private")
                }
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </label>
          )}

          {kind === "channel" && (
            <label>
              Participant user IDs
              <input
                placeholder="maya, jon"
                value={participantIds}
                onChange={(event) => setParticipantIds(event.target.value)}
              />
              <small>Comma-separated active members. You are added automatically.</small>
            </label>
          )}

          {error && <div className="auth-error" role="alert">{error}</div>}
          <footer>
            <button className="button button-secondary button-md" onClick={onClose} type="button">
              Cancel
            </button>
            <button
              className="button button-primary button-md"
              disabled={pending}
              type="submit"
            >
              {pending ? "Working…" : actionLabel}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
