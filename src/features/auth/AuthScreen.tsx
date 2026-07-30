import { ArrowRight, KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";

type LoginInput = {
  email: string;
  password: string;
};

type RegistrationInput = LoginInput & {
  displayName: string;
  handle: string;
};

export function AuthScreen({
  onLocalLogin,
  onLocalRegister,
  onOidc,
}: {
  onLocalLogin: (input: LoginInput) => Promise<void>;
  onLocalRegister: (input: RegistrationInput) => Promise<void>;
  onOidc: () => void;
}): React.JSX.Element {
  const [localOpen, setLocalOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const credentials = {
        email: email.trim().toLowerCase(),
        password,
      };
      if (mode === "login") {
        await onLocalLogin(credentials);
      } else {
        await onLocalRegister({
          ...credentials,
          displayName: displayName.trim(),
          handle: handle.trim().toLowerCase(),
        });
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
    <main className="auth-shell">
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
              <div className="auth-tabs" role="tablist" aria-label="Local account">
                <button
                  className={mode === "login" ? "active" : ""}
                  type="button"
                  role="tab"
                  aria-selected={mode === "login"}
                  onClick={() => setMode("login")}
                >
                  Log in
                </button>
                <button
                  className={mode === "register" ? "active" : ""}
                  type="button"
                  role="tab"
                  aria-selected={mode === "register"}
                  onClick={() => setMode("register")}
                >
                  Register
                </button>
              </div>
              <form onSubmit={submit}>
                {mode === "register" && (
                  <>
                    <label>
                      Display name
                      <input
                        autoComplete="name"
                        maxLength={120}
                        required
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                      />
                    </label>
                    <label>
                      Handle
                      <input
                        autoComplete="username"
                        maxLength={32}
                        minLength={3}
                        pattern="[a-zA-Z0-9_]+"
                        required
                        value={handle}
                        onChange={(event) => setHandle(event.target.value)}
                      />
                    </label>
                  </>
                )}
                <label>
                  Email address
                  <input
                    autoComplete="email"
                    inputMode="email"
                    maxLength={320}
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                <label>
                  Password
                  <input
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    maxLength={128}
                    minLength={mode === "register" ? 12 : 1}
                    required
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                {mode === "register" && (
                  <small className="auth-password-guidance">
                    Use at least 12 characters. Long, unique passphrases work
                    best.
                  </small>
                )}
                {error && <div className="auth-error" role="alert">{error}</div>}
                <button
                  className="auth-submit"
                  disabled={pending}
                  type="submit"
                >
                  {pending
                    ? "Please wait…"
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
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
