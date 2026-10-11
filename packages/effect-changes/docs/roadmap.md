# Roadmap

This file owns the channel's implementation status. The [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md) owns cross-package integration, application adoption and delivery decisions for a deployment. The [changes guide](https://github.com/ShivaeDev/platform/blob/main/docs/framework/changes.md) explains composition and driver evidence.

## Built

- [x] `makeChannel` with explicit records, custom-key deduplication and first-seen key order, with independent buffers per transaction owner.
- [x] `within(native)` for native Effect transaction combinators: root publication after success, nested commit merge, rollback discard and interruption during commit.
- [x] `open`, `Frame.provide` and idempotent `Frame.settle` for bindings that receive a driver outcome through a Promise.
- [x] `batch` for grouped notifications from autocommitted writes, including typed failure and interruption, and composition with transaction frames.
- [x] An `unowned` guard for bindings that must refuse a transaction whose commit they cannot observe, and defects for work that outlives a settled frame.
- [x] A default logged publish failure that preserves the committed result, and an opt-in defect policy, for failed Effects, defects and synchronous throws.
- [x] Typed root `BeforeCommit` hooks run inside the native transaction, including successful nested buffers; hook failures roll back. `CommitFrame.beforeCommit` exposes the same boundary to direct driver bindings. [Hook evidence](https://github.com/ShivaeDev/platform/blob/main/packages/effect-changes/src/beforeCommit.spec.ts).
- [x] `CommittedSink` lets a transport own transaction delivery while preserving ordinary local records and batches.
- [x] `Sink` and `Observer` services for scoped test capture and recorded/published/discarded observations.
- [x] Deterministic channel tests, packed-consumer fixtures, and real PostgreSQL composition tests through the SQL and Prisma bindings. Database evidence requires running those tests with their database URL.

## Next

No additional core feature is selected. PostgreSQL notification delivery is a separate binding in effect-sql; the channel remains independent of database drivers. Application adoption and additional transports remain framework work.

## Open questions

- Are `Buffer`, `makeBuffer`, `settled`, `add`, `keyed`, `makeFrame`, `unobserved` and `publisher` intended for external callers? The current module exports make them available, while repository consumers use the channel and its public data types.
- Should the package's priority order treat the real commit outcome as the first ideal, or as a requirement within the repository's native Effect priority? The current north star groups them together.
