# Native Effect application framework

Build a small, coherent application layer around Effect: Schema describes data,
services compose behavior, repositories execute through Effect SQL, and native RPC
connects those services to concise atom-based query, action, and form APIs.

The aim is a reusable default for Effect applications. Application
code should have one model vocabulary and preserve Effect's dependency, error,
resource, and cancellation semantics. Shared conventions should reduce repeated
code while leaving ordinary Effects and native components accessible.

The [roadmap](./roadmap.md) records the work and acceptance criteria. The first foundation slice is implemented and passes `pnpm ready`, including
installed-package checks and real PostgreSQL tests. The broader application
integration remains open; the inventory below describes capability provenance,
not completion. See the roadmap for the current implementation status.

## Design boundaries

- Author field types and codecs with Effect Schema. Use native model variants for
  generated and writable fields where possible. Avoid a second authored ORM model
  or an adapter into another query builder's mental model.
- Begin repositories with model-derived CRUD and a narrow set of common queries.
  Explicit SQL with composed schemas is acceptable for unusual queries. A general
  database language and automatic relationship loading are not prerequisites.
- Return ordinary values from actions and queries. No event journal, replay,
  sequence-number protocol, or event-sourcing requirement enters the framework.
- Reuse native RPC and AtomRpc. Request/response plus invalidation is the default;
  streaming is optional. Introduce wrappers only where they remove demonstrated
  application boilerplate without weakening types or lifecycle behavior.
- Reuse native migration execution and existing durable job infrastructure.
  Package authoring conventions and application integration before adding engines.
- Keep UI layout, user-facing text, authorization policy, and native device
  behavior in applications. Shared helpers must support the desired UX without
  forcing desktop-only or always-connected assumptions.

## Capability inventory

These bars classify five capability slices per area. They are **not percentages
of implementation effort, completion, or production readiness**. Each area can
still require integration and validation even when its foundation exists.

Legend: **E** native Effect · **A** Antumbra extraction candidate · **P** existing
Platform · **B** build/integrate · **D** research, product-specific, or defer.

| Area | Capability slices | Existing foundation | Remaining framework work |
| --- | --- | --- | --- |
| Services and runtime | `E E E A P` | Services, Layers, scopes, cancellation; Antumbra declarations; Platform runtime | Consolidate declaration ergonomics and version/lifetime contracts |
| Schemas and operations | `E E A A B` | Schema and model variants; Antumbra rows and operation declarations | Ordinary result/error contracts without journal semantics |
| SQL and repositories | `E E A B B` | SqlClient transactions; SqlModel CRUD; Antumbra codecs | Narrow typed querying, supported storage codecs, constraint errors |
| Migrations | `E E E B D` | Native runner, ledger, loaders and transaction handling | Authoring/CLI conventions; choose additional policies only when needed |
| RPC | `E E A B B` | Native contracts, clients, middleware and cancellation; declaration derivation | Ordinary handler composition and application transports |
| Authentication and context | `E P P B B` | Context/middleware; Platform request services and auth integration | Native SQL auth boundary and application session/authorization wiring |
| Client queries and actions | `E E A B B` | AtomRpc queries, mutations, invalidation and TTL; Antumbra hooks | Small React facade and explicit cache policy |
| Freshness and live updates | `E A B B D` | Reactivity; Antumbra read keys and after-commit invalidation | Non-journal invalidation, optional streams, deployment delivery policy |
| Loading, errors and optimistic UX | `E A A B D` | AsyncResult/optimistic primitives; retained data and pending UI | Consistent error affordances and product-level behavior verification |
| Forms and drafts | `E A A A B` | Schema validation; Antumbra fields, submission state and draft preservation | Generic extraction and representative application forms |
| SSR, browser and mobile lifecycle | `E E B D D` | Atom hydration, scopes and focus refresh | Per-request/session wiring and native lifecycle validation |
| Testing | `E P A B D` | Effect testing; Platform test package; Antumbra composed harness | Native repository/RPC/UI fixture and actual deployment checks |
| Jobs and external integrations | `E P P B D` | Scheduling/resources; Platform pg-boss payloads and worker lifecycle | Service boundary conventions and product-native behavior |
| Tracing and diagnostics | `E E A B B` | Effect spans/logs/metrics and retained context; Antumbra sink | Correlation, export, redaction and operational presentation |

## Initial package shape

- `@shivaedev/effect-service`: typed service declarations over native Context and
  Layer, preserving method errors and caller-owned scopes.
- `@shivaedev/effect-form`: Schema-derived form and draft state, with optional
  React bindings.
- `@shivaedev/effect-react`: concise query/action bindings over native atoms and
  AtomRpc, preserving their lifecycle and result semantics, plus the
  session-generation `SessionBoundary` and `resumeSignal`. Its
  `@shivaedev/effect-react/form` subpath adds `useEditor` and `useCreate` over
  effect-form, which stays an optional peer for the root entry.
- `@shivaedev/platform/errors`, `/rpc` and `/rpc-server`: the shared error
  taxonomy, request identity middleware tags, and their server implementations
  (transport-header session resolution, Origin policy, redacted tracing).
- `@shivaedev/effect-changes`: commit-bound change channels. Changes recorded
  inside a transaction publish once, deduplicated, after the owner's outermost
  commit; rollbacks publish nothing. It imports only `effect` and has no SQL or
  ORM dependency ([commit-bound changes](./changes.md)).
- `@shivaedev/effect-changes-prisma`: an effect-changes channel bound to Prisma
  Classic's interactive `$transaction`, with changes recorded from writes
  through a typed model map and a test-time coverage check over
  `pg_stat_xact_user_tables`.
- `@shivaedev/effect-sql`: small native SQL/model repository helpers and
  `transact`, an effect-changes channel that invalidates Reactivity keys only
  after the outermost commit. Database engine behavior remains with Effect SQL.
- `@shivaedev/effect-test`: strengthen the existing test runtime and use it to
  prove composition, including deterministic clock behavior.
- `@shivaedev/effect-contract`: query and command declarations that become native
  `Rpc`/`RpcGroup` definitions, with typed rejections and reactivity keys, plus a
  browser-safe binding over native AtomRpc. Handlers, middleware, transports and
  the atom cache stay native. The order example established the need.

Existing Prisma, tRPC, auth and job integrations continue to have consumers. The
new packages can be developed and validated independently; adopting them in an
application is a separate change with its own behavior checks.

## Composed example

The [order-editing example](./order-example.md) adds service declarations, encoded
form fields, request authentication and real HTTP serialization to the initial
repository/RPC/atom fixture. Its guide links the feature code and the behavioral
tests; it also records the remaining application-specific boundaries.

The [editing guide](./editing.md) covers `useEditor` and `useCreate`.

The [boundary validation guide](./boundary-validation.md) covers PostgreSQL
codecs and migrations, real BetterAuth sessions, action interruption and Node
abort signals, client teardown and form submission/refresh behavior.

## What establishes success

A small application feature should declare its schemas once, implement an Effect
service, persist through a repository, expose native RPC, and render a query plus
an editable form. Types must remain precise across those boundaries. Tests must
exercise that actual composition, including failure, cancellation, transaction
rollback, refetching, and preserving edits while fresh data arrives.

PostgreSQL behavior, authenticated requests, SSR isolation, and mobile lifecycle
need their own evidence. Passing an in-memory or DOM fixture does not establish
those guarantees. Package completion requires the repository readiness checks and
a usable installed-package surface, not only source-local tests.
