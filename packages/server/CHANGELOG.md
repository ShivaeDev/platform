# Changelog

## 0.16.0 - 2026-11-01

### Added

- Export Effect logs as trace events and ErrorReporter reports as error spans through the redacting Railway OTLP pipeline in appHost and worker Layers.
- Mount a same-origin browser error reporting route in appHost, with server redaction, bounded reports and per-client rate limiting.
- Generated starters enable Railway manual tracing for web and worker services and mount browser reporting by default.
- Add useBrowserErrors to forward uncaught browser errors and unhandled rejections to the host, removing listeners on unmount.

### Fixed

- Mask complete RPC payload annotations before exporting logs and error reports, keeping sensitive error values out of Railway diagnostics even when the request uses public field names.

## 0.15.0 - 2026-10-31

### Added

- Accept `config.clock` on `appDatabase` and `appHost` for stories that explicitly exercise database lifecycle timers with their test clock. Application handlers and jobs keep their application clock.

### Fixed

- Run application database pool maintenance and change-listener heartbeats, deadlines and renewal on the live clock so a running host can advance its story clock by days while retaining database access, worker writes and change hints.

### Breaking

- Database lifecycle timers use the live clock instead of the caller's clock by default. Stories that advance time to exercise pool expiry, listener renewal or heartbeat deadlines must pass their native `yield* Clock.Clock` as `config.clock` to `appDatabase` or `appHost`.

## 0.14.0 - 2026-10-31

### Added

- Configure per-path static cache policy and HTML frame headers through `appHost` assets options.

### Fixed

- Derive encoded sensitive names separately for each RPC schema, keeping private fields in one method from changing public state and native failure decoding in another method.
- Keep the child key names of a fully masked field public elsewhere, including through native `OptionFromNullOr` encoding.

### Breaking

- Default fingerprinted assets to immutable caching, HTML documents and SPA fallbacks to `no-store`, and unversioned files to `no-cache`. HTML defaults to `frame-ancestors 'none'` and `X-Frame-Options: DENY`, including HEAD, partial and conditional responses. Consumers that need their previous caching or embedding behavior must set `assets.cacheControl` to their cache policy and `assets.documentHeaders` to configure or disable framing restrictions. Manually mounted native static layers retain their behavior.
- Refuse RPC registration when a schema-sensitive field name also names a public field within that method's schemas, including nested fields, encoded names and middleware errors. Diagnostics cannot distinguish those plain values. Rename one field or mark both sensitive; fields in separate RPC methods may keep different sensitivity.
- `schemaSensitiveKeys` now returns an Effect. Native consumers must use `yield* schemaSensitiveKeys(group, extraKeys)` to obtain the predicate and handle `SensitiveFieldConflict` from `@shivaedev/errors/schemaFieldScope.ts`. `appHost` and Work Board's `boardLayer` include that failure in their Layer error channels.

## 0.13.0 - 2026-10-31

### Added

- Expose native PostgreSQL `connectionTTL`, `idleTimeout` and `minConnections` through the SQL layer and application host, and `idleTimeoutMillis` and `maxLifetimeSeconds` through the jobs layer.

### Fixed

- Application and jobs pools recycle connections after ten minutes and close idle connections after one minute by default, returning backend memory after heavy queries. Application change listeners renew their reserved connection and resynchronize subscribers across renewal.

## 0.12.0 - 2026-10-31

### Added

- `rpcBoundaryHandlers(group, boundary, handlers)` applies one boundary and unexpected mapping to a native RPC handler map, including Effect and Stream handlers and native RPC wrappers.
- Contract changes streams declare `WebSocketRequired` so HTTP clients can decode the protocol error.

### Fixed

- Hosted `$changes` subscriptions over HTTP fail with a message saying they need the WebSocket protocol.

## 0.11.0 - 2026-10-31

### Added

- Native clients can pass `bearerToken` to `makeClient` to authenticate the shared RPC WebSocket in its first frame, without upgrade headers or credentials in URLs. The server applies its existing session and read policies, closes invalid or expired authentication with code 1008, and closes authenticated bearer sockets when their session is revoked. Native resume reconciles live query values.
- Contract exports the `signedIn` read policy and `validateReadPolicies(group)` for native hosts to validate their RPC group during Layer construction.
- Contract exposes `LiveServer` through `defineService`, with a native `.layer` requiring Reactivity. Its `stream` and `subscribe` methods return Effects containing native Streams, retaining subscription failures and caller requirements.
- `@shivaedev/errors/taxonomy.ts` exports class guards (`isConflict`, `isNotFound` and one `is<Class>` guard for every other taxonomy error). They narrow actual class instances and reject objects with matching tags.

