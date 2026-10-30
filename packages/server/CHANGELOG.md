# Changelog

## 0.7.0 - 2026-10-30

### Added

- Identity exposes a socket-scoped session coordinator for hosts to share session rechecks within a batch and drive stream revalidation from one timer.

### Fixed

- Hosted live subscriptions on one socket share hint-time session lookups and periodic session revalidation while retaining per-query read-policy checks and typed revocation failures.

## 0.6.1 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.6.0 - 2026-10-30

### Added

- `@shivaedev/server`: Configure a direct or session-mode change listener with `config.listenDatabaseUrl` or `LISTEN_DATABASE_URL`, falling back to the application connection when unset.
- `@shivaedev/sql`: Supply `listenerClient` separately from the writing `client` to `postgresChanges`; set `connectionSetting` to identify that connection in diagnostics.
- `@shivaedev/sql/postgresLayer.ts` provides `postgresLayer(url, options)` with one native `PgPool` shared by `PgClient` and `SqlClient`. Reserved connections and client queries share `maxConnections`, and Layer shutdown waits for every socket to close.
- `appDatabase` and database-backed `appHost` expose the application's native `PgPool` service for packages that need reserved PostgreSQL connections.

### Fixed

- A denied per-hint session or query policy recheck ends the hosted live subscription with `QueryReadDenied` instead of silently dropping the hint. Custom consumers must handle this declared failure; automatic bound queries rerun their authorized read so the screen can show the denial.
- Retry worker-release heartbeat and poll failures on a bounded schedule, log their causes, and close the worker scope with the original cause when recovery fails. Heartbeats continue while jobs drain after a connection blip.
- Log change-listener loss and reconnect causes, and bound listener sub-scope cleanup without rewriting scope finalizers.
- Fail application database startup when its first PostgreSQL LISTEN or heartbeat fails, instead of waiting indefinitely.
- SQL decodes migration ledger, release ownership and change-coverage rows before using them. Malformed rows fail with `SchemaError` instead of being treated as current, pending or a different owner.
- SQL generates worker identities and change-listener heartbeat tokens through Effect's `Random` service.

### Breaking

- Listener startup deadlines now fail with `PostgresListenerError`, naming the connection setting, instead of `SqlError`. Consumers handling startup failures must also handle `PostgresListenerError` from `@shivaedev/sql/PostgresListenerError.ts`. Hosts using transaction-pooled application URLs must set `LISTEN_DATABASE_URL` or `config.listenDatabaseUrl` to a direct or session-mode connection to the same database. Native SQL startup failures still use `SqlError`.
- Server's PostgreSQL construction and address helpers move to sql. Consumers of `@shivaedev/server/adapters/postgresClient.ts` must compose `postgresLayer` from `@shivaedev/sql/postgresLayer.ts` and read the native `PgPool` or `PgClient` service instead. Address-only consumers import `databaseAddress` from `@shivaedev/sql/databaseAddress.ts` instead of `@shivaedev/server/databaseAddress.ts`.
- `postgresChanges` and `listenForChanges` now expose `SqlError` during acquisition. Consumers that required an infallible Layer or Effect must handle or propagate this error. `heartbeatTimeout` bounds the first LISTEN acquisition and its first heartbeat; retry startup at the application boundary if desired. Established listeners continue to reconnect.
- Schema component failures now reach SQL migration and readiness callers, server startup and test-sql migration helpers with their original error, tag and cause, and log the component name. Handle the component's own error instead of a wrapping `MigrationError` with kind `Failed`. When annotating migration options with fallible components, supply their error type as the second generic parameter; the default describes components that cannot fail.
- Declare `WorkerRelease` through `defineService`. Consumers using the old class as a type must use `Context.Service.Identifier<typeof WorkerRelease>`; yielding the service and providing its value stay the same.

## 0.5.0 - 2026-10-30

### Changed

- Require Effect 4.0.6 and align the Effect companion package peers and generated starter catalog to the same exact release. Install the 4.0.6 Effect stack together.
- The starter's Railway deployment supplies `TRUSTED_PROXY=100.64.0.0/10` and `AUTH_CLIENT_IP_HEADER=x-real-ip` through its shared proxy configuration. Generated deployment docs explain the automatic Railway settings and when a host refuses to boot.

### Fixed

- Register hosted RPC cache-control handling through Effect 4.0.6's request-scoped pre-response API so responses keep `private, no-store`.
- Accept native RPC's `application/x-ndjson` media type while preserving `application/ndjson` callers at the transport guard.
- Keep subscriptions open after their HTTP request body completes; closing the socket still cancels them.

### Breaking

- `@shivaedev/server` refuses to start a session host bound to a non-loopback address without proxy trust, with a typed `TrustedProxyRequired` error naming the missing setting. Set `TRUSTED_PROXY` to your proxy's peer IP addresses or CIDR ranges, set `config.trustedProxy`, or deploy with the starter's Railway configuration. Local loopback hosts keep working without it.

