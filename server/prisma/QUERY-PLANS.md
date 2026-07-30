# Local query-plan evidence

Captured on 2026-07-30 with PostgreSQL 16.12 after applying
`20260730150800_align_list_indexes` and running `ANALYZE`.

The deterministic development seed is intentionally tiny (5 users, 4 events,
4 messages, and no audit rows). PostgreSQL correctly chose sequential scans for
these tables: measured execution times were 0.035 ms for the access directory,
0.004 ms for the audit directory, 0.006 ms for the event list, and 0.008 ms for
the conversation message list. Those figures are correctness smoke tests, not
production performance claims.

The route predicates and stable ordering map to these indexes:

| Route query | Predicate/order | Index verified by `EXPLAIN` |
| --- | --- | --- |
| Access directory | `ORDER BY displayName, id` | `User_displayName_id_idx` (index-only scan) |
| Audit directory | `ORDER BY createdAt DESC, id DESC` | `AuditLog_createdAt_id_idx` (backward index-only scan) |
| Bootstrap events | `ORDER BY startsAt, id` | `Event_startsAt_id_idx` (index-only scan) |
| Conversation messages | `conversationId = ? ORDER BY createdAt DESC, id DESC` | `Message_conversationId_createdAt_id_idx` (backward index scan) |

The remaining indexes were checked against their bounded operational lookup
predicates. The seed is too small for default-plan latency conclusions, but
`SET enable_seqscan=off; EXPLAIN` confirmed an available index path:

| Operational lookup | Predicate/order | Index |
| --- | --- | --- |
| Memberships for an identity | `userId = ? AND status = ?` | `CommunityMember_userId_status_idx` |
| Identity role hydration | `userId = ? AND scope = ?` | `RoleAssignment_userId_scope_idx` |
| Community role administration | `communityId = ? AND role = ?` | `RoleAssignment_communityId_role_idx` |
| Event presenter administration | `eventId = ? AND role = ?` | `RoleAssignment_eventId_role_idx` |
| Community event schedule | `communityId = ? ORDER BY startsAt` | `Event_communityId_startsAt_idx` |
| Identity RSVP history | `userId = ? ORDER BY updatedAt` | `EventRsvp_userId_updatedAt_idx` |
| Community conversation activity | `communityId = ? ORDER BY updatedAt` | `Conversation_communityId_updatedAt_idx` |
| Identity conversation participation | `userId = ? ORDER BY joinedAt` | `ConversationParticipant_userId_joinedAt_idx` |
| Author moderation history | `authorId = ? ORDER BY createdAt` | `Message_authorId_createdAt_idx` |
| Actor audit history | `actorUserId = ? ORDER BY createdAt` | `AuditLog_actorUserId_createdAt_idx` |
| Community audit history | `communityId = ? ORDER BY createdAt` | `AuditLog_communityId_createdAt_idx` |
| Object audit history | `targetType = ? AND targetId = ? ORDER BY createdAt` | `AuditLog_targetType_targetId_createdAt_idx` |
| Idempotency expiry cleanup | `expiresAt < ?` | `IdempotencyRecord_expiresAt_idx` |

Index viability was checked in the local database with
`SET enable_seqscan=off; EXPLAIN ...`; this setting was used only to prove the
available access path, not to produce latency claims.

The alignment migration replaced the two-column conversation-time index with a
stable three-column ordering. A follow-up migration restores the original index
as well, preserving the plan's additive roll-forward commitment. Production
plan measurements can then decide whether a later maintenance window should
remove the redundant physical index; this feature migration does not do so.

Before production promotion, load production-like cardinalities and rerun
`EXPLAIN (ANALYZE, BUFFERS)` with default planner settings. Record p50/p95
latency, rows removed by filters, index size, and write amplification. If an
index is not selected or does not improve the measured route, remove it in a
new additive migration rather than editing an applied migration.
