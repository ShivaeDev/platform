---
"@shivaedev/quality": patch
---

### Fixed

- `effect/service-parameters` accepts an `AtomRegistry` or `AtomRpcClient` parameter of a plain function, which has no Effect environment to yield the handle from, and accepts a tag parameter only handed to `.middleware(tag)` or `Context.pick`. An `Effect.fn` taking a registry and a function that yields a received tag are still reported.
