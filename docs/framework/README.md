# Native Effect application framework

Platform gives an Effect application one path from its data schemas to services,
persistence, operations and client state. Shared conventions remove repeated
wiring while keeping native Effect dependencies, errors, scopes and interruption
visible.

Schema describes data once. Services implement behavior, repositories execute
SQL, and native RPC connects ordinary results and typed failures to atom-based
queries, actions and editable forms. Applications own authorization policy,
user-facing text, layout and deployment choices.

## The application path

| Job | Package | Boundary |
| --- | --- | --- |
| Declare services | [effect-service](../../packages/effect-service/README.md) | Declare dependencies and initialization; native Context and Layer own composition. |
| Persist data and run migrations | [effect-sql](../../packages/effect-sql/README.md) | Derive common operations from native models; use explicit SQL for unusual queries. |
| Announce committed changes | [effect-changes](../../packages/effect-changes/README.md) | Record changes at a commit boundary; applications choose their meaning and delivery. |
| Declare queries and commands | [effect-contract](../../packages/effect-contract/README.md) | Describe payloads, results, rejections and read keys; native RPC owns handlers and transport. |
| Resolve identity and share errors | [platform](../../packages/platform/README.md) | Use its errors, RPC middleware and server modules; applications decide session and Origin policy. |
| Render queries and invoke actions | [effect-react](../../packages/effect-react/README.md) | Bind native atoms to React; applications own registry and session lifetime. |
| Edit and submit data | [effect-form](../../packages/effect-form/README.md) | Keep encoded field input and decode for submission; applications supply UI and save effects. |
| Run durable jobs | [effect-pg-boss](../../packages/effect-pg-boss/README.md) | Integrate pg-boss with Effect services; applications choose queue and retry policy. |
| Test Effect code | [effect-test](../../packages/effect-test/README.md) | Compose test Layers and Vitest; applications supply the real services under test. |
| Tell tests as stories | [test-story](../../packages/test-story/README.md) | Put shared engine setup in a kit and feature setup in traits; a spec tells its own story. |

The Prisma and tRPC integrations serve applications using those stacks:
[effect-prisma](../../packages/effect-prisma/README.md) integrates Prisma Next,
[effect-changes-prisma](../../packages/effect-changes-prisma/README.md) binds
commit-bound changes to Prisma Classic on PostgreSQL, and
[effect-trpc](../../packages/effect-trpc/README.md) integrates tRPC procedures.
Choose the package for the stack the application actually uses.

## Design priorities

Native Effect comes first, then one path per job, then proven behavior, then
speed. Add a helper when a real feature repeats wiring and the helper leaves the
native pieces accessible. Preserve typed failures, cancellation, transaction
ownership and authorization across its boundary.

Author fields and codecs with Effect Schema and native model variants. Start
repositories with model-derived CRUD and demonstrated common queries. Explicit
SQL with composed schemas remains useful for joins, aggregates and other unusual
queries; the framework does not require a second authored ORM model or a general
database language.

Return ordinary values from queries and commands. Request/response plus
invalidation is the default. Optional live hints tell a client to query again;
applications choose delivery across processes from their deployment needs.
Reuse native migration execution and the durable job system. Keep application
authorization, UI wording and layout, native device behavior and offline conflict
policy in applications.

Event sourcing, projection replay, mandatory streaming, a second cache and
automatic relationship loading are outside the default path.

## Composing a feature

The [order-editing example](./order-example.md) follows a feature from declared
services and a repository through authenticated HTTP RPC to query state and an
editable form. Read it for the composition; use each package's README for its
mental model and API.

- [Native RPC](./native-rpc.md) explains handlers, middleware and transport.
- [Request context](./request-context.md) explains session resolution, Origin
  policy and redacted request diagnostics.
- [Commit-bound changes](./changes.md) connects transaction bindings to
  application change vocabularies.
- [Live updates](./live-updates.md) composes optional hint streams with native
  query invalidation.
- [Editing](./editing.md) connects queries, forms and saves.
- [Migrations](./migrations.md) and [PostgreSQL migration boundaries](./postgres-migrations.md)
  explain authoring and runner ownership.

## What counts as evidence

A useful feature fixture calls actual services through actual boundaries. It
checks values and typed failures, rollback, cancellation and release, refetching,
and preservation of edits while fresh data arrives. Source-local tests and
installed-package consumers answer different questions, so both matter.

PostgreSQL, authenticated HTTP, SSR isolation, browser lifecycle and native device
behavior each need their own evidence. SQLite and DOM fixtures establish only
the paths they execute. PostgreSQL tests that skip without their database URL
establish no database behavior. The [boundary validation guide](./boundary-validation.md)
links the executable fixtures and describes their limits.

The [framework roadmap](./roadmap.md) owns composed-feature and application-host
work. Each package's `docs/roadmap.md` owns its implementation and open questions.
Status belongs in those roadmaps.
