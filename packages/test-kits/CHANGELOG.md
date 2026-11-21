# Changelog

## 0.16.7 - 2026-11-21

### Changed

- Update `@shivaedev/server` from 0.44.0 to 0.44.1.

## 0.16.6 - 2026-11-21

### Changed

- Update `@shivaedev/email` from 0.8.4 to 0.8.5.
- Update `@shivaedev/identity` from 0.40.0 to 0.41.0.
- Update `@shivaedev/server` from 0.43.0 to 0.44.0.

## 0.16.5 - 2026-11-21

### Changed

- Update `@shivaedev/email` from 0.8.3 to 0.8.4.
- Update `@shivaedev/identity` from 0.39.0 to 0.40.0.
- Update `@shivaedev/jobs` from 0.44.0 to 0.44.1.
- Update `@shivaedev/rate-limit` from 0.8.0 to 0.8.1.
- Update `@shivaedev/server` from 0.42.0 to 0.43.0.
- Update `@shivaedev/sql` from 0.54.0 to 0.55.0.
- Update `@shivaedev/test-sql` from 0.26.0 to 0.26.1.
- Update `@shivaedev/test-story` from 0.52.4 to 0.52.5.
- Update `@shivaedev/webhooks` from 0.13.0 to 0.13.1.

## 0.16.4 - 2026-11-21

### Changed

- Update `@shivaedev/contract` from 0.57.0 to 0.58.0.
- Update `@shivaedev/email` from 0.8.2 to 0.8.3.
- Update `@shivaedev/identity` from 0.38.3 to 0.39.0.
- Update `@shivaedev/server` from 0.41.2 to 0.42.0.
- Update `@shivaedev/test-story` from 0.52.3 to 0.52.4.
- Update `@shivaedev/webhooks` from 0.12.7 to 0.13.0.

## 0.16.3 - 2026-11-21

### Changed

- Update `@shivaedev/contract` from 0.56.0 to 0.57.0.
- Update `@shivaedev/email` from 0.8.1 to 0.8.2.
- Update `@shivaedev/identity` from 0.38.2 to 0.38.3.
- Update `@shivaedev/server` from 0.41.1 to 0.41.2.
- Update `@shivaedev/test-story` from 0.52.2 to 0.52.3.

## 0.16.2 - 2026-11-21

### Changed

- Update `@shivaedev/contract` from 0.55.0 to 0.56.0.
- Update `@shivaedev/email` from 0.8.0 to 0.8.1.
- Update `@shivaedev/identity` from 0.38.1 to 0.38.2.
- Update `@shivaedev/server` from 0.41.0 to 0.41.1.
- Update `@shivaedev/test-story` from 0.52.1 to 0.52.2.

## 0.16.1 - 2026-11-21

### Changed

- Update `@shivaedev/contract` from 0.54.1 to 0.55.0.
- Update `@shivaedev/email` from 0.7.16 to 0.8.0.
- Update `@shivaedev/identity` from 0.38.0 to 0.38.1.
- Update `@shivaedev/server` from 0.40.0 to 0.41.0.
- Update `@shivaedev/test-story` from 0.52.0 to 0.52.1.

## 0.16.0 - 2026-11-21

### Added

- `layerLiveMemoryProtocol(group, handlers)` and `liveHost(group, handlers, { protocol })` from `@shivaedev/test-kits/contract/liveMemoryProtocol.ts` serve a module's queries and commands as a live host through server's `servedGroup` and `servedHandlers`, so a story's client runs live as it does against the application host, and a `$changes` subscription over `protocol: "http"` is refused with `WebSocketRequired` as the host refuses it. Pass one `liveChannel()` as `channel` to several `liveHost` calls when their transports must share one change channel.
- `mintUser(declaration, host, name, { role })` in `identity/adapters/betterAuth.ts` returns a signed-in user from the application's auth declaration, through a test-only mount with Better Auth's `testUtils()`, the host's origin and secure-cookie choice and the declaration's `secret` or the exported `AUTH_TEST_SECRET`. `storyAuth(declaration, host)` returns that test-only Better Auth instance. The package now declares `@shivaedev/rate-limit` as a peer.

