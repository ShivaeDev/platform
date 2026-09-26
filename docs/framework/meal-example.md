# Meal editing through the native stack

This example extends the foundation with a real HTTP boundary and an editable
meal. It is a small application feature exercised by executable tests, not a
migration of an existing application or a deployed application.

## Code to read

- [Contract](../../packages/effect-react/test/meal-example/contract.ts): shared
  Schema values and `effect-contract` get/list/save declarations with typed
  rejections and meal reactivity keys, grouped into a native RPC group. Browser
  code imports this module without importing database drivers or server
  initialization.
- [Backend](../../packages/effect-react/test/meal-example/backend.ts):
  model-derived repository, service declaration, business validation and
  request authentication.
- [Frontend](../../packages/effect-react/test/meal-example/frontend.tsx): the
  contract bound to a native AtomRpc service, encoded form fields and decoded
  submission.
- [Behavior tests](../../packages/effect-react/test/meal-example.test.tsx):
  rendered editing and actual HTTP requests through the feature.

## Boundaries

The shared service owns authorization of meal access and validation of saves.
Request middleware resolves the session and supplies a principal. Handlers pass
that principal into service methods explicitly; the shared service never retains
the current user as initialization state.

The repository derives CRUD types from its model; the save runs in `transact`,
which maps SQL failures to `StorageUnavailable` and marks the saved meal's keys
for server-side invalidation after commit. Field errors are a
`fieldRejection(MealDraft)`, so their `field` is one of the form's fields; they
remain typed failures across RPC and attach to that field. The contract declares
`reads: ({ id }) => [meals.item(id)]` for a meal, `[meals.list]` for the list, and
`invalidates: ({ id }) => [meals.item(id)]` for a save. The binding registers
`` `meals:${id}` `` for an item and `"meals"` for the list, and a successful save
invalidates both, so the saved meal and the list refresh while other mounted
meals do not. No event journal or background notification bus is involved.

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

The example uses SQLite and a loopback HTTP listener with native RPC
serialization. Its DOM tests do not prove browser networking, SSR hydration,
Capacitor resume, offline writes or cross-process invalidation. PostgreSQL codec
coverage remains separate from this feature.

The small Node HTTP bridge is test infrastructure, not a production server
adapter. The framework continues to expose native components so applications can
choose their host without adopting a new transport abstraction.

## Verified behavior

The focused test runs four scenarios:

- A successful normalized save updates persisted and rendered values; a typed
  calories rejection preserves the earlier record. After an independent remote
  edit and completed refresh, the edited name keeps local unsaved input while the
  untouched calories field adopts the remote value; revert adopts that remote
  baseline.
- A save held behind a Deferred gate completes after a newer local edit. The
  saved value appears in the query while the newer draft remains dirty.
- Concurrent user views stay isolated. Anonymous, expired and cross-owner writes
  fail; revoking a loaded editor's session prevents its next save. Public reads
  confirm the rejected writes changed neither user's meal.
- With the list and two meal editors mounted, saving one meal refetches that
  meal and the list; the server sees no second read of the other meal.

Run `pnpm --filter @shivaedev/effect-react exec vitest run test/meal-example.test.tsx`
from the workspace. The test binds an ephemeral loopback port and requires local
network access. The full workspace gate is `pnpm ready`.
