### Added

- `makeChannel` accepts a typed `beforeCommit` hook and exposes a scoped `BeforeCommit` reference. `within` runs it with the deduplicated root changes inside the native transaction; a hook failure rolls back instead of publishing. Direct driver bindings can run `CommitFrame.beforeCommit` before their callback returns.
- `CommittedSink` can override transaction publication while retaining the ordinary sink for unframed records and batches.