## 0.15.0 - 2026-11-21

### Breaking

- import from `@shivaedev/test-kits/discord/rest.ts` instead of `@shivaedev/test-kits/discord/adapters/rest.ts`, which moved out of `adapters/`.
- import from `@shivaedev/test-kits/github/webhookDelivery.ts` instead of `@shivaedev/test-kits/github/adapters/webhookDelivery.ts`, which moved out of `adapters/`.
- import from `@shivaedev/test-kits/jobs/queueSignal.ts` instead of `@shivaedev/test-kits/jobs/adapters/queueSignal.ts`, which moved out of `adapters/`.
- import from `@shivaedev/test-kits/jobs/quotedSchema.ts` instead of `@shivaedev/test-kits/jobs/adapters/quotedSchema.ts`, which moved out of `adapters/`.
- import from `@shivaedev/test-kits/jobs/testingSignal.ts` instead of `@shivaedev/test-kits/jobs/adapters/testingSignal.ts`, which moved out of `adapters/`.

## 0.14.0 - 2026-11-20

### Added

- `memoryQueryStorage()` in `contract/memoryQueryStorage.ts` returns an in-memory `QueryStorageProvider` Layer and the entries it holds per user, for specs of stored query results.

## 0.13.7 - 2026-11-20

### Changed

- Update `@shivaedev/contract` from 0.51.0 to 0.52.0.
- Update `@shivaedev/identity` from 0.34.2 to 0.35.0.
- Update `@shivaedev/test-story` from 0.50.0 to 0.50.1.

## 0.13.6 - 2026-11-20

### Changed

- Update `@shivaedev/contract` from 0.50.0 to 0.51.0.
- Update `@shivaedev/identity` from 0.34.1 to 0.34.2.
- Update `@shivaedev/test-story` from 0.49.1 to 0.50.0.
- Update `@shivaedev/webhooks` from 0.12.4 to 0.12.5.

## 0.13.5 - 2026-11-20

### Changed

- Update `@shivaedev/contract` from 0.49.0 to 0.50.0.
- Update `@shivaedev/discord` from 0.4.5 to 0.4.6.
- Update `@shivaedev/email` from 0.7.13 to 0.7.14.
- Update `@shivaedev/errors` from 0.13.1 to 0.14.0.
- Update `@shivaedev/identity` from 0.34.0 to 0.34.1.
- Update `@shivaedev/jobs` from 0.43.0 to 0.43.1.
- Update `@shivaedev/sql` from 0.51.0 to 0.52.0.
- Update `@shivaedev/test-sql` from 0.25.4 to 0.25.5.
- Update `@shivaedev/test-story` from 0.49.0 to 0.49.1.
- Update `@shivaedev/webhooks` from 0.12.3 to 0.12.4.

## 0.13.4 - 2026-11-20

### Changed

- Require Effect 4.1.4 and its matching platform packages.

## 0.13.3 - 2026-11-19

### Changed

- Update `@shivaedev/changes` from 0.13.0 to 0.14.0.
- Update `@shivaedev/contract` from 0.47.0 to 0.48.0.
- Update `@shivaedev/email` from 0.7.11 to 0.7.12.
- Update `@shivaedev/errors` from 0.12.0 to 0.13.0.
- Update `@shivaedev/identity` from 0.32.3 to 0.33.0.
- Update `@shivaedev/jobs` from 0.42.4 to 0.42.5.
- Update `@shivaedev/sql` from 0.49.0 to 0.50.0.
- Update `@shivaedev/test-sql` from 0.25.2 to 0.25.3.
- Update `@shivaedev/test-story` from 0.48.0 to 0.48.1.
- Update `@shivaedev/webhooks` from 0.12.1 to 0.12.2.

## 0.13.2 - 2026-11-18

### Changed

- Update `@shivaedev/contract` from 0.46.0 to 0.47.0.
- Update `@shivaedev/identity` from 0.32.2 to 0.32.3.
- Update `@shivaedev/test-story` from 0.47.3 to 0.48.0.

## 0.13.1 - 2026-11-18

