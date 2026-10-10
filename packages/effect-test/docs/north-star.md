# North star

## The problem

An Effect test needs more than a Promise runner. It needs the application's services, a scope for work that must be released, a clock it can control and a way to wait for a typed readiness condition. When each database or transport fixture writes that machinery, small differences become differences in correctness: a clock advances in one helper but waits in another, a retry catches a defect, or a service is acquired at the wrong lifetime.

The package gives those fixtures one runner. A test names its work as a generator, and a fixture supplies its Layer and the value the test receives. The test still uses Effect's services, failure channel and clock, and Vitest still declares and reports the test.

## The ideal

A test contains the work specific to that test. Shared service acquisition, per-test harness construction and an optional wrapper are defined once in test support. A plain Effect test needs no custom fixture: its generator goes directly to `it.effect` or `it.live`.

The boundary between worker and test is explicit. A worker owns the acquired service Context, while a test owns its harness and execution scope. A shared database service does not imply fresh database contents, and a fresh harness does not imply a freshly acquired service. The fixture that owns application state chooses how to reset or transact it.

Time is part of the Effect environment. A controlled test clock makes a readiness poll cheap and inspectable; live time remains an explicit choice for work that needs it. A typed readiness failure means “try again”. A defect means something broke, and interruption means the run must stop. These are different outcomes and the runner must keep them different.

## What good looks like

- A generator reaches the application's real services instead of converting them into a separate testing API.
- A Layer, a harness and a wrapper are enough to define a reusable fixture. Their types are inferred, and a body cannot silently ask for a service the fixture does not provide.
- Resource lifetimes are visible in the design and backed by tests at the boundaries where this package adds behavior.
- Clock selection does not imply control over resources that were acquired in a different environment.
- A failed assertion is retried only when the author explicitly makes it a typed, retryable failure.
- Downstream fixture authors reuse the runner and own their domain setup.

## Trade-offs

When goals conflict, preserve native Effect semantics first, keep one runner second, preserve deliberate worker and test lifetimes third, prove readable behavior fourth, and keep the adapter small fifth.

**Shared acquisition costs less and requires state discipline.** A worker Layer avoids rebuilding expensive services for every test. That places application-state isolation in the fixture that understands the state. Adding a hidden reset would conceal the lifetime rather than solve it.

**Controlled time and live time solve different problems.** A test clock helps a test advance the Effects in its environment. It does not make external timers or a worker's already-running fibers deterministic. Prefer a precise limit over a broad promise of determinism.

**Composition keeps responsibility local.** An `around` wrapper can establish a transaction or tracing boundary for the harness and body. This package owns how the wrapper fits the runner; the package that supplies a transaction owns its rollback semantics.

**Types are a contract, not runtime evidence.** Compiler tests establish which requirements, harness fields and table cases a body may use. Runtime tests establish what runs, when it runs and which failure escapes. Neither substitutes for the other.

## What it leaves out

- Database rollback, migrations, seeded application state and transport caller construction. Those belong to their integrations or application test support.
- Domain traits, verbs, engine stepping and story failure narration. `@shivaedev/test-story` owns that layer above this runner.
- A replacement for Vitest's reporting, selection or configuration, or for Effect's Context, Scope and scheduling.
- Evidence of real HTTP, PostgreSQL, browser or deployment behavior from a controlled-clock unit test. Composed examples and host-boundary validation belong to the framework.
