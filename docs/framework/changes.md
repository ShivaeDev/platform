# Commit-bound changes

Code that writes rows can announce what it changed so caches, subscriptions or live views refresh. The announcement must follow the database: a change is published after its transaction commits, once, and never for a rollback. [`@shivaedev/effect-changes`](../../packages/effect-changes/README.md) provides that boundary as a channel. It imports only `effect`, runs in browsers and servers, and knows nothing about SQL or any ORM; its README explains channels, owners, frames, batches, publish failures and the test seams.

Three bindings connect the channel to a database:

| Binding | Package | What it does |
| --- | --- | --- |
| [`transact`](../../packages/effect-sql/README.md#transactions-and-invalidation) | `@shivaedev/effect-sql` | A channel whose changes are Reactivity keys, over `sql.withTransaction`, with `Reactivity.invalidate` as the sink. It refuses a native `sql.withTransaction` it did not open, because that commit cannot be observed. |
| `postgresChanges` | `@shivaedev/effect-sql` | Sends the invalidation keys through the writing transaction's connection with NOTIFY and delivers them to each process's local Reactivity, so other servers and workers see the commit. |
| `makePrismaChanges` | [`@shivaedev/effect-changes-prisma`](../../packages/effect-changes-prisma/README.md) | Records changes from Prisma Classic writes on PostgreSQL and settles the frame from `$transaction`'s outcome, with a test-time check for writes no change covered. |

The [reference composition](./composed-example.md) joins `transact`, `postgresChanges` and live hints across two HTTP servers and a pg-boss worker. Use the [starter quickstart](./quickstart.md) to generate an application with these bindings.

## Limits

- Default delivery is local Reactivity. Between processes, PostgreSQL NOTIFY is a wake-up signal, not a durable log: it delivers at commit and drops notifications on rollback. A heartbeat detects listener loss and resyncs live streams on loss and recovery, so readers query authoritative data.
- Payloads must be smaller than 8,000 bytes in the default configuration; the binding splits UTF-8 JSON key arrays and rejects a key that cannot fit before commit.
- LISTEN requires a session connection; PgBouncer transaction pooling needs another adapter.
- Only recorded changes are published. Triggers, cascades and raw SQL that does not call `record` are invisible to the channel.
