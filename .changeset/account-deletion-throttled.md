---
"@shivaedev/identity": minor
---

### Added

- The account `delete` command admits three attempts per person in ten seconds, the budget Better Auth gives `/change-email`, through `@shivaedev/rate-limit`, and refuses a further attempt with `TooManyRequests`, which a form hook shows as a notice.

### Breaking

- `accountDeletion` requires a rate-limit `Store` from `@shivaedev/rate-limit/Store.ts`. Add one to the account registration's `ports`, such as `ports: memoryStore` with `memoryStore` from `@shivaedev/rate-limit/memoryStore.ts`, or provide the application's shared `postgresStore`.
