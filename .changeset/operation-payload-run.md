---
"@shivaedev/contract": minor
---

### Added

- `query(name, { … })` and `command(name, { … })` accept an operation written as its `payload` and a generator `*run`. `run` becomes an Effect-returning function, so one operation can `yield* Create.run(payload)` and inherit its services and failures. A query without `readPolicy` gets `signedIn` and still declares `reads` (with optional `serverReads` and `readsCollections`); a command without `invalidates` announces no keys of its own. Existing declaration forms are unchanged.
- `success` and `rejections` are optional on that form. A declared one must equal what `run` infers, and each mismatch is a compile error naming the operation and the problem: `SuccessDiffersFromRun`, `ArrayMutabilityDiffers` (return a readonly array, or declare `Schema.mutable`), `RunFailsOutsideRejections` (also for a read policy's failures), `RejectionsRunNeverRaises` and `RejectionAutomatic`. Failures that state `isRetryable`, `SchemaError` and `QueryReadDenied` are never rejections.
- Every operation written with `run` carries `InternalServerError` and `ServiceUnavailable` in its type and rejection set and cannot list them. No `Conflict` is added; map a constraint violation in `run` to a domain failure instead.
- A field failure for that form is an exported class, `Schema.TaggedError<TitleTaken>()("TitleTaken", fieldRejection(NoteFields))`, raised in `run` with `yield* new TitleTaken({ field, message })`; `@shivaedev/form`'s `rejecting` places its message on that field.
