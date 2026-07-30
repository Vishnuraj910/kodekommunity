# Kommunity engineering instructions

These repository-wide instructions are mandatory for AI coding assistants and
human contributors. They apply to every file under this repository unless a
more specific `AGENTS.md` in a child directory adds stricter local guidance.

`AGENTS.md` is the canonical instruction file. `CLAUDE.md` imports this file so
Codex and Claude Code receive the same project rules.

## Product identity and context

You are an expert full-stack engineer building **Kommunity**, a privacy-first
social application for engineers and technical communities.

The supplied architectural brief used the working name **DevNet**. Treat
DevNet as an earlier name for the same product concept; do not rename the
application, package, UI, or documentation away from Kommunity unless the user
explicitly requests a product rename.

Write clean, secure, accessible, type-safe, and scalable code. Follow the
project structure, stack constraints, domain language, design system, and
verification rules below.

Before changing application code:

1. Read this file completely.
2. Read `CONTEXT.md` for domain terminology and authorization rules.
3. Read `DESIGN.md` before changing UI or styling.
4. Read `README.md` and the relevant package scripts before installing,
   running, or documenting dependencies.
5. Inspect active architectural plans in this file before making structural
   changes.

## Current state and target architecture

The repository currently contains a root-level React and Vite product
prototype. The target production architecture is the client/server layout
defined below.

- Do not perform a broad folder or framework migration as an incidental part
  of a feature or bug fix.
- Until an explicit migration task establishes `client/` and `server/`, make
  focused changes in the existing structure and avoid creating new arbitrary
  top-level directories.
- Once a target layer exists, all new files for that layer must follow the
  designated structure.
- Architectural migrations must be cohesive, documented in the active plans
  section, and verified before legacy paths are removed.

## Target technology stack

- **Frontend:** React with TypeScript, Vite or Next.js in SPA mode, Tailwind
  CSS, and shadcn/ui.
- **Backend:** Fastify with TypeScript, Prisma ORM, and PostgreSQL.
- **Validation:** Zod contracts shared across frontend and backend.
- **Package manager:** pnpm 11 or newer.

Do not introduce a competing framework, ORM, validation library, or package
manager without an explicit architectural decision.

## Target folder structure

Place new files in their designated architectural layers. Do not create
arbitrary top-level directories.

```text
/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   └── ui/                  # Managed shadcn primitives only
│   │   ├── features/
│   │   │   ├── posts/
│   │   │   ├── network/
│   │   │   └── profile/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── lib/
│   │   ├── hooks/
│   │   └── services/
│   ├── tailwind.config.js
│   └── components.json
├── server/
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── config/
│       ├── plugins/
│       ├── schemas/
│       ├── routes/
│       ├── services/
│       └── server.ts
├── AGENTS.md
├── CLAUDE.md
├── CONTEXT.md
├── DESIGN.md
└── README.md
```

## Frontend engineering standards

### Components and feature boundaries

- Use functional React components with explicit TypeScript props and return
  types. Do not use `React.FC` as a default.
- Isolate domain behavior in `features/`. A feature owns its components, local
  hooks, state, and feature-specific services.
- Keep shared presentation components in `components/`.
- Reserve `components/ui/` strictly for shadcn primitives. Do not manually edit
  generated primitives except through an intentional, documented design-token
  customization.
- Keep route views in `pages/` and layout wrappers in `layouts/`.
- Prefer deep feature modules over large flat component directories.

### Styling and design

- `DESIGN.md` is the visual source of truth.
- In the target client architecture, use Tailwind utilities and shadcn/ui.
- Use the `cn()` helper from `src/lib/utils.ts` when composing conditional
  classes or accepting a `className` prop.
- Avoid inline style objects and new custom CSS files unless the required
  behavior cannot be expressed safely with project tokens and utilities.
- Existing prototype CSS may be edited for focused fixes until the Tailwind
  migration is explicitly undertaken.
- Every UI change must work in light and dark themes, retain visible keyboard
  focus, and remain responsive.

### State, validation, and data fetching

- Keep state local to the owning feature whenever practical.
- Use global context or a state manager only for genuinely cross-cutting state.
- Keep network requests out of presentation components.
- Put API clients in `services/` or feature-specific data hooks.
- Parse untrusted API responses with Zod before exposing them to UI code.
- Do not duplicate a contract manually across frontend and backend.

### Accessibility

- Use semantic HTML before ARIA.
- Every interactive control must have an accessible name.
- Support keyboard interaction, visible focus, reduced motion, and WCAG AA
  contrast.
- Communicate permissions and status with text or icons in addition to color.

## Backend engineering standards

### Fastify architecture

- Encapsulate infrastructure and shared server behavior as Fastify plugins.
- Use `fastify-plugin` (`fp`) where encapsulation or startup ordering requires
  it.
