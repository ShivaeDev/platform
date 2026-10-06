# Framework roadmap

The [design and capability inventory](./README.md) describe the target. Unchecked
items are outstanding, including items currently being implemented. Completion
requires the stated observable behavior and relevant repository checks.

## First implementation slice — implemented and validated

| Work | Scope | Completion evidence |
| --- | --- | --- |
| `effect-service` | Extract generic service declaration and dependency binding | Compiler checks for dependency/error/scope contracts; runtime acquisition and release tests |
| `effect-form` | Extract Schema validation, submission and draft behavior | Real atom tests for errors, async checks and edits during refresh/submission; React binding checks |
| `effect-react` | Small native query/action hook surface | Rendered behavior for pending/success/failure/refetch and preserved result types |
| `effect-sql` | Native model/repository foundation | Model-derived input/output types; decoded CRUD and rollback through actual SQL |
| `effect-test` | Correct deterministic clock behavior in existing runner | Typed failures retry while defects and interruption escape immediately; regression tests fail against the old implementation |
| Native RPC example | Compose native contracts, handlers and client behavior | Actual RPC round-trip and failures without a new RPC wrapper package |

These packages are independent entry points. Each publishes to npm from `main` at
its `package.json` version: `effect-service`, `effect-form`, `effect-react` and
`effect-sql` at 0.1.0, `effect-test` at 0.1.2.
The full `pnpm ready` gate passed: formatting, builds, TypeScript 6 and 7,
runtime tests, and installed-package consumers. PostgreSQL tests ran against an
isolated PostgreSQL 18 instance; CI is configured to run the new SQL test too.

The [rendered feature fixture](../../packages/effect-react/src/nativeFeature.dom.spec.tsx)
connects an actual SQLite repository, native RPC handlers/client, AtomRpc and
React. A successful action refreshes the list; a rejected action leaves persisted
and rendered data intact. It uses in-process RpcTest, not HTTP serialization or
authentication. The [order-editing example](./order-example.md) extends this with service
declarations, editable forms and authenticated HTTP.

The first slice needed no RPC wrapper package. The order example later showed
repeated contract, rejection and reactivity-key work, now covered by
`@shivaedev/effect-contract`, which still produces native RPC definitions. The
[RPC guide](./native-rpc.md) and [migration guide](./migrations.md) document the
native components and their boundaries. The action hook exposes `dispatch()` and
observable state, not a per-invocation completion promise: overlapping calls are
owned by the supplied native atom. Explicit imperative outcomes use the native
RPC Effect directly.

### Application-boundary validation phase

- [x] Exercise PostgreSQL numeric/date/JSON codecs, schema failures and rollback.
- [x] Map known constraint failures to domain errors while preserving other SQL errors.
- [x] Verify PostgreSQL migration upgrades, failed batches and existing-ledger concurrency.
- [x] Exercise real BetterAuth signed sessions through native RPC middleware.
- [x] Prove action dispatch interruption and Node abort-signal lifetimes.
- [x] Prove explicit session replacement clears cached queries and editable drafts.
- [x] Exercise decoded submission, optional fields, failed-save retry and
  refresh during edits through the form package.

These are executable boundary examples, not an application deployment. See the
[validation guide](./boundary-validation.md) for source links and practical limits.

### Repository strictness (Antumbra conventions)

- [x] Strict shared `tsconfig.base.json` and `.ts` relative imports with `rewriteRelativeImportExtensions`.
- [x] GritQL bans: type assertions, ambient runtime, relative import extensions, `Effect.fn` span names (`Owner.operation`).
- [x] Repository rules: nesting depth, no `index.ts` barrels.
- [x] Manifests: `catalog:`/`workspace:*` dependencies with exact catalog versions.
- [x] Browser-safe sources for effect-contract, effect-form and effect-react.
- [x] Package boundaries: leaf packages stay leaves; browser packages never import server packages.
- [x] `@shivaedev/quality` engine: typed `quality.config.ts`, the `quality` command line, a report grouped by rule,
  a baseline of existing debt and a registry of reasoned exceptions, with `structure/max-lines` as its first rule.
