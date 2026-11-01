---
"@shivaedev/errors": minor
"@shivaedev/rate-limit": minor
---

### Added

- `@shivaedev/errors`' shared `TooManyRequests` accepts optional `key` and `retryAt` fields, preserving rate-limit details across RPC while still accepting message-only failures.

### Breaking

- `@shivaedev/rate-limit` now fails with the shared `TooManyRequests`. Replace imports from `@shivaedev/rate-limit/TooManyRequests.ts` with `@shivaedev/errors/taxonomy.ts` and add `@shivaedev/errors` as a dependency. Use that shared schema in contract rejections and custom stores. Its `key` and `retryAt` fields are optional because other callers can create message-only failures; check for their presence before using them. The limiter continues to supply both fields. The old module is removed without an alias.
