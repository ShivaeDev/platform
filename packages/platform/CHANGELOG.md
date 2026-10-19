# Changelog

## 0.20.3 - 2026-10-19

### Changed

- Release with updated workspace dependencies.

## 0.20.2 - 2026-10-19

### Changed

- Release with updated workspace dependencies.

## 0.20.1 - 2026-10-19

### Added

- effect-react exports `actionTrace(effect, name?)` from `actionTrace.ts` to group an action's RPC Effects under a fresh trace. Editor saves and create submissions automatically group their save Effects in a `ui.submit` trace. Native HTTP RPC clients send W3C trace context through the host to SQL and job enqueueing; pg-boss worker attempts retain their separate, linked traces.

### Fixed

- Platform appHost preserves incoming W3C `traceparent` context for RPC handling even without an installed tracer or exporter. Request ids stay annotated on the RPC span.

## 0.20.0 - 2026-10-19

### Added

- Expose `redactWire(value, sensitive?)` for native failure serialization without diagnostic collection, depth, binary or string summaries. `redactText(text, sensitive, maxLength?)` accepts an optional length limit; `Infinity` disables truncation while retaining the existing credential and key masking.
- `appHost` accepts one `config.sensitiveKeys` list and derives sensitive field names from its RPC schemas' `Schema.Redacted`, `Schema.RedactedFromValue` and `sensitive: true` annotations. These names mask log annotations, RPC failure and defect payloads, reported causes and exported trace attributes, including nested structured data. Successful RPC results retain application data; free-text scanning keeps the existing credential and key rules.
- Expose `RedactionPolicy`, `schemaSensitiveKeys`, `redactingDiagnostics`, `redactRecord`, `redactingTracer` and `redactingRpcSerialization` for native boundary composition. `redactOtlpText` accepts an optional third sensitive-key predicate. `redactDiagnosticCause` and `redactingErrorReporter` also redact typed failure diagnostics; `redactCause` retains typed failures for middleware composition.
- The predicate returned by `schemaSensitiveKeys(group, extraKeys?)` exposes `maskFailure(tag: string | undefined, reason: "Fail" | "Die")`. Pass it as the optional third argument to `redactingRpcSerialization(wire, sensitive, maskFailure?)` to protect sensitive roots without fixed field names. Serialization correlates RPC responses with decoded request tags; an unassociated defect uses the host's conservative defect policy.

### Fixed

- Preserve public RPC failure collections, deeply nested values and long text after schema encoding, so client payloads are not changed by diagnostic output limits.
- Apply failure masking to both native numeric and string request IDs, including sensitive root-schema policies.
- Copy native cause stack frames with callable stack suppliers and valid parent links. Truncated parent chains end with `undefined`, so deep public stacks remain usable by error reporters and OTLP exception formatting.
- Mask entire RPC failure values when a sensitive source encodes to a top-level scalar or record whose output keys cannot be named. Other RPC failures and successful results retain their application data.
- Rebuild diagnostic failure, defect and interruption reasons with only sanitized annotations, so marking `stack` sensitive removes native `Cause.StackTrace` and `Cause.InterruptorStackTrace` metadata from reporter causes and exported traces.
- Honor sensitive annotations on schema checks and nested check groups in logs, RPC failures and exported span attributes.
- Apply the source `_tag` sensitivity before tracing copies an error tag into `rpc.failure`, so schema annotations and host-listed keys also protect the failure log.
- Apply sensitive-key declarations to non-enumerable Error `cause`, `message`, `name` and `stack` fields in reported causes and exported exceptions. Mask stacks when the name or message is sensitive, so their native stack headers cannot repeat those values.
- Apply the same stack masking recursively to Error values in log messages and annotations, reported causes and exported span attributes. Expose `redactErrorStack(error, sensitive)` for the shared native Error stack policy.
- Carry sensitive field names through `Schema.encodeKeys` so renamed failure fields and diagnostics stay redacted. Collect declarations before propagating encoded names until stable, making direct and chained mappings independent of schema traversal order. Detect sensitive descendants throughout the transformation source, including app-listed keys, so flattening nested fields cannot lose their sensitivity. Derive policy without executing encoder callbacks and mask every declared encoded target field, including every union branch, because opaque callbacks cannot guarantee field provenance.
- Mask the enclosing field when a sensitive source encodes to a scalar, including host-listed keys. Preserve native RPC protocol tags while masking application error fields.
- Mask encoded Error stacks in RPC failure payloads when `message` or `name` is sensitive, including `Schema.Defect({ includeStack: true })`.

