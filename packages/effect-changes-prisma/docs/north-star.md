# North star

## The problem

A successful Prisma query says that its statement ran. A successful transaction body still does not say that COMMIT succeeded. A deferred constraint can reject the commit, a caller can be interrupted, or Prisma can expire the transaction while the Effect body has more work to do. If an application announces changes from its write methods or from the body's success, it can announce rows that rolled back, miss a commit that landed during interruption, or continue side effects after the database transaction closed.

The other half of the problem is knowing which writes need an announcement. An application often names changes by an owner, member or domain rather than a table. That meaning belongs to the application. Returned model rows can provide it; a count alone cannot. A test also needs evidence that its writes passed through this path, including SQL that bypasses ordinary model delegates.

## The ideal

An application on Prisma Classic and PostgreSQL has one path for commit-bound changes. It defines its change values and model mappings once, runs Prisma calls through `use`, and wraps an action in `transaction`. The adapter supplies the scoped client and translates the real driver's outcome into the shared effect-changes frame lifecycle. An application with an existing Effect wrapper can feed observed results through `recordWrite` without adopting another query wrapper.

A mapping classifies a model deliberately: a row names changes, or `null` says its writes need none. A count-only write or a returned row missing a field the mapping needs must be visible to a test rather than quietly producing an invented subject. A PostgreSQL test compares its written tables with `Recorded` observations and its own definition of which change covers a model.

## What good looks like

- COMMIT determines publication. Savepoint release determines merging into an enclosing frame; rollback determines discard.
- Interruption during a body stops that body and rolls back. Interruption during an in-flight COMMIT still waits for the database outcome, so a landed commit can publish.
- A started transaction expiring is distinct from one unable to start. Typed application failures remain available to callers.
- An expired body stops before later side effects. Wall-clock deadlines follow the current Prisma client's timeout rather than the test clock.
- Model meanings remain explicit and typed. An exhaustive map makes an added model require a classification.
- Tests take a baseline on their own transaction before checking table counters, so a reused connection does not give credit or blame for another transaction's writes.

## Trade-offs

When goals conflict, database outcome and interruption correctness win first, then reuse of the shared channel, then explicit application-owned meaning, then proof at the PostgreSQL boundary, then convenience.

**Commit correctness costs waiting.** A Prisma promise already in flight cannot be treated as rolled back just because the Effect caller stops waiting. The adapter must settle from the driver's result, including after interruption. A more convenient cancellation API cannot invent a different database outcome.

**Returned rows limit automatic naming.** The mapping uses the row a write returns. Count-only operations and missing fields need an explicit choice by the application; automatically fetching rows would add queries and its own consistency problem. Keep unsupported shapes visible before adding convenience.

**Coverage is deliberately coarse.** The coverage predicate connects a written table's model to recorded changes. One covering change satisfies that table check. This is a useful guard against a missed path, but subject-level correctness belongs in the application's tests.

**Prisma adaptation stays narrow.** The shared channel owns buffering, observation and publication policy. This package owns the Promise transaction boundary, the current client, returned-write interpretation and PostgreSQL table-counter helpers. Keep those responsibilities separate so improvements to a channel reach both Prisma and native SQL callers.

## What it leaves out

- A replacement Prisma client, repository layer or migration runner. effect-prisma owns the separate Prisma Next database facade, and effect-sql owns native Effect persistence and migrations.
- The shape of an application's change values, the meaning of their keys, or which subjects a write should name.
- A selected subscription transport, durable delivery policy or deployment topology. The application chooses those around its publication sink.
- Proof that every affected row or subject is announced. The coverage helper checks tables and unnamed writes; application behavior tests check the meaning of the announcements.

The [roadmap](roadmap.md) holds the unresolved support and API questions. The [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md) owns adoption and delivery decisions that span packages.
