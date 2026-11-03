---
"@shivaedev/contract": minor
"@shivaedev/react": minor
"@shivaedev/create-app": minor
---

### Added

- `@shivaedev/contract`: `composeBindings(client, bindings)` preserves the client's type and declares the bound APIs in one connection. `liveBindings(connection)` reads that composition while retaining support for direct bindings and object properties.
- `@shivaedev/react`: Session boundaries mount every API declared with contract's `composeBindings`, including APIs nested inside feature modules, and apply the session's live coalescing window to each binding.

### Fixed

- `@shivaedev/create-app`: Generated apps compose module bindings through contract and pass the rendering registry into every client registration, including the signed-out router.

### Breaking

- `@shivaedev/react`: The `internal/liveBindings.ts` module is removed. Consumers that imported it must import `liveBindings` from `@shivaedev/contract/composeBindings.ts` instead.
- `@shivaedev/create-app`: Generated app client registrations and custom connection callbacks return construction Effects. Wrap existing synchronous registration values in `Effect.succeed`, or read `AtomRegistry.AtomRegistry` in the Effect for session-scoped bindings. Return `clientModules(session, registrationEffects)` from custom connections; `SessionApp` provides the rendering registry.