### Breaking

- Sensitive fields in RPC failure payloads now contain `<redacted>` after schema encoding. Client error schemas with sensitive fields must accept that marker (for example, union the field schema with `Schema.Literal("<redacted>")`) or omit the field from the wire error schema. An encoder with a sensitive source masks all declared output fields, including otherwise public fields and error discriminators; client wire-error schemas must accept those markers too. Fields containing sensitive array items or record values are masked as a whole. If a sensitive error encodes to a scalar or record at the root, the entire error is replaced by the marker; client wire-error schemas must accept a string marker in place of that error. Successful responses keep their existing schemas and values.

## 0.19.0 - 2026-10-18

### Added

- Database hosts serve contract change subscriptions, and command declarations publish their remaining invalidation keys after handlers succeed, without repeating keys already announced by their repository commits.

### Breaking

- `appDatabase` and database-backed `appHost` enable PostgreSQL change delivery by default. The channel derives from the application name or database name; `config.changes.channel` overrides it and other change settings remain optional. Use the same application name or channel across web and worker processes. Remove application subscription handlers and repeated command invalidations.
- Direct callers of the low-level `appHostHttp`, `migratedHost` and `deferredHost` builders pass `AppChanges` as the final argument. The ordinary `appHost` call signature stays the same.

## 0.18.2 - 2026-10-18

### Changed

- Release with updated workspace dependencies.

## 0.18.1 - 2026-10-18

### Changed

- Release with updated workspace dependencies.

## 0.18.0 - 2026-10-18

### Added

- effect-sql exports `clientOptions(options, { snakeCase? })` and `SqlNameTransforms` from `clientOptions.ts`. New clients configured with this helper use Effect SQL's native camelCase-to-snake_case query names and snake_case-to-camelCase results by default. Pass `{ snakeCase: false }` to preserve native names, or supply native transform functions in the options.
- Platform's app database and app host configuration accept native `transformQueryNames` and `transformResultNames`, so applications can use effect-sql's client options without replacing the host's database layer.
- Declare public client configuration once with `publicConfig(schema)` from `rpc/publicConfig.ts`. Load it at host startup with `publicConfigLayer` from `server/rpc-server/publicConfigLayer.ts` and read the generated contract through native atoms and effect-react's `useQuery`. Only declared fields reach the client; missing or invalid required values fail startup with a typed `ConfigError`.
- `@shivaedev/platform/better-auth.ts` exposes `betterAuthMount(options)`, returning a typed Better Auth instance and native `/api/auth/*` route Layer with a 503 fallback, trusted-peer forwarded-IP handling and Config-controlled rate limiting. Applications supply their Better Auth options and RPC session policy.
- `authDatabase(url)` scopes the Better Auth PostgreSQL pool, logs idle-client errors at Debug and waits for clients to disconnect on release. The entry uses the existing Better Auth integration and the optional `pg` peer.
- Platform exports `authTestUtils(options?)` and `signedInUser(auth, fields)` from `server/better-auth/testing.ts` for typed Better Auth test utilities and signed-in story preconditions with user fields and roles, without OAuth or password hashing.
- Test-story exports `seedCookies(cookies)` and `DomCookie` from `seedCookies.ts` to seed happy-dom's cookie container, including HttpOnly session cookies accepted by a real HTTP host.

### Changed

