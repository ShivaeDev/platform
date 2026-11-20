---
"@shivaedev/access": patch
"@shivaedev/admin": patch
"@shivaedev/agent": patch
"@shivaedev/agent-claude-code": patch
"@shivaedev/agent-codex": patch
"@shivaedev/agent-opencode": patch
"@shivaedev/agent-pi": patch
"@shivaedev/browser-check": patch
"@shivaedev/build": patch
"@shivaedev/changes": patch
"@shivaedev/contract": minor
"@shivaedev/create-app": patch
"@shivaedev/deploy": patch
"@shivaedev/discord": patch
"@shivaedev/email": patch
"@shivaedev/errors": patch
"@shivaedev/events": patch
"@shivaedev/form": patch
"@shivaedev/github": patch
"@shivaedev/heavy-lock": patch
"@shivaedev/http": patch
"@shivaedev/identity": patch
"@shivaedev/jobs": patch
"@shivaedev/local-postgres": patch
"@shivaedev/mcp": patch
"@shivaedev/platform": patch
"@shivaedev/pr-watch": patch
"@shivaedev/quality": patch
"@shivaedev/rate-limit": patch
"@shivaedev/react": patch
"@shivaedev/reconciler": patch
"@shivaedev/releases": patch
"@shivaedev/script": patch
"@shivaedev/server": patch
"@shivaedev/service": patch
"@shivaedev/skills": patch
"@shivaedev/sql": patch
"@shivaedev/supervisor": patch
"@shivaedev/test": patch
"@shivaedev/test-kits": patch
"@shivaedev/test-sql": patch
"@shivaedev/test-story": minor
"@shivaedev/vitest-rerun": patch
"@shivaedev/webhooks": patch
---

### Changed

- `@shivaedev/access`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/admin`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/agent`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/agent-claude-code`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/agent-codex`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/agent-opencode`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/agent-pi`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/browser-check`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/build`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/changes`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/contract`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/create-app`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/deploy`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/discord`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/email`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/errors`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/events`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/form`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/github`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/heavy-lock`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/http`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/identity`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/jobs`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/local-postgres`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/mcp`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/platform`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/pr-watch`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/quality`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/rate-limit`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/react`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/reconciler`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/releases`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/script`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/server`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/service`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/skills`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/sql`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/supervisor`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/test`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/test-kits`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/test-sql`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/test-story`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/vitest-rerun`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/webhooks`: Require Effect 4.1.4 and its matching platform packages.
- `@shivaedev/sql`: closing a `postgresLayer` pool no longer waits for PostgreSQL to acknowledge each disconnect. Effect 4.1.4's PostgreSQL client destroys a connection's socket once its `Terminate` has flushed, so a half-open peer cannot hold shutdown.
- `@shivaedev/server`: closing `appDatabase`, and interrupting a host that waits for migrations, end the pool's connections without waiting for PostgreSQL's disconnect acknowledgements.
- `@shivaedev/contract`: a handler may also fail with an error that one of its contract's RPC middleware declares, as native Effect 4.1.4 `Rpc` handlers do. Any other undeclared error still fails compilation.
- `@shivaedev/mcp`: a stdio server whose client closes its input interrupts in-flight tools, releases their resources and exits with code 0 instead of 130. An invalid numeric tool argument is reported against Effect 4.1.4's JSON number codec, such as `Expected "Infinity" | "-Infinity" | "NaN"`, instead of `Expected number`.
- `@shivaedev/test-story`: an OTLP span that succeeded arrives with status code 0 (unset) instead of 1 (ok), because Effect 4.1.4's OTLP tracer leaves the status of successful spans unset.

### Breaking

- `@shivaedev/test-story`: a watched clock publishes its sleep starts as `sleepStarts` instead of `sleeps`. Effect 4.1.4 keeps its TestClock sleep queue in the instance field `sleeps`, so the watched clock no longer writes a field of that name. Rename `clock.sleeps` to `clock.sleepStarts` where a kit reads `watchedClock`'s stream.
- `@shivaedev/contract`: `ChangesClient` moves from `automaticLive.ts` to `adapters/erasedClient.ts`, and `automaticLive` takes the contract's `AtomRpcClient<unknown, string, Rpc.Any>`. `liveSyncRequest` takes a flat client of `Rpc.Any | LiveSyncRpc` (`LiveSyncRpc` from `liveSyncRpc.ts`) and returns the sync command's typed Effect. Import `ChangesClient` from its new module; a client made by `makeClient` or `RpcClient.make` over a group that includes `liveSyncRpc` already has the new type.
