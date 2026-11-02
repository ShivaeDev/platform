---
"@shivaedev/contract": minor
"@shivaedev/server": minor
---

### Added

- `@shivaedev/contract`: Observe bound queries with `querySignals(query)`: a native atom reports completed reads, pending requests, and whether their subscription opened or was refused. Refreshes signal completion even when their result is unchanged.

### Breaking

- `@shivaedev/contract`: Rerun-and-compare subscriptions emit an `Unchanged` update with the query index when a completed read preserves its previous value. Consumers of raw `$changes` streams must handle this update; bound queries handle it automatically. Deploy clients and servers together so both understand the updated stream schema.

- `@shivaedev/server`: App-host rerun-and-compare subscriptions emit `Unchanged` updates for equal results. Upgrade raw `$changes` consumers to handle this update and deploy compatible clients and servers together.