- Newly generated applications configure snake_case SQL columns through effect-sql. The starter migrates existing note ownership and word-count columns while retaining camelCase model fields.
- Import `betterAuthMount` and `authDatabase` from `@shivaedev/platform/server/better-auth/mount.ts`, the module's own path under the package's wildcard export. The separate `@shivaedev/platform/better-auth.ts` entry is removed.

### Breaking

- Provider accounts load when a handler asks for them. Replace `SessionUser.providerAccounts` array reads with `yield* (yield* SessionUserWithProviderAccounts).providerAccounts`, declare `AuthenticatedUserWithProviderAccounts` on the RPC, and install `authenticatedUserWithProviderAccountsLayer(sessions)`. Add `AuthUnavailable` and `Unauthorized` to the RPC's error schema because account lookup failures now fail the reading handler. Base `SessionUserValue` no longer has `providerAccounts`.
- A custom session provider supplies `user.providerAccounts` as `Effect<readonly ProviderAccountValue[], AuthUnavailable | Unauthorized>`, described by the new `ProviderAccountsSessionShape`, instead of an array. The request boundary memoizes this Effect and projects its results to provider and account IDs. `betterAuthSessions(getSession, getProviderAccounts)` supplies this shape; without a lookup its session user has no accounts field. `SessionUserWithProviderAccountsValue` describes the accounts-capable handler profile. Identity-only requests do not call the lookup, and repeated reads share one lookup per request.

## 0.17.0 - 2026-10-18

### Added

- `appHost` accepts a native `preflight` Layer that builds before migration checks or execution and application startup. Typed failures stop startup; its services remain available to migrations, application construction, application services, RPC handlers and host callers, and its resources close with the host scope. The host option types accept preflight service, error and requirement parameters and require the Layer whenever any of those types are declared.
- Export `AppHostFactory`, `AppHostInput` and `HostPreflight` types for annotated host factories, inputs and preflight options.

### Breaking

- `requireAdmin` now requires `SessionUser` and fails with `Forbidden` for non-admin users. Put RPC handlers behind `AuthenticatedUser`, and wrap HTTP handlers with `withSessionUser`, so authentication supplies the profile and rejects signed-out requests with `Unauthorized`.

## 0.16.1 - 2026-10-18

### Fixed

- Report an expired session during Better Auth's provider account lookup as Unauthorized instead of AuthUnavailable.

## 0.16.0 - 2026-10-18

### Added

- Export `requireAdmin` from `rpc/requireAdmin.ts` to guard request-local users with typed `Unauthorized` and `Forbidden` failures. Session users carry the provider's optional role, and `withSessionUser` from `server/rpc-server/session.ts` shares the identity boundary between HTTP routes and RPC middleware.
- `appHost` and `appDatabase` accept `migrations.mode: "wait"` to poll the migration ledger before starting application services, with configurable `pollInterval` (one second by default) and `waitTimeout` (five minutes by default). Timeout preserves the schema check's native `MigrationError`, and interruption closes the waiting host's database pool.
- `server/MigrationOptions.ts` exports `MigrationOptions<R = never>`, the migration settings used by `AppDatabaseOptions.migrations`.

### Fixed

- App hosts apply request tracing to every served RPC, wrapping authentication and handlers even when the shared group omits `RequestTracing`. Existing declarations run once at the outermost middleware boundary; failures log redacted payloads with request ids.

### Breaking

- Every module's import path is now its path under `src/`. Server modules gain a `server/` prefix and keep their file names, for example `server/appHost.ts`, `server/rpc-server/boundary.ts`, `server/better-auth/rowAdapter.ts`, `server/runtime/makePlatform.ts` and `server/testing/makePlatformIt.ts`. `errors/rejected-field.ts` becomes `errors/rejectedField.ts`.

## 0.15.0 - 2026-10-18

### Added

- Opt in to provider account IDs on `SessionUser.providerAccounts` by passing a `GetProviderAccounts` lookup to `betterAuthSessions`. Export `ProviderAccountValue` (`providerId`, `accountId`) and `SessionWithProviderAccounts` for typed access without querying Better Auth’s account table.

