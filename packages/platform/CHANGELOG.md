# Changelog

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