### Changed

- Server and the platform dependency shell no longer declare `pg` as an optional peer; its PostgreSQL integration uses the native pool from sql.

### Fixed

- Admin's built-in Users and Jobs queries and Work Board's daemon diagnostics queries explicitly declare read policies; existing permission and loopback boundaries continue to own access.
- Logs, error reports, RPC failure data and exported spans share errors' database-key and URL policy. Database users and connection strings are masked under their diagnostic keys; URL user information, query values and fragments are masked in structured values and text.

### Breaking

- Replace `authDatabase(url, { max, application_name })` from identity's `server/better-auth/mount.ts` with `yield* betterAuthDatabase()` from `server/better-auth/adapters/database.ts`, inside the application's SQL environment. Pass the result as Better Auth's `database`. Use sql's `postgresLayer` for standalone processes; database-backed `appHost` exposes the client inside its `application` Effect. Move connection settings to `maxConnections` and `applicationName` on that SQL Layer. Auth now shares its connection budget and lifecycle; remove direct `pg` dependencies when no longer used.
- Replace `authTestDatabase(pool)` with `yield* authTestDatabase` in identity test fixtures, provided with the application's `SqlClient`.
- When applying the generated starter update, replace `poolSizes.auth` with the shared `poolSizes.sql` budget. Auth migrations use the application SQL environment; remove custom `AuthMigrationDatabase` providers.
- Every contract query requires a `readPolicy`, including plain RPC reads. Add `readPolicy: signedIn` for any signed-in viewer, an explicit `() => Effect.succeed(true)` for public reads, or an application policy for restricted reads. Plain calls without a policy now fail closed with `MissingReadPolicy` even on native servers that bypass startup validation.
- The application server Layer fails with typed `MissingReadPolicies` before listening when untyped queries omit policies. Handle this boot error if your application narrows startup failures; its `queries` field lists every affected RPC. Query atom error types now follow their native RPC errors without an extra client-side `MissingReadPolicy` branch. Custom `ChangesQueries` annotations must now include their query definitions in `queries` alongside `resolve`.
- Server's `AppChanges` is replaced by `LiveServer` from `@shivaedev/contract/LiveServer.ts`. Replace `AppChanges` imports and requirements with `LiveServer` (use `Context.Service.Identifier<typeof LiveServer>` for its identifier type). PostgreSQL `appHost` and `appDatabase` provide it automatically; HTTP-only apps provide `LiveServer.layer` with Reactivity instead of `Layer.effect(AppChanges, makeLiveServer)`. Call `resync()` instead of reading `resync`, and use `Stream.unwrap` around the Effects returned by `stream` and `subscribe`.
- Server composition helpers (`appHostHttp`, `migratedHost`, `deferredHost`, `hostRpcRoutes` and `hostChanges`) resolve the contract service directly. Remove their live-service tag argument; calls to the former `databaseLayer(options, tag)` become `appDatabase(options)`.
- Work Board's `publishChanges` and Work Fleet's `daemonSnapshots` now require contract's `LiveServer` instead of server's `AppChanges`. Custom compositions must provide `LiveServer.layer` with Reactivity; their standard hosts already do so.
- Import server's `appDatabase` and `DatabaseConfig` directly from `@shivaedev/server/appDatabase.ts`; `appHost.ts` no longer forwards `appDatabase`, and `databaseLayer.ts` is removed.
- Import `schemaSensitiveKeys` from `@shivaedev/errors/schemaSensitiveKeys.ts` instead of server, and `redactRecord` from `@shivaedev/errors/redact.ts` instead of server's `redactingDiagnostics.ts`.
- Import schema sensitivity AST helpers from `@shivaedev/errors/schemaSensitiveAst.ts` instead of `@shivaedev/server/schemaSensitiveAst.ts`.
- Replace server's `redactOtlpUrl` with `redactUrl` from `@shivaedev/errors/sensitive.ts`. Replace server's `redactOtlpText(value, key, sensitive)` with `redactText(value, sensitive, undefined, key)` from `@shivaedev/errors/sensitive.ts`.
- Errors' redaction helpers now apply the same URL and database-key masking previously applied only to exported traces. Consumers should expect `<redacted>` for URL user information, query values and fragments, and for `db.user`, `db.user.name` and `db.connection_string` values.