## 0.14.4 - 2026-10-18

### Fixed

- Align published framework dependencies with the current releases.

## 0.14.3 - 2026-10-18

### Fixed

- Bound OTLP HTTP export attempts to 10 seconds by default, honor standard general and traces-specific timeout variables, and read the batch interval, size and shutdown timeout through Effect Config.
- Redact bare `sig` assignments, including short errors such as `error: sig=...`, and PEM private-key blocks from exported trace values in both JSON and protobuf.
- SQL spans from `appDatabase` and `appHost` report the host and port from `DATABASE_URL`, including address query parameters, while keeping the connection URL redacted.

## 0.14.2 - 2026-10-17

### Fixed

- Align published framework dependencies with the current releases.

## 0.14.1 - 2026-10-17

### Added

- `appHost({ application, migrations, config? })` evaluates a native Effect returning HTTP host options only after migrations or the schema-current check finishes. Construction keeps typed errors, requirements and scoped resources in the host Layer.

### Fixed

- Honour OTLP protocol configuration, including the traces-specific override, with native Effect JSON and protobuf encoders and sensitive diagnostic redaction in both. Default to `http/protobuf` as recommended by OpenTelemetry and fail configuration for unsupported protocols.
- Name exported HTTP server spans with the method and matched route template, preserving `http.route` and incoming trace context; unmatched requests retain the method alone.
- Warn on the first failed OTLP export with the collector status and redacted answer, and include `OTEL_SERVICE_VERSION` as `service.version`.
- Security fix: `otlpTracing` redacts every URL query value, fragment and userinfo before exporting traces, including HTTP server and client spans, events and links. Paths and query parameter names remain readable. Platform 0.13.0 and 0.14.0 exported URL query values; apps with tracing enabled should upgrade.

## 0.14.0 - 2026-10-17

### Added

- `appHost` serves unauthenticated `GET /health` with an empty, uncached response: 200 when its database probe succeeds within two seconds, or 503 when SQL is absent, unavailable or times out.
- `appDatabase` and database-backed `appHost` accept `migrations.mode: "check"` to verify required migration IDs and names without applying migrations or creating a ledger. Missing or pending migrations fail startup with native `MigrationError`; the default migration mode is unchanged.

### Fixed

- Align published contract, Prisma and tRPC dependencies with the current framework releases.

## 0.13.0 - 2026-10-17

### Added

- `otlpTracing` in `otlpTracing.ts`: a scoped Effect Config Layer for OTLP/HTTP JSON trace export. `appHost` enables it when an exporter endpoint is set; workers can provide the same Layer. Collector failures preserve requests and scoped shutdown; serialization redacts sensitive diagnostics.

## 0.12.1 - 2026-10-16

### Fixed

- `appHost` infers service requirements from inline generic service factories inside `Layer.unwrap`, including hosts returned after generator yields. Hosts with no remaining requirements can launch through `NodeRuntime.runMain` without binding the service Layer or generator first; omitted services and annotated options keep their existing behavior.

## 0.12.0 - 2026-10-16

### Added

- `trustedProxyPeer(trustedProxy?)` from `@shivaedev/platform/rpc-server/local.ts` compiles the host's IP address and CIDR proxy matching into a reusable address predicate. Missing or malformed configuration matches no peer.
- `trustedProxyRanges(trustedProxy?)` from the same module returns equivalent ranges for forwarded-header integrations. The host matcher uses the same normalization: mapped IPv6 addresses and CIDRs become IPv4 entries, including hexadecimal forms, while broader IPv6 ranges retain both address families. Missing or malformed configuration returns an empty list.

## 0.11.0 - 2026-10-16

### Added

- Export `readBoundedBody` and `RequestBodyTooLarge` from `@shivaedev/platform/boundedBody.ts`. Native Node HTTP routes can apply Effect's `HttpIncomingMessage.MaxBodySize` and return 413 for oversized content lengths or chunked bodies while keeping the connection usable and preserving accepted bytes.

