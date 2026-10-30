# Changelog

## 0.5.1 - 2026-10-30

### Changed

- Require Effect 4.0.6 and align the Effect companion package peers and generated starter catalog to the same exact release. Install the 4.0.6 Effect stack together.

### Fixed

- Register hosted RPC cache-control handling through Effect 4.0.6's request-scoped pre-response API so responses keep `private, no-store`.
- Accept native RPC's `application/x-ndjson` media type while preserving `application/ndjson` callers at the transport guard.
- Keep subscriptions open after their HTTP request body completes; closing the socket still cancels them.

## 0.5.0 - 2026-10-28

### Added

- Mark model fields with `bucket(schema)` from `@shivaedev/changes/buckets.ts`. SQL repositories announce each written record and its old and new buckets after commit, including inserts, deletes, void writes and conflict writes. Bucket codecs decode stored values before building query keys; absent values have no bucket. Bucket writes require PostgreSQL 18 or later for atomic old-row observations.

### Fixed

- Enforce declared query read policies at the hosted RPC handler boundary, including contracts without identity middleware, whose viewer is anonymous. Query RPC error schemas include `QueryReadDenied` so native clients receive typed refusals before handlers run.
- Keep collection methods and untyped schema internals from making data parameters appear to carry callable services. Direct service implementations, nested dependency fields and service arrays remain subject to `effect/service-parameters`.

### Breaking

- Move key imports from `@shivaedev/contract/keys.ts` to `@shivaedev/changes/keys.ts`. Declare bucket fields with `collection(name, idSchema, fields)` and publish affected buckets alongside record keys.
- Replace collection policy maps, `mergeReadPolicies`, `ReadPolicy` and `ReadPolicyMemoWindow` with each query's `readPolicy(payload, viewer)`. Declare the same query's live scope with `reads(payload, viewer)`. Bound query atoms and subscriptions refuse missing policies with a declaration error; one-off query `run` calls remain available. Denied queries refuse the entire subscription. Server adapters replace `QueryReads` and `ChangesReads` with `QueryDefinition` and `ChangesQueries`. Custom middleware calls `authorizeReads(effect, request, viewer)` and declares `MissingReadPolicy` and `QueryReadDenied` errors.
- Custom subscription adapters yield `ChangesQueries.resolve(references)`, call `querySubscription(requests, viewer)` and pass the authorized result to `makeLiveServer.subscribe(subscription, context)`. Metadata values expose `QueryDefinition.definition` and `CommandInvalidation.invalidates` instead of bare definitions and callbacks. Yield the Effect returned by `queryKeys(queries, references)` when projecting keys for a custom stream. `resolveChanges` supplies the authorized subscription in hosted applications. Changed hints can carry query positions so bindings can rerun session-scoped reads without deriving session scopes in the browser.
- Remove `appHost`'s `readPolicy` option and module policy registration. Session and permission middleware apply query policies using the current session viewer. Handle the new typed policy errors in native clients, including `QueryReadDenied` on query RPCs without identity middleware; widen explicit query error annotations accordingly.
- Replace `sessionCommandChanges` with `commandChanges` for custom session middleware. Command invalidation callbacks can receive the session viewer as their third argument. Announce viewer buckets there; background writers must explicitly publish those bucket keys after commit.
- Built-in admin queries declare their permission policies alongside their schemas and read scopes. Consumers keep supplying the existing session and permission middleware layers.
- Local Work Board and Fleet queries declare their existing loopback read access explicitly so their generated live subscriptions remain available.
- `withChangeCoverage` now requires every declared record and bucket key, and a table name alone no longer covers a raw write. Migrate `covers` values from strings to typed item and bucket keys, and record `invalidationKeys(changedKeys)` through `invalidateOnCommit`. Repository writes declare their own keys automatically; raw writers declare all affected records and buckets.
- Bulk repository writes retain every record key instead of replacing them with `<table>:*` above 1,000 rows. Consumers observing raw notifications should handle the complete key set, which can span several NOTIFY payloads.
- Direct callers of the repository implementation helpers must pass a `RepositoryChanges` boundary to `makeCompositeCrud`; `versionedStatements` no longer returns `returningKeys`. Use the boundary's `returning()` fragment so void writes retain the row's bucket fields.

