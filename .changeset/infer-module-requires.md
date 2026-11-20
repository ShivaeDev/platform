---
"@shivaedev/contract": minor
"@shivaedev/server": minor
"@shivaedev/create-app": patch
---

### Breaking

- `@shivaedev/contract`: `defineModule` no longer takes `requires`: delete the `requires` line from every `defineModule({ ... })`, and the imports only it used. The module's type now carries, for each operation, the services its `run` and read policy yield, less what its middleware and subject provide per call, and `moduleHandlers(module)` requires exactly those services. An operation that starts to yield another service needs no other edit.
- `@shivaedev/contract`: `OperationNeedsUndeclaredServices` and `Allowed` are removed from `@shivaedev/contract/moduleProof.ts`, and `NameProof` takes the operations and the wire only. A module's `"~requires"` is now a record from each operation's name to the services it needs, and `AnyModule["~requires"]` is `ModuleServices`.
- `@shivaedev/server`: `appModules` refuses, at compile time, a registration list in which a defined module's operation yields a service that no registration's `services`, `ports` or `requestServices` provide and the host does not provide. The message names the problem as `OperationServicesNotProvided<"<module>", "<operation>", <Service>>` from `@shivaedev/server/providedModules.ts`. A service an application used to provide around the host, or only through `replacements`, moves into a registration's `services` or `ports`.

### Changed

- `@shivaedev/create-app`: `create-app` writes a resource module without `requires` or the repository import it needed.
