---
"@shivaedev/quality": minor
---

### Breaking

- Enforce the service model in every `defineService` folder. Move declarations to `service.ts`, keep each operation in its own sibling file, and export it with `Effect.fn("Service.operation")`, including operations returned by owned-state factories. Yield dependencies inside operations instead of keeping them in initializer state; keep context runners in `adapters/` or `test-support/`. Existing consumers can review and record retained debt with Quality's first-adoption baseline command for `effect/service-model`, `effect/service-folders` and `effect/context-capture`.
