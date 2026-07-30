import {
  AtSign,
  Laptop,
  LogOut,
  Mail,
  Moon,
  Save,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { useState } from "react";
import type { ApiRoleAssignment } from "../../../server/src/schemas/api.ts";
import { Input } from "../../components/ui/input";
import {
  RadioGroup,
  RadioGroupItem,
} from "../../components/ui/radio-group";

type ProfileIdentity = {
  displayName: string;
  email: string;
  username: string;
};

type Theme = "light" | "dark";
type ThemePreference = Theme | "system";

const roleLabel = (assignment: ApiRoleAssignment) => {
  const role = assignment.role.replace("_", " ");
  return `${role} · ${assignment.scope}`;
};

export function ProfilePage({
  assignments,
  identity,
  onSave,
  onSignOut,
  onThemeChange,
  theme,
  themePreference,
}: {
  assignments: ApiRoleAssignment[];
  identity: ProfileIdentity;
  onSave: (input: {
    displayName: string;
    username: string;
  }) => Promise<void>;
  onSignOut: () => Promise<void>;
  onThemeChange: (preference: ThemePreference) => void;
  theme: Theme;
  themePreference: ThemePreference;
}): React.JSX.Element {
  const [displayName, setDisplayName] = useState(identity.displayName);
  const [username, setUsername] = useState(identity.username);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    try {
      await onSave({
        displayName: displayName.trim(),
        username: username.trim().toLowerCase(),
      });
      setMessage("Your profile has been updated.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Profile could not be saved",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="account-page" aria-labelledby="account-details-heading">
      <div className="account-summary">
        <span className="account-avatar" aria-hidden="true">
          {identity.displayName
            .split(/\s+/u)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase()}
        </span>
        <div>
          <h2 id="account-details-heading">Account details</h2>
          <p>Manage how your name and username appear across Kommunity.</p>
        </div>
      </div>

      <form className="account-form" onSubmit={submit}>
        <label>
          Display name
          <Input
            autoComplete="name"
            maxLength={120}
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        <label>
          Username
          <span className="account-input-with-icon">
            <AtSign aria-hidden="true" size={17} />
            <Input
              autoComplete="username"
              maxLength={32}
              minLength={3}
              pattern="[a-z0-9_-]+"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </span>
        </label>
        <label>
          Email address
          <span className="account-input-with-icon">
            <Mail aria-hidden="true" size={17} />
            <Input readOnly type="email" value={identity.email} />
          </span>
          <small>
            Email changes require a new verification flow and are currently
            managed by support.
          </small>
        </label>
        {message && (
          <div className="account-message" role="status">
            {message}
          </div>
        )}
        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}
        <button className="account-save" disabled={pending} type="submit">
          <Save size={17} />
          {pending ? "Saving…" : "Save profile"}
        </button>
      </form>

      <section
        className="account-preferences"
        aria-labelledby="account-appearance-heading"
      >
        <div>
          <h3 id="account-appearance-heading">Appearance</h3>
          <p>
            Use your device theme automatically or keep a theme until you
            change it.
          </p>
        </div>
        <RadioGroup
          aria-label="Theme preference"
          className="theme-preference"
          onValueChange={(value) => onThemeChange(value as ThemePreference)}
          value={themePreference}
        >
          {([
            ["system", "System", Laptop],
            ["light", "Light", Sun],
            ["dark", "Dark", Moon],
          ] as const).map(([value, label, Icon]) => (
            <label key={value}>
              <RadioGroupItem
                aria-label={label}
                id={`theme-preference-${value}`}
                value={value}
              />
              <Icon aria-hidden="true" size={18} />
              <span>{label}</span>
            </label>
          ))}
        </RadioGroup>
        <small aria-live="polite">
          {themePreference === "system"
            ? `Following this device · currently ${theme}`
            : `${theme === "dark" ? "Dark" : "Light"} theme selected`}
        </small>
      </section>

      <section className="account-roles" aria-labelledby="account-roles-heading">
        <div>
          <ShieldCheck aria-hidden="true" size={19} />
          <h3 id="account-roles-heading">Your roles</h3>
        </div>
        <ul>
          {assignments.map((assignment) => (
            <li
              key={`${assignment.role}:${assignment.scope}:${
                "scopeId" in assignment ? assignment.scopeId : "platform"
              }`}
            >
              {roleLabel(assignment)}
            </li>
          ))}
        </ul>
      </section>
      <button className="account-signout" onClick={onSignOut} type="button">
        <LogOut size={17} />
        Sign out
      </button>
    </section>
  );
}
