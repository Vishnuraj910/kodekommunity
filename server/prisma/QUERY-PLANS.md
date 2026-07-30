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

Index viability was checked in the local database with
`SET enable_seqscan=off; EXPLAIN ...`; this setting was used only to prove the
available access path, not to produce latency claims.

Before production promotion, load production-like cardinalities and rerun
`EXPLAIN (ANALYZE, BUFFERS)` with default planner settings. Record p50/p95
latency, rows removed by filters, index size, and write amplification. If an
index is not selected or does not improve the measured route, remove it in a
new additive migration rather than editing an applied migration.
