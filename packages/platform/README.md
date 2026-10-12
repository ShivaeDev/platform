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

The optional modules solve different boundaries. `runtime/` carries Effect services into Promise callers, `node-http/` combines subscription cancellation sources, `better-auth/adapter.ts` connects Better Auth storage to Effect Prisma, and `testing/vitest.ts` composes the Prisma and tRPC test harnesses. Choose the modules that match the application rather than adopting every integration.

### Host the application

`appHost` is the server entry point for an Effect app. For a PostgreSQL app, supply the native RPC group, handler and service Layers, migration loader, session policy and static asset directory. The host completes migrations before acquiring application services, starts Node HTTP with NDJSON RPC at `/rpc`, and provides SQL, Reactivity and `AppChanges` to those Layers.

```ts
import { NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";
import { appHost } from "@shivaedev/platform/appHost.ts";
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

Supply `routes` with an optional native `Layer<never, never, HttpRouter>` to register application HTTP endpoints on the same listener. The [starter](https://github.com/ShivaeDev/platform/tree/main/examples/starter) uses it for Better Auth at `/api/auth/*`, with provider-owned cookies and the host's RPC session middleware.

`assets` accepts a directory string or native `HttpStaticServer.layer` options. Use `{ root: "dist", spa: true }` for a browser app whose routes must also work on direct navigation or reload.

The listener uses `HOST` or `127.0.0.1`, uses `PORT` or 3000, and reads `DATABASE_URL`. Set overrides in the one `config` object: `host`, `port` (0 selects an ephemeral port), `trustedProxy`, `databaseUrl` (an Effect `Redacted<string>`), `applicationName`, and optional `changes`. Migration options accept `table` and `lockTimeout` (default `effect_sql_migrations` and five seconds). Native Layer failures remain in the build error channel; missing application dependencies remain in the requirement type.

RPC uses the existing `localRpcGuard`: it requires a loopback peer and Host, same-origin or absent Origin, and the NDJSON content type. Session lookup uses transport headers. With a session policy, contracts declare `Authenticated`, `MaybeAuthenticated` and `RequestTracing` as needed; the host supplies their implementations. Declared errors retain their Schema types. Applications still own resource authorization and use `rpcBoundary` when they need to map unexpected failures.

For local tools, use `policy: "loopback"` with contracts that do not use session middleware to serve RPC without a session provider. The guard requires a loopback peer and Host, absent or same-origin Origin, and NDJSON content type. This policy does not use `TRUSTED_PROXY` or `config.trustedProxy`. Set `rpcPath` to choose another native RPC route; `/rpc` remains the default.

Omit `migrations` to host an app without a database. This form creates no SQL pool and reads no `DATABASE_URL`; `AppHttpHostOptions` describes it. `AppHostOptions` retains its required migrations for existing typed callers. A service that needs SQL still requires a SQL Layer. Provide `appDatabase` to the application’s service Layer when it owns database composition, as Fleet's daemon does with its migration loader and namespace ledger. Real HTTP tests cover the custom route, session-free loopback guard and database-free startup; Fleet's PostgreSQL daemon tests cover the adopted composition.

Set `config.maxConnections` on `appDatabase` or a migrated `appHost` to bound the pool. A daemon with long-lived RPC streams can use `config.disablePreemptiveShutdown: true` to let scope closure interrupt those streams before closing the listener; omitting it keeps Node's native graceful-shutdown default. Fleet's daemon tests cover one bounded pool and scoped provider and listener cleanup, including follower reconnection after shutdown.

For a deployment behind a proxy, set `HOST=0.0.0.0` and `TRUSTED_PROXY` to a comma-separated list of proxy peer IPs or CIDR ranges (IPv4 or IPv6), or use `config.host` and `config.trustedProxy`. Only matching peers may supply `X-Forwarded-Host` and `X-Forwarded-Proto` (`http` or `https`) for the guard's same-origin check; the proxy must overwrite both headers and preserve Origin. A single authority is required, and comma-separated forwarding chains are refused. IPv4-mapped IPv6 peers match their IPv4 address. Malformed addresses or ranges fail `appHost` startup with a typed `ConfigError`. NDJSON and the application's session Origin policy still apply. Real forwarding-proxy tests cover trusted and untrusted peers, configuration overrides and typed refusals; they do not establish any hosting provider's proxy configuration. See the [deployment quickstart](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md#deploy).

A subscription handler reads `AppChanges` and returns `changes.stream(keys)` after its authorization check. Writes use `transact` and `invalidateOnCommit` from effect-sql: local streams receive committed invalidations and rollback emits none. For delivery between processes, set `config.changes: { channel: "app_changes" }`; the host binds PostgreSQL LISTEN/NOTIFY to the same SQL pool and resyncs streams when its listener recovers. The native heartbeat and retry options may be supplied in `changes`. A worker can provide `appDatabase({ migrations, config })` to its service Layer to share this database and delivery composition without starting HTTP.

The [composed PostgreSQL fixture](https://github.com/ShivaeDev/platform/blob/main/docs/framework/composed-example.md) uses this host for its HTTP servers and `appDatabase` for its worker. It proves commit visibility, rollback silence, typed refusals and delivery between server processes. Platform's host tests also cover static files, environment configuration, guard rejection before session lookup, startup ordering, migration failure and scoped shutdown.

### 1. Once per application: contracts and session policy

Declare the RPC group in a shared module:

```ts
import { Effect, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { Forbidden } from "@shivaedev/platform/errors/taxonomy.ts";
import { Identity } from "@shivaedev/platform/rpc/identity.ts";
import { Authenticated, RequestTracing } from "@shivaedev/platform/rpc/middleware.ts";

export const Account = RpcGroup.make(
  Rpc.make("ReadOwn", {
    error: Forbidden,
    payload: { userId: Schema.String },
    success: Schema.String,
  }),
).middleware(Authenticated).middleware(RequestTracing);

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
import { betterAuthSessions } from "@shivaedev/platform/rpc-server/adapters/better-auth-sessions.ts";
import { trustedOrigins } from "@shivaedev/platform/rpc-server/origin.ts";
import { auth } from "./auth.ts";

export const sessions = {
  origin: trustedOrigins({ allow: ["http://localhost:3000"], missing: "allow" }),
  provider: betterAuthSessions((headers) => auth.api.getSession({ headers })),
};
```

`trustedOrigins({ allow, missing })` accepts an exact allowlist and supports `missing: "reject"` or `"allow"`; a custom `OriginPolicy` can decide from the RPC name or transport headers. A denied policy fails with `Forbidden` before provider lookup. The host's HTTP guard also checks Origin against the local request's Host.

The application's `auth` owns its storage and session configuration. A null lookup becomes a missing session. A thrown or rejected lookup is logged in redacted form and fails with the generic `AuthUnavailable` message. It remains a failure even on an RPC with optional authentication.

### Transport headers and request ids

Session resolution reads `HttpServerRequest`: the HTTP POST or WebSocket upgrade request. Credentials and Origin supplied inside an RPC message cannot replace those transport headers. An application-owned middleware can use `transportHeaders(rpcHeaders)` for the same source of headers.

Tracing uses the RPC headers for correlation. `requestTracingLayer()` accepts `x-request-id`; `{ header: "x-correlation-id" }` changes the name. Missing, malformed or oversized values receive generated 32-character lowercase hexadecimal ids. A request id reaches the `RequestId` service, log annotations as `requestId`, and the server span as `request.id`; the RPC method reaches both as `rpc.method`.

Caller-chosen request ids are correlation data. Keep authorization tied to the authenticated identity.

### 2. Once per feature: identity and typed refusals

Use `Authenticated` when the operation needs `Identity`, and `MaybeAuthenticated` with `maybeAuthenticatedLayer(policy)` when it reads `OptionalIdentity`:

```ts
import { Effect, Option, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";
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

For an HTTP RPC server that serves only the local machine, wrap its HTTP effect with `localRpcGuard` from `@shivaedev/platform/rpc-server/local.ts`. Provide the native `HttpServerRequest` and `RpcSerialization` services around the returned effect, using the same serialization as the RPC server. No session provider is required.

By default, the guard returns HTTP 403 before running the effect unless the transport reports a loopback peer address, the Host is a loopback host, any Origin matches the HTTP Host, and the content type matches the serialization. An absent peer address is rejected. Real Node HTTP tests cover accepted local requests and rejected Origin, Host and content-type requests, including a DNS-rebinding Host on a loopback connection. The optional second argument, `localRpcGuard(effect, trustedProxy)`, enables the same address and range forwarding policy as `appHost`.

The same module exports `loopbackOnly(handler)` for local page routes and `sameOrigin(request)` for an HTTP Origin check. `loopbackOnly` checks Host and any known peer address; it permits an absent peer address so embedded Fetch page handlers remain usable. It does not check Origin or content type.

Declare expected refusals in the RPC's error schema:

```ts
import { Schema } from "effect";
import { Rpc } from "effect/unstable/rpc";
import { BadRequest, Conflict } from "@shivaedev/platform/errors/taxonomy.ts";

export const Rename = Rpc.make("Rename", {
  error: Schema.Union([BadRequest, Conflict]),
  payload: { name: Schema.String },
  success: Schema.String,
});
```

A handler fails with `new Conflict({ field: "name", message: "Name is taken" })`. Native RPC JSON decodes the rejection back to the error instance with its field. Taxonomy errors can be declared on an RPC with no authentication middleware. `rejectedField` reads either that instance or tagged JSON:

```ts
import { rejectedField } from "@shivaedev/platform/errors/rejected-field.ts";
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
import { rpcBoundary } from "@shivaedev/platform/rpc-server/boundary.ts";

const Rejection = Schema.Union([Conflict, InternalServerError]);
const expose = rpcBoundary(Rejection, {
  unexpected: (message) => new InternalServerError({ message }),
});

export const save = storageSave.pipe(expose);
```

`storageSave` is the application's Effect. `unexpected` constructs a member of the declared schema from the public message. The default message is `Internal server error`; `message` supplies application text, with credential-shaped strings redacted. The original Effect cause is kept on the server rejection's non-enumerable `cause`, so an RPC server span can trace it. Keep `cause` out of the wire schema, as the taxonomy classes do. `ServiceUnavailable` describes a declared availability failure without implying a session-provider outage.

The native HTTP RPC fixture in `src/server/rpc-server/unauthenticatedRejections.spec.ts` proves decoded taxonomy types, redacted fallback messages and the original server trace cause without session middleware. Work Board's `src/server/rpc/rejectionTypes.spec.ts` proves its adoption through real loopback HTTP.

### Request diagnostics

Tracing logs declared failures with `RPC failure` and their tag, and defects with `RPC defect`. The diagnostic payload masks nested credential-shaped keys and Effect `Redacted` values. Credential-shaped strings, such as bearer tokens, URL passwords and sensitive `key=value` text, are masked too. Strings retain at most 2,048 characters before a truncation marker; collections retain at most 50 entries with a marker for the remainder, and binary values become size summaries.

Defects are also redacted in the cause that reaches the client, server span and error reporters. An `Error` keeps its error shape with redacted fields and cause. Extend the sensitive-key rule explicitly:

```ts
import { isSensitiveKey } from "@shivaedev/platform/rpc-server/sensitive.ts";
import { requestTracingLayer } from "@shivaedev/platform/rpc-server/tracing.ts";

export const Tracing = requestTracingLayer({
  sensitive: (key) => isSensitiveKey(key) || key === "email",
});
```

The example adds `email` to the default policy. For reporting outside RPC, `redactingErrorReporter(reporter)` wraps an Effect error reporter and passes it a redacted cause while preserving reporting hints such as severity and redacted attributes.

### Promise callers: one application runtime

Build the application Layer once. `runWithServices` supplies an invocation's overrides to subsequent calls on the same runtime, across Promise awaits:

```ts
import { Context, Layer } from "effect";
import { makePlatformRuntime } from "@shivaedev/platform/runtime/make.ts";

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

A nested `runWithServices` call replaces the outer invocation's overrides for
its callback. Merge the contexts explicitly when the nested call must retain
those overrides.

### Node subscriptions: combine cancellation and clean up

A long-lived response can receive cancellation from a Web request, a procedure and its underlying Node connection:

```ts
import type { IncomingMessage } from "node:http";
import { nodeSubscriptionSignal } from "@shivaedev/platform/node-http/subscription-signal.ts";

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

### Optional Better Auth storage on Effect Prisma

When Better Auth's rows belong to an Effect Prisma database, give its adapter the same database service and runtime:

```ts
import { betterAuth } from "better-auth";
import { effectPrismaAdapter } from "@shivaedev/platform/better-auth/adapter.ts";
import { makePlatformRuntime } from "@shivaedev/platform/runtime/make.ts";
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
import { makePlatformIt } from "@shivaedev/platform/testing/vitest.ts";
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

The direct database, tRPC caller and extension share the test's PostgreSQL transaction. Successful and expected-failing tests roll their writes back. `trpc({ actor: "admin" })` selects another caller context within the test. `promise(() => auth.api.getSession({ headers }))` runs a Promise boundary with the test's services; the Better Auth adapter tests use that helper to join the rollback transaction.

### API

Import the module that defines the name; there is no package-root entry. Paths below follow `@shivaedev/platform/`.

| Module | Names and purpose |
| --- | --- |
| `appHost.ts` | `appHost({ group, handlers, services, migrations?, sessions?, policy?, rpcPath?, assets?, routes?, config? })`, `appDatabase({ migrations, config? })`, `AppChanges`, `AppHostOptions`, `AppHttpHostOptions`, `AppLocalHostOptions`, `AppDatabaseOptions`: scoped HTTP and PostgreSQL composition with loopback defaults and optional proxy trust. |
| `errors/taxonomy.ts` | `NotFound`, `Unauthorized`, `Forbidden`, `BadRequest`, `Conflict`, `PreconditionFailed`, `TooManyRequests`, `AuthUnavailable`, `InternalServerError`, `ServiceUnavailable`: Schema tagged error classes with a `message`; `BadRequest` and `Conflict` also accept an optional `field`. |
| `errors/rejected-field.ts` | `rejectedField(unknown): Option<RejectedField>`; `RejectedField` is `{ field: string, message: string }`. |
| `rpc/identity.ts` | `RequestId`: string service. `Identity`: `IdentityValue`, `{ id: string }`. `OptionalIdentity`: `Option<IdentityValue>`. |
| `rpc/middleware.ts` | `RequestTracing`, `Authenticated`, `MaybeAuthenticated`: native RPC middleware declarations. |
| `rpc-server/boundary.ts` | `rpcBoundary(schema, { unexpected, message? })`; `RpcBoundaryOptions<Error>`: declared failures pass through, unexpected failures become one declared rejection. |
| `rpc-server/session.ts` | `authenticatedLayer(policy)`, `maybeAuthenticatedLayer(policy)`, `resolveSession(policy, headers, rpc)`; `SessionShape`, `SessionProvider<Session>`, `SessionPolicy<Session>`. |
| `rpc-server/adapters/better-auth-sessions.ts` | `betterAuthSessions(getSession)`; `GetSession<Session>` is a Promise lookup returning `Session \| null`. |
| `rpc-server/origin.ts` | `trustedOrigins({ allow, missing })`, `originRequest(headers, rpc)`; `OriginPolicy`, `OriginRequest`, `TrustedOriginsOptions`. |
| `rpc-server/local.ts` | `localRpcGuard(effect)`: HTTP RPC guard using native request and serialization services; `loopbackOnly(handler)`, `sameOrigin(request)`. |
| `rpc-server/transport.ts` | `transportHeaders(rpcHeaders)`: Effect returning the headers used for a transport-level decision. |
| `rpc-server/tracing.ts` | `requestTracingLayer({ header?, sensitive? })`; `RequestTracingOptions`. |
| `rpc-server/redact.ts` | `redact(value, sensitive?)`: unknown diagnostic value. |
| `rpc-server/redact-cause.ts` | `redactCause(cause, sensitive?)`, `redactDefect(defect, sensitive?)`, `redactingErrorReporter(reporter, sensitive?)`. |
| `rpc-server/sensitive.ts` | `isSensitiveKey`, `redactText`, `REDACTED`; `SensitiveKey` is `(key: string) => boolean`. |
| `runtime/make.ts` | `makePlatformRuntime(layer, { developmentCacheKey? })`. |
| `runtime/types.ts` | `PlatformRuntime<Services, BuildError>`, `PlatformRuntimeOptions`, `PlatformRuntimeServices<Runtime>`, `PlatformRuntimeBuildError<Runtime>`. |
| `node-http/subscription-signal.ts` | `nodeSubscriptionSignal({ nodeRequest?, request?, signals? })` returns `{ signal, dispose }`; `NodeSubscriptionSignalOptions`, `NodeSubscriptionSignal`. |
| `better-auth/adapter.ts` | `effectPrismaAdapter(Database, runtime, { debugLogs?, modelName?, usePlural? })`; `EffectPrismaAdapterOptions`. |
| `testing/vitest.ts` | `makePlatformIt(Database)({ adapter, createCaller, layer, extend? })`. |
| `testing/types.ts` | `MakePlatformItOptions`, `PlatformHarness`, `PlatformIt`, `PlatformTest`, `PlatformTester`. |

`PlatformRuntime` exposes `runPromise(effect, { signal? })`, `runPromiseExit(effect, { signal? })`, `runWithServices(context, evaluate)`, `contextEffect`, `currentServices()` and `dispose()`. The harness exposes native Vitest methods plus `effectApp(name, body, options?)`; its tester also has `skip`, `skipIf`, `runIf`, `only`, `each` and `fails`.

The exports also include the adapter's translation modules: `makeRowAdapter` and `RelationQuery` in `better-auth/row-adapter.ts`, `refineRelation` and `DynamicRelation` in `better-auth/relation.ts`, and `whereExpression`, `CleanedWhere`, `DynamicField` and `Expression` in `better-auth/where.ts`. Application storage setup uses `effectPrismaAdapter`.

### Install, setup and limits

```sh
pnpm add @shivaedev/platform effect@4.0.0-rc.112
```

Effect is the only required peer. The peer-free implementation lives in the shared `src/errors/` and `src/rpc/` folders and the `src/server/node-http/`, `src/server/rpc-server/` and `src/server/runtime/` folders; explicit exports retain the defining-module import paths listed above. The package-local `quality.fences.config.ts` prevents core from reaching optional peers listed in the manifest. The core errors, RPC declarations, server middleware, runtime and Node HTTP modules can be imported without the optional peers, including the Promise-based `betterAuthSessions` function. The runtime uses Node's `AsyncLocalStorage`; browser consumers import the shared `errors/` and `rpc/` modules.

Install the optional peers for the selected integration:

| Integration | Additional peers |
| --- | --- |
| `appHost.ts` | `@effect/platform-node`, `@effect/sql-pg` |
| `better-auth/adapter.ts` | `better-auth`, `@shivaedev/effect-prisma`, `@prisma-next/sql-orm-client` |
| `testing/vitest.ts` | `@effect/vitest`, `@shivaedev/effect-prisma`, `@shivaedev/effect-trpc`, `@trpc/server` |

- The package declares Node 24 or newer and uses the Effect version in its peer manifest.
- Keep the auth provider's configuration, cookie settings and resource authorization in the application. The session adapter takes only a lookup function and returns a session result; it does not write provider refresh cookies into RPC responses.
- Without an `HttpServerRequest`, `transportHeaders` falls back to the supplied RPC headers. An application using another transport must decide what headers it can trust.
- Add tracing last on the native group, as in the example, so it wraps the authentication middleware too. Middleware outside that tracing boundary is responsible for its own diagnostics.
- Redaction recognizes common shapes. Keep secrets out of messages and extend the key predicate for application-specific sensitive fields.
- A development cache key is ignored when `NODE_ENV` is `production`. The application owns runtime disposal.
- The Better Auth storage adapter's default model mapping capitalizes the model name. Supply `modelName` for a generated schema with another naming convention. Experimental native Better Auth joins are rejected.
- Package session tests use real Better Auth with ephemeral SQLite and injected HTTP; the WebSocket test uses an in-memory socket. Node signal tests simulate close events. These checks do not establish deployed browser, mobile or Bun behavior.
- The storage and harness tests require real PostgreSQL and skip without `PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL`. A skipped test supplies no transaction evidence.

For the purpose and trade-offs, read [the north star](https://github.com/ShivaeDev/platform/blob/main/packages/platform/docs/north-star.md). Implementation status and maintainer decisions live in [the package roadmap](https://github.com/ShivaeDev/platform/blob/main/packages/platform/docs/roadmap.md). The [framework request-context guide](https://github.com/ShivaeDev/platform/blob/main/docs/framework/request-context.md) explains the browser and native-client Origin choices.
