# @shivaedev/effect-service

You are changing the package that defines an application's Effect services. A service declares its dependencies once, initializes private state in its Layer, and exposes methods that use those dependencies without asking each caller to provide them again. Keep that declaration as the one path for services: a native Context service and a native Layer, with ordinary Effect methods. Usage is in [README.md](./README.md), the full north star in [docs/north-star.md](./docs/north-star.md), and package work and open questions in [docs/roadmap.md](./docs/roadmap.md).

## Which way to lean

When goals conflict, they win in this order:

1. **Effect owns the semantics.** Initialization resources belong to the Layer's scope; method resources belong to the caller's scope. Keep success, failure and remaining requirements visible in public types. Do not introduce another runtime or service container.
2. **The declaration tells the truth.** Initialization and ordinary methods use the listed services, and a caller cannot replace those bound dependencies. Private state stays behind the method interface. Reject an unsupported signature instead of widening it until it appears to fit.
3. **One definition removes repeated work.** Dependencies, initialization and methods belong together. Extend `defineService` rather than creating a second declaration path or asking applications to bind dependencies by hand.
4. **Evidence before convenience.** Compiler fixtures must reject invalid definitions as well as accept valid ones. Runtime tests must prove resource ownership and binding; a type assertion alone does not prove cleanup or failure behavior.
5. **Keep the helper small.** Service methods own application behavior. Repositories, transactions, operation contracts and transports stay in their packages; this package makes their dependencies explicit.
