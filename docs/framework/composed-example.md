# Reference composition on PostgreSQL and HTTP

The order feature is the reference composition for Platform's native application path. Its executable fixture joins Schema, a migrated PostgreSQL repository, a service, authenticated native HTTP RPC, atom queries, an encoded form editor and live updates. It is a test fixture, not a copyable application. Until an app template exists, use it to study the tested boundaries and each package's README to build application wiring; its test gates, session provider and Origin policy are fixture choices.

## Code to read

| Module | Responsibility |
| --- | --- |
| [Contract](../../packages/effect-react/src/test-support/postgres-example/contract.ts) | One Schema domain, query and command declarations, read keys, typed failures and an authenticated native streaming RPC. |
| [Repository](../../packages/effect-react/src/test-support/postgres-example/repository.ts) | Native Model fields, `makeRepository` and an initial migration through `migratePostgres`. |
| [Service](../../packages/effect-react/src/test-support/postgres-example/OrderService.ts) | `defineService`, explicit owner authorization, normalized writes and commit-bound invalidation through `transact`. |
| [Handlers](../../packages/effect-react/src/test-support/postgres-example/orderHandlers.ts) | Platform request identity passed into service calls; `makeLiveServer` turns committed invalidations into live hints. |
| [Server](../../packages/effect-react/src/test-support/postgres-example/server.ts) | Real PostgreSQL pools, Platform's session middleware, native Node HTTP server and NDJSON RPC transport. |
| [Client](../../packages/effect-react/src/test-support/postgres-example/makeClient.ts) | Native AtomRpc, contract binding and live invalidation. |
| [Editor](../../packages/effect-react/src/test-support/postgres-example/OrderEditor.tsx) | `useEditor` connects the query to effect-form fields and decoded saves. |
| [Tests](../../packages/effect-react/src/postgresExample.dom.spec.tsx) | Two independent client registries, rendered editors, commit visibility and rollback through actual HTTP. |

## From commit to another editor

The save handler reads `Identity` supplied by Platform's `Authenticated` middleware. It passes the user id to the service on every request; service initialization never retains a request's principal. The service checks the row's owner, updates it through the repository, records the order's invalidation keys, and returns through `transact`.

`transact` binds the native SQL transaction to the `effect-changes` channel. The channel publishes to server Reactivity after the owning PostgreSQL transaction commits and discards keys on rollback. The authenticated `subscribe` RPC uses `makeLiveServer.stream` for the selected order's keys. Its initial `Resync` hint reconciles the client, and subsequent hints ask the client's existing query to read again over HTTP.

The second client's registry, RPC client and editor are independent of the writer's. The writer's local command invalidation cannot refresh that registry. The live HTTP hint invalidates the second client's query; `useEditor` receives the fresh result and effect-form merges it into the open draft. Untouched fields adopt the received values, while edited fields keep local input. Revert restores the received baseline.

The server can provide `postgresChanges` alongside its SQL and live services. Its pre-commit hook uses the writing transaction's SQL connection to send only invalidation keys through NOTIFY. Each server delivers LISTEN notifications to its own Reactivity; live hints ask clients to query again. The same binding is provided to a pg-boss worker that calls the order service.

## What the test proves

The fixture uses an application-owned `storyKit` with a live clock, a real native Node HTTP listener on an ephemeral loopback port, and PostgreSQL through `@effect/sql-pg`. Its worker Layer leases a uniquely named disposable database shared with the order story kit. Each story migrates uniquely named application tables and removes them at cleanup; scoped views close before the server, and the last worker lease drops the database after its pools close. A PostgreSQL trait declares the real-commit policy, and a scoped `start` verb supplies the feature through the kit. A separate pool reads committed rows and observes database visibility when the server produces a stream hint. The rendered clients use the native Node HTTP client in the DOM fixture; the frontend's default client uses native Fetch HTTP.

The two scenarios prove:

- A save submitted through the first rendered editor executes SQL but remains invisible to the second pool while held before commit. It publishes no invalidation or stream hint during that hold. After commit, the server emits one invalidation, each connected stream observes the committed row, and the second client's query and untouched editor fields update without a manual refresh.
- A later live update refreshes the second client's query and untouched quantity while preserving its unsaved name. Revert adopts the new remote baseline. Anonymous and cross-owner HTTP writes return typed failures and change neither PostgreSQL nor the publication count.
- A typed rejection injected after the SQL update and recorded invalidation rolls back the transaction. The second pool sees the original row, no invalidation or additional stream hint is published, and the second client's query is not refetched and its editor remains unchanged.

The gate immediately before commit is test infrastructure for controlling the transaction and injecting that rejection. The example's bearer-session provider and permissive Origin policy are also fixture choices. This evidence does not establish production session storage, browser cookie behavior, browser Fetch networking, SSR, deployment proxies, mobile lifecycle, durable delivery.

## Delivery between processes

[The process test](../../packages/effect-react/src/postgresProcesses.spec.ts) starts two native HTTP server processes and one pg-boss worker process against the same migrated order feature. Each server has an independent pool and Reactivity service. Commits through either server and the worker reach live HTTP subscribers on both servers; an injected rejection rolls back without another hint. Killing a server's LISTEN backend produces `Resync` on its live streams, then a fresh connection receives later committed keys. [The SQL notification tests](../../packages/effect-sql/src/postgresChanges.test.ts) also cover a listener that silently stops delivering, UTF-8 payload splitting, oversized keys and failure at COMMIT after the hook has sent its notification.

NOTIFY is not a durable log. The binding detects listener loss through a heartbeat and resyncs again after reconnecting so readers query authoritative data. The default PostgreSQL payload limit is smaller than 8,000 bytes; the binding splits arrays of invalidation keys and rejects an individual key that cannot fit. LISTEN needs a session connection, so this adapter does not establish PgBouncer transaction-pooling support.

## Running it

After dependency installation and the quality package build, run the focused fixture from the repository root:

```sh
PLATFORM_EFFECT_SQL_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/platform_test_effect_sql pnpm --filter @shivaedev/effect-react test src/postgresExample.dom.spec.tsx
```

`pnpm db:setup` prepares the repository's local PostgreSQL databases. The fixture skips only when `PLATFORM_EFFECT_SQL_TEST_DATABASE_URL` is absent; a configured but unavailable database fails. A skipped run proves no database behavior. `pnpm ready` runs this fixture with the repository's PostgreSQL test configuration alongside the full workspace checks and packed-package consumers.

The [SQLite order fixture](./order-example.md) adds session expiry, revocation and overlapping-save scenarios. Its evidence remains separate from this PostgreSQL composition.
