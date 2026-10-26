# @shivaedev/platform

Shared errors, request identity and server boundaries for Effect applications. A feature can say who called it and why it refused, while the application supplies its session policy once. The package also connects Effect services to Promise callers, Node subscriptions and optional Better Auth, Prisma and tRPC integrations.

## Why you want this

Every feature needs the same boundary questions answered: which user made this request, is the session missing or its provider unavailable, and which failures can the caller act on? Writing that glue repeatedly makes it harder to see the feature's own decision:

```ts
const Handlers = Account.toLayer({
  ReadOwn: ({ userId }) =>
    Effect.gen(function* () {
      const identity = yield* Identity;
      if (identity.id !== userId) {
        return yield* new Forbidden({ message: "Not your account" });
      }
      return identity.id;
    }),
});
```

`Account` is a native RPC group with authenticated middleware. Its handler reads the identity for this invocation and decides whether that user may read the account. Platform supplies the common error classes and request services; feature code keeps the resource-ownership check. Concurrent requests receive their own identities, and a provider outage reaches the caller as `AuthUnavailable` instead of pretending the caller signed out.

## Using it

### How to think about it

There are three parts to a native RPC boundary:

1. **The shared contract** names Schema errors and middleware tags. The browser imports these declarations too, so `errors/` and `rpc/` contain browser-safe data and services.
2. **The server composition** implements the tags with Layers from `rpc-server/`. A session provider resolves a session; an Origin policy decides whether its request may reach that provider; tracing supplies a request id and diagnostic context.
3. **The feature handler** reads `Identity`, `OptionalIdentity` or `RequestId` and runs application code. Authentication supplies a user id. Authorization still decides whether that user may perform this operation.

An **Origin policy** is a function of the transport request's origin, headers and RPC name. A **session provider** returns `Option<Session>` or fails with `AuthUnavailable`; a session carries `user.id`. These are application inputs, not a second authentication framework.

The optional modules solve different boundaries. `server/runtime/` carries Effect services into Promise callers, `server/node-http/` combines subscription cancellation sources, `server/better-auth/adapter.ts` connects Better Auth storage to Effect Prisma, and `server/testing/makePlatformIt.ts` composes the Prisma and tRPC test harnesses. Choose the modules that match the application rather than adopting every integration.

### Prepare local development

`setupDatabases()` from `@shivaedev/platform/server/setupDatabases.ts` reads `DATABASE_URL` and `TEST_DATABASE_URL` through Effect Config and prepares both local databases with `@shivaedev/local-postgres`. Database names come from those URLs. `DOCKER_HOST` and `DOCKER_CONTEXT` are optional. Missing database URLs fail with a typed Config error; migrations remain the application's responsibility.

`development({ server, worker, conditions? })` from `@shivaedev/platform/server/development.ts` starts the two application entry points with Node's watch mode and runs `pnpm exec vite`. Supply paths relative to the application directory and any export conditions its code needs. Provide `NodeServices.layer` to run it. When a process exits, the other processes stop and the Effect returns the first exit code, which the entry point can assign to `process.exitCode`. Use `runDevelopment(options)` from the same module for the Node entry point with that runtime wiring included.

### Host the application

`appHost` is the server entry point for an Effect app. For a PostgreSQL app, supply the native RPC group, handler and service Layers, migration loader, session policy and static asset directory. The host completes migrations before acquiring application services, starts Node HTTP with NDJSON RPC at `/rpc`, and provides SQL, Reactivity and `AppChanges` to those Layers.

```ts
import { NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";
import { appHost } from "@shivaedev/platform/server/appHost.ts";
import { Api, Handlers, Services, migrations, sessions } from "./app.ts";

const Server = appHost({
  group: Api,
  handlers: Handlers,
  services: Services,
  migrations: { loader: migrations },
  sessions,
  assets: "./public",
});

NodeRuntime.runMain(Layer.launch(Server));
```

`app.ts` exports the application's contracts, native Layers, numbered `Migrator.Loader` and `SessionPolicy`. The host needs the optional peers `@effect/platform-node` and `@effect/sql-pg` at the workspace's Effect version; install both for this entry point. The `errors/`, `node-http/`, `rpc/`, `rpc-server/` and `runtime/` entries still work without them.

Omit `services` when the app has no service Layer of its own. The host uses `Layer.empty`; handler requirements remain explicit, and a migrated host still provides its database services to handlers. Annotated options that declare service outputs, errors or requirements must supply a `services` Layer.

