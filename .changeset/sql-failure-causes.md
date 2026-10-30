---
"@shivaedev/sql": minor
"@shivaedev/server": minor
"@shivaedev/test-sql": minor
---

### Breaking

- Schema component failures now reach SQL migration and readiness callers, server startup and test-sql migration helpers with their original error, tag and cause, and log the component name. Handle the component's own error instead of a wrapping `MigrationError` with kind `Failed`. When annotating migration options with fallible components, supply their error type as the second generic parameter; the default describes components that cannot fail.
- Declare `WorkerRelease` through `defineService`. Consumers using the old class as a type must use `Context.Service.Identifier<typeof WorkerRelease>`; yielding the service and providing its value stay the same.

### Fixed

- SQL decodes migration ledger, release ownership and change-coverage rows before using them. Malformed rows fail with `SchemaError` instead of being treated as current, pending or a different owner.
- SQL generates worker identities and change-listener heartbeat tokens through Effect's `Random` service.
