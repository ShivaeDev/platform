---
"@shivaedev/errors": minor
"@shivaedev/create-app": patch
---

### Breaking

- `@shivaedev/errors`: `rpcBoundaryHandlers(group, options, handlers)` derives each operation's rejection schema independently. Replace the former `rpcBoundary(schema, options)` second argument with `options`; every operation must declare the fallback returned by `unexpected`. Effect and Stream handlers retain their own rejection types and required services.

### Fixed

- `@shivaedev/create-app`: generated notes handlers apply one group boundary while preserving each operation's declared rejections.
