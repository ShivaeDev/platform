# @shivaedev/effect-changes-prisma

You are changing the PostgreSQL Prisma Classic binding for `@shivaedev/effect-changes`. A Prisma write can finish before its transaction commits. Announcing it then can refresh a view with rows that never land. This package turns returned model rows into application-owned changes, settles them from the interactive `$transaction` outcome, and gives tests a way to find writes that no recorded change covers.

When goals conflict, lean in this order:

1. **The database outcome wins.** A successful body is not a successful commit. Preserve rollback, savepoint, interruption and expiry behavior, including a caller interrupted while COMMIT is already in flight.
2. **One channel owns the changes.** Keep frames, deduplication, batches and observation in effect-changes. Adapt Prisma's boundary rather than building a second channel or replacing Prisma's client.
3. **The application names the meaning.** Model mappings name changes; the application's coverage predicate connects them to models. Report an insufficient returned row or a count-only write instead of guessing a subject or reading rows back.
4. **Prove the boundary.** PostgreSQL claims need the real PostgreSQL tests. Keep typed failures intact and prove that an expired body stops before later side effects. A coverage check is evidence about tables, not every affected subject.
5. **Wrap thinly.** Prefer `use`, `transaction` and the explicit `recordWrite` seam over a broader ORM abstraction. Native persistence and migrations belong to effect-sql; effect-prisma owns the separate Prisma Next database facade.

Read [the long north star](docs/north-star.md) for scope and trade-offs, [the roadmap](docs/roadmap.md) for status and maintainer decisions, and [the README](README.md) for usage. Follow the [root guidance](../../AGENTS.md); ask before changing the public surface or deciding an open roadmap question.
