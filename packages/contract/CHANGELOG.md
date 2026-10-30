# Changelog

## 0.21.0 - 2026-10-30

### Changed

- Work Board file edits refresh authorized contract queries over Platform's shared WebSocket, including the Claude plugin's overview. Unrelated document reads retain their values.
- Forwarding proxy fixtures can disconnect and resume real client traffic at the same address.
- Automatic contract live connections expose a `paused` atom; resuming reconciles their mounted queries. Bindings can supply a `resumeWindow` for embedded browser lifecycle events.
- Live status notifications use the registry's asynchronous scheduler, so mounting a query during React rendering does not update another component.
- Require Effect 4.0.6 and align the Effect companion package peers and generated starter catalog to the same exact release. Install the 4.0.6 Effect stack together.

### Fixed

- Register hosted RPC cache-control handling through Effect 4.0.6's request-scoped pre-response API so responses keep `private, no-store`.
- Accept native RPC's `application/x-ndjson` media type while preserving `application/ndjson` callers at the transport guard.
- Keep subscriptions open after their HTTP request body completes; closing the socket still cancels them.

### Breaking

- Work Board removes its `subscribe` RPC. Consumers bind its contract queries with Platform's default WebSocket client instead of consuming Board-specific change hints.
- `WorkspaceConfig.indexing` supplies a progress snapshot Effect. Replace indexing Stream overrides with an Effect that reads current progress.

## 0.20.0 - 2026-10-29

### Added

- Forwarding proxy fixtures relay WebSocket upgrades, including the same origin and trusted proxy headers as HTTP requests. Existing proxy URLs also work for socket clients.

### Breaking

- Contract clients use Effect RPC over a shared WebSocket by default. Replace `httpClient`, `transformClient` and `serialization` client options with a native `protocol` Layer for custom transports. Node clients can supply upgrade `headers` and a `webSocketConstructor` Layer; browsers use their session cookie automatically.
- Mounting a bound query subscribes before its first authorized read; unmounting releases its subscription. Use `live: false` when binding an ordinary client without subscriptions. Query preparation alone no longer opens a change stream.
- Hosts serve live subscriptions on the WebSocket upgrade at the RPC path. Move HTTP `$changes` consumers to Effect RPC's socket protocol; the POST route serves ordinary RPC only. Configure development proxies to forward WebSocket upgrades.
- React session boundaries bind shared sockets to the identified session, so replacing an account upgrades with its current cookie. They also ask the auth owner to recheck when the live socket closes. Keep `recheck` safe to call after a network interruption; the auth owner still decides whether the session ends.

## 0.19.1 - 2026-10-29

### Fixed

- Automatic live tracking no longer resubscribes, and refetches every tracked query, when a query is read again after the garbage collector reclaimed its atom. A query's tracking id now follows its tag and payload instead of the atom object AtomRpc holds weakly.

## 0.19.0 - 2026-10-28

### Added

- `@shivaedev/contract/bind.ts` builds a bound HTTP RPC client and atom runtime from a contract and URL, with an inferred request transform for cookies or bearer tokens.
- `@shivaedev/react/client/useNow.ts` exports `useNow(interval, runtime?)` to render the runtime's Effect clock and refresh on the requested interval, including with TestClock.
- Declare collection policies beside module contracts with `ModuleReadPolicies` and combine them with `mergeReadPolicies`. Unclaimed collections are denied. Each policy receives the request's optional viewer.
- The application host accepts a merged `readPolicy` and checks queries and live hints inside native session middleware, using its resolved identity without another session lookup. Policies can use application services and return `Forbidden` or `AuthUnavailable`.
- Query authorization and live-hint filtering check keys concurrently so native `Effect.request` resolvers can batch membership checks. Plain Effect policies remain supported.

### Fixed

- Live queries accept inputs JSON cannot encode, such as bigint ids.
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
- `authorizeReads` now takes `(effect, request, policy, viewer, denied)`, and policies take `(key, viewer)`. Pass `Option.some(resolvedIdentity)` or `Option.none()` before the denial effect. Existing unary policy functions may ignore the new viewer argument. Apps using `appHost` can replace custom read middleware with its `readPolicy` option and merge their modules' policy maps.

## 0.18.0 - 2026-10-27

### Added

- SQL stories can declare domain read keys that cover written tables with `withChangeCoverage(body, { covers })` and assert committed change keys with `expectPublished(keys)`.
- Contract stories can observe a viewer's live stream with `watchHints` and use `heard(viewer, keys)` to await allowed hints or report denied keys as unheard on the story clock.

## 0.17.0 - 2026-10-27

### Added

