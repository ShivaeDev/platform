# North star

## The problem

A database write and the notification that tells readers to refresh happen at different boundaries. The write runs inside a transaction, while a cache, live view or subscriber usually lives outside it. Publishing while the body runs can announce data that later rolls back. Publishing only when the body's fiber succeeds can miss a commit that finishes while the caller is being interrupted. Repeated writes can also notify the same subject several times even though one refresh would read the final committed state.

The application knows which subjects a write affects. The database driver knows whether its transaction committed. Neither should need to own the other's job. A small after-commit boundary can collect the application's descriptions and wait for the driver's actual outcome.

## The ideal

A feature records a change beside the write that caused it, in words the application owns. A transaction binding collects those records and publishes the distinct notifications after the owner's outermost commit. Nested work follows that owner's transaction, while an independent database or client retains its own commit boundary.

The channel stays an ordinary Effect component. Its owner comes from the current context. Native transaction combinators retain their body, error, interruption and resource behavior. A driver whose commit is reported by a Promise can provide the frame to its callback and settle it from the driver result; the core does not need a second implementation for each database.

A notification failure after commit cannot roll back the data. The default policy should make that failure visible without telling a caller that its successful write failed and encouraging the caller to repeat it. Applications that deliberately want a defect can choose that policy, and any retries belong to their publish function.

## What good looks like

- Feature code records every subject that should refresh, including several subjects for one write, without knowing how the transaction buffer works.
- The native commit decides publication. The same boundary handles savepoints, failed commits and interruption while committing without treating body success as commit proof.
- Owners are explicit identities. Nesting a transaction on another owner does not defer its successful commit until an unrelated outer transaction finishes.
- A test replaces the publish function or observes recorded, published and discarded changes through Effect context, while application write code remains unchanged.
- The core depends on Effect alone. Native SQL invalidation is a binding in `effect-sql`; Prisma write recording and driver control are a binding in `effect-changes-prisma`.
- Documentation distinguishes deterministic channel tests from real driver evidence. A skipped PostgreSQL test is not proof of PostgreSQL behavior.

## Trade-offs

The [short north star](https://github.com/ShivaeDev/platform/blob/main/packages/effect-changes/AGENTS.md) orders design decisions: preserve the actual transaction outcome and native Effect semantics, keep one boundary with correct ownership, keep recording explicit and proven, then keep the core small.

**Commit truth over a quick exit.** A caller may need to wait for a commit already in flight before the binding can decide what happened. Returning early must not make a real committed change disappear from the publish decision.

**Explicit records over automatic discovery.** The channel does not parse queries or inspect models. This leaves an application responsible for announcing its writes, but avoids coupling the core to a database or guessing the meaning of a row mutation. An ORM binding can help record writes without changing that boundary.

**Notification coalescing over an event journal.** The key identifies work that can share one refresh. Consumers that need every business event, durable ordering or replay need a different storage and delivery design.

**Committed result over automatic write retries.** A failing publish function is a delivery problem after the write has landed. Logging keeps those concerns separate. The opt-in defect policy gives applications a deliberate alternative without pretending the committed data was undone.

**Small bindings over a universal transaction engine.** The native driver still owns transaction creation, savepoint behavior and commit. The channel only owns the recorded changes and their settlement.

## What it leaves out

- Defining an application's change types, deciding which readers are affected, or implementing a cache or subscription service.
- SQL execution, repositories, migrations, ORM interception or detecting writes from triggers, cascades and raw SQL.
- A durable outbox, event journal, replay protocol, message broker, retry scheduler or cross-process delivery transport.
- Claiming that an in-memory notification boundary closes the gap between a database commit and a process crash.

The [framework changes guide](https://github.com/ShivaeDev/platform/blob/main/docs/framework/changes.md) explains how the channel fits its SQL and Prisma bindings. Deployment delivery and application integration belong to the [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md); package status belongs in [roadmap.md](roadmap.md).
