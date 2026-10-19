---
"@shivaedev/effect-contract": minor
---

### Added

- `authorizeReads` accepts typed policy failures and preserves them in the query's error channel. Declare those errors in the native RPC middleware's error schema alongside its denial so clients can distinguish an outage from denied access.
- `ReadPolicyMemoWindow`, a `Context.Reference<Duration.Input>`, configures per-subscription, per-key memoisation of successful policy results. The default is one second; provide a shorter duration or `0` to disable it. Queries always check afresh, and failures are never memoised.

### Fixed

- Failed live hint checks omit the affected keys and keep the stream open. Scoped rechecks after one second deliver an allowed key after recovery without another change or reconnect; a `false` does not schedule a recheck.

### Breaking

- Direct readers of `ReadPolicy` now receive `Effect<boolean, unknown>` instead of an infallible Effect. Handle its error channel when invoking the reference directly. Existing infallible policies passed to `authorizeReads` still work; fallible policies should declare their errors in their RPC middleware schema.
