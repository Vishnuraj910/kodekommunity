# Kommunity

A privacy-first community product prototype built from the supplied Kommunity
product specification. It includes the complete responsive product shell:
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

Requirements: Node.js 20+ and pnpm 11+.

```bash
pnpm install
pnpm dev
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173).

No environment variables or external services are needed for the local
experience. Interactive state is stored in the browser and can be reset from
DevTools by clearing local storage.

## Verification

```bash
pnpm typecheck
pnpm build
```

## Dependency safety

`pnpm-workspace.yaml` sets `minimumReleaseAge: 10080`, so pnpm will not resolve a
direct or transitive release until it has been public for seven days. Strict mode
is enabled and registry metadata without publish timestamps is rejected.

## Production integrations

`.env.example` lists the optional OAuth, email, database, object-storage, and
signing values intended for the production backend. They are not read by this
standalone local product demo.