### Changed

- Update `@shivaedev/changes` from 0.12.0 to 0.13.0.
- Update `@shivaedev/contract` from 0.45.0 to 0.46.0.
- Update `@shivaedev/email` from 0.7.10 to 0.7.11.
- Update `@shivaedev/identity` from 0.32.1 to 0.32.2.
- Update `@shivaedev/jobs` from 0.42.3 to 0.42.4.
- Update `@shivaedev/sql` from 0.48.0 to 0.49.0.
- Update `@shivaedev/test-sql` from 0.25.1 to 0.25.2.
- Update `@shivaedev/test-story` from 0.47.2 to 0.47.3.
- Update `@shivaedev/webhooks` from 0.12.0 to 0.12.1.

## 0.13.0 - 2026-11-18

### Breaking

- `layerMemoryProtocol(group)` runs the application host's `schemaSensitiveKeys` check over the group before it serves, and dies with the host's `SensitiveFieldConflict` or `InvalidRedactionMask` and its message. A spec can newly fail only for a group the host already refuses to start with: follow the message, which names both schema paths, and rename one field or mark both sensitive. When the host resolves the conflict through `config.sensitiveKeys`, pass the same list as `layerMemoryProtocol(group, { sensitiveKeys })`.
- `@shivaedev/errors` is a peer dependency. Applications that install `@shivaedev/platform` already have it; a library that installs test-kits directly adds `@shivaedev/errors`.

## 0.12.1 - 2026-11-11

### Changed

- Update `@shivaedev/identity` from 0.31.2 to 0.32.0.
- Update `@shivaedev/test-sql` from 0.24.9 to 0.25.0.
- Update `@shivaedev/test-story` from 0.47.0 to 0.47.1.

## 0.12.0 - 2026-11-11

### Changed

- the SQL change-coverage check calls `transact` without an identity `onSqlError` and needs the `@shivaedev/sql` release that allows it; its behavior is unchanged.

### Breaking

- `hostProcess()` no longer returns `disconnectIdlePostgres()`, and a `databaseUrl` now reaches the child's `DATABASE_URL` directly instead of through a disconnect proxy. Delete the stories that call `disconnectIdlePostgres()`; database outages are not a tested scenario.

## 0.11.1 - 2026-11-10

### Changed

- Update `@shivaedev/contract` from 0.43.4 to 0.43.5.
- Update `@shivaedev/identity` from 0.31.0 to 0.31.1.
- Update `@shivaedev/test-story` from 0.46.0 to 0.46.1.

## 0.11.0 - 2026-11-08

### Breaking

- Move `testingOperation` from `@shivaedev/test-kits/jobs/testingOperation.ts` to `@shivaedev/test-kits/jobs/adapters/testingOperation.ts`, and `testingInspection` from the same module to `@shivaedev/test-kits/jobs/testingInspection.ts`; update imports to the new paths.

## 0.10.7 - 2026-11-08

### Changed

- Update `@shivaedev/contract` from 0.43.3 to 0.43.4.
- Update `@shivaedev/discord` from 0.4.2 to 0.4.3.
- Update `@shivaedev/email` from 0.7.6 to 0.7.7.
- Update `@shivaedev/identity` from 0.30.5 to 0.30.6.
- Update `@shivaedev/jobs` from 0.41.4 to 0.42.0.
- Update `@shivaedev/sql` from 0.46.3 to 0.46.4.
- Update `@shivaedev/test-sql` from 0.24.7 to 0.24.8.
- Update `@shivaedev/test-story` from 0.45.5 to 0.45.6.
- Update `@shivaedev/webhooks` from 0.11.8 to 0.11.9.

## 0.10.6 - 2026-11-07

### Changed

- Update `@shivaedev/contract` from 0.43.2 to 0.43.3.
- Update `@shivaedev/identity` from 0.30.4 to 0.30.5.
- Update `@shivaedev/test-story` from 0.45.4 to 0.45.5.

## 0.10.5 - 2026-11-07

### Changed

