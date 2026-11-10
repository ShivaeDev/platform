---
"@shivaedev/quality": patch
---

### Changed

- The built-in rules that ask the TypeScript type checker (`effect/service-parameters`, `effect/service-model`, `effect/context-capture`, `effect/rpc-boundary`, `effect/sql-transact`, `effect/shared-error-classes`, `boundaries/imported-change-keys` and the typed checks of `suppressions/no-double-cast`) share one program per workspace package in a lint, and each package's program is dropped before the next is built. Before, each rule built its own programs. A lint of this repository finished about 15 percent sooner with the same peak memory and the same findings.
