# North star

## The problem

A durable job crosses two boundaries at once. Data leaves the producer's process and is read later by a worker; execution leaves the request's Effect context and is called later by pg-boss. When applications bridge those boundaries by hand, they repeat payload validation, dependency capture, queue registration and shutdown logic. A producer can drift from its worker's payload shape, a worker can rebuild services differently from the rest of the application, and a client can outlive the scope that should own it.

The package exists to make that boundary one reusable path. pg-boss remains the PostgreSQL queue engine. Effect remains the application's language for services, errors and resources. The adapter should join those pieces without making the application learn another execution model.

## The ideal

A feature declares one object Schema for a queue, then attaches an ordinary Effect handler. The producer uses its decoded type; the durable boundary uses its encoded type; the handler receives decoded data. Domain code never has to guess what an old or malformed stored payload means.

A scheduled feature declares a name and cron expression, then attaches a payload-free Effect. Queue workers and scheduled workers become one list of registrations at the application's runtime boundary. The application's jobs Layer supplies the workers' services and owns the client that pg-boss calls through.

An application that needs only queueing should not import a repository framework, transport or UI package. A worker that needs application services should declare them through ordinary Effect requirements. The jobs adapter should preserve those requirements rather than hiding them in a global runtime or making each callback rebuild its dependencies.

## What good looks like

- The payload contract is authored once, including transformations between application and durable representations.
- Invalid stored data is rejected before the worker's domain handler executes.
- Worker services are supplied where the jobs Layer is built, and their requirements remain visible to TypeScript.
- The client starts under an Effect scope. Startup failure, registration failure and scope release have a clear resource owner.
- Client reuse is requested with a key. Applications choose the environments and registrations that should share a client.
- pg-boss options remain pg-boss options. The package removes repeated boundary plumbing, not the engine's vocabulary.
- Operational observations are data, such as queue counts; an application decides what those observations mean for its health endpoint and alerts.
- Documentation distinguishes a fake client's observed calls from durable behavior demonstrated against PostgreSQL.

## Trade-offs

**The durable contract wins over permissive input.** A queue Schema must describe object data on both sides. A malformed payload should not become a partially trusted value in domain code merely to keep a worker running.

**Explicit dependencies win over callback convenience.** The jobs Layer requires the services its handlers use. Adding a hidden runtime or service locator would make a worker shorter while moving its real dependencies out of the type system.

**Resource ownership wins over reuse.** Sharing a client can avoid duplicate starts across Layer builds, but a cache key is an application choice. It must not become a reason to ignore cleanup or silently infer environment policy.

**A thin boundary wins over orchestration features.** pg-boss already owns queue execution and scheduling. A new helper earns its place by removing repeated application code at the Effect boundary, with tests for the semantics it preserves.

**Proven behavior wins over a broader pitch.** Passing `retryBackoff: true` proves registration supplied that option. It does not prove retry timing. A fake client cannot establish a PostgreSQL delivery guarantee, and a PostgreSQL library test cannot establish application adoption or deployment behavior.

## What it deliberately leaves out

- A replacement for pg-boss storage, cron interpretation, queue policy or retry execution.
- Domain workers, authorization rules, external-provider interfaces and application logging or health policy.
- Another general service declaration system; native Context and Layer stay available, and general declaration ergonomics belong to `effect-service`.
- Application repositories or migration ownership; those belong to `effect-sql`.
- An implicit link between enqueueing and an application's database transaction. Transaction and outbox policy remain application decisions; after-commit changes have their own path through `effect-changes`.
- A promise of exactly-once domain side effects or provider idempotency. Those need application-specific decisions and evidence.
- Browser, device or offline synchronization behavior. A PostgreSQL queue boundary cannot establish those product contracts.
