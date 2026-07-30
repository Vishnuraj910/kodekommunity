# Kommunity security review

This document records the security model for the current local full-stack
application and the controls required before it becomes a production
multi-tenant service. The browser's role switcher is a permission preview; it
is not an authorization boundary.

## Threat model

### Assets and data classes

- **Public:** community, group, event, and public-profile presentation data.
- **Internal:** application configuration, feature flags, operational metadata,
  and aggregate telemetry.
- **Confidential:** private messages, contact details, membership data, exports,
  access tokens, and support records.
- **Restricted:** OAuth client secrets, signing keys, database credentials,
  privileged audit events, recovery material, and role assignments.

### Actors and tenant boundaries

- Regular users participate through the baseline `user` assignment.
- Community `super_admin` and `admin` assignments are isolated by
  `communityId`.
- `presenter` assignments are isolated by `eventId`.
- `root` and `maintainer` are platform actors with different capabilities.
- Disabled, invited, and revoked identities must fail closed.
- A production community is the primary tenant boundary. Events and groups are
  subordinate object boundaries and must retain their parent community context.

### Entry points and trust boundaries

| Entry point | Current state | Trust boundary |
| --- | --- | --- |
| React UI | Server-backed social client implemented | All browser state and input are untrusted |
| Service worker and cache | Implemented | Offline content must not mix origins, users, or API data |
| API | Cookie-session, OIDC, and local authentication implemented | Every protected request resolves an active database identity |
| Jobs and webhooks | Not implemented | Must authenticate and carry tenant context at ingress |
| Realtime | Authenticated participant-scoped WebSockets implemented | Connections and events must retain conversation and tenant context |
| Database | Local PostgreSQL/Prisma persistence implemented | Production credentials, backups, encryption, and tenant operations remain deployment controls |
| Object storage and exports | Not implemented | Paths and download authorization require tenant and object checks |
| Support/admin tools | UI preview only | Production operations require strong auth, attribution, and audit |

## Ranked findings and controls

| ID | Threat and evidence | Boundary | Severity | Recommended control | Verification | Residual risk |
| --- | --- | --- | --- | --- | --- | --- |
| S1 | `public/sw.js` cached every GET response and deleted caches it did not own. A future authenticated API response or another application cache could be captured or removed. | Browser cache / data movement | High | Restrict caching to same-origin public shell assets, exclude API/auth requests and private responses, and delete only Kommunity-owned cache versions. | Static security tests plus production build inspection. | Hosting/CDN caches still require equivalent private-response rules. |
| S2 | The document had no CSP or explicit security headers. An injection defect would have a larger execution and exfiltration surface. | Browser / UI | Medium | Add a restrictive CSP fallback and security headers for local preview and static-host configuration. | Tests assert required directives and headers. | The deployment platform must emit headers; a meta CSP cannot enforce every header-only directive. |
| S3 | Privileged preview assignments were deserialized from writable `localStorage` without runtime validation. | Identity / privileged UI | High if mistaken for production auth; Medium in this prototype | Validate and version stored values, reject malformed assignments, and keep the UI labeled as a local preview. | Tampered-storage negative tests. | Browser users can still alter their local preview; production authorization must be server-side. |
| S4 | Authorization modeled roles but not invited, disabled, or revoked identity state. | Authentication lifecycle | High for production | Authorize an explicit subject and fail closed unless its identity status is `active`. | Negative tests for every inactive status. | Session revocation and token invalidation require the future backend. |
| S5 | Private message content persisted indefinitely in local storage and there was no user-facing device-data purge. | Privacy / recovery | Medium | Keep messages in session storage with expiry and provide a confirmed local-data purge that also clears owned caches. | Storage expiry and purge tests; browser verification. | Device/browser backups may retain deleted browser data outside application control. |
| S6 | Dependency ranges allow future drift even though installation is delayed seven days. | Supply chain | Medium | Pin direct dependencies to reviewed lockfile versions and retain strict pnpm release-age and lifecycle-script policy. | Frozen install, lockfile check, test, typecheck, build. | Transitive vulnerabilities still require ongoing advisories and patch review. |
| S7 | The API enforces active identities, participant/object checks, scoped roles, bounded queries, rate limits, idempotency, and attributed audit. OIDC Authorization Code with PKCE and revocable hashed sessions are implemented. Jobs, webhooks, exports, and object storage are not. | API / data / operations | High for future integrations | Apply the same authenticated tenant context, idempotency, audit, retention, and object authorization to each new ingress or data-movement path. | Integration tests cover revoked sessions, inactive identities, cross-scope escalation, nonparticipants, retries, and the final-root invariant. | New integrations remain production blockers until their negative cases exist. |
| S8 | Server configuration is validated, incomplete OIDC configuration is rejected, and demo authentication is rejected in production. Local `.env` loading is suitable only for development. | Secrets / authentication | High for production operations | Load database and OIDC secrets from a managed secret store, restrict secret access, rotate safely, and never expose secrets through `VITE_` variables. | Startup contract tests, deployment IAM review, rotation exercise, and secret scanning in CI. | Managed secret delivery and rotation are deployment responsibilities. |

## Required production negative cases

The following cases are release gates for the future backend:

1. Changing a `communityId`, `eventId`, object ID, export ID, or storage key
   cannot cross a tenant boundary.
2. Community administrators cannot act in another community or acquire platform
   capabilities.
3. Jobs, webhooks, cache keys, search documents, analytics events, and realtime
   channels reject missing or mismatched tenant context.
4. Exports and logs omit contact details, secrets, tokens, and fields hidden by
   policy.
5. Invited, disabled, revoked, or session-revoked identities cannot access any
   protected capability.
6. Retried privileged, billing, role, invitation, and deletion requests are
   idempotent and produce one attributed audit event.

## Implementation phases

1. **Browser boundary:** safe service-worker caching, CSP, and security headers.
2. **Identity boundary:** validated stored preview state, explicit identity
   lifecycle, and scoped authorization negative tests.
3. **Privacy lifecycle:** session-only expiring messages and confirmed device
   data/cache purge.
4. **Backend boundary:** tenant-aware persistence, active-identity checks,
   participant checks, scoped roles, idempotency, audit, and rate limits.
5. **Delivery boundary:** pinned dependencies, frozen verification, and
   production security requirements in the operator documentation.

## Production acceptance boundary

Do not process production private messages, payments, or regulated data until
managed secret delivery, HTTPS, database/network isolation, backups, retention,
legal deletion, incident response, support-access controls, monitoring, and
recovery objectives are configured and tested. Any new job, webhook, export, or
object-storage path must first satisfy the negative cases above.
