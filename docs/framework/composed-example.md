# Reference composition on PostgreSQL and HTTP

The order feature is the reference composition for Platform's native application path. Its executable fixture joins Schema, a migrated PostgreSQL repository, a service, authenticated native HTTP RPC, atom queries, an encoded form editor and live updates. Use it to study how the pieces connect; its bearer-session provider, permissive session Origin policy and commit gate are fixture choices, not production policy. To create an application, use `pnpm create @shivaedev/app` and follow the [starter quickstart](./quickstart.md).

## Code to read

| Module | Responsibility |
| --- | --- |
| [Contract](../../packages/react/src/test-support/postgres-example/contract.ts) | One Schema domain, query and command declarations, read keys, typed failures and an authenticated native streaming RPC. |
| [Repository](../../packages/react/src/test-support/postgres-example/repository.ts) | Native Model fields, `makeRepository` and an application-owned numbered migration loader. |
| [Service](../../packages/react/src/test-support/postgres-example/OrderService.ts) | `defineService`, explicit owner authorization, normalized writes and commit-bound invalidation through `transact`. |
| [Handlers](../../packages/react/src/test-support/postgres-example/orderHandlers.ts) | Platform request identity passed into service calls; the host's `AppChanges` turns committed invalidations into live hints. |
| [Server](../../packages/react/src/test-support/postgres-example/server.ts) | Server's `appHost` supplies migrated PostgreSQL, session middleware, guarded Node HTTP and NDJSON RPC transport. |
| [Client](../../packages/react/src/test-support/postgres-example/makeClient.ts) | Native AtomRpc, contract binding and live invalidation. |
| [Editor](../../packages/react/src/test-support/postgres-example/OrderEditor.tsx) | `useEditor` connects the query to form fields and decoded saves. |

## From commit to another editor

The save handler reads `Identity` supplied by Identity's `Authenticated` middleware. It passes the user id to the service on every request; service initialization never retains a request's principal. The service checks the row's owner, updates it through the repository, records the order's invalidation keys, and returns through `transact`.

`transact` binds the native SQL transaction to the `changes` channel. The channel publishes to server Reactivity after the owning PostgreSQL transaction commits and discards keys on rollback. The authenticated `subscribe` RPC uses `AppChanges.stream` for the selected order's keys. Its initial `Resync` hint reconciles the client, and subsequent hints ask the client's existing query to read again over HTTP.

The second client's registry, RPC client and editor are independent of the writer's. The writer's local command invalidation cannot refresh that registry. The live HTTP hint invalidates the second client's query; `useEditor` receives the fresh result and form merges it into the open draft. Untouched fields adopt the received values, while edited fields keep local input. Revert restores the received baseline.

The server configures `appHost` with `config.changes` to bind `postgresChanges` alongside its SQL and live services. Its pre-commit hook uses the writing transaction's SQL connection to send only invalidation keys through NOTIFY. Each server delivers LISTEN notifications to its own Reactivity; live hints ask clients to query again. The pg-boss worker provides `appDatabase` with the same migration loader and channel before calling the order service.

## Delivery between processes

Several processes can share one feature. Two native HTTP servers and a pg-boss worker can run against the same migrated database, each with its own pool and Reactivity, and a commit through any of them reaches live subscribers on both servers. When a server loses its LISTEN connection, its live streams receive `Resync` and a fresh connection picks up later commits. A rolled-back write publishes no hint.

NOTIFY is not a durable log. The binding detects listener loss through a heartbeat and resyncs again after reconnecting so readers query authoritative data. The default PostgreSQL payload limit is smaller than 8,000 bytes; the binding splits arrays of invalidation keys and rejects an individual key that cannot fit. LISTEN needs a session connection, so this adapter does not establish PgBouncer transaction-pooling support.

This composition is proved against real PostgreSQL and real HTTP, with separate server and worker processes and two independently rendered editors. The editors are DOM renders, so they do not prove SSR or browser lifecycle, and the fixture's session provider and commit gate do not establish a production deployment.
