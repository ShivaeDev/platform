---
"@shivaedev/contract": minor
"@shivaedev/react": minor
"@shivaedev/server": minor
"@shivaedev/test-kits": minor
"@shivaedev/test-story": minor
---

### Breaking

- `@shivaedev/contract`: Live queries always receive server-pushed results. Remove `live: "rerun-and-compare"` from query declarations; query handlers, result shapes and screens need no changes. Deploy matching client and server versions. Custom subscription hosts must supply an authorized query runner to `subscribe`. Raw consumers handle `Result`, `Unchanged` and `QueryReadDenied` instead of change hints. Remove obsolete query and live connection coalescing settings; coalescing now happens on the server.
- `@shivaedev/react`: Live query screens receive server-pushed values. Remove `SessionBoundary.liveCoalesceWindow` and `QueryOptions.coalesceWindow`; server coalescing applies automatically.
- `@shivaedev/server`: Every hosted live query reloads its subscriber's session, checks its read policy and reruns its handler on matching changes or server reconciliation. Drop the query's `live` option; application handlers and results stay the same.
- `@shivaedev/test-kits`: Replace key-based `heard` assertions with delivered query values or mounted query completion signals. `watchHints` observes pushed query updates.
- `@shivaedev/test-story`: Browser observers receive pushed query updates. Replace `heardKeys` assertions with delivered values or rendered screens; `hints` and `watchHints` now observe `Result`, `Unchanged` and `QueryReadDenied`.

### Changed

- `@shivaedev/contract`: Keep current query values during transient subscription recovery. Explicit refresh retains the value and reports pending until the fresh pushed result arrives; declared query failures and read denials remain visible.

- `@shivaedev/contract`: Coalesce each subscription's pending changes into one rerun, including server-side reconciliation after backlog overflow or PostgreSQL listener recovery. Different subscriptions run independently and in parallel. Changed encoded results are pushed; equal reads acknowledge completion with `Unchanged`.
