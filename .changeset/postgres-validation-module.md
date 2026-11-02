---
"@shivaedev/local-postgres": minor
---

### Breaking

- Import `assertLocalDatabase` from `@shivaedev/local-postgres/server/assertLocalDatabase.ts` instead of `@shivaedev/local-postgres/server/localPostgres.ts`. The validator has its own module so validation stays independent of process execution; its validation behavior is unchanged.
