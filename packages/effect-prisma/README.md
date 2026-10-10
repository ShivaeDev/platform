# @shivaedev/effect-prisma

Use Prisma Next's generated model queries in Effect, with typed rows, database transactions and tests that roll their writes back. Keep the contract your application already owns while making database work compose with its Effect services.

## Why you want this

A Promise-based database client leaves every Effect application to rebuild the same boundary: translate failures, pass the transaction client through its services and clean up test writes. This package gives that work one Database service:

```ts
const createUser = Effect.gen(function* () {
  const db = yield* Database;
  return yield* db.transaction(
    Effect.gen(function* () {
      const tx = yield* Database;
      return yield* tx.User.create({
        id: crypto.randomUUID(),
        email: "ada@example.test",
        name: "Ada",
      });
    }),
  );
});
```

`Database` is your application's exported definition. The transaction body yields that same service and uses the same generated models. A successful body commits; a failed body rolls back. The test harness runs that work in a rollback-only transaction, so a test can create real rows without leaving them behind.

## Using it

### How to think about it

There are three things to keep separate:

- The **contract** is Prisma Next's description of your database and generated TypeScript model types.
- A **Database definition** is an Effect service for that contract. Its Layer provides a live database facade.
- A **Relation** is a reusable model query, such as `db.User.where({ name: "Ada" })`. It is also an Effect: yielding a collection Relation returns its rows.

A Relation keeps the calls that describe its query. Branching it creates another query without changing the base. A root Relation resolves the active transaction when it runs; one made from a transaction facade belongs to that transaction's lifetime and context. You do not provide a separate executor service to queries or Streams.

Organize application work around these boundaries: define the Database and its Layer once, write reusable queries in each feature's repository, and run those Effects or rollback tests every day. The examples use a contract with `User` and `Post` models: users have `id`, `email`, `name`, `createdAt`, `verifiedAt` and `posts`; posts have `title`, `user` and an optional `reviewer`.

### Once per application: define the database

```ts
import { makeDatabase } from "@shivaedev/effect-prisma/database.ts";
import type { Contract } from "./generated/contract.d.ts";
import contractJson from "./generated/contract.json" with { type: "json" };

export const Database = makeDatabase<Contract>()("@app/Database", {
  contractJson,
});

export const DatabaseLive = Database.layer({
  url: "postgresql://localhost/application",
});
```

The type parameter is the generated contract type; `contractJson` is its emitted JSON. Choose one literal identifier for each exported definition. Different identifiers keep two databases distinct even when they use the same contract, including in the types of included queries. Widened strings, unions and template patterns cannot identify one Database.

Reuse the definition and provide one live Layer for it in a composed runtime. Keep values within that Layer's scope: a root Stream or Database facade used after the owning Layer closes fails with `RUNTIME.DATABASE_CLOSED`. A transaction-bound value instead closes with its transaction and fails with `RUNTIME.TRANSACTION_CLOSED` after settlement.

SQLite uses the same query and transaction facade through its own factory:

```ts
import { makeSqliteDatabase } from "@shivaedev/effect-prisma/sqlite.ts";
import type { Contract } from "./generated/contract.d.ts";
import contractJson from "./generated/contract.json" with { type: "json" };

export const Database = makeSqliteDatabase<Contract>()("@app/Database", {
  contractJson,
});

export const DatabaseLive = Database.layer({ path: "application.db" });
```

Use a SQLite contract for this definition. The default connect-time pragma sets `journal_mode=WAL`. SQLite's serialization and file requirements are described under limits below.

### Once per feature: write reusable queries

```ts
import { Effect } from "effect";
import { Database } from "./database.ts";

export const findUsersNamed = (name: string) =>
  Effect.gen(function* () {
    const db = yield* Database;
    const matching = db.User.where({ name });
    const names = matching.orderBy((user) => user.email.asc()).select("id", "email");

    return {
      rows: yield* names.take(20),
      first: yield* matching.first(),
      exists: yield* matching.exists(),
      count: yield* matching.count(),
    };
  });
```

`matching` remains the full filtered Relation after `names` adds an order and selection. A selection keeps only its named fields in the result type. `first()` returns an Effect `Option`, `exists()` returns a boolean and `count()` returns a number. Object filters and callback filters retain the contract's field types.

Load relations by their contract names:

```ts
export const userPostOverview = Effect.gen(function* () {
  const db = yield* Database;
  const titles = db.Post.orderBy((post) => post.title.asc()).select("title");
  const page = titles.take(1);

  return yield* db.User.include("posts", {
    items: page,
    fullCount: db.Post.count(),
    pageCount: page.count(),
  });
});
```

The `posts` property contains the named projections: a page of titles, the full related count and the page count. `include("posts")` loads the related rows directly; passing a Relation refines them. Includes can nest, as in `db.User.include("posts", db.Post.include("user"))`, and chain, as in `db.Post.include("user").include("reviewer")`. To-many values are arrays; an optional reviewer stays `User | null`.

