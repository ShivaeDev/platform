# @shivaedev/service

You are changing the package that defines Effect services, for Platform's packages and for every application built on it. A service declares once what it requires, and every operation inherits those dependencies, so no caller provides them per call. Its operations are ordinary `Effect.fn` exports that `yield*` what they need, and its Layer is its lifetime. Keep `defineService` as the one path for services: a native Context service and a native Layer, with ordinary Effect operations. Usage is in [README.md](./README.md).

## The service model

Every service follows this model. When one cannot, the model is missing a service or pattern; add it rather than an exemption.
1. **Requirements are declared once.** `requires` lists every service the operations use, and the Layer binds them. Callers never provide a service's dependencies per call.
2. **Dependencies come from the environment.** Operations `yield*` repositories, `SqlClient`, HTTP clients, config and other services. A dependency never arrives as a parameter, a closure capture or a bundle.
3. **The caller comes from the environment.** The host provides who asked (`SessionUser`, `Subject`, `Identity`) and their credentials for each execution, and code that needs the caller yields it. Operations never take the acting user's id as an argument; a target id, such as the account an administrator acts on, is an ordinary argument.
4. **A Layer is the lifetime.** A service is global, per request or fresh per use, chosen where its Layer is registered. A per-request service may cache within its request.
5. **`initialize` holds only state the service owns for its lifetime:** caches, refs, locks, and values captured from its context at setup, such as the caller a per-request service captures. State never holds a dependency.
6. **A factory that reaches a dependency marks a gap.** When reaching a dependency seems to need a closure or factory, add the missing service or pattern instead.
7. **Transactions wrap only writes that must commit together.** A write and the job it enqueues are such a case, because jobs' `enqueue` joins the open SQL transaction on the same connection.
8. **One operation per file.** Each operation is an `Effect.fn("Service.operation")` export in the service's folder, beside its `service.ts`.

The requirement binder is the deliberate runtime bridge in `src/adapters/defineService.ts`; keep context capture and binding there so service definitions expose only declared requirements.

## Which way to lean

When goals conflict, they win in this order:
1. **Effect owns the semantics.** Initialization resources belong to the Layer's scope; operation resources belong to the caller's scope. Keep success, failure and remaining requirements visible in public types. Do not introduce another runtime or service container.
2. **The model holds.** A change that makes a dependency or the caller easier to pass than to yield is the wrong change, however convenient.
3. **The declaration tells the truth.** Initialization and operations use the listed services, and a caller cannot replace those bound dependencies. Owned state stays behind the operation interface. Reject an unsupported signature instead of widening it until it appears to fit.
4. **Evidence before convenience.** Compiler fixtures must reject invalid definitions as well as accept valid ones. Runtime tests must prove resource ownership and binding; a type assertion alone does not prove cleanup or failure behavior.
5. **Keep the helper small.** Operations own application behavior. Repositories, transactions, operation contracts and transports stay in their packages, and the host decides a service's lifetime by where it registers the Layer. This package adds no retries, scheduling or domain behavior to every operation.
