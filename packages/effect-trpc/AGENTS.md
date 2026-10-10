# @shivaedev/effect-trpc

You are changing the bridge between a tRPC API and an Effect application. A Promise-based resolver must not make application code rebuild services, lose typed Schema values or detach scoped work from its caller. The package lets a procedure yield services from one application runtime and a request Layer, and lets a subscription return a Stream. It serves applications that use tRPC; Platform's default query and command path remains `effect-contract`.

When goals conflict, preserve Effect's types, scope and interruption first; keep request identity and public error data deliberate second; preserve tRPC's router, middleware and transport ownership third; remove repeated boundary code fourth. Convenience loses when it requires a second service model, weakens a resolver's requirements or hides when a Stream releases resources.

A request service comes from the context after tRPC middleware, never shared mutable request state. A rejection crosses only because its Schema was declared. An explicit transport error can be public; other failures and defects stay redacted unless the application maps them. Keep encoded and decoded types distinct: both input and output Schemas decode, so resolver output uses the encoded type.

Tests must observe the boundary being claimed. A router caller proves caller behavior, an in-process fetch fixture proves serialization, and neither proves a deployed host's disconnect lifecycle. Keep application authorization, transaction and transport policy outside the adapter. Reuse `effect-test` for the test runner rather than growing another runner here.

Read [README.md](README.md) for use, [docs/north-star.md](docs/north-star.md) for the full design and [docs/roadmap.md](docs/roadmap.md) for local status and decisions the maintainer owns. Follow the root `AGENTS.md` for repository rules.
