# @shivaedev/effect-prisma

You are changing the bridge from Prisma Next's generated models to Effect. An application that owns a Prisma Next contract should use its model queries in ordinary Effect programs without rebuilding database ownership, error conversion or transaction plumbing. The contract remains the source of model types; Effect remains the source of dependency, scope and failure semantics. Read [README.md](README.md) for usage, [docs/north-star.md](docs/north-star.md) for the full intent and [docs/roadmap.md](docs/roadmap.md) for work and maintainer decisions.

## Which way to lean

When goals conflict, they win in this order:

1. **Effect owns the boundary.** Keep failures typed, defects intact and resources scoped. A transaction must settle before its connection or permit is released; a value whose owning scope has ended must fail closed.
2. **One persistence service.** The exported Database definition is the application's entry point inside and outside a transaction. Keep executor coordination private. Native framework persistence and migrations belong to `effect-sql`; Prisma Classic change tracking belongs to `effect-changes-prisma`.
3. **The contract stays precise.** Preserve generated input, row, relation and database identity types. Decline an upstream feature rather than expose it through weakened types or a second authored model.
4. **A query can be reused safely.** Branching a Relation must leave its base alone. Resolve the active transaction when a root query runs, and keep transaction-bound values inside their owner.
5. **Proven behavior before convenience or speed.** Use real PostgreSQL tests for PostgreSQL claims. Prefer explicit limits to promises a synchronous SQLite driver or a single transaction connection cannot keep.

Applications own contract generation, schema changes and domain repositories. This package owns the small adaptation from those generated models into Effect; do not grow another database framework around it.
