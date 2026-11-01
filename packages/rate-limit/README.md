# @shivaedev/rate-limit

Give each user or operation a budget without writing another counter. One Effect admits a call or returns a typed `TooManyRequests` with the time it can be tried again, using a memory store or PostgreSQL.

## One budget at the write boundary

Keep the policy next to the action it protects:

```ts
import { rateLimit } from "@shivaedev/rate-limit/rateLimit.ts";

const admitNote = rateLimit({ key: "notes:alice", per: 10, window: "1 minute" });
```

The caller chooses a key and budget. The store handles admission, including competing PostgreSQL callers on separate pools.

## Using it

### Choose a store once

A window starts on the first admitted call for a key. Up to `per` calls are admitted before its expiry; subsequent calls fail without increasing the count or extending the window. At expiry the next call starts a fresh window. Use one stable policy per key and include the operation and user in the key to keep their budgets separate.

Provide the memory layer for a single process:

```ts
import { Effect } from "effect";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { rateLimit } from "@shivaedev/rate-limit/rateLimit.ts";

const admitted = rateLimit({ key: "notes:alice", per: 10, window: "1 minute" }).pipe(Effect.provide(memoryStore));
```

Share the layer across requests. Each layer build owns its counters; rebuilding it for every request resets the budget. Memory uses Effect's clock and removes expired entries on subsequent calls. It counts attempts admitted by the limiter, even if the following application write fails.

For a shared PostgreSQL budget, install the optional `@shivaedev/sql` peer, include `postgresMigration` from `@shivaedev/rate-limit/adapters/postgresMigration.ts` in the application's numbered migration loader, and provide `postgresStore` from `@shivaedev/rate-limit/adapters/postgresStore.ts`. The layer requires native `SqlClient` and `Reactivity`, supplied by the SQL package's PostgreSQL layer. It uses database time after taking a per-key transaction advisory lock, so independent processes share the same window. It runs through `transact`; call it before the application's write transaction, since admission commits independently. SQL failures become typed `StoreError` values with their original cause.

The migration creates `rate_limit_windows`. PostgreSQL retains one row per key; an application with unbounded key churn should delete expired rows as part of its own retention policy. The adapter disables SQL name transforms for its owned table.

### Handle a refusal

`rateLimit({ key, per, window })` reads `Store` from the environment and returns `void`. `per` must be a positive safe integer and `window` a finite positive Effect duration; invalid policies die with `RangeError`.

`TooManyRequests`, from `@shivaedev/rate-limit/TooManyRequests.ts`, is an Effect Schema tagged error with `key`, `message` and `retryAt`. The retry time is Unix epoch milliseconds. Declare this schema in a contract's rejections to preserve it across RPC. Applications choose the message shown to the user and whether to retry. Refusals are immediate; the limiter does not sleep or queue callers.

A custom store implements `Store.consume` from `@shivaedev/rate-limit/Store.ts`, atomically consuming a `WindowRequest` or failing with `TooManyRequests` or `StoreError`. A store owns its clock and consistency boundary.

### Install

```sh
pnpm add @shivaedev/rate-limit effect
```

For PostgreSQL, also install `@shivaedev/sql` and its PostgreSQL driver peer. Applications depending on `@shivaedev/platform` reach the limiter through the framework hoist.
