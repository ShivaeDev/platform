# The north star

## The problem

A tRPC application has a Promise boundary at every procedure. An Effect application has a different set of obligations inside that boundary: a service must be provided, a typed failure must remain distinguishable from a defect, a request must carry its own identity, and a scoped resource must live until its work ends. Handwritten adapters repeat this work at every feature and make it easy to weaken one obligation while fixing another.

The package gives tRPC applications one small bridge. An application supplies its runtime once. A request Layer turns the context tRPC middleware produced into Effect services. A procedure yields those services and returns a value or a Stream. Schema describes the data boundary; an explicitly declared rejection describes the failure data a client can understand.

This is the integration path for applications that use tRPC. Native Effect queries and commands belong to `effect-contract`; native request identity and server middleware belong to the `platform` RPC modules. Sharing a rejection schema across transports is useful. Making tRPC a requirement of the native framework is not.

## What good looks like

### Effects keep their meaning

A procedure's generator is ordinary Effect work. Its service requirements must be supplied by the application runtime or request Layer; unavailable requirements must not disappear into a cast. Schema's encoded and decoded sides stay visible to both the caller and resolver. Input and output are decoders, so the resolver sees decoded input and produces encoded output.

Resources keep the lifetime their work needs. A query or mutation has request work; a subscription has a Stream whose consumption owns its resources. Interruption belongs to that work too. Tests observe both the interruption and the finalizer, not just a returned cancellation error.

### Requests and failures cross deliberately

A tRPC context value becomes a service in a request Layer. Middleware remains the place to establish or refine that context. The adapter does not invent an authentication policy, a global current user or a second request-context vocabulary.

Failure data crosses only by an explicit choice. A declared Schema rejection is data a client may decode and act on. A `TRPCError` is an explicit transport response. An application mapper may expose another known error. An unlisted failure or defect is an internal error, not an accidental serialization of database or infrastructure details.

An invalid input and an application rejection are different events. The formatter's reserved `invalidInput` mark allows a client to distinguish them while keeping field-error data in one location. Declared failures must not be able to forge that mark.

### tRPC and Effect remain recognizable

tRPC owns routers, middleware, metadata and host transports. Effect owns services, Layers, Streams and the error channel. The adapter removes repetitive conversion at their boundary; it does not replace either side with its own framework.

Tests use the router's real caller and an Effect-shaped view of it. Application fixtures can surround that caller, and test services can replace matching runtime services. The shared `effect-test` runner owns clocks and test lifecycle so this package does not maintain another implementation of them.

## Trade-offs

The order is Effect types, scope and interruption; deliberate request and error boundaries; tRPC interoperability; then convenience. A helper that saves a few lines but makes unavailable services compile or lets a Stream outlive its resource scope loses. A richer public error that has not been declared loses to a redacted error. A feature needing tRPC middleware should use that middleware before adding another hook to this package.

Test coverage limits the wording of guarantees. In-process HTTP serialization is valuable evidence for rejection encoding, but it cannot establish a production proxy's disconnect behavior. A caller signal and finalizer test establishes that path, not all hosts and transports. Application adoption and deployment validation stay with the framework and consuming application.

## What stays outside

- A replacement for native `effect-contract` queries and commands.
- A router, HTTP server, WebSocket server or transport selection policy.
- Authentication, authorization, user-facing error wording and transaction policy.
- A client cache, form state engine or automatic invalidation protocol.
- A second Effect runtime owner or test runner.
- An implied guarantee about deployed cancellation based only on local fixtures.

Local implementation status, next work and maintainer decisions are in [the roadmap](./roadmap.md).
