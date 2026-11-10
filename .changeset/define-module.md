---
"@shivaedev/contract": minor
---

### Added

- `defineModule({ name, operations, requires, middleware?, subject?, keyScope? })` from `@shivaedev/contract/defineModule.ts` defines a module from operations written as `payload` and `*run`. It returns the module's contract, which client and host code accept like any contract, plus its `requires`. Its generics check the definition on the `name` line, naming the operation in the first line of the compiler's message: `OperationNeedsUndeclaredServices` when a `run` or read policy uses a service that `requires`, the middleware and the subject do not provide, `OperationFailsOutsideItsRejections` when an operation can fail outside its rejections other than with an infrastructure failure, and `OperationNameRepeated`.
- `moduleHandlers(module)` from `@shivaedev/contract/moduleHandlers.ts` builds the module's handler Layer from its operations, requiring exactly the module's `requires`. Each operation runs in a span named `<Module>.<operation>`; a query's read policy is checked inside its handler before `run`, so a policy may read a repository directly, and live subscriptions check the same policy. An undeclared failure that states `isRetryable` answers `ServiceUnavailable`, and anything else undeclared answers `InternalServerError` and is reported.
- Operations written with `run` report three more mismatches: `RunReturnsAny` when `run` returns `any`, which previously switched the success and rejection checks off; `SuccessClassNotReturned` when the success is a `Schema.Class` and `run` returns something other than that class; and `RejectionClassDiffers` when a listed rejection class and the class `run` raises under the same tag differ in shape. TypeScript compares classes by shape, so a same-shape twin of a class still compiles.