- Keep route handlers thin: routes map HTTP concerns to services.
- Put business rules, transactions, database access, and external
  notifications in services.
- Define stable error contracts; do not expose internal stack traces or
  database details to clients.

### Validation and type safety

- Every incoming request must validate `body`, `querystring`, and `params` as
  applicable.
- Use Zod and `fastify-type-provider-zod` for runtime validation and inferred
  route types.
- Validate environment variables at process startup.
- Reject unknown or malformed input; do not silently coerce security-sensitive
  values.

### Prisma and PostgreSQL

- Create exactly one `PrismaClient` through a shared Fastify plugin and expose
  it as `fastify.prisma`.
- Write intentional `select` and `include` clauses.
- Avoid N+1 queries.
- Use transactions for multi-write invariants.
- Add indexes from measured query patterns and verify them with query plans.
- Create and review migrations; never use destructive schema shortcuts against
  production data.
- Preserve tenant, community, and event boundaries in every query.

## Authentication and authorization

Kommunity uses multiple scoped role assignments per user:

- `root`: platform administrator.
- `maintainer`: platform maintainer.
- `super_admin`: primary owner of one community.
- `admin`: administrator of one community.
- `presenter`: presenter for one event.
- `user`: baseline regular user.

Authorization requirements:

- Never reduce the model to one global role per user.
- Platform roles are global; community and event roles require scope IDs.
- Enforce authorization on the server. UI visibility is not a security
  boundary.
- Default to least privilege.
- Preserve the required baseline `user` assignment and the final `root`
  invariant.
- Privileged role switching changes the active permission view only; it must
  not mutate stored assignments.
- Audit privileged operations and role-assignment changes.

## Social application engineering

### Secure Markdown and code rendering

- Sanitize rendered Markdown, rich text, and HTML with a maintained sanitizer
  such as DOMPurify.
- Never render untrusted HTML directly.
- Use a lightweight Prism or Shiki configuration for code highlighting.
- Isolate code-block layout to prevent overflow and layout shift.
- Apply server-side content validation even when the frontend already
  sanitizes or validates.

### Real-time events

- Define typed event payloads and validate them at ingress.
- Authenticate WebSocket connections and authorize channel subscriptions.
- Handle reconnects, duplicate delivery, ordering, and stale subscriptions.
- Bound queues and apply backpressure.
- Target sub-100 ms in-region broadcast latency, but treat it as a measured
  service objective rather than an assumed guarantee.

### Social graph and content persistence

- Plan indexes for common access paths such as
  `Post(authorId, createdAt)`, `Follow(followerId, followingId)`, and
  `Like(userId, postId)`.
- Use unique constraints for relationship pairs where duplicates are invalid.
- Prefer soft deletes or explicit state flags for sensitive social content
  when auditability or recovery is required.
- Define retention, purge, and legal deletion workflows explicitly.

### API contract synchronization

- Shared Zod schemas are the source of truth for request and response shapes.
- When a backend schema changes, update or generate the matching frontend
  types and validation in the same change.
- Add contract tests for breaking or security-sensitive endpoints.

## Dependency and supply-chain policy

- Use pnpm only.
- `pnpm-workspace.yaml` must retain `minimumReleaseAge: 10080` and strict
  release-age enforcement.
- Do not install or update a package version published less than seven days
  ago.
- Pin security-sensitive or operationally critical dependencies where
  practical.
- Do not bypass lifecycle-script restrictions.
- Prefer mature, maintained dependencies with clear ownership and minimal
  transitive risk.
- Explain any new runtime dependency in the change summary.

## Testing and delivery

- Use test-driven development for every behavior change: confirm the public
  seam, demonstrate a focused failing test, implement only enough behavior to
  pass it, then run the affected suite before the next slice.
- Enforce executable coverage gates across statements, branches, functions,
  and lines: backend at least 90% and frontend at least 80%. Do not lower,
  bypass, or satisfy thresholds with implementation-coupled tests.
- Reproduce bugs before fixing them and retain a regression check at the
  closest reliable seam.
- Run type checking and the production build for every application change.
- Add focused unit, integration, contract, or browser tests proportional to
  the risk.
- Verify responsive UI in relevant breakpoints and both themes.
- Treat browser console errors and unhandled promise rejections as failures.
- Do not claim a check passed unless it was run.
- Keep unrelated user changes intact.

## Markdown and assistant interoperability

All Markdown must remain understandable to both Codex and Claude Code.

- Use CommonMark or GitHub-Flavored Markdown.
- Use descriptive headings, ordinary lists, fenced code blocks with language
  identifiers, and relative repository links.
- Prefer Markdown tables over HTML tables.
- Do not place essential instructions only in comments, custom directives,
  editor metadata, or tool-specific syntax.
- Tool-specific instructions are allowed only when clearly labeled and paired
  with an equivalent path for the other assistant.
