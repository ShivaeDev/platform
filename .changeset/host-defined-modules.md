---
"@shivaedev/server": minor
"@shivaedev/contract": minor
---

### Added

- `@shivaedev/server`: An `AppModule` registration can name a module built with `defineModule` as `module: Notes` instead of `group` plus `handlers`; `appModules` builds its group and its handlers with `moduleHandlers`, and both forms can sit in one application. The `group` plus `handlers` form is being retired.
- `@shivaedev/server`: The host refuses to start with `HandWrittenModuleHandlers` when a query of a defined module is served by anything but its generated handler, naming the module and each affected query, and `AppModule` refuses a defined module as `group` at compile time.
- `@shivaedev/contract`: Every RPC of a module built with `defineModule` carries the `DefinedModule` annotation with the module's name, and `contract.ts` exports `withDeclaration`.
