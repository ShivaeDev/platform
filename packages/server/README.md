# @shivaedev/server

The application host for Effect apps: one Layer that runs migrations, serves native RPC and static assets over Node HTTP, checks sessions, redacts diagnostics and exports traces. Applications describe their contracts, handlers and session policy; the host owns the process around them.

## Why you want this

Every Effect application needs the same server shell: wait for migrations, open a pool, serve RPC with bounded bodies and trusted proxies, keep secrets out of logs and traces, shut down cleanly. Assembling that by hand per app is a week of careful work and a long list of ways to get it subtly wrong. Here it is one call:

```ts
import { NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";
import { appHost } from "@shivaedev/server/appHost.ts";
import { Api, Handlers, Services, migrations, sessions } from "./app.ts";

NodeRuntime.runMain(
	Layer.launch(appHost({ group: Api, handlers: Handlers, services: Services, migrations: { loader: migrations }, sessions, assets: "./public" })),
);
```

The process migrates the database, serves `Api` at `/rpc` and the built client from `./public`, and stops in order on a signal.

## Using it

### How to think about it

The host composes pieces that live in their own packages. Request identity, sessions, Origin policy, permissions and Better Auth come from [`@shivaedev/identity`](https://github.com/ShivaeDev/platform/tree/main/packages/identity#readme); shared failures and redaction from [`@shivaedev/errors`](https://github.com/ShivaeDev/platform/tree/main/packages/errors#readme); outside HTTP calls from [`@shivaedev/http`](https://github.com/ShivaeDev/platform/tree/main/packages/http#readme). This package hosts them: `appHost` serves the RPC group with the application's session policy, database and migrations.

The optional modules solve different boundaries. `runtime/` carries Effect services into Promise callers, and `node-http/` combines subscription cancellation sources. Choose the modules that match the application rather than adopting every integration.

### Prepare local development

`setupDatabases()` from `@shivaedev/server/setupDatabases.ts` reads `DATABASE_URL` and `TEST_DATABASE_URL` through Effect Config and prepares both local databases with `@shivaedev/local-postgres`. Database names come from those URLs. `DOCKER_HOST` and `DOCKER_CONTEXT` are optional. Missing database URLs fail with a typed Config error; migrations remain the application's responsibility.

`development({ server, worker, conditions? })` from `@shivaedev/server/development.ts` starts the two application entry points with Node's watch mode and runs `pnpm exec vite`. Supply paths relative to the application directory and any export conditions its code needs. Provide `NodeServices.layer` to run it. When a process exits, the other processes stop and the Effect returns the first exit code, which the entry point can assign to `process.exitCode`. Use `runDevelopment(options)` from the same module for the Node entry point with that runtime wiring included.

### Host the application

`appHost` is the server entry point for an Effect app. For a PostgreSQL app, supply the native RPC group, handler and service Layers, migration loader, session policy and static asset directory. The host completes migrations before acquiring application services, starts Node HTTP with native Effect RPC over a WebSocket upgrade at `/rpc`, and provides SQL, Reactivity and `AppChanges` to those Layers.

```ts
import { NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";
import { appHost } from "@shivaedev/server/appHost.ts";
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

`app.ts` exports the application's contracts, native Layers, numbered `Migrator.Loader` and `SessionPolicy`. The host needs the optional peers `@effect/platform-node` and `@effect/sql-pg` at the workspace's Effect version; install both for this entry point. The `node-http/`, `rpc-server/` and `runtime/` entries still work without them.

Omit `services` when the app has no service Layer of its own. The host uses `Layer.empty`; handler requirements remain explicit, and a migrated host still provides its database services to handlers. Annotated options that declare service outputs, errors or requirements must supply a `services` Layer.

Pass application HTTP endpoints through `routes`, including routes that read app services. Use `handlers` for RPC implementations and their middleware Layers. `routes` accepts native HTTP router Layers; the host supplies `services` during route construction and request handling, preserves route Layer build errors and leaves missing services in the host’s requirement type.

```ts
import { Effect, Layer } from "effect";
import { HttpMiddleware, HttpRouter, HttpServerResponse } from "effect/http";

const Routes = HttpRouter.add("*", "/.well-known/app", AppMetadata.pipe(Effect.map(HttpServerResponse.text))).pipe(
	Layer.provide(
		HttpRouter.middleware(
			HttpMiddleware.cors({
				allowedOrigins: ["*"],
				allowedMethods: ["GET"],
			}),
		).layer,
	),
);

const Server = appHost({ group: Api, handlers: Handlers, services: Services, routes: Routes, sessions });
```

`AppMetadata` is an app service supplied by `Services`. Register `OPTIONS` or `"*"` for a route whose native `HttpMiddleware.cors` must answer preflight. The host restricts foreign-origin preflights only on `rpcPath` (default `/rpc`) and `/api/auth/*`, including `/api/auth` itself. Application endpoints own their CORS policy. `nativeOrigins` lists exact native-client origins admitted by the host’s RPC and auth CORS policy; other foreign origins receive 403 on those paths.

`assets` accepts a directory string or native `HttpStaticServer.layer` options. For a browser app whose routes must also work on direct navigation or reload, use `{ root: "dist", spa: true }` or merge `HttpStaticServer.layer({ root: "dist", spa: true })` from `effect/http` into `routes`. The [starter](https://github.com/ShivaeDev/platform/tree/main/examples/starter) uses `routes` for static assets and Better Auth at `/api/auth/*`, with provider-owned cookies and the host's RPC session middleware.

The listener uses `HOST` or `127.0.0.1`, uses `PORT` or 3000, and reads `DATABASE_URL`. Set overrides in the one `config` object: `host`, `port` (0 selects an ephemeral port), `trustedProxy`, `maxBodySize`, `databaseUrl` (an Effect `Redacted<string>`), `applicationName`, and optional `changes`. Migration options accept `table` and `lockTimeout` (default `effect_sql_migrations` and five seconds). Native Layer failures remain in the build error channel; missing application dependencies remain in the requirement type.

RPC request bodies are limited to 1 MiB by default. Set `MAX_BODY_SIZE` to a byte count or override it with `config.maxBodySize`, a nonnegative safe integer. An oversized NDJSON body, fixed-length or chunked, returns a 4xx before any RPC handler runs. This limit applies to the host's RPC route.

For a native Node HTTP route outside RPC, read the request body with `readBoundedBody` from [`@shivaedev/http`](https://github.com/ShivaeDev/platform/tree/main/packages/http#readme), which rejects oversized bodies with a typed 413 failure.

Ordinary POST RPC uses `localRpcGuard` from `@shivaedev/identity/server/local.ts`: it requires a loopback peer and Host, same-origin or absent Origin, and the NDJSON content type. The WebSocket upgrade uses the same loopback, origin and trusted-proxy checks without an HTTP body content type. Session lookup uses the upgrade's transport headers; RPC message headers cannot replace its cookie or Origin. Session middleware revalidates authenticated streams at `streamRevalidationInterval` and ends revoked subscriptions with typed `Unauthorized`. The shared socket remains open; later protected calls use the same session checks. Automatic live subscriptions also recheck the session and query policy before each hint. POST RPC has no `$changes` stream. The host applies `RequestTracing` last to every served RPC, including loopback RPC, so it wraps authentication and handlers without a per-contract tracing declaration. Existing tracing declarations run once at that outermost boundary. With a session policy, contracts declare `Authenticated` and `MaybeAuthenticated` as needed; the host supplies their implementations. For `AuthenticatedUser`, merge `authenticatedUserLayer(sessions)` from `@shivaedev/identity/server/session.ts` beside the handlers. Declared errors retain their Schema types. Applications still own resource authorization and use `rpcBoundary` when they need to map unexpected failures.

Every response from the host's native RPC endpoint carries `Cache-Control: private, no-store`, including mixed public and authenticated batches, typed failures, transport rejections, body-read failures and streams. The host sets this at the outer response boundary without inspecting batch contents.

For local tools, use `policy: "loopback"` with contracts that do not use session middleware to serve RPC without a session provider. The same guard applies. This policy does not use `TRUSTED_PROXY` or `config.trustedProxy`. Set `rpcPath` to choose another native RPC route; `/rpc` remains the default.

Omit `migrations` to host an app without a database. This form creates no SQL pool and reads no `DATABASE_URL`; `AppHttpHostOptions` describes it. `AppHostOptions` requires migrations for database-backed hosts. A service that needs SQL still requires a SQL Layer. Provide `appDatabase` to the application’s service Layer when it owns database composition.

`appHost` serves unauthenticated `GET /health`. It queries its SQL client on each request and returns `200` only when the query succeeds within two seconds; a missing SQL client, query failure or timeout returns `503`. Both responses have an empty body and `Cache-Control: no-store`. This route also works when the SQL client comes from the application’s `services` Layer. Use it for database readiness checks.

Set `migrations.mode: "check"` on `appDatabase` or a database-backed `appHost` when a separate pre-deploy command owns migrations. Startup reads the ledger and fails with native `MigrationError` (`kind: "BadState"`) if any required migration ID or name is missing or a schema component is pending; it does not run migrations or create a ledger. Later ledger entries are allowed for rolling deployments. Use `migrations.mode: "wait"` for services that can start before that pre-deploy command finishes. It re-reads the ledger and every registered component every second until all are current, then starts the application. Set `migrations.pollInterval` and `migrations.waitTimeout` with Effect duration inputs to change the interval and five-minute timeout. If the first check finds pending work, Effect’s logger emits `Waiting for database migrations` at info, then `Still waiting for database migrations` every 30 seconds independently of polling. Set `migrations.progressInterval` with an Effect duration input to change that progress interval. These lines carry `pendingMigrations` (ID and name) and `pendingComponents` (name and detail) annotations. A later successful check logs `Database migrations current` once; timeout logs `Timed out waiting for database migrations` with the pending annotations before failing. An initially current schema emits none of these lines. The host adds no connection details or secrets to these diagnostics. Timeout fails with the same `MigrationError` as `"check"`; interruption stops polling and closes the pool. SQL failures fail immediately. With `mode` omitted or `"migrate"`, startup applies pending ledger migrations with a five-second lock timeout unless `migrations.lockTimeout` overrides it, then applies schema components outside the ledger transaction.

Pass `migrations.components` beside `loader` for storage managed by another engine. For pg-boss, register `pgBossSchema({ schema: "app_jobs" })` from `@shivaedev/jobs/server/schema.ts`, then start every jobs Layer with `migrate: false`. `check` and `wait` use the same `MigrationError` readout for pending ledger IDs and component names and details, including pg-boss’s installed and required versions.

The host provides Effect's native `Crypto` service (`effect/Crypto`) to preflight, deferred application construction, application services and handlers. Generate invite codes and tokens through that service; see the [secure invite code example](https://github.com/ShivaeDev/platform/blob/main/docs/framework/README.md#secure-invite-codes-and-tokens). Use `Random` for non-secure choices.

Supply `preflight: AppConfigLive` to `appHost` to build a native Layer before checking or applying migrations, or constructing the application. Use it to validate configuration such as app IDs, keys and invite lists. Its errors stay in the returned Layer's typed error channel, its requirements other than `Crypto` remain external requirements, and its services are available to migrations, application construction, services and RPC handlers as well as callers of the host Layer. Preflight resources close with the host scope. The option also works without migrations.

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

| Variable                             | Default                                         | Meaning                                                              |
| ------------------------------------ | ----------------------------------------------- | -------------------------------------------------------------------- |
| `OTEL_EXPORTER_OTLP_ENDPOINT`        | Unset                                           | Collector base URL.                                                  |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Base URL plus `/v1/traces`                      | Complete traces URL; takes precedence.                               |
| `OTEL_EXPORTER_OTLP_PROTOCOL`        | `http/protobuf`                                 | `http/protobuf` or `http/json`.                                      |
| `OTEL_EXPORTER_OTLP_TRACES_PROTOCOL` | General protocol                                | Overrides the protocol for traces.                                   |
| `OTEL_EXPORTER_OTLP_HEADERS`         | Empty                                           | Comma-separated exporter headers.                                    |
| `OTEL_SERVICE_NAME`                  | Resource `service.name`, then `unknown_service` | Service name.                                                        |
| `OTEL_SERVICE_VERSION`               | Resource `service.version`, otherwise unset     | Service version.                                                     |
| `OTEL_RESOURCE_ATTRIBUTES`           | Empty                                           | Comma-separated resource attributes.                                 |
| `OTEL_EXPORTER_OTLP_TIMEOUT`         | `10000` ms                                      | Timeout for each HTTP export attempt, including its response body.   |
| `OTEL_EXPORTER_OTLP_TRACES_TIMEOUT`  | General timeout                                 | Overrides the request timeout for traces.                            |
| `OTEL_BSP_SCHEDULE_DELAY`            | `5000` ms                                       | Effect tracer's batch export interval.                               |
| `OTEL_BSP_MAX_EXPORT_BATCH_SIZE`     | `1000` spans                                    | Effect tracer's batch-size trigger.                                  |
| `OTEL_BSP_EXPORT_TIMEOUT`            | `3000` ms                                       | Effect tracer's shutdown flush bound, capped at the request timeout. |

Timeouts fail through the HTTP client's typed transport-error channel and use the same warning path as other transport failures. Effect retains its native retry policy; the request timeout applies to each attempt. The batch defaults follow Effect's `OtlpTracer.layer`. Its options cannot express a separate batch-operation deadline or a queue capacity, so `OTEL_BSP_EXPORT_TIMEOUT` controls shutdown only and `OTEL_BSP_MAX_QUEUE_SIZE` is unsupported. Other `OTEL_BSP_*` variables are unsupported.

On Railway, enable the per-service tracing setting separately for the web service and worker, and leave both exporter endpoint variables unset in your app's configuration. Railway documents that it injects the `OTEL_*` variables, including `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf`, only when the app sets no endpoint of its own. The framework exports through Effect's own `effect/observability` OTLP tracer; eBPF auto-instrumentation is outside this path. For a worker, provide `otlpTracing` from `@shivaedev/server/otlpTracing.ts` to its application Layer. It batches ended Effect spans and flushes during scoped shutdown with a three-second bound by default. The first failed export logs a warning with the collector status and redacted response body, or the transport failure kind when no response arrives. Repeated failures stay quiet until a successful export. Collector connection failures and HTTP errors leave requests, jobs and shutdown successful.

Exported HTTP server spans use `{method} {route}` with `http.route` for matched RPC and router paths, including parameter templates; unmatched requests use the method alone. `appHost` continues incoming W3C `traceparent` context in RPC handling, including one sent by an edge proxy, whether or not an exporter is configured.

Both JSON and protobuf export serialization apply sensitive-key and credential-text redaction to span attributes, events, links, error details and resource attributes. Credential text includes JWTs, Bearer/Basic credentials, sensitive assignments including bare `sig=...` anywhere in text (with or without `?`), and complete PEM private-key blocks through their matching END marker, including RSA, EC, OPENSSH and encrypted private keys. Matches become `<redacted>`. `sig` uses the shared sensitive-key policy for attributes and text. URL query values, fragments and user information are also redacted. Exporter headers stay in the collector request, outside the spans. Applications must still avoid placing secrets in span names, free text or custom attributes.

Set `config.maxConnections` on `appDatabase` or a migrated `appHost` to bound the PostgreSQL pool. The change listener reserves one connection; when transactions hold the remaining connections, another query waits until a transaction releases its connection. A daemon with long-lived RPC streams can use `config.disablePreemptiveShutdown: true` so scope closure interrupts an active HTTP RPC stream and runs its finalizer before host disposal completes, without waiting for Node's preemptive graceful-shutdown timeout. Omitting it keeps Node's native graceful-shutdown default.

For a deployment behind a proxy, set `HOST=0.0.0.0` and `TRUSTED_PROXY` to a comma-separated list of proxy peer IPs or CIDR ranges (IPv4 or IPv6), or use `config.host` and `config.trustedProxy`. Only matching peers may supply `X-Forwarded-Host` and `X-Forwarded-Proto` (`http` or `https`) for the guard's same-origin check; the proxy must overwrite both headers and preserve Origin. A single authority is required, and comma-separated forwarding chains are refused. IPv4-mapped IPv6 peers match their IPv4 address. A session host bound to a non-loopback address refuses to boot without `TRUSTED_PROXY` or `config.trustedProxy`, with a typed `TrustedProxyRequired` error from `@shivaedev/server/TrustedProxyRequired.ts` naming both settings and how to supply proxy peer addresses or CIDR ranges. Local loopback hosts keep working without proxy trust; `policy: "loopback"` does not use proxy trust. Malformed addresses or ranges fail `appHost` startup with a typed `ConfigError`. The starter's Railway deployment works out of the box: its web configuration supplies `TRUSTED_PROXY=100.64.0.0/10` and `AUTH_CLIENT_IP_HEADER=x-real-ip`, so matching peers supply forwarded client IPs for auth and the HTTPS authority for RPC origin checks. Set `PUBLIC_URL` to the app's HTTPS URL for secure session cookies. NDJSON and the application's session Origin policy still apply. See the [deployment quickstart](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md#deploy).

Build application handlers with `Api.application.toLayer(...)` (and `Api.application.of(...)` for an Effect-built handler map), then pass the full `Api` to the host and client. `Api.application` is the native RPC group without the reserved `$changes` stream; the host supplies that handler. The explicit `Api.omit("<namespace>.$changes")` form also works.

Database-backed hosts enable PostgreSQL change delivery by default and serve each contract's reserved change stream under its middleware. After a command handler succeeds, its declared invalidation keys publish without repeating keys already announced by repository commits. The handler keeps ownership of its transactions and error mapping. `config.changes.channel` overrides the app-derived default, and heartbeat and retry settings remain optional. Use the same application name or channel across web and worker processes. A worker can provide `appDatabase({ migrations, config })` without starting HTTP. See [commit-bound changes](https://github.com/ShivaeDev/platform/blob/main/docs/framework/changes.md) for defaults and limits.

### Public client configuration

Use one `publicConfig` declaration per application as the one path for server configuration that a client needs. Declare only public fields in a shared Schema; the declaration creates a standard contract query, so applications write no config RPC. Keep private configuration in server modules.

```ts
import { Schema } from "effect";
import { publicConfig } from "@shivaedev/contract/publicConfig.ts";

export const PublicConfig = publicConfig(Schema.Struct({ installUrl: Schema.URL }).pipe(Schema.encodeKeys({ installUrl: "INSTALL_URL" })));
```

On the server, merge the declaration into the application's group and its generated handler Layer into the handlers:

```ts
import { Layer } from "effect";
import { appHost } from "@shivaedev/server/appHost.ts";
import { publicConfigLayer } from "@shivaedev/server/rpc-server/publicConfigLayer.ts";
import { Api, Handlers, sessions } from "./app.ts";
import { PublicConfig } from "./public-config.ts";

export const Server = appHost({
	group: Api.merge(PublicConfig),
	handlers: Layer.merge(Handlers, publicConfigLayer(PublicConfig)),
	sessions,
});
```

`publicConfigLayer` reads `Config.schema` from the host's native ConfigProvider when the handler Layer builds. Missing or invalid required fields fail startup with a typed `ConfigError`. An optional second argument supplies a native Config path: `publicConfigLayer(PublicConfig, "PUBLIC")` reads `PUBLIC_INSTALL_URL` with the default environment provider. Only schema-declared fields are loaded and serialized; other server values never enter this response. The generated query has no session middleware, so it can supply public configuration before sign-in. Merge it alongside authenticated contracts rather than applying authentication to the merged group.

On the client, use the same contract `makeClient` and shared WebSocket as other queries:

```ts
import { makeClient } from "@shivaedev/contract/bind.ts";
import { useQuery } from "@shivaedev/react/client/resultState.ts";
import { PublicConfig } from "./public-config.ts";

const { api: config } = makeClient(PublicConfig, {
	url: new URL("/rpc", window.location.href).href,
});

export function usePublicConfig() {
	return useQuery(config.get.query());
}
```

Render inside the application's native registry provider. The query's `data` is an `Option<{ readonly installUrl: URL }>`: the same codec validates server configuration and decodes the RPC response on the client. Public configuration uses the existing atom registry and query lifecycle.

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

The masking primitives, `redact`, `redactWire`, `redactText`, `redactCause` and `isSensitiveKey`, live in [`@shivaedev/errors`](https://github.com/ShivaeDev/platform/tree/main/packages/errors#readme).

For a native RPC server composed without `appHost`, `requestTracingLayer({ sensitive })` from `@shivaedev/identity/server/tracing.ts` accepts a key predicate; `isSensitiveKey` from `@shivaedev/errors/sensitive.ts` supplies the default credential rules. `redactingErrorReporter(reporter, sensitive?)` from `@shivaedev/errors/redactCause.ts` wraps an Effect error reporter and passes it redacted failure and defect causes while preserving reporting hints such as severity and redacted attributes.

### Calling outside APIs

Use Effect's HTTP client with the status, pagination and bounded body helpers of [`@shivaedev/http`](https://github.com/ShivaeDev/platform/tree/main/packages/http#readme).

### Promise callers: one application runtime

Build the application Layer once. `runWithServices` supplies an invocation's overrides to subsequent calls on the same runtime, across Promise awaits:

```ts
import { Context, Layer } from "effect";
import { makePlatformRuntime } from "@shivaedev/server/runtime/makePlatform.ts";

class Greeting extends Context.Service<Greeting, string>()("app/Greeting") {}

const runtime = makePlatformRuntime(Layer.succeed(Greeting, "application"));
const base = await runtime.runPromise(Greeting);
const request = await runtime.runWithServices(Context.make(Greeting, "request"), async () => {
	await Promise.resolve();
	return runtime.runPromise(Greeting);
});
await runtime.dispose();
```

`base` is `"application"` and `request` is `"request"`. The application's resource Layer is acquired once across calls. An explicit `developmentCacheKey` shares a runtime between calls with that key during development. Each key belongs to one application runtime definition.

A nested `runWithServices` call replaces the outer invocation's overrides for its callback. Merge the contexts explicitly when the nested call must retain those overrides.

### Node subscriptions: combine cancellation and clean up

A long-lived response can receive cancellation from a Web request, a procedure and its underlying Node connection:

```ts
import type { IncomingMessage } from "node:http";
import { nodeSubscriptionSignal } from "@shivaedev/server/node-http/subscriptionSignal.ts";

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

### API

Import the module that defines the name; there is no package-root entry. Paths below follow `@shivaedev/server/`.

| Module                                                                          | Names and purpose                                                                                                                                                                                                |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `appHost.ts`                                                                    | `appHost`, `appDatabase`, `AppChanges`: scoped HTTP and PostgreSQL composition with loopback defaults and optional proxy trust.                                                                                  |
| `setupDatabases.ts`                                                             | `setupDatabases()`: prepare the local development and test databases.                                                                                                                                            |
| `development.ts`                                                                | `development({ server, worker, conditions? })`, `runDevelopment(options)`: run the server, worker and Vite in watch mode.                                                                                        |
| `rpc-server/publicConfigLayer.ts`                                               | `publicConfigLayer(declaration, path?)`: serve a `publicConfig` declaration from native Config.                                                                                                                  |
| `otlpTracing.ts`                                                                | `otlpTracing`: opt-in Effect OTLP trace export for worker Layers.                                                                                                                                                |
| `schemaSensitiveKeys.ts`, `RedactionPolicy.ts`                                  | `schemaSensitiveKeys(group, extraKeys?)`, `RedactionPolicy`: derive and provide an app's diagnostic key predicate.                                                                                               |
| `redactingDiagnostics.ts`, `redactingTracer.ts`, `redactingRpcSerialization.ts` | `redactingDiagnostics(sensitive)`, `redactRecord(values, sensitive)`, `redactingTracer(sensitive)`, `redactingRpcSerialization(wire, sensitive, maskFailure?)`: compose native diagnostic and NDJSON boundaries. |
| `runtime/makePlatform.ts`                                                       | `makePlatformRuntime(layer, { developmentCacheKey? })`.                                                                                                                                                          |
| `node-http/subscriptionSignal.ts`                                               | `nodeSubscriptionSignal({ nodeRequest?, request?, signals? })`, returning `{ signal, dispose }`.                                                                                                                 |

### Install, setup and limits

```sh
pnpm add @shivaedev/server effect
```

Effect is the only required peer. The `node-http/`, `rpc-server/` and `runtime/` modules work without the optional peers; a module's import path is its path under `src/`. Every module is server code: the runtime uses Node's `AsyncLocalStorage`, and browser code imports contracts from `@shivaedev/contract`, identity declarations from `@shivaedev/identity` and error schemas from `@shivaedev/errors` instead.

Install the optional peers for the selected integration:

| Integration      | Additional peers                          |
| ---------------- | ----------------------------------------- |
| `appHost.ts`     | `@effect/platform-node`, `@effect/sql-pg` |
| `development.ts` | `@effect/platform-node`                   |
- The package needs Node 24 or newer.
- `appHost` adds tracing last on its server-side copy of the group. When composing a native RPC server directly, add `RequestTracing` last on the group so it wraps authentication too; see the [native-server example](https://github.com/ShivaeDev/platform/blob/main/docs/framework/request-context.md#request-id-identity-and-logging). Middleware outside that tracing boundary is responsible for its own diagnostics.
- Redaction recognizes declared field names and common credential shapes. Mark sensitive fields in RPC schemas and configure extra names once with `config.sensitiveKeys`. Keep sensitive values out of ordinary prose.
- A development cache key is ignored when `NODE_ENV` is `production`. The application owns runtime disposal.

The [framework request-context guide](https://github.com/ShivaeDev/platform/blob/main/docs/framework/request-context.md) explains the browser and native-client Origin choices.
