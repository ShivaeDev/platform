# `@shivaedev/effect-prisma`

Effect-native PostgreSQL queries and transactions backed by Prisma Next.

This package currently targets exact early-access versions of Effect v4 and
Prisma Next. It is built for ShivaeDev applications and may change without a
deprecation period.

## Install

```sh
pnpm add @shivaedev/effect-prisma effect
```

Generate a Prisma Next contract in the application, then create its database
service:

```ts
import { makeDatabase } from "@shivaedev/effect-prisma"
import { contractJson, type Contract } from "./generated/contract.js"

export const Database = makeDatabase<Contract>("@app/Database", {
  contractJson,
})

export const DatabaseLive = Database.layer({
  url: process.env.DATABASE_URL!,
})
```

The Layer owns the PostgreSQL client and closes it with its Effect scope.

## Queries

Yield the database service once and use generated models directly:

```ts
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const db = yield* Database

  const active = db.User.where({ active: true })
  const newest = active.orderBy((user) => user.createdAt.desc())

  const users = yield* newest.take(20)
  const first = yield* active.first()
  const exists = yield* active.exists()

  return { users, first, exists }
})
```

Relations are lazy and immutable. Reusing or branching a Relation never changes
the original, and each execution resolves the active database context again.

Collections are also cold Effect Streams:

```ts
const stream = db.User.where({ active: true }).stream
```

The initial package covers scalar models, filtering, selection, ordering,
pagination, distinct queries, aggregates, grouping, and create/update/delete
terminals. Relation includes and model variants are deliberately deferred
rather than exposed with weakened types.

## Transactions

Transactions keep the same database API and are implicitly scoped:

```ts
yield* db.transaction(
  Effect.gen(function* () {
    const db = yield* Database
    yield* db.User.create({
      id,
      email,
      name,
    })
  }),
)
```

Nested package transactions reuse the active transaction. Successful programs
commit; failure, defect, and interruption roll back.

## Vitest

Install `@effect/vitest` to use the optional testing entrypoint:

```sh
pnpm add --save-dev @effect/vitest vitest
```

Configure the database once in the application's test support:

```ts
import { makeDatabaseIt } from "@shivaedev/effect-prisma/testing"

export const it = makeDatabaseIt({
  database: Database,
  layer: DatabaseTest,
})
```

Tests receive the typed database facade and always roll back:

```ts
it.effectDB("creates a user", function* (db) {
  const user = yield* db.User.create({
    id,
    email,
    name,
  })

  expect(user.email).toBe(email)
})
```

`effectDB` supports the usual `skip`, `skipIf`, `runIf`, `only`, `each`, and
`fails` variants. `withTestTransaction` is also exported for custom harnesses.
