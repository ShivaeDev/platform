# @shivaedev/effect-test

You are changing the shared path from a Vitest test to a real Effect program. A test should name its work in a generator, use the services the application already has, and control time without rebuilding a runner. Prisma fixtures, tRPC callers and domain stories build on this package; their domain setup belongs to them. Usage is in [README.md](README.md), the full north star in [docs/north-star.md](docs/north-star.md), and implementation status and open questions in [docs/roadmap.md](docs/roadmap.md).

## Which way to lean

When goals conflict, they win in this order:

1. **Native Effect semantics.** Keep Context, Scope, typed failures, defects, interruption and clock selection intact. A readiness failure may be retried; a defect or interruption must escape.
2. **One runner for every fixture.** Downstream testing helpers compose `makeEffectIt` rather than copying its lifetime or clock machinery. Database transactions, transport callers and story narration stay in the package that owns them.
3. **Deliberate lifetimes.** The service Layer belongs to a worker; the harness and test run belong to one test. Shared services are not fresh application state. Preserve that distinction over convenience.
4. **Proven, readable tests.** A spec passes its generator directly, and harness and service types follow the definitions. Test observable behavior and compiler contracts before broadening a promise in the docs.
5. **A small adapter.** Keep Vitest and Effect visible. Prefer their existing machinery over another test runner or a custom lifecycle abstraction.
