---
"@shivaedev/identity": minor
"@shivaedev/contract": minor
"@shivaedev/server": minor
---

### Breaking

- `@shivaedev/identity`: Remove `@shivaedev/identity/server/commandChanges.ts` and its `commandChanges(effect, rpc, payload)` export. Session, permission and tracing middleware no longer publish command changes. Remove command wrappers from custom authentication middleware and supply only the validated viewer and session. Applications using `appHost` get command publication automatically. Custom hosts compose `guardCommands(group)` and `commandGuardLayer(publishCommand)` from `@shivaedev/contract/CommandGuard.ts` with `publishCommand` from `@shivaedev/server/publishCommand.ts`; provide the changes publication port for the chosen transport.

### Added

- `@shivaedev/contract`: Supply `CommandGuard`, `CommandBoundary`, `guardCommands` and `commandGuardLayer` to evaluate declared command changes for the current viewer independently of authentication and tracing.
- `@shivaedev/server`: Compose command publication through the changes publication port, preserving post-commit retries, deduplication and recovery across required, optional and custom authentication.
