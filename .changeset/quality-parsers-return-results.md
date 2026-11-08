---
"@shivaedev/quality": minor
---

### Breaking

- `pnpmWorkspaceList` and `pnpmWorkspacePatterns` from `imports/pnpmWorkspacePatterns.ts`, `compilePolicy` from `imports/fences/compilePolicy.ts`, `migrateConfig` from `exceptions/migrateConfig.ts` and `migrateBiome` from `exceptions/migrateBiome.ts` now return a `Result` instead of throwing. Read `Result.isFailure(result)` and `result.failure.message` where you caught the thrown error, or pass the result to `Effect.fromResult` inside Effect code. The failures are `PnpmWorkspaceFailure`, `BoundaryFailure` and `MigrationFailure`, and each keeps the message the thrown error had.
