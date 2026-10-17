# Order editing through the native stack

This example extends the foundation with a real HTTP boundary and an editable
order. It is a small application feature exercised by executable tests, not a
migration of an existing application or a deployed application.

## Code to read

- [Contract](../../packages/effect-react/src/test-support/order-example/contract.ts): shared
  Schema values and `effect-contract` get/list/save declarations with typed
  rejections and order reactivity keys, grouped into a native RPC group. Browser
  code imports this module without importing database drivers or server
  initialization.
- [Backend](../../packages/effect-react/src/test-support/order-example/service.ts):
  model-derived repository, service declaration, business validation and
  request-scoped authorization.
- [HTTP runtime](../../packages/effect-react/src/test-support/order-example/runtime.ts): session middleware, native handlers and JSON serialization, composed with the feature service Layer.
- [Frontend](../../packages/effect-react/src/test-support/order-example/frontend.tsx): the
  contract bound to a native AtomRpc service, encoded form fields and decoded
  submission.
- [Behavior tests](../../packages/effect-react/src/orderExample.dom.spec.tsx):
  rendered editing and actual HTTP requests through the feature.

## Boundaries

The shared service owns authorization of order access and validation of saves.
Request middleware resolves the session and supplies a principal. Handlers pass
that principal into service methods explicitly; the shared service never retains
the current user as initialization state.

The repository derives CRUD types from its model; the save runs in `transact`,
which maps SQL failures to `StorageUnavailable` and marks the saved order's keys
for server-side invalidation after commit. Field errors are a
`fieldRejection(OrderDraft)`, so their `field` is one of the form's fields; they
remain typed failures across RPC and attach to that field. The contract declares
`reads: ({ id }) => [orders.item(id)]` for an order, `[orders.list]` for the list, and
`invalidates: ({ id }) => [orders.item(id)]` for a save. The binding registers
`` `orders:${id}` `` for an item and `"orders"` for the list, and a successful save
invalidates both, so the saved order and the list refresh while other mounted
orders do not. No event journal or background notification bus is involved.

The form owns editable values and submission state. Its submission runs
`api.save.run(...)`, a per-call Effect over the native client, preserving the
outcome of that specific save.
It does not await a shared mutation atom and assume its eventual value belongs
to that call. Query data supplies the latest draft baseline and is merged per
field: untouched fields adopt refreshed values, edited fields keep local input
during refresh and save.

## What this does not establish

The session implementation is an injected example boundary, not a replacement
for Better Auth. Production cookie handling, CSRF policy, session storage and
mobile authentication still need application integration.

The [boundary tests](../../packages/effect-react/src/orderExample.dom.spec.tsx) use SQLite. The [application story kit](../../packages/effect-react/src/test-support/order-example/application.ts) runs the same service, repository, contracts and components against real PostgreSQL and a loopback HTTP listener with native RPC serialization. Its DOM tests do not prove browser networking, SSR hydration,
Capacitor resume, offline writes or cross-process invalidation. The PostgreSQL story coverage uses the kit described below; broader codec coverage remains separate from this feature.

The small Node HTTP bridge is test infrastructure, not a production server
adapter. The framework continues to expose native components so applications can
choose their host without adopting a new transport abstraction.

## Verified behavior

The focused test runs four scenarios:

- A successful normalized save updates persisted and rendered values; a typed
  quantity rejection preserves the earlier record. After an independent remote
  edit and completed refresh, the edited name keeps local unsaved input while the
  untouched quantity field adopts the remote value; revert adopts that remote
  baseline.
- A save held behind a Deferred gate completes after a newer local edit. The
  saved value appears in the query while the newer draft remains dirty.
- Concurrent user views stay isolated. Anonymous, expired and cross-owner writes
  fail; revoking a loaded editor's session prevents its next save. Public reads
  confirm the rejected writes changed neither user's order.
- With the list and two order editors mounted, saving one order refetches that
  order and the list; the server sees no second read of the other order.

Run `pnpm --filter @shivaedev/effect-react exec vitest run src/orderExample.dom.spec.tsx`
from the workspace. The test binds an ephemeral loopback port and requires local
network access. The full workspace gate is `pnpm ready`.

## Application-owned story kit

The [story specs](../../packages/effect-react/src/orderStory.dom.spec.tsx) import shared traits and domain verbs. The kit owns fresh application services, native RPC clients, scoped React roots and atom registries. Its worker Layer leases one disposable PostgreSQL database for both real-commit HTTP stories and local rollback stories. Migrations use `migratePostgres`; HTTP stories truncate application tables before and after each story while retaining the ledger, and observe persistence through an independent pool. Local stories wrap creation, seeds and body in `transact` and verify rollback before cleanup truncation.

The PostgreSQL stories check a committed save, a typed rejection after a write with no publication, cross-owner rejection, rendered list refresh through `useAction`, and a `useEditor` form retaining rejected encoded input before a successful corrected save. A failed story exercises root cleanup and table reset before the next story. [Database lifecycle tests](../../packages/effect-react/src/orderDatabase.spec.ts) check leases, pool shutdown before the last database drop, setup failure, interruption, destination validation and invalid seed rejection.

Run `PLATFORM_EFFECT_SQL_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/platform_test_effect_sql pnpm --filter @shivaedev/effect-react test src/orderStory.dom.spec.tsx src/orderDatabase.spec.ts` after `pnpm db:setup`. These tests skip without that explicit URL. `pnpm ready` supplies the workspace test database URLs and runs them with the rest of the gates.