## 0.10.0 - 2026-10-16

### Added

- `appHost` and its options types accept an omitted `services` Layer for apps without services of their own. Annotated options require a Layer when they declare service outputs, errors or requirements. Existing service Layers keep their behavior, and migrated hosts still provide database services to handlers.
- Signed-in handlers can read the current user's id, name and email: declare `AuthenticatedUser`, read `SessionUser`, and merge `authenticatedUserLayer(sessions)` beside the handlers. `Identity` keeps its `{ id }` shape.

## 0.9.0 - 2026-10-16

### Added

- `SessionUser` and `SessionUserValue` expose the signed-in user’s id, name and email beside the unchanged `Identity`. `AuthenticatedUser` and `authenticatedUserLayer` provide both services from a `UserSessionShape` provider, with typed authentication failures and request-local profiles.

## 0.8.0 - 2026-10-14

### Breaking

- The optional `better-auth` peer is now `1.7.7`. Upgrade Better Auth with Platform; Better Auth 1.7 accepts Vitest 5 as a peer.
- Better Auth 1.7 moved native joins from `experimental.joins` to `advanced.database.joins`. The Effect Prisma storage adapter still rejects native joins, and its error no longer calls them experimental.

## 0.7.0 - 2026-10-13

### Added

- `appHost` accepts `rpcPath` to choose the NDJSON RPC route; it still defaults to `/rpc`.
- `appHost` accepts `policy: "loopback"` for local RPC without a session provider; `AppLocalHostOptions` describes this form. The transport still requires a loopback peer and Host, matching or absent Origin, and NDJSON content type; proxy trust does not apply to this policy.
- `appHost` can omit `migrations` to start without a PostgreSQL pool or database configuration. `AppHttpHostOptions` describes this form while `AppHostOptions` retains its required migrations. Applications can provide an `appDatabase` layer through `services`; existing callers that supply migrations keep the migrated database composition.
- `appDatabase` and the migrated `appHost` accept `config.maxConnections` to bound the PostgreSQL pool.
- `appHost` forwards `config.disablePreemptiveShutdown` to the native Node host so a scoped daemon can interrupt its RPC streams during shutdown. The native default remains unchanged when omitted.
- `appHost` accepts an optional native HTTP router layer through `routes`, so application endpoints such as Better Auth share the RPC and asset host.
- `appHost.assets` also accepts native static-server options, including `spa: true` for browser route deep links. Existing directory strings keep their behavior.
- `AppHostOptions.config.trustedProxy` / `TRUSTED_PROXY` and `localRpcGuard(effect, trustedProxy?)` accept comma-separated IPv4 and IPv6 addresses and CIDR ranges, including IPv4-mapped IPv6 peers. Invalid proxy addresses or ranges fail `appHost` startup with a typed `ConfigError` before migrations, services or HTTP start.
- `appHost` accepts `config.maxBodySize` and the `MAX_BODY_SIZE` environment variable to limit RPC request bodies in bytes; explicit config takes precedence.

### Changed

- `appHost` accepts native router layers with typed request error annotations in `routes`, so applications can keep their route failures typed through the HTTP boundary.
- RPC request bodies default to a 1 MiB limit. Oversized NDJSON requests return a 4xx before any RPC handler runs.

### Breaking

- Requires stable Effect 4.0.4 in place of 4.0.0-rc.112. Effect 4.0.4 moves the former `effect/unstable/*` modules to `effect/*` and renames constructors such as `Config.string` to `Config.String`. Install `@effect/platform-node`, `@effect/sql-pg` and `@effect/vitest` 4.0.4 alongside it; `@effect/vitest` 4.0.4 requires Vitest 5.

## 0.6.1 - 2026-10-12

### Added