- Update `@shivaedev/email` from 0.7.5 to 0.7.6.
- Update `@shivaedev/identity` from 0.30.3 to 0.30.4.
- Update `@shivaedev/jobs` from 0.41.3 to 0.41.4.
- Update `@shivaedev/sql` from 0.46.2 to 0.46.3.
- Update `@shivaedev/test-sql` from 0.24.6 to 0.24.7.
- Update `@shivaedev/test-story` from 0.45.3 to 0.45.4.
- Update `@shivaedev/webhooks` from 0.11.7 to 0.11.8.

## 0.10.4 - 2026-11-07

### Changed

- Update `@shivaedev/contract` from 0.43.1 to 0.43.2.
- Update `@shivaedev/discord` from 0.4.1 to 0.4.2.
- Update `@shivaedev/email` from 0.7.4 to 0.7.5.
- Update `@shivaedev/identity` from 0.30.2 to 0.30.3.
- Update `@shivaedev/jobs` from 0.41.2 to 0.41.3.
- Update `@shivaedev/sql` from 0.46.1 to 0.46.2.
- Update `@shivaedev/test-sql` from 0.24.5 to 0.24.6.
- Update `@shivaedev/test-story` from 0.45.2 to 0.45.3.
- Update `@shivaedev/webhooks` from 0.11.6 to 0.11.7.

## 0.10.3 - 2026-11-07

### Changed

- Update `@shivaedev/webhooks` from 0.11.5 to 0.11.6.

## 0.10.2 - 2026-11-07

### Changed

- Update `@shivaedev/changes` from 0.11.0 to 0.11.1.
- Update `@shivaedev/contract` from 0.43.0 to 0.43.1.
- Update `@shivaedev/discord` from 0.4.0 to 0.4.1.
- Update `@shivaedev/email` from 0.7.3 to 0.7.4.
- Update `@shivaedev/identity` from 0.30.1 to 0.30.2.
- Update `@shivaedev/jobs` from 0.41.1 to 0.41.2.
- Update `@shivaedev/sql` from 0.46.0 to 0.46.1.
- Update `@shivaedev/test-sql` from 0.24.4 to 0.24.5.
- Update `@shivaedev/test-story` from 0.45.1 to 0.45.2.
- Update `@shivaedev/webhooks` from 0.11.4 to 0.11.5.

## 0.10.1 - 2026-11-07

### Changed

- Update `@shivaedev/email` from 0.7.2 to 0.7.3.
- Update `@shivaedev/identity` from 0.30.0 to 0.30.1.
- Update `@shivaedev/jobs` from 0.41.0 to 0.41.1.
- Update `@shivaedev/sql` from 0.45.0 to 0.46.0.
- Update `@shivaedev/test-sql` from 0.24.3 to 0.24.4.
- Update `@shivaedev/test-story` from 0.45.0 to 0.45.1.
- Update `@shivaedev/webhooks` from 0.11.3 to 0.11.4.

## 0.10.0 - 2026-11-06

### Breaking

- Replace key-based `heard` assertions with delivered query values or mounted query completion signals. `watchHints` observes pushed query updates.

## 0.9.3 - 2026-11-06

### Changed

- Update `@shivaedev/email` from 0.7.1 to 0.7.2.
- Update `@shivaedev/identity` from 0.29.1 to 0.29.2.
- Update `@shivaedev/jobs` from 0.40.1 to 0.41.0.
- Update `@shivaedev/sql` from 0.44.0 to 0.45.0.
- Update `@shivaedev/test-sql` from 0.24.2 to 0.24.3.
- Update `@shivaedev/test-story` from 0.44.1 to 0.44.2.
- Update `@shivaedev/webhooks` from 0.11.2 to 0.11.3.

## 0.9.2 - 2026-11-06

### Changed

- Update `@shivaedev/contract` from 0.41.0 to 0.42.0.
- Update `@shivaedev/identity` from 0.29.0 to 0.29.1.
- Update `@shivaedev/test-story` from 0.44.0 to 0.44.1.

## 0.9.1 - 2026-11-06

### Changed

- Update `@shivaedev/test-story` from 0.43.0 to 0.44.0.

## 0.9.0 - 2026-11-06

