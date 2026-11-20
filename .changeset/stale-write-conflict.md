---
"@shivaedev/contract": minor
"@shivaedev/create-app": patch
---

### Breaking

- `@shivaedev/contract`: an operation's `run` now fails with `Conflict` where its body lets an `OptimisticConcurrencyError` from an `@shivaedev/sql` repository through, so code that calls `Operation.run` and catches `OptimisticConcurrencyError` after it catches `Conflict` instead. Delete each `Effect.catchTag("OptimisticConcurrencyError", …)` in `run` that only returned a `Conflict`; keep one that answers something else.

### Added

- `@shivaedev/contract`: a stale versioned write that reaches the end of an operation's `run` answers the caller with the shared `Conflict` from `@shivaedev/errors/taxonomy.ts`, whose message tells the person to refresh and try again. The generated wire lists `Conflict` for that operation, so its client sees a typed rejection and the default notice shows the message.

### Changed

- `@shivaedev/create-app`: generated apps' note update and delete commands no longer map a stale version to `Conflict` themselves, and `src/modules/notes/server/changed.ts` is gone. A stale edit or delete now shows `This was changed or deleted since you loaded it. Refresh and try again.`
