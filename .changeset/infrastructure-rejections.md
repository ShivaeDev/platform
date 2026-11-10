---
"@shivaedev/errors": minor
"@shivaedev/jobs": patch
"@shivaedev/rate-limit": patch
---

### Added

- `@shivaedev/errors`: `infrastructure.ts` exports `InfrastructureFailure`, a failure that states `isRetryable` or Schema's `SchemaError`, and `infrastructureRejection(failure)`, which turns a failure whose `isRetryable` is `true` into `ServiceUnavailable` with the failure as its cause and returns `undefined` for any other value.

### Changed

- `@shivaedev/errors`: `rpcBoundary` answers an undeclared failure whose `isRetryable` is `true`, such as a `SqlError` from a lock timeout or a lost connection, with `ServiceUnavailable` when the RPC declares `ServiceUnavailable`. It logs an `RPC infrastructure failure` warning with the redacted cause instead of an unexpected report. Other undeclared failures still answer the unexpected rejection and are reported; declared failures pass through unchanged. An operation that declares `ServiceUnavailable` no longer needs its own `SqlError` mapping for retryable failures.
- `@shivaedev/jobs`: `PgBossError` and `PgBossPayloadError` state `isRetryable` as `false`, so they are infrastructure failures that no operation declares.
- `@shivaedev/rate-limit`: `StoreError` states `isRetryable` from its cause, and as `true` when the cause does not state it, so `rpcBoundary` answers a retryable store failure with `ServiceUnavailable` when the RPC declares it; a non-retryable one, such as a missing table, still answers the unexpected rejection and is reported.