## 0.10.0 - 2026-10-31

### Fixed

- End open authenticated streams with `AuthUnavailable` when a session revalidation cannot reach the auth provider. Revoked sessions still end with `Unauthorized`, and live-change subscriptions use identity's shared stream revalidation.
- Generated applications provide Node services when running database setup, so setup commands participate in Effect interruption and typed failure handling.

### Breaking

- `@shivaedev/local-postgres`: `assertLocalDatabase`, `sql`, `startPostgres`, `prepareDatabases` and lower-level command helpers return Effects. Yield them in an Effect program and provide `ChildProcessSpawner` for commands, for example with `NodeServices.layer` at a Node entry point. Replace synchronous try/catch with Effect error handling. Command failures use `PostgresCommandError`; local-target and image refusals use `LocalPostgresError`. Construct the Schema tagged errors as `new PostgresVersionMismatch({ expectedVersion: "18.6", observedVersion })` or `new PostgresSettingError({ container: "development-postgres", setting: "max_connections", cause })`. Exhausted readiness checks retain their final failure instead of reporting an unobserved version mismatch.
- `@shivaedev/server`: `setupDatabases()` requires `ChildProcessSpawner` and exposes local PostgreSQL failures in its typed error channel. Provide `NodeServices.layer` at the setup entry point instead of relying on synchronous commands hidden inside the host.

## 0.9.3 - 2026-10-31

### Fixed

- Include `CHANGELOG.md` in published package contents so release notes are available in `node_modules`.
- Release checks reject published package `files` lists that omit `CHANGELOG.md`, naming the package and how to include it.
- Server RPC failures, request diagnostics and traces use the sensitive keys from their own RPC schemas, so registering another RPC cannot redact their public failure tags or messages.
- Admin Jobs schemas mark job payload and failure-detail containers sensitive without marking generic `_tag` or `message` fields sensitive.
- End hosted live subscriptions with `Unauthorized` when the original session is signed out, revoked or expired, whether detected during a change hint or periodic revalidation. Keep `QueryReadDenied` for a signed-in viewer whose query policy refuses the read.
- Batch shared socket session lookups with an Effect scheduler yield so advancing `TestClock` past `streamRevalidationInterval` completes revalidation without another clock advance.
- Preserve typed session-provider failures during hint-time authorization instead of reporting them as read-policy refusals.

## 0.9.2 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.9.1 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.9.0 - 2026-10-30

### Added

- Queries can opt into `live: "rerun-and-compare"`. Hosted subscriptions rerun the authorized query as the subscribed viewer, hash its JSON-schema-encoded result with SHA-256, and push a typed `Result` only when it changes. Bound queries consume those results without a client refetch. Other queries keep hint-and-refetch delivery.
- Rerun subscriptions end with `QueryReadDenied` when access is denied. The host registers change listeners before its initial result read, and reconciliation reruns the query through the same read policy.

### Breaking

- `@shivaedev/contract`'s `ChangesClient` transport helper now covers result messages and erases query-specific stream failures. Consumers using that helper to read changes must use their contract's native AtomRpc client type instead; derive message and failure types with `Rpc.SuccessChunk` and `Rpc.ErrorExit` of the contract's `$changes` RPC. Contract-derived bound query types remain specific to their query.

## 0.8.0 - 2026-10-30

### Fixed

- Live reads and change subscriptions preserve policy failures instead of reporting read denial. Generated starter apps report notes database connection failures as `ServiceUnavailable` during the owner's live read.

### Breaking

- Query read policies declare their error and service channels with `QueryReadPolicy<Payload, E, R>`. Declare policy errors in the query's `rejections` and provide policy services when building its handler Layer. Custom subscription adapters call `querySubscription(rpc, references, viewer)` instead of resolving requests themselves. Use the native RPC type when calling `authorizeReads` or `resolveChanges` so their inferred channels include policy requirements and errors. The generated change stream includes the queries' declared rejections and service requirements; consumers handling that stream must handle those errors too.
- Admin pages install their permission's read policy for every query, preserving additional query restrictions. Remove repeated page-grant policies from individual queries and supply the page's permission middleware with the handler Layers.

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
