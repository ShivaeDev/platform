# Roadmap

This file owns the service helper's implementation status and package questions. The [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md) owns integration between packages, supported Effect version alignment and runtime ownership at host boundaries.

## Built

- [x] `defineService` returns a native Context service with a Layer that binds declared dependencies in initialization and ordinary methods. Runtime tests retain the bound value even when a caller supplies another value.
- [x] Private initialization state and a method factory run once for the Layer lifetime exercised by the runtime fixture; emitted declarations expose the methods and omit the private initialization surface.
- [x] Initialization finalizers run when the provided Layer ends. Method resources release with the caller scope while the service remains live.
- [x] Public declarations retain arguments, success types, method failure types, initializer failure types and caller scope requirements.
- [x] Runtime tests prove [initialization and method failures, failed-initialization cleanup and method defects](../src/serviceFailures.spec.ts), [method interruption with caller-scope cleanup and interrupted initialization](../src/serviceInterruption.spec.ts), and [initialization finalizers running once on Layer scope closure or owner interruption](../src/serviceScope.spec.ts).
- [x] Compiler fixtures reject undeclared dependencies, Scope in the declared dependency list, non-method members, incomplete service replacements and private-state access.
- [x] Explicitly marked generic methods in requirement-free services retain generic success, failure and caller requirement relationships. Compiler fixtures reject the correlated unmarked generic, generic dependency binding and distinct two-signature overload shapes they exercise.
- [x] Installed-package fixtures check direct module imports, a dependency-bound public method type, and execution through the packed service Layer.

## Next

No package-local implementation work is queued.

## Open questions

- Should the exported helper and proof types be a supported application API, or should their export boundary become an implementation boundary? The wildcard module exports expose them; the documented service-authoring path uses `define-service.ts`, `generic-method.ts` and `service-requirements.ts`.
