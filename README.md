# Kommunity

A privacy-first community application built from the supplied Kommunity
product specification. It includes a responsive React client and a local
Fastify, Prisma, and PostgreSQL backend for:

- preferred OIDC login/registration with local email/password fallback
- multi-role, tenant-aware communities, groups, posts, broadcasts, events,
  channels, direct conversations, and live messages
- root-only idempotent role changes with attributed audit records
- validated OpenAPI contracts and live/readiness health checks

The React client is backed by the API rather than browser demo records. It
includes responsive light/dark layouts, an administrative creation composer,
real-time chat with reconnection and duplicate suppression, and a working emoji
picker.

## Roles and access

Users have a list of scoped role assignments rather than one global role:

- `root` — platform administrator
- `maintainer` — platform maintainer
- `super_admin` — primary owner of a specific community
- `admin` — administrator of a specific community
- `presenter` — presenter for a specific event
- `user` — baseline regular user

The access-control screen supports multiple simultaneous roles per user.
Platform roles apply globally; community and event roles carry a required scope
identifier. The baseline `user` role and the final `root` assignment cannot be
removed.

Root and maintainer accounts also receive a floating role switcher. It can
preview the combined permission set or one assigned, scope-aware role at a time
without changing the user's stored assignments.

## Run locally

Requirements:

- Node.js 22.6+
- pnpm 11+ (the repository pins pnpm 11.15.1)
- PostgreSQL 16 running locally

```bash
pnpm install
createdb -h 127.0.0.1 -p 5432 kommunity_dev
cp .env.example server/.env
# Edit DATABASE_URL and SEED_COMMON_PASSWORD in server/.env.
# Uncomment all four OIDC connection values to enable preferred OIDC login.
pnpm db:migrate
pnpm db:seed
pnpm dev:all
```

Open the app at [http://127.0.0.1:4173](http://127.0.0.1:4173), the API
documentation at [http://127.0.0.1:8787/docs](http://127.0.0.1:8787/docs), and
the readiness check at
[http://127.0.0.1:8787/api/v1/health/ready](http://127.0.0.1:8787/api/v1/health/ready).

No third-party key is required for local email/password development:
`EMAIL_VERIFICATION_MODE=auto` activates a new account immediately. Production
configuration rejects that bypass and requires email verification. OIDC is the
preferred UI path when configured; email/password remains available as a
secondary disclosure. The `x-kommunity-user-id` selector is an opt-in local
testing facility enabled only when `ALLOW_DEMO_AUTH=true`; startup validation
rejects it in production.

Credentials use parameterized scrypt with a unique salt. Email-verification
links use single-use random tokens; only their SHA-256 hashes, expiry, and
consumption time are persisted. Sessions use opaque tokens whose hashes, expiry,
and revocation state are persisted in PostgreSQL; the browser receives only an
HttpOnly, SameSite cookie. OIDC uses Authorization Code with PKCE, state, nonce,
verified email, exact issuer validation, a browser-bound HttpOnly flow cookie,
and a one-time flow record. Admin-created invitations are claimed through the
same registration form; production still requires the invited mailbox to
complete email verification before login. The role
switcher remains a preview tool—the server always authorizes the authenticated
database identity and object scope.

## Verification

```bash
pnpm typecheck
pnpm test:all
pnpm test:coverage
pnpm build:all
pnpm db:status
```

## Dependency safety

`pnpm-workspace.yaml` sets `minimumReleaseAge: 10080`, so pnpm will not resolve a
direct or transitive release until it has been public for seven days. Strict mode
is enabled, direct dependency versions are pinned, and registry metadata without
publish timestamps is rejected.

## Security

[SECURITY.md](SECURITY.md) contains the threat model, ranked findings,
implemented browser controls, required negative cases, and production blockers.
This local backend must not process real production credentials or regulated
data until production authentication, session revocation, storage isolation,
retention, recovery, and secret-management controls are implemented.

Run the production dependency audit with:

```bash
pnpm security:audit
```

## Email verification and API keys

Production password registration sends verification links through Resend:

1. Create a Resend account and API key in the Resend dashboard. Put the key in
   the server-only `RESEND_API_KEY` value; never prefix it with `VITE_`.
2. Add and verify a sending domain in Resend, including the DNS records it
   supplies.
3. Set `EMAIL_FROM` to an address on that verified domain, for example
   `Kommunity <verify@community.example>`.
4. Set `EMAIL_VERIFICATION_MODE=email`, `API_PUBLIC_URL` to the public HTTPS API
   origin, and `CLIENT_ORIGIN` to the public HTTPS web origin.

`EMAIL_VERIFICATION_TTL_HOURS` defaults to 24. In local development, retain
`EMAIL_VERIFICATION_MODE=auto`; `RESEND_API_KEY` and `EMAIL_FROM` are then not
needed and registration activates the account immediately.

## OIDC configuration

OIDC requires a generic confidential-client ID and secret:

1. In your organization’s identity-provider console, create an **OIDC web
   application** (sometimes called a confidential web client).
2. Add the exact development redirect URI
   `http://127.0.0.1:8787/api/v1/auth/oidc/callback`. For production, add the
   equivalent HTTPS API callback and set `OIDC_REDIRECT_URI` to that exact URL.
3. Copy the provider’s issuer URL (the base URL whose
   `/.well-known/openid-configuration` document is available) into
   `OIDC_ISSUER_URL`.
4. Copy the generated client ID and client secret into `OIDC_CLIENT_ID` and
   `OIDC_CLIENT_SECRET`. Keep the secret server-side; never use a `VITE_`
   prefix.
5. Leave `OIDC_SCOPES=openid profile email` unless the provider requires an
   additional organization-specific scope. The provider must return a verified
   email, name, issuer, and subject.

All four OIDC connection values must be supplied together. They are commented
out by default so local email/password authentication works immediately;
uncomment all four to enable OIDC. Production secrets should come from a
managed secret store rather than a committed `.env` file.

## Seed accounts

`pnpm db:seed` requires `SEED_COMMON_PASSWORD` in `server/.env`. The idempotent
seed creates realistic communities, groups, posts, broadcasts, events,
channels, direct conversations, and messages, plus at least two users for every
supported role. All seeded active users accept the same local password; only
salted hashes are stored.