An included query must come from the same Database and use the related model. A named query record must be nonempty and applies only to a to-many relation. The compiler rejects these mismatches; runtime checks also reject foreign databases, wrong models and transaction-bound queries used outside their owner.

For grouped summaries and bulk changes, use the generated collection operations:

```ts
export const renameUsers = (name: string, replacement: string) =>
  Effect.gen(function* () {
    const db = yield* Database;
    const matching = db.User.where({ name });
    const summary = yield* matching.aggregate((aggregate) => ({
      total: aggregate.count(),
    }));
    const groups = yield* matching.groupBy("name").aggregate((aggregate) => ({
      total: aggregate.count(),
    }));
    const changed = yield* matching.updateAll({ name: replacement });
    return { summary, groups, changed };
  });
```

`aggregate` returns the named summary; grouped aggregates also include the grouped fields. `createAll`, `updateAll` and `deleteAll` return rows. Update and delete methods require an explicit filter in the typed API.

### Every day: run effects and transactions

```ts
const result = await Effect.runPromise(
  findUsersNamed("Ada").pipe(Effect.provide(DatabaseLive)),
);
```

Provide the Database Layer to the program that yields its definition. Repository queries remain ordinary Effects that a larger application's Layer can provide.

A transaction body must yield its Database definition. The boundary provides that service for the body while retaining any other service requirements. Nested package transactions reuse the active transaction and its facade; they do not create independent rollback boundaries.

A root query captured before a transaction participates when run inside it. A Database, Relation or Stream created from the transaction facade cannot be used after settlement, outside that transaction or in a concurrent sibling transaction. Closed values fail with `RUNTIME.TRANSACTION_CLOSED`; values used in another active context fail with `RUNTIME.TRANSACTION_CONTEXT_MISMATCH`.

Successful transactions commit. Typed failures and interruption roll back before returning. Queries sharing the transaction connection execute one at a time. Once such a query starts, interruption waits for it to settle before another query or transaction settlement uses the connection.

Collection Relations also expose reusable Streams:

```ts
import { Stream } from "effect";

export const userEmails = Effect.gen(function* () {
  const db = yield* Database;
  return yield* Stream.runCollect(
    db.User.select("email").stream.pipe(Stream.map((user) => user.email)),
  );
});
```

Outside transactions the source emits incrementally. Inside a transaction the package buffers the source before downstream work runs, so a downstream database query can use the same connection. Account for the full result's memory use in a transaction.

### Every day: test real writes with rollback

Define the application's database test harness once:

```ts
import { makeDatabaseIt } from "@shivaedev/effect-prisma/testing/vitest.ts";
import { Database, DatabaseTest } from "./database-test.ts";

export const it = makeDatabaseIt({
  database: Database,
  layer: DatabaseTest,
});
```

`DatabaseTest` is the application's Layer for an initialized test database. A test receives the typed facade and Vitest context:

```ts
import { expect } from "vitest";
import { it } from "./database-it.ts";

it.effectDB("creates a user", function* (db, context) {
  const email = `${crypto.randomUUID()}@example.test`;
  const user = yield* db.User.create({
    id: crypto.randomUUID(),
    email,
    name: "Ada",
  });

  expect(user.email).toBe(email);
  expect(context.task.name).toContain("creates a user");
});
```

Successful and failing test bodies both roll back their writes. `effectDB.each` takes each table item before the database and context; `effectDB.fails` declares an expected failure. Ordinary transactions nested inside a rollback test share its scope and are rolled back with it.

For another test runner, wrap an Effect with the rollback primitive:

```ts
import { withTestTransaction } from "@shivaedev/effect-prisma/testing/transaction.ts";

const testProgram = withTestTransaction(
  Database,
  Effect.gen(function* () {
    const db = yield* Database;
    return yield* db.User.count();
  }),
).pipe(Effect.provide(DatabaseTest));
```

The primitive returns the body's value or preserves its failure while rolling back. A rollback-only boundary inside an ordinary commit transaction is refused with `RUNTIME.TEST_TRANSACTION_INSIDE_TRANSACTION_UNSUPPORTED`; nesting another boundary inside an existing rollback test shares that test's transaction.

### API

Import the defining module; the package has no root entry point.

