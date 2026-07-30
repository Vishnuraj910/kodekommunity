# Kommunity

A privacy-first community application built from the supplied Kommunity
product specification. It includes a responsive React client and a local
Fastify, Prisma, and PostgreSQL backend for:

- authenticated development identities and multi-role access
- tenant-aware communities, events, RSVPs, conversations, and messages
- root-only idempotent role changes with attributed audit records
- validated OpenAPI contracts and live/readiness health checks

The product shell also includes:
community discovery, groups, events and RSVP state, connections, conversations,
notifications, onboarding, profile/privacy settings, dark mode, and local
persistence.

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
# Edit server/.env and replace YOUR_LOCAL_USER with your PostgreSQL role.
pnpm db:migrate
pnpm db:seed
pnpm dev:all
```

Open the app at [http://127.0.0.1:4173](http://127.0.0.1:4173), the API
documentation at [http://127.0.0.1:8787/docs](http://127.0.0.1:8787/docs), and
the readiness check at
[http://127.0.0.1:8787/api/v1/health/ready](http://127.0.0.1:8787/api/v1/health/ready).

No third-party API keys are required for local development. The
`x-kommunity-user-id` development identity selector is enabled only when
`ALLOW_DEMO_AUTH=true`; configuration validation rejects it in production.
Preferences and non-sensitive preview state use versioned, validated local
storage. Private message previews use session storage and expire after eight
hours. Settings provides a confirmed action to remove all Kommunity-owned
browser storage and offline caches.

RSVPs, messages, role assignments, and audit events are persisted in
PostgreSQL. The client role switcher remains a permission-preview tool; the
server always authorizes against the authenticated database identity and never
trusts the selected preview role.

## Verification

```bash
pnpm typecheck
pnpm test:all
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

## Production integrations

`.env.example` documents the local server settings and optional future OAuth,
email, object-storage, and signing values. Third-party values must be loaded
server-side from a managed secret store in production.
