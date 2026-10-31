---
"@shivaedev/contract": minor
"@shivaedev/test-story": minor
---

### Added

- Contract clients expose `clientActivity(client)`, a native Effect `Stream` with a `current` Effect reporting finite RPC calls, queued live invalidations, refreshing query atoms and received live hints.
- Screen drivers accept that activity as `pending`, wait for idle activity with their renderer before screen assertions, and expose `nextLiveHint()` for the next client delivery. Stories keep live coalescing enabled.
