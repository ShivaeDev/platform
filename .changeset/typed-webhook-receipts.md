---
"@shivaedev/webhooks": minor
---

### Breaking

- Server modules move under `server/`. Replace imports of `@shivaedev/webhooks/{github,registration,route,webhookReceipts,WebhookUnauthorized}.ts` with `@shivaedev/webhooks/server/{github,registration,route,webhookReceipts,WebhookUnauthorized}.ts`.
- Receipt `job_ids` is now PostgreSQL `text[]`. Stop older webhook receivers, apply the existing `webhookReceipts` component to migrate persisted JSON receipts, then start the new receivers. Direct SQL consumers must replace JSON operators with PostgreSQL array operations. Check and wait modes report pending receipt migrations.

### Fixed

- Decode receipt reads with Schema.
- Receiving a delivery records a `Webhooks.receive` span.

### Changed

- Remove the null internal export exclusion so module imports follow the package's file paths.