- `appHost`, `appDatabase`, `AppChanges`, `AppHostOptions` and `AppDatabaseOptions` in `appHost.ts`: one scoped local HTTP/NDJSON RPC host with transport guard, session middleware, static assets, migrated PostgreSQL and commit-bound live hints; the database Layer also serves workers. The host requires the optional `@effect/platform-node` and `@effect/sql-pg` peers.
- `AppHostOptions.config.host` / `HOST` and `config.trustedProxy` / `TRUSTED_PROXY` allow a non-loopback listener and same-origin HTTP/NDJSON RPC through an exact trusted proxy peer. `localRpcGuard(effect, trustedProxy?)` accepts the same proxy address; loopback defaults and typed RPC refusals are preserved.
- `rpc-server/local.ts` exports `localRpcGuard(effect)` to reject local HTTP RPC requests before the handler runs unless their remote address and Host are loopback, their Origin is absent or matches the HTTP Host, and their content type matches the native RPC serialization. It needs no session provider. The module also exports `loopbackOnly(handler)` and `sameOrigin(request)` for local HTTP routes.
- Export `InternalServerError` and `ServiceUnavailable` Schema errors from `errors/taxonomy.ts` for RPC contracts without authentication middleware.
- Export `rpcBoundary(schema, { unexpected, message? })` and `RpcBoundaryOptions` from `rpc-server/boundary.ts`. Declared rejections keep their identity; unexpected failures and defects become one declared rejection with a redacted public message and the original server-only cause. Success and interruption remain intact.

### Changed

- Pin the optional `better-auth` peer dependency to 1.6.33, the current 1.6
  release, up from 1.6.30.
- Keep the existing core defining-module import paths through explicit exports while grouping their peer-free implementation under `src/core/` and enforcing its optional-peer boundary from the package manifest.
- Prefix testing harness type parameters with `T`; their constraints, defaults and inferred types stay the same.
- Document the package purpose, request boundaries, integrations and API with agent guidance, a north star and a roadmap; publish `docs/` alongside the README.
- Build package JavaScript, declarations and source maps with TypeScript 7.

### Fixed

- Declare `@shivaedev/types` as a dependency of the shipped testing entry point instead of a development-only dependency.

## 0.6.0 - 2026-10-04

### Changed

- Breaking: no root entry and no module that re-exports another. `exports` maps one `"./*.ts"` pattern to every module (`src` under the `source` condition, `dist` otherwise), so you import the module that defines a name, and a bundler sees only the modules you use. Where each name now lives:
  - `@shivaedev/platform/better-auth`: `@shivaedev/platform/better-auth/adapter.ts` (`EffectPrismaAdapterOptions`, `effectPrismaAdapter`)
  - `@shivaedev/platform/errors`: `@shivaedev/platform/errors/rejected-field.ts` (`RejectedField`, `rejectedField`), `@shivaedev/platform/errors/taxonomy.ts` (`AuthUnavailable`, `BadRequest`, `Conflict`, `Forbidden`, `NotFound`, `PreconditionFailed`, `TooManyRequests`, `Unauthorized`)
  - `@shivaedev/platform/node-http`: `@shivaedev/platform/node-http/subscription-signal.ts` (`NodeSubscriptionSignal`, `NodeSubscriptionSignalOptions`, `nodeSubscriptionSignal`)
  - `@shivaedev/platform/rpc-server`: `@shivaedev/platform/rpc-server/adapters/better-auth-sessions.ts` (`betterAuthSessions`, `GetSession`), `@shivaedev/platform/rpc-server/origin.ts` (`OriginPolicy`, `OriginRequest`, `TrustedOriginsOptions`, `trustedOrigins`), `@shivaedev/platform/rpc-server/redact.ts` (`redact`), `@shivaedev/platform/rpc-server/redact-cause.ts` (`redactCause`, `redactDefect`, `redactingErrorReporter`), `@shivaedev/platform/rpc-server/sensitive.ts` (`isSensitiveKey`, `SensitiveKey`), `@shivaedev/platform/rpc-server/session.ts` (`authenticatedLayer`, `maybeAuthenticatedLayer`, `resolveSession`, `SessionPolicy`, `SessionProvider`, `SessionShape`), `@shivaedev/platform/rpc-server/tracing.ts` (`RequestTracingOptions`, `requestTracingLayer`), `@shivaedev/platform/rpc-server/transport.ts` (`transportHeaders`)
  - `@shivaedev/platform/rpc`: `@shivaedev/platform/rpc/identity.ts` (`Identity`, `IdentityValue`, `OptionalIdentity`, `RequestId`), `@shivaedev/platform/rpc/middleware.ts` (`Authenticated`, `MaybeAuthenticated`, `RequestTracing`)
  - `@shivaedev/platform/runtime`: `@shivaedev/platform/runtime/make.ts` (`makePlatformRuntime`), `@shivaedev/platform/runtime/types.ts` (`PlatformRuntime`, `PlatformRuntimeBuildError`, `PlatformRuntimeOptions`, `PlatformRuntimeServices`)
  - `@shivaedev/platform/testing`: `@shivaedev/platform/testing/types.ts` (`MakePlatformItOptions`, `PlatformHarness`, `PlatformIt`, `PlatformTest`, `PlatformTester`), `@shivaedev/platform/testing/vitest.ts` (`makePlatformIt`)