- `publicConfig(schema)` from `publicConfig.ts`, the public client configuration contract that lived in `@shivaedev/platform/rpc/publicConfig.ts`.

### Breaking

- Rename `@shivaedev/effect-contract` to `@shivaedev/contract`. Change dependency declarations and imports from `@shivaedev/effect-contract/...` to `@shivaedev/contract/...`.
- Move `errors/taxonomy.ts` and `errors/rejectedField.ts` to `@shivaedev/errors`. Import the failure classes from `@shivaedev/errors/taxonomy.ts` and `rejectedField` from `@shivaedev/errors/rejectedField.ts`.

## 0.16.0 - 2026-10-26

### Added

- Provide the shared expected failure schemas and `rejectedField` in `@shivaedev/effect-contract/errors/`, so browser-safe contract consumers can use them without depending on Platform. Tags, schema fields and RPC encoding remain the same.

### Breaking

- Move all imports from `@shivaedev/platform/errors/taxonomy.ts` to `@shivaedev/effect-contract/errors/taxonomy.ts`, and from `@shivaedev/platform/errors/rejectedField.ts` to `@shivaedev/effect-contract/errors/rejectedField.ts`. The old modules are removed. Add a direct `@shivaedev/effect-contract` dependency if the consuming package does not already declare one. Admin, GitHub, Work Board and Work Fleet public failure types now refer to these shared classes.
- Generated apps use the new imports. The create-app updater applies the starter changes through its usual three-way patch; it does not rewrite imports in app-owned files. Replace both old import paths above in those files when upgrading existing apps.

## 0.15.0 - 2026-10-25

### Added

- `bind` accepts an optional `resume: ResumeSource` to reopen and reconcile automatic live subscriptions from application lifecycle events alongside the browser defaults. Registry disposal unsubscribes the source.
- React automatic session subscriptions use the same source supplied to `bind` in `SessionBoundary.connect`, so native shells can reconcile live query screens from their own lifecycle events.

## 0.14.0 - 2026-10-25

### Added

- `effect-sql` logs one lost warning per PostgreSQL listener outage and an info line after recovery, with `downtimeMs` since that warning and `streamCount` for the live streams resynchronized. Failed reconnect attempts log at debug. Initial successful startup logs neither outage line, and outage diagnostics omit database error causes and connection details.
- `effect-contract`'s `makeLiveServer.resync` reports the number of open live streams it marked for reconciliation, excluding streams whose scopes have closed.

### Breaking

- Direct `postgresChanges` callers must supply `resync: Effect.Effect<number>` instead of `Effect.Effect<void>`. Pass `makeLiveServer.resync` unchanged, or return the number of open streams marked by your own stream owner.

## 0.13.0 - 2026-10-25

### Added

- Declare `keyScope: "session"` on a contract and bind it with `bind(Api, Client, { registry })`. Its query keys, successful-command invalidations, live hints and reconciliation use that session registry's scope. `List` and `Item` retain their shapes and item/list/wildcard semantics; `readKeys`, `invalidationKeys`, `makeLiveServer.stream` and `live` accept contextual scope resolution. Server adapters receive the `KeyScope` annotation and must resolve session scopes from request-local authenticated identity.
- Session-scoped automatic subscriptions track mounted query references per registry and release them when queries unmount or the registry is disposed.

### Breaking

- The reserved `<contract>.$changes` payload is now `{ queries: [{ query: "get", payload: { id: 1 } }] }`, typed and decoded with the contract's declared query payload schemas. Custom clients must replace `{ keys }` with declared query references; payloadless queries use `{ query: "list", payload: undefined }`. Subscription handlers must resolve these references with `queryKeys(Api.declaration.queries, queries)` or the RPC's `ChangesReads` annotation before calling `makeLiveServer.stream`. `changesRpc` now requires both the contract name and its query declarations. No raw-key subscription endpoint remains.
- Board's handoff and response RPC contracts use distinct `work-board-handoffs` and `work-board-responses` namespaces so merging contracts preserves each declared subscription schema. Custom RPC clients must replace the `work-board.` prefix for handoff and response operations with the corresponding namespace; operation names and payloads stay the same.

## 0.12.0 - 2026-10-25

### Added

- effect-contract item reads refresh on their collection-wide `<collection>:*` key, with live hints naming each affected subscribed item.

### Breaking

- effect-sql writes returning more than 1,000 rows across all chunks of a single call announce `<table>` and `<table>:*` instead of item keys. Code registering raw `<table>:<id>` Reactivity keys outside effect-contract must also register `<table>:*`.

## 0.11.1 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.11.0 - 2026-10-24

### Added

- Contracts expose `application`, a native RPC group for building application handlers without naming the reserved `$changes` stream. Middleware stays attached, and Platform hosts complete the full contract with the stream handler.
- Generated applications build their handlers through the contract's `application` group.

