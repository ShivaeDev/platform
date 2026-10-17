# Framework roadmap

This roadmap owns work across package boundaries: composed feature fixtures,
application adoption, version alignment and deployment validation. Each package's `docs/roadmap.md`
owns its implementation, next work and package-specific open questions.
Package capabilities are linked here rather than given a second completion
checkbox. The [design guide](./README.md) explains how the paths fit.

## Built: composed boundary fixtures

- [x] The reference order test fixture joins migrated PostgreSQL, a declared service, authenticated native HTTP RPC, atoms and an editor. Commit-bound live HTTP hints refresh a second client, while rollback publishes nothing. [Composition and evidence](./composed-example.md).

- [x] A rendered native feature connects an actual SQLite repository, native RPC,
  AtomRpc and React. Successful actions refresh the list; rejected actions leave
  persisted and rendered data intact.
  [Fixture](../../packages/effect-react/src/nativeFeature.dom.spec.tsx).
- [x] The order-editing feature connects service declarations, encoded form
  fields, a save command and authenticated HTTP. Its fixtures exercise
  independent users, revocation, expiry, retry, refresh during edits and cleanup.
  [Guide and evidence](./order-example.md).
- [x] Boundary fixtures exercise PostgreSQL codecs and rollback, request
  identity and Origin checks, action interruption, Node abort signals, and
  session replacement of cached queries and editable drafts.
  [Evidence and limits](./boundary-validation.md).
- [x] An optional native live HTTP consumer connects document queries and a
  derived list to targeted hints and explicit full reconciliation. Tests
  exercise retained failures, missed changes, stale responses, pause/resume and
  teardown. [Composition and evidence](./live-updates.md).

- [x] PostgreSQL notification delivery connects two HTTP server processes and a pg-boss worker through transaction-owned NOTIFY. Rollback and failed commit send no invalidation; listener termination and missing heartbeats resync streams. [Process and SQL evidence](./composed-example.md#delivery-between-processes).

These are executable fixtures; their evidence does not establish a consuming
application's deployment behavior. Work Board's use of the shared live path and
its browser acceptance belong to
[Work Board's roadmap](../../packages/work-board/docs/roadmap.md).

## Built: first copyable application

- [x] The [starter](../../examples/starter/README.md) is the first copyable app: a notes feature connects migrated PostgreSQL, a declared service and authenticated HTTP/NDJSON RPC to a React form. The [host tests](../../examples/starter/src/server/notesHost.test.ts) prove persisted note creation and querying over real HTTP and PostgreSQL; the [screen test](../../examples/starter/src/client/NotesScreen.dom.test.tsx) proves form submission refreshes the rendered list. The [generation tests](../../packages/create-app/src/createApp.test.ts) check the standalone app's Quality setup.
- [x] The starter integrates Better Auth as its session owner and supplies `SessionBoundary` with `session`, `identify` and `recheck`. Its [host tests](../../examples/starter/src/server/notesHost.test.ts) prove signed-out rejection, user isolation and revocation; its [session test](../../examples/starter/src/client/SessionApp.dom.test.tsx) proves session replacement clears cached notes and drafts. The [proxy test](../../examples/starter/src/server/appDeploy.spec.ts) checks secure auth cookies and foreign-Origin rejection through a loopback forwarding proxy configured with an HTTPS public URL.
- [x] The starter authors numbered migrations and runs them through `migratePostgres` on the `app_migrations` ledger. Its [host tests](../../examples/starter/src/server/notesHost.test.ts) prove a second host runs the migration path without losing auth accounts or notes, and the word-count migration backfills existing notes. This proves the starter's convention; each deployment still owns its operational timeout and status interface.

## Next: application and deployment acceptance

1. Verify real browser credentials, physical visibility changes, and Capacitor
   resume, connectivity and session behavior in a consuming application. DOM events and
   loopback browser fixtures do not establish native device behavior.
2. Verify request cancellation through the deployment host and proxy, including
   interruption inside a transaction and resource release at the host boundary.
3. Validate the PostgreSQL delivery adapter against an application's deployment,
   or select another adapter when it uses PgBouncer transaction pooling. The
   reference process fixture does not establish a deployment proxy's behavior.
4. Prove optimistic edits only for a concrete feature that benefits from them,
   including rejection and out-of-order responses.
5. Establish request/action correlation, trace export, redaction and error
   presentation through the chosen RPC and SQL paths. Verify that telemetry
   failure leaves the feature's result intact.
6. Validate background and external-provider behavior during adoption, including
   payload rejection, cancellation/retry ownership and worker shutdown.
7. Keep one supported Effect version across package peers and installed
   consumers. Decide the compatibility range and coordinated upgrade conventions
   from application and runtime evidence.

Acceptance means a representative feature uses public package APIs across the
real boundaries it deploys, with precise types, typed failures and explicit
lifecycle ownership. Repository gates and clean installed-package consumers
remain part of that handoff.

## Package implementation roadmaps

- [Services](../../packages/effect-service/docs/roadmap.md),
  [SQL and migrations](../../packages/effect-sql/docs/roadmap.md),
  [operations and live hints](../../packages/effect-contract/docs/roadmap.md).
- [Errors, identity and hosts](../../packages/platform/docs/roadmap.md),
  [React bindings](../../packages/effect-react/docs/roadmap.md),
  [forms](../../packages/effect-form/docs/roadmap.md).
- [Commit-bound channels](../../packages/effect-changes/docs/roadmap.md),
  [Prisma Classic changes](../../packages/effect-changes-prisma/docs/roadmap.md),
  [Prisma Next](../../packages/effect-prisma/docs/roadmap.md),
  [tRPC](../../packages/effect-trpc/docs/roadmap.md),
  [jobs](../../packages/effect-pg-boss/docs/roadmap.md).
- [Effect tests](../../packages/effect-test/docs/roadmap.md),
  [PostgreSQL test isolation](../../packages/effect-test-sql/docs/roadmap.md),
  [story tests](../../packages/test-story/docs/roadmap.md),
  [type helpers](../../packages/types/docs/roadmap.md).
- [Repository quality](../../packages/quality/docs/roadmap.md),
  [heavy commands](../../packages/heavy-lock/docs/roadmap.md),
  [local PostgreSQL](../../packages/local-postgres/docs/roadmap.md),
  [shared skills](../../packages/skills/docs/roadmap.md),
  [Work Board](../../packages/work-board/docs/roadmap.md),
  [Work Fleet](../../packages/work-fleet/docs/roadmap.md),
  [PR observation](../../packages/pr-watch/docs/roadmap.md).

## Open questions for the maintainer

- Which deployment supplies the first production host acceptance path, and which
  browser and native device paths must it support?
- Should auth storage use native SQL or remain a separately supported
  integration? Request identity does not choose storage policy.
- What per-request registries and hydration does the TanStack Router host need?
  Settle SSR isolation from that host; client loader fixtures do not establish it.
- What delivery and reconciliation policy does the first multi-process
  deployment require? A live connection does not establish completed freshness.
- Which edit justifies optimism or offline writes, and who owns conflict
  resolution? Generic offline synchronization remains outside the default path.

General SQL query-language design and migration checksum/edit policy belong to
the [SQL roadmap](../../packages/effect-sql/docs/roadmap.md). Event sourcing,
projection replay, mandatory streaming and a second authored ORM model remain
outside the framework's scope.
