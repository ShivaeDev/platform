# Roadmap

This file owns Platform's module implementation, package tests and scope questions. The [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md) owns cross-package fixtures, application adoption and browser, mobile and deployment validation.

## Built

- [x] Shared Schema tagged errors and field-rejection extraction, with native RPC JSON and tRPC rejection tests.
- [x] Browser-safe native RPC middleware declarations and request-id, identity and optional-identity services, with compile-time checks on guarded handlers.
- [x] Request-local session middleware, a Better Auth session-provider boundary and an explicit Origin policy. Tests cover concurrent identities, anonymous callers, provider failures and rejection before provider lookup.
- [x] HTTP transport-header authentication and a WebSocket protocol fixture that uses upgrade-request headers instead of RPC message credentials.
- [x] Request-id log/span annotations and redaction of failure payloads, defects, reported causes and credential-shaped strings, with bounded collection and string output.
- [x] An application runtime that acquires its Layer once, shares an explicit development cache key and carries service overrides across Promise calls.
- [x] Node subscription cancellation from Web/procedure signals and simulated request/socket close events, with listener cleanup.
- [x] A Better Auth Effect Prisma database adapter and Prisma/tRPC rollback harness. Real PostgreSQL tests cover shared transactions, failed transaction rollback, selected row operations and harness types; they require `PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL`.
- [x] Packed-consumer checks for defining-module imports, types and core entries installed without optional peers.

## Next

- [ ] Add focused runtime tests for production cache bypass, disposal and recreation, build failures, exit results and cancellation before documenting stronger lifecycle guarantees.
- [ ] Extend adapter tests to the remaining public options and filter, selection, ordering and pagination paths. Add a regression test for the rejection of experimental native joins.
- [ ] Exercise the no-HTTP-request `transportHeaders` fallback directly and the tracing boundary's successful and interrupted paths.

## Open questions

- Should the package keep the optional Better Auth storage adapter and Prisma/tRPC harness beside its native request-context modules, or should those compositions live with the integration packages? Both serve real boundary work, but they give this package a wider surface than its request-identity job alone.
- If an application needs Better Auth storage on native Effect SQL, should Platform own that adapter or should the provider retain separate storage? The request middleware needs a session provider, not a particular database.
- The export pattern makes Better Auth translation helpers importable beside the adapter. Are these helpers intended as supported consumer APIs, or should a future public API change narrow the surface to the adapter?