## 0.4.0 - 2026-10-29

### Added

- Forwarding proxy fixtures relay WebSocket upgrades, including the same origin and trusted proxy headers as HTTP requests. Existing proxy URLs also work for socket clients.

### Fixed

- Revoked bearer and cookie change subscriptions end with typed `Unauthorized` from session middleware, without racing a host-initiated socket close. Later protected calls on the shared socket reject the revoked session.

### Breaking

- Contract clients use Effect RPC over a shared WebSocket by default. Replace `httpClient`, `transformClient` and `serialization` client options with a native `protocol` Layer for custom transports. Node clients can supply upgrade `headers` and a `webSocketConstructor` Layer; browsers use their session cookie automatically.
- Mounting a bound query subscribes before its first authorized read; unmounting releases its subscription. Use `live: false` when binding an ordinary client without subscriptions. Query preparation alone no longer opens a change stream.
- Hosts serve live subscriptions on the WebSocket upgrade at the RPC path. Move HTTP `$changes` consumers to Effect RPC's socket protocol; the POST route serves ordinary RPC only. Configure development proxies to forward WebSocket upgrades.
- React session boundaries bind shared sockets to the identified session, so replacing an account upgrades with its current cookie. They also ask the auth owner to recheck when the live socket closes. Keep `recheck` safe to call after a network interruption; the auth owner still decides whether the session ends.

## 0.3.1 - 2026-10-29

### Fixed

- The application host constructs services, handlers and routes before listening, so startup connections are refused until requests can be answered.
- Server and HTTP modules import Node platform modules directly to avoid loading Redis during startup.
- Generated apps import Node platform modules directly, and deployment stories allow enough time for their sequential cold processes without a fixed timeout on each startup health probe.

## 0.3.0 - 2026-10-28

### Added

- Application HTTP routes registered through `appHost.routes` can use app services, with route construction errors and missing dependencies retained in the host's types. Generated apps register HTTP routes and static assets through this option.
- Application routes can answer foreign-origin preflights through native `HttpMiddleware.cors`. Host origin restrictions cover the configured RPC path and `/api/auth/*`, including `/api/auth`; other foreign origins still receive 403 there.
- Declare collection policies beside module contracts with `ModuleReadPolicies` and combine them with `mergeReadPolicies`. Unclaimed collections are denied. Each policy receives the request's optional viewer.
- The application host accepts a merged `readPolicy` and checks queries and live hints inside native session middleware, using its resolved identity without another session lookup. Policies can use application services and return `Forbidden` or `AuthUnavailable`.
- Query authorization and live-hint filtering check keys concurrently so native `Effect.request` resolvers can batch membership checks. Plain Effect policies remain supported.
- The application host provides Effect's native Crypto service during preflight and deferred construction as well as in application handlers, so commands can generate secure invite codes without ambient randomness.
- Story kits provide native TestCrypto with a fresh seed of 0 for each story, making generated invite codes reproducible. The application’s @effect/platform-node peer supplies its digest implementation.
- Ambient-randomness findings name Effect's Crypto service for secure values and Random for non-secure values.

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
- `authorizeReads` now takes `(effect, request, policy, viewer, denied)`, and policies take `(key, viewer)`. Pass `Option.some(resolvedIdentity)` or `Option.none()` before the denial effect. Existing unary policy functions may ignore the new viewer argument. Apps using `appHost` can replace custom read middleware with its `readPolicy` option and merge their modules' policy maps.

## 0.2.0 - 2026-10-27

### Added

- Session hosts bound to a non-loopback address without proxy trust warn at startup to configure `TRUSTED_PROXY` or `config.trustedProxy` before forwarding RPC requests.

### Fixed

- Development auth accepts both `localhost` and `127.0.0.1` over HTTP on any port when `PUBLIC_URL` is unset. Explicit `baseURL` and `trustedOrigins` options replace those defaults.
- Auth rate limiting uses the connection peer address without a trusted proxy, separating client buckets and avoiding Better Auth's missing-client-IP warning. Trusted forwarding still takes precedence, and untrusted forwarding headers are ignored.
- Supply the host's body-size limit to application routes, so bounded body readers enforce the same limit as RPC.

## 0.1.0 - 2026-10-27

### Added

- First release of `@shivaedev/server`, the application host extracted from `@shivaedev/platform`: `appHost`, the database layer and migrations, health, OTLP export, the redacting tracer and RPC serialization, development mode, the Promise runtime (`runtime/`) and Node subscription signals (`node-http/`). Modules sit at the package root, so `@shivaedev/platform/server/appHost.ts` becomes `@shivaedev/server/appHost.ts`. The `AppChanges` and `RedactionPolicy` service ids now name the package.