### Changed

- Require Effect and its companion packages at exactly 4.0.5. Generated applications use the same versions.

## 0.10.0 - 2026-10-19

### Added

- Choose a live changed-hint coalescing window per bound query with React's `useQuery(atom, { coalesceWindow })`, keeping the session window as the default. Queries over one connection refetch on their own schedules; changing the option does not reconnect or refetch queries.
- Configure a bound query's window through its registry with `queryCoalesceWindow(query)` from `@shivaedev/effect-contract/queryCoalesceWindow.ts`.

## 0.9.0 - 2026-10-19

### Added

- Contracts include their reserved `<namespace>.$changes` stream in native RPC client types, with the same middleware as declared operations. Subscribe through a client typed from the contract without a cast or a separate Changes group.

### Breaking

- Native contract handler builders now require the reserved `$changes` handler. When a Platform host supplies it, build application handlers with `contract.omit("<namespace>.$changes").of(...)` and `.toLayer(...)`, while retaining the full contract for the host and client. Standalone servers and test clients must supply a changes stream handler. Remove hand-built Changes groups and use the contract directly.

## 0.8.0 - 2026-10-19

### Added

- `authorizeReads` accepts typed policy failures and preserves them in the query's error channel. Declare those errors in the native RPC middleware's error schema alongside its denial so clients can distinguish an outage from denied access.
- `ReadPolicyMemoWindow`, a `Context.Reference<Duration.Input>`, configures per-subscription, per-key memoisation of successful policy results. The default is one second; provide a shorter duration or `0` to disable it. Queries always check afresh, and failures are never memoised.
- Coalesce live changed hints over a default 20 ms window, with one follow-up read when hints arrive during an in-flight refetch. Configure `live()` with `coalesceWindow`, or set its returned `coalesceWindow` atom; zero retains immediate invalidation. Reconciliation stays immediate.
- Configure automatic live connections per React `SessionBoundary` with `liveCoalesceWindow`.

### Fixed

- Failed live hint checks omit the affected keys and keep the stream open. Scoped rechecks after one second deliver an allowed key after recovery without another change or reconnect; a `false` does not schedule a recheck.

### Breaking

- Direct readers of `ReadPolicy` now receive `Effect<boolean, unknown>` instead of an infallible Effect. Handle its error channel when invoking the reference directly. Existing infallible policies passed to `authorizeReads` still work; fallible policies should declare their errors in their RPC middleware schema.

## 0.7.0 - 2026-10-19

### Added

- `authorizeReads(effect, request, policy, denied)` and `ReadPolicy` in `readPolicy.ts` share a key authorization policy between query reads and live hints. `QueryReads` in `serverMetadata.ts` exposes the declared query read keys to server middleware.
- `changesRpc(name)` retains the literal contract name for typed native clients.

### Fixed

- effect-contract's `live` coordinator no longer reconciles its read scope when `paused` is read for the first time; a component that showed the pause state while connecting used to make every loaded query read again.
- Opening a Board page sends each read once. The page starts its reads after the live connection's first update, which used to read navigation and watcher state a second time, and a failed connection does not hold the page.
- A file event that changes neither the bytes nor the modification time no longer refreshes open Board pages. A file saved with the same bytes and a new modification time still refreshes them.
- Live streams filter changed keys with the viewer's read policy and suppress empty hints, while preserving independently allowed list hints.

## 0.6.0 - 2026-10-18

### Added

- Contracts attach command invalidation metadata and a host-served change subscription. `serverMetadata.ts` exports `CommandInvalidation` and `changesRpc(name)` for server adapters.
- Bindings expose the `LiveConnection` symbol from `automaticLive.ts`; React session boundaries mount its `connection` atom and track the binding's query keys. `LiveBound` describes its connection and status atoms; `automaticLive(service, name)` and `ChangesClient` expose the underlying tracked coordination. `live` also accepts a function for `resyncKeys`.

### Fixed

- Live server hints contain only changed keys intersecting the subscription, so one item's change does not refetch unrelated item queries.

### Breaking

- Contracts reserve the `<contract>.$changes` RPC name for automatic subscriptions. Use Platform's database host and NDJSON transport for automatic live queries, and remove application subscription handlers and `live()` mounting when using a React session boundary.

## 0.5.1 - 2026-10-17

### Fixed

- Publish against `@shivaedev/types` 0.2.1 so framework consumers share the current version.

## 0.5.0 - 2026-10-13

### Breaking

- Requires stable Effect 4.0.4 in place of 4.0.0-rc.112. Effect 4.0.4 moves the former `effect/unstable/*` modules to `effect/*` and renames constructors such as `Config.string` to `Config.String`.

