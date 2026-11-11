# Changelog

## 0.44.0 - 2026-11-11

### Added

- `defineModule({ name, operations, requires, middleware?, subject?, keyScope? })` from `@shivaedev/contract/defineModule.ts` defines a module from operations written as `payload` and `*run`. It returns the module's contract, which client and host code accept like any contract; the compiler checks `requires`, which carries no run-time value. Its generics check the definition on the `name` line, naming the operation in the first line of the compiler's message: `OperationNeedsUndeclaredServices` when a `run` or read policy uses a service that `requires`, the middleware and the subject do not provide, `OperationFailsOutsideItsRejections` when an operation can fail outside its rejections other than with an infrastructure failure, and `OperationNameRepeated`.
- `moduleHandlers(module)` from `@shivaedev/contract/moduleHandlers.ts` builds the module's handler Layer from its operations, requiring exactly the module's `requires`. Each operation runs in a span named `<Module>.<operation>`; a query's read policy is checked inside its handler before `run`, so a policy may read a repository directly, and live subscriptions check the same policy. An undeclared failure that states `isRetryable` answers `ServiceUnavailable`, and anything else undeclared answers `InternalServerError` and is reported.
- Operations written with `run` report three more mismatches: `RunReturnsAny` when `run` returns `any`, which previously switched the success and rejection checks off; `SuccessClassNotReturned` when the success is a `Schema.Class` and `run` returns something other than that class; and `RejectionClassDiffers` when a listed rejection class and the class `run` raises under the same tag differ in shape. TypeScript compares classes by shape, so a same-shape twin of a class still compiles.
- Every RPC of a module built with `defineModule` carries the `DefinedModule` annotation with the module's name; a contract built with `contract` carries none.
- A live query subscription registers each key its handler records with the host the moment it is recorded, before the recording call's statement is sent, and matches recorded keys together with the keys from `reads`, `serverReads` and `readsCollections`.
- `queryRuntime(query)` from `@shivaedev/contract/retainQuery.ts` returns the atom runtime a bound query runs on.
- `defineModule` takes an optional `wire`: per operation a success schema and rejection classes, for a generator to write from `run`'s types (until it ships, written by hand). An operation with a wire entry is served with that entry's success and rejections, plus `InternalServerError` and `ServiceUnavailable`, even when it declares its own, so the server encodes with the schemas the browser decodes with; an operation without an entry is served with what it declares. The compiler compares the wire with `run` and reports a stale one on the module's `name` line, one problem per operation: `WireSuccessStale`, `WireRejectionsStale`, and `OperationMissingFromWire` for an operation that declares no success, returns something and has no entry.
- `clientContract({ name, wire, payloads?, queries?, commands?, middleware?, subject?, keyScope? })` from `@shivaedev/contract/clientContract.ts` builds the browser's contract of a module from its wire, payloads, `reads` and `invalidates`, with no `run` or read policy, for generated files; every query and command it declares needs a wire entry. `ClientMatchesModule<Client, Module>` from `@shivaedev/contract/clientMatchesModule.ts` asserts that its RPCs equal the server module's and otherwise fails with `ClientDiffersFromModule`, naming the operations and `pnpm generate`.
- The check that a declared success equals what `run` returns also covers a `Schema.Class` held in an array, struct field, tuple, record, union or `Option`: a plain object in that position is `SuccessClassNotReturned`.
- `query(name, { … })` and `command(name, { … })` accept an operation written as its `payload` and a generator `*run`. `run` becomes an Effect-returning function, so one operation can `yield* Create.run(payload)` and inherit its services and failures. A query without `readPolicy` gets `signedIn` and still declares `reads` (with optional `serverReads` and `readsCollections`); a command without `invalidates` announces no keys of its own. Existing declaration forms are unchanged.
- `success` and `rejections` are optional on that form. A declared one must equal what `run` infers, and each mismatch is a compile error naming the operation and the problem: `SuccessDiffersFromRun`, `ArrayMutabilityDiffers` (return a readonly array, or declare `Schema.mutable`), `RunFailsOutsideRejections` (also for a read policy's failures), `RejectionsRunNeverRaises` and `RejectionAutomatic`. Failures that state `isRetryable`, `SchemaError` and `QueryReadDenied` are never rejections.
- Every operation written with `run` carries `InternalServerError` and `ServiceUnavailable` in its type and rejection set and cannot list them. No `Conflict` is added; map a constraint violation in `run` to a domain failure instead.
- A field failure for that form is an exported class, `Schema.TaggedError<TitleTaken>()("TitleTaken", fieldRejection(NoteFields))`, raised in `run` with `yield* new TitleTaken({ field, message })`; `@shivaedev/form`'s `rejecting` places its message on that field.
- When a live query that declares no keys finishes a run without recording one, the host logs a warning naming the query and saying to mark its raw reads or declare `reads`. The subscription continues; `reads: () => []` states that a query reads nothing and logs no warning.
- A query may leave out `reads`. A query that declares no keys in `reads`, `serverReads` or `readsCollections` listens on what its repository reads pin, so an unfiltered read listens on the whole table; declared keys are used exactly as declared, so existing queries listen as before.
- A live subscription registers a recorded key only when it is not registered yet, so a handler that reads the same row many times registers its key once.
- Nothing a module query's read policy records counts, whether through repository reads or `recordRead`, so a write to a row only the policy reads does not rerun the query.
- `liveAnswers(registry, name, query)` from `liveAnswers.ts` counts a bound query's settled answers, pushed or unchanged, for the screen driver's `withLiveAnswer`.
- `isLiveConnection(atom)` from `live.ts` tells whether an atom is the `connection` of a `live` subscription, which stays waiting for as long as the subscription runs.
- The check that a declared success, or a module's wire, equals what `run` returns also compares keys: the keys at each `Schema.Struct` position, including an optional or mutable field and a union member, must equal the keys `run` returns there. An optional property that only one side has is `SuccessDiffersFromRun`, or `WireSuccessStale` for a module's wire, instead of a key the `Struct` drops or never sends.

### Fixed

- A live query reports `waiting: true` from mount until its subscription delivers the first result. It used to report a non-waiting initial result while the subscription opened, so `useQuery`'s `pending` and screen pending signals read a loading query as idle.

### Breaking

- `KeyScope` is no longer exported from `@shivaedev/contract/serverMetadata.ts`, and a `keyScope: "session"` contract no longer annotates its RPCs with it. Nothing read the annotation, so there is no replacement: server keys were and stay unprefixed. Remove any import of `KeyScope`. In the browser, `keyScope: "session"` still prefixes every client read and invalidation key with an opaque id of the binding's registry.
- `QueryShape["readPolicy"]` is optional, as it already was at run time, because the browser's contract of a module has no read policy; `contract()` still requires one on every query. Code that calls the policy of an erased `QueryShape` checks for `undefined` first.
- `contract()` requires a read policy on every query in its type, so an array typed `readonly QueryShape[]` passed as `queries` no longer compiles. Type the array with the queries' own type instead, for example `const queries: readonly (typeof Get)[] = [Get, Get];`, or pass the queries inline.
- `SuccessDiffersFromRun`, `SuccessClassNotReturned` and `ArrayMutabilityDiffers` moved from `@shivaedev/contract/runProof.ts` to `@shivaedev/contract/successProof.ts`; import them from the new path.
- `activityScreenSignal` no longer reports `hints`; wait for a live change with `liveAnswers` and the screen driver's `withLiveAnswer`.

## 0.43.5 - 2026-11-10

### Fixed

- `api[LiveConnection].status.needsResync` is now true from a resume until the reopened subscription delivers its first update; `connection` stays unchanged and query results keep reporting nothing pending.

## 0.43.4 - 2026-11-08

### Changed

- Update `@shivaedev/service` from 0.8.2 to 0.9.0.

## 0.43.3 - 2026-11-07

### Changed

- Invalid contract declarations now fail as Effect defects when the server validates them during host startup.

## 0.43.2 - 2026-11-07

### Changed

- Update `@shivaedev/service` from 0.8.1 to 0.8.2.

## 0.43.1 - 2026-11-07

### Changed

- Require Effect 4.1.1 and its matching platform packages.

## 0.43.0 - 2026-11-06

### Changed

- Keep current query values during transient subscription recovery. Explicit refresh retains the value and reports pending until the fresh pushed result arrives; declared query failures and read denials remain visible.
- Coalesce each subscription's pending changes into one rerun, including server-side reconciliation after backlog overflow or PostgreSQL listener recovery. Different subscriptions run independently and in parallel. Changed encoded results are pushed; equal reads acknowledge completion with `Unchanged`.

### Breaking

- Live queries always receive server-pushed results. Remove `live: "rerun-and-compare"` from query declarations; query handlers, result shapes and screens need no changes. Deploy matching client and server versions. Custom subscription hosts must supply an authorized query runner to `subscribe`. Raw consumers handle `Result`, `Unchanged` and `QueryReadDenied` instead of change hints. Remove obsolete query and live connection coalescing settings; coalescing now happens on the server.

## 0.42.0 - 2026-11-06

### Added

- Keep successful bound query results for five minutes after their last reader leaves, bounded to 100 idle queries per registry. Reopened queries show stale data immediately while revalidating. Configure `timeToLive` and `capacity` through the registry's `queryRetention` atom or React's `SessionBoundary.queryRetention` prop.

### Breaking

- Replace bound queries' per-query `timeToLive` option with the registry's `queryRetention` policy. Move that setting to `SessionBoundary.queryRetention` or set the native `queryRetention` atom in the owning registry. Query execution now ends with the last reader; retained data revalidates on reopening.

## 0.41.0 - 2026-11-06

### Added

- Activity reports commands in flight and mounted queries awaiting their first result. `isClientSettled` checks these counts using the contract's command metadata.

### Changed

- Live query subscriptions deliver their first authorized result after registering read keys, removing the separate initial query request for bound queries and route loaders. Later updates retain hint-then-read or the query's chosen rerun-and-compare behavior.

### Breaking

- Every contract's `$changes` success type includes typed `Result` values. Custom stream consumers must handle results as well as hints; custom subscription hosts pass their authorized query runner to `subscribe(subscription, read)` to deliver the initial value.
- Direct `automaticLive().query` callers now supply a result decoder, comparison flag and reactive source factory. Direct `queryDelivery` callers supply the decoder and comparison flag, and `automaticQuery` callers pass the delivery's `version` as `resultVersion` and `updates` as `subscriptionVersion`. Use `bind` or `makeClient` to obtain this wiring automatically.
- Screen signals from `activityScreenSignal(activity)` now settle on commands and first query results, allowing live queries to remain open or await later refreshes. Code constructing `ClientActivityState` values must supply `commands` and `initialQueries`. To retain full finite-work settling, pass `isClientIdle` as the second argument. Start `nextLiveHint()` before an outside write when a story needs its next live change, then settle through that refresh with the full idle signal.

## 0.40.0 - 2026-11-05

### Added

- `LiveServer.register(keys)` returns a scoped registration stream whose read keys can be replaced while it is consumed.

### Breaking

- Import `LiveServer` from `@shivaedev/contract/live-server/service.ts`. Replace `live.subscribe(subscription, read?)` with `subscribe(subscription, read?)` from `@shivaedev/contract/live-server/subscribe.ts`; replace `LiveServer.layer` with `liveServerLayer` from `@shivaedev/contract/live-server/layer.ts` and provide that one Layer. Unwrap the subscription Effect with `Stream.unwrap`. Reactivity remains bound by the Layer, and policy and query-runner requirements remain on the Stream. The `makeLiveServer` convenience API keeps its existing shape.

## 0.39.0 - 2026-11-05

### Breaking

- Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together. Live query rerun-and-compare now requires Effect's `Digest` service from `effect/crypto` instead of `Crypto`; `@shivaedev/server` and `clientCrypto` from `@shivaedev/react` provide it.

## 0.38.0 - 2026-11-05

### Added

- Return a command's success through `commandResult({ result, invalidates })` to contribute server-only refresh keys from database lookups. The command guard combines them with declared keys through the existing after-commit publication path, discards them on handler failure, and sends only the declared result to the client.

### Breaking

- Remove `internal/` from module imports. Use `clientActivities.ts` for the former `internal/clientActivity.ts` and `queryProgress.ts` for the former `internal/querySignals.ts`; existing `clientActivity.ts` and `querySignals.ts` imports keep their meaning.

## 0.37.0 - 2026-11-05

### Added

- Hold unsent bound commands for up to ten seconds while the client reconnects, including with supplied native socket protocols. Report `waiting-for-connection` immediately through client activity and React's connection status hook; a connection timeout remains a typed `RpcClientError`.
- Probe an open default socket with RPC Ping/Pong on visible visibility, online and pageshow events or native resume. Reconnect after 2.5 seconds without a Pong, holding commands during the probe without replaying requests already sent.
- Add `SocketClock`, a native Clock reference for controlling the default client’s network deadlines independently of application timers. Network time remains real by default.
- `settledQueries` testing readout observes completed query results within an Effect scope, including failed and equal-value refreshes.

### Breaking

- `ConnectionStatus` includes `waiting-for-connection`. Handle this case alongside `reconnecting` in exhaustive status rendering. Custom `ResumeWindow` implementations must also accept `pageshow` events.
- Import `settledQueries` and `SettledQueries` from `@shivaedev/test-kits/contract/settledQueries.ts` instead of `@shivaedev/contract/testing.ts`.

## 0.36.1 - 2026-11-04

### Changed

- Require Effect 4.0.7 and its matching companion packages. Install the 4.0.7 Effect stack together.

## 0.36.0 - 2026-11-04

### Added

- Declare the host build-version stream shared by server and browser clients.

### Fixed

- emit portable declarations for exported contracts with declared subjects.

### Breaking

- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.35.0 - 2026-11-04

### Added

- Client activity and its screen signal carry the same shared connection status.

### Fixed

- Resume signals interrupt live retry backoff and reconnect immediately, resetting the next retry delay.
- Bound commands with a declared `BadRequest` return payload construction and encoding failures as that typed rejection, including struct-level validation details.
- Live binding discovery traverses nested object and array properties, preserves explicit binding lists, and visits shared objects and cycles once.

## 0.34.0 - 2026-11-04

### Added

- `makeClient` accepts a native Atom runtime factory so application and test clocks can govern live query coalescing and reconnection.
- Contracts accept a subject declaration that supplies request context through native RPC middleware and includes its typed refusals in the client's error channel.

### Breaking

- Import the `OperationRpc` and `Tag` helper types from `@shivaedev/contract/operationRpc.ts` instead of `@shivaedev/contract/contract.ts`.

## 0.33.1 - 2026-11-03

### Fixed

- Consume queued live hints when a held query finishes and starts its pending refresh, preventing a later coalescing timer from issuing a duplicate read.

## 0.33.0 - 2026-11-03

### Breaking

- Move `watchHints`, `heard`, `layerMemoryProtocol` and `HintViewer` from `@shivaedev/contract/testing.ts` to `@shivaedev/test-kits/contract/testing.ts`. Add test-kits as a development dependency.

## 0.32.0 - 2026-11-03

### Added

- `makeClient` accepts `resume` and `resumeWindow` so applications can supply native lifecycle signals and an embedded browser window directly, preserving the client's inferred API, failures and requirements.
- `composeBindings(client, bindings)` preserves the client's type and declares the bound APIs in one connection. `liveBindings(connection)` reads that composition while retaining support for direct bindings and object properties.
- Observe bound queries with `querySignals(query)`: a native atom reports completed reads, pending requests, and whether their subscription opened or was refused. Refreshes signal completion even when their result is unchanged.
- Supply `CommandGuard`, `CommandBoundary`, `guardCommands` and `commandGuardLayer` to evaluate declared command changes for the current viewer independently of authentication and tracing.
- Export `activityScreenSignal(activity)` from `clientActivity.ts`, projecting client activity into a native stream and current Effect of pending screen work and hint counts.
- Contract owns `ReadPolicyGuard`, `readPolicyGuardLayer()` and `guardReads(group)` in `@shivaedev/contract/ReadPolicyGuard.ts`. The guard checks each ordinary query's read policy once against the request's `CurrentViewer`.
- Derive custom subscription handlers with `changesHandlerLayer`, retaining query payloads, declared failures, read-policy services and stream requirements in a native Layer.

### Fixed

- Schedule contract live hints through the Effect runtime's Scheduler, preserving batched changes, resyncs and stream cleanup. Isolate synchronous client identity and activity bridges in adapters and share atom wrapping across bindings.
- Refresh server-discovered read scopes on each live subscription rerun and replace their registrations, including when a pushed result is unchanged.
- `LiveServer.subscribe` preserves `SubscriptionHint` deliveries when no query runner is supplied, including an explicit `undefined`. Calls with a query runner keep `QueryUpdate` deliveries and retain the subscription's typed failures and service requirements.
- Contract groups enforce query read policies automatically in native Effect RPC hosts as well as the application host. A false policy returns `QueryReadDenied` without running the handler. Ordinary queries evaluate their policy once per request.

### Breaking

- Rerun-and-compare subscriptions emit an `Unchanged` update with the query index when a completed read preserves its previous value. Consumers of raw `$changes` streams must handle this update; bound queries handle it automatically. Deploy clients and servers together so both understand the updated stream schema.
- Calls to `LiveServer.subscribe` that explicitly supply its error and service type arguments and a query runner must also supply the runner type as the third type argument, or omit the type arguments and let TypeScript infer them.
- Remove `guardReads` from `@shivaedev/contract/ReadPolicyGuard.ts`. Serve the contract group directly with `RpcServer`; remove any explicit read-policy Layer unless you use `readPolicyGuardLayer()` to refuse HTTP `$changes` calls with `WebSocketRequired`. `ReadPolicyGuard` is now a defaulted Context reference rather than a service class and requires no provision. Remove its former service type from Layer annotations.
- Custom authentication middleware must supply `CurrentViewer` after session validation and stop calling `authorizeReads`; the contract's attached guard performs that check. Keep `authorizeReads` only for direct handler reruns outside RPC dispatch.
- Ordinary query failures now include `MissingReadPolicy` and `WebSocketRequired` from the attached middleware. `MissingReadPolicy` refuses untyped declarations that omit a policy; `WebSocketRequired` belongs to the optional HTTP subscription restriction. Add these refusals to exhaustive error handlers.
- `makeLiveServer.stream` and `LiveServer.stream` accept keys only. Their `subscribe` methods now take `(subscription, authorizedRunner?)`; remove the former context argument. `QuerySubscription.globalKeys` is removed because all server keys share the repository namespace; remove it from custom subscription objects.

## 0.31.0 - 2026-11-02

### Added

- Query subscriptions accept an optional `refresh` Effect supplying the context for each policy check and query rerun.

### Breaking

- Contract change streams emit `QueryReadDenied` as a delivery when an established subscription loses read access, keeping the subscription open so a later hint can resume delivery after access returns. Custom consumers must handle this delivery alongside `Changed`, `Resync` and `Result`; use `SubscriptionHint` for hint consumers. Initial subscription refusals remain typed stream failures. Bound query atoms display the denial and recover on a later authorized hint.
- Query atom failure types include client-middleware errors and the contract's change-subscription errors. Consumers with exhaustive error handlers must handle the additional subscription failures, including `MissingReadPolicy`, `WebSocketRequired`, and rejections declared by other queries in the contract. Explicit `BoundQuery` annotations can pass the subscription RPC as the third type parameter or be replaced with inference from the bound API. Direct `run` failure types stay specific to their RPC.

## 0.30.2 - 2026-11-02

### Fixed

- Keep per-query headers on automatic live subscriptions and rerun-and-compare reads.
- Reopen a denied hinted query's subscription on explicit refresh so it can return data after access is granted.
- Reject authored queries, commands and streams named `$changes` with a declaration error instead of silently replacing them with the built-in changes stream.
- Run session-owned streams through their owning registry's client, preserving its transport and headers and ending the streams when the session closes. Streams without a session owner continue to use the caller's client.

## 0.30.1 - 2026-11-01

### Fixed

- Reject untyped `readsCollections` declarations with ordinary member policies when building a contract, with a message requiring `permissionReadPolicy`.

## 0.30.0 - 2026-10-31

### Added

- Queries can declare `readsCollections` with `permissionReadPolicy` to refresh admin lists after any committed repository write, using the existing collection key and NOTIFY payloads, including in session-scoped contracts. Ordinary member policies are refused by TypeScript at declaration time and by the server before reading or subscribing.

## 0.29.0 - 2026-10-31

### Added

- `rpcBoundaryHandlers(group, boundary, handlers)` applies one boundary and unexpected mapping to a native RPC handler map, including Effect and Stream handlers and native RPC wrappers.
- Contract changes streams declare `WebSocketRequired` so HTTP clients can decode the protocol error.
- React query hooks, including `useLoaderQuery` and loader-backed editor queries, expose `denied` for a `QueryReadDenied` refusal so screens can replace retained data.
- Queries can declare a `serverReads(payload, viewer)` Effect to load additional read keys on the server after every subscription policy allows access. Its services come from the owning query handler; failures use the query's declared rejections. Bound clients refresh from the resulting hints without receiving record IDs in their payloads.

### Changed

- A `$changes` batch remains all-or-nothing: one denied query rejects or ends live updates for the whole batch. Split queries with independent permissions into separate `$changes` requests; automatic bound queries already subscribe separately.

### Fixed

- Hosted `$changes` subscriptions over HTTP fail with a message saying they need the WebSocket protocol.
- Live queries refused with `QueryReadDenied` remain refused through matching invalidations and resume events until their input or viewer changes. They stop automatic subscription attempts and refused reads.
- `queryRoute` sends read denials to the route's not-found component, just like missing records.

### Breaking

- `queryKeys` moves from `serverMetadata.ts` to `queryKeys.ts` and now checks every referenced query's read policy before resolving payload and server-derived keys, and preserves their errors and service requirements. Change imports to `@shivaedev/contract/queryKeys.ts`. Custom adapters must provide those services, pass the server-resolved viewer, and handle declared rejections, `MissingReadPolicy` and `QueryReadDenied`; use `querySubscription` to capture handler services and ongoing authorization.

## 0.28.0 - 2026-10-31

### Added

- `layerMemoryProtocol(group)` in `testing.ts` connects `makeClient` to native RPC handlers and middleware in process, including live hints and query refreshes, without a socket or a separate `AtomRpc.Service` per contract.
- Native clients can pass `bearerToken` to `makeClient` to authenticate the shared RPC WebSocket in its first frame, without upgrade headers or credentials in URLs. The server applies its existing session and read policies, closes invalid or expired authentication with code 1008, and closes authenticated bearer sockets when their session is revoked. Native resume reconciles live query values.
- Contract exports the `signedIn` read policy and `validateReadPolicies(group)` for native hosts to validate their RPC group during Layer construction.
- Contract exposes `LiveServer` through `defineService`, with a native `.layer` requiring Reactivity. Its `stream` and `subscribe` methods return Effects containing native Streams, retaining subscription failures and caller requirements.

### Fixed

- Live subscriptions use policy services provided inside the owning query's handlers layer, just as RPC reads do. Request-local session context takes precedence when the policy checks access to live hints.
- Admin's built-in Users and Jobs queries and Work Board's daemon diagnostics queries explicitly declare read policies; existing permission and loopback boundaries continue to own access.

### Breaking

- Every contract query requires a `readPolicy`, including plain RPC reads. Add `readPolicy: signedIn` for any signed-in viewer, an explicit `() => Effect.succeed(true)` for public reads, or an application policy for restricted reads. Plain calls without a policy now fail closed with `MissingReadPolicy` even on native servers that bypass startup validation.
- The application server Layer fails with typed `MissingReadPolicies` before listening when untyped queries omit policies. Handle this boot error if your application narrows startup failures; its `queries` field lists every affected RPC. Query atom error types now follow their native RPC errors without an extra client-side `MissingReadPolicy` branch. Custom `ChangesQueries` annotations must now include their query definitions in `queries` alongside `resolve`.
- Server's `AppChanges` is replaced by `LiveServer` from `@shivaedev/contract/LiveServer.ts`. Replace `AppChanges` imports and requirements with `LiveServer` (use `Context.Service.Identifier<typeof LiveServer>` for its identifier type). PostgreSQL `appHost` and `appDatabase` provide it automatically; HTTP-only apps provide `LiveServer.layer` with Reactivity instead of `Layer.effect(AppChanges, makeLiveServer)`. Call `resync()` instead of reading `resync`, and use `Stream.unwrap` around the Effects returned by `stream` and `subscribe`.
- Server composition helpers (`appHostHttp`, `migratedHost`, `deferredHost`, `hostRpcRoutes` and `hostChanges`) resolve the contract service directly. Remove their live-service tag argument; calls to the former `databaseLayer(options, tag)` become `appDatabase(options)`.
- Work Board's `publishChanges` and Work Fleet's `daemonSnapshots` now require contract's `LiveServer` instead of server's `AppChanges`. Custom compositions must provide `LiveServer.layer` with Reactivity; their standard hosts already do so.
- Import server's `appDatabase` and `DatabaseConfig` directly from `@shivaedev/server/appDatabase.ts`; `appHost.ts` no longer forwards `appDatabase`, and `databaseLayer.ts` is removed.

## 0.27.0 - 2026-10-31

### Added

- Contract clients expose `clientActivity(client)`, a native Effect `Stream` with a `current` Effect reporting finite RPC calls, queued live invalidations, refreshing query atoms and received live hints.
- Screen drivers accept that activity as `pending`, wait for idle activity with their renderer before screen assertions, and expose `nextLiveHint()` for the next client delivery. Stories keep live coalescing enabled.

### Fixed

- Live hint and query coalescing delays use the atom runtime's Clock, so TestClock can drive their windows without waiting in real time. Resyncs and registry disposal cancel pending delays.
- Live server resync identities use Effect's Random service, allowing a seeded runtime to reproduce them.
- Shared RPC WebSockets measure opening, heartbeat and reconnect delays on live time, so advancing an application's TestClock does not time out a real connection. Application timers keep their own clock.

## 0.26.0 - 2026-10-31

### Added

- Browser readouts expose each subscription opening's state and an Effect that waits for all openings to receive a first response or a tagged refusal, without polling.
- Contract clients accept a session identity protocol factory so custom transports can follow sign-in and sign-out.

### Fixed

- End hosted live subscriptions with `Unauthorized` when the original session is signed out, revoked or expired, whether detected during a change hint or periodic revalidation. Keep `QueryReadDenied` for a signed-in viewer whose query policy refuses the read.
- Batch shared socket session lookups with an Effect scheduler yield so advancing `TestClock` past `streamRevalidationInterval` completes revalidation without another clock advance.
- Preserve typed session-provider failures during hint-time authorization instead of reporting them as read-policy refusals.

### Breaking

- `browserReads().protocol` is now a session identity protocol factory. Continue passing it directly to `makeClient`; native Layer consumers must call `observed.protocol(undefined)` for an anonymous client, or pass the session identity. The same readout counts traffic across session sockets.

## 0.25.0 - 2026-10-30

### Added

- Accept `retryKeys` in `live()` to identify changes that reopen a settled subscription independently of its resync scope. It defaults to `resyncKeys`.

### Fixed

- Keep denied live queries and subscriptions settled until the viewer identity changes or a matching change invalidation arrives. Resume events do not retry a settled rejection.
- Retry transport failures and server outages with jittered exponential backoff. `retryDelay` sets the initial delay; backoff grows to a nominal 30 seconds.

### Breaking

- Live subscriptions settle expected failures with `LiveStatus.connection: "failed"`. Add a `"failed"` case to exhaustive connection handlers and show `status.failure`; applications no longer receive repeated attempts for denied reads or declared query errors.

## 0.24.1 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.24.0 - 2026-10-30

### Added

- Queries can opt into `live: "rerun-and-compare"`. Hosted subscriptions rerun the authorized query as the subscribed viewer, hash its JSON-schema-encoded result with SHA-256, and push a typed `Result` only when it changes. Bound queries consume those results without a client refetch. Other queries keep hint-and-refetch delivery.
- Rerun subscriptions end with `QueryReadDenied` when access is denied. The host registers change listeners before its initial result read, and reconciliation reruns the query through the same read policy.

### Breaking

- `@shivaedev/contract`'s `ChangesClient` transport helper now covers result messages and erases query-specific stream failures. Consumers using that helper to read changes must use their contract's native AtomRpc client type instead; derive message and failure types with `Rpc.SuccessChunk` and `Rpc.ErrorExit` of the contract's `$changes` RPC. Contract-derived bound query types remain specific to their query.

## 0.23.0 - 2026-10-30

### Fixed

- Live reads and change subscriptions preserve policy failures instead of reporting read denial. Generated starter apps report notes database connection failures as `ServiceUnavailable` during the owner's live read.

### Breaking

- Query read policies declare their error and service channels with `QueryReadPolicy<Payload, E, R>`. Declare policy errors in the query's `rejections` and provide policy services when building its handler Layer. Custom subscription adapters call `querySubscription(rpc, references, viewer)` instead of resolving requests themselves. Use the native RPC type when calling `authorizeReads` or `resolveChanges` so their inferred channels include policy requirements and errors. The generated change stream includes the queries' declared rejections and service requirements; consumers handling that stream must handle those errors too.
- Admin pages install their permission's read policy for every query, preserving additional query restrictions. Remove repeated page-grant policies from individual queries and supply the page's permission middleware with the handler Layers.

## 0.22.0 - 2026-10-30

### Added

- Export modules under `internal/` in `contract` and `react` and `server/internal/` in `jobs` through the existing `.ts` wildcard, so consumers can import those modules directly by their file paths.

### Fixed

- Bound each `makeLiveServer` stream to 256 pending hints. On overflow, pending hints collapse into a single `Resync`, so stalled consumers reconcile current query results without accumulating a write backlog.
- A denied per-hint query policy recheck ends the live subscription with `QueryReadDenied` instead of dropping the hint. Automatic bound queries rerun through their authorized read so an open screen can render the denial from its query result.
- Jitter live subscription retries and the shared WebSocket reconnect backoff so clients recovering from the same host restart spread their query reruns over time.

### Breaking

- `makeLiveServer.subscribe` now has `QueryReadDenied` in its stream error channel. Custom RPC streams using it must include `QueryReadDenied` in their error schema and handle the failure. Contract-generated change streams already declare this error.

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
