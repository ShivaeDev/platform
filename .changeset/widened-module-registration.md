---
"@shivaedev/server": minor
---

### Breaking

- `@shivaedev/server`: `appModules` refuses at compile time a registration whose type lost a defined module's `requires`: one annotated `: AppModule`, returned by a helper typed `AppModule`, or whose `module` is typed `RegisteredModule`. Such a registration used to compile with generated handlers that required nothing, so a missing module service failed only when an operation ran. A `group` plus `handlers` registration annotated `: AppModule` is refused too, because its type is the same. To migrate either kind, declare the registration with `satisfies AppModule` instead of the annotation, or write the object literal directly in the list passed to `appModules`; a helper returns its inferred type instead of `AppModule`.
