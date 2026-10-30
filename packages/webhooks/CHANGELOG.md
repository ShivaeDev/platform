# Changelog

## 0.3.0 - 2026-10-30

### Added

- Let `webhookEvent` mappings return an Effect with application services and typed failures. Existing pure mappings continue to work through `webhookRoute`. Empty job lists receive `200 ignored`; failed checks roll back the receipt and jobs and receive `503` with redacted failure reporting.

## 0.2.1 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.2.0 - 2026-10-30

### Added

- Jobs services share one scoped pg-boss client through the Effect environment. Registration, worker and producer Layers use the same connection and pool settings.
- Service definitions accept marked generic methods alongside declared dependencies. Generic signatures retain their caller requirements unchanged; initialization can capture declared dependencies as private state.

### Changed

- Remove the null internal export exclusion so module imports follow the package's file paths.

### Fixed

- Decode receipt reads with Schema.
- Receiving a delivery records a `Webhooks.receive` span.
- Receipt storage and enqueue failures log a redacted cause with their error tag at error level before answering 503. The HTTP request span keeps the redacted original failure without request credentials.

### Breaking

- Request body reads fail with HTTP 413 before reading when Effect's `HttpIncomingMessage.MaxBodySize` is undefined. Provide a finite byte limit through `Effect.provideService(HttpIncomingMessage.MaxBodySize, ByteSize.bytes(limit))` when mounting native routes or webhook routes outside `appHost`.
- `RequestBodyTooLarge` is a Schema tagged error carrying a numeric `limit` in bytes, with `0` for an unconfigured limit. Replace bigint comparisons with number comparisons and obtain request context separately; the error no longer carries `request` or its headers.
- Move connection, pool, client factory, cache key and stop options from each `Jobs.layer` call into one `pgBossLayer` from `@shivaedev/jobs/server/service.ts`. Supply `connectionString` as `Redacted<string>` and provide that Layer to the merged jobs services. Keep only `jobs` and `onError` in `Jobs.layer`.
- Call `jobs.health()` instead of yielding `jobs.health`. Custom jobs service implementations must expose health as a method. Admin's built-in jobs handlers call the method automatically. Jobs services passed to webhook routes and enqueue helpers must also implement the new method shape.
- Server modules move under `server/`. Replace imports of `@shivaedev/webhooks/{github,registration,route,webhookReceipts,WebhookUnauthorized}.ts` with `@shivaedev/webhooks/server/{github,registration,route,webhookReceipts,WebhookUnauthorized}.ts`.
- Receipt `job_ids` is now PostgreSQL `text[]`. Stop older webhook receivers, apply the existing `webhookReceipts` component to migrate persisted JSON receipts, then start the new receivers. Direct SQL consumers must replace JSON operators with PostgreSQL array operations. Check and wait modes report pending receipt migrations.
- The webhook route Layer preserves signing-key `ConfigError` failures instead of converting them to defects. Consumers must propagate or handle this typed error at application startup; remove `Layer.orDie` when composing the route into the app host.

## 0.1.3 - 2026-10-30

### Changed

- Require Effect 4.0.6 and align the Effect companion package peers and generated starter catalog to the same exact release. Install the 4.0.6 Effect stack together.

### Fixed

- Register hosted RPC cache-control handling through Effect 4.0.6's request-scoped pre-response API so responses keep `private, no-store`.
- Accept native RPC's `application/x-ndjson` media type while preserving `application/ndjson` callers at the transport guard.
- Keep subscriptions open after their HTTP request body completes; closing the socket still cancels them.

## 0.1.2 - 2026-10-29

### Changed

- Release with updated workspace dependencies.

## 0.1.1 - 2026-10-28

### Changed

- Release with updated workspace dependencies.

## 0.1.0 - 2026-10-27

### Added

- Receive signed deliveries through an HttpRouter Layer, record deduplicated receipts and queue typed jobs atomically, with a GitHub strategy and a receipt SchemaComponent.