| Module | Public surface |
| --- | --- |
| `database.ts` | `makeDatabase<Contract>()(identifier, { contractJson })`, `DatabaseDefinition`, `DatabaseLayerOptions`. Factory options also accept an already typed `contract`. |
| `sqlite.ts` | `makeSqliteDatabase<Contract>()(identifier, options)`, `defaultSqlitePragmas`, `SqliteDatabaseDefinition`, `SqliteDatabaseLayerOptions`. Layer options include `path` and `pragmas`. |
| `databaseTypes.ts` | `DatabaseService<Contract, Identifier>`, `DatabaseServiceOf<typeof Database>`, `AnyDatabase`, `DatabaseIdentifier`, `DatabaseIdentifierLiteral`, `DatabaseServiceHolder`, `DefaultModels`, `SqlDatabase`, `internalContextIdentifierPrefix`. |
| `relation.ts` | `Relation`, `RelationQuery`, `CollectionResult`. |
| `error.ts` | `PrismaError`, `PrismaErrorReason`, `PrismaRuntimeFailure`, `PrismaQueryFailure`, `PrismaConnectionFailure`, `isPrismaFailure`, `toPrismaError`. |
| `testing/vitest.ts` | `makeDatabaseIt({ database, layer, clock? })`. |
| `testing/transaction.ts` | `withTestTransaction(database, program)` and `withTestTransaction(database)(program)`. |
| `testing/types.ts` | `DatabaseIt`, `DatabaseTester`, `DatabaseTest`, `DatabaseService`, `MakeDatabaseItOptions`. |
| `relation/include.ts`, `relation/include-metadata.ts`, `relation/prisma-methods.ts` | Supporting types: `IncludeMethod`, `AnyPostgresContract`, `IsToManyRelation`, `RelatedModelNameOf`, `IncludedRelationValue`, `PrismaRelationMethods`. |
| `effect-prisma-normalize` | Executable taking one generated contract declaration path. |

The Relation surface follows Prisma Next's collections. Its typed operations include filters and ordering; `select`, `take`, `cursor`, `distinct`, `distinctOn`; `include`, `count`, `exists`, `first`; `aggregate`, `groupBy`; and create, update and delete terminals. Cursor and distinct-on types require an order first. Import boolean filter combinators such as `and`, `or`, `not` and `all` from `@prisma-next/sql-orm-client`.

A `PrismaError` carries a tagged `reason`. Unique-constraint tests verify `PrismaQueryFailure` with `sqlState` and `constraint`; scope and transaction guards use `PrismaRuntimeFailure` with `code`. Unknown Promise rejections remain defects rather than becoming typed database failures.

`effectDB` also exposes the declared `skip`, `skipIf`, `runIf` and `only` methods. Its options and factory accept `clock`; see the [Effect test runner](https://github.com/ShivaeDev/platform/tree/main/packages/effect-test#readme) for the shared option types and clock model.

### Install and contract setup

```sh
pnpm add @shivaedev/effect-prisma effect@4.0.0-rc.112
pnpm add --save-dev @effect/vitest@4.0.0-rc.112 vitest@4.1.11
```

The Vitest dependencies are needed only for `testing/vitest.ts`. Use Node.js 24 or newer and compatible versions of the package's Effect and Prisma Next dependencies.

The application owns its Prisma Next CLI/configuration, initialized schema and
migration workflow. This package does not apply schema changes. Emit that
application's contract, then normalize its PostgreSQL declaration:

```sh
prisma-next contract emit
effect-prisma-normalize path/to/generated/contract.d.ts
```

Normalization replaces supported PostgreSQL timestamp declarations with `Date`, preserves other fields and can run twice. An unsupported timestamp declaration fails without overwriting the generated file. PostgreSQL timestamp and timestamp-with-time-zone fields accept and return JavaScript `Date` values; the tests exercise writes, reads and equality filters. SQLite `DateTime` declarations already use `Date` and do not need this PostgreSQL step.

SQLite datetime text without a zone is decoded as UTC, including the `datetime('now')` column default. Text that already contains `Z` or a numeric offset is left unchanged. That generated default has whole-second precision.

### Limits

- Use one exported definition and one live Layer per identifier. Duplicate identifiers or multiple simultaneous Layers for one definition are outside the supported composition.
- Keep Database values inside their Layer and transaction lifetimes. Return rows from a transaction rather than its facade or queries.
- PostgreSQL contracts must have one domain namespace. A model named `transaction` conflicts with the facade's transaction method.
- SQLite needs a file-backed database; `:memory:` and an empty path are rejected. Its driver uses synchronous database calls. Treat it as a local database path and avoid coordinating separate Layers against the same file.
- One SQLite Layer serializes finite root query Effects with the entire explicit transaction lifetime. Transaction queries have a separate permit. Root Streams remain incremental; do not treat them as holding that lifetime permit.
- Transaction Streams buffer the full result. Refine large queries before collecting them in a transaction.
- The API excludes model variants and direct scalar aggregate shortcuts; use the typed `aggregate` callback. Prisma Next features are not automatically package guarantees.

The [roadmap](https://github.com/ShivaeDev/platform/blob/main/packages/effect-prisma/docs/roadmap.md) records package status and maintainer questions. The tests distinguish real PostgreSQL behavior, file-backed SQLite behavior and controlled execution tests; PostgreSQL tests skip when their database URL is absent.