- [x] `@shivaedev/heavy-lock`: the machine-wide heavy-process lock as a package, with a command line and an Effect API.
  Platform's `build`, `typecheck`, `test` and `test:package` scripts run it from source.
- [x] `@shivaedev/quality` comment rules: no JSDoc, line or pull request references, banners or TODOs, and at most
  2 comments per file. `pnpm lint` runs the package's built-in rules, which replace the repository's own line limits.
- [x] `@shivaedev/quality` suppression rules: no inline suppressions or casts through `unknown`, `any` or `never`, and Biome
  overrides only where `quality.config.ts` declares them with a reason. They replace the repository's pragma registry.
- [x] `@shivaedev/quality` import rules: no runtime import cycles, every import resolves, and the package boundaries as
  fences in `quality.config.ts`, each with an illegal and a legal example. They replace dependency-cruiser.
- [x] `@shivaedev/quality` baseline: a JSON Lines baseline, moves carried by git's rename detection, and `tighten`
  for pre-commit. A finding the baseline does not cover fails `pnpm lint`; a baseline that grows is reviewed in the
  diff and called out in the pull request.
- [ ] Port the remaining repository rules in `script/lint/rules/` into `@shivaedev/quality` with options, split the Grit plugins
  and add presets, so `pnpm lint` runs only through the package.
- [ ] Effect boundaries (no `try`/`async` outside `adapters/`): 99 source and 670 test
  violations. Source work is mechanical; tests need a scope decision (rewrite into Effect style or exempt).
- [ ] Service parameters: porting Antumbra's rule would flag public APIs that take services or `Context`
  (`registerJobs`, `effectPrismaAdapter`), so it needs API decisions first.

### Next bounded work

1. Wire a host's auth owner into `SessionBoundary` (`session`, `identify`, `recheck`).
2. Verify real browser credentials and Capacitor resume/session behavior.
3. Choose migration authoring/run conventions for consuming applications; every runner of a ledger uses `migratePostgres`.

Adoption in consuming applications remains separate work.

### Work Board consumer slice — in progress

The maintainer approved native RPC/AtomRegistry, Changed/Resync hints using
existing read keys, and esbuild 0.28.1 for locally bundled browser assets. This
bounded slice advances sections 5, 8 and 11 before Work Board step 09 adoption.
The server's Markdown/indexing policy remains with Work Board; the shared client
owns invalidation and native resource lifetime.

- [x] Build an executable native streaming HTTP consumer with two document
  queries, a derived list, ordinary contracts and a browser-owned AtomRegistry.
- [x] Extend `bind` to accept the consumer's larger native RPC group; compiler
  regressions reject incomplete clients while preserving contract types.
- [x] Extract browser-safe `Key`/`LiveHint` Schemas and `live` only after the
  HTTP example establishes the repeated coordination. Native Reactivity and
  query atoms retain their cache, error and interruption ownership.
- [x] Verify precise affected-query refresh, explicit full scoped reconciliation
  after initial/reconnected delivery, retained data on failures, stale-response
  rejection, paused observations bounded at 256 and stream teardown.
- [x] Run the same bundled client over real HTTP in Chromium 151: targeted
  item/list edits preserve the unrelated item; pause/resume, typed read and
  stream outages, missed changes, stale responses and pagehide teardown pass.
  Desktop/mobile/dark preference/reduced motion pass with no page errors or
  horizontal overflow. This is a consumer fixture, not Work Board adoption.
- [x] Complete repository handoff and installed consumer evidence: full
  `pnpm ready` passes 1,115 package tests, four existing expected failures and
  one existing intentional `effect-test` skip, plus nine orchestration tests,
  lint, builds, typechecks, real PostgreSQL and every packed consumer. The new
  installed live consumer checks Schema rejection, pause and full resync. The
  final contract readiness and lint checks also pass after naming cleanup; the
  touched binding and legacy resume quality baseline loses 27 findings and grows nowhere.
- [x] Move browser-safe `resumeSignal` into effect-contract, preserving the
  effect-react entry as a compatibility delegate and automatically installing
  its shared runtime dependency. Release effect-contract 0.4.0 and effect-react
  0.2.1; the maintainer approved this scope and subsequent package releases.
