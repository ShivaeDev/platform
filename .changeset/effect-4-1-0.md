---
"@shivaedev/access": minor
"@shivaedev/admin": minor
"@shivaedev/agent": minor
"@shivaedev/agent-claude-code": minor
"@shivaedev/agent-codex": minor
"@shivaedev/agent-opencode": minor
"@shivaedev/agent-pi": minor
"@shivaedev/browser-check": minor
"@shivaedev/changes": minor
"@shivaedev/contract": minor
"@shivaedev/create-app": minor
"@shivaedev/discord": minor
"@shivaedev/email": minor
"@shivaedev/errors": minor
"@shivaedev/events": minor
"@shivaedev/form": minor
"@shivaedev/github": minor
"@shivaedev/heavy-lock": minor
"@shivaedev/http": minor
"@shivaedev/identity": minor
"@shivaedev/jobs": minor
"@shivaedev/local-postgres": minor
"@shivaedev/mcp": minor
"@shivaedev/platform": minor
"@shivaedev/pr-watch": minor
"@shivaedev/quality": minor
"@shivaedev/rate-limit": minor
"@shivaedev/react": minor
"@shivaedev/reconciler": minor
"@shivaedev/releases": minor
"@shivaedev/script": minor
"@shivaedev/server": minor
"@shivaedev/service": minor
"@shivaedev/skills": minor
"@shivaedev/sql": minor
"@shivaedev/supervisor": minor
"@shivaedev/test": minor
"@shivaedev/test-kits": minor
"@shivaedev/test-sql": minor
"@shivaedev/test-story": minor
"@shivaedev/vitest-rerun": minor
"@shivaedev/webhooks": minor
---

### Breaking

- `@shivaedev/access`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/admin`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/agent`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/agent-claude-code`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/agent-codex`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/agent-opencode`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/agent-pi`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/browser-check`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/changes`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/contract`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together. Live query rerun-and-compare now requires Effect's `Digest` service from `effect/crypto` instead of `Crypto`; `@shivaedev/server` and `clientCrypto` from `@shivaedev/react` provide it.
- `@shivaedev/create-app`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together. Generated apps pin the Effect stack to 4.1.0, and `createApp` requires `SecureRandom` from `effect/crypto` instead of `Crypto`.
- `@shivaedev/discord`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/email`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/errors`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/events`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/form`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/github`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/heavy-lock`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together. `HeavyLockServices` requires `SecureRandom` from `effect/crypto` instead of `Crypto`; provide `NodeCrypto.layerSecureRandom` beside `NodeServices.layer`.
- `@shivaedev/http`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/identity`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together. `localOwner` and `machineTokens` require `SecureRandom` and `Digest` from `effect/crypto` instead of `Crypto`; the server host provides both.
- `@shivaedev/jobs`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/local-postgres`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/mcp`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together. A tool's `dependencies` are request-level in Effect 4.1.0, so `Layer.provide` of the service no longer satisfies them. Supply them through `McpServer.middleware<{ provides: Service }>()((effect) => Effect.provideService(effect, Service, value)).layer` provided to the tools layer.
- `@shivaedev/platform`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together. Then migrate the Effect 4.1.0 breaks:
  - `Crypto` from `effect` and `effect/testing/TestCrypto` are gone. Read random bytes and UUIDs from `SecureRandom` and hashes from `Digest` in `effect/crypto` (`random.randomBytes(n)`, `random.uuidV4()`, `digest.digestHex(Digest.sha256, bytes)`); these no longer fail, so drop their `Effect.orDie`.
  - `NodeServices.layer` no longer provides crypto. Add `NodeCrypto.layer` (every `effect/crypto` service) or `NodeCrypto.layerSecureRandom` from `@effect/platform-node`.
  - `NodeSocket.layerWebSocketConstructorWS` and `NodeSocket.NodeWS` moved to `@effect/platform-node/NodeWS` as `layerWebSocketConstructor` and the module itself. `NodeSocket.layerWebSocketConstructor` and `NodeSocket.layerWebSocket` now always use Node's global WebSocket, so a client that needs `ws`, such as one on a `ws+unix://` URL, uses `Socket.layerWebSocket(url).pipe(Layer.provide(NodeWS.layerWebSocketConstructor))`.
  - `Migrator.fromFileSystem` moved to `fromFileSystem` in `effect/sql/MigratorFileSystem`.
  - `sql.insert` and `sql.updateValues` take a non-empty array; narrow with `Array.isReadonlyArrayNonEmpty` first.
  - A hand-built `PgClient.PgClient` needs `poolStats`, and `ChildProcess` command `args` may hold `Redacted` values.
- `@shivaedev/pr-watch`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/quality`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together. The `ambient-runtime` lint rule now points at `SecureRandom` from `effect/crypto`.
- `@shivaedev/rate-limit`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/react`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together. `clientCrypto` provides `SecureRandom` and `Digest` from `effect/crypto` instead of `Crypto`, and `useNewId` needs an atom runtime with `SecureRandom`. Replace `Crypto.Crypto` in handler and runtime types with those services.
- `@shivaedev/reconciler`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/releases`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/script`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/server`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together. The host provides every `effect/crypto` service of `NodeCrypto.layer`, such as `SecureRandom` and `Digest`, instead of `Crypto`. Read invite codes and tokens through `SecureRandom`.
- `@shivaedev/service`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/skills`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/sql`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together. Read migration folders with `MigratorFileSystem.fromFileSystem` from `effect/sql/MigratorFileSystem`; `migrationsFromDirectory` is unchanged.
- `@shivaedev/supervisor`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/test`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/test-kits`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/test-sql`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/test-story`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together. Stories get the `effect/crypto` services of `NodeCrypto.layer` with a seeded `SecureRandom` instead of `TestCrypto`. Kits that named `Crypto.Crypto` use `StoryCrypto` from `server/storyIt.ts`.
- `@shivaedev/vitest-rerun`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
- `@shivaedev/webhooks`: Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.
