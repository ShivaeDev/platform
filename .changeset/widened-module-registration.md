---
"@shivaedev/server": patch
---

### Fixed

- `@shivaedev/server`: `appModules` refuses at compile time a defined module's registration whose type lost the module's `requires`: one annotated `: AppModule`, returned by a helper typed `AppModule`, or whose `module` is typed `RegisteredModule`. Such a registration used to compile with generated handlers that required nothing, so a missing module service failed only when an operation ran. Declare the registration with `satisfies AppModule` and pass the module itself, or have the helper return its inferred type.
