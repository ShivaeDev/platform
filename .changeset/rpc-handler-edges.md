---
"@shivaedev/work-board": minor
"@shivaedev/create-app": patch
---

### Fixed

- `@shivaedev/work-board`: Response and handoff services preserve typed storage failures and leave defects for the RPC handler to mask as internal server errors with their original server-side cause.
- `@shivaedev/create-app`: Generated starter apps check note read access without an RPC boundary inside the callback. Unreadable stored notes report unavailable access, and missing notes and database outages retain their native failures.

### Breaking

- `@shivaedev/work-board`: Response and handoff helpers now accept snapshots that fail with `ServiceUnavailable`, and `awaitResponse` accepts the native `readResponses` failure types. Map storage/index failures with `Effect.mapError` before supplying these helpers; apply `rpcBoundary` when building RPC handlers instead of supplying wire-level rejection unions to services.
