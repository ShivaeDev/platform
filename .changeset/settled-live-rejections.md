---
"@shivaedev/contract": minor
---

### Breaking

- Live subscriptions settle expected failures with `LiveStatus.connection: "failed"`. Add a `"failed"` case to exhaustive connection handlers and show `status.failure`; applications no longer receive repeated attempts for denied reads or declared query errors.

### Fixed

- Keep denied live queries and subscriptions settled until the viewer identity changes or a matching change invalidation arrives. Resume events do not retry a settled rejection.
- Retry transport failures and server outages with jittered exponential backoff. `retryDelay` sets the initial delay; backoff grows to a nominal 30 seconds.

### Added

- Accept `retryKeys` in `live()` to identify changes that reopen a settled subscription independently of its resync scope. It defaults to `resyncKeys`.
