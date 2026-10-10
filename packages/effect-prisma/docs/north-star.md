# North star

## The problem

An application with a Prisma Next contract already has a model vocabulary and generated query types. Effect services around that client still need a reliable boundary: queries must be Effects, database failures must remain inspectable, client ownership must fit a scope and a transaction must reach every participating query without passing an unrelated client through every method.

Tests have the same problem. A test should exercise the generated queries and real database, then discard its writes, whether it succeeds or fails. Rebuilding that transaction harness in every application spreads the most delicate part of persistence across code that is easy to get wrong.

This package owns that bridge. It serves applications that use Prisma Next while `effect-sql` owns the framework's native persistence and migration path. Prisma Classic is a separate integration: `effect-changes-prisma` binds change channels to its interactive transactions.

## The ideal

A generated contract becomes one exported Database definition. Application services yield it, describe queries with its models and compose ordinary Effects. A transaction provides the same definition for its body. Repositories need no public executor service and no second model declaration.

A query description can be reused or branched without changing another caller's query. A query captured from the root facade finds the active transaction when executed. A value made inside a transaction cannot silently fall back to the root client after that transaction ends or cross into a sibling transaction.

Types must carry the contract through filters, writes, selections and relation loading. Two databases sharing a contract still have separate identities. A convenience that loses a field type, a nullable relation or a database boundary costs more than the lines it saves.

## What good looks like

- One Database service is visible to application code. Its private coordination preserves Effect dependency and scope semantics.
- Query failures preserve database information needed for a domain decision. Unrecognized failures stay defects rather than being recast as expected database errors.
- Transaction settlement waits for in-flight work, then commits or rolls back and releases the connection. No permit is released while interrupted work is still using its connection.
- Every branch of a query remains independent. Included queries come from the correct model, Database and transaction owner.
- A database test drives real rows through the same public facade and rolls back afterwards. Test helpers compose with `effect-test` rather than building another runner.
- Documentation says exactly which tests establish a claim. Controlled collection tests, SQLite tests and real PostgreSQL tests each establish their own boundary.

## Trade-offs

**Effect semantics before upstream coverage.** Preserve typed errors, scoped ownership and exact model types first. Add a Prisma Next feature only when its public types and lifecycle fit; excluding an operation is preferable to weakening it into a generic dynamic escape hatch.

**One transaction connection before apparent parallelism.** Concurrent Effects may describe independent work, but queries on one transaction connection need coordination. A transaction Stream may buffer rows so downstream work can use that connection. That spends memory to preserve a clear lifetime and avoid a query waiting on its own occupied connection.

**SQLite's engine limits before an identical performance promise.** The same facade does not make PostgreSQL and a synchronous SQLite driver equivalent. Coordinate one SQLite Layer's finite queries and transaction lifetimes; do not promise coordination across independently created clients.

**One supported composition before hidden identity machinery.** Applications export and reuse one definition per identifier and provide one live Layer for it. Do not invent cross-runtime registries to make duplicate definitions look safe.

## What it leaves out

- Authoring application contracts, schema changes, migrations or domain repositories.
- A new query language or a second authored model next to Prisma Next's contract.
- Prisma Classic client adaptation, commit-bound change tracking, auth policy or a tRPC transport.
- Nested independent rollback promises without driver savepoint support.
- Model variants or broader upstream parity obtained by weakening public types.
- Coordination of multiple SQLite Layers against the same file.

The maintainer owns feature breadth and the backend support policy. Their open choices and the package's current work live in `roadmap.md`.
