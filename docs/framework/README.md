# Native Effect application framework

Start a new app with the [quickstart](./quickstart.md) and [copyable starter](../../examples/starter).

An application depends on [`@shivaedev/platform`](../../packages/platform/README.md), which brings every runtime package below. For development it takes `@shivaedev/test-story`, which brings `test` and `test-sql`, and `@shivaedev/quality`. It imports each module from the package that owns it, by that package's name; the table names the owner of each job.

Platform gives an Effect application one path from its data schemas to services, persistence, operations and client state. Shared conventions remove repeated wiring while keeping native Effect dependencies, errors, scopes and interruption visible.

Schema describes data once. Services implement behavior, repositories execute SQL, and native RPC connects ordinary results and typed failures to atom-based queries, actions and editable forms. Applications own authorization policy, user-facing text, layout and deployment choices.

## The application path

| Job | Package | Boundary |
| --- | --- | --- |
| Declare services | [service](../../packages/service/README.md) | Declare dependencies and initialization; native Context and Layer own composition. |
| Persist data and run migrations | [sql](../../packages/sql/README.md) | Derive common operations from native models; use explicit SQL for unusual queries. |
| Announce committed changes | [changes](../../packages/changes/README.md) | Repositories announce table and row keys at commit; command declarations name additional dependencies. |
| Declare queries and commands | [contract](../../packages/contract/README.md) | Describe payloads, results, rejections, query read policies and record or bucket scopes; native RPC owns handlers and transport. |
| Share expected failures | [errors](../../packages/errors/README.md) | Use the shared failure taxonomy and field rejections on both sides of RPC; redact sensitive values before they reach logs or traces. |
| Resolve identity and permissions | [identity](../../packages/identity/README.md) | Use its RPC middleware and server modules; applications decide session, Origin and permission policy. |
| Declare roles and their grants | [access](../../packages/access/README.md) | Declare which permissions each role grants once; identity enforces the grants on the server and react guards routes with them. |
| Receive signed webhooks | [webhooks](../../packages/webhooks/README.md) | Verify raw deliveries and record receipts with queued jobs in one SQL transaction; applications register sources, schemas and workers. |
| Call outside HTTP APIs | [http](../../packages/http/README.md) | Use the native HTTP client with its typed failures, pagination and bounded bodies; applications own retries and credentials. |
| Host the application | [server](../../packages/server/README.md) | Compose the app host, health, tracing export, migrations and development mode; applications supply their RPC groups and routes. |
| Render queries and invoke actions | [react](../../packages/react/README.md) | Bind native atoms to React; session boundaries own registries and live connections. |
| Route React screens | [react/queryRoute.ts](../../packages/react/README.md#route-loaders-with-tanstack-router) | TanStack Router owns routing; loaders read contract query atoms in the shared registry and expose tagged failures to route error components. |
| Edit and submit data | [form](../../packages/form/README.md) | Keep encoded field input and decode for submission; applications supply UI and save effects. |
| Run durable jobs | [jobs](../../packages/jobs/README.md) | Integrate pg-boss with Effect services; applications choose queue and retry policy. |
| Author administrator pages | [admin](../../packages/admin/README.md) | Register native contracts behind each page's declared domain permission; applications own React views on the existing RPC transport. |
| Test Effect code | [test](../../packages/test/README.md) | Compose test Layers and Vitest; applications supply the real services under test. |
| Isolate PostgreSQL tests | [test-sql](../../packages/test-sql/README.md) | Prepare migrations and fixtures once; use rollback or cloned databases for real commits. |
| Tell tests as stories | [test-story](../../packages/test-story/README.md) | Put shared engine setup in a kit and feature setup in traits; a spec tells its own story. |

## Secure invite codes and tokens

Use Effect's native `Crypto` service from `effect/Crypto` for secure values. The application host supplies the Node implementation, including during preflight and deferred application construction. It provides secure random bytes and numbers, UUIDv4/v7 and digests; Platform adds no wrapper. Use Effect's `Random` for non-secure choices such as sampling or jitter.

```ts
import { Effect } from "effect";
import { Crypto } from "effect/Crypto";
import * as Hex from "effect/encoding/Hex";

const inviteCode = Effect.gen(function* () {
  const crypto = yield* Crypto;
  return Hex.encode(yield* crypto.randomBytes(8));
});
```

Use `inviteCode` in the command that issues an invite, handling its typed failures through the command’s declared errors. This produces a short, 16-character hexadecimal invite code. Choose the byte count and expiry policy for the application's use. Story kits supply native `TestCrypto` with seed `0`, restarted for each story, so the same command can have an exact token assertion. Test values are deterministic and belong only in tests.

## Design priorities

Native Effect comes first, then one path per job, then proven behavior, then speed. Add a helper when a real feature repeats wiring and the helper leaves the native pieces accessible. Preserve typed failures, cancellation, transaction ownership and authorization across its boundary.

Author fields and codecs with Effect Schema and native model variants. Start repositories with model-derived CRUD and demonstrated common queries. Explicit SQL with composed schemas remains useful for joins, aggregates and other unusual queries; the framework does not require a second authored ORM model or a general database language.

Return ordinary values from queries and commands. Database hosts deliver commit-bound change hints across processes, and React session boundaries connect bound queries automatically. Each live query declares its own read policy and record or bucket scope. A list with extra filters still reruns for any change in its bucket. The session supplies the viewer, and the same policy guards reads and subscriptions. `@shivaedev/changes/keys.ts` owns the keys writers and subscribers share. Queries remain the source of current values; explicit live APIs support other transports and lifecycle owners.

Reuse native migration execution and the durable job system. Keep application authorization, UI wording and layout, native device behavior and offline conflict policy in applications.

Event sourcing, projection replay, mandatory streaming, a second cache and automatic relationship loading are outside the default path.

## Composing a feature

Follow [Add a resource to the starter](./add-a-feature.md) to build a feature in order, from a migration and Model through the service, contract, host, route and form to PostgreSQL and DOM tests. Each step points to the starter's notes implementation.

The [starter quickstart](./quickstart.md) begins with a runnable app. The [PostgreSQL order feature](./composed-example.md) is the larger reference composition: Schema, migrated SQL, a declared service, authenticated native HTTP RPC, atoms, an editor and a live hint reaching a second client after commit. Use each package's README for its mental model and API.

- [Native RPC](./native-rpc.md) explains handlers, middleware and transport, including the [one path for public client configuration](./native-rpc.md#public-client-configuration): a shared Schema, startup-loaded public fields and a react query without an application-written RPC.
- [Request context](./request-context.md) explains errors, session resolution, Origin policy and redacted request diagnostics; [BetterAuth at the RPC boundary](./auth-boundary.md) shows the session provider.
- [Commit-bound changes](./changes.md) connects transaction bindings to application change vocabularies.
- [Live updates](./live-updates.md) explains default query refresh and explicit hint-stream coordination.
- [Editing](./editing.md) connects queries, forms and saves; [client lifetime](./client-lifecycle.md) ties the client registry to the authenticated session.
- [Entity settings](./entity-settings.md) composes typed defaults, an authorized query, transactional upserts and a live form editor without a new helper.
- [Cancellation](./cancellation.md) covers interruption from React actions to Node requests.
- [Migrations](./migrations.md) and [PostgreSQL migrations](./postgres-migrations.md) explain authoring and runner ownership.
- [Cross-table reads](./cross-table-reads.md) composes repository model fields with native `SqlSchema` for service-owned joins.
- [PostgreSQL codecs](./postgres-codecs.md) and [constraint failures](./constraint-errors.md) cover the database value boundary.

## What counts as evidence

A useful feature fixture calls actual services through actual boundaries. It checks values and typed failures, rollback, cancellation and release, refetching, and preservation of edits while fresh data arrives. Source-local tests and installed-package consumers answer different questions, so both matter. PostgreSQL, authenticated HTTP, SSR isolation, browser lifecycle and native device behavior each need their own evidence.
