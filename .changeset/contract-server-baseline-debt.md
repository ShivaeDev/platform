---
"@shivaedev/contract": patch
"@shivaedev/server": minor
---

### Changed

- `@shivaedev/contract`: Invalid contract declarations now fail as Effect defects when the server validates them during host startup.

### Breaking

- `@shivaedev/server`: `redactingRpcSerialization` now reads `RpcSerialization` from the Effect environment. Replace `redactingRpcSerialization(wire, sensitive)` with `yield* redactingRpcSerialization(sensitive)` inside an Effect that provides `RpcSerialization`.
- `@shivaedev/server`: Import `PlatformRuntime` and `PlatformRuntimeOptions` from `@shivaedev/server/adapters/platformRuntime.ts` instead of `@shivaedev/server/runtime/types.ts`.