### Changed

- Contract story listeners accept initial results alongside change hints.

### Breaking

- `HintViewer.hints` contains `QueryUpdate` values, including results. Custom readout renderers must handle `Result` and `Unchanged` alongside hints.

## 0.8.1 - 2026-11-05

### Changed

- Update `@shivaedev/contract` from 0.39.0 to 0.40.0.
- Update `@shivaedev/discord` from 0.3.0 to 0.4.0.
- Update `@shivaedev/email` from 0.6.0 to 0.7.0.
- Update `@shivaedev/identity` from 0.27.0 to 0.28.0.
- Update `@shivaedev/jobs` from 0.39.0 to 0.40.0.
- Update `@shivaedev/sql` from 0.42.0 to 0.43.0.
- Update `@shivaedev/test-sql` from 0.24.0 to 0.24.1.
- Update `@shivaedev/test-story` from 0.42.0 to 0.42.1.
- Update `@shivaedev/webhooks` from 0.11.0 to 0.11.1.

## 0.8.0 - 2026-11-05

### Breaking

- Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.

## 0.7.0 - 2026-11-05

### Breaking

- Replace `jobs/internal/` with `jobs/` in module imports.

## 0.6.0 - 2026-11-05

### Added

- Publish host process and controlled clock helpers, settled query observations and signed webhook delivery helpers.
- Publish `fakeOauthProvider` for application sign-in stories over real HTTP, with OAuth authorization codes, consent refusal, controlled expiry, profiles and OIDC discovery with signed ID tokens.

## 0.5.0 - 2026-11-04

### Added

- Publish a scoped fake GitHub App with real HTTP installation-token exchanges, configurable REST and GraphQL routes, provider fault controls and signed webhook delivery for application stories.

## 0.4.0 - 2026-11-04

### Added

- Provide the pg-boss testing controller in test-kits, using jobs’ public client and inspection service with the real PostgreSQL engine.

### Changed

- Require Effect 4.0.7 and its matching companion packages. Install the 4.0.7 Effect stack together.

## 0.3.1 - 2026-11-04

### Changed

- Update `@shivaedev/email` from 0.4.0 to 0.4.1.
- Update `@shivaedev/identity` from 0.24.0 to 0.25.0.
- Update `@shivaedev/sql` from 0.37.0 to 0.38.0.
- Update `@shivaedev/test-sql` from 0.20.0 to 0.21.0.
- Update `@shivaedev/test-story` from 0.38.0 to 0.39.0.

## 0.3.0 - 2026-11-04

### Added

- Provides a stateful Discord provider with message HTTP routes and a native gateway socket boundary for stories running the real clients.

### Breaking

- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.2.2 - 2026-11-04

### Changed

- Update `@shivaedev/contract` from 0.34.0 to 0.35.0.
- Update `@shivaedev/identity` from 0.23.0 to 0.23.1.
- Update `@shivaedev/test-sql` from 0.18.2 to 0.19.0.
- Update `@shivaedev/test-story` from 0.37.0 to 0.37.1.

## 0.2.1 - 2026-11-04

### Changed

- Update `@shivaedev/contract` from 0.33.1 to 0.34.0.
- Update `@shivaedev/email` from 0.3.1 to 0.3.2.
- Update `@shivaedev/identity` from 0.22.1 to 0.23.0.
- Update `@shivaedev/sql` from 0.36.0 to 0.36.1.
- Update `@shivaedev/test-sql` from 0.18.1 to 0.18.2.
- Update `@shivaedev/test-story` from 0.36.1 to 0.37.0.

## 0.2.0 - 2026-11-03

### Added

- Issue valid MCP bearer tokens with `mcpBearerToken` using the application's Better Auth issuer, signing key and persisted consent grant, so application stories exercise live grant checks.

## 0.1.1 - 2026-11-03

### Changed

- Update `@shivaedev/identity` from 0.21.0 to 0.22.0.

## 0.1.0 - 2026-11-03

### Added

- Compose email inboxes, Better Auth session preconditions, PostgreSQL change assertions and native RPC subscription helpers in application story kits through domain-specific imports.