- The `better-auth/` modules import `all` and `or` from `@prisma-next/sql-orm-client`, so it is a new optional peer beside `@shivaedev/effect-prisma` for `better-auth/adapter.ts`.

## 0.5.2 - 2026-10-04

### Changed

- The harness tests run on the package's own auth test database instead of borrowing `@shivaedev/effect-prisma`'s test contract.

## 0.5.1 - 2026-10-04

### Changed

- Imports that leave their folder go through `#` aliases declared in the `imports` field of `package.json`: `#*.ts` resolves to `src` under the `source` condition and to `dist` otherwise, and `#test/*` names a test file. The published modules and declarations name the package's own files through these aliases.

## 0.5.0 - 2026-10-04

### Changed

- Consolidate duplicate test cases around observable package behavior.
- The function members of the Better Auth relation and field types are declared as properties, so TypeScript checks their parameters strictly.

- Validate packed consumers and executable bins through the shared workspace gate.

- Replace JSDoc blocks with a short reason comment, so the package passes the comment rules of `@shivaedev/quality`.

- Build with the `@shivaedev/quality` tsconfig presets, which target ESNext and allow only erasable TypeScript syntax.

- Type-check with TypeScript 7 only. TypeScript 6 still builds the package.

- Lint and format with the `@shivaedev/quality` Biome preset through `quality lint` at the repository root, which replaces the package's `check` script.

- Run tests through the `@shivaedev/quality` Vitest projects, which take a test's environment from its file name. Type tests are named `*.typecheck.test.ts`.

- Keep `package.json` in sort-package-json key order, checked by `quality lint`.

## 0.4.3 - 2026-09-26

### Changed

- Pin the optional `better-auth` peer dependency to 1.6.30, the current 1.6
  release, up from 1.6.25.

## 0.4.2 - 2026-09-26

### Added

- `TooManyRequests` in `@shivaedev/platform/errors`, a rejection with a
  `message` for a caller that exceeded a rate limit. Effect tRPC sends it as
  `TOO_MANY_REQUESTS`, HTTP 429.

### Changed

- Require Effect tRPC 0.4.1, which maps `TooManyRequests` to HTTP 429 and
  marks input-validation rejections with `invalidInput: true`.

## 0.4.1 - 2026-09-26

### Changed

- Pin the optional `better-auth` peer dependency to exactly 1.6.25, the version
  the package is tested against, instead of `^1.6.25`.

## 0.4.0 - 2026-09-26

### Added

- `@shivaedev/platform/errors`: browser-safe Schema error classes shared by native
  RPC contracts, effect-contract rejections and form field rejections.