`assets` accepts a directory string or native `HttpStaticServer.layer` options. For a browser app whose routes must also work on direct navigation or reload, use `{ root: "dist", spa: true }` or merge `HttpStaticServer.layer({ root: "dist", spa: true })` from `effect/http` alongside the handler Layer. Native route Layers can register additional endpoints in that same composition; `routes` also accepts a native `Layer<never, never, HttpRouter>` for endpoints on the same listener. The [starter](https://github.com/ShivaeDev/platform/tree/main/examples/starter) uses it for static assets and Better Auth at `/api/auth/*`, with provider-owned cookies and the host's RPC session middleware.

The listener uses `HOST` or `127.0.0.1`, uses `PORT` or 3000, and reads `DATABASE_URL`. Set overrides in the one `config` object: `host`, `port` (0 selects an ephemeral port), `trustedProxy`, `maxBodySize`, `databaseUrl` (an Effect `Redacted<string>`), `applicationName`, and optional `changes`. Migration options accept `table` and `lockTimeout` (default `effect_sql_migrations` and five seconds). Native Layer failures remain in the build error channel; missing application dependencies remain in the requirement type.

RPC request bodies are limited to 1 MiB by default. Set `MAX_BODY_SIZE` to a byte count or override it with `config.maxBodySize`, a nonnegative safe integer. An oversized NDJSON body, fixed-length or chunked, returns a 4xx before any RPC handler runs. This limit applies to the host's RPC route.

For a native Node HTTP route, use `readBoundedBody` from `@shivaedev/platform/server/boundedBody.ts` with Effect's `HttpIncomingMessage.MaxBodySize`. It returns an `ArrayBuffer` without decoding the bytes. Oversized `content-length` headers are rejected before reading; chunked overflow drains the remaining body and preserves the connection for another request. `RequestBodyTooLarge` is a typed failure that implements Effect's `HttpServerRespondable` protocol with status 413; other read errors remain native `HttpServerError` failures. Consume the body once through this reader and decode the result in the application.

```ts
import { ByteSize, Effect } from "effect";
import { HttpIncomingMessage, HttpRouter, HttpServerResponse } from "effect/http";
import { readBoundedBody } from "@shivaedev/platform/server/boundedBody.ts";

const routes = HttpRouter.add("POST", "/webhook", (request) =>
  readBoundedBody(request).pipe(
    Effect.map((body) => HttpServerResponse.uint8Array(new Uint8Array(body))),
    Effect.provideService(HttpIncomingMessage.MaxBodySize, ByteSize.bytes(64 * 1024)),
  ),
);
```

RPC uses the existing `localRpcGuard`: it requires a loopback peer and Host, same-origin or absent Origin, and the NDJSON content type. Session lookup uses transport headers. The host applies `RequestTracing` last to every served RPC, including loopback RPC, so it wraps authentication and handlers without a per-contract tracing declaration. Existing tracing declarations run once at that outermost boundary. With a session policy, contracts declare `Authenticated` and `MaybeAuthenticated` as needed; the host supplies their implementations. For `AuthenticatedUser`, merge `authenticatedUserLayer(sessions)` beside the handlers as shown below. Declared errors retain their Schema types. Applications still own resource authorization and use `rpcBoundary` when they need to map unexpected failures.

Every response from the host's native RPC endpoint carries `Cache-Control: private, no-store`, including mixed public and authenticated batches, typed failures, transport rejections, body-read failures and streams. The host sets this at the outer response boundary without inspecting batch contents.

For local tools, use `policy: "loopback"` with contracts that do not use session middleware to serve RPC without a session provider. The same guard applies. This policy does not use `TRUSTED_PROXY` or `config.trustedProxy`. Set `rpcPath` to choose another native RPC route; `/rpc` remains the default.

Omit `migrations` to host an app without a database. This form creates no SQL pool and reads no `DATABASE_URL`; `AppHttpHostOptions` describes it. `AppHostOptions` requires migrations for database-backed hosts. A service that needs SQL still requires a SQL Layer. Provide `appDatabase` to the application’s service Layer when it owns database composition.

`appHost` serves unauthenticated `GET /health`. It queries its SQL client on each request and returns `200` only when the query succeeds within two seconds; a missing SQL client, query failure or timeout returns `503`. Both responses have an empty body and `Cache-Control: no-store`. This route also works when the SQL client comes from the application’s `services` Layer. Use it for database readiness checks.

Set `migrations.mode: "check"` on `appDatabase` or a database-backed `appHost` when a separate pre-deploy command owns migrations. Startup reads the ledger and fails with native `MigrationError` (`kind: "BadState"`) if any required migration ID or name is missing or a schema component is pending; it does not run migrations or create a ledger. Later ledger entries are allowed for rolling deployments. Use `migrations.mode: "wait"` for services that can start before that pre-deploy command finishes. It re-reads the ledger and every registered component every second until all are current, then starts the application. Set `migrations.pollInterval` and `migrations.waitTimeout` with Effect duration inputs to change the interval and five-minute timeout. If the first check finds pending work, Effect’s logger emits `Waiting for database migrations` at info, then `Still waiting for database migrations` every 30 seconds independently of polling. Set `migrations.progressInterval` with an Effect duration input to change that progress interval. These lines carry `pendingMigrations` (ID and name) and `pendingComponents` (name and detail) annotations. A later successful check logs `Database migrations current` once; timeout logs `Timed out waiting for database migrations` with the pending annotations before failing. An initially current schema emits none of these lines. The host adds no connection details or secrets to these diagnostics. Timeout fails with the same `MigrationError` as `"check"`; interruption stops polling and closes the pool. SQL failures fail immediately. With `mode` omitted or `"migrate"`, startup applies pending ledger migrations with a five-second lock timeout unless `migrations.lockTimeout` overrides it, then applies schema components outside the ledger transaction.

Pass `migrations.components` beside `loader` for storage managed by another engine. For pg-boss, register `pgBossSchema({ schema: "app_jobs" })` from `@shivaedev/effect-pg-boss/server/schema.ts`, then start every jobs Layer with `migrate: false`. `check` and `wait` use the same `MigrationError` readout for pending ledger IDs and component names and details, including pg-boss’s installed and required versions.

Supply `preflight: AppConfigLive` to `appHost` to build a native Layer before checking or applying migrations, or constructing the application. Use it to validate configuration such as app IDs, keys and invite lists. Its errors stay in the returned Layer's typed error channel, its requirements remain external requirements, and its services are available to migrations, application construction, services and RPC handlers as well as callers of the host Layer. Preflight resources close with the host scope. The option also works without migrations.

When construction itself touches the schema, use `appHost({ migrations, config, application })`. `application` is a native Effect that returns the HTTP host options (`group`, handler and service Layers, session policy, and optional HTTP config). The host first builds `appDatabase`, then evaluates this Effect in the host scope with SQL, Reactivity and `AppChanges` available. A failed migration or schema-current check prevents construction. Initialization requirements and errors stay in the returned Layer's types, and acquired resources close with the host scope.

```ts
const host = appHost({
  config: { databaseUrl },
  migrations: { loader: migrations, mode: "check" },
  preflight: AppConfigLive,
  application: Effect.gen(function* () {
    const { routes, sessions } = yield* makeAuth();
    return { group: Api, handlers: Handlers, services: Services, routes, sessions };
  }),
});
```

Construct Better Auth inside `application`, since its constructor starts schema validation. Keep validation enabled so a current migration ledger with missing auth columns still reports drift. The starter uses this form after its pre-deploy migrations.

Set `OTEL_EXPORTER_OTLP_ENDPOINT` or `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` to export `appHost`'s Effect spans over OTLP/HTTP. Without an endpoint, no exporter or export loop is built, even when service metadata is set. The `http/protobuf` default follows the [OpenTelemetry recommendation](https://opentelemetry.io/docs/specs/otel/protocol/exporter/#specify-protocol); unsupported protocols, including `grpc`, fail startup with a `ConfigError` naming the value. Header and resource-attribute values are `key=value` pairs with URL-encoded values. Configuration is read through Effect Config.

The supported tracing variables and defaults are:

| Variable | Default | Meaning |
| --- | --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Unset | Collector base URL. |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Base URL plus `/v1/traces` | Complete traces URL; takes precedence. |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `http/protobuf` | `http/protobuf` or `http/json`. |
| `OTEL_EXPORTER_OTLP_TRACES_PROTOCOL` | General protocol | Overrides the protocol for traces. |
| `OTEL_EXPORTER_OTLP_HEADERS` | Empty | Comma-separated exporter headers. |
| `OTEL_SERVICE_NAME` | Resource `service.name`, then `unknown_service` | Service name. |
| `OTEL_SERVICE_VERSION` | Resource `service.version`, otherwise unset | Service version. |
| `OTEL_RESOURCE_ATTRIBUTES` | Empty | Comma-separated resource attributes. |
| `OTEL_EXPORTER_OTLP_TIMEOUT` | `10000` ms | Timeout for each HTTP export attempt, including its response body. |
| `OTEL_EXPORTER_OTLP_TRACES_TIMEOUT` | General timeout | Overrides the request timeout for traces. |
| `OTEL_BSP_SCHEDULE_DELAY` | `5000` ms | Effect tracer's batch export interval. |
| `OTEL_BSP_MAX_EXPORT_BATCH_SIZE` | `1000` spans | Effect tracer's batch-size trigger. |
| `OTEL_BSP_EXPORT_TIMEOUT` | `3000` ms | Effect tracer's shutdown flush bound, capped at the request timeout. |

Timeouts fail through the HTTP client's typed transport-error channel and use the same warning path as other transport failures. Effect retains its native retry policy; the request timeout applies to each attempt. The batch defaults follow Effect's `OtlpTracer.layer`. Its options cannot express a separate batch-operation deadline or a queue capacity, so `OTEL_BSP_EXPORT_TIMEOUT` controls shutdown only and `OTEL_BSP_MAX_QUEUE_SIZE` is unsupported. Other `OTEL_BSP_*` variables are unsupported.

On Railway, enable the per-service tracing setting separately for the web service and worker, and leave both exporter endpoint variables unset in your app's configuration. Railway documents that it injects the `OTEL_*` variables, including `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf`, only when the app sets no endpoint of its own. The framework exports through Effect's own `effect/observability` OTLP tracer; eBPF auto-instrumentation is outside this path. For a worker, provide `otlpTracing` from `@shivaedev/platform/server/otlpTracing.ts` to its application Layer. It batches ended Effect spans and flushes during scoped shutdown with a three-second bound by default. The first failed export logs a warning with the collector status and redacted response body, or the transport failure kind when no response arrives. Repeated failures stay quiet until a successful export. Collector connection failures and HTTP errors leave requests, jobs and shutdown successful.

Exported HTTP server spans use `{method} {route}` with `http.route` for matched RPC and router paths, including parameter templates; unmatched requests use the method alone. The production host continues incoming W3C `traceparent` context, including one sent by an edge proxy.

Both JSON and protobuf export serialization apply sensitive-key and credential-text redaction to span attributes, events, links, error details and resource attributes. Credential text includes JWTs, Bearer/Basic credentials, sensitive assignments including bare `sig=...` anywhere in text (with or without `?`), and complete PEM private-key blocks through their matching END marker, including RSA, EC, OPENSSH and encrypted private keys. Matches become `<redacted>`. `sig` uses the shared sensitive-key policy for attributes and text. URL query values, fragments and user information are also redacted. Exporter headers stay in the collector request, outside the spans. Applications must still avoid placing secrets in span names, free text or custom attributes.

Set `config.maxConnections` on `appDatabase` or a migrated `appHost` to bound the PostgreSQL pool. The change listener reserves one connection; when transactions hold the remaining connections, another query waits until a transaction releases its connection. A daemon with long-lived RPC streams can use `config.disablePreemptiveShutdown: true` so scope closure interrupts an active HTTP RPC stream and runs its finalizer before host disposal completes, without waiting for Node's preemptive graceful-shutdown timeout. Omitting it keeps Node's native graceful-shutdown default.

For a deployment behind a proxy, set `HOST=0.0.0.0` and `TRUSTED_PROXY` to a comma-separated list of proxy peer IPs or CIDR ranges (IPv4 or IPv6), or use `config.host` and `config.trustedProxy`. Only matching peers may supply `X-Forwarded-Host` and `X-Forwarded-Proto` (`http` or `https`) for the guard's same-origin check; the proxy must overwrite both headers and preserve Origin. A single authority is required, and comma-separated forwarding chains are refused. IPv4-mapped IPv6 peers match their IPv4 address. Malformed addresses or ranges fail `appHost` startup with a typed `ConfigError`. NDJSON and the application's session Origin policy still apply. See the [deployment quickstart](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md#deploy).

Build application handlers with `Api.application.toLayer(...)` (and `Api.application.of(...)` for an Effect-built handler map), then pass the full `Api` to the host and client. `Api.application` is the native RPC group without the reserved `$changes` stream; the host supplies that handler. The explicit `Api.omit("<namespace>.$changes")` form also works.

Database-backed hosts enable PostgreSQL change delivery by default and serve each contract's reserved change stream under its middleware. After a command handler succeeds, its declared invalidation keys publish without repeating keys already announced by repository commits. The handler keeps ownership of its transactions and error mapping. `config.changes.channel` overrides the app-derived default, and heartbeat and retry settings remain optional. Use the same application name or channel across web and worker processes. A worker can provide `appDatabase({ migrations, config })` without starting HTTP. See [commit-bound changes](https://github.com/ShivaeDev/platform/blob/main/docs/framework/changes.md) for defaults and limits.

### Session-scoped contract keys

For self-only features, declare `contract("preferences", { keyScope: "session", queries, commands }).middleware(Authenticated)`. `List` and `Item` remain the dependency shapes; the account scope is an additional dimension derived from request-local `Identity.id`. Handlers continue to read their owner from `Identity`, and payloads need no owner field just to key reads or invalidations. Other sessions of that account receive its changes; other accounts receive no invalidation hint for those writes.

The host's generated `$changes` handler accepts `{ queries: [{ query: "get", payload: { id: "theme" } }] }`, resolves the declared query dependencies during that subscription invocation, and passes the authenticated scope to the change stream. It does not accept physical subscription keys or a caller-selected scope. Missing request-local `Identity` on a session-scoped subscription is a configuration defect, with no unscoped fallback.

`authenticatedLayer`, `authenticatedUserLayer`, `authenticatedUserWithProviderAccountsLayer`, `authenticatedAdminLayer` and `authenticatedOwnerLayer` run scoped command invalidation inside the authenticated invocation. Successful commands publish their scoped keys after commit and omit keys the handler's transactions already published. A rejected transaction publishes no keys.

Hosted applications use `Api.application.toLayer(...)` and let `appHost` own `$changes`. When migrating a custom change handler, accept query references and resolve them inside `Stream.unwrap`, after authentication has provided `Identity`:

```ts
import { Effect, Stream } from "effect";
import { resolveChanges } from "@shivaedev/platform/server/rpc-server/sessionKeys.ts";

const changesRpc = Api.requests.get("preferences.$changes")!;
const handlers = Api.toLayer({
  "preferences.$changes": ({ queries }) => Stream.unwrap(
    Effect.map(resolveChanges(changesRpc, queries), ({ keys, context }) =>
      changes.stream(keys, context)
    )
  ),
  "preferences.get": getPreference,
  "preferences.save": savePreference,
});
```

Here `changes` is the application's `makeLiveServer` service. Keep `resolveChanges` in the invocation; resolving it while building a shared Layer would lose request identity. Pass both returned arguments to `changes.stream`.

Custom authentication middleware supplies the same boundary by validating the transport session, then wrapping scoped commands with `sessionCommandChanges` before providing `Identity`:

```ts
import { Effect, Layer } from "effect";
import { Identity } from "@shivaedev/platform/rpc/identity.ts";
import { sessionCommandChanges } from "@shivaedev/platform/server/commandChanges.ts";

const authentication = Layer.succeed(MyAuthentication, (effect, { headers, rpc, payload }) =>
  Effect.gen(function* () {
    const session = yield* requireTransportSession(headers, rpc);
    return yield* sessionCommandChanges(effect, rpc, payload).pipe(
      Effect.provideService(Identity, { id: session.user.id })
    );
  })
);
```

`MyAuthentication` declares `provides: Identity` and its authentication errors. `requireTransportSession` is the application's session validation; use `transportHeaders` or `resolveSession` to read HTTP or WebSocket transport credentials. The identity comes from that validated session on each invocation. `requestTracingLayer` publishes only unscoped contract invalidations; custom auth middleware must apply `sessionCommandChanges` for scoped commands. If a transaction explicitly announces scoped dependencies, use `invalidationKeys(keys, { scope: identity.id })` with `invalidateOnCommit` inside `transact` so automatic command invalidation can deduplicate the same physical keys.

### Public client configuration

Use one `publicConfig` declaration per application as the one path for server configuration that a client needs. Declare only public fields in a shared Schema; the declaration creates a standard effect-contract query, so applications write no config RPC. Keep private configuration in server modules.

```ts
import { Schema } from "effect";
import { publicConfig } from "@shivaedev/platform/rpc/publicConfig.ts";

export const PublicConfig = publicConfig(
  Schema.Struct({ installUrl: Schema.URL }).pipe(
    Schema.encodeKeys({ installUrl: "INSTALL_URL" }),
  ),
);
```

On the server, merge the declaration into the application's group and its generated handler Layer into the handlers:

```ts
import { Layer } from "effect";
import { appHost } from "@shivaedev/platform/server/appHost.ts";
import { publicConfigLayer } from "@shivaedev/platform/server/rpc-server/publicConfigLayer.ts";
import { Api, Handlers, sessions } from "./app.ts";
import { PublicConfig } from "./public-config.ts";

export const Server = appHost({
  group: Api.merge(PublicConfig),
  handlers: Layer.merge(Handlers, publicConfigLayer(PublicConfig)),
  sessions,
});
```

`publicConfigLayer` reads `Config.schema` from the host's native ConfigProvider when the handler Layer builds. Missing or invalid required fields fail startup with a typed `ConfigError`. An optional second argument supplies a native Config path: `publicConfigLayer(PublicConfig, "PUBLIC")` reads `PUBLIC_INSTALL_URL` with the default environment provider. Only schema-declared fields are loaded and serialized; other server values never enter this response. The generated query has no session middleware, so it can supply public configuration before sign-in. Merge it alongside authenticated contracts rather than applying authentication to the merged group.

On the client, use the same native `AtomRpc.Service`, NDJSON HTTP protocol and effect-contract `bind` as other queries:

```ts
import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import { PublicConfig } from "./public-config.ts";

class ConfigClient extends AtomRpc.Service<ConfigClient>()("app/ConfigClient", {
  group: PublicConfig,
  protocol: RpcClient.layerProtocolHttp({ url: "/rpc" }).pipe(
    Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
  ),
}) {}
const config = bind(PublicConfig, ConfigClient);

export function usePublicConfig() {
  return useQuery(config.get.query());
}
```

Render inside the application's native registry provider. The query's `data` is an `Option<{ readonly installUrl: URL }>`: the same codec validates server configuration and decodes the RPC response on the client. Public configuration uses the existing atom registry and query lifecycle.

### 1. Once per application: contracts and session policy

Declare the RPC group in a shared module:

```ts
import { Effect, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { Forbidden } from "@shivaedev/platform/errors/taxonomy.ts";
import { Identity } from "@shivaedev/platform/rpc/identity.ts";
import { Authenticated } from "@shivaedev/platform/rpc/middleware.ts";

export const Account = RpcGroup.make(
  Rpc.make("ReadOwn", {
    error: Forbidden,
    payload: { userId: Schema.String },
    success: Schema.String,
  }),
).middleware(Authenticated);

export const Handlers = Account.toLayer({
  ReadOwn: ({ userId }) =>
    Effect.gen(function* () {
      const identity = yield* Identity;
      if (identity.id !== userId) {
        return yield* new Forbidden({ message: "Not your account" });
      }
      return identity.id;
    }),
});
```

The middleware declaration makes `Identity` available to guarded handlers and adds `Unauthorized`, `AuthUnavailable` and `Forbidden` to the client's failure type. An unguarded handler that requires `Identity` cannot become a service-free handler Layer. Keep the group declaration in the shared module and the handler implementation on the server when organizing application files.

Supply a provider and an explicit Origin policy as the host's `sessions` input. For a Better Auth provider, adapt its existing session lookup:

```ts
import { betterAuthSessions } from "@shivaedev/platform/server/rpc-server/adapters/betterAuthSessions.ts";
import { trustedOrigins } from "@shivaedev/platform/server/rpc-server/origin.ts";
import { auth } from "./auth.ts";

export const sessions = {
  origin: trustedOrigins({ allow: ["http://localhost:3000"], missing: "allow" }),
  provider: betterAuthSessions((headers) => auth.api.getSession({ headers })),
};
```

`trustedOrigins({ allow, missing })` accepts an exact allowlist and supports `missing: "reject"` or `"allow"`; a custom `OriginPolicy` can decide from the RPC name or transport headers. A denied policy fails with `Forbidden` before provider lookup. The host's HTTP guard also checks Origin against the local request's Host.

The application's `auth` owns its storage and session configuration. A null lookup becomes a missing session. A thrown or rejected lookup is logged in redacted form and fails with the generic `AuthUnavailable` message. It remains a failure even on an RPC with optional authentication.

### Reading other users' public profiles

Use `userProfiles(auth, userIds)` in server code to display the names of users who made changes. Pass the `auth` instance returned by `betterAuthMount` and a list of user IDs.

```ts
import { userProfiles } from "@shivaedev/platform/server/better-auth/userProfiles.ts";

const profiles = yield* userProfiles(auth, changedByUserIds);
```

The Effect returns an array of `{ id, name, image }`, with `image: null` when unset and unknown IDs omitted. It reads duplicate IDs once in one storage query through Better Auth's adapter, honoring the application's model and field mappings. An empty list returns an empty array without querying storage. Each lookup reads the current profile, including names changed through Better Auth. The result never includes email, role, session or account data. A storage failure logs its cause in redacted form and fails with a generic `AuthUnavailable`, without exposing provider exception details to the caller.

### Reading the signed-in user

When a handler needs the current user's name and email, declare `AuthenticatedUser` and read `SessionUser`. `Identity` keeps its `{ id }` shape; the new middleware supplies both services for that invocation. Its provider must return `user: { id, name, email }`, described by `UserSessionShape`.

```ts
import { Effect, Layer, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { SessionUser } from "@shivaedev/platform/rpc/identity.ts";
import { AuthenticatedUser } from "@shivaedev/platform/rpc/middleware.ts";
import { authenticatedUserLayer } from "@shivaedev/platform/server/rpc-server/session.ts";

export const Account = RpcGroup.make(
  Rpc.make("Whoami", {
    success: Schema.Struct({ id: Schema.String, name: Schema.String, email: Schema.String }),
  }),
).middleware(AuthenticatedUser);

export const AccountHandlers = Account.toLayer({
  Whoami: () => Effect.map(SessionUser, (user) => user),
});

export const AccountServer = Layer.merge(AccountHandlers, authenticatedUserLayer(sessions));
```

Here `sessions` is the application's policy from the previous example, with a Better Auth lookup that returns all three user fields. Merge `authenticatedUserLayer(sessions)` alongside the handler Layer when using `appHost`; the host continues to supply its id-only and optional middleware. A missing session fails with typed `Unauthorized`; rejected origins fail with `Forbidden`, and provider failures remain `AuthUnavailable`. The profile contains id, name and email, plus an optional role when the provider supplies it, without exposing the rest of the provider's user record. Handlers do not query the provider's user table.

#### Reading provider account IDs

Pass Better Auth's account lookup as the second argument to `betterAuthSessions`. Declare `AuthenticatedUserWithProviderAccounts` on account-reading RPCs and merge `authenticatedUserWithProviderAccountsLayer(sessions)` alongside their handlers. This boundary requires a provider whose user has a `providerAccounts` Effect; a provider without the second lookup does not satisfy that type.

```ts
import { SessionUserWithProviderAccounts } from "@shivaedev/platform/rpc/identity.ts";
import { AuthenticatedUserWithProviderAccounts } from "@shivaedev/platform/rpc/middleware.ts";
import { AuthUnavailable, Unauthorized } from "@shivaedev/platform/errors/taxonomy.ts";
import { authenticatedUserWithProviderAccountsLayer } from "@shivaedev/platform/server/rpc-server/session.ts";

const sessions = {
  origin: trustedOrigins({ allow: ["https://app.example"], missing: "reject" }),
  provider: betterAuthSessions(
    (headers) => auth.api.getSession({ headers }),
    (headers) => auth.api.listUserAccounts({ headers }),
  ),
};

const githubAccount = Effect.gen(function* () {
  const user = yield* SessionUserWithProviderAccounts;
  const accounts = yield* user.providerAccounts;
  return accounts.find((account) => account.providerId === "github");
});
```

Declare `Schema.Union([AuthUnavailable, Unauthorized])` in the account-reading RPC's `error` schema: lookup failures now come from the handler's Effect. An outage fails with `AuthUnavailable`; a session that expires before the lookup fails with `Unauthorized`. Neither failure exposes provider exception details.

The lookup uses the same transport headers and runs only when the handler evaluates `user.providerAccounts`. The boundary memoizes a successful result in that invocation's Effect context, including concurrent reads, without sharing it across requests or users. A failed lookup is not retained: the next read tries again. Identity-only handlers never run the accounts lookup. `SessionUserWithProviderAccountsValue.providerAccounts` is a required `Effect<readonly ProviderAccountValue[], AuthUnavailable | Unauthorized>`. Each result contains only `{ providerId: string, accountId: string }`; for example, GitHub's numeric user ID is the string `"123"`, not Better Auth's account-row id. `SessionUser` and `SessionUserValue` contain the base profile without accounts.

A custom session provider supplies `user.providerAccounts` as a lazy Effect with that same result and failure type, described by `ProviderAccountsSessionShape`. The boundary owns request-local memoization and the reduction to public IDs; custom providers need not cache or project the returned account objects.

### Session freshness in streams

`authenticatedLayer`, `authenticatedUserLayer`, `authenticatedUserWithProviderAccountsLayer`, the role layers and signed-in `maybeAuthenticatedLayer` calls revalidate live RPC streams every 30 seconds by default, using the original transport headers. A missing or revoked session ends the stream with `Unauthorized`, including an idle stream. With a session store that reflects sign-out immediately, delivery can continue for up to that interval plus the session lookup time after sign-out. Provider cookie caching or secondary storage can add their own delay; keep Better Auth's cookie cache disabled for database-backed revocation.

Set `SessionPolicy.streamRevalidationInterval` to an Effect `Duration.Input` to change the interval for middleware using that policy:

```ts
const sessions = {
  origin: trustedOrigins({ allow: ["https://app.example.com"], missing: "reject" }),
  provider: betterAuthSessions((headers) => auth.api.getSession({ headers })),
  streamRevalidationInterval: "5 seconds",
};
```

An `AuthUnavailable` failure during revalidation leaves the stream running and the next interval checks again. During a session-store outage, the sign-out delivery window extends until a lookup succeeds. Initial session lookup failures still reject the subscription. Unary calls resolve their session once per call. `MaybeAuthenticated` streams that start anonymous continue without a session monitor; a signed-in optional stream ends with `Unauthorized` when its session is removed. Callers can subscribe again to continue anonymously.

### Requiring a role

Enable Better Auth's `admin()` plugin in the application's auth options and migrate its schema. The session provider's optional `user.role` is a comma-separated role list, and `hasRole(user, role)` from `@shivaedev/platform/rpc/hasRole.ts` reports whether that list includes a role. It reads only `role` from any user value, such as the request-local `SessionUser` or the user of a client session, and imports nothing from the server, so browser code reads roles the same way the server does.

An RPC declares the role it needs as middleware, the way it declares `AuthenticatedUser`: `AuthenticatedAdmin` requires `admin` and `AuthenticatedOwner` requires `owner`. Merge `authenticatedAdminLayer(sessions)` or `authenticatedOwnerLayer(sessions)` beside the handlers. The middleware resolves the session from the transport headers on every call, provides `Identity` and `SessionUser` to the handler, and fails in its declared error channel with `Unauthorized` when the caller is signed out and `Forbidden` when the role list lacks the role. The handler's own error schema does not list them, and the handler does not check the role. Each role is checked on its own: an owner who should also reach admin RPCs carries both roles.

```ts
import { Effect, Layer, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { SessionUser } from "@shivaedev/platform/rpc/identity.ts";
import { AuthenticatedAdmin, AuthenticatedOwner } from "@shivaedev/platform/rpc/middleware.ts";
import { authenticatedAdminLayer, authenticatedOwnerLayer } from "@shivaedev/platform/server/rpc-server/roles.ts";

export const Admin = RpcGroup.make(
  Rpc.make("AdminTools", { success: Schema.String }).middleware(AuthenticatedAdmin),
  Rpc.make("TransferOwnership", { success: Schema.String }).middleware(AuthenticatedOwner),
);

export const AdminServer = Admin.toLayer({
  AdminTools: () => Effect.map(SessionUser, (user) => `Admin tools for ${user.email}`),
  TransferOwnership: () => Effect.map(SessionUser, (user) => `Owner ${user.email}`),
}).pipe(Layer.provideMerge(Layer.merge(authenticatedAdminLayer(sessions), authenticatedOwnerLayer(sessions))));
```

Removing a role takes effect on the next call with the same session, as long as the provider reads the role from storage; keep Better Auth's cookie cache disabled. A live stream behind role middleware rechecks the role at each session revalidation and ends with `Forbidden` once the role is gone.

Use `adminRoute(sessions)` for host HTTP routes. It resolves the session through the transport-header and Origin policy, checks the role with `requireAdmin`, and provides `Identity` and `SessionUser` to the handler. Signed-out callers receive 401, missing admin roles and refused Origins receive 403, and an `AuthUnavailable` session provider failure receives 503. These rejections carry `Cache-Control: private, no-store` and never run the handler. The handler's response and typed failures pass through unchanged.

```ts
import { Effect } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { SessionUser } from "@shivaedev/platform/rpc/identity.ts";
import { adminRoute } from "@shivaedev/platform/server/rpc-server/roles.ts";

const routes = HttpRouter.use((router) =>
  router.add("GET", "/admin-tools", adminRoute(sessions)(() =>
    Effect.map(SessionUser, (user) => HttpServerResponse.text(`Admin tools for ${user.email}`)),
  )),
);
```

The guard accepts any HTTP method and path. A mount can accept it as a parameter using only `effect` and `effect/http` types; the mount does not need to import Platform.

For an admin SPA, guard its HTML fallback as well as its endpoints and assets. Register a guarded `/admin/*` route in `appHost({ routes, assets: { root: "dist", spa: true }, ... })`; the native wildcard also matches `/admin` and takes precedence over the general static SPA route:

```ts
import { NodeHttpPlatform, NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerRespondable, HttpStaticServer } from "effect/http";
import { adminRoute } from "@shivaedev/platform/server/rpc-server/roles.ts";

const routes = HttpRouter.use((router) => Effect.gen(function* () {
  const spa = yield* HttpStaticServer.make({ root: "dist", spa: true });
  yield* router.add("*", "/admin/*", adminRoute(sessions)(() =>
    spa.pipe(Effect.catch(HttpServerRespondable.toResponse)),
  ));
})).pipe(Layer.orDie, Layer.provide(NodeHttpPlatform.layer), Layer.provide(NodeServices.layer));
```

The admin handler serves existing files under `dist/admin` and falls back to `dist/index.html` for unknown HTML paths. Other application routes and the public SPA stay outside this mount. Admin RPCs on the shared `/rpc` endpoint still declare `AuthenticatedAdmin`; the HTTP route guard protects the admin document, while native RPC middleware protects each operation.

`withSessionUser(policy, headers, operation)` resolves the session through the existing transport-header and Origin policy path and provides `Identity` and `SessionUser` only around the supplied Effect. It is also the boundary used by `authenticatedUserLayer`. Both the guard and identity boundary use public provider data, without reading Better Auth's tables or internal services. Keep Better Auth's cookie cache disabled for database-backed role removal to take effect on the next request, as in the starter.

### Transport headers and request ids

Session resolution reads `HttpServerRequest`: the HTTP POST or WebSocket upgrade request. Credentials and Origin supplied inside an RPC message cannot replace those transport headers. An application-owned middleware can use `transportHeaders(rpcHeaders)` for the same source of headers.

effect-react’s `actionTrace` groups an action’s RPC Effects under one browser trace; editor saves and create submissions group their save Effects automatically. Native `RpcClient.layerProtocolHttp` with `FetchHttpClient.layer` sends W3C `traceparent` on each request. appHost continues that HTTP trace for RPC handling, including without an installed tracer or exporter. Each RPC span records `request.id` and `rpc.method`; native SQL spans executed by the handler inherit that trace.

When a handler enqueues through effect-pg-boss, the job stores the current span context. Wrap enqueueing in an application-named producer span with `Effect.withSpan("Receipt.enqueue", { kind: "producer" })` to show the enqueue operation in the action trace. Worker attempts run in their own trace, linked back to the captured sender span. A trace viewer can follow that link between the action and its job.

Tracing uses the RPC headers for correlation. `requestTracingLayer()` accepts `x-request-id`; `{ header: "x-correlation-id" }` changes the name. Missing, malformed or oversized values receive generated 32-character lowercase hexadecimal ids. A request id reaches the `RequestId` service, log annotations as `requestId`, and the server span as `request.id`; the RPC method reaches both as `rpc.method`.

Caller-chosen request ids are correlation data. Keep authorization tied to the authenticated identity.

### 2. Once per feature: identity and typed refusals

Use `Authenticated` when the operation needs `Identity`, and `MaybeAuthenticated` with `maybeAuthenticatedLayer(policy)` when it reads `OptionalIdentity`:

```ts
import { Effect, Option, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { OptionalIdentity } from "@shivaedev/platform/rpc/identity.ts";
import { MaybeAuthenticated } from "@shivaedev/platform/rpc/middleware.ts";

export const Greetings = RpcGroup.make(
  Rpc.make("Greeting", { success: Schema.String }),
).middleware(MaybeAuthenticated);

export const GreetingHandlers = Greetings.toLayer({
  Greeting: () =>
    Effect.map(OptionalIdentity, (identity) =>
      Option.match(identity, {
        onNone: () => "hello anonymous",
        onSome: ({ id }) => `hello ${id}`,
      }),
    ),
});
```

A missing session produces `Option.none()` here. The same policy still rejects forbidden origins and distinguishes provider failure from an anonymous caller. Signed-in authenticated requests annotate the user's id on logs as `userId` and spans as `user.id`.

For an HTTP RPC server that serves only the local machine, wrap its HTTP effect with `localRpcGuard` from `@shivaedev/platform/server/rpc-server/local.ts`. Provide the native `HttpServerRequest` and `RpcSerialization` services around the returned effect, using the same serialization as the RPC server. No session provider is required.

By default, the guard returns HTTP 403 before running the effect unless the transport reports a loopback peer address, the Host is a loopback host, any Origin matches the HTTP Host, and the content type matches the serialization. An absent peer address is rejected, and a DNS-rebinding Host on a loopback connection is refused. The optional second argument, `localRpcGuard(effect, trustedProxy)`, enables the same address and range forwarding policy as `appHost`.

The same module exports `loopbackOnly(handler)` for local page routes and `sameOrigin(request)` for an HTTP Origin check. `loopbackOnly` checks Host and any known peer address; it permits an absent peer address so embedded Fetch page handlers remain usable. It does not check Origin or content type.

`trustedProxyPeer(trustedProxy?)` compiles the guard's proxy address list into an `(address: string) => boolean` predicate. Use it with the transport's remote address when another route needs the same proxy trust decision. It supports the same IP addresses, CIDR ranges and IPv4-mapped IPv6 peers as `appHost`; absent or malformed configuration matches no peer. It does not read forwarded headers.

`trustedProxyRanges(trustedProxy?)` returns the equivalent IP addresses and CIDR ranges used by that matcher. Mapped IPv6 addresses and CIDRs become IPv4 entries: `::ffff:127.0.0.0/104` becomes `127.0.0.0/8`, including hexadecimal mapped forms. Broader IPv6 ranges retain both native IPv6 and mapped IPv4 coverage. Missing or malformed configuration returns an empty list. Pass these ranges to a forwarded-header integration after checking the transport with `trustedProxyPeer`.

Declare expected refusals in the RPC's error schema:

```ts
import { Schema } from "effect";
import { Rpc } from "effect/rpc";
import { BadRequest, Conflict } from "@shivaedev/platform/errors/taxonomy.ts";

export const Rename = Rpc.make("Rename", {
  error: Schema.Union([BadRequest, Conflict]),
  payload: { name: Schema.String },
  success: Schema.String,
});
```

A handler fails with `new Conflict({ field: "name", message: "Name is taken" })`. Native RPC JSON decodes the rejection back to the error instance with its field. Taxonomy errors can be declared on an RPC with no authentication middleware. `rejectedField` reads either that instance or tagged JSON:

```ts
import { rejectedField } from "@shivaedev/platform/errors/rejectedField.ts";
import { Conflict } from "@shivaedev/platform/errors/taxonomy.ts";

const field = rejectedField(
  new Conflict({ field: "name", message: "Name is taken" }),
);
```

`field` is `Option.some({ field: "name", message: "Name is taken" })`. Any value with string `_tag`, `field` and `message` qualifies, including an application's own tagged error. An untagged object, a missing field or a non-string field yields `Option.none()`.

For tRPC, use these classes with the rejection schema and formatter from [effect-trpc](https://github.com/ShivaeDev/platform/tree/main/packages/effect-trpc). The composed HTTP boundary carries rejection data and maps statuses, including `TooManyRequests` as 429 and `AuthUnavailable` as 503.

### Handling unexpected failures

At the handler edge, `rpcBoundary(schema, options)` keeps declared rejections and maps other failures and defects into one declared fallback. It leaves successful values and interruption intact:

```ts
import { Schema } from "effect";
import { Conflict, InternalServerError } from "@shivaedev/platform/errors/taxonomy.ts";
import { rpcBoundary } from "@shivaedev/platform/server/rpc-server/boundary.ts";

const Rejection = Schema.Union([Conflict, InternalServerError]);
const expose = rpcBoundary(Rejection, {
  unexpected: (message) => new InternalServerError({ message }),
});

export const save = storageSave.pipe(expose);
```

`storageSave` is the application's Effect. `unexpected` constructs a member of the declared schema from the public message. The default message is `Internal server error`; `message` supplies application text, with credential-shaped strings redacted. The original Effect cause is kept on the server rejection's non-enumerable `cause`, so an RPC server span can trace it. Keep `cause` out of the wire schema, as the taxonomy classes do. `ServiceUnavailable` describes a declared availability failure without implying a session-provider outage.

### Request diagnostics

Tracing logs declared failures with `RPC failure` and their tag, and defects with `RPC defect`. Interrupt-only causes emit `RPC interrupted` at debug instead, with `rpc.method`, `requestId`, the `rpc.duration` log span and the same redacted payload. The RPC trace span carries `rpc.interrupted: true`; Effect exports interruption with an unset span status. Completed and failed RPCs receive no interruption marker. The diagnostic payload masks nested credential-shaped keys and Effect `Redacted` values. Credential-shaped strings, such as bearer tokens, URL passwords and sensitive `key=value` text, are masked too. Strings retain at most 2,048 characters before a truncation marker; collections retain at most 50 entries with a marker for the remainder, and binary values become size summaries.

`appHost` derives sensitive field names from the served RPC group's payload, success, error, defect and middleware error schemas, including nested schemas. Use `Schema.Redacted(...)`, `Schema.RedactedFromValue(...)`, or annotate a field with `sensitive: true`. The host treats those names as sensitive throughout that app, even when a diagnostic contains an unwrapped value. Add other exact, case-sensitive names once in `config.sensitiveKeys`:

```ts
import { Schema } from "effect";

const Contact = Schema.Struct({
  deliveryAddress: Schema.String.annotate({ sensitive: true }),
  recoveryCode: Schema.RedactedFromValue(Schema.String),
});

const Server = appHost({
  group: Api,
  handlers: Handlers,
  sessions,
  config: { sensitiveKeys: ["customerReference"] },
});
```

Use `Contact` in `Api`'s RPC schemas. A `sensitive: true` annotation also applies to a checked schema, such as `Schema.String.check(Schema.isMinLength(1)).annotate({ sensitive: true })`, and to checks or groups nested inside other check groups. Values under the declared names become `<redacted>` in host log messages and annotations, failure and defect payloads sent to RPC clients, causes passed to installed error reporters, and exported trace attributes, events, links and resource attributes. Nested structured values follow the same policy before trace serialization. A field containing sensitive array items or record values is masked as a whole. `Schema.encodeKeys` and other schema encoders carry sensitivity to their declared output names, including chains of renamed fields. The host collects all sensitive declarations before propagating encoded names and enclosing-field protection until the key set stops growing, so schema and RPC order do not change the policy. Sensitivity is checked throughout each transformation's source subtree, including fields named in `config.sensitiveKeys`. Policy derivation does not execute encoder callbacks: their field provenance is unknown, so every declared output field of a sensitive source is treated as sensitive, including every union branch, otherwise public fields and error discriminators. When a sensitive source encodes to a scalar, its enclosing field is masked as a whole. Sensitive error tags are masked before tracing copies them into the `rpc.failure` log annotation. Native RPC protocol tags remain intact. An `Error` retains its message, stack and cause in redacted form. If `message` or `name` is sensitive, its stack is masked too, including stack headers encoded by `Schema.Defect({ includeStack: true })`. Successful RPC responses retain their application data. Error schemas consumed by native clients must accept the redaction marker for sensitive fields; a constrained string, numeric or collection field may otherwise fail client decoding after masking.

A sensitive error encoded to a top-level scalar or record has no fixed output field name to mask. The host replaces that entire failure value with `<redacted>`. This decision follows each RPC schema, so other methods' failures and successful results retain their application data. Client wire-error schemas must accept the string marker in place of that error. Wire masking preserves public collection entries, deeply nested values and long text; diagnostic collection, depth and string limits apply to logs and diagnostic copies, not client failure data.

Diagnostic failure, defect and interruption reasons are rebuilt with sanitized annotations. When `stack` is sensitive, native `Cause.StackTrace` and `Cause.InterruptorStackTrace` annotations are omitted before reporters or trace exporters receive the cause. Other annotations and interruption identities are preserved. Public native stack frames keep callable stack suppliers and valid parent links; a truncated parent chain ends with `undefined` so reporters and trace exporters can still format it.

The policy matches field names, not arbitrary occurrences of their values in prose. Free text uses only the existing credential-shaped string and key-assignment rules; it does not scan for personal data. Keep sensitive values out of ordinary prose and span names.

For native RPC serialization, `schemaSensitiveKeys(group, extraKeys?)` returns a key predicate with `maskFailure(tag: string | undefined, reason: "Fail" | "Die")`. Pass both to `redactingRpcSerialization(wire, sensitive, sensitive.maskFailure)`. The serializer correlates request tags and response IDs, including batches, before masking a whole error or defect root. Unassociated defects use the conservative policy across the host's defect schemas.

`redactWire(value, sensitive?)` applies the same sensitive-key and credential masking without diagnostic summaries or truncation. `redactText(text, sensitive, maxLength?)` keeps its default 2,048-character diagnostic limit; passing `Infinity` keeps complete public text.

For a native RPC server composed without `appHost`, `requestTracingLayer({ sensitive })` accepts a key predicate; `isSensitiveKey` supplies the default credential rules. `redactingErrorReporter(reporter, sensitive?)` wraps an Effect error reporter and passes it redacted failure and defect causes while preserving reporting hints such as severity and redacted attributes.

### Calling outside APIs

Use Effect's HTTP client with `filterStatus`, `paginate` and the bounded body readers:

```ts
import { Effect, Schema, Stream } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import { readBoundedJson } from "@shivaedev/platform/http-client/body.ts";
import { filterStatus } from "@shivaedev/platform/http-client/filterStatus.ts";
import { paginate } from "@shivaedev/platform/http-client/paginate.ts";

const items = Effect.gen(function* () {
  const client = filterStatus(yield* HttpClient.HttpClient);
  return yield* paginate(client, HttpClientRequest.get("https://api.example/items")).pipe(
    Stream.mapEffect((response) => readBoundedJson(response, 64 * 1024, Schema.Array(Schema.String))),
    Stream.runCollect,
    Effect.map((pages) => pages.flat()),
  );
});
```

Provide a native client Layer such as `FetchHttpClient.layer` from `effect/http`. `filterStatus` passes 2xx responses through and fails other statuses with Schema tagged errors from `http-client/errors.ts`: `RemoteUnauthorized` (401), `RemoteNotFound` (404), `RemoteGone` (410), `RemoteRateLimited` (429, or 503 carrying `Retry-After`) and `RemoteHttpError` for other statuses. Errors carry the method, URL without its query string and status, without headers or body. `RemoteRateLimited.retryAfter` is an optional UTC `DateTime`: delay-seconds use Effect's clock, and HTTP dates name the instant directly. Missing or invalid values leave it undefined.

`paginate` follows quoted or unquoted `rel=next`, including headers with multiple links and relations, resolves relative links and stops at the last page. Taking one page sends one request. A next link on another origin fails with `PaginationLinkError` before that request is sent.

`readBoundedBody(response, limit)` returns bytes; `readBoundedText` decodes UTF-8, and `readBoundedJson(response, limit, schema)` decodes JSON through the supplied Schema. Limits are bytes. An oversized `Content-Length` fails with `ResponseBodyTooLarge` before reading the body; a chunked body that exceeds the limit fails during the read. The error carries `limit`.

### Promise callers: one application runtime

Build the application Layer once. `runWithServices` supplies an invocation's overrides to subsequent calls on the same runtime, across Promise awaits:

```ts
import { Context, Layer } from "effect";
import { makePlatformRuntime } from "@shivaedev/platform/server/runtime/makePlatform.ts";

class Greeting extends Context.Service<Greeting, string>()("app/Greeting") {}

const runtime = makePlatformRuntime(Layer.succeed(Greeting, "application"));
const base = await runtime.runPromise(Greeting);
const request = await runtime.runWithServices(
  Context.make(Greeting, "request"),
  async () => {
    await Promise.resolve();
    return runtime.runPromise(Greeting);
  },
);
await runtime.dispose();
```

`base` is `"application"` and `request` is `"request"`. The application's resource Layer is acquired once across calls. An explicit `developmentCacheKey` shares a runtime between calls with that key during development. Each key belongs to one application runtime definition.

A nested `runWithServices` call replaces the outer invocation's overrides for its callback. Merge the contexts explicitly when the nested call must retain those overrides.

### Node subscriptions: combine cancellation and clean up

A long-lived response can receive cancellation from a Web request, a procedure and its underlying Node connection:

```ts
import type { IncomingMessage } from "node:http";
import { nodeSubscriptionSignal } from "@shivaedev/platform/server/node-http/subscriptionSignal.ts";

export async function consumeSubscription(
  request: Request,
  nodeRequest: IncomingMessage,
  procedureSignal: AbortSignal,
  consume: (signal: AbortSignal) => Promise<void>,
) {
  const subscription = nodeSubscriptionSignal({
    nodeRequest,
    request,
    signals: [procedureSignal],
  });
  try {
    await consume(subscription.signal);
  } finally {
    subscription.dispose();
  }
}
```

The signal aborts on an additional signal, socket close, incomplete request close or an already destroyed connection. Normal completion of a request does not abort a continuing response. Without an explicit `nodeRequest`, the helper can read one from an srvx Web request's `runtime.node.req`. `dispose()` removes Node listeners and can be called repeatedly.

### Mount Better Auth

`betterAuthMount(options)` returns the Better Auth instance and a native route Layer for `/api/auth/*`. It accepts Better Auth options, including application plugins and session policy. Merge `routes` into the HTTP host and use `auth.api.getSession` with `betterAuthSessions` for the application's RPC session provider.

```ts
import { Config, Effect } from "effect";
import { authDatabase, betterAuthMount } from "@shivaedev/platform/server/better-auth/mount.ts";

const authentication = Effect.gen(function* () {
  const database = yield* authDatabase(yield* Config.Redacted("DATABASE_URL"));
  return yield* betterAuthMount({
    database,
    emailAndPassword: { enabled: true },
    session: { cookieCache: { enabled: false } },
  });
});
```

`authDatabase(url, { max, application_name })` accepts an optional maximum connection count and PostgreSQL application name, passed to `pg.Pool`. Omit the settings to use pg’s defaults.

Run this Effect in the host's scope. The pool logs idle-client errors at Debug and replaces failed connections on the next query; closing the scope disconnects its clients. A rejected auth handler returns HTTP 503 with `Authentication is temporarily unavailable`.

The mount reads `BETTER_AUTH_SECRET` unless options supply `secret`. `PUBLIC_URL` supplies the default base URL, trusted origin and HTTPS secure-cookie setting; without it, the defaults accept loopback HTTP. Application options can override those defaults. RPC Origin policy remains an application choice.

`AUTH_RATE_LIMIT_ENABLED` is a Config boolean that defaults to true and takes precedence over `options.rateLimit.enabled`. Each mount owns scoped in-memory buckets when `storage` is unset or `"memory"`. Application `customStorage`, `"database"` and `"secondary-storage"` selections pass through; Better Auth chooses the rules and client-IP keys.

`TRUSTED_PROXY` supplies the same address and CIDR policy used by the host. An untrusted transport peer loses `x-forwarded-for` and the configured client-IP header before Better Auth sees the request. `AUTH_CLIENT_IP_HEADER` defaults to `x-forwarded-for`. With no trusted proxy, Better Auth ignores forwarded IPs and shares a rate-limit bucket per path.

For email sign-in through `appHost`, the session record's `ipAddress` follows the same rule. With a trusted peer, `AUTH_CLIENT_IP_HEADER=x-real-ip` stores `X-Real-IP` even if `X-Forwarded-For` supplies a different address; the default header selects the rightmost untrusted address in the `X-Forwarded-For` chain, ignoring trusted proxy hops on the right. With an untrusted peer, neither header can supply the stored address. Sign-in attempts from an untrusted peer share one bucket per path; with a trusted peer and `x-real-ip`, changing `X-Forwarded-For` does not change the bucket, while changing `X-Real-IP` does.

### Bundled native clients

For a Capacitor or similar WebView whose page is served from the app bundle, opt in with the auth host mount's `bearerSessions` option. It installs Better Auth's own `bearer({ requireSignature: true })` plugin from the existing dependency; do not add a second bearer plugin. The option is absent by default. List only bundled-client origins here, and include them in Better Auth's `trustedOrigins` as well.

```ts
const nativeOrigins = ["capacitor://localhost", "https://localhost"];
const mounted = yield* betterAuthMount(
  {
    database,
    trustedOrigins: [publicOrigin, ...nativeOrigins],
    session: { cookieCache: { enabled: false } },
    emailAndPassword: { enabled: true },
  },
  { bearerSessions: { origins: nativeOrigins } },
);
const sessions = {
  origin: trustedOrigins({ allow: [publicOrigin, ...nativeOrigins], missing: "allow" }),
  provider: betterAuthSessions(mounted.admittedSessions((headers) => mounted.auth.api.getSession({ headers }))),
};
const host = appHost({ group, handlers, routes: mounted.routes, sessions, nativeOrigins });
```

Always wrap the session lookup in `admittedSessions`, even without a sign-in policy: it applies the mount's credential selection to the same request-local identity, profile and role middleware used by cookies. A same-origin request or a request without an Origin carrying the session cookie uses only that cookie, even if invalid or revoked; its bearer header cannot switch accounts or rescue it. Otherwise the signed bearer is resolved by Better Auth. Missing, unsigned, tampered, expired and revoked bearer sessions produce `Unauthorized` at protected RPCs.

A native client signs in through `/api/auth/sign-in/email` with `credentials: "omit"` and its bundled Origin, reads the signed credential from the `set-auth-token` response header, and sends that exact value as `Authorization: Bearer <credential>` with `credentials: "omit"` on later auth and RPC requests. Persist it only in OS-backed secure storage, such as iOS Keychain or Android Keystore-backed storage; never use localStorage, sessionStorage or IndexedDB. Browser responses keep HttpOnly cookies and omit the plugin's token header and JSON token fields. Clients without a bundled Origin receive cookie responses.

Native sign-out revokes the stored session. Signing in again while sending the current bearer replaces it and revokes the old session after successful sign-in. Streams keep their original request headers, so the old session ends with `Unauthorized` on the next revalidation; it never adopts the replacement. Keep cookie caching disabled for database-backed revocation and choose `streamRevalidationInterval` for the required delivery window.

`appHost`'s `nativeOrigins` option admits those exact origins through the RPC transport guard and the auth routes. Wildcards, patterns and URLs with paths are rejected at startup. Keep the list aligned with `bearerSessions.origins`, Better Auth's `trustedOrigins` and the RPC session origin policy: the later origin policies alone cannot open the transport guard. Omit the option to keep the existing same-origin transport policy.

The host answers native preflights with POST for RPC, GET and POST for auth, and only `Authorization` and `Content-Type` headers. Native responses echo the allowed origin exactly with `Vary: Origin`; auth responses expose `set-auth-token`. The host never enables CORS credentials. It strips cookies from admitted native requests before auth or RPC session resolution, so only the signed bearer session can authenticate them. This prevents native access from opening a cookie CSRF path, even if a caller sends a cookie. Resource authorization remains app-owned.

Use the WebView's own fetch with `credentials: "omit"` for incremental NDJSON change streams and abort its request to release server work. A buffering native HTTP bridge cannot deliver that streaming behavior. The host still validates trusted proxy peers and forwarded authority, enforces NDJSON and body limits, uses only transport credentials, redacts diagnostics and authorizes sessions. Native HTTP callers without an Origin can exercise bearer RPC with an origin policy that explicitly permits missing Origins.

### Decide who may sign in

Give the mount a sign-in policy as its second argument, and resolve RPC sessions through `admittedSessions` so a removal ends access on the next request:

```ts
import { Config, Effect } from "effect";
import { allowedAccounts } from "@shivaedev/platform/server/better-auth/allowedAccounts.ts";
import { authDatabase, betterAuthMount } from "@shivaedev/platform/server/better-auth/mount.ts";
import { betterAuthSessions } from "@shivaedev/platform/server/rpc-server/adapters/betterAuthSessions.ts";
import { trustedOrigins } from "@shivaedev/platform/server/rpc-server/origin.ts";

const authentication = Effect.gen(function* () {
  const database = yield* authDatabase(yield* Config.Redacted("DATABASE_URL"));
  const mounted = yield* betterAuthMount(
    { database, session: { cookieCache: { enabled: false } }, socialProviders: { github } },
    { signIn: { accounts: allowedAccounts, recheckInterval: "5 minutes", rule: inOrganization } },
  );
  yield* mounted.revokeUnadmitted;
  const sessions = {
    origin: trustedOrigins({ allow: ["https://app.example"], missing: "reject" }),
    provider: betterAuthSessions(mounted.admittedSessions((headers) => mounted.auth.api.getSession({ headers }))),
  };
  return { ...mounted, sessions };
});
```

`github` is the application's GitHub client settings. `inOrganization` is the application's rule, `(account: ProviderAccountValue) => Effect<boolean, E, R>`, which asks the provider whether that account belongs to its organization; the mount requires the rule's `R`, and its failures stay typed. Both parts are optional, and a user is admitted when one of their provider accounts is on the list and the rule admits that account.

`allowedAccounts` reads `AUTH_ALLOWED_ACCOUNTS` through Effect Config and decodes it with the `AllowedAccounts` Schema: comma-separated `providerId:accountId` entries, such as `github:1001,github:1002` for two GitHub user IDs. A malformed or empty list stops the mount with a `ConfigError`. For another variable name, pass `Config.schema(AllowedAccounts, "NAME")` as `accounts`.

At sign-in the mount installs the policy into Better Auth's own hooks. `user.validateUserInfo` checks the provider account from the provider's verified profile before Better Auth creates a user, so a refused sign-up leaves no user behind. Sign-ups without a provider account, such as email and password, are refused while a policy is set. `databaseHooks.session.create.before` checks the stored accounts of a returning user before Better Auth creates the session. A refused OAuth sign-in redirects to the error URL with `error=sign_in_refused`, and a refused API call answers HTTP 403 with code `sign_in_refused`. When the rule fails, the sign-in is refused with `sign_in_unavailable` and no user is created. The application's own `databaseHooks.session.create.before` runs before the policy's, and a session it refuses stays refused.

A removal takes effect on the user's next request through `admittedSessions`: the list is read from Config at every check, the user is refused with `Unauthorized`, and Better Auth's internal adapter deletes every stored session of that user. With environment variables, the list changes when the application restarts with the new value; a Config provider whose values change at runtime applies a removal without a restart. The rule's answer for each provider account is reused for `recheckInterval`, five minutes by default, so a rule that turns false refuses the user on their first request after that interval. A failing rule, or a list that no longer decodes, answers `AuthUnavailable` and keeps the session.

`revokeUnadmitted` checks every stored user against the current policy, deletes the sessions of each user it no longer admits and succeeds with `{ users, sessions }`, the number of users and sessions it revoked. Run it at startup, as above, or from an administrative command. It fails with the rule's error or with a `ConfigError`.

Without `signIn`, the mount installs no sign-in policy hooks and `revokeUnadmitted` revokes nothing. Without either mount option, `admittedSessions` returns the lookup unchanged.

### Signed-in story preconditions

Use `authTestUtils()` from `@shivaedev/platform/server/better-auth/testing.ts` in a test-only Better Auth instance with the host's database, secret and cookie policy. The wrapper preserves the plugin's typed `$context.test` under `exactOptionalPropertyTypes`. Keep the plugin out of production auth options.

Use `authTestDatabase(pool)` from `@shivaedev/platform/server/better-auth/testDatabase.ts` when a story needs observations or faults in the default Better Auth PostgreSQL schema. It returns Effect readouts `users` (IDs and emails) and `sessions` (IDs, user IDs and emails), plus the test-only faults `expireSessions` and `omitImageColumn`. It never returns tokens, password hashes or provider credentials. These fixtures assume the default table and column mappings and operate on the supplied pool; use only an isolated test database. Application stories keep their auth SQL in this provider-owned boundary.

```ts
import { betterAuth } from "better-auth";
import { authTestUtils, signedInUser } from "@shivaedev/platform/server/better-auth/testing.ts";

const testAuth = betterAuth({
  ...options,
  plugins: [...(options.plugins ?? []), authTestUtils()],
});
const { user, headers, cookies } = await signedInUser(testAuth, {
  email: "member@example.test",
  name: "Member",
  providerAccounts: [{ providerId: "github", accountId: "123" }],
  role: "user,admin",
});
```

`options` is the application's auth configuration. `signedInUser` saves the supplied user fields, creates each optional `providerAccounts` entry for that user through Better Auth's internal adapter, and mints one session through Better Auth's `testUtils`, without OAuth or password hashing. The accounts carry no tokens or password. Omitting `providerAccounts` creates only the user and session. It returns Better Auth's login result: the user, session, signed request headers, browser cookies and token. Roles require the application's role plugin, such as Better Auth's `admin()`. Send `headers` to the real host, or pass `cookies` to test-story's `seedCookies` in a DOM story after setting its host location with `domFetch`. Keep a real sign-in story for each sign-in flow; feature stories start from the minted precondition.

Use `storedProviderAccounts(auth, userId)` to observe credential storage through Better Auth's internal adapter. It returns account and provider IDs with `hasAccessToken`, `hasRefreshToken`, `hasIdToken` and `hasPassword` booleans. It never returns token values, passwords or password hashes. A DOM story kit that exposes its test auth instance and a session readout can use both helpers:

```ts
import { Effect } from "effect";
import { expect } from "vitest";
import { seedCookies } from "@shivaedev/test-story/server/seedCookies.ts";
import { signedInUser, storedProviderAccounts } from "@shivaedev/platform/server/better-auth/testing.ts";

const member = app.trait("account", "a member starts signed in with GitHub", function* ({ auth }) {
  const { cookies } = yield* Effect.promise(() => signedInUser(auth, {
    email: "member@example.test",
    name: "Member",
    providerAccounts: [{ providerId: "github", accountId: "123" }],
  }));
  yield* seedCookies(cookies);
});

app.it("the member's provider account stores no credentials", [member], function* ({ session, story }) {
  const { user } = yield* session();
  const accounts = yield* Effect.promise(() => storedProviderAccounts(story.engine.auth, user.id));
  expect(accounts).toEqual([{
    providerId: "github",
    accountId: "123",
    hasAccessToken: false,
    hasRefreshToken: false,
    hasIdToken: false,
    hasPassword: false,
  }]);
});
```

With database-backed sessions and cookie caching disabled, revocation rejects that same minted session on the next protected HTTP or RPC request. Cookie caching and secondary storage can change revocation timing.

### Optional Better Auth storage on Effect Prisma

When Better Auth's rows belong to an Effect Prisma database, give its adapter the same database service and runtime:

```ts
import { betterAuth } from "better-auth";
import { effectPrismaAdapter } from "@shivaedev/platform/server/better-auth/adapter.ts";
import { makePlatformRuntime } from "@shivaedev/platform/server/runtime/makePlatform.ts";
import { Database, DatabaseLive } from "./database.ts";

export const runtime = makePlatformRuntime(DatabaseLive);
export const auth = betterAuth({
  database: effectPrismaAdapter(Database, runtime, {
    modelName: (model) =>
      `Auth${model.length === 0 ? model : `${model[0]?.toUpperCase()}${model.slice(1)}`}`,
  }),
});
```

The application's database module owns its generated contract and Layer. This mapping selects `AuthUser` for Better Auth's `user` model. The adapter translates create, read, update, count and delete operations through Effect Prisma. It carries a Better Auth transaction's services through its Promise callback; a failed callback rolls the transaction back.

An empty `update` filter returns null. Empty filters on `updateMany` and `deleteMany` affect all rows, so callers must choose those operations deliberately.

### In tests: one Prisma/tRPC composition

Set up the application harness once in `test-support/`:

```ts
import { Effect } from "effect";
import { makePlatformIt } from "@shivaedev/platform/server/testing/makePlatformIt.ts";
import { adapter, Database, router, TestLive } from "./application.ts";

export const it = makePlatformIt(Database)({
  adapter,
  createCaller: (options = { actor: "default" }) => router.createCaller(options),
  extend: ({ db }) =>
    Effect.succeed({
      userExists: (id: string) => db.AuthUser.where({ id }).exists(),
    }),
  layer: TestLive,
});
```

`application.ts` supplies the application's Effect tRPC adapter, generated database service, router and test Layer. The example router has `createUser` and `findUser` procedures, and its caller context has an `actor` string. `extend` adds application helpers alongside `db`, `trpc` and `promise`; types are inferred from the database, caller and extension.

Write each feature test against the caller and database:

```ts
import { expect } from "@effect/vitest";
import { Option } from "effect";
import { it } from "./test-support/it.ts";

it.effectApp("stores the user's email", function* ({ db, trpc, userExists }) {
  const id = crypto.randomUUID();
  const input = { email: `${id}@example.test`, id, name: "Ada" };
  const created = yield* trpc.createUser(input);
  const stored = Option.getOrThrow(yield* db.AuthUser.where({ id }).first());

  expect(stored.email).toBe(input.email);
  expect(yield* userExists(created.id)).toBe(true);
});
```

The direct database, tRPC caller and extension share the test's PostgreSQL transaction. Successful and expected-failing tests roll their writes back. `trpc({ actor: "admin" })` selects another caller context within the test. `promise(() => auth.api.getSession({ headers }))` runs a Promise boundary with the test's services, so Better Auth adapter calls inside it join the rollback transaction.

### API

Import the module that defines the name; there is no package-root entry. Paths below follow `@shivaedev/platform/`.

| Module | Names and purpose |
| --- | --- |
| `errors/taxonomy.ts` | `NotFound`, `Unauthorized`, `Forbidden`, `BadRequest`, `Conflict`, `PreconditionFailed`, `TooManyRequests`, `AuthUnavailable`, `InternalServerError`, `ServiceUnavailable`: Schema tagged error classes with a `message`; `BadRequest` and `Conflict` also accept an optional `field`. |
| `errors/rejectedField.ts` | `rejectedField(unknown)`: the field and message of a field rejection. |
| `rpc/identity.ts` | `RequestId`, `Identity`, `OptionalIdentity`, `SessionUser`, `SessionUserWithProviderAccounts`: request-local services. |
| `rpc/middleware.ts` | `RequestTracing`, `Authenticated`, `AuthenticatedUser`, `AuthenticatedUserWithProviderAccounts`, `AuthenticatedAdmin`, `AuthenticatedOwner`, `MaybeAuthenticated`: native RPC middleware declarations. |
| `rpc/hasRole.ts` | `hasRole(user, role)`: whether a user's comma-separated role list includes a role; browser-safe. |
| `rpc/requireAdmin.ts` | `requireAdmin`: the signed-in user with an admin role, for HTTP routes. |
| `server/appHost.ts` | `appHost`, `appDatabase`, `AppChanges`: scoped HTTP and PostgreSQL composition with loopback defaults and optional proxy trust. |
| `server/boundedBody.ts` | `readBoundedBody`, `RequestBodyTooLarge`: bounded body bytes and a typed HTTP 413 failure. |
| `server/otlpTracing.ts` | `otlpTracing`: opt-in Effect OTLP trace export for worker Layers. |
| `server/rpc-server/session.ts` | `authenticatedLayer`, `maybeAuthenticatedLayer`, `authenticatedUserLayer`, `authenticatedUserWithProviderAccountsLayer`, `withSessionUser`, `resolveSession`: session middleware implementations and the identity boundary. |
| `server/rpc-server/roles.ts` | `authenticatedAdminLayer`, `authenticatedOwnerLayer`: role middleware implementations; `adminRoute`: admin guard for host HTTP handlers. |
| `server/rpc-server/adapters/betterAuthSessions.ts` | `betterAuthSessions(getSession, getProviderAccounts?)`: a session provider from Better Auth lookups. |
| `server/rpc-server/origin.ts` | `trustedOrigins({ allow, missing })`: an exact Origin allowlist. |
| `server/rpc-server/local.ts` | `localRpcGuard`, `loopbackOnly`, `sameOrigin`, `trustedProxyPeer`, `trustedProxyRanges`: loopback and proxy guards. |
| `server/rpc-server/transportHeaders.ts` | `transportHeaders(rpcHeaders)`: the headers used for a transport-level decision. |
| `server/rpc-server/boundary.ts` | `rpcBoundary(schema, { unexpected, message? })`: declared failures pass through, unexpected failures become one declared rejection. |
| `server/rpc-server/tracing.ts` | `requestTracingLayer({ header?, sensitive? })`. |
| `server/rpc-server/redact.ts`, `server/rpc-server/redactCause.ts`, `server/rpc-server/sensitive.ts` | `redact`, `redactCause`, `redactDiagnosticCause`, `redactDefect`, `redactingErrorReporter`, `isSensitiveKey`, `redactText`: diagnostic redaction. |
| `server/schemaSensitiveKeys.ts`, `server/RedactionPolicy.ts` | `schemaSensitiveKeys(group, extraKeys?)`, `RedactionPolicy`: derive and provide an app's diagnostic key predicate. |
| `server/redactingDiagnostics.ts`, `server/redactingTracer.ts`, `server/redactingRpcSerialization.ts` | `redactingDiagnostics(sensitive)`, `redactRecord(values, sensitive)`, `redactingTracer(sensitive)`, `redactingRpcSerialization(wire, sensitive)`: compose native diagnostic and NDJSON boundaries. |
| `server/runtime/makePlatform.ts` | `makePlatformRuntime(layer, { developmentCacheKey? })`. |
| `server/node-http/subscriptionSignal.ts` | `nodeSubscriptionSignal({ nodeRequest?, request?, signals? })`, returning `{ signal, dispose }`. |
| `server/better-auth/mount.ts` | `betterAuthMount(options, { signIn?, bearerSessions? })`, returning `{ auth, routes, admittedSessions, revokeUnadmitted }`, and `authDatabase(url, { max?, application_name? }?)`: native auth routes, the sign-in policy and a scoped PostgreSQL pool. |
| `server/better-auth/allowedAccounts.ts` | `AllowedAccounts`, `allowedAccounts`: the provider-account list Schema and its `AUTH_ALLOWED_ACCOUNTS` Config. |
| `server/better-auth/signInGate.ts` | `SignInPolicy`: the `accounts`, `rule` and `recheckInterval` of a sign-in policy. |
| `server/better-auth/revokeUnadmitted.ts` | `RevokedSessions`: the `{ users, sessions }` counts of a revocation. |
| `server/better-auth/testDatabase.ts` | `authTestDatabase(pool)`: test-only identity/session readouts and faults for the default PostgreSQL auth schema. |
| `server/better-auth/testing.ts` | `authTestUtils(options?)`, `signedInUser(auth, fields)`: test-only typed Better Auth helpers and minted user sessions. |
| `server/better-auth/adapter.ts` | `effectPrismaAdapter(Database, runtime, options?)`: a Better Auth adapter over Effect Prisma; `modelName` maps model names. |
| `server/testing/makePlatformIt.ts` | `makePlatformIt(Database)({ adapter, createCaller, layer, extend? })`. |

### Manage app users

`server/better-auth/users.ts` provides `listUsers({ limit, cursor? })` and `changeUserRole({ userId, role, grant })` using the existing Effect SQL client and Better Auth's default PostgreSQL user table with its admin plugin. Browser-safe schemas, Platform roles (`user`, `admin`, `owner`) and the typed `LastOwner` failure live in `rpc/userRoles.ts`. The admin package supplies the protected contract and React view.

Role writes require an owner `SessionUser`, serialize role changes in a transaction, and reject removal of the final owner. They preserve unrelated roles and publish the `admin.users` invalidation after commit. Successful changes emit structured Effect logs with actor, target, role, action and UTC timestamp. Platform has no durable audit-history store. The host must use the same database as authentication; custom Better Auth table names and columns need their own integration.

### Install, setup and limits

```sh
pnpm add @shivaedev/platform effect@4.0.5
```

Effect is the only required peer. The peer-free implementation lives in the shared `errors/` and `rpc/` folders and the `server/node-http/`, `server/rpc-server/` and `server/runtime/` folders; a module's import path is its path under `src/`. The core errors, RPC declarations, server middleware, runtime and Node HTTP modules can be imported without the optional peers, including the Promise-based `betterAuthSessions` function. The runtime uses Node's `AsyncLocalStorage`; browser consumers import the shared `errors/` and `rpc/` modules.

Install the optional peers for the selected integration:

| Integration | Additional peers |
| --- | --- |
| `server/boundedBody.ts` | `@effect/platform-node` |
| `server/appHost.ts` | `@effect/platform-node`, `@effect/sql-pg` |
| `server/better-auth/mount.ts` | `better-auth`, `pg` |
| `server/better-auth/adapter.ts` | `better-auth`, `@shivaedev/effect-prisma`, `@prisma-next/sql-orm-client` |
| `server/testing/makePlatformIt.ts` | `@effect/vitest`, `@shivaedev/effect-prisma`, `@shivaedev/effect-trpc`, `@trpc/server` |

- The package needs Node 24 or newer.
- Keep the auth provider's configuration, cookie settings and resource authorization in the application. The session adapter takes a session lookup and an optional provider-account lookup and returns a session result; it does not write provider refresh cookies into RPC responses.
- Without an `HttpServerRequest`, `transportHeaders` falls back to the supplied RPC headers. An application using another transport must decide what headers it can trust.
- `appHost` adds tracing last on its server-side copy of the group. When composing a native RPC server directly, add `RequestTracing` last on the group so it wraps authentication too; see the [native-server example](https://github.com/ShivaeDev/platform/blob/main/docs/framework/request-context.md#request-id-identity-and-logging). Middleware outside that tracing boundary is responsible for its own diagnostics.
- Redaction recognizes declared field names and common credential shapes. Mark sensitive fields in RPC schemas and configure extra names once with `config.sensitiveKeys`. Keep sensitive values out of ordinary prose.
- A development cache key is ignored when `NODE_ENV` is `production`. The application owns runtime disposal.
- The Better Auth storage adapter's default model mapping capitalizes the model name. Supply `modelName` for a generated schema with another naming convention. Native Better Auth joins (`advanced.database.joins`) are rejected; leave that option off so Better Auth reads related rows with separate queries.

The [framework request-context guide](https://github.com/ShivaeDev/platform/blob/main/docs/framework/request-context.md) explains the browser and native-client Origin choices.
