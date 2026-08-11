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

```sh
prisma-next contract emit
effect-prisma-normalize path/to/generated/contract.d.ts
```

The normalization step is idempotent and currently required because Prisma
Next's generated PostgreSQL timestamp output declarations do not match its
runtime `Date` codecs. It fails when Prisma emits an unfamiliar timestamp shape
instead of silently producing weakened types.

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

## SQLite (experimental)

A SQLite contract emitted with `@prisma-next/sqlite` uses the same API through a
separate entrypoint. Its `DateTime` fields already declare `Date`, so the
normalization step above is PostgreSQL-only.

```ts
import { makeSqliteDatabase } from "@shivaedev/effect-prisma/sqlite"
import { contractJson, type Contract } from "./generated/contract.js"

export const Database = makeSqliteDatabase<Contract>("@app/Database", {
  contractJson,
})

export const DatabaseLive = Database.layer({
  path: "app.db",
})
```

The Layer applies `journal_mode=WAL` when it connects; pass `pragmas` to change
that list. Prisma Next's SQLite driver already sets `foreign_keys` and
`busy_timeout` on every connection it opens, and it opens a separate connection
per transaction, so in-memory databases are rejected.

That driver is synchronous. Queries block the event loop while they run, and
because SQLite allows a single writer, overlapping write transactions wait for
`busy_timeout` before failing with a transient `PrismaConnectionFailure`.
Serialize write transactions in the application.

SQLite stores `DateTime` as text, and `prisma-next db init` generates
`DEFAULT (datetime('now'))`, which writes a UTC instant without a zone
designator. The entrypoint decodes zone-less datetime text as UTC, so generated
column defaults round-trip to the instant SQLite wrote without hand-editing the
DDL. Values that already carry `Z` or a numeric offset decode unchanged.
`datetime('now')` itself stores whole seconds; write
`strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` where a default needs milliseconds.

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
  const count = yield* active.count()

  return { users, first, exists, count }
})
```

Relations are lazy and immutable. Reusing or branching a Relation never changes
the original, and each execution resolves the active database context again.

Relations can be loaded directly or refined with another immutable Relation:

```ts
const recentPosts = db.Post
  .orderBy((post) => post.createdAt.desc())
  .take(5)

const usersWithPosts = yield* db.User.include("posts", recentPosts)

const usersWithPostCounts = yield* db.User.include("posts", db.Post.count())
```

Includes can be chained and nested. Loaded to-many relations are arrays, and
nullable to-one relations remain nullable in the result type.

Named query records return several projections of the same relation:

```ts
const publishedPosts = db.Post.where({ published: true })
const recentPublishedPosts = publishedPosts
  .orderBy((post) => post.createdAt.desc())
  .take(5)

const usersWithPostOverview = yield* db.User.include("posts", {
  items: recentPublishedPosts,
  fullCount: publishedPosts.count(),
})
```

Collections are also cold Effect Streams:

```ts
const stream = db.User.where({ active: true }).stream
```

The package covers scalar models, filtering, selection, relation loading,
ordering, pagination, distinct queries, aggregates, grouping, and
create/update/delete terminals. Model variants are deliberately deferred rather
than exposed with weakened types.

PostgreSQL timestamp and timestamp-with-time-zone fields use JavaScript `Date`
values for reads, writes, filters, selections, includes, and Streams after the
generated contract is normalized.

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

Queries composed concurrently inside a transaction are executed one at a time
on its single connection. Once a transaction query starts, interruption waits
for it to settle before releasing that connection. Query effects outside
transactions remain parallel.

Transaction-scoped Streams are read into memory before emitting rows. This
releases the connection before downstream Stream effects run database queries.
Streams outside transactions retain incremental fetching.

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