- Keep project-agent instructions canonical in `AGENTS.md`.
- Keep `CLAUDE.md` as the Claude Code entry point importing `AGENTS.md`; do not
  duplicate the full instruction set there.
- When agent instructions change, update `AGENTS.md` and verify that
  `CLAUDE.md` still imports it.
- Do not create separate Codex-only and Claude-only versions of project
  architecture, domain rules, or coding standards.

## Architectural change plans and roadmap

Before implementing a feature, optimization, or core architectural adjustment,
check whether an active plan below affects it. Add new plans before starting
work that materially changes architecture.

Use this portable Markdown schema:

| Defined plan and implementation | Architectural and code impact | Key factors and metrics |
| --- | --- | --- |
| Plan name and concise implementation summary | Affected frontend, backend, data, infrastructure, and migration areas | Measurable UX, performance, reliability, security, and cost outcomes |

### Active plan 1: Real-time live code snippet feed

| Defined plan and implementation | Architectural and code impact | Key factors and metrics |
| --- | --- | --- |
| Integrate authenticated Fastify WebSockets to broadcast code-snippet posts and comments to authorized peer channels. | **Backend:** Register `@fastify/websocket` and add `server/src/routes/live.routes.ts`. **Frontend:** Add a typed `useWebSocket` abstraction under `client/src/hooks/`. Define shared Zod event contracts. | **UX:** Target sub-100 ms in-region broadcast latency. **Reliability:** Measure reconnect rate, duplicate delivery, and dropped events. **Infrastructure:** Monitor persistent connection count and memory per connection. |

### Active plan 2: Database layer optimization

| Defined plan and implementation | Architectural and code impact | Key factors and metrics |
| --- | --- | --- |
| Add composite indexes for social-graph lookups and feed sorting based on measured queries. | **Backend:** Update `server/prisma/schema.prisma` with reviewed `@@index` definitions. Generate a safe Prisma migration and validate it against production-like data. | **Performance:** Compare query plans and p50/p95 feed latency before and after. **Database:** Track write amplification, index size, lock duration, and migration rollback readiness. |

### Active plan 3: Tenant-aware backend foundation

| Defined plan and implementation | Architectural and code impact | Key factors and metrics |
| --- | --- | --- |
| Establish the first end-to-end Fastify, Prisma, and PostgreSQL backend while keeping the existing root Vite client in place until a separately verified client-folder migration is justified. | **Backend:** Add the designated `server/` layer with environment, Prisma, authentication, authorization, OpenAPI, route, and service modules. **Data:** Add reviewed migrations for identities, scoped roles, communities, events, conversations, messages, idempotency, and audit. **Frontend:** Add a narrow API service and connect core RSVP, messaging, and role-management flows through the Vite `/api` proxy. | **Security:** All protected operations require an active database identity and object-scoped authorization. **Reliability:** Privileged mutations are idempotent and audited. **Performance:** List endpoints are bounded and use predicate-aligned indexes. **Recovery:** Migrations are additive; roll forward with a corrective migration or revert application code without deleting persisted data. |

### Active plan 4: Preferred OIDC authentication and social publishing

| Defined plan and implementation | Architectural and code impact | Key factors and metrics |
| --- | --- | --- |
| Make standards-compliant OIDC Authorization Code with PKCE the preferred login and registration flow, with email/password as an explicitly secondary option. Add working group, post, broadcast, channel, direct-message, and real-time chat capabilities. | **Backend:** Add session, OIDC identity, local credential, group, post, broadcast, and channel ownership to Prisma; add authentication, social, and WebSocket route/service modules with shared Zod contracts. **Frontend:** Add accessible auth entry points and connect existing social surfaces to authenticated APIs and typed real-time events. **Data:** Add additive migrations and an idempotent realistic seed with at least two users for each scoped role. | **Security:** Store only salted scrypt password hashes, opaque hashed session tokens, and OIDC subject bindings; use HttpOnly SameSite cookies, PKCE/state/nonce, object authorization, idempotency, rate limits, and audit. **Testing:** TDD at HTTP, DOM, credential, and realtime seams; enforce backend ≥90% and frontend ≥80% across statements, branches, functions, and lines. **Reliability:** Bound feeds/chat history, validate WebSocket ingress, handle reconnect/duplicates, and retain soft-deleted social content. **Recovery:** Use additive migrations and roll-forward fixes without exposing or logging credentials. |

## Definition of done

A change is complete only when:

- It follows this file, `CONTEXT.md`, and `DESIGN.md`.
- Types, validation, authorization, and tenant or scope boundaries are correct.
- Relevant tests, type checks, and builds pass.
- New dependencies satisfy the seven-day policy.
- User-facing behavior is verified in both themes and relevant breakpoints.
- Documentation is updated in portable Markdown when behavior or architecture
  changes.
