# Changelog

## 0.2.0 - 2026-11-02

### Added

- `@shivaedev/errors`' shared `TooManyRequests` accepts optional `key` and `retryAt` fields, preserving rate-limit details across RPC while still accepting message-only failures.

### Breaking

- `@shivaedev/rate-limit` now fails with the shared `TooManyRequests`. Replace imports from `@shivaedev/rate-limit/TooManyRequests.ts` with `@shivaedev/errors/taxonomy.ts` and add `@shivaedev/errors` as a dependency. Use that shared schema in contract rejections and custom stores. Its `key` and `retryAt` fields are optional because other callers can create message-only failures; check for their presence before using them. The limiter continues to supply both fields. The old module is removed without an alias.

## 0.1.0 - 2026-11-01

### Added

- Admit per-key budgets through `@shivaedev/rate-limit`, with an Effect-clock memory store, a PostgreSQL adapter, and typed `TooManyRequests` carrying a retry time.
- Include rate limiting in Platform and demonstrate a per-user note creation budget in generated applications.