- `@shivaedev/platform/rpc`: browser-safe request id and identity services plus
  the `RequestTracing`, `Authenticated` and `MaybeAuthenticated` middleware tags.
- `@shivaedev/platform/rpc-server`: middleware layers for request ids, log and
  span annotation, redacted failure logging, Better Auth sessions and an explicit
  Origin policy. The Origin policy and session provider see only the transport
  request's headers, not headers set inside RPC messages; `transportHeaders`
  gives application middleware the same view.

### Changed

- Require Effect Prisma 0.6.4 and Effect tRPC 0.4.0, which adds declared
  rejections to tRPC error data.

## 0.3.8 - 2026-09-26

### Changed

- Require only Effect. Effect Prisma, Effect tRPC, tRPC server, and Effect
  Vitest are now optional peers, so applications that import only the
  `runtime` and `node-http` entries no longer install Prisma Next, tRPC, or
  Vitest. The `better-auth` entry still requires Effect Prisma, and the
  `testing` entry requires all four.
- Accept any Better Auth 1.x release from 1.6.25 instead of exactly 1.6.25.

## 0.3.7 - 2026-09-04

### Changed

- Require Effect 4.0.0-rc.112, so applications tracking the current release
  candidate install without unmet peer warnings.
- Require Effect Prisma 0.6.3 and Effect tRPC 0.3.4, which move to the same
  Effect release.

## 0.3.6 - 2026-08-30

### Changed

- Require Effect Prisma 0.6.1 and Effect tRPC 0.3.3, which run Effect tests
  through `@shivaedev/effect-test`.

## 0.3.5 - 2026-08-27

### Changed

- Require Effect Prisma 0.6.0 and carry only the Database service through the
  shared application test transaction.

## 0.3.4 - 2026-08-12

### Changed

- Require Effect 4.0.0-rc.108. The 4.0 release candidate starts the stable line,
  so consumers pick up the compatibility promise the betas did not carry.
- Require Effect Prisma 0.5.3 and Effect tRPC 0.3.2, which move to the same
  Effect release.

## 0.3.3 - 2026-08-12

### Changed

- Require Effect 4.0.0-beta.107, so applications can depend on packages such as
  `@effect/platform-node` that are only published against the current beta line.
- Require Effect Prisma 0.5.2 and Effect tRPC 0.3.1, which move to the same
  Effect release.

## 0.3.2 - 2026-08-12

### Changed

- Require Effect Prisma 0.5.1, so the test harness requirement channel names
  the database executor service again instead of collapsing to `never`.

## 0.3.1 - 2026-08-12

### Changed

- Require Effect Prisma 0.5.0, which adds the experimental SQLite entrypoint
  and UTC decoding for zone-less SQLite datetime values.

## 0.3.0 - 2026-08-03

### Added

- Add a Node/Bun subscription signal that combines Web and procedure aborts
  with request and socket close events for reliable long-lived response cleanup.

## 0.2.3 - 2026-08-03

### Fixed

- Require Effect Prisma 0.4.3 so generated timestamp codec references normalize
  to `Date`.

## 0.2.2 - 2026-08-03

### Fixed

- Require Effect Prisma 0.4.2 so applications can normalize generated
  timestamp declarations without recursively expanding client types.

## 0.2.1 - 2026-08-03

### Fixed

- Require Effect Prisma 0.4.1 so PostgreSQL timestamp fields use their runtime
  `Date` types throughout the shared application setup.

## 0.2.0 - 2026-08-03

### Added

- Add a shared application runtime that carries Effect services across tRPC,
  Better Auth, and other promise boundaries.
- Add a Better Auth adapter backed by Effect Prisma, including transaction
  propagation and PostgreSQL filter support.
- Add a `promise` test-harness helper for driving promise-based boundaries
  inside the test rollback transaction.

## 0.1.0 - 2026-08-03

### Added

- Add an opinionated Effect Vitest harness that combines typed tRPC callers,
  direct Prisma access, rollback isolation, and application-owned fixtures.
