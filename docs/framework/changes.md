# Commit-bound changes

Repository writes announce their own changes. A database-backed Platform host delivers them across processes through PostgreSQL NOTIFY, serves the subscription stream, and a React `SessionBoundary` mounts its bound contract APIs' live connections. An application declares query read keys and command invalidation keys; it needs no change channel option, subscribe operation or handler, `live()` call, or invalidation at repository write sites.

## Write and commit

`makeRepository` records the table name as the collection key and each written row's item key. Insert, update, delete, void writes, conflict writes and the Many methods use rows returned by SQL, including generated IDs. Ignored conflicts and missing unversioned deletes announce nothing. Composite IDs use the JSON array of encoded primary-key values in `idColumn` order.

A repository write opens `transact` when called alone and joins the enclosing `transact` when several writes form one operation. The existing effect-changes buffer deduplicates their keys. Its `BeforeCommit` hook sends NOTIFY through the writing connection, so PostgreSQL delivers the notification only after the outer commit and discards it on rollback. No trigger or second publisher is involved. Start enclosing transactions with `transact`, since a bare native transaction's commit cannot be observed by the change channel.

`migratePostgres` owns this boundary for its whole migration batch. Repository seed and upgrade writes announce after that batch commits and stay silent when it rolls back.

After a hosted command's handler succeeds, Platform publishes its declared `invalidates(payload, result)` keys, excluding keys that the handler's repository commits already published. Remaining keys use the same `transact` and NOTIFY path. The handler owns its transaction and error mapping; its after-transaction work keeps that boundary. A rejected command publishes no declared keys, while any repository transaction that actually committed still announces its writes.

Use `invalidateOnCommit` only for derived keys that neither a repository write nor the command declaration names. Ordinary SQL remains available for joins and exceptional writes, but raw writes must explicitly name their changes.

## Host and session defaults

`appDatabase` and database-backed `appHost` enable `postgresChanges` automatically. The default channel is `changes_` followed by the first 32 hexadecimal SHA-256 characters of `APP_NAME` or the database URL pathname, in that order. `config.applicationName` remains the PostgreSQL connection label and may differ between roles. Web hosts and workers must use the same name. `config.changes.channel` overrides the channel; heartbeat and retry settings remain optional.

Contracts include a framework subscription named `<contract>.$changes`. Platform supplies its handler under the contract's middleware. Use the native NDJSON RPC transport for streaming. `bind` tracks the keys of query atoms created through that binding; `SessionBoundary` mounts the binding's `LiveConnection.connection` atom when the binding is the client or a property such as `client.api`, then releases it with the session registry. Adding a query key renews the subscription and reconciles current reads. Resume and reconnect also reconcile those reads.

A changed hint contains only keys that actually fired and belong to the subscription. An item query should read its item key; add a list key only when changes to the whole collection should refetch it. Query handlers still enforce access policy and return authoritative data.

## Catch uncovered SQL in stories

The effect-sql story kit exposes `withChangeCoverage(body)`, also exported from `@shivaedev/effect-sql/testing.ts`. It runs the body inside `transact`, compares `pg_stat_xact_user_tables` counters before and after it, and fails with `UnannouncedWrites` if any written table lacks a recorded table key. The check happens before commit, so its failure rolls the body back. It checks table coverage, not whether every changed row was named; recorded keys from rolled-back savepoints count because PostgreSQL's transaction statistics retain those writes too.

Real PostgreSQL stories exercise a batch and several repository operations in one transaction: no notification arrives inside the body, and one deduplicated key batch arrives after commit. Separate stories cover a standalone Many call, ignored rows, upserts, outer rollback and discarded savepoints. The coverage story accepts a repository write, rejects an unannounced raw insert and observes that the rejected insert was rolled back.

A React story runs a database host over real HTTP with a separate pg-boss worker process. Its screen changes after the worker commits without application change wiring; the other item's read count stays fixed, and a rolled-back worker write changes neither the screen nor read counts. A second story observes the actual PostgreSQL notifications: a command's declared keys appear exactly once across its repository and derived-key notifications. The live-server story subscribes to several items and verifies that its hint includes only the changed subscribed item. These are framework integration proofs; they do not establish an application's deployment or durable delivery.

## Delivery limits

PostgreSQL NOTIFY is a wake-up signal, not a durable log. A heartbeat detects listener loss and resyncs live streams on loss and recovery. Payloads must be smaller than 8,000 bytes; the binding splits larger key batches and rejects a key that cannot fit before commit. A logical transaction therefore has one deduplicated batch, with multiple notifications only when its payload requires splitting. LISTEN requires a session connection; PgBouncer transaction pooling needs another adapter. Triggers, cascades and raw SQL remain invisible unless their keys are explicitly recorded; the coverage verb catches uncovered tables in tests.
