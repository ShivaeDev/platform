# North star

## The problem

A service can express its work clearly in Effect and still lose that clarity at its boundary. An HTTP request arrives with cookies and headers; native RPC supplies middleware arguments; an authentication provider returns a Promise; a database transaction replaces a service for one invocation; and a test must reach all of them together. Rebuilding that glue in each application gives the same concepts different names and leaves room for differences that matter: credentials taken from an RPC message, a shared Layer holding one user's identity, an outage mistaken for a missing session, or a Promise call escaping the test's transaction.

Callers also need a common language for expected failures. A field rejection should arrive with its field and message, while a defect should remain a defect and diagnostics should not expose its credentials. Neither concern belongs in each feature's business logic.

## The ideal

An application declares errors and native RPC middleware in modules its browser can import. The server supplies a session provider and an explicit Origin policy, and a handler reads a small request-local identity service. It then makes its own resource-authorization decision. The same request id identifies the invocation in its handler, logs and span.

A Promise boundary uses the application's runtime and its invocation's services. A long-lived Node response has one cancellation signal and an explicit cleanup function. An application using Better Auth with Effect Prisma can store its auth rows through that runtime. An application using Prisma and tRPC can set up its test composition once and write feature tests against the caller and database in one rollback transaction.

These are separate entry modules. The core request/error/runtime work should require Effect alone. Optional storage and test composition should load their own peers only when selected.

## Which trade-offs win

1. **Native Effect semantics.** Typed failures, invocation-local services, interruption and transaction scope matter more than a short integration example. A convenience must not hide a boundary that its caller needs to reason about.
2. **An explicit source of trust.** HTTP authentication and Origin decisions use transport headers, not values an RPC message can override. The request id is correlation data a caller may choose; it must not become an authorization credential. A provider outage must remain distinct from an anonymous caller.
3. **One owner for each job.** Platform supplies shared request services and the glue across boundaries. Native repositories belong to effect-sql, declarations to effect-contract, services to effect-service and generic test execution to effect-test. The optional adapters compose effect-prisma and effect-trpc rather than implementing them again.
4. **Useful evidence and diagnostics.** Describe the composition a test actually runs. A bounded redactor can reduce common credential leaks; it cannot decide every application's sensitive fields or justify putting secrets in messages. Keep application-specific data policy explicit.
5. **Small conveniences.** A provider function, a Layer and a defining-module import are preferable to a second configuration language or application container. Add a helper when it removes repeated work while leaving the native pieces visible.

## What the package deliberately leaves out

- Authentication-provider selection, OAuth configuration, cookies, session lifetimes and client refresh policy.
- Resource ownership and role checks. An authenticated user id is input to authorization, not permission to access every resource.
- Application transports, CORS configuration, subscription limits, event buses and deployment policy.
- A native SQL auth storage choice. Session resolution can use a provider without making its storage part of the application's repository model.
- A second service container, RPC framework, persistence model or generic test runner.
- Guarantees about SSR isolation, mobile cookie persistence or a particular Node/Bun host inferred from local fixtures.

## Where planning belongs

[The package roadmap](roadmap.md) owns changes to these modules, their evidence and the maintainer's scope decisions. [The framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md) owns composed fixtures, application adoption and deployment validation across packages.