## 0.4.1 - 2026-10-12

### Added

- `makeLiveServer` in `makeLiveServer.ts` converts local Reactivity invalidations into native `LiveHint` streams for explicit read keys. Independent helpers keep their resync scopes separate. Each subscription starts with `Resync`; `resync` reconciles every active stream, including after a PostgreSQL listener loses its connection.
- Declare typed streaming operations with Schema payloads and elements, rejections and read keys in native RPC contracts. Bound `run` returns a native Stream, with HTTP tests proving element delivery, declared failures and server subscription release on completion or client interruption.

### Changed

- Prefix generic type parameter names in contract, operation and collection declarations with `T` while preserving their types and runtime behavior.
- Document the package's purpose, native RPC and freshness model, complete usage, design priorities and roadmap; publish `docs/` with the README.
- Build package JavaScript, declarations and source maps with TypeScript 7.

## 0.4.0 - 2026-10-05

### Added

- Optional `live.ts` invalidation over native Streams, Reactivity and AtomRpc runtimes: precise changed keys, explicit full-scope reconciliation after initial/reconnected delivery, bounded paused observations, resume, typed stream failures and scoped teardown. Native query atoms own retained data and stale-request interruption.
- `Key` and `LiveHint` Schemas for existing list/item keys and Changed/Resync hints. A real streaming HTTP/browser fixture demonstrates their composition with native newline-delimited RPC serialization.
- Browser-safe `resume.ts` owns the existing native/browser resume signal without React peers; effect-react delegates its existing entry to it.

### Changed

- `bind` accepts a native client group with additional RPC operations while preserving the declared contract's types and rejecting clients missing its operations.

## 0.3.0 - 2026-10-04

### Changed

- Breaking: no root entry and no module that re-exports another. `exports` maps one `"./*.ts"` pattern to every module (`src` under the `source` condition, `dist` otherwise), so you import the module that defines a name, and a bundler sees only the modules you use. Where each name now lives:
  - `@shivaedev/effect-contract`: `@shivaedev/effect-contract/bind.ts` (`Bound`, `BoundCommand`, `BoundQuery`, `bind`, `Failure`, `QueryOptions`, `RunFailure`), `@shivaedev/effect-contract/contract.ts` (`Contract`, `contract`, `Declared`, `OperationRpc`, `Tag`), `@shivaedev/effect-contract/keys.ts` (`Collection`, `collection`, `Identity`, `ItemKey`, `invalidationKeys`, `Key`, `ListKey`, `readKeys`), `@shivaedev/effect-contract/operation.ts` (`Command`, `CommandShape`, `command`, `OperationShape`, `PayloadSchema`, `Query`, `QueryShape`, `query`), `@shivaedev/effect-contract/rejection.ts` (`FieldRejection`, `fieldRejection`, `MatchingTags`, `Reject`, `RejectedBy`, `RejectionClass`, `RejectionSpecs`, `Rejections`, `RejectionUnion`, `RejectionValue`, `TaggedRejection`)

## 0.2.1 - 2026-10-04

### Changed

- Imports that leave their folder go through `#` aliases declared in the `imports` field of `package.json`: `#*.ts` resolves to `src` under the `source` condition and to `dist` otherwise, and `#test/*` names a test file. The published modules and declarations name the package's own files through these aliases.

## 0.2.0 - 2026-10-04

### Changed

- Consolidate duplicate test cases around observable package behavior.
- The function members of `Contract`, `Query` and `Command` are declared as properties, so TypeScript checks their parameters strictly. `QueryShape.reads` and `CommandShape.invalidates` stay bivariant, so a contract still takes operations with typed payloads; the package now depends on `@shivaedev/types` for `Bivariant`.

- Validate packed consumers and executable bins through the shared workspace gate.

- Build with the `@shivaedev/quality` tsconfig presets, which target ESNext and allow only erasable TypeScript syntax.

- Type-check with TypeScript 7 only. TypeScript 6 still builds the package.

- Lint and format with the `@shivaedev/quality` Biome preset through `quality lint` at the repository root, which replaces the package's `check` script.

- Run tests through the `@shivaedev/quality` Vitest projects, which take a test's environment from its file name. Type tests are named `*.typecheck.test.ts`.

- Keep `package.json` in sort-package-json key order, checked by `quality lint`.

## 0.1.0 - 2026-09-26

### Added

- Declare queries and commands with typed rejections and reactivity keys; group
  them into a native `RpcGroup` with namespaced tags.
- Bind a contract to a native `AtomRpc` service: query atoms register declared
  read keys; command runs invalidate declared keys after success.
