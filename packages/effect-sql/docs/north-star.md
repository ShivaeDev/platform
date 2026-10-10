# North star

## The problem

An application's database row, writable input, query filter and selected result describe the same data. Authoring a separate type and decoder for each gives an agent more places to disagree about a field. Hiding native SQL behind another query language also makes the uncommon query harder to write and obscures the transaction that owns it.

Persistence has another boundary a row type cannot express: the moment a write becomes visible. Announcing a changed key before commit lets a reader refresh against old data; announcing a rolled-back write asks it to refresh for something that never happened. Lexical nesting is insufficient when one operation uses two database clients. Each database owns its own commit.

Migrations have a similar ownership problem. Two application instances can try to initialize the same empty database or upgrade the same ledger. Native migration execution is the foundation; coordinating its PostgreSQL runners should require a small helper, not a replacement migration engine.

## The ideal

One native Effect model describes the application's decoded fields and the variants that cross the database and JSON boundaries. A database-generated identity is absent from insertion and available for updating and reading. A transport date may be a string while the driver's selected date is a `Date`. These distinctions belong in the model, and the application's migrations create the corresponding columns and defaults.

The repository derives ordinary operations from that model. A selected field keeps its decoder and type; a filter uses that field's decoded value and encoder. A feature reaches native SQL directly when it needs a join, aggregate or another query the small repository does not express. There is no second authored database model and no new pool or connection lifecycle.

A changed write records the keys readers observe within its transaction. Keys stay with the native client that wrote the rows, merge through successful savepoints and publish once after that client's outermost commit. A second client's transaction retains its own outcome. Rollback, interruption and publication failures must preserve the distinction between an uncommitted write and a committed write whose notification failed.

Migration authors supply ordinary Effects and a native numbered loader. The PostgreSQL helper owns serialization around ledger creation and the pending transaction; the application owns migration contents, ledger spelling, lock budget and startup or deployment coordination.

## What good looks like

- An agent can read a model and see what callers provide, what the database generates and what a query returns.
- Common repository operations need no second result schema. Exceptional queries use the same native SQL client and application schemas.
- Invalid persisted values reach a decoding failure rather than become domain values with the wrong type.
- A transaction's rows and recorded keys have the same owner. A caller cannot accidentally announce an outer commit the package cannot observe.
- Constraint names and domain errors belong to the operation that understands them. Native SQL errors remain available for failures it does not recognize.
- Database behavior is backed by a test against that database. Codec documentation names driver representations and the edge cases it establishes.
- Migration coordination wraps the native runner thinly and exposes native failure behavior rather than inventing a second recovery model.

## Trade-offs

- **Native semantics over a smoother facade.** Native update shapes, savepoints, commit defects and migration-body defects need an explanation. Preserve them rather than silently turn them into partial patches or ordinary typed failures.
- **A small query surface over automatic relationships.** Equality filters, selection, one sort field and a limit remove routine work. A broader query API needs evidence of repeated consumer work; explicit SQL remains usable while that decision is open.
- **Correct commit ownership over permissive nesting.** Refuse an unmanaged outer native transaction when changed keys need its commit boundary. An error is preferable to silently publishing at the wrong moment.
- **Committed outcome over notification success.** A failed post-commit invalidation is diagnostic work, not a reason to report that the write failed and encourage a duplicate retry.
- **An explicit migration lock budget over an implicit wait.** Applications choose how long to wait and how to handle startup failure. The helper coordinates one PostgreSQL ledger; it does not decide rollout policy.

## What it deliberately leaves out

- SQL schema inference, generated migrations, a second ORM model or a replacement query runtime.
- Automatic joins, relation loading, tenant scoping, authorization or soft-delete policy in the repository helper.
- RPC contracts, browser state and delivery of changed keys between processes. `effect-contract`, `effect-react` and an application's delivery boundary own that work.
- A replacement for `effect-changes`: this package binds its generic commit ownership to native SQL and Reactivity.
- A migration CLI, application startup framework, deployment coordinator, checksum policy or schema-diff engine. The package roadmap owns implementation questions; the framework roadmap owns composition and deployment conventions.
- Prisma persistence. Applications using Prisma follow `effect-prisma` and `effect-changes-prisma`.
