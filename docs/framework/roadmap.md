# Framework roadmap

This roadmap owns work across package boundaries: composed feature fixtures,
application adoption, version alignment and deployment validation. Each package's `docs/roadmap.md`
owns its implementation, next work and package-specific open questions.
Package capabilities are linked here rather than given a second completion
checkbox. The [design guide](./README.md) explains how the paths fit.

## Built: composed boundary fixtures

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

These are executable fixtures; their evidence does not establish a consuming
application's deployment behavior. Work Board's use of the shared live path and
its browser acceptance belong to
[Work Board's roadmap](../../packages/work-board/docs/roadmap.md).

## Next: application and deployment acceptance

1. Integrate a consuming application's auth owner with `SessionBoundary` through
   `session`, `identify` and `recheck`. Decide its session provider and browser
   Origin policy explicitly.
2. Verify real browser credentials, physical visibility changes, and Capacitor
   resume, connectivity and session behavior in that application. DOM events and
   loopback browser fixtures do not establish native device behavior.
3. Choose migration authoring and run conventions for an application. Every
   process running the same PostgreSQL ledger must use `migratePostgres`; the
   application chooses the operational timeout and status interface.
4. Verify request cancellation through the deployment host and proxy, including
   interruption inside a transaction and resource release at the host boundary.
5. Select and test delivery between processes and background workers when an
   application's deployment needs it. In-process invalidation alone is
   insufficient evidence for that job.
6. Prove optimistic edits only for a concrete feature that benefits from them,
   including rejection and out-of-order responses.
7. Establish request/action correlation, trace export, redaction and error
   presentation through the chosen RPC and SQL paths. Verify that telemetry
   failure leaves the feature's result intact.
8. Validate background and external-provider behavior during adoption, including
   payload rejection, cancellation/retry ownership and worker shutdown.
9. Keep one supported Effect version across package peers and installed
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
  [story tests](../../packages/test-story/docs/roadmap.md),
  [type helpers](../../packages/types/docs/roadmap.md).
- [Repository quality](../../packages/quality/docs/roadmap.md),
  [heavy commands](../../packages/heavy-lock/docs/roadmap.md),
  [local PostgreSQL](../../packages/local-postgres/docs/roadmap.md),
  [shared skills](../../packages/skills/docs/roadmap.md),
  [Work Board](../../packages/work-board/docs/roadmap.md).

## Open questions for the maintainer

- Which application supplies the first host-level acceptance path, and which
  browser and native device paths must it support?
- Should auth storage use native SQL or remain a separately supported
  integration? Request identity does not choose storage policy.
- Which router needs per-request registries and hydration? Settle SSR isolation
  from that host rather than inventing a generic router architecture.
- What delivery and reconciliation policy does the first multi-process
  deployment require? A live connection does not establish completed freshness.
- Which edit justifies optimism or offline writes, and who owns conflict
  resolution? Generic offline synchronization remains outside the default path.

General SQL query-language design and migration checksum/edit policy belong to
the [SQL roadmap](../../packages/effect-sql/docs/roadmap.md). Event sourcing,
projection replay, mandatory streaming and a second authored ORM model remain
outside the framework's scope.
