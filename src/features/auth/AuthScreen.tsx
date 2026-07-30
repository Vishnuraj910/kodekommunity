import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Input } from "../../components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";

type LoginInput = {
  identifier: string;
  password: string;
};

type RegistrationInput = {
  displayName: string;
  email: string;
  password: string;
};

type RegistrationResult =
  | { status: "authenticated" }
  | { status: "verification_required"; username: string };

export function AuthScreen({
  onLocalLogin,
  onLocalRegister,
  onOidc,
}: {
  onLocalLogin: (input: LoginInput) => Promise<void>;
  onLocalRegister: (input: RegistrationInput) => Promise<RegistrationResult>;
  onOidc: () => void;
}): React.JSX.Element {
  const [localOpen, setLocalOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("verified") === "1"
      ? "Email verified. You can now log in."
      : null,
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      if (mode === "login") {
        await onLocalLogin({
          identifier: identifier.trim().toLowerCase(),
          password,
        });
      } else {
        const result = await onLocalRegister({
          displayName: displayName.trim(),
          email: identifier.trim().toLowerCase(),
          password,
        });
        if (result.status === "verification_required") {
          setMode("login");
          setPassword("");
          setSuccess(
            `Check your email to activate your account. Your username is @${result.username}.`,
          );
        }
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Authentication could not be completed",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <main
      aria-busy={pending}
      className={`auth-shell${pending ? " authenticating" : ""}`}
    >
      <section className="auth-story" aria-label="About Kommunity">
        <div className="auth-brand">
          <span className="auth-brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <strong>kommunity</strong>
        </div>
        <div className="auth-story-copy">
          <span className="eyebrow">A network built around belonging</span>
          <h1>Find your people.<br />Build what matters.</h1>
          <p>
            Join thoughtful communities, share useful work, and keep the
            conversations that move ideas forward in one calm place.
          </p>
        </div>
        <div className="auth-trust-note">
          <ShieldCheck size={18} />
          <span>
            <strong>Privacy-first identity</strong>
            <small>Your email is never shown to other members.</small>
          </span>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <span className="auth-card-icon" aria-hidden="true">
            <Sparkles size={20} />
          </span>
          <div>
            <span className="eyebrow">Welcome to Kommunity</span>
            <h2>Continue to your network</h2>
            <p>
              Your organization’s identity provider is the safest and quickest
              way to sign in or create an account.
            </p>
          </div>

          <button className="auth-oidc-button" type="button" onClick={onOidc}>
            Continue with OIDC <ArrowRight size={18} />
          </button>
          <small className="auth-preferred-label">
            Preferred · single sign-on with PKCE
          </small>

          {!localOpen ? (
            <button
              className="auth-local-disclosure"
              type="button"
              onClick={() => setLocalOpen(true)}
            >
              <KeyRound size={16} /> Use email and password
            </button>
          ) : (
            <div className="auth-local">
              <Tabs
                onValueChange={(value) =>
                  setMode(value as "login" | "register")
                }
                value={mode}
              >
              <TabsList className="auth-tabs" aria-label="Local account">
                <TabsTrigger
                  className={mode === "login" ? "active" : ""}
                  value="login"
                >
                  Log in
                </TabsTrigger>
                <TabsTrigger
                  className={mode === "register" ? "active" : ""}
                  value="register"
                >
                  Register
                </TabsTrigger>
              </TabsList>
              <TabsContent key={mode} value={mode}>
              <form onSubmit={submit}>
                {mode === "register" && (
                  <>
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
                  </>
                )}
                <label>
                  {mode === "login" ? "Email or username" : "Email address"}
                  <Input
                    autoComplete={mode === "login" ? "username" : "email"}
                    inputMode={mode === "login" ? undefined : "email"}
                    maxLength={320}
                    required
                    type={mode === "login" ? "text" : "email"}
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                  />
                </label>
                <label htmlFor="local-password">Password</label>
                <div className="auth-password-field">
                  <Input
                    id="local-password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    maxLength={128}
                    minLength={mode === "register" ? 12 : 1}
                    required
                    type={passwordVisible ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    aria-label={
                      passwordVisible ? "Hide password" : "Show password"
                    }
                    aria-pressed={passwordVisible}
                    onClick={() => setPasswordVisible((visible) => !visible)}
                    type="button"
                  >
                    {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {mode === "register" && (
                  <small className="auth-password-guidance">
                    Use at least 12 characters. Long, unique passphrases work
                    best.
                  </small>
                )}
                {error && <div className="auth-error" role="alert">{error}</div>}
                {success && (
                  <div className="auth-success" role="status">
                    {success}
                  </div>
                )}
                <button
                  className="auth-submit"
                  disabled={pending}
                  type="submit"
                >
                  {pending
                    ? mode === "login"
                      ? "Opening your network…"
                      : "Creating your account…"
                    : mode === "login"
                      ? "Log in"
                      : "Create account"}
                </button>
              </form>
              <button
                className="auth-local-close"
                type="button"
                onClick={() => setLocalOpen(false)}
              >
                Back to preferred sign-in
              </button>
              </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
