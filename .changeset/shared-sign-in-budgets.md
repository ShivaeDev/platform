---
"@shivaedev/identity": minor
---

### Breaking

- Sign-in rate limits use the host's `@shivaedev/rate-limit` Store. Provide `memoryStore` once around the host, or migrate `rate_limit_windows` with `postgresMigration` and provide `postgresStore` to share budgets across processes. Better Auth still chooses rules and client-IP keys, but its `storage` and `customStorage` options are overridden; migrate custom storage to a Store implementation. Windows now expire from the first admitted attempt, and all mounts using the same store share their budget.
- Remove `server/better-auth/memoryRateLimit.ts`. Consumers importing it must provide a shared Store to `betterAuthMount` instead.