- [x] Verify shared lifecycle composition: actual Chromium offline/online catches
  up and emits one resume event; DOM regressions distinguish visible/hidden
  events and prove listener disposal. A derived resume atom initializes its
  dependencies even without a separate subscriber. Physical tab transitions
  and Capacitor are not established by these checks.
- [x] Adopt native contracts, RPC and shared live primitives in Work Board,
  replacing the existing automatic fetch/EventSource coordinators. Preserve
  server-rendered HTML, native GET links, source focus, details, diagrams,
  highlights and reading controls without React or cloud dependencies.
  [Work Board acceptance](../../packages/work-board/docs/vision/roadmap.md#step-09-native-adoption-and-orientation-evidence)
  records its native HTTP, DOM, real Chromium and packed-asset evidence separately.
- [x] Close Work Board step 09 after its own real browser and repository
  acceptance, including reference/backlink/evidence dependency discovery.

Every fixture query reads `workspace.list` as well as its own item/list key.
Targeted changes invalidate affected items and their list; unrelated item queries
retain their result. Initial/reconnected delivery, pause resume and uncertainty
reconcile the explicit common scope. `documents.list` is not an item-wide resync.
Connection status does not establish completed query freshness or acceptance.

See [live updates](./live-updates.md) for the native HTTP composition, retained
errors, bounds, teardown and deployment limits. The minified browser fixture is
about 522 kB before compression; Work Board's eventual bundle budget remains an
adoption measurement. No replay cursor, journal, new package, multi-process
delivery, authentication policy, offline write or Capacitor guarantee is added.

## 1. Services and runtime

- [x] Implement the minimal service declaration helper with declared dependency
  binding, private initialization state, and ordinary Effect methods.
- [x] Preserve initialization failures, method failures, Layer lifetimes, and
  caller scopes in both behavior and public types.
- [ ] Align supported Effect versions and document runtime ownership at host
  boundaries; use existing Platform runtime machinery where appropriate.

**Accept when:** consumers can replace a service with a test Layer; undeclared
dependencies are rejected; resources release at the documented scope boundary.

## 2. Schemas and operation contracts

- [x] Use Schema/model variants as the source for decoded values, storage codecs,
  generated fields and writable inputs.
- [x] Demonstrate query/action contracts with ordinary success and typed error
  values using native RPC schemas first.
- [x] Extract Antumbra declaration helpers only where the example demonstrates
  duplicated work; remove fact emission and journal-sequence assumptions.
  `@shivaedev/effect-contract` provides `query`, `command` and `contract` with
  typed rejections; the order example uses them.

**Accept when:** a feature declares each boundary contract once and can call its
service locally or over RPC without changing its domain result/error model.

## 3. SQL and simple repositories

- [x] Expose native model-derived CRUD without a second authored database schema.
- [ ] Establish supported field/storage mappings and preserve decoding failures
  in the error channel.
- [x] Add only demonstrated common selection/filter/order/limit needs, deriving
  types and decoders from model fields; retain explicit SQL for exceptions.
- [x] Verify PostgreSQL numeric, timestamp, JSON, nullability and generated-value
  behavior before claiming PostgreSQL coverage.
- [x] Define application-usable constraint errors and verify transaction rollback.

**Accept when:** a consumer gets inferred writable inputs and selected results,
malformed rows fail decoding, values are parameterized, and failed operations do
not commit partial writes. Authorization remains explicit application policy.

## 4. Migrations

- [ ] Wrap native Migrator with minimal authoring/configuration and status/run
  commands when an application fixture needs migrations.
- [x] Test fresh, repeated and failed migrations through `migratePostgres`.
- [x] Verify concurrent migration execution and PostgreSQL migration behavior.
- [x] Document native applied-ID behavior and operational limitations.
- [x] Serialize empty-database ledger initialization with
  `migratePostgres`: advisory lock, explicit lock timeout and pre-created ledger
  around the unchanged native Migrator
  ([evidence](./postgres-migrations.md)).

**Accept when:** a fresh database and an upgrade reach the expected schema, a
failed migration has documented recovery behavior, and repeat execution is safe.
Concurrent runners are safe only when all of them use `migratePostgres`; the
timeout value and a status command are application decisions. Content checksums, edited migrations, nontransactional DDL and schema-diff
generation remain separate decisions.

## 5. Native RPC

- [x] Build an example with native Rpc/RpcGroup, handlers and client.
- [x] Extend the example with request middleware and a real host transport.
- [x] Exercise ordinary reads/writes and typed failures over HTTP.
- [ ] Add application host transports and optional streaming only as needed.

**Accept when:** the actual client calls the actual handler with preserved
input/result/error types and clean cancellation. No mandatory stream or journal
protocol is introduced. Do not create a redundant RPC package for the example.

## 6. Authentication and request context

- [x] Record options for the existing Better Auth boundary: native SQL adapter
  versus an explicitly separate supported auth integration.
- [x] Reuse request-service layering principles for native RPC session context.
- [x] Verify cross-user read/write rejection, session revocation and expiry over
  real HTTP in the order example.
- [x] Extract the session middleware applications duplicate: request-local
  `Identity`/`OptionalIdentity`, a Better Auth session provider, an explicit
  Origin policy, and outage kept distinct from unauthorized
  ([request context](./request-context.md)).
- [x] Share a browser-safe error taxonomy usable as native RPC errors, contract
  rejections and form field rejections.
- [ ] Integrate a consuming application's session provider and its browser/mobile
  policy, including which Origin to accept from Capacitor clients.

**Accept when:** independent requests cannot share principals, unauthenticated and
unauthorized access fail appropriately, and supported browser/mobile session
behavior works. Auth storage and SSR/session policy remain open decisions.

## 7. Client queries and actions

- [x] Build small hooks over native AtomRpc/atom-react rather than a second cache.
- [x] Preserve inferred payload, success and failure types with concise pending,
  result and action invocation ergonomics.
- [x] Define identity, TTL, invalidation and session-reset behavior explicitly.

**Accept when:** a consumer renders and mutates a feature without manual atom
plumbing; refetch, cleanup and errors behave correctly; cache lifetime is bounded
by the chosen policy rather than an unevictable input-key map.

## 8. Freshness and optional live updates

- [x] Make ordinary request/response and invalidation the default.
- [x] Adapt read/write dependency metadata and invalidate only after successful
  transaction completion; rolled-back writes must not announce a change.
  Contracts declare `reads`/`invalidates` keys for clients; `transact` in
  `@shivaedev/effect-sql` flushes server-side keys only after the outermost
  commit. Both are in-process; no cross-process delivery exists.
- [x] Extract the commit boundary into `@shivaedev/effect-changes`: a
  database-agnostic channel that publishes recorded changes once per commit,
  per owner, with savepoint merge and discard, Promise-driver frames, batches,
  a logged sink failure that keeps the committed result, and test seams for the
  sink and an observer. `transact` is rebased on it; PostgreSQL tests cover
  interruption during `COMMIT`, failed deferred commits and two pools
  ([commit-bound changes](./changes.md)).
- [x] Bind a Prisma Classic `$transaction` driver to a channel through
  `open`/`settle`: `@shivaedev/effect-changes-prisma` records writes from a
  typed model map, publishes after `COMMIT` including when the caller is
  interrupted during it, merges nested transactions, reports count-only `*Many`
  writes, and adds a `pg_stat_xact_user_tables` coverage check for tests.
  PostgreSQL tests use a generated Prisma 7 client; no application has adopted
  it yet ([Prisma Classic](./changes.md#prisma-classic)).
- [ ] Add opt-in subscriptions only for a demonstrated consumer.

**Accept when:** an action refreshes affected views and preserves unrelated ones.
Multi-process/background invalidation delivery must be selected and tested for
the deployment; in-process Reactivity alone is not that delivery mechanism.

## 9. Loading, errors and optimistic UX

- [x] Preserve previous successful data during the chosen refresh/reconnect
  states and expose failures without erasing useful data accidentally.
- [x] Offer consistent action/field error hooks with application-owned wording
  ([`useEditor`/`useCreate`](./editing.md)).
- [ ] Prove optimistic behavior only for concrete edits that benefit from it.

**Accept when:** rendered tests cover initial loading, refresh failure, retry and
concurrent actions. Any optimistic flow restores or reconciles state correctly
after rejection and out-of-order responses.

## 10. Forms and editable drafts

- [x] Extract encoded field state, decoded submission, touched/submitted errors,
  advisory async checks and optional React hooks.
- [x] Merge refreshes per field (untouched fields adopt server values, edited
  fields keep local input), accept successful submissions without overwriting a
  refresh received during the save, retain edits made while saving, and support
  explicit revert.
- [x] Validate numeric decoding, optional and date fields, and encoded choices
  through public form APIs.
- [x] Bind a query, form and save command in [`useEditor` and `useCreate`](./editing.md),
  including create-reset that keeps fields edited during the save.

**Accept when:** consumers use field schemas once, stale async checks cannot
overwrite current field feedback, and refresh/save races do not discard edits.
Nested field arrays and a general form language are not initial requirements.

## 11. SSR, browser and mobile lifecycle

- [ ] Evaluate router-specific per-request atom registries and hydration.
- [x] Define registry/session reset and disposal behavior at application roots.
- [x] Provide a session-generation owner (`SessionBoundary`) and a resume signal
  combining visibility, connectivity and an injectable native source.
- [ ] Validate Capacitor resume/connectivity and request interruption in a
  consuming application rather than equating native lifecycle with window focus.

**Accept when:** supported rendering and lifecycle paths preserve isolation and
freshness without duplicate subscriptions or leaked resources. SSR architecture
and generic offline writes remain deferred until required by a consumer.

## 12. Testing

- [x] Fix and verify TestClock behavior in the existing test package.
- [x] Build a real repository/RPC/atom/rendered-UI fixture using public APIs.
- [x] Incorporate service declarations and editable forms into that fixture.
- [x] Add rendered form/save tests through the actual service and HTTP handlers,
  with server/registry cleanup and public persistence assertions.
- [x] Prove overlapping action dispatches interrupt earlier work and Node abort
  signals follow connection lifetimes.
- [ ] Validate deployment host/proxy cancellation and in-transaction interruption.
- [x] Verify package declarations and installed consumers; run `pnpm ready`.
- [x] Add `@shivaedev/test-story`, the generic core of a story DSL for tests:
  staged traits that refuse an impossible setup, a story log added to a failing
  test, and a settle loop that names why a story never settles, with Effect
  variants behind the optional `effect` peer.
- [x] Run a real PostgreSQL repository test for selection, nulls, encoded text,
  generated identity and transaction rollback.
- [ ] Add broader PostgreSQL codec coverage and actual browser/native checks.

**Accept when:** tests demonstrate observable behavior across real boundaries,
including typed failures and release/cancellation, and distinguish local fixture
coverage from deployment-specific proof.

## 13. Jobs and external integrations

- [ ] Retain existing pg-boss payload schemas, worker lifecycle and durable queue.
- [ ] Document Effect service boundaries for external provider and native SDK
  calls, including cancellation and retry responsibilities.
- [ ] Validate product-specific background/device behavior during adoption.

**Accept when:** workers compose with application services, reject invalid payloads
and shut down cleanly. Runtime primitives alone do not establish native device
integrations or offline synchronization support.

## 14. Tracing and diagnostics

- [x] Correlate native RPC requests: request id and user id on server spans and
  log annotations, verified over HTTP.
- [ ] Establish request/action correlation and preserve Effect trace context
  across the chosen RPC and SQL paths.
- [ ] Adapt useful Antumbra sink failure behavior without requiring its local
  SQLite trace storage.
- [x] Log RPC failures and defects once, with redacted payloads.
- [ ] Define export/log conventions, redaction policy and application error presentation.

**Accept when:** a representative request is diagnosable across boundaries,
telemetry failure does not break the feature, and sensitive data handling is
explicitly tested for each consuming application.

## Decisions deliberately left open

- General SQL DSL, join/aggregate inference and automatic nested relationships.
  Start with common repository operations and explicit exceptional queries.
- Migration checksums/edit policy, nontransactional DDL and schema diffing.
- Auth storage integration, SSR router architecture and mobile session policy.
- Cross-process live invalidation, optimistic policies and offline conflict
  handling. Choose these from actual deployment and product requirements.

Event sourcing, projection replay, mandatory streaming, and a second ORM/query
builder model are outside this framework's scope.