## 0.4.0 - 2026-10-27

### Breaking

- Rename `@shivaedev/effect-changes` to `@shivaedev/changes`. Change dependency declarations and imports from `@shivaedev/effect-changes/...` to `@shivaedev/changes/...`; module paths inside the package are unchanged.

## 0.3.2 - 2026-10-24

### Changed

- Require Effect and its companion packages at exactly 4.0.5. Generated applications use the same versions.

## 0.3.1 - 2026-10-18

### Fixed

- `beforeCommit` preserves services scoped by the committing transaction when supplying its captured dependencies.

## 0.3.0 - 2026-10-13

### Breaking

- Requires stable Effect 4.0.4 in place of 4.0.0-rc.112. Effect 4.0.4 moves the former `effect/unstable/*` modules to `effect/*` and renames constructors such as `Config.string` to `Config.String`.

## 0.2.1 - 2026-10-12

### Added

- `makeChannel` accepts a typed `beforeCommit` hook and exposes a scoped `BeforeCommit` reference. `within` runs it with the deduplicated root changes inside the native transaction; a hook failure rolls back instead of publishing. Direct driver bindings can run `CommitFrame.beforeCommit` before their callback returns.
- `CommittedSink` can override transaction publication while retaining the ordinary sink for unframed records and batches.

### Changed

- Explain the package's purpose, transaction model and usage in the README, add agent guidance and package north-star and roadmap docs, and publish `docs/` with the README while keeping agent guidance out of the package.
- Build package JavaScript, declarations and source maps with TypeScript 7.

## 0.2.0 - 2026-10-04

### Changed

- Breaking: no root entry and no module that re-exports another. `exports` maps one `"./*.ts"` pattern to every module (`src` under the `source` condition, `dist` otherwise), so you import the module that defines a name, and a bundler sees only the modules you use. Where each name now lives:
  - `@shivaedev/effect-changes`: `@shivaedev/effect-changes/channel.ts` (`Channel`, `ChannelOptions`, `makeChannel`), `@shivaedev/effect-changes/frame.ts` (`Frame`, `Outcome`), `@shivaedev/effect-changes/observe.ts` (`Observation`, `Observer`), `@shivaedev/effect-changes/publish.ts` (`Publish`, `PublishFailure`)

## 0.1.1 - 2026-10-04

### Changed

- Imports that leave their folder go through `#` aliases declared in the `imports` field of `package.json`: `#*.ts` resolves to `src` under the `source` condition and to `dist` otherwise, and `#test/*` names a test file. The published modules and declarations name the package's own files through these aliases.

- Validate packed consumers and executable bins through the shared workspace gate.

- Build with the `@shivaedev/quality` tsconfig presets, which target ESNext and allow only erasable TypeScript syntax.

- Type-check with TypeScript 7 only. TypeScript 6 still builds the package.

- Lint and format with the `@shivaedev/quality` Biome preset through `quality lint` at the repository root, which replaces the package's `check` script.

- Run tests through the `@shivaedev/quality` Vitest projects, which take a test's environment from its file name. Type tests are named `*.typecheck.test.ts`.

- Keep `package.json` in sort-package-json key order, checked by `quality lint`.

## 0.1.0 - 2026-09-26

### Added

- Add `makeChannel`: record changes inside a transaction and publish them once,
  deduplicated by key, only after the outermost frame for their owner commits.
  Nested frames merge on commit and are discarded on rollback; frames are kept
  per transaction owner.
- Wrap exit-reporting native transactions with `within`, Promise-committing
  drivers with `open` and `settle`, and non-transactional work with `batch`.
- Publish exactly when the database committed, including when the caller is
  interrupted while `COMMIT` is in flight.
- Log a sink failure after commit, whether a failed Effect, a defect or a
  synchronous throw, and keep the committed result by default;
  `onPublishFailure: "die"` raises a defect instead.
- Expose `channel.Sink` and `channel.Observer` as `Context.Reference`s: tests
  can swap the sink for a scope and observe every recorded, published and
  discarded change.
