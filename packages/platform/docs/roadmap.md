# Roadmap

This file owns Platform's module implementation, package tests and scope questions. The [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md) owns cross-package fixtures, application adoption and browser, mobile and deployment validation.

## Built

- [x] `localRpcGuard` rejects unknown or non-loopback transport addresses before calling the handler and accepts known IPv4, IPv6 and mapped loopback addresses. [Injected-request evidence](https://github.com/ShivaeDev/platform/blob/main/packages/platform/src/server/rpc-server/local.test.ts); this is separate from deployed host or proxy validation.
- [x] `rpcBoundary` passes declared errors and successes through, normalizes unexpected failures and defects to a declared rejection with a redacted public message, retains the original cause off the wire, and preserves interruption, including mixed failure/cancellation causes. [Boundary evidence](https://github.com/ShivaeDev/platform/blob/main/packages/platform/src/server/rpc-server/boundary.test.ts).
- [x] Shared Schema tagged errors and field-rejection extraction, with native RPC JSON and tRPC rejection tests.
- [x] Browser-safe native RPC middleware declarations and request-id, identity and optional-identity services, with compile-time checks on guarded handlers.
- [x] Request-local session middleware, a Better Auth session-provider boundary and an explicit Origin policy. Tests cover concurrent identities, anonymous callers, provider failures and rejection before provider lookup.
- [x] HTTP transport-header authentication, direct tests of the RPC-header fallback and HTTP-header precedence, and a WebSocket protocol fixture that uses upgrade-request headers instead of RPC message credentials. [Header selection evidence](https://github.com/ShivaeDev/platform/blob/main/packages/platform/src/server/rpc-server/transportHeaders.test.ts).
- [x] Request-id log/span annotations and redaction of failure payloads, defects, reported causes and credential-shaped strings, with bounded collection and string output. [Tracing tests](https://github.com/ShivaeDev/platform/blob/main/packages/platform/src/server/rpc-server/tracing.test.ts) cover successful requests and interruption without failure logs.
- [x] An application runtime that acquires its Layer once, releases it exactly once, shares an explicit development cache key and recreates disposed cache entries, bypasses caching in production, and carries service overrides across Promise calls. [Runtime tests](https://github.com/ShivaeDev/platform/blob/main/packages/platform/src/server/runtime/makePlatform.test.ts) cover typed Layer build failures, Promise rejection, signal interruption with finalization, and nested override replacement and restoration.
- [x] Node subscription cancellation from Web/procedure signals and simulated request/socket close events, with listener cleanup.
- [x] A Better Auth Effect Prisma database adapter and Prisma/tRPC rollback harness. Real PostgreSQL tests cover shared transactions, failed transaction rollback, selected row operations and harness types; they require `PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL`.
- [x] Better Auth adapter filters, ordering, pagination, projection, native-join rejection and configured model mapping have [PostgreSQL regression tests](https://github.com/ShivaeDev/platform/blob/main/packages/platform/src/server/better-auth/filterBoundaries.spec.ts).
- [x] Packed-consumer checks for defining-module imports, types and core entries installed without optional peers.
- [x] A local app host Layer and reusable database Layer, extracted from the PostgreSQL composition: migrations before services, guarded NDJSON RPC, session policy, static assets, scoped shutdown and commit-bound live delivery. The composed fixture covers two HTTP server processes and a worker. Fleet’s daemon adopts `appHost` and `appDatabase` with a custom RPC route, session-free loopback policy and its existing migration ledger. Platform’s real HTTP option tests cover hosting without a database, while Fleet’s PostgreSQL daemon tests cover pool limits, migration upgrades and existing clients.

## Next

- [ ] Add adapter coverage for the `usePlural` option.

## Open questions

- Should the package keep the optional Better Auth storage adapter and Prisma/tRPC harness beside its native request-context modules, or should those compositions live with the integration packages? Both serve real boundary work, but they give this package a wider surface than its request-identity job alone.
- If an application needs Better Auth storage on native Effect SQL, should Platform own that adapter or should the provider retain separate storage? The request middleware needs a session provider, not a particular database.
- The exports make Better Auth translation helpers importable beside the adapter. Are these helpers intended as supported consumer APIs, or should a future public API change narrow the surface to the adapter?
