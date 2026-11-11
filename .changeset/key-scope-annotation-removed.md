---
"@shivaedev/contract": minor
---

### Breaking

- `KeyScope` is no longer exported from `@shivaedev/contract/serverMetadata.ts`, and a `keyScope: "session"` contract no longer annotates its RPCs with it. Nothing read the annotation, so there is no replacement: server keys were and stay unprefixed. Remove any import of `KeyScope`. In the browser, `keyScope: "session"` still prefixes every client read and invalidation key with an opaque id of the binding's registry.
