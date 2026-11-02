---
"@shivaedev/errors": minor
"@shivaedev/server": minor
"@shivaedev/work-board": minor
---

### Added

- `@shivaedev/errors`: Sensitive RPC failure schemas accept a constant encoded `redactionMask` annotation when a generic mask cannot decode. Policy definition returns a typed `InvalidRedactionMask` naming the field when its mask is incompatible.
- `@shivaedev/work-board`: Board startup propagates the host's typed invalid-mask definition error.

### Fixed

- `@shivaedev/errors`: Declared failures alongside interruptions retain their classification and interruption. Native RPC exit schemas supply the complete failure schema, including stream rejections.
- `@shivaedev/server`: Masked failures retain scalar, array and object wire shapes so native RPC clients decode the declared failure without a schema error.

### Breaking

- `@shivaedev/errors`: Constrained sensitive failure schemas whose generic masks cannot decode must supply a non-secret encoded `redactionMask`; invalid definitions fail before the host listens.
- `@shivaedev/server`: `redactingRpcSerialization` now takes the validated policy returned by `yield* schemaSensitiveKeys(group, extraKeys)` as its second argument. Replace the separate key predicate and masking callbacks with that policy.
- `@shivaedev/work-board`: Consumers explicitly enumerating `boardLayer` startup errors must include `InvalidRedactionMask` from `@shivaedev/errors/wireMask.ts`.
